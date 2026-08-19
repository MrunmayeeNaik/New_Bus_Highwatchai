import React, { useState, useEffect } from 'react';
import { useNavigate, useSearchParams } from 'react-router-dom';
import { Heart, ArrowRight, Star, Clock, AlertTriangle, ShieldCheck, MapPin, Filter, Wifi, Power, Tv, Eye } from 'lucide-react';
import api, { mockData, releaseSeatLocksOnUnload } from '../services/api';

function formatTime(seconds) {
  const clamped = Math.max(0, Math.floor(seconds));
  const m = Math.floor(clamped / 60).toString().padStart(2, '0');
  const s = (clamped % 60).toString().padStart(2, '0');
  return `${m}:${s}`;
}

const AMENITIES_LIST = [
  { name: 'WiFi', icon: <Wifi size={14} /> },
  { name: 'Charging Point', icon: <Power size={14} /> },
  { name: 'Blanket', icon: <span>🛌</span> },
  { name: 'Water Bottle', icon: <span>🥤</span> },
  { name: 'GPS', icon: <span>📍</span> },
  { name: 'TV', icon: <Tv size={14} /> },
  { name: 'CCTV', icon: <Eye size={14} /> }
];

// Formats the gap between two ISO timestamps as "Xh Ym"
function formatDuration(startIso, endIso) {
  const ms = new Date(endIso) - new Date(startIso);
  if (!Number.isFinite(ms) || ms <= 0) return '—';
  const totalMinutes = Math.round(ms / 60000);
  const hours = Math.floor(totalMinutes / 60);
  const minutes = totalMinutes % 60;
  return `${hours}h ${String(minutes).padStart(2, '0')}m`;
}

export default function SearchResults() {
  const [searchParams] = useSearchParams();
  const navigate = useNavigate();
  
  const fromCity = searchParams.get('from');
  const toCity = searchParams.get('to');
  const journeyDate = searchParams.get('date');
  const passengers = Math.max(1, Number(searchParams.get('passengers')) || 1);
  const tripType = searchParams.get('tripType') || 'one_way';
  const returnDate = searchParams.get('returnDate') || '';

  const [activeLeg, setActiveLeg] = useState('onward');
  const [trips, setTrips] = useState([]);
  const [loading, setLoading] = useState(true);
  const [selectedTrip, setSelectedTrip] = useState(null);
  const [seatLayout, setSeatLayout] = useState([]);
  const [selectedSeats, setSelectedSeats] = useState([]);
  const [activeDeck, setActiveDeck] = useState('lower');
  const [nowTick, setNowTick] = useState(() => Date.now());

  const profileId = (() => {
    try {
      return JSON.parse(sessionStorage.getItem('user_profile') || '{}').id;
    } catch (e) {
      return undefined;
    }
  })();

  // Seats already locked by the current user for the trip they're viewing (e.g. after
  // navigating back from the checkout page without confirming the booking yet)
  const ownLockedSeats = seatLayout.filter(s => s.status === 'locked' && s.held_by === profileId);
  const ownLockedSeatIdsKey = ownLockedSeats.map(s => s.id).join(',');
  const ownLockSecondsLeft = ownLockedSeats.length > 0
    ? Math.min(...ownLockedSeats.map(s => (new Date(s.locked_until).getTime() - nowTick) / 1000).filter(v => Number.isFinite(v)))
    : null;

  // Ticks once a second so the hold countdown above the seat map stays live
  useEffect(() => {
    if (ownLockedSeats.length === 0) return;
    const interval = setInterval(() => setNowTick(Date.now()), 1000);
    return () => clearInterval(interval);
  }, [ownLockedSeats.length]);

  // Release any seats the user locked from this screen if they close the tab/browser
  // or navigate to a different site without proceeding to checkout — otherwise the
  // hold would just sit there until the 10-minute TTL expires on its own.
  useEffect(() => {
    if (ownLockedSeats.length === 0 || !selectedTrip) return;
    const tripId = selectedTrip.id;
    const seatIds = ownLockedSeats.map(s => s.id);
    const handleUnload = () => releaseSeatLocksOnUnload(tripId, seatIds);
    window.addEventListener('beforeunload', handleUnload);
    window.addEventListener('pagehide', handleUnload);
    return () => {
      window.removeEventListener('beforeunload', handleUnload);
      window.removeEventListener('pagehide', handleUnload);
    };
  }, [ownLockedSeatIdsKey, selectedTrip]);

  // Advanced Search Filters
  const [acFilter, setAcFilter] = useState(false);
  const [sleeperFilter, setSleeperFilter] = useState(false);
  const [seaterFilter, setSeaterFilter] = useState(false);
  const [semiSleeperFilter, setSemiSleeperFilter] = useState(false);
  const [luxuryFilter, setLuxuryFilter] = useState(false);
  
  const [priceMinFilter, setPriceMinFilter] = useState(0);
  const [priceMaxFilter, setPriceMaxFilter] = useState(2500);
  const [ratingFilter, setRatingFilter] = useState(0);
  
  const [depPeriodFilter, setDepPeriodFilter] = useState('');
  const [arrPeriodFilter, setArrPeriodFilter] = useState('');
  const [amenitiesFilter, setAmenitiesFilter] = useState([]);
  const [minSeatsFilter, setMinSeatsFilter] = useState(passengers);
  const [operatorInput, setOperatorInput] = useState('');
  const [operatorFilter, setOperatorFilter] = useState('');
  const [cancellationPolicy, setCancellationPolicy] = useState(null);

  const [sortBy, setSortBy] = useState('price_asc');
  const [page, setPage] = useState(1);
  const limit = 5;

  // Loads the platform's active cancellation policy once, to display on every trip card
  useEffect(() => {
    api.get('/master/cancellation-policies')
      .then(res => {
        if (res.data && res.data.length > 0) setCancellationPolicy(res.data[0]);
      })
      .catch(() => {});
  }, []);

  // Real-time EventSource listener for seat updates
  useEffect(() => {
    if (!selectedTrip) return;
    
    const url = `${api.defaults.baseURL || 'http://localhost:8000/api/v1'}/bookings/seats/live`;
    const es = new EventSource(url);
    
    es.onmessage = (event) => {
      if (event.data === 'status_update') {
        api.get(`/bookings/seats/layout/${selectedTrip.id}`)
          .then(res => {
            if (res.data && res.data.length > 0) {
              setSeatLayout(res.data);
            }
          })
          .catch(() => {});
      }
    };
    
    return () => es.close();
  }, [selectedTrip]);

  // Swaps source/destination/date to the return leg's route when the round-trip "Return" tab is active
  // Debounces the operator search box so a request isn't fired on every keystroke
  useEffect(() => {
    const timeout = setTimeout(() => setOperatorFilter(operatorInput.trim()), 400);
    return () => clearTimeout(timeout);
  }, [operatorInput]);

  const getLegQuery = () => (
    tripType === 'round_trip' && activeLeg === 'return'
      ? { source: toCity, destination: fromCity, date: returnDate }
      : { source: fromCity, destination: toCity, date: journeyDate }
  );

  // Load and filter trips from API (Database eager preloads + Server filtering)
  const fetchTrips = () => {
    setLoading(true);

    const busTypesList = [];
    if (acFilter) busTypesList.push('AC_Sleeper', 'AC_Seater', 'AC_Semi_Sleeper', 'Volvo_Multi_Axle');
    if (sleeperFilter) busTypesList.push('AC_Sleeper', 'Non_AC_Sleeper');
    if (seaterFilter) busTypesList.push('AC_Seater', 'Non_AC_Seater');
    if (semiSleeperFilter) busTypesList.push('AC_Semi_Sleeper', 'Non_AC_Semi_Sleeper');
    if (luxuryFilter) busTypesList.push('Volvo_Multi_Axle', 'AC_Sleeper');

    const busTypeParam = busTypesList.length > 0 ? busTypesList.join(',') : '';
    const amenitiesParam = amenitiesFilter.length > 0 ? amenitiesFilter.join(',') : '';
    const offset = (page - 1) * limit;
    const { source, destination, date } = getLegQuery();

    let url = `/bookings/search?source_city_id=${source}&destination_city_id=${destination}&journey_date=${date}&limit=${limit}&offset=${offset}`;
    if (busTypeParam) url += `&bus_type=${busTypeParam}`;
    if (priceMinFilter > 0) url += `&min_price=${priceMinFilter}`;
    if (priceMaxFilter < 2500) url += `&max_price=${priceMaxFilter}`;
    if (ratingFilter > 0) url += `&min_rating=${ratingFilter}`;
    if (depPeriodFilter) url += `&departure_period=${depPeriodFilter}`;
    if (arrPeriodFilter) url += `&arrival_period=${arrPeriodFilter}`;
    if (amenitiesParam) url += `&amenities=${amenitiesParam}`;
    if (minSeatsFilter > 1) url += `&min_available_seats=${minSeatsFilter}`;
    if (operatorFilter) url += `&operator_name=${encodeURIComponent(operatorFilter)}`;
    if (sortBy) url += `&sort_by=${sortBy}`;
    
    api.get(url)
      .then(res => {
        setTrips(res.data);
        setLoading(false);
      })
      .catch(() => {
        setTrips(mockData.trips);
        setLoading(false);
      });
  };

  useEffect(() => {
    const { source, destination, date } = getLegQuery();
    if (source && destination && date) {
      fetchTrips();
    }
  }, [
    fromCity, toCity, journeyDate, activeLeg, tripType, returnDate,
    acFilter, sleeperFilter, seaterFilter, semiSleeperFilter, luxuryFilter,
    priceMinFilter, priceMaxFilter, ratingFilter,
    depPeriodFilter, arrPeriodFilter, amenitiesFilter, minSeatsFilter, operatorFilter,
    sortBy, page
  ]);

  // Log Search History once on mount
  useEffect(() => {
    if (sessionStorage.getItem('access_token') && fromCity && toCity) {
      api.post('/passenger/search-history', {
        source_city_id: fromCity,
        destination_city_id: toCity
      }).catch(() => {});
    }
  }, [fromCity, toCity]);

  const handleSelectTrip = (trip) => {
    setSelectedTrip(trip);
    setSelectedSeats([]);
    setActiveDeck('lower');
    
    api.get(`/bookings/seats/layout/${trip.id}`)
      .then(res => {
        setSeatLayout(res.data.length > 0 ? res.data : mockData.layout);
      })
      .catch(() => {
        setSeatLayout(mockData.layout);
      });
  };

  const handleSeatClick = (seat) => {
    const profile = JSON.parse(sessionStorage.getItem('user_profile') || '{}');
    if (seat.status === 'booked' || (seat.status === 'locked' && seat.held_by !== profile.id)) {
      return;
    }
    
    if (selectedSeats.find(s => s.id === seat.id)) {
      setSelectedSeats(prev => prev.filter(s => s.id !== seat.id));
    } else {
      setSelectedSeats(prev => [...prev, seat]);
    }
  };

  const handleLockSeats = () => {
    if (selectedSeats.length === 0) {
      alert('Please select at least one seat.');
      return;
    }

    const token = sessionStorage.getItem('access_token');
    if (!token) {
      alert('Please login to lock seats and proceed to book.');
      navigate('/login');
      return;
    }

    const seatIds = selectedSeats.map(s => s.id);
    
    api.post('/bookings/seats/lock', {
      trip_id: selectedTrip.id,
      seat_ids: seatIds
    })
      .then(() => {
        navigate('/booking', { state: { trip: selectedTrip, seats: selectedSeats } });
      })
      .catch((err) => {
        if (err.response?.data?.detail) {
          alert(err.response.data.detail);
        } else if (!err.response) {
          alert('Could not reach the booking server. Please check your connection (or that the backend is running) and try again.');
        } else {
          alert(`Lock failed (HTTP ${err.response.status}). Please try again.`);
        }
      });
  };

  const toggleAmenity = (name) => {
    setAmenitiesFilter(prev =>
      prev.includes(name) ? prev.filter(item => item !== name) : [...prev, name]
    );
  };

  const clearFilters = () => {
    setAcFilter(false);
    setSleeperFilter(false);
    setSeaterFilter(false);
    setSemiSleeperFilter(false);
    setLuxuryFilter(false);
    setPriceMinFilter(0);
    setPriceMaxFilter(2500);
    setRatingFilter(0);
    setDepPeriodFilter('');
    setArrPeriodFilter('');
    setAmenitiesFilter([]);
    setMinSeatsFilter(1);
    setOperatorInput('');
    setOperatorFilter('');
    setSortBy('price_asc');
    setPage(1);
  };

  return (
    <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-10 transition-colors duration-300">

      {/* Round Trip Leg Switcher */}
      {tripType === 'round_trip' && returnDate && (
        <div className="flex gap-2 mb-6 bg-slate-100 dark:bg-slate-900 border border-slate-200/50 dark:border-slate-900/50 rounded-2xl p-1.5 w-fit">
          <button
            type="button"
            onClick={() => { setActiveLeg('onward'); setSelectedTrip(null); }}
            className={`px-5 py-2 rounded-xl text-xs font-bold transition-all cursor-pointer ${activeLeg === 'onward' ? 'bg-brand-500 text-white shadow' : 'text-slate-500 dark:text-slate-400'}`}
          >
            Onward • {journeyDate}
          </button>
          <button
            type="button"
            onClick={() => { setActiveLeg('return'); setSelectedTrip(null); }}
            className={`px-5 py-2 rounded-xl text-xs font-bold transition-all cursor-pointer ${activeLeg === 'return' ? 'bg-brand-500 text-white shadow' : 'text-slate-500 dark:text-slate-400'}`}
          >
            Return • {returnDate}
          </button>
        </div>
      )}

      {/* Route Banner Header */}
      {trips.length > 0 && (
        <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4 bg-white dark:bg-slate-900 border border-slate-200/50 dark:border-slate-900/50 px-6 py-4 rounded-2xl mb-8 text-left shadow-sm">
          <div>
            <h2 className="text-lg font-black text-slate-800 dark:text-slate-100">
              Select Bus Service
            </h2>
            <p className="text-xs text-slate-400 mt-1">
              Showing matching scheduled trips for your search query.
            </p>
          </div>
          {sessionStorage.getItem('access_token') && trips[0]?.route_id && (
            <button
              onClick={() => {
                api.post('/passenger/favorites', { route_id: trips[0].route_id })
                  .then(() => alert('Route successfully added to your favorites!'))
                  .catch(() => alert('Route already in your favorites list.'));
              }}
              className="flex items-center space-x-1.5 px-4 py-2 bg-rose-50 dark:bg-rose-950/20 text-rose-500 hover:bg-rose-100 dark:hover:bg-rose-950/40 rounded-xl text-xs font-bold transition-all border border-rose-200/40 dark:border-rose-900/40"
            >
              <span>Favorite this Route</span>
            </button>
          )}
        </div>
      )}

      {/* Main Console Layout */}
      <div className="flex flex-col md:flex-row gap-8 text-left">
        
        {/* Advanced Filters Side Panel */}
        <div className="w-full md:w-72 flex-shrink-0 space-y-6">
          <div className="glass-card p-6 rounded-2xl border border-slate-200/50 dark:border-slate-900/50 space-y-6 bg-white dark:bg-slate-900">
            <div className="flex items-center justify-between">
              <h3 className="font-bold text-slate-800 dark:text-slate-100 flex items-center gap-2">
                <Filter size={18} className="text-brand-500" /> Filters
              </h3>
              <button
                type="button"
                onClick={clearFilters}
                className="text-xs text-brand-500 font-bold hover:underline"
              >
                Clear All
              </button>
            </div>

            {/* Bus Operator */}
            <div className="space-y-3">
              <h4 className="text-xs font-black uppercase text-slate-400">Bus Operator</h4>
              <input
                type="text"
                placeholder="Search by operator..."
                value={operatorInput}
                onChange={(e) => setOperatorInput(e.target.value)}
                className="w-full bg-slate-50 dark:bg-slate-950 border border-slate-250 dark:border-slate-800 px-3 py-2 rounded-xl text-sm font-medium focus:ring-2 focus:ring-brand-500 outline-none transition-all"
              />
            </div>

            {/* Bus Types */}
            <div className="space-y-3">
              <h4 className="text-xs font-black uppercase text-slate-400">Bus Type</h4>
              <div className="space-y-2">
                {['AC', 'Sleeper', 'Seater', 'Semi Sleeper', 'Luxury'].map((type) => (
                  <label key={type} className="flex items-center space-x-3 cursor-pointer">
                    <input
                      type="checkbox"
                      checked={
                        type === 'AC' ? acFilter :
                        type === 'Sleeper' ? sleeperFilter :
                        type === 'Seater' ? seaterFilter :
                        type === 'Semi Sleeper' ? semiSleeperFilter : luxuryFilter
                      }
                      onChange={(e) => {
                        if (type === 'AC') setAcFilter(e.target.checked);
                        else if (type === 'Sleeper') setSleeperFilter(e.target.checked);
                        else if (type === 'Seater') setSeaterFilter(e.target.checked);
                        else if (type === 'Semi Sleeper') setSemiSleeperFilter(e.target.checked);
                        else setLuxuryFilter(e.target.checked);
                      }}
                      className="rounded text-brand-500 focus:ring-brand-500 h-4 w-4 bg-slate-100 border-slate-300"
                    />
                    <span className="text-sm font-semibold">{type}</span>
                  </label>
                ))}
              </div>
            </div>

            {/* Price Slider */}
            <div className="space-y-3">
              <h4 className="text-xs font-black uppercase text-slate-400">Price Range (₹)</h4>
              <div className="space-y-2">
                <input
                  type="range"
                  min="0"
                  max="2500"
                  step="50"
                  value={priceMaxFilter}
                  onChange={(e) => setPriceMaxFilter(parseInt(e.target.value))}
                  className="w-full h-2 bg-slate-200 dark:bg-slate-800 rounded-lg appearance-none cursor-pointer accent-brand-500"
                />
                <div className="flex justify-between text-xs font-bold text-slate-500">
                  <span>₹0</span>
                  <span>Max: ₹{priceMaxFilter}</span>
                </div>
              </div>
            </div>

            {/* Star Ratings */}
            <div className="space-y-3">
              <h4 className="text-xs font-black uppercase text-slate-400">Star Rating</h4>
              <div className="flex gap-2">
                {[4, 3, 2].map((stars) => (
                  <button
                    key={stars}
                    type="button"
                    onClick={() => setRatingFilter(ratingFilter === stars ? 0 : stars)}
                    className={`flex-1 py-1.5 rounded-xl border text-xs font-bold transition-all flex items-center justify-center gap-1 ${
                      ratingFilter === stars
                        ? 'bg-brand-500 border-brand-500 text-white'
                        : 'bg-slate-50 dark:bg-slate-900 border-slate-250 dark:border-slate-800 text-slate-600 dark:text-slate-400'
                    }`}
                  >
                    <span>{stars}+</span>
                    <Star size={12} className={ratingFilter === stars ? 'fill-white' : 'fill-slate-400'} />
                  </button>
                ))}
              </div>
            </div>

            {/* Departure Period */}
            <div className="space-y-3">
              <h4 className="text-xs font-black uppercase text-slate-400">Departure Time</h4>
              <div className="grid grid-cols-2 gap-2">
                {['Morning', 'Afternoon', 'Evening', 'Night'].map((period) => (
                  <button
                    key={period}
                    type="button"
                    onClick={() => setDepPeriodFilter(depPeriodFilter === period ? '' : period)}
                    className={`py-1.5 rounded-xl border text-[10px] font-bold transition-all ${
                      depPeriodFilter === period
                        ? 'bg-brand-500 border-brand-500 text-white'
                        : 'bg-slate-50 dark:bg-slate-900 border-slate-250 dark:border-slate-800 text-slate-600 dark:text-slate-400'
                    }`}
                  >
                    {period}
                  </button>
                ))}
              </div>
            </div>

            {/* Arrival Period */}
            <div className="space-y-3">
              <h4 className="text-xs font-black uppercase text-slate-400">Arrival Time</h4>
              <div className="grid grid-cols-2 gap-2">
                {['Morning', 'Afternoon', 'Evening', 'Night'].map((period) => (
                  <button
                    key={period}
                    type="button"
                    onClick={() => setArrPeriodFilter(arrPeriodFilter === period ? '' : period)}
                    className={`py-1.5 rounded-xl border text-[10px] font-bold transition-all ${
                      arrPeriodFilter === period
                        ? 'bg-brand-500 border-brand-500 text-white'
                        : 'bg-slate-50 dark:bg-slate-900 border-slate-250 dark:border-slate-800 text-slate-600 dark:text-slate-400'
                    }`}
                  >
                    {period}
                  </button>
                ))}
              </div>
            </div>

            {/* Amenities Checklist */}
            <div className="space-y-3">
              <h4 className="text-xs font-black uppercase text-slate-400">Amenities</h4>
              <div className="flex flex-wrap gap-1.5">
                {AMENITIES_LIST.map((am) => (
                  <button
                    key={am.name}
                    type="button"
                    onClick={() => toggleAmenity(am.name)}
                    className={`px-3 py-1.5 rounded-full border text-[10px] font-bold transition-all flex items-center gap-1 ${
                      amenitiesFilter.includes(am.name)
                        ? 'bg-brand-500 border-brand-500 text-white'
                        : 'bg-slate-50 dark:bg-slate-900 border-slate-250 dark:border-slate-850 text-slate-600 dark:text-slate-400'
                    }`}
                  >
                    {am.icon}
                    <span>{am.name}</span>
                  </button>
                ))}
              </div>
            </div>

            {/* Seat Availability count */}
            <div className="space-y-3">
              <h4 className="text-xs font-black uppercase text-slate-400">Min Available Seats</h4>
              <div className="flex items-center gap-4">
                <input
                  type="range"
                  min="1"
                  max="10"
                  value={minSeatsFilter}
                  onChange={(e) => setMinSeatsFilter(parseInt(e.target.value))}
                  className="w-full h-2 bg-slate-200 dark:bg-slate-800 rounded-lg appearance-none cursor-pointer accent-brand-500"
                />
                <span className="text-sm font-extrabold text-slate-800 dark:text-slate-100">{minSeatsFilter}</span>
              </div>
            </div>
          </div>
        </div>

        {/* Results List Section */}
        <div className="flex-1 space-y-6">
          
          {/* Sorting Dropdown & Summary Bar */}
          <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4 bg-slate-100/50 dark:bg-slate-900/20 p-4 rounded-2xl border border-slate-200/30 dark:border-slate-900/30">
            <span className="text-xs font-extrabold text-slate-500">
              {trips.length} Bus Services Available
              <span className="text-slate-400 font-semibold"> · {passengers} {passengers === 1 ? 'Passenger' : 'Passengers'}</span>
            </span>
            <div className="flex items-center space-x-2 text-xs">
              <span className="text-slate-400 font-bold">Sort By:</span>
              <select
                value={sortBy}
                onChange={(e) => setSortBy(e.target.value)}
                className="bg-white dark:bg-slate-900 border border-slate-250 dark:border-slate-800 px-3 py-1.5 rounded-xl font-bold outline-none text-slate-700 dark:text-slate-350 cursor-pointer"
              >
                <option value="price_asc">Price: Low to High</option>
                <option value="price_desc">Price: High to Low</option>
                <option value="dep_early">Departure: Early</option>
                <option value="dep_late">Departure: Late</option>
                <option value="arr_early">Arrival: Early</option>
                <option value="arr_late">Arrival: Late</option>
                <option value="duration_short">Duration: Shortest</option>
                <option value="duration_long">Duration: Longest</option>
                <option value="rating_desc">Ratings: High to Low</option>
                <option value="seats_desc">Available Seats</option>
              </select>
            </div>
          </div>

          {/* Core Results Renderer */}
          {loading ? (
            <div className="space-y-4">
              {[1, 2, 3].map((skeleton) => (
                <div key={skeleton} className="animate-pulse bg-white dark:bg-slate-900 p-6 rounded-2xl border border-slate-200/50 dark:border-slate-850 flex flex-col md:flex-row gap-6 justify-between items-center">
                  <div className="flex-1 space-y-3 w-full">
                    <div className="h-4 bg-slate-200 dark:bg-slate-800 rounded w-1/4"></div>
                    <div className="h-3 bg-slate-200 dark:bg-slate-800 rounded w-1/2"></div>
                  </div>
                  <div className="h-10 bg-slate-200 dark:bg-slate-800 rounded-xl w-32"></div>
                </div>
              ))}
            </div>
          ) : trips.length === 0 ? (
            <div className="text-center py-16 bg-white dark:bg-slate-900 rounded-2xl border border-slate-200/30 dark:border-slate-850 p-8">
              <div className="bg-slate-50 dark:bg-slate-950 p-4 rounded-full w-16 h-16 flex items-center justify-center mx-auto text-slate-400 mb-4">
                <AlertTriangle size={32} />
              </div>
              <h3 className="font-extrabold text-lg text-slate-800 dark:text-slate-100">No Services Found</h3>
              <p className="text-slate-400 text-xs mt-2 max-w-sm mx-auto">
                We couldn't find any scheduled trips matching your filter combinations. Try adjusting sliders or checking alternate dates.
              </p>
            </div>
          ) : (
            trips.map((trip) => (
              <div
                key={trip.id}
                className="bg-white dark:bg-slate-900 border border-slate-200/50 dark:border-slate-900/50 rounded-2xl overflow-hidden shadow-sm hover:shadow-md transition-all duration-300"
              >
                {/* Trip Info Card */}
                <div className="p-6 grid grid-cols-1 md:grid-cols-4 gap-6 items-center">
                  
                  {/* Operator Info */}
                  <div>
                    <h4 className="font-black text-lg text-slate-800 dark:text-slate-100">
                      {trip.operator?.name || 'Bus Operator'}
                    </h4>
                    <p className="text-slate-400 text-xs mt-1">
                      {trip.bus?.bus_type || 'AC Seater'}
                      {trip.bus?.bus_number && <span className="text-slate-300 dark:text-slate-600"> · {trip.bus.bus_number}</span>}
                    </p>
                    <div className="flex items-center gap-1 mt-2.5">
                      <span className="inline-flex items-center space-x-1 px-2 py-0.5 rounded bg-emerald-50 dark:bg-emerald-950/20 text-emerald-600 dark:text-emerald-400 text-[10px] font-black uppercase">
                        <Star size={10} className="fill-emerald-600 dark:fill-emerald-400 mr-0.5" />
                        {trip.operator?.rating ? trip.operator.rating.toFixed(1) : '5.0'}
                      </span>
                      <span className="text-[10px] text-slate-400">
                        ({trip.operator?.review_count ?? 0} review{trip.operator?.review_count === 1 ? '' : 's'})
                      </span>
                    </div>
                    {trip.bus?.amenities?.length > 0 && (
                      <div className="flex flex-wrap gap-1 mt-2">
                        {trip.bus.amenities.map((a) => (
                          <span
                            key={a.id || a.name}
                            title={a.name}
                            className="inline-flex items-center gap-1 px-1.5 py-0.5 rounded bg-slate-100 dark:bg-slate-800 text-slate-500 dark:text-slate-400 text-[9px] font-bold"
                          >
                            {AMENITIES_LIST.find((am) => am.name.toLowerCase() === a.name.toLowerCase())?.icon}
                            <span>{a.name}</span>
                          </span>
                        ))}
                      </div>
                    )}
                  </div>

                  {/* Travel Schedule timings */}
                  <div className="flex justify-between md:col-span-2 items-center text-center">
                    <div className="text-left">
                      <div className="font-black text-base text-slate-800 dark:text-slate-100">
                        {new Date(trip.departure_time).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                      </div>
                      <div className="text-slate-400 text-[10px] uppercase font-bold tracking-wider mt-0.5">Departure</div>
                    </div>
                    <div className="flex flex-col items-center">
                      <span className="text-xs text-slate-400 font-medium">Duration</span>
                      <div className="h-0.5 bg-slate-200 dark:bg-slate-850 w-24 relative my-1.5">
                        <div className="absolute top-1/2 left-1/2 transform -translate-x-1/2 -translate-y-1/2 w-2 h-2 rounded-full bg-brand-500"></div>
                      </div>
                      <span className="text-[10px] font-bold text-slate-500">{formatDuration(trip.departure_time, trip.arrival_time)}</span>
                    </div>
                    <div className="text-left">
                      <div className="font-black text-base text-slate-800 dark:text-slate-100">
                        {new Date(trip.arrival_time).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                      </div>
                      <div className="text-slate-400 text-[10px] uppercase font-bold tracking-wider mt-0.5">Arrival</div>
                    </div>
                  </div>

                  {/* Pricing and Action */}
                  <div className="text-right flex flex-col items-end justify-center">
                    <div className="text-2xl font-black text-slate-850 dark:text-slate-50 flex items-baseline gap-1">
                      <span className="text-xs font-bold text-slate-400">₹</span>
                      <span>{trip.price}</span>
                    </div>
                    <span className="text-[10px] font-black text-emerald-500 uppercase tracking-wider mt-1">
                      {trip.available_seats_count ?? 12} Seats Left
                    </span>
                    <button
                      type="button"
                      onClick={() => handleSelectTrip(trip)}
                      className="mt-3 bg-brand-500 hover:bg-brand-600 active:scale-95 text-white font-extrabold px-5 py-2 rounded-xl text-xs transition-all shadow-md shadow-brand-500/10 cursor-pointer"
                    >
                      {selectedTrip?.id === trip.id ? 'Viewing Seats' : 'Select Seats'}
                    </button>
                  </div>
                </div>

                {/* Cancellation Policy */}
                {cancellationPolicy && (
                  <div className="px-6 pb-4 -mt-2 flex items-center gap-1.5 text-[10px] text-slate-400 dark:text-slate-500">
                    <ShieldCheck size={12} className="text-slate-350 dark:text-slate-600" />
                    <span>Cancellation: {cancellationPolicy.description || `${cancellationPolicy.charge_percentage}% charge if cancelled within ${cancellationPolicy.hours_before_departure} hrs of departure`}</span>
                  </div>
                )}

                {/* Seat Selector Grid Section */}
                {selectedTrip?.id === trip.id && (
                  <div className="bg-slate-50 dark:bg-slate-950 p-6 border-t border-slate-200/50 dark:border-slate-900/50 transition-all duration-300">
                    
                    {/* Active Hold Countdown — visible while this user still holds a lock on this trip */}
                    {ownLockSecondsLeft !== null && (
                      <div className="bg-amber-50 dark:bg-amber-950/20 border border-amber-200/30 p-3 rounded-xl flex items-center justify-between mb-6">
                        <span className="text-amber-800 dark:text-amber-400 text-xs font-bold flex items-center gap-2">
                          <Clock size={14} className="animate-pulse" />
                          You're holding {ownLockedSeats.length} seat{ownLockedSeats.length > 1 ? 's' : ''} ({ownLockedSeats.map(s => s.seat_number).join(', ')}). Time remaining:
                        </span>
                        <span className="text-amber-800 dark:text-amber-400 text-sm font-black bg-white dark:bg-slate-950 px-3 py-1 rounded-lg border border-amber-200 dark:border-amber-900">
                          {formatTime(ownLockSecondsLeft)}
                        </span>
                      </div>
                    )}

                    {/* Seat Categories Color Legend Keys */}
                    <div className="flex flex-wrap items-center gap-4 mb-6 text-[10px] font-bold text-slate-400 uppercase tracking-wider">
                      <div className="flex items-center gap-1"><span className="w-3.5 h-3.5 bg-emerald-500 rounded"></span> Available</div>
                      <div className="flex items-center gap-1"><span className="w-3.5 h-3.5 bg-blue-500 rounded"></span> Premium</div>
                      <div className="flex items-center gap-1"><span className="w-3.5 h-3.5 bg-pink-400 rounded"></span> Ladies</div>
                      <div className="flex items-center gap-1"><span className="w-3.5 h-3.5 bg-slate-400 rounded"></span> Blocked</div>
                      <div className="flex items-center gap-1"><span className="w-3.5 h-3.5 bg-amber-400 rounded"></span> Locked</div>
                      <div className="flex items-center gap-1"><span className="w-3.5 h-3.5 bg-teal-500 rounded"></span> Your Hold</div>
                      <div className="flex items-center gap-1"><span className="w-3.5 h-3.5 bg-orange-600 rounded"></span> Maintenance</div>
                      <div className="flex items-center gap-1"><span className="w-3.5 h-3.5 bg-slate-350 rounded"></span> Unavailable</div>
                      <div className="flex items-center gap-1"><span className="w-3.5 h-3.5 bg-indigo-600 rounded"></span> Reserved</div>
                      <div className="flex items-center gap-1"><span className="w-3.5 h-3.5 bg-emerald-700 rounded"></span> Selected</div>
                      <div className="flex items-center gap-1"><span className="w-3.5 h-3.5 bg-rose-600 rounded"></span> Booked</div>
                    </div>

                    {/* Lower vs Upper Deck Layout Switchers */}
                    {(() => {
                      const lowerSeats = seatLayout.filter(s => (s.deck || 'lower') === 'lower');
                      const upperSeats = seatLayout.filter(s => s.deck === 'upper');
                      const hasUpperDeck = upperSeats.length > 0;
                      const seatsToRender = hasUpperDeck
                        ? (activeDeck === 'upper' ? upperSeats : lowerSeats)
                        : seatLayout;

                      return (
                        <>
                          {hasUpperDeck && (
                            <div className="flex space-x-2 mb-6">
                              <button
                                type="button"
                                onClick={() => setActiveDeck('lower')}
                                className={`px-4 py-1.5 rounded-xl text-xs font-bold transition-all border ${
                                  activeDeck === 'lower'
                                    ? 'bg-brand-500 text-white border-brand-500 shadow-md shadow-brand-500/10'
                                    : 'bg-white dark:bg-slate-900 text-slate-600 dark:text-slate-400 border-slate-200 dark:border-slate-800'
                                }`}
                              >
                                Lower Deck Layout
                              </button>
                              <button
                                type="button"
                                onClick={() => setActiveDeck('upper')}
                                className={`px-4 py-1.5 rounded-xl text-xs font-bold transition-all border ${
                                  activeDeck === 'upper'
                                    ? 'bg-brand-500 text-white border-brand-500 shadow-md shadow-brand-500/10'
                                    : 'bg-white dark:bg-slate-900 text-slate-600 dark:text-slate-400 border-slate-200 dark:border-slate-800'
                                }`}
                              >
                                Upper Deck Layout
                              </button>
                            </div>
                          )}

                          <div className="grid grid-cols-5 sm:grid-cols-6 md:grid-cols-8 gap-3 max-w-xl bg-white dark:bg-slate-900 p-6 rounded-2xl shadow-inner border border-slate-200/30 dark:border-slate-800/30">
                            {seatsToRender.map((seat) => {
                              const isSelected = selectedSeats.find(s => s.id === seat.id);
                              const isBooked = seat.status === 'booked';
                              const isLocked = seat.status === 'locked';
                              const isOwnLock = isLocked && seat.held_by === profileId;
                              const isBlocked = seat.status === 'blocked' || seat.is_blocked;
                              const isMaintenance = seat.status === 'maintenance';
                              const isUnavailable = seat.status === 'unavailable';
                              const isReserved = seat.status === 'reserved';

                              let colorClass = 'bg-emerald-500 hover:bg-emerald-600 text-white';
                              if (isSelected) {
                                colorClass = 'bg-emerald-700 hover:bg-emerald-800 text-white scale-105 shadow-md shadow-emerald-700/20';
                              } else if (isBooked) {
                                colorClass = 'bg-rose-600 text-white cursor-not-allowed';
                              } else if (isOwnLock) {
                                colorClass = 'bg-teal-500 text-white cursor-not-allowed ring-2 ring-teal-300';
                              } else if (isLocked) {
                                colorClass = 'bg-amber-400 text-slate-950 cursor-not-allowed';
                              } else if (isBlocked) {
                                colorClass = 'bg-slate-400 text-slate-200 cursor-not-allowed';
                              } else if (isMaintenance) {
                                colorClass = 'bg-orange-600 text-white cursor-not-allowed';
                              } else if (isUnavailable) {
                                colorClass = 'bg-slate-350 text-slate-500 cursor-not-allowed';
                              } else if (isReserved) {
                                colorClass = 'bg-indigo-600 text-white cursor-not-allowed';
                              } else if (seat.is_ladies || seat.category === 'ladies') {
                                colorClass = 'bg-pink-400 hover:bg-pink-500 text-white';
                              } else if (['vip', 'premium', 'luxury'].includes((seat.category || 'normal').toLowerCase())) {
                                colorClass = 'bg-blue-500 hover:bg-blue-600 text-white';
                              }

                              return (
                                <button
                                  key={seat.id}
                                  type="button"
                                  disabled={isBooked || isLocked || isBlocked || isMaintenance || isUnavailable || isReserved}
                                  onClick={() => handleSeatClick(seat)}
                                  className={`p-2.5 rounded-xl font-bold text-[10px] flex flex-col items-center justify-center transition-all duration-200 active:scale-95 ${colorClass}`}
                                >
                                  <span className="text-sm mb-0.5">💺</span>
                                  <span>{seat.seat_number}</span>
                                  {isOwnLock ? (
                                    <span className="text-[6px] tracking-tight uppercase font-black opacity-80 mt-0.5">Your Hold</span>
                                  ) : seat.category !== 'normal' && (
                                    <span className="text-[6px] tracking-tight uppercase font-black opacity-80 mt-0.5">{seat.category}</span>
                                  )}
                                </button>
                              );
                            })}
                          </div>
                        </>
                      );
                    })()}

                    {/* Booking Confirmation Action Footer */}
                    {selectedSeats.length > 0 && (
                      <div className="mt-6 flex justify-between items-center bg-white dark:bg-slate-900 p-4 rounded-xl border border-slate-200/40 dark:border-slate-800/40">
                        <div>
                          <div className="text-slate-400 text-xs font-bold">Selected Seats</div>
                          <div className="font-extrabold text-slate-850 dark:text-slate-100 mt-1">
                            {selectedSeats.map(s => s.seat_number).join(', ')}
                          </div>
                        </div>
                        <button
                          type="button"
                          onClick={handleLockSeats}
                          className="bg-emerald-500 hover:bg-emerald-600 text-white font-bold px-6 py-2.5 rounded-xl text-xs flex items-center space-x-2 shadow-md shadow-emerald-500/10 active:scale-95 transition-all cursor-pointer"
                        >
                          <span>Confirm & Book</span>
                          <ArrowRight size={14} />
                        </button>
                      </div>
                    )}
                  </div>
                )}
              </div>
            ))
          )}

          {/* Simple Pagination Buttons */}
          {trips.length > 0 && (
            <div className="flex justify-center items-center space-x-4 pt-6">
              <button
                type="button"
                disabled={page === 1}
                onClick={() => setPage(prev => Math.max(prev - 1, 1))}
                className="px-4 py-2 rounded-xl text-xs font-extrabold border bg-white dark:bg-slate-900 border-slate-200 dark:border-slate-800 text-slate-600 dark:text-slate-400 disabled:opacity-50 disabled:cursor-not-allowed hover:bg-slate-50 dark:hover:bg-slate-800/50 transition-all cursor-pointer"
              >
                Previous Page
              </button>
              <span className="text-xs font-black text-slate-500">
                Page {page}
              </span>
              <button
                type="button"
                disabled={trips.length < limit}
                onClick={() => setPage(prev => prev + 1)}
                className="px-4 py-2 rounded-xl text-xs font-extrabold border bg-white dark:bg-slate-900 border-slate-200 dark:border-slate-800 text-slate-600 dark:text-slate-400 disabled:opacity-50 disabled:cursor-not-allowed hover:bg-slate-50 dark:hover:bg-slate-800/50 transition-all cursor-pointer"
              >
                Next Page
              </button>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}

import React, { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { Search, MapPin, Calendar, CheckCircle, ShieldCheck, Tag, Award, History, X, Repeat, Users } from 'lucide-react';
import api, { mockData } from '../services/api';
import CustomDatePicker from '../components/CustomDatePicker';

export default function Landing({ lang }) {
  const navigate = useNavigate();
  const t = lang.t;
  const [cities, setCities] = useState(mockData.cities);
  
  const [fromCity, setFromCity] = useState('');
  const [fromQuery, setFromQuery] = useState('');
  const [showFromList, setShowFromList] = useState(false);
  
  const [toCity, setToCity] = useState('');
  const [toQuery, setToQuery] = useState('');
  const [showToList, setShowToList] = useState(false);
  
  const [journeyDate, setJourneyDate] = useState(new Date().toISOString().split('T')[0]);
  const [recentSearches, setRecentSearches] = useState([]);

  const [tripType, setTripType] = useState('one_way');
  const [returnDate, setReturnDate] = useState('');
  const [passengerCount, setPassengerCount] = useState(1);

  useEffect(() => {
    // Fetch cities from master service
    api.get('/master/cities')
      .then(res => {
        if (res.data && res.data.length > 0) setCities(res.data);
      })
      .catch(() => {});

    // Load recent searches from localStorage
    const saved = localStorage.getItem('recent_searches');
    if (saved) {
      try {
        setRecentSearches(JSON.parse(saved));
      } catch (e) {}
    }
  }, []);

  const handleSearch = (e) => {
    if (e) e.preventDefault();
    if (!fromCity || !toCity) {
      alert(t('alerts.selectBothCities'));
      return;
    }
    if (fromCity === toCity) {
      alert(t('alerts.sameCity'));
      return;
    }
    if (tripType === 'round_trip') {
      if (!returnDate) {
        alert(t('alerts.selectReturnDate'));
        return;
      }
      if (returnDate < journeyDate) {
        alert(t('alerts.returnBeforeJourney'));
        return;
      }
    }

    const fromObj = cities.find(c => c.id === fromCity);
    const toObj = cities.find(c => c.id === toCity);

    // Save search to recent searches list
    if (fromObj && toObj) {
      const searchItem = {
        fromId: fromCity,
        toId: toCity,
        fromName: fromObj.name,
        toName: toObj.name,
        date: journeyDate
      };
      const updated = [searchItem, ...recentSearches.filter(s => s.fromId !== fromCity || s.toId !== toCity)].slice(0, 3);
      setRecentSearches(updated);
      localStorage.setItem('recent_searches', JSON.stringify(updated));
    }

    let url = `/search?from=${fromCity}&to=${toCity}&date=${journeyDate}&passengers=${passengerCount}&tripType=${tripType}`;
    if (tripType === 'round_trip') url += `&returnDate=${returnDate}`;
    navigate(url);
  };

  // Switches between one-way and round-trip modes, clearing the return date when going back to one-way
  const handleTripTypeChange = (type) => {
    setTripType(type);
    if (type === 'one_way') setReturnDate('');
  };

  // Keeps the passenger count within a sensible 1-9 range
  const adjustPassengerCount = (delta) => {
    setPassengerCount((prev) => Math.min(9, Math.max(1, prev + delta)));
  };

  const handleSwapCities = () => {
    const tempId = fromCity;
    const tempQuery = fromQuery;

    setFromCity(toCity);
    setFromQuery(toQuery);

    setToCity(tempId);
    setToQuery(tempQuery);
  };

  const handleRouteSearch = (from, to) => {
    const fromObj = cities.find(c => c.name.toLowerCase() === from.toLowerCase());
    const toObj = cities.find(c => c.name.toLowerCase() === to.toLowerCase());
    if (fromObj && toObj) {
      navigate(`/search?from=${fromObj.id}&to=${toObj.id}&date=${journeyDate}`);
    }
  };

  const handleRecentClick = (search) => {
    setFromCity(search.fromId);
    setFromQuery(search.fromName);
    setToCity(search.toId);
    setToQuery(search.toName);
    setJourneyDate(search.date);
    navigate(`/search?from=${search.fromId}&to=${search.toId}&date=${search.date}`);
  };

  const clearRecentSearches = () => {
    setRecentSearches([]);
    localStorage.removeItem('recent_searches');
  };

  // Filter city suggestions. Focusing the field lists every city; typing narrows it.
  // The full list also stays up while the box still holds the already-picked city
  // name, so reopening it lets you switch cities without clearing the text first.
  const cityMatches = (query, selectedId, excludeId) => {
    const selected = cities.find(c => c.id === selectedId);
    const showAll = !query.trim() || (selected && query === selected.name);
    const q = query.toLowerCase();
    return cities.filter(c =>
      c.id !== excludeId &&
      (showAll || c.name.toLowerCase().includes(q) || c.code.toLowerCase().includes(q))
    );
  };

  const fromMatches = cityMatches(fromQuery, fromCity, toCity);
  const toMatches = cityMatches(toQuery, toCity, fromCity);

  return (
    <div className="min-h-screen bg-slate-50 dark:bg-slate-950 transition-colors duration-300">
      {/* Hero Section */}
      <div className="relative bg-gradient-to-br from-brand-600 to-indigo-800 dark:from-slate-900 dark:to-slate-950 py-20 text-white">
        <div className="absolute inset-0 bg-grid-pattern opacity-10"></div>
        <div className="max-w-5xl mx-auto px-4 text-center relative">
          <span className="bg-white/10 text-white border border-white/20 px-3 py-1 rounded-full text-xs font-semibold uppercase tracking-wider">
            {t('landing.badge')}
          </span>
          <h1 className="text-4xl md:text-5xl font-extrabold mt-6 tracking-tight leading-tight">
            {t('landing.heroTitle1')} <br/>
            <span className="bg-gradient-to-r from-blue-200 to-emerald-200 bg-clip-text text-transparent">
              {t('landing.heroTitle2')}
            </span>
          </h1>
          <p className="text-slate-200 mt-4 text-lg max-w-xl mx-auto">
            {t('landing.heroSubtitle')}
          </p>

          {/* Search Box */}
          <div className="relative mt-12 max-w-4xl mx-auto z-20">
            <form onSubmit={handleSearch} className="relative z-20 glass-card p-6 rounded-2xl shadow-xl text-slate-800 dark:text-slate-100 grid grid-cols-1 md:grid-cols-12 gap-4 items-center">
              
              {/* From City Autocomplete */}
              <div className="relative flex flex-col text-left md:col-span-4">
                <label className="text-xs font-bold uppercase text-slate-400 mb-1 flex items-center gap-1">
                  <MapPin size={12} className="text-brand-500" /> {t('landing.sourceCity')}
                </label>
                <input
                  type="text"
                  placeholder={t('landing.typeCity')}
                  value={fromQuery}
                  onFocus={() => setShowFromList(true)}
                  onChange={(e) => {
                    setFromQuery(e.target.value);
                    const match = cities.find(c => c.name.toLowerCase() === e.target.value.toLowerCase());
                    if (match) {
                      if (match.id === toCity) {
                        alert(t('alerts.sameCity'));
                        setFromQuery('');
                        setFromCity('');
                      } else {
                        setFromCity(match.id);
                      }
                    }
                  }}
                  className="w-full bg-slate-100 dark:bg-slate-900 border border-slate-300/40 dark:border-slate-800/40 px-3 py-2 rounded-xl font-medium focus:ring-2 focus:ring-brand-500 text-sm outline-none transition-all"
                />
                {showFromList && fromMatches.length > 0 && (
                  <div className="absolute left-0 right-0 top-full mt-2 bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-850 rounded-xl shadow-xl max-h-48 overflow-y-auto z-30">
                    {fromMatches.map((city) => (
                      <button
                        key={city.id}
                        type="button"
                        onClick={() => {
                          setFromCity(city.id);
                          setFromQuery(city.name);
                          setShowFromList(false);
                        }}
                        className="w-full px-4 py-2 text-left hover:bg-slate-100 dark:hover:bg-slate-800/50 text-sm font-semibold flex justify-between items-center"
                      >
                        <span>{city.name}</span>
                        <span className="text-xs text-slate-400">{city.code}</span>
                      </button>
                    ))}
                  </div>
                )}
              </div>

              {/* Swap Button */}
              <div className="flex justify-center md:col-span-1">
                <button
                  type="button"
                  onClick={handleSwapCities}
                  className="bg-white dark:bg-slate-900 text-brand-500 border border-slate-200 dark:border-slate-800 p-2.5 rounded-full shadow-lg hover:scale-110 active:rotate-180 transition-all duration-300 cursor-pointer"
                  title={t('landing.swapCities')}
                >
                  ↔
                </button>
              </div>

              {/* To City Autocomplete */}
              <div className="relative flex flex-col text-left md:col-span-4">
                <label className="text-xs font-bold uppercase text-slate-400 mb-1 flex items-center gap-1">
                  <MapPin size={12} className="text-brand-500" /> {t('landing.destinationCity')}
                </label>
                <input
                  type="text"
                  placeholder={t('landing.typeCity')}
                  value={toQuery}
                  onFocus={() => setShowToList(true)}
                  onChange={(e) => {
                    setToQuery(e.target.value);
                    const match = cities.find(c => c.name.toLowerCase() === e.target.value.toLowerCase());
                    if (match) {
                      if (match.id === fromCity) {
                        alert(t('alerts.sameCity'));
                        setToQuery('');
                        setToCity('');
                      } else {
                        setToCity(match.id);
                      }
                    }
                  }}
                  className="w-full bg-slate-100 dark:bg-slate-900 border border-slate-300/40 dark:border-slate-800/40 px-3 py-2 rounded-xl font-medium focus:ring-2 focus:ring-brand-500 text-sm outline-none transition-all"
                />
                {showToList && toMatches.length > 0 && (
                  <div className="absolute left-0 right-0 top-full mt-2 bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-850 rounded-xl shadow-xl max-h-48 overflow-y-auto z-30">
                    {toMatches.map((city) => (
                      <button
                        key={city.id}
                        type="button"
                        onClick={() => {
                          setToCity(city.id);
                          setToQuery(city.name);
                          setShowToList(false);
                        }}
                        className="w-full px-4 py-2 text-left hover:bg-slate-100 dark:hover:bg-slate-800/50 text-sm font-semibold flex justify-between items-center"
                      >
                        <span>{city.name}</span>
                        <span className="text-xs text-slate-400">{city.code}</span>
                      </button>
                    ))}
                  </div>
                )}
              </div>

              {/* Journey Date */}
              <div className="relative flex flex-col text-left md:col-span-3">
                <label className="text-xs font-bold uppercase text-slate-400 mb-1 flex items-center gap-1">
                  <Calendar size={12} className="text-brand-500" /> {t('landing.date')}
                </label>
                <CustomDatePicker
                  selectedDate={journeyDate}
                  minDate={new Date().toISOString().split('T')[0]}
                  onChange={(dateStr) => setJourneyDate(dateStr)}
                />
              </div>

              {/* Trip Type Toggle */}
              <div className="flex flex-col text-left md:col-span-4">
                <label className="text-xs font-bold uppercase text-slate-400 mb-1 flex items-center gap-1">
                  <Repeat size={12} className="text-brand-500" /> {t('landing.tripType')}
                </label>
                <div className="flex bg-slate-100 dark:bg-slate-900 border border-slate-300/40 dark:border-slate-800/40 rounded-xl p-1">
                  <button
                    type="button"
                    onClick={() => handleTripTypeChange('one_way')}
                    className={`flex-1 py-1.5 rounded-lg text-xs font-bold transition-all cursor-pointer ${tripType === 'one_way' ? 'bg-brand-500 text-white shadow' : 'text-slate-500 dark:text-slate-400'}`}
                  >
                    {t('landing.oneWay')}
                  </button>
                  <button
                    type="button"
                    onClick={() => handleTripTypeChange('round_trip')}
                    className={`flex-1 py-1.5 rounded-lg text-xs font-bold transition-all cursor-pointer ${tripType === 'round_trip' ? 'bg-brand-500 text-white shadow' : 'text-slate-500 dark:text-slate-400'}`}
                  >
                    {t('landing.roundTrip')}
                  </button>
                </div>
              </div>

              {/* Return Date (round trip only) */}
              <div className="relative flex flex-col text-left md:col-span-4">
                <label className="text-xs font-bold uppercase text-slate-400 mb-1 flex items-center gap-1">
                  <Calendar size={12} className="text-brand-500" /> {t('landing.returnDate')}
                </label>
                {tripType === 'round_trip' ? (
                  <CustomDatePicker
                    selectedDate={returnDate}
                    minDate={journeyDate}
                    onChange={(dateStr) => setReturnDate(dateStr)}
                  />
                ) : (
                  <div className="w-full bg-slate-100/50 dark:bg-slate-900/50 border border-dashed border-slate-300/40 dark:border-slate-800/40 px-3 py-2 rounded-xl text-xs text-slate-400 flex items-center h-[38px]">
                    {t('landing.oneWayTripLabel')}
                  </div>
                )}
              </div>

              {/* Passenger Count Stepper */}
              <div className="flex flex-col text-left md:col-span-4">
                <label className="text-xs font-bold uppercase text-slate-400 mb-1 flex items-center gap-1">
                  <Users size={12} className="text-brand-500" /> {t('landing.passengers')}
                </label>
                <div className="flex items-center justify-between bg-slate-100 dark:bg-slate-900 border border-slate-300/40 dark:border-slate-800/40 rounded-xl px-2 py-1.5 h-[38px]">
                  <button
                    type="button"
                    onClick={() => adjustPassengerCount(-1)}
                    disabled={passengerCount <= 1}
                    className="w-7 h-7 rounded-lg bg-white dark:bg-slate-800 text-slate-600 dark:text-slate-300 font-bold hover:bg-slate-50 dark:hover:bg-slate-700 transition-all cursor-pointer disabled:opacity-40 disabled:cursor-not-allowed"
                  >
                    −
                  </button>
                  <span className="text-sm font-extrabold">{passengerCount} {passengerCount === 1 ? t('landing.passenger') : t('landing.passengers')}</span>
                  <button
                    type="button"
                    onClick={() => adjustPassengerCount(1)}
                    disabled={passengerCount >= 9}
                    className="w-7 h-7 rounded-lg bg-white dark:bg-slate-800 text-slate-600 dark:text-slate-300 font-bold hover:bg-slate-50 dark:hover:bg-slate-700 transition-all cursor-pointer disabled:opacity-40 disabled:cursor-not-allowed"
                  >
                    +
                  </button>
                </div>
              </div>

              {/* Search Button */}
              <div className="md:col-span-12 mt-2">
                <button
                  type="submit"
                  className="w-full bg-gradient-to-r from-brand-500 to-indigo-600 hover:from-brand-600 hover:to-indigo-700 text-white font-bold py-3 rounded-xl flex items-center justify-center space-x-2 transition-all shadow-md shadow-brand-500/20 active:scale-95 cursor-pointer"
                >
                  <Search size={18} />
                  <span>{t('landing.searchBuses')}</span>
                </button>
              </div>
            </form>

            {/* Click Outside Helpers */}
            {(showFromList || showToList) && (
              <div
                className="fixed inset-0 z-10"
                onClick={() => {
                  setShowFromList(false);
                  setShowToList(false);
                }}
              />
            )}

            {/* Recent Searches */}
            {recentSearches.length > 0 && (
              <div className="mt-4 flex flex-wrap items-center justify-center gap-3 text-slate-200 text-xs font-bold">
                <span className="flex items-center gap-1 text-white opacity-85">
                  <History size={12} /> {t('landing.recent')}
                </span>
                {recentSearches.map((search, i) => (
                  <button
                    key={i}
                    type="button"
                    onClick={() => handleRecentClick(search)}
                    className="bg-white/10 border border-white/20 hover:bg-white/20 px-3 py-1 rounded-full flex items-center gap-1.5 transition-all cursor-pointer"
                  >
                    <span>{search.fromName} → {search.toName}</span>
                    <span className="text-[10px] text-white/60">({search.date})</span>
                  </button>
                ))}
                <button
                  type="button"
                  onClick={clearRecentSearches}
                  className="text-white/60 hover:text-white flex items-center gap-0.5 cursor-pointer"
                  title="Clear All Searches"
                >
                  <X size={12} /> {t('landing.clear')}
                </button>
              </div>
            )}
          </div>
        </div>
      </div>

      {/* Promos & Discounts */}
      <div className="max-w-5xl mx-auto px-4 py-16">
        <div className="flex items-center justify-between mb-8">
          <h2 className="text-2xl font-bold tracking-tight text-slate-800 dark:text-slate-100">
            {t('landing.offersCoupons')}
          </h2>
          <span className="text-brand-500 font-semibold text-sm hover:underline cursor-pointer">
            {t('landing.viewAll')}
          </span>
        </div>
        <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
          <div className="glass-card border border-blue-100 dark:border-blue-950/60 p-6 rounded-2xl flex items-start space-x-4 shadow-sm hover:shadow-md transition-shadow text-left">
            <div className="bg-blue-50 dark:bg-blue-950/30 p-3 rounded-xl text-blue-500">
              <Tag size={24} />
            </div>
            <div>
              <h3 className="font-bold text-lg text-slate-800 dark:text-slate-100">{t('landing.offer1Title')}</h3>
              <p className="text-slate-500 dark:text-slate-400 text-sm mt-1">
                {t('landing.useCode')} <span className="font-bold text-blue-600 dark:text-blue-400 bg-blue-50 dark:bg-blue-950/40 px-2 py-0.5 rounded">FIRST50</span>. {t('landing.validAbove200')}
              </p>
            </div>
          </div>

          <div className="glass-card border border-amber-100 dark:border-amber-950 p-6 rounded-2xl flex items-start space-x-4 shadow-sm hover:shadow-md transition-shadow text-left">
            <div className="bg-amber-50 dark:bg-amber-950/30 p-3 rounded-xl text-amber-500">
              <Award size={24} />
            </div>
            <div>
              <h3 className="font-bold text-lg text-slate-800 dark:text-slate-100">{t('landing.offer2Title')}</h3>
              <p className="text-slate-500 dark:text-slate-400 text-sm mt-1">
                {t('landing.useCode')} <span className="font-bold text-amber-600 dark:text-amber-400 bg-amber-50 dark:bg-amber-950/40 px-2 py-0.5 rounded">NEWBUS10</span>. {t('landing.validAbove500')}
              </p>
            </div>
          </div>
        </div>
      </div>

      {/* Popular Routes */}
      <div className="max-w-5xl mx-auto px-4 pb-24">
        <h2 className="text-2xl font-bold tracking-tight text-slate-800 dark:text-slate-100 mb-8">
          {t('landing.popularRoutes')}
        </h2>
        <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 gap-6">
          {[
            { from: 'Mumbai', to: 'Pune', desc: t('landing.routeDesc1') },
            { from: 'Bangalore', to: 'Hyderabad', desc: t('landing.routeDesc2') },
            { from: 'Bangalore', to: 'Chennai', desc: t('landing.routeDesc3') }
          ].map((route, i) => (
            <div
              key={i}
              onClick={() => handleRouteSearch(route.from, route.to)}
              className="bg-white dark:bg-slate-900 border border-slate-200/60 dark:border-slate-800/60 p-5 rounded-2xl shadow-sm hover:shadow-lg cursor-pointer transition-all duration-300 hover:-translate-y-1.5 hover:border-brand-500/40 dark:hover:border-brand-500/40 text-left group"
            >
              <div className="flex justify-between items-center">
                <span className="font-extrabold text-slate-800 dark:text-slate-100 group-hover:text-brand-500 transition-colors">
                  {route.from} ➔ {route.to}
                </span>
                <span className="text-brand-500 text-xs font-bold bg-brand-50 dark:bg-brand-950/30 px-2.5 py-1 rounded-lg opacity-0 group-hover:opacity-100 transition-all duration-300 transform translate-x-2 group-hover:translate-x-0">
                  {t('landing.bookNow')}
                </span>
              </div>
              <p className="text-slate-400 text-xs mt-2 group-hover:text-slate-500 dark:hover:text-slate-350 transition-colors">{route.desc}</p>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}

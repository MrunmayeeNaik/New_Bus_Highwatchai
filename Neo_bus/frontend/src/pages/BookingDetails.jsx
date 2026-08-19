import React, { useState } from 'react';
import { useLocation, useNavigate } from 'react-router-dom';
import { User, Phone, Mail, Percent, ArrowRight, Clock, MapPin, CreditCard, Shield } from 'lucide-react';
import api, { releaseSeatLocksOnUnload } from '../services/api';

export default function BookingDetails() {
  const location = useLocation();
  const navigate = useNavigate();
  const { trip, seats } = location.state || { trip: null, seats: [] };

  const [passengers, setPassengers] = useState(
    seats.map(s => ({
      seat_id: s.id,
      seat_number: s.seat_number,
      passenger_name: '',
      passenger_age: '',
      passenger_gender: 'male',
      mobile: '',
      email: '',
      id_proof: '',
      emergency_contact: ''
    }))
  );

  const [email, setEmail] = useState('');
  const [phone, setPhone] = useState('');
  const [couponCode, setCouponCode] = useState('');
  const [discount, setDiscount] = useState(0);
  const [couponApplied, setCouponApplied] = useState(false);
  const [useWallet, setUseWallet] = useState(false);
  const [walletBalance, setWalletBalance] = useState(0);

  const [tripPoints, setTripPoints] = useState([]);
  const [boardingPointId, setBoardingPointId] = useState('');
  const [droppingPointId, setDroppingPointId] = useState('');
  const [savedCompanions, setSavedCompanions] = useState([]);
  const [timeLeft, setTimeLeft] = useState(600); // 10 minutes hold

  React.useEffect(() => {
    if (!trip || !seats.length) return;
    const timer = setInterval(() => {
      setTimeLeft(prev => {
        if (prev <= 1) {
          clearInterval(timer);
          alert('Seat hold has expired. Please select and lock seats again.');
          api.post('/bookings/seats/unlock', {
            trip_id: trip.id,
            seat_ids: seats.map(s => s.id)
          }).catch(() => {});
          navigate('/');
          return 0;
        }
        return prev - 1;
      });
    }, 1000);
    return () => clearInterval(timer);
  }, [trip, seats, navigate]);

  // Release the seat hold immediately if the user closes the tab/browser or navigates
  // away to a different site mid-checkout, instead of leaving the seats locked until
  // the 10-minute TTL expires on its own.
  React.useEffect(() => {
    if (!trip || !seats.length) return;
    const seatIds = seats.map(s => s.id);
    const handleUnload = () => releaseSeatLocksOnUnload(trip.id, seatIds);
    window.addEventListener('beforeunload', handleUnload);
    window.addEventListener('pagehide', handleUnload);
    return () => {
      window.removeEventListener('beforeunload', handleUnload);
      window.removeEventListener('pagehide', handleUnload);
    };
  }, [trip, seats]);

  React.useEffect(() => {
    if (trip?.id) {
      // Fetch trip boarding/dropping points
      api.get(`/bookings/trips/${trip.id}/points`)
        .then(res => {
          setTripPoints(res.data);
          const boardings = res.data.filter(p => p.point_type === 'boarding');
          const droppings = res.data.filter(p => p.point_type === 'dropping');
          if (boardings.length > 0) setBoardingPointId(boardings[0].id);
          if (droppings.length > 0) setDroppingPointId(droppings[0].id);
        })
        .catch(() => {});
    }
  }, [trip]);

  React.useEffect(() => {
    if (sessionStorage.getItem('access_token')) {
      api.get('/passenger/saved-passengers')
        .then(res => setSavedCompanions(res.data))
        .catch(() => {});

      api.get('/auth/me')
        .then(res => {
          if (res.data.wallet) {
            setWalletBalance(res.data.wallet.balance);
          }
          if (res.data.email) setEmail(res.data.email);
          if (res.data.phone) setPhone(res.data.phone);
        })
        .catch(() => {});
    }
  }, []);

  if (!trip || seats.length === 0) {
    return <div className="text-center py-12">No booking data found. Go back and select seats.</div>;
  }

  const handlePassengerChange = (index, field, value) => {
    setPassengers(prev => {
      const copy = [...prev];
      copy[index][field] = value;
      return copy;
    });
  };

  const handleApplyCoupon = () => {
    if (!couponCode) return;
    
    // We compute total seats price (with surcharges) to apply coupon validation
    api.post('/bookings/', {
      trip_id: trip.id,
      passengers: passengers.map(p => ({
        seat_id: p.seat_id,
        passenger_name: p.passenger_name || 'Temp',
        passenger_age: parseInt(p.passenger_age) || 20,
        passenger_gender: p.passenger_gender,
        mobile: p.mobile || phone,
        email: p.email || email,
        id_proof: p.id_proof || 'Mock123',
        emergency_contact: p.emergency_contact || phone
      })),
      coupon_code: couponCode.toUpperCase(),
      use_wallet: false,
      boarding_point_id: boardingPointId || null,
      dropping_point_id: droppingPointId || null
    })
    .then(res => {
      // Mock validate check succeeded or coupon parsed
      alert('Coupon check succeeded!');
    })
    .catch(err => {
      // We parse the validation from the error response
      const errMsg = err.response?.data?.detail;
      if (errMsg && (errMsg.includes('coupon') || errMsg.includes('Coupon'))) {
        alert(`Coupon Error: ${errMsg}`);
        return;
      }
    });

    // Dynamic fetch or demo fallback
    api.get(`/bookings/coupon/${couponCode.toUpperCase()}`)
      .then(res => {
        const coupon = res.data;
        let disc = 0;
        if (totalSeatPrice >= coupon.min_booking_amount) {
          if (coupon.discount_type === 'percentage') {
            disc = (totalSeatPrice * coupon.discount_value) / 100;
            if (coupon.max_discount > 0) {
              disc = Math.min(disc, coupon.max_discount);
            }
          } else {
            disc = coupon.discount_value;
          }
          setDiscount(disc);
          setCouponApplied(true);
          alert(`Coupon ${couponCode.toUpperCase()} applied! ₹${disc} discount.`);
        } else {
          alert(`Minimum booking amount of ₹${coupon.min_booking_amount} required.`);
        }
      })
      .catch(() => {
        const code = couponCode.toUpperCase();
        if (code === 'WELCOME50' && totalSeatPrice >= 100) {
          setDiscount(50);
          setCouponApplied(true);
          alert('Coupon WELCOME50 applied! ₹50 discount.');
        } else if (code === 'NEWBUS10' && totalSeatPrice >= 500) {
          setDiscount(Math.min(totalSeatPrice * 0.1, 150));
          setCouponApplied(true);
          alert('Coupon NEWBUS10 applied! 10% discount.');
        } else {
          alert('Invalid or expired coupon code.');
        }
      });
  };

  const handleCheckout = (e) => {
    e.preventDefault();
    
    for (let i = 0; i < passengers.length; i++) {
      const p = passengers[i];
      if (!p.passenger_name || !p.passenger_age) {
        alert(`Please fill out details for Passenger ${i + 1}.`);
        return;
      }
    }
    if (!boardingPointId || !droppingPointId) {
      alert('Please select boarding and dropping stops.');
      return;
    }
    
    const payload = {
      trip_id: trip.id,
      passengers: passengers.map(p => ({
        seat_id: p.seat_id,
        passenger_name: p.passenger_name,
        passenger_age: parseInt(p.passenger_age),
        passenger_gender: p.passenger_gender,
        mobile: p.mobile || phone,
        email: p.email || email,
        id_proof: p.id_proof,
        emergency_contact: p.emergency_contact
      })),
      coupon_code: couponApplied ? couponCode.toUpperCase() : null,
      use_wallet: useWallet,
      boarding_point_id: boardingPointId,
      dropping_point_id: droppingPointId
    };

    api.post('/bookings/', payload)
      .then(res => {
        navigate('/payment', { state: { booking: res.data } });
      })
      .catch(err => {
        alert(err.response?.data?.detail || 'Booking failed.');
      });
  };

  // Pricing rules simulation
  const isWeekend = trip?.departure_time ? (new Date(trip.departure_time).getDay() === 0 || new Date(trip.departure_time).getDay() === 6) : false;
  const calculatedSeats = seats.map(s => {
    let seatPrice = trip.price;
    if (isWeekend) seatPrice *= 1.10;
    if (s.category === 'vip') seatPrice *= 1.15;
    return { ...s, price: seatPrice };
  });

  const baseFare = trip.price * seats.length;
  const totalSeatPrice = calculatedSeats.reduce((sum, s) => sum + s.price, 0);
  const markups = totalSeatPrice - baseFare;
  const serviceFee = 15.00;
  const finalDiscount = Math.min(discount, totalSeatPrice);
  const gst = (totalSeatPrice - finalDiscount) * 0.05;
  const finalTotal = totalSeatPrice - finalDiscount + gst + serviceFee;

  const formatTime = (seconds) => {
    const m = Math.floor(seconds / 60).toString().padStart(2, '0');
    const s = (seconds % 60).toString().padStart(2, '0');
    return `${m}:${s}`;
  };

  const selectedBoarding = tripPoints.find(p => p.id === boardingPointId);
  const selectedDropping = tripPoints.find(p => p.id === droppingPointId);

  return (
    <div className="max-w-6xl mx-auto px-4 py-8">
      <div className="bg-amber-50 dark:bg-amber-950/20 border border-amber-200/30 p-4 rounded-xl flex items-center justify-between mb-6">
        <span className="text-amber-800 dark:text-amber-400 text-sm font-bold flex items-center gap-2">
          <Clock size={16} className="animate-pulse" />
          Seats locked for 10 minutes. Time remaining:
        </span>
        <span className="text-amber-800 dark:text-amber-400 text-lg font-black bg-white dark:bg-slate-950 px-3 py-1 rounded-lg border border-amber-200 dark:border-amber-900">
          {formatTime(timeLeft)}
        </span>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
        {/* Form Inputs */}
        <form onSubmit={handleCheckout} className="lg:col-span-2 space-y-6">
          
          {/* Boarding Dropping Selection */}
          <div className="bg-white dark:bg-slate-900 border border-slate-200/50 dark:border-slate-800/50 p-6 rounded-2xl space-y-4 shadow-sm">
            <h3 className="font-bold text-slate-800 dark:text-slate-100 flex items-center gap-2">
              <MapPin size={18} className="text-brand-500" /> Select Boarding & Dropping Points
            </h3>
            
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-6">
              <div>
                <label className="text-xs font-bold text-slate-400 uppercase">Boarding Stop</label>
                <select
                  value={boardingPointId}
                  onChange={(e) => setBoardingPointId(e.target.value)}
                  className="w-full bg-slate-50 dark:bg-slate-950 border border-slate-200 dark:border-slate-800 px-3 py-2.5 rounded-xl text-sm outline-none mt-1 focus:ring-2 focus:ring-brand-500"
                >
                  <option value="" disabled>Select boarding point</option>
                  {tripPoints.filter(p => p.point_type === 'boarding').map(p => (
                    <option key={p.id} value={p.id}>
                      {p.point_name} ({new Date(p.time).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })})
                    </option>
                  ))}
                </select>
                {selectedBoarding && (
                  <div className="mt-2 text-xs text-slate-500 bg-slate-50 dark:bg-slate-950/40 p-2.5 rounded-lg border border-slate-100 dark:border-slate-800">
                    <p><strong>Landmark:</strong> {selectedBoarding.landmark || 'N/A'}</p>
                    <p><strong>Instructions:</strong> {selectedBoarding.pickup_instructions || 'N/A'}</p>
                    <p className="text-[10px] text-slate-400">GPS: {selectedBoarding.gps_coordinates || 'N/A'}</p>
                  </div>
                )}
              </div>

              <div>
                <label className="text-xs font-bold text-slate-400 uppercase">Dropping Stop</label>
                <select
                  value={droppingPointId}
                  onChange={(e) => setDroppingPointId(e.target.value)}
                  className="w-full bg-slate-50 dark:bg-slate-950 border border-slate-200 dark:border-slate-800 px-3 py-2.5 rounded-xl text-sm outline-none mt-1 focus:ring-2 focus:ring-brand-500"
                >
                  <option value="" disabled>Select dropping point</option>
                  {tripPoints.filter(p => p.point_type === 'dropping').map(p => (
                    <option key={p.id} value={p.id}>
                      {p.point_name} ({new Date(p.time).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })})
                    </option>
                  ))}
                </select>
                {selectedDropping && (
                  <div className="mt-2 text-xs text-slate-500 bg-slate-50 dark:bg-slate-950/40 p-2.5 rounded-lg border border-slate-100 dark:border-slate-800">
                    <p><strong>Landmark:</strong> {selectedDropping.landmark || 'N/A'}</p>
                    <p className="text-[10px] text-slate-400">GPS: {selectedDropping.gps_coordinates || 'N/A'}</p>
                  </div>
                )}
              </div>
            </div>
          </div>

          {/* Passenger Details */}
          <div className="bg-white dark:bg-slate-900 border border-slate-200/50 dark:border-slate-800/50 p-6 rounded-2xl space-y-6 shadow-sm">
            <h3 className="font-bold text-slate-800 dark:text-slate-100 flex items-center gap-2">
              <User size={18} className="text-brand-500" /> Passenger Details
            </h3>

            {passengers.map((p, idx) => (
              <div key={p.seat_id} className="p-4 bg-slate-50 dark:bg-slate-950/50 rounded-2xl space-y-4 border border-slate-200/30 dark:border-slate-800/30">
                <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-2">
                  <span className="font-bold text-sm text-slate-700 dark:text-slate-300">Passenger {idx + 1} (Seat {p.seat_number})</span>
                  {savedCompanions.length > 0 && (
                    <select
                      onChange={(e) => {
                        const comp = savedCompanions.find(c => c.id === e.target.value);
                        if (comp) {
                          handlePassengerChange(idx, 'passenger_name', comp.name);
                          handlePassengerChange(idx, 'passenger_age', comp.age.toString());
                          handlePassengerChange(idx, 'passenger_gender', comp.gender);
                          if (comp.mobile) handlePassengerChange(idx, 'mobile', comp.mobile);
                          if (comp.email) handlePassengerChange(idx, 'email', comp.email);
                          if (comp.id_proof) handlePassengerChange(idx, 'id_proof', comp.id_proof);
                        }
                      }}
                      className="text-xs bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-lg px-2 py-1 outline-none text-slate-500"
                      defaultValue=""
                    >
                      <option value="" disabled>Quick Fill Companion...</option>
                      {savedCompanions.map(c => (
                        <option key={c.id} value={c.id}>{c.name} ({c.age}, {c.gender})</option>
                      ))}
                    </select>
                  )}
                </div>

                <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
                  <div className="flex flex-col">
                    <label className="text-[10px] font-bold text-slate-400 mb-1">Full Name</label>
                    <input
                      type="text"
                      required
                      placeholder="e.g. John Doe"
                      value={p.passenger_name}
                      onChange={(e) => handlePassengerChange(idx, 'passenger_name', e.target.value)}
                      className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 px-3 py-2 rounded-xl text-sm outline-none focus:ring-2 focus:ring-brand-500"
                    />
                  </div>
                  <div className="flex flex-col">
                    <label className="text-[10px] font-bold text-slate-400 mb-1">Age</label>
                    <input
                      type="number"
                      required
                      placeholder="Age"
                      value={p.passenger_age}
                      onChange={(e) => handlePassengerChange(idx, 'passenger_age', e.target.value)}
                      className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 px-3 py-2 rounded-xl text-sm outline-none focus:ring-2 focus:ring-brand-500"
                    />
                  </div>
                  <div className="flex flex-col">
                    <label className="text-[10px] font-bold text-slate-400 mb-1">Gender</label>
                    <select
                      value={p.passenger_gender}
                      onChange={(e) => handlePassengerChange(idx, 'passenger_gender', e.target.value)}
                      className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 px-3 py-2 rounded-xl text-sm outline-none focus:ring-2 focus:ring-brand-500"
                    >
                      <option value="male">Male</option>
                      <option value="female">Female</option>
                      <option value="other">Other</option>
                    </select>
                  </div>
                </div>

                <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                  <div className="flex flex-col">
                    <label className="text-[10px] font-bold text-slate-400 mb-1">Mobile Number (Optional)</label>
                    <input
                      type="tel"
                      placeholder="e.g. +919999111222"
                      value={p.mobile}
                      onChange={(e) => handlePassengerChange(idx, 'mobile', e.target.value)}
                      className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 px-3 py-2 rounded-xl text-sm outline-none focus:ring-2 focus:ring-brand-500"
                    />
                  </div>
                  <div className="flex flex-col">
                    <label className="text-[10px] font-bold text-slate-400 mb-1">Email Address (Optional)</label>
                    <input
                      type="email"
                      placeholder="e.g. name@test.com"
                      value={p.email}
                      onChange={(e) => handlePassengerChange(idx, 'email', e.target.value)}
                      className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 px-3 py-2 rounded-xl text-sm outline-none focus:ring-2 focus:ring-brand-500"
                    />
                  </div>
                </div>

                <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                  <div className="flex flex-col">
                    <label className="text-[10px] font-bold text-slate-400 mb-1">Govt ID Proof (Aadhaar / Passport)</label>
                    <input
                      type="text"
                      required
                      placeholder="e.g. Aadhaar / DL No"
                      value={p.id_proof}
                      onChange={(e) => handlePassengerChange(idx, 'id_proof', e.target.value)}
                      className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 px-3 py-2 rounded-xl text-sm outline-none focus:ring-2 focus:ring-brand-500"
                    />
                  </div>
                  <div className="flex flex-col">
                    <label className="text-[10px] font-bold text-slate-400 mb-1">Emergency Contact Mobile</label>
                    <input
                      type="tel"
                      required
                      placeholder="e.g. Emergency Contact"
                      value={p.emergency_contact}
                      onChange={(e) => handlePassengerChange(idx, 'emergency_contact', e.target.value)}
                      className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 px-3 py-2 rounded-xl text-sm outline-none focus:ring-2 focus:ring-brand-500"
                    />
                  </div>
                </div>
              </div>
            ))}
          </div>

          {/* Wallet Integration */}
          <div className="bg-white dark:bg-slate-900 border border-slate-200/50 dark:border-slate-800/50 p-6 rounded-2xl shadow-sm flex items-center justify-between">
            <div className="flex items-center gap-3">
              <div className="p-3 bg-brand-50 dark:bg-brand-950/20 text-brand-500 rounded-xl">
                <CreditCard size={20} />
              </div>
              <div>
                <h4 className="font-bold text-slate-800 dark:text-slate-100">Pay via Wallet Credits</h4>
                <p className="text-xs text-slate-500">Your current balance is ₹{walletBalance.toFixed(2)}</p>
              </div>
            </div>
            <input
              type="checkbox"
              checked={useWallet}
              onChange={(e) => setUseWallet(e.target.checked)}
              className="w-5 h-5 accent-brand-500 cursor-pointer"
            />
          </div>

          <button
            type="submit"
            className="w-full bg-brand-500 hover:bg-brand-600 text-white font-bold py-3 rounded-xl flex items-center justify-center space-x-2 transition-all shadow-lg shadow-brand-500/10 text-sm"
          >
            <span>Proceed to Payment Gateway</span>
            <ArrowRight size={18} />
          </button>
        </form>

        {/* Sidebar Fare Breakdown */}
        <div className="space-y-6">
          <div className="bg-white dark:bg-slate-900 border border-slate-200/50 dark:border-slate-800/50 p-6 rounded-2xl space-y-6 shadow-sm">
            <h3 className="font-bold text-slate-800 dark:text-slate-100">Detailed Invoice Summary</h3>

            <div className="space-y-3.5 text-sm text-slate-500 dark:text-slate-400">
              <div className="flex justify-between">
                <span>Base Ticket Fare</span>
                <span className="font-semibold text-slate-800 dark:text-slate-100">₹{baseFare.toFixed(2)}</span>
              </div>
              
              {markups > 0 && (
                <div className="flex justify-between text-amber-500">
                  <span>Weekend & VIP Markups</span>
                  <span className="font-semibold">+₹{markups.toFixed(2)}</span>
                </div>
              )}

              <div className="flex justify-between text-rose-500">
                <span>Coupon Promo Discount</span>
                <span className="font-semibold">-₹{finalDiscount.toFixed(2)}</span>
              </div>

              <div className="flex justify-between">
                <span>GST Tax (Configurable 5%)</span>
                <span className="font-semibold text-slate-800 dark:text-slate-100">₹{gst.toFixed(2)}</span>
              </div>

              <div className="flex justify-between">
                <span>Platform/Service Fee</span>
                <span className="font-semibold text-slate-800 dark:text-slate-100">₹{serviceFee.toFixed(2)}</span>
              </div>

              {useWallet && walletBalance > 0 && (
                <div className="flex justify-between text-green-500 font-medium">
                  <span>Wallet Credits Applied</span>
                  <span>-₹{Math.min(walletBalance, finalTotal).toFixed(2)}</span>
                </div>
              )}

              <hr className="border-slate-200/50 dark:border-slate-800/50 my-3" />
              <div className="flex justify-between text-base font-extrabold text-slate-800 dark:text-slate-100">
                <span>Amount to Pay</span>
                <span className="text-brand-500">₹{Math.max(0, finalTotal - (useWallet ? walletBalance : 0)).toFixed(2)}</span>
              </div>
            </div>

            {/* Promo Input */}
            <div className="space-y-2 border-t border-slate-200/40 dark:border-slate-800/40 pt-4">
              <label className="text-[10px] font-bold text-slate-400 uppercase">Apply Promo Coupon</label>
              <div className="flex space-x-2">
                <input
                  type="text"
                  placeholder="e.g. WELCOME50"
                  value={couponCode}
                  onChange={(e) => setCouponCode(e.target.value)}
                  className="w-full bg-slate-50 dark:bg-slate-950 border border-slate-200 dark:border-slate-800 px-3 py-2 rounded-xl text-sm outline-none focus:ring-1 focus:ring-brand-500"
                />
                <button
                  type="button"
                  onClick={handleApplyCoupon}
                  className="bg-brand-50 hover:bg-brand-100 text-brand-500 dark:bg-slate-800 dark:hover:bg-slate-700 px-4 rounded-xl text-xs font-bold transition-all"
                >
                  Apply
                </button>
              </div>
            </div>
            
            <div className="text-[10px] text-slate-400 bg-slate-50 dark:bg-slate-950/40 p-2.5 rounded-lg border border-slate-100 dark:border-slate-800 flex items-start gap-2">
              <Shield size={14} className="text-brand-500 flex-shrink-0 mt-0.5" />
              <span>We follow dynamic seat fare metrics accounting for passenger safety, insurance buffers, and operator fees.</span>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}

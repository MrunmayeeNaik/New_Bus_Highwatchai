import React, { useState, useEffect } from 'react';
import { User, Phone, ShieldAlert, Award, Save, Wallet, Plus, Heart, Clock, Bell, Trash2, ArrowRight, Download, Calendar, RefreshCw } from 'lucide-react';
import api from '../services/api';
import { useNavigate } from 'react-router-dom';

export default function Profile({ auth }) {
  const navigate = useNavigate();
  const [activeTab, setActiveTab] = useState('bookings'); // Default to Bookings for quick access
  const [profileData, setProfileData] = useState({
    full_name: auth.user?.full_name || '',
    phone: auth.user?.phone || '',
    reward_points: auth.user?.reward_points || 0,
    emergency_contact_name: auth.user?.emergency_contact_name || '',
    emergency_contact_phone: auth.user?.emergency_contact_phone || '',
    emergency_contact_relation: auth.user?.emergency_contact_relation || '',
    wallet_balance: auth.wallet?.balance || 0.0
  });

  const [saving, setSaving] = useState(false);

  // Passenger state lists
  const [savedPassengers, setSavedPassengers] = useState([]);
  const [favorites, setFavorites] = useState([]);
  const [searchHistory, setSearchHistory] = useState([]);
  const [notifications, setNotifications] = useState([]);
  const [transactions, setTransactions] = useState([]);
  const [bookings, setBookings] = useState([]);

  // Filter states for bookings
  const [filterPnr, setFilterPnr] = useState('');
  const [filterDate, setFilterDate] = useState('');

  // Form states
  const [topupAmount, setTopupAmount] = useState('');
  const [newCompanionName, setNewCompanionName] = useState('');
  const [newCompanionAge, setNewCompanionAge] = useState('');
  const [newCompanionGender, setNewCompanionGender] = useState('male');

  const fetchProfileAndStats = () => {
    api.get('/passenger/profile')
      .then(res => {
        setProfileData(prev => ({ ...prev, ...res.data }));
      })
      .catch(() => {});

    api.get('/passenger/saved-passengers')
      .then(res => setSavedPassengers(res.data))
      .catch(() => {});

    api.get('/passenger/favorites')
      .then(res => setFavorites(res.data))
      .catch(() => {});

    api.get('/passenger/search-history')
      .then(res => setSearchHistory(res.data))
      .catch(() => {});

    api.get('/passenger/notifications')
      .then(res => setNotifications(res.data))
      .catch(() => {});

    api.get('/passenger/wallet/transactions')
      .then(res => setTransactions(res.data))
      .catch(() => {});

    // Fetch user bookings history
    api.get('/bookings/history')
      .then(res => setBookings(res.data))
      .catch(() => {});
  };

  useEffect(() => {
    fetchProfileAndStats();
  }, []);

  const handleUpdateProfile = (e) => {
    e.preventDefault();
    setSaving(true);
    
    const payload = {
      emergency_contact_name: profileData.emergency_contact_name,
      emergency_contact_phone: profileData.emergency_contact_phone,
      emergency_contact_relation: profileData.emergency_contact_relation
    };

    api.put('/passenger/emergency-contact', payload)
      .then(() => {
        setSaving(false);
        alert('Emergency contact details updated successfully!');
        fetchProfileAndStats();
      })
      .catch(() => {
        setSaving(false);
        alert('Failed to update emergency contact details.');
      });
  };

  const handleTopup = (e) => {
    e.preventDefault();
    if (!topupAmount || parseFloat(topupAmount) <= 0) return;

    api.post('/passenger/wallet/topup', { amount: parseFloat(topupAmount) })
      .then(res => {
        alert(res.data.detail);
        setTopupAmount('');
        fetchProfileAndStats();
      })
      .catch(err => alert(err.response?.data?.detail || 'Top up failed.'));
  };

  const handleAddCompanion = (e) => {
    e.preventDefault();
    if (!newCompanionName || !newCompanionAge) return;

    const payload = {
      name: newCompanionName,
      age: parseInt(newCompanionAge),
      gender: newCompanionGender
    };

    api.post('/passenger/saved-passengers', payload)
      .then(res => {
        setSavedPassengers(prev => [...prev, res.data]);
        setNewCompanionName('');
        setNewCompanionAge('');
        alert('Saved companion passenger added successfully.');
      })
      .catch(err => alert(err.response?.data?.detail || 'Failed to save companion.'));
  };

  const handleDeleteCompanion = (companionId) => {
    if (!window.confirm("Remove this saved passenger?")) return;
    api.delete(`/passenger/saved-passengers/${companionId}`)
      .then(() => {
        setSavedPassengers(prev => prev.filter(c => c.id !== companionId));
      })
      .catch(err => alert(err.response?.data?.detail || 'Failed to delete companion.'));
  };

  const handleRemoveFavorite = (favId) => {
    api.delete(`/passenger/favorites/${favId}`)
      .then(() => {
        setFavorites(prev => prev.filter(f => f.id !== favId));
      })
      .catch(err => alert(err.response?.data?.detail || 'Failed to remove favorite route.'));
  };

  const handleSearchBookings = (e) => {
    e.preventDefault();
    let queryParams = [];
    if (filterPnr) queryParams.push(`pnr=${filterPnr}`);
    if (filterDate) queryParams.push(`journey_date=${filterDate}`);
    
    const url = `/bookings/history${queryParams.length > 0 ? '?' + queryParams.join('&') : ''}`;
    api.get(url)
      .then(res => setBookings(res.data))
      .catch(() => {});
  };

  const handleCancelBooking = (bookingId) => {
    if (!window.confirm("Are you sure you want to cancel this booking? Cancellation charges will apply depending on the departure time, and refunds will be credited instantly to your New Bus Wallet.")) return;
    
    api.post('/bookings/cancel', { booking_id: bookingId })
      .then(() => {
        alert('Ticket cancelled successfully! Refund credited to wallet.');
        fetchProfileAndStats();
      })
      .catch(err => alert(err.response?.data?.detail || 'Cancellation failed.'));
  };

  const downloadPDF = (bookingId, docType) => {
    api.get(`/bookings/${bookingId}/${docType}`, { responseType: 'blob' })
      .then(res => {
        const fileURL = window.URL.createObjectURL(new Blob([res.data], { type: 'application/pdf' }));
        const fileLink = document.createElement('a');
        fileLink.href = fileURL;
        fileLink.setAttribute('download', `${docType}_${bookingId}.pdf`);
        document.body.appendChild(fileLink);
        fileLink.click();
        fileLink.remove();
      })
      .catch(() => alert(`Failed to download ${docType} PDF.`));
  };

  const getStatusBadgeClass = (status) => {
    switch (status) {
      case 'confirmed': return 'bg-emerald-50 text-emerald-600 dark:bg-emerald-950/20 dark:text-emerald-400';
      case 'cancelled': return 'bg-rose-50 text-rose-600 dark:bg-rose-950/20 dark:text-rose-400';
      case 'failed': return 'bg-red-50 text-red-650 dark:bg-red-950/20 dark:text-red-400';
      default: return 'bg-amber-50 text-amber-600 dark:bg-amber-950/20 dark:text-amber-400';
    }
  };

  return (
    <div className="max-w-6xl mx-auto px-4 py-8 text-left font-sans transition-colors duration-300">
      
      {/* Page Header */}
      <div className="flex flex-col md:flex-row items-start md:items-center justify-between gap-6 mb-10">
        <div className="flex items-center space-x-4">
          <div className="w-16 h-16 bg-brand-500 rounded-2xl flex items-center justify-center text-white text-2xl font-black shadow-md shadow-brand-500/10">
            {profileData.full_name?.charAt(0).toUpperCase() || 'U'}
          </div>
          <div>
            <h2 className="text-xl font-bold text-slate-800 dark:text-slate-100">{profileData.full_name}</h2>
            <p className="text-slate-400 text-xs mt-0.5">{profileData.phone} • Reward Balance: {profileData.reward_points} pts</p>
          </div>
        </div>

        {/* Tab Controls */}
        <div className="flex bg-slate-100 dark:bg-slate-950 p-1.5 rounded-2xl border border-slate-200/40 dark:border-slate-800/40 overflow-x-auto max-w-full">
          {[
            { id: 'bookings', label: 'My Bookings', icon: <Calendar size={14} /> },
            { id: 'profile', label: 'Profile Settings', icon: <User size={14} /> },
            { id: 'wallet', label: 'Wallet Balance', icon: <Wallet size={14} /> },
            { id: 'companions', label: 'Companions', icon: <Plus size={14} /> },
            { id: 'favorites', label: 'Favs & History', icon: <Heart size={14} /> },
            { id: 'notifications', label: 'Notifications', icon: <Bell size={14} /> }
          ].map(tab => (
            <button
              key={tab.id}
              onClick={() => setActiveTab(tab.id)}
              className={`flex items-center space-x-2 px-4 py-2 rounded-xl text-xs font-bold transition-all whitespace-nowrap ${
                activeTab === tab.id
                  ? 'bg-white dark:bg-slate-900 text-brand-500 shadow-sm border border-slate-200/20 dark:border-slate-800/20'
                  : 'text-slate-500 dark:text-slate-400 hover:text-brand-500'
              }`}
            >
              {tab.icon}
              <span>{tab.label}</span>
            </button>
          ))}
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
        
        {/* Left Side Info Panel */}
        <div className="space-y-6">
          <div className="bg-white dark:bg-slate-900 border border-slate-200/50 dark:border-slate-850 p-6 rounded-2xl shadow-sm space-y-4">
            <h4 className="text-[10px] font-bold text-slate-400 uppercase tracking-wider">Rewards Program</h4>
            <div className="flex items-center space-x-3">
              <div className="p-3 bg-amber-50 dark:bg-amber-950/20 text-amber-500 rounded-xl">
                <Award size={20} />
              </div>
              <div>
                <div className="text-[10px] text-slate-400">Total Points Earned</div>
                <div className="text-lg font-black text-slate-800 dark:text-slate-100">{profileData.reward_points} Points</div>
              </div>
            </div>
            <p className="text-[10px] text-slate-400 leading-relaxed">Earn ₹1 back in reward points for every ₹10 spent. Redemptions apply automatically during checkout.</p>
          </div>

          <div className="bg-white dark:bg-slate-900 border border-slate-200/50 dark:border-slate-850 p-6 rounded-2xl shadow-sm space-y-4">
            <h4 className="text-[10px] font-bold text-slate-400 uppercase tracking-wider">New Bus Wallet</h4>
            <div className="flex items-center space-x-3">
              <div className="p-3 bg-emerald-50 dark:bg-emerald-950/20 text-emerald-500 rounded-xl">
                <Wallet size={20} />
              </div>
              <div>
                <div className="text-[10px] text-slate-400">Deduction Balance</div>
                <div className="text-lg font-black text-slate-800 dark:text-slate-100">₹{profileData.wallet_balance.toFixed(2)}</div>
              </div>
            </div>
          </div>
        </div>

        {/* Right Side Content Panel */}
        <div className="lg:col-span-2">
          
          {/* TAB 0: MY BOOKINGS LIST */}
          {activeTab === 'bookings' && (
            <div className="space-y-6 animate-fadeIn">
              
              {/* Search History Filter Bar */}
              <div className="bg-white dark:bg-slate-900 border border-slate-200/50 dark:border-slate-850 p-5 rounded-2xl shadow-sm">
                <h3 className="font-bold text-xs text-slate-800 dark:text-slate-200 uppercase mb-3">Filter Bookings</h3>
                <form onSubmit={handleSearchBookings} className="grid grid-cols-1 sm:grid-cols-3 gap-3">
                  <input
                    type="text"
                    placeholder="Search by PNR..."
                    value={filterPnr}
                    onChange={e => setFilterPnr(e.target.value)}
                    className="bg-slate-50 dark:bg-slate-950 border border-slate-250 dark:border-slate-800 px-3 py-2 rounded-xl text-xs outline-none"
                  />
                  <input
                    type="date"
                    value={filterDate}
                    onChange={e => setFilterDate(e.target.value)}
                    className="bg-slate-50 dark:bg-slate-950 border border-slate-250 dark:border-slate-800 px-3 py-2 rounded-xl text-xs outline-none text-slate-500 font-bold"
                  />
                  <button type="submit" className="bg-brand-500 hover:bg-brand-600 text-white font-bold py-2 rounded-xl text-xs">
                    Search History
                  </button>
                </form>
              </div>

              {/* Bookings Ledger */}
              <div className="space-y-4">
                {bookings.length === 0 ? (
                  <div className="text-center py-12 bg-white dark:bg-slate-900 border border-slate-200/50 dark:border-slate-850 rounded-2xl text-slate-400 text-xs">
                    No bookings logged matching query criteria.
                  </div>
                ) : bookings.map(b => (
                  <div key={b.id} className="bg-white dark:bg-slate-900 border border-slate-200/50 dark:border-slate-850 p-5 rounded-2xl shadow-sm space-y-4">
                    <div className="flex justify-between items-start border-b border-slate-100 dark:border-slate-800 pb-3">
                      <div>
                        <span className="text-[10px] font-bold text-slate-400 uppercase">Booking ID: {b.booking_number}</span>
                        <h4 className="font-bold text-sm text-slate-800 dark:text-slate-250 mt-1">
                          {b.trip?.route?.source_city?.name || 'Mumbai'} → {b.trip?.route?.destination_city?.name || 'Pune'}
                        </h4>
                        <span className="text-[10px] text-slate-400 block mt-0.5">
                          Journey Date: {b.journey_date ? new Date(b.journey_date).toLocaleString() : 'N/A'}
                        </span>
                      </div>
                      <span className={`px-2.5 py-1 rounded-lg text-[10px] font-black uppercase tracking-wider ${getStatusBadgeClass(b.status)}`}>
                        {b.status}
                      </span>
                    </div>

                    <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-3 text-xs">
                      <div>
                        <p className="text-slate-400">PNR: <strong className="text-slate-700 dark:text-slate-350">{b.pnr}</strong></p>
                        <p className="text-slate-400 mt-0.5">Seats: {b.passengers?.map(p => p.seat?.seat_number).join(', ') || 'N/A'}</p>
                        <p className="text-slate-400 mt-0.5">Total Paid: <strong className="text-brand-500 font-bold">₹{b.final_amount.toFixed(2)}</strong></p>
                      </div>

                      <div className="flex flex-wrap gap-2 w-full sm:w-auto">
                        {b.status === 'confirmed' && (
                          <>
                            <button
                              onClick={() => downloadPDF(b.id, 'ticket')}
                              className="bg-brand-50 hover:bg-brand-100 text-brand-500 px-3 py-1.5 rounded-lg flex items-center gap-1.5 text-[10px] font-bold"
                            >
                              <Download size={12} /> Ticket PDF
                            </button>
                            <button
                              onClick={() => downloadPDF(b.id, 'invoice')}
                              className="bg-slate-50 hover:bg-slate-100 dark:bg-slate-850 dark:hover:bg-slate-800 text-slate-500 px-3 py-1.5 rounded-lg flex items-center gap-1.5 text-[10px] font-bold"
                            >
                              <Download size={12} /> GST Invoice
                            </button>
                            <button
                              onClick={() => handleCancelBooking(b.id)}
                              className="bg-rose-50 hover:bg-rose-100 text-rose-500 px-3 py-1.5 rounded-lg text-[10px] font-bold"
                            >
                              Cancel Booking
                            </button>
                          </>
                        )}
                        {(b.status === 'pending' || b.status === 'failed') && (
                          <button
                            onClick={() => navigate('/payment', { state: { booking: b } })}
                            className="bg-amber-500 hover:bg-amber-600 text-white px-4 py-1.5 rounded-lg flex items-center gap-1.5 text-[10px] font-bold w-full sm:w-auto justify-center"
                          >
                            <RefreshCw size={12} /> Pay Now / Retry
                          </button>
                        )}
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          )}

          {/* TAB 1: PROFILE & EMERGENCY CONTACT */}
          {activeTab === 'profile' && (
            <div className="space-y-6 animate-fadeIn">
              <form onSubmit={handleUpdateProfile} className="space-y-6">
                <div className="bg-white dark:bg-slate-900 border border-slate-200/50 dark:border-slate-850 p-6 rounded-2xl shadow-sm space-y-6">
                  <h3 className="font-bold text-sm text-slate-800 dark:text-slate-100 flex items-center gap-2">
                    <User size={16} className="text-brand-500" /> Account Settings
                  </h3>
                  <div className="grid grid-cols-2 gap-4 text-xs">
                    <div>
                      <label className="text-[10px] font-bold text-slate-400 mb-1 block uppercase">Full Name</label>
                      <input type="text" disabled value={profileData.full_name} className="bg-slate-100 dark:bg-slate-950 text-slate-500 border border-slate-200 dark:border-slate-850 px-3 py-2 rounded-xl w-full cursor-not-allowed" />
                    </div>
                    <div>
                      <label className="text-[10px] font-bold text-slate-400 mb-1 block uppercase">Mobile Number</label>
                      <input type="text" disabled value={profileData.phone} className="bg-slate-100 dark:bg-slate-950 text-slate-500 border border-slate-200 dark:border-slate-850 px-3 py-2 rounded-xl w-full cursor-not-allowed" />
                    </div>
                  </div>
                </div>

                <div className="bg-white dark:bg-slate-900 border border-slate-200/50 dark:border-slate-850 p-6 rounded-2xl shadow-sm space-y-6">
                  <h3 className="font-bold text-sm text-slate-800 dark:text-slate-100 flex items-center gap-2">
                    <ShieldAlert size={16} className="text-brand-500" /> Emergency Contacts
                  </h3>
                  
                  <div className="grid grid-cols-1 sm:grid-cols-3 gap-4 text-xs">
                    <div className="flex flex-col">
                      <label className="text-[10px] font-bold text-slate-400 mb-1 block uppercase">Contact Name</label>
                      <input
                        type="text"
                        required
                        placeholder="e.g. Jane Doe"
                        value={profileData.emergency_contact_name}
                        onChange={e => setProfileData({ ...profileData, emergency_contact_name: e.target.value })}
                        className="bg-slate-50 dark:bg-slate-950 border border-slate-300/40 dark:border-slate-800/40 px-3 py-2 rounded-xl text-xs outline-none focus:ring-1 focus:ring-brand-500"
                      />
                    </div>
                    <div className="flex flex-col">
                      <label className="text-[10px] font-bold text-slate-400 mb-1 block uppercase">Mobile Phone</label>
                      <input
                        type="text"
                        required
                        placeholder="e.g. +91..."
                        value={profileData.emergency_contact_phone}
                        onChange={e => setProfileData({ ...profileData, emergency_contact_phone: e.target.value })}
                        className="bg-slate-50 dark:bg-slate-950 border border-slate-300/40 dark:border-slate-800/40 px-3 py-2 rounded-xl text-xs outline-none focus:ring-1 focus:ring-brand-500"
                      />
                    </div>
                    <div className="flex flex-col">
                      <label className="text-[10px] font-bold text-slate-400 mb-1 block uppercase">Relationship</label>
                      <input
                        type="text"
                        required
                        placeholder="e.g. Spouse"
                        value={profileData.emergency_contact_relation}
                        onChange={e => setProfileData({ ...profileData, emergency_contact_relation: e.target.value })}
                        className="bg-slate-50 dark:bg-slate-950 border border-slate-300/40 dark:border-slate-800/40 px-3 py-2 rounded-xl text-xs outline-none focus:ring-1 focus:ring-brand-500"
                      />
                    </div>
                  </div>
                </div>

                <button
                  type="submit"
                  disabled={saving}
                  className="w-full bg-brand-500 hover:bg-brand-600 text-white font-bold py-2.5 rounded-xl text-xs transition-all active:scale-98 flex items-center justify-center space-x-2 shadow-sm"
                >
                  <Save size={14} />
                  <span>{saving ? 'Updating...' : 'Update Settings'}</span>
                </button>
              </form>
            </div>
          )}

          {/* TAB 2: WALLET MANAGEMENT */}
          {activeTab === 'wallet' && (
            <div className="space-y-6 animate-fadeIn">
              <div className="bg-white dark:bg-slate-900 border border-slate-200/50 dark:border-slate-850 p-6 rounded-2xl shadow-sm space-y-6">
                <h3 className="font-bold text-sm text-slate-800 dark:text-slate-100 flex items-center gap-2">
                  <Wallet size={16} className="text-brand-500" /> Wallet Balance Top-up
                </h3>
                <form onSubmit={handleTopup} className="flex gap-4">
                  <div className="flex-1">
                    <input
                      type="number"
                      required
                      min="10"
                      placeholder="Load Amount (e.g. ₹500)"
                      value={topupAmount}
                      onChange={e => setTopupAmount(e.target.value)}
                      className="w-full bg-slate-50 dark:bg-slate-950 border border-slate-300/40 dark:border-slate-800/40 px-3 py-2 rounded-xl text-xs outline-none focus:ring-1 focus:ring-brand-500 font-bold"
                    />
                  </div>
                  <button type="submit" className="bg-brand-500 hover:bg-brand-600 text-white px-6 py-2 rounded-xl text-xs font-bold transition-all">
                    Load Funds
                  </button>
                </form>
              </div>

              <div className="bg-white dark:bg-slate-900 border border-slate-200/50 dark:border-slate-850 p-6 rounded-2xl shadow-sm">
                <h3 className="font-bold text-sm text-slate-800 dark:text-slate-100 mb-4">Transaction Ledger</h3>
                <div className="overflow-y-auto max-h-[300px] space-y-3 pr-2">
                  {transactions.length === 0 ? (
                    <p className="text-xs text-slate-400 text-center py-6">No wallet transactions logged.</p>
                  ) : transactions.map(tx => (
                    <div key={tx.id} className="flex justify-between items-center text-xs p-3 rounded-xl bg-slate-50 dark:bg-slate-950 border border-slate-100 dark:border-slate-900/50">
                      <div>
                        <div className="font-bold text-slate-800 dark:text-slate-200">{tx.description || 'Wallet Topup'}</div>
                        <div className="text-[10px] text-slate-400 mt-0.5">{new Date(tx.created_at).toLocaleString()}</div>
                      </div>
                      <div className={`font-black text-sm ${tx.amount > 0 ? 'text-emerald-500' : 'text-rose-500'}`}>
                        {tx.amount > 0 ? '+' : ''} ₹{tx.amount.toFixed(2)}
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            </div>
          )}

          {/* TAB 3: SAVED PASSENGERS (COMPANIONS) */}
          {activeTab === 'companions' && (
            <div className="grid grid-cols-1 sm:grid-cols-3 gap-6 animate-fadeIn">
              <div className="sm:col-span-2 bg-white dark:bg-slate-900 border border-slate-200/50 dark:border-slate-850 p-6 rounded-2xl shadow-sm space-y-4">
                <h3 className="font-bold text-sm text-slate-800 dark:text-slate-100">Saved Companions</h3>
                <div className="space-y-3">
                  {savedPassengers.length === 0 ? (
                    <p className="text-xs text-slate-400 text-center py-6">No companions saved yet.</p>
                  ) : savedPassengers.map(p => (
                    <div key={p.id} className="flex justify-between items-center bg-slate-50 dark:bg-slate-950 px-4 py-3 rounded-xl border border-slate-100 dark:border-slate-900/50 text-xs">
                      <div>
                        <div className="font-bold text-slate-800 dark:text-slate-200">{p.name}</div>
                        <div className="text-[10px] text-slate-400 mt-0.5">Age: {p.age} • Gender: <span className="capitalize">{p.gender}</span></div>
                      </div>
                      <button onClick={() => handleDeleteCompanion(p.id)} className="text-rose-500 p-2 hover:bg-rose-500/10 rounded-lg">
                        <Trash2 size={15} />
                      </button>
                    </div>
                  ))}
                </div>
              </div>

              <div className="bg-white dark:bg-slate-900 border border-slate-200/50 dark:border-slate-850 p-6 rounded-2xl shadow-sm">
                <h3 className="font-bold text-xs text-slate-800 dark:text-slate-100 mb-4">Add Companion</h3>
                <form onSubmit={handleAddCompanion} className="space-y-3 text-xs">
                  <div className="flex flex-col">
                    <label className="text-[10px] text-slate-400 mb-0.5">Name</label>
                    <input type="text" required placeholder="Full Name" value={newCompanionName} onChange={e => setNewCompanionName(e.target.value)} className="bg-slate-50 dark:bg-slate-950 border border-slate-300/45 dark:border-slate-800/40 px-3 py-2 rounded-xl outline-none" />
                  </div>
                  <div className="flex flex-col">
                    <label className="text-[10px] text-slate-400 mb-0.5">Age</label>
                    <input type="number" required placeholder="Age" value={newCompanionAge} onChange={e => setNewCompanionAge(e.target.value)} className="bg-slate-50 dark:bg-slate-950 border border-slate-300/45 dark:border-slate-800/40 px-3 py-2 rounded-xl outline-none" />
                  </div>
                  <div className="flex flex-col">
                    <label className="text-[10px] text-slate-400 mb-0.5">Gender</label>
                    <select value={newCompanionGender} onChange={e => setNewCompanionGender(e.target.value)} className="bg-slate-50 dark:bg-slate-950 border border-slate-300/45 dark:border-slate-800/40 px-3 py-2 rounded-xl outline-none font-medium">
                      <option value="male">Male</option>
                      <option value="female">Female</option>
                      <option value="other">Other</option>
                    </select>
                  </div>
                  <button type="submit" className="w-full bg-brand-500 hover:bg-brand-600 text-white font-bold py-2 rounded-xl text-xs mt-2">
                    Save Passenger
                  </button>
                </form>
              </div>
            </div>
          )}

          {/* TAB 4: FAVORITES & SEARCH HISTORY */}
          {activeTab === 'favorites' && (
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-6 animate-fadeIn">
              <div className="bg-white dark:bg-slate-900 border border-slate-200/50 dark:border-slate-850 p-6 rounded-2xl shadow-sm space-y-4">
                <h3 className="font-bold text-sm text-slate-800 dark:text-slate-100 flex items-center gap-2">
                  <Heart size={16} className="text-rose-500 fill-rose-500" /> Favorited Routes
                </h3>
                <div className="space-y-3">
                  {favorites.length === 0 ? (
                    <p className="text-xs text-slate-400 text-center py-6">No routes favorited yet.</p>
                  ) : favorites.map(f => (
                    <div key={f.id} className="flex justify-between items-center bg-slate-50 dark:bg-slate-950 p-3 rounded-xl border border-slate-100 dark:border-slate-900/50 text-xs">
                      <div>
                        <div className="font-bold text-slate-800 dark:text-slate-200">{f.source_city} → {f.destination_city}</div>
                        <div className="text-[10px] text-slate-400 mt-0.5">Route Distance: {f.distance_km} km</div>
                      </div>
                      <button onClick={() => handleRemoveFavorite(f.id)} className="text-slate-400 hover:text-rose-500 p-2">
                        <Trash2 size={14} />
                      </button>
                    </div>
                  ))}
                </div>
              </div>

              <div className="bg-white dark:bg-slate-900 border border-slate-200/50 dark:border-slate-850 p-6 rounded-2xl shadow-sm space-y-4">
                <h3 className="font-bold text-sm text-slate-800 dark:text-slate-100 flex items-center gap-2">
                  <Clock size={16} className="text-brand-500" /> Recent Search History
                </h3>
                <div className="space-y-3">
                  {searchHistory.length === 0 ? (
                    <p className="text-xs text-slate-400 text-center py-6">No recent route searches logged.</p>
                  ) : searchHistory.map(h => (
                    <div key={h.id} className="flex justify-between items-center bg-slate-50 dark:bg-slate-950 p-3 rounded-xl border border-slate-100 dark:border-slate-900/50 text-xs">
                      <div>
                        <div className="font-semibold text-slate-700 dark:text-slate-350">{h.source_city_name} → {h.destination_city_name}</div>
                        <div className="text-[9px] text-slate-400 mt-0.5 font-bold">Search Date: {new Date(h.searched_at).toLocaleDateString()}</div>
                      </div>
                      <ArrowRight size={14} className="text-slate-400" />
                    </div>
                  ))}
                </div>
              </div>
            </div>
          )}

          {/* TAB 5: NOTIFICATIONS INBOX */}
          {activeTab === 'notifications' && (
            <div className="bg-white dark:bg-slate-900 border border-slate-200/50 dark:border-slate-850 p-6 rounded-2xl shadow-sm space-y-4 animate-fadeIn">
              <h3 className="font-bold text-sm text-slate-800 dark:text-slate-100 flex items-center gap-2">
                <Bell size={16} className="text-brand-500" /> Message & Alert Inbox
              </h3>
              
              <div className="space-y-3">
                {notifications.length === 0 ? (
                  <p className="text-xs text-slate-400 text-center py-8">Inbox is clean. No notifications received.</p>
                ) : notifications.map(notif => (
                  <div key={notif.id} className="p-4 rounded-xl bg-slate-50 dark:bg-slate-950 border border-slate-100 dark:border-slate-900/50 text-xs text-left">
                    <div className="flex justify-between items-start">
                      <h4 className="font-bold text-slate-800 dark:text-slate-200">{notif.title}</h4>
                      <span className="text-[9px] text-slate-400 font-bold">{new Date(notif.created_at).toLocaleDateString()}</span>
                    </div>
                    <p className="text-slate-550 dark:text-slate-400 mt-2 leading-relaxed">{notif.message}</p>
                  </div>
                ))}
              </div>
            </div>
          )}

        </div>
      </div>
    </div>
  );
}

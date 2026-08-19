import React, { useState, useEffect } from 'react';
import { Truck, Plus, Calendar, DollarSign, Activity, Users, Shield, AlertTriangle } from 'lucide-react';
import api from '../../services/api';

export default function OperatorDashboard() {
  const [activeTab, setActiveTab] = useState('overview');
  const [operatorInfo, setOperatorInfo] = useState(null);
  const [loading, setLoading] = useState(true);

  // States
  const [reports, setReports] = useState({
    total_buses: 0,
    total_trips: 0,
    total_bookings: 0,
    total_revenue: 0.0,
    occupancy_rate: 0.0,
    cancellation_rate: 0.0
  });
  const [buses, setBuses] = useState([]);
  const [staff, setStaff] = useState([]);
  const [trips, setTrips] = useState([]);
  const [routes, setRoutes] = useState([]);
  
  // Visual Seat Builder State
  const [builderRows, setBuilderRows] = useState(8);
  const [builderCols, setBuilderCols] = useState(4);
  const [layoutGrid, setLayoutGrid] = useState([]); // 2D array: { type: 'seater' | 'sleeper' | 'empty', seatNumber: string }

  // Seat Blocking State
  const [selectedBlockTrip, setSelectedBlockTrip] = useState('');
  const [blockTripSeats, setBlockTripSeats] = useState([]);

  // Forms
  const [busNumber, setBusNumber] = useState('');
  const [busType, setBusType] = useState('AC_Sleeper');
  const [capacity, setCapacity] = useState(32);
  const [selectedAmenities, setSelectedAmenities] = useState([]);
  const [amenitiesList, setAmenitiesList] = useState([]);

  // Document Forms
  const [rcNumber, setRcNumber] = useState('');
  const [insuranceNumber, setInsuranceNumber] = useState('');
  const [insuranceExpiry, setInsuranceExpiry] = useState('');
  const [fitnessExpiry, setFitnessExpiry] = useState('');
  const [permitNumber, setPermitNumber] = useState('');
  const [permitExpiry, setPermitExpiry] = useState('');

  // Staff Form
  const [staffName, setStaffName] = useState('');
  const [staffEmail, setStaffEmail] = useState('');
  const [staffPhone, setStaffPhone] = useState('');
  const [staffPassword, setStaffPassword] = useState('');
  const [staffDesignation, setStaffDesignation] = useState('driver');

  // Trip Form
  const [tripBusId, setTripBusId] = useState('');
  const [tripRouteId, setTripRouteId] = useState('');
  const [tripDeparture, setTripDeparture] = useState('');
  const [tripArrival, setTripArrival] = useState('');
  const [tripPrice, setTripPrice] = useState('');
  const [useDynamicPricing, setUseDynamicPricing] = useState(false);
  const [dynamicPricingType, setDynamicPricingType] = useState('occupancy');

  useEffect(() => {
    // Fetch current operator profile link
    api.get('/operator/my-operator')
      .then(res => {
        setOperatorInfo(res.data);
        const opId = res.data.operator_id;
        
        // Fetch stats
        api.get(`/operator/reports?operator_id=${opId}`)
          .then(r => setReports(r.data))
          .catch(err => console.error("Reports error:", err));

        // Fetch fleet
        api.get(`/operator/buses?operator_id=${opId}`)
          .then(b => setBuses(b.data))
          .catch(err => console.error("Buses error:", err));

        // Fetch staff
        api.get(`/operator/staff?operator_id=${opId}`)
          .then(s => setStaff(s.data))
          .catch(err => console.error("Staff error:", err));

        // Fetch scheduled trips
        api.get(`/operator/trips?operator_id=${opId}`)
          .then(t => setTrips(t.data))
          .catch(err => console.error("Trips error:", err));

        setLoading(false);
      })
      .catch(err => {
        console.error("Failed to load operator association:", err);
        setLoading(false);
      });

    // Load master routes & amenities
    api.get('/master/routes')
      .then(res => setRoutes(res.data))
      .catch(() => {});

    api.get('/master/amenities')
      .then(res => setAmenitiesList(res.data))
      .catch(() => {});
  }, []);

  // Initialize Custom Layout Grid when builder size changes
  useEffect(() => {
    const grid = [];
    const colLabels = ['A', 'B', 'C', 'D', 'E', 'F'];
    for (let r = 1; r <= builderRows; r++) {
      const row = [];
      for (let c = 1; c <= builderCols; c++) {
        row.push({
          type: 'seater',
          seatNumber: `${r}${colLabels[c - 1] || c}`,
          isLadies: false
        });
      }
      grid.push(row);
    }
    setLayoutGrid(grid);
  }, [builderRows, builderCols]);

  const toggleBuilderCell = (rIdx, cIdx) => {
    const newGrid = [...layoutGrid];
    const cell = newGrid[rIdx][cIdx];
    if (cell.type === 'seater') {
      cell.type = 'sleeper';
    } else if (cell.type === 'sleeper') {
      cell.type = 'empty';
    } else {
      cell.type = 'seater';
    }
    newGrid[rIdx][cIdx] = cell;
    setLayoutGrid(newGrid);
    
    // Count active seats and update capacity
    let count = 0;
    newGrid.forEach(row => {
      row.forEach(c => {
        if (c.type !== 'empty') count++;
      });
    });
    setCapacity(count);
  };

  const toggleCellLadies = (rIdx, cIdx) => {
    const newGrid = [...layoutGrid];
    newGrid[rIdx][cIdx].isLadies = !newGrid[rIdx][cIdx].isLadies;
    setLayoutGrid(newGrid);
  };

  // Actions
  const handleCreateBus = (e) => {
    e.preventDefault();
    if (!operatorInfo) return;

    // Build custom seats array
    const customSeats = [];
    layoutGrid.forEach((row, rIdx) => {
      row.forEach((cell, cIdx) => {
        if (cell.type !== 'empty') {
          customSeats.push({
            seat_number: cell.seatNumber,
            row: rIdx + 1,
            column: cIdx + 1,
            seat_type: cell.type,
            is_ladies: cell.isLadies
          });
        }
      });
    });

    const payload = {
      operator_id: operatorInfo.operator_id,
      bus_number: busNumber,
      bus_type: busType,
      capacity: parseInt(capacity),
      amenity_ids: selectedAmenities,
      seats: customSeats,
      rc_number: rcNumber || null,
      insurance_number: insuranceNumber || null,
      insurance_expiry: insuranceExpiry ? new Date(insuranceExpiry).toISOString() : null,
      fitness_expiry: fitnessExpiry ? new Date(fitnessExpiry).toISOString() : null,
      permit_number: permitNumber || null,
      permit_expiry: permitExpiry ? new Date(permitExpiry).toISOString() : null
    };

    api.post('/operator/buses', payload)
      .then(res => {
        setBuses(prev => [...prev, res.data]);
        alert('Bus Fleet Vehicle successfully created with visual seat layout and documents!');
        setBusNumber('');
        setRcNumber('');
        setInsuranceNumber('');
        setInsuranceExpiry('');
        setFitnessExpiry('');
        setPermitNumber('');
        setPermitExpiry('');
      })
      .catch(err => {
        alert(err.response?.data?.detail || 'Failed to create bus.');
      });
  };

  const handleRegisterStaff = (e) => {
    e.preventDefault();
    if (!operatorInfo) return;

    const payload = {
      operator_id: operatorInfo.operator_id,
      full_name: staffName,
      email: staffEmail,
      phone: staffPhone,
      password: staffPassword,
      designation: staffDesignation
    };

    api.post('/operator/staff', payload)
      .then(() => {
        alert(`Registered ${staffName} as an operator staff member.`);
        api.get(`/operator/staff?operator_id=${operatorInfo.operator_id}`).then(s => setStaff(s.data));
        setStaffName('');
        setStaffEmail('');
        setStaffPhone('');
        setStaffPassword('');
      })
      .catch(err => {
        alert(err.response?.data?.detail || 'Failed to register staff.');
      });
  };

  const handleDeleteStaff = (staffId) => {
    if (!window.confirm("Remove this staff member from your operator?")) return;
    api.delete(`/operator/staff/${staffId}`)
      .then(() => {
        setStaff(prev => prev.filter(s => s.id !== staffId));
      })
      .catch(err => alert(err.response?.data?.detail || 'Failed to remove staff.'));
  };

  const handleCreateTrip = (e) => {
    e.preventDefault();
    if (!operatorInfo) return;

    const payload = {
      bus_id: tripBusId,
      operator_id: operatorInfo.operator_id,
      route_id: tripRouteId,
      departure_time: new Date(tripDeparture).toISOString(),
      arrival_time: new Date(tripArrival).toISOString(),
      price: parseFloat(tripPrice),
      discount_price: null,
      use_dynamic_pricing: useDynamicPricing,
      dynamic_pricing_type: dynamicPricingType
    };

    api.post('/operator/trips', payload)
      .then(res => {
        setTrips(prev => [...prev, res.data]);
        alert('New scheduled trip initialized.');
        setTripPrice('');
        setTripDeparture('');
        setTripArrival('');
      })
      .catch(err => alert(err.response?.data?.detail || 'Failed to schedule trip.'));
  };

  const handleCancelTrip = (tripId) => {
    if (!window.confirm("Cancel this scheduled trip? All active bookings will be notified.")) return;
    api.delete(`/operator/trips/${tripId}`)
      .then(() => {
        setTrips(prev => prev.map(t => t.id === tripId ? { ...t, status: 'cancelled' } : t));
        alert('Trip status updated to Cancelled.');
      })
      .catch(err => alert(err.response?.data?.detail || 'Failed to cancel trip.'));
  };

  // Block Seats Loading
  useEffect(() => {
    if (selectedBlockTrip) {
      api.get(`/bookings/seats/layout/${selectedBlockTrip}`)
        .then(res => setBlockTripSeats(res.data))
        .catch(() => setBlockTripSeats([]));
    } else {
      setBlockTripSeats([]);
    }
  }, [selectedBlockTrip]);

  const handleToggleBlockSeat = (seatId) => {
    api.post(`/operator/seats/${seatId}/block`)
      .then(res => {
        setBlockTripSeats(prev => prev.map(s => s.id === seatId ? { ...s, status: res.data.is_blocked ? 'blocked' : 'available' } : s));
      })
      .catch(err => alert(err.response?.data?.detail || 'Failed to toggle seat blocking.'));
  };

  // Expiry check helpers
  const getExpiryBadge = (dateStr) => {
    if (!dateStr) return <span className="text-slate-400">N/A</span>;
    const expDate = new Date(dateStr);
    const today = new Date();
    const diffTime = expDate - today;
    const diffDays = Math.ceil(diffTime / (1000 * 60 * 60 * 24));

    if (diffDays < 0) {
      return <span className="bg-red-500/10 text-red-500 border border-red-500/30 px-2 py-0.5 rounded text-[10px] font-bold">EXPIRED</span>;
    } else if (diffDays <= 30) {
      return <span className="bg-amber-500/10 text-amber-500 border border-amber-500/30 px-2 py-0.5 rounded text-[10px] font-bold font-mono">EXPIRING SOON ({diffDays}d)</span>;
    }
    return <span className="text-emerald-500 font-medium">{expDate.toLocaleDateString()}</span>;
  };

  if (loading) {
    return (
      <div className="flex flex-col items-center justify-center min-h-[60vh] space-y-4">
        <div className="animate-spin rounded-full h-12 w-12 border-t-2 border-b-2 border-brand-500"></div>
        <p className="text-sm font-semibold text-slate-500 font-sans">Retrieving Operator Dashboard...</p>
      </div>
    );
  }

  if (!operatorInfo) {
    return (
      <div className="max-w-md mx-auto text-center py-20 font-sans">
        <AlertTriangle size={48} className="text-red-500 mx-auto mb-4" />
        <h3 className="text-lg font-black text-slate-800 dark:text-slate-100">No Association Found</h3>
        <p className="text-slate-400 text-xs mt-2">Your user account is not mapped to any active bus operator profile. Please contact administrators to initialize mapping.</p>
      </div>
    );
  }

  return (
    <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-10 transition-colors duration-300 text-left font-sans">
      
      {/* Header */}
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 mb-8">
        <div>
          <h2 className="text-2xl font-black text-slate-800 dark:text-slate-100 flex items-center gap-2">
            <Truck size={28} className="text-brand-500" /> {operatorInfo.operator_name} Portal
          </h2>
          <p className="text-slate-400 text-xs font-medium uppercase tracking-wider mt-1">
            Role: Operator Staff ({operatorInfo.designation})
          </p>
        </div>
        
        {/* Navigation Tabs */}
        <div className="flex space-x-1 bg-slate-100 dark:bg-slate-950 p-1.5 rounded-2xl border border-slate-200/40 dark:border-slate-800/40 overflow-x-auto">
          {[
            { id: 'overview', label: 'Overview', icon: <Activity size={15} /> },
            { id: 'fleet', label: 'Fleet Management', icon: <Truck size={15} /> },
            { id: 'staff', label: 'Staff Management', icon: <Users size={15} /> },
            { id: 'trips', label: 'Trip Management', icon: <Calendar size={15} /> },
            { id: 'blocking', label: 'Seat Blocking', icon: <Shield size={15} /> }
          ].map(tab => (
            <button
              key={tab.id}
              onClick={() => setActiveTab(tab.id)}
              className={`flex items-center space-x-2 px-4 py-2 rounded-xl text-xs font-bold transition-all ${
                activeTab === tab.id
                  ? 'bg-white dark:bg-slate-900 text-brand-500 shadow-sm border border-slate-200/30 dark:border-slate-800/30'
                  : 'text-slate-500 dark:text-slate-400 hover:text-brand-500'
              }`}
            >
              {tab.icon}
              <span>{tab.label}</span>
            </button>
          ))}
        </div>
      </div>

      {/* TABS VIEW */}
      
      {/* 1. OVERVIEW */}
      {activeTab === 'overview' && (
        <div className="space-y-8 animate-fadeIn">
          {/* Metrics */}
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-6">
            {[
              { label: 'Active Fleet', value: reports.total_buses, desc: 'Buses in system', icon: <Truck className="text-blue-500" /> },
              { label: 'Total Scheduled', value: reports.total_trips, desc: 'Trips created', icon: <Calendar className="text-amber-500" /> },
              { label: 'Net Bookings', value: reports.total_bookings, desc: 'Confirmed tickets', icon: <Activity className="text-emerald-500" /> },
              { label: 'Operator Revenue', value: `₹${reports.total_revenue?.toFixed(2)}`, desc: 'Total gross sales', icon: <DollarSign className="text-rose-500" /> }
            ].map((item, i) => (
              <div key={i} className="bg-white dark:bg-slate-900 border border-slate-200/50 dark:border-slate-900/50 p-6 rounded-2xl shadow-sm flex items-center space-x-4">
                <div className="p-3 bg-slate-50 dark:bg-slate-950 rounded-xl">{item.icon}</div>
                <div>
                  <div className="text-slate-400 text-[10px] font-bold uppercase tracking-wider">{item.label}</div>
                  <div className="text-2xl font-black mt-1 text-slate-800 dark:text-slate-100">{item.value}</div>
                  <p className="text-[10px] text-slate-400 mt-0.5">{item.desc}</p>
                </div>
              </div>
            ))}
          </div>

          <div className="grid grid-cols-1 lg:grid-cols-2 gap-8">
            <div className="bg-white dark:bg-slate-900 border border-slate-200/50 dark:border-slate-900/50 p-6 rounded-2xl shadow-sm">
              <h3 className="font-bold text-sm text-slate-800 dark:text-slate-100 mb-4 flex items-center gap-2">
                <Activity size={16} className="text-brand-500" /> Seat Occupancy Analytics
              </h3>
              <div className="flex flex-col items-center justify-center py-10 space-y-4">
                <div className="relative flex items-center justify-center">
                  <svg className="w-32 h-32 transform -rotate-90">
                    <circle cx="64" cy="64" r="50" strokeWidth="8" stroke="currentColor" className="text-slate-100 dark:text-slate-950" fill="transparent" />
                    <circle cx="64" cy="64" r="50" strokeWidth="8" stroke="currentColor" className="text-brand-500" fill="transparent"
                      strokeDasharray={2 * Math.PI * 50}
                      strokeDashoffset={2 * Math.PI * 50 * (1 - reports.occupancy_rate / 100)} />
                  </svg>
                  <span className="absolute text-xl font-black text-slate-800 dark:text-slate-100">{reports.occupancy_rate}%</span>
                </div>
                <div className="text-center">
                  <p className="text-xs text-slate-400">Average seat occupancy rate across all active scheduled coaches.</p>
                </div>
              </div>
            </div>

            <div className="bg-white dark:bg-slate-900 border border-slate-200/50 dark:border-slate-900/50 p-6 rounded-2xl shadow-sm flex flex-col justify-between">
              <div>
                <h3 className="font-bold text-sm text-slate-800 dark:text-slate-100 mb-4 flex items-center gap-2">
                  <AlertTriangle size={16} className="text-amber-500" /> Cancellation Index
                </h3>
                <p className="text-slate-400 text-xs mb-6">Percentage of bookings cancelled by passengers relative to total tickets purchased.</p>
              </div>
              <div className="flex items-end justify-between border-t border-slate-100 dark:border-slate-800 pt-6">
                <div>
                  <span className="text-[10px] text-slate-400 uppercase font-bold tracking-wider">Cancellation Rate</span>
                  <div className="text-3xl font-black text-slate-800 dark:text-slate-100 mt-1">{reports.cancellation_rate}%</div>
                </div>
                <div className={`px-3 py-1 rounded-full text-[10px] font-bold ${reports.cancellation_rate < 15 ? 'bg-emerald-500/10 text-emerald-500' : 'bg-red-500/10 text-red-500'}`}>
                  {reports.cancellation_rate < 15 ? 'Optimal Health' : 'Needs Review'}
                </div>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* 2. FLEET MANAGEMENT */}
      {activeTab === 'fleet' && (
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-8 animate-fadeIn">
          {/* Vehicles List */}
          <div className="lg:col-span-2 space-y-6">
            <div className="bg-white dark:bg-slate-900 border border-slate-200/50 dark:border-slate-900/50 p-6 rounded-2xl shadow-sm">
              <h3 className="font-bold text-sm text-slate-800 dark:text-slate-100 mb-4">Operator Fleet List</h3>
              <div className="overflow-x-auto">
                <table className="w-full text-left text-xs border-collapse">
                  <thead>
                    <tr className="text-slate-400 border-b border-slate-200/30 dark:border-slate-800/30 font-bold">
                      <th className="py-3">Bus Details</th>
                      <th className="py-3">Documents & Compliance</th>
                      <th className="py-3">Compliance Expiries</th>
                    </tr>
                  </thead>
                  <tbody>
                    {buses.length === 0 ? (
                      <tr>
                        <td colSpan="3" className="py-10 text-center text-slate-400">No vehicles registered in fleet yet.</td>
                      </tr>
                    ) : buses.map(bus => (
                      <tr key={bus.id} className="border-b border-slate-100 dark:border-slate-800/30">
                        <td className="py-4">
                          <div className="font-black text-slate-800 dark:text-slate-100">{bus.bus_number}</div>
                          <div className="text-slate-400 mt-0.5">{bus.bus_type} ({bus.capacity} seats)</div>
                        </td>
                        <td className="py-4 font-mono text-[10px]">
                          <div className="space-y-0.5">
                            <p className="text-[10px] text-slate-400"><strong className="text-slate-600 dark:text-slate-400 font-sans">RC:</strong> {bus.rc_number || 'N/A'}</p>
                            <p className="text-[10px] text-slate-400"><strong className="text-slate-600 dark:text-slate-400 font-sans">Permit:</strong> {bus.permit_number || 'N/A'}</p>
                            <p className="text-[10px] text-slate-400"><strong className="text-slate-600 dark:text-slate-400 font-sans">Insurance:</strong> {bus.insurance_number || 'N/A'}</p>
                          </div>
                        </td>
                        <td className="py-4">
                          <div className="space-y-1">
                            <div className="flex items-center justify-between gap-4 text-[10px]">
                              <span className="text-slate-400">Insurance Exp:</span>
                              {getExpiryBadge(bus.insurance_expiry)}
                            </div>
                            <div className="flex items-center justify-between gap-4 text-[10px]">
                              <span className="text-slate-400">Fitness Exp:</span>
                              {getExpiryBadge(bus.fitness_expiry)}
                            </div>
                            <div className="flex items-center justify-between gap-4 text-[10px]">
                              <span className="text-slate-400">Permit Exp:</span>
                              {getExpiryBadge(bus.permit_expiry)}
                            </div>
                          </div>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>
          </div>

          {/* Configuration & visual layout builder */}
          <div className="space-y-6">
            <div className="bg-white dark:bg-slate-900 border border-slate-200/50 dark:border-slate-900/50 p-6 rounded-2xl shadow-sm">
              <h3 className="font-bold text-sm text-slate-800 dark:text-slate-100 mb-4 flex items-center gap-2">
                <Plus size={16} className="text-brand-500" /> Fleet Vehicle Provision
              </h3>
              
              <form onSubmit={handleCreateBus} className="space-y-4">
                <div className="grid grid-cols-2 gap-4">
                  <div className="flex flex-col">
                    <label className="text-[10px] font-bold text-slate-400 uppercase tracking-wider mb-1">Registration plate</label>
                    <input
                      type="text"
                      required
                      placeholder="e.g. MH-12-PQ-9999"
                      value={busNumber}
                      onChange={e => setBusNumber(e.target.value)}
                      className="bg-slate-50 dark:bg-slate-950 border border-slate-300/40 dark:border-slate-800/40 px-3 py-2 rounded-xl text-xs focus:ring-1 focus:ring-brand-500 outline-none font-bold text-slate-700 dark:text-slate-200"
                    />
                  </div>
                  <div className="flex flex-col">
                    <label className="text-[10px] font-bold text-slate-400 uppercase tracking-wider mb-1">Bus Class Type</label>
                    <select
                      value={busType}
                      onChange={e => setBusType(e.target.value)}
                      className="bg-slate-50 dark:bg-slate-950 border border-slate-300/40 dark:border-slate-800/40 px-3 py-2 rounded-xl text-xs focus:ring-1 focus:ring-brand-500 outline-none font-medium"
                    >
                      <option value="AC_Sleeper">AC Sleeper</option>
                      <option value="AC_Seater">AC Seater</option>
                      <option value="Non_AC_Sleeper">Non-AC Sleeper</option>
                      <option value="Non_AC_Seater">Non-AC Seater</option>
                    </select>
                  </div>
                </div>

                <div className="border-t border-slate-100 dark:border-slate-800/30 pt-4">
                  <h4 className="font-bold text-xs text-slate-800 dark:text-slate-200 mb-2">Visual Seat Grid Settings</h4>
                  <div className="grid grid-cols-2 gap-4 mb-4">
                    <div className="flex flex-col">
                      <label className="text-[10px] text-slate-400">Layout Rows</label>
                      <input
                        type="number"
                        min="2"
                        max="12"
                        value={builderRows}
                        onChange={e => setBuilderRows(parseInt(e.target.value) || 8)}
                        className="bg-slate-50 dark:bg-slate-950 border border-slate-300/40 dark:border-slate-800/40 px-3 py-1.5 rounded-xl text-xs"
                      />
                    </div>
                    <div className="flex flex-col">
                      <label className="text-[10px] text-slate-400">Layout Columns</label>
                      <input
                        type="number"
                        min="2"
                        max="6"
                        value={builderCols}
                        onChange={e => setBuilderCols(parseInt(e.target.value) || 4)}
                        className="bg-slate-50 dark:bg-slate-950 border border-slate-300/40 dark:border-slate-800/40 px-3 py-1.5 rounded-xl text-xs"
                      />
                    </div>
                  </div>

                  {/* Seat Grid Builder UI */}
                  <div className="p-3 bg-slate-50 dark:bg-slate-950 rounded-xl mb-4 border border-slate-100 dark:border-slate-800/40">
                    <p className="text-[9px] text-slate-400 mb-3 text-center">Click block once for Seater, twice for Sleeper, thrice to clear seat.</p>
                    <div className="grid gap-2" style={{ gridTemplateColumns: `repeat(${builderCols}, minmax(0, 1fr))` }}>
                      {layoutGrid.map((row, rIdx) => 
                        row.map((cell, cIdx) => (
                          <div key={`${rIdx}-${cIdx}`} className="flex flex-col items-center">
                            <button
                              type="button"
                              onClick={() => toggleBuilderCell(rIdx, cIdx)}
                              className={`w-full aspect-square text-[9px] font-black rounded-lg border flex items-center justify-center transition-all ${
                                cell.type === 'seater'
                                  ? 'bg-blue-500/10 text-blue-500 border-blue-500/30'
                                  : cell.type === 'sleeper'
                                  ? 'bg-amber-500/10 text-amber-500 border-amber-500/30'
                                  : 'bg-transparent text-slate-300 border-dashed border-slate-200 dark:border-slate-800'
                              }`}
                            >
                              {cell.type !== 'empty' ? cell.seatNumber : '•'}
                            </button>
                            
                            {cell.type !== 'empty' && (
                              <button
                                type="button"
                                onClick={() => toggleCellLadies(rIdx, cIdx)}
                                className={`text-[8px] mt-0.5 px-1 rounded ${
                                  cell.isLadies ? 'bg-pink-500 text-white font-bold' : 'text-slate-400'
                                }`}
                              >
                                {cell.isLadies ? 'L' : 'G'}
                              </button>
                            )}
                          </div>
                        ))
                      )}
                    </div>
                    <div className="mt-4 flex justify-between items-center text-[10px] text-slate-500">
                      <span>Total Active Capacity:</span>
                      <span className="font-black text-brand-500">{capacity} Seats</span>
                    </div>
                  </div>
                </div>

                {/* Documents */}
                <div className="border-t border-slate-100 dark:border-slate-800 pt-4 space-y-3">
                  <h4 className="font-bold text-xs text-slate-800 dark:text-slate-200 mb-2">Compliance Certificates</h4>
                  
                  <div className="grid grid-cols-2 gap-4">
                    <div className="flex flex-col">
                      <label className="text-[10px] text-slate-400 mb-0.5">Registration (RC) #</label>
                      <input type="text" placeholder="RC Number" value={rcNumber} onChange={e => setRcNumber(e.target.value)} className="bg-slate-50 dark:bg-slate-950 border border-slate-300/40 dark:border-slate-800/40 px-3 py-1.5 rounded-xl text-xs" />
                    </div>
                    <div className="flex flex-col">
                      <label className="text-[10px] text-slate-400 mb-0.5">National Permit #</label>
                      <input type="text" placeholder="Permit Number" value={permitNumber} onChange={e => setPermitNumber(e.target.value)} className="bg-slate-50 dark:bg-slate-950 border border-slate-300/40 dark:border-slate-800/40 px-3 py-1.5 rounded-xl text-xs" />
                    </div>
                  </div>

                  <div className="grid grid-cols-2 gap-4 font-sans">
                    <div className="flex flex-col">
                      <label className="text-[10px] text-slate-400 mb-0.5">Insurance policy #</label>
                      <input type="text" placeholder="Insurance #" value={insuranceNumber} onChange={e => setInsuranceNumber(e.target.value)} className="bg-slate-50 dark:bg-slate-950 border border-slate-300/40 dark:border-slate-800/40 px-3 py-1.5 rounded-xl text-xs" />
                    </div>
                    <div className="flex flex-col">
                      <label className="text-[10px] text-slate-400 mb-0.5">Insurance Expiry</label>
                      <input type="date" value={insuranceExpiry} onChange={e => setInsuranceExpiry(e.target.value)} className="bg-slate-50 dark:bg-slate-950 border border-slate-300/40 dark:border-slate-800/40 px-3 py-1.5 rounded-xl text-xs" />
                    </div>
                  </div>

                  <div className="grid grid-cols-2 gap-4">
                    <div className="flex flex-col">
                      <label className="text-[10px] text-slate-400 mb-0.5">Permit Expiry</label>
                      <input type="date" value={permitExpiry} onChange={e => setPermitExpiry(e.target.value)} className="bg-slate-50 dark:bg-slate-950 border border-slate-300/40 dark:border-slate-800/40 px-3 py-1.5 rounded-xl text-xs" />
                    </div>
                    <div className="flex flex-col">
                      <label className="text-[10px] text-slate-400 mb-0.5">Fitness Expiry</label>
                      <input type="date" value={fitnessExpiry} onChange={e => setFitnessExpiry(e.target.value)} className="bg-slate-50 dark:bg-slate-950 border border-slate-300/40 dark:border-slate-800/40 px-3 py-1.5 rounded-xl text-xs" />
                    </div>
                  </div>
                </div>

                <button
                  type="submit"
                  className="w-full bg-brand-500 hover:bg-brand-600 text-white font-bold py-2.5 rounded-xl text-xs transition-all active:scale-98 shadow-sm shadow-brand-500/10 mt-4"
                >
                  Create & Save Bus
                </button>
              </form>
            </div>
          </div>
        </div>
      )}

      {/* 3. STAFF MANAGEMENT */}
      {activeTab === 'staff' && (
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-8 animate-fadeIn font-sans">
          {/* Staff lists */}
          <div className="lg:col-span-2 bg-white dark:bg-slate-900 border border-slate-200/50 dark:border-slate-900/50 p-6 rounded-2xl shadow-sm">
            <h3 className="font-bold text-sm text-slate-800 dark:text-slate-100 mb-4">Active Drivers & Conductors</h3>
            <div className="overflow-x-auto">
              <table className="w-full text-left text-xs border-collapse font-sans">
                <thead>
                  <tr className="text-slate-400 border-b border-slate-200/30 dark:border-slate-800/30 font-bold">
                    <th className="py-3">Full Name</th>
                    <th className="py-3">Designation</th>
                    <th className="py-3">Contacts</th>
                    <th className="py-3">Actions</th>
                  </tr>
                </thead>
                <tbody>
                  {staff.length === 0 ? (
                    <tr>
                      <td colSpan="4" className="py-10 text-center text-slate-400">No staff members enrolled yet.</td>
                    </tr>
                  ) : staff.map(member => (
                    <tr key={member.id} className="border-b border-slate-100 dark:border-slate-800/30 text-xs">
                      <td className="py-4 font-bold text-slate-800 dark:text-slate-200">{member.full_name}</td>
                      <td className="py-4 uppercase text-[10px] tracking-wide font-black text-brand-500">{member.designation}</td>
                      <td className="py-4 text-slate-400">{member.email} / {member.phone}</td>
                      <td className="py-4">
                        {member.designation !== 'manager' && (
                          <button
                            onClick={() => handleDeleteStaff(member.id)}
                            className="text-red-500 hover:text-red-600 font-bold"
                          >
                            Remove
                          </button>
                        )}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>

          {/* Add Staff form */}
          <div className="bg-white dark:bg-slate-900 border border-slate-200/50 dark:border-slate-900/50 p-6 rounded-2xl shadow-sm">
            <h3 className="font-bold text-sm text-slate-800 dark:text-slate-100 mb-4 flex items-center gap-2">
              <Plus size={16} className="text-brand-500" /> Register Staff Member
            </h3>
            <form onSubmit={handleRegisterStaff} className="space-y-4">
              <div className="flex flex-col">
                <label className="text-[10px] font-bold text-slate-400 uppercase tracking-wider mb-1">Full Name</label>
                <input
                  type="text"
                  required
                  placeholder="e.g. Anand Kumar"
                  value={staffName}
                  onChange={e => setStaffName(e.target.value)}
                  className="bg-slate-50 dark:bg-slate-950 border border-slate-300/40 dark:border-slate-800/40 px-3 py-2 rounded-xl text-xs focus:ring-1 focus:ring-brand-500 outline-none"
                />
              </div>

              <div className="flex flex-col">
                <label className="text-[10px] font-bold text-slate-400 uppercase tracking-wider mb-1">Email Address</label>
                <input
                  type="email"
                  required
                  placeholder="staff@newbus.in"
                  value={staffEmail}
                  onChange={e => setStaffEmail(e.target.value)}
                  className="bg-slate-50 dark:bg-slate-950 border border-slate-300/40 dark:border-slate-800/40 px-3 py-2 rounded-xl text-xs focus:ring-1 focus:ring-brand-500 outline-none"
                />
              </div>

              <div className="flex flex-col">
                <label className="text-[10px] font-bold text-slate-400 uppercase tracking-wider mb-1">Phone Number</label>
                <input
                  type="text"
                  required
                  placeholder="+919876543299"
                  value={staffPhone}
                  onChange={e => setStaffPhone(e.target.value)}
                  className="bg-slate-50 dark:bg-slate-950 border border-slate-300/40 dark:border-slate-800/40 px-3 py-2 rounded-xl text-xs focus:ring-1 focus:ring-brand-500 outline-none"
                />
              </div>

              <div className="flex flex-col">
                <label className="text-[10px] font-bold text-slate-400 uppercase tracking-wider mb-1">Login Password</label>
                <input
                  type="password"
                  required
                  placeholder="••••••••"
                  value={staffPassword}
                  onChange={e => setStaffPassword(e.target.value)}
                  className="bg-slate-50 dark:bg-slate-950 border border-slate-300/40 dark:border-slate-800/40 px-3 py-2 rounded-xl text-xs focus:ring-1 focus:ring-brand-500 outline-none"
                />
              </div>

              <div className="flex flex-col">
                <label className="text-[10px] font-bold text-slate-400 uppercase tracking-wider mb-1">Role / Designation</label>
                <select
                  value={staffDesignation}
                  onChange={e => setStaffDesignation(e.target.value)}
                  className="bg-slate-50 dark:bg-slate-950 border border-slate-300/40 dark:border-slate-800/40 px-3 py-2 rounded-xl text-xs focus:ring-1 focus:ring-brand-500 outline-none font-medium"
                >
                  <option value="driver">Driver</option>
                  <option value="conductor">Conductor</option>
                  <option value="manager">Manager/Coordinator</option>
                </select>
              </div>

              <button
                type="submit"
                className="w-full bg-brand-500 hover:bg-brand-600 text-white font-bold py-2.5 rounded-xl text-xs transition-all active:scale-98 shadow-sm shadow-brand-500/10"
              >
                Register Employee
              </button>
            </form>
          </div>
        </div>
      )}

      {/* 4. TRIP MANAGEMENT */}
      {activeTab === 'trips' && (
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-8 animate-fadeIn font-sans">
          {/* Trips Schedule list */}
          <div className="lg:col-span-2 bg-white dark:bg-slate-900 border border-slate-200/50 dark:border-slate-900/50 p-6 rounded-2xl shadow-sm">
            <h3 className="font-bold text-sm text-slate-800 dark:text-slate-100 mb-4">Trip Schedule</h3>
            <div className="overflow-x-auto">
              <table className="w-full text-left text-xs border-collapse">
                <thead>
                  <tr className="text-slate-400 border-b border-slate-200/30 dark:border-slate-800/30 font-bold">
                    <th className="py-3">Bus Vehicle</th>
                    <th className="py-3">Timings</th>
                    <th className="py-3">Pricing Settings</th>
                    <th className="py-3">Status</th>
                    <th className="py-3">Action</th>
                  </tr>
                </thead>
                <tbody>
                  {trips.length === 0 ? (
                    <tr>
                      <td colSpan="5" className="py-10 text-center text-slate-400">No scheduled trips created.</td>
                    </tr>
                  ) : trips.map(t => (
                    <tr key={t.id} className="border-b border-slate-100 dark:border-slate-800/30 text-xs">
                      <td className="py-4">
                        <div className="font-black text-slate-800 dark:text-slate-100">{t.bus?.bus_number}</div>
                        <div className="text-[10px] text-slate-400">{t.bus?.bus_type}</div>
                      </td>
                      <td className="py-4">
                        <div className="font-medium text-slate-700 dark:text-slate-300">Dep: {new Date(t.departure_time).toLocaleString()}</div>
                        <div className="text-[10px] text-slate-400 mt-0.5">Arr: {new Date(t.arrival_time).toLocaleString()}</div>
                      </td>
                      <td className="py-4">
                        <div className="font-black text-brand-500">₹{t.price}</div>
                        <div className="text-[9px] text-slate-400 flex flex-col mt-0.5">
                          <span>Dynamic Pricing: {t.use_dynamic_pricing ? 'ENABLED' : 'OFF'}</span>
                          {t.use_dynamic_pricing && <span className="uppercase text-[8px] font-black text-amber-500">Rule: {t.dynamic_pricing_type}</span>}
                        </div>
                      </td>
                      <td className="py-4">
                        <span className={`px-2 py-0.5 rounded text-[10px] font-black ${
                          t.status === 'scheduled' ? 'bg-blue-500/10 text-blue-500' :
                          t.status === 'cancelled' ? 'bg-red-500/10 text-red-500' : 'bg-emerald-500/10 text-emerald-500'
                        }`}>
                          {t.status.toUpperCase()}
                        </span>
                      </td>
                      <td className="py-4">
                        {t.status === 'scheduled' && (
                          <button
                            onClick={() => handleCancelTrip(t.id)}
                            className="text-red-500 hover:text-red-600 font-bold"
                          >
                            Cancel
                          </button>
                        )}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>

          {/* Schedule form */}
          <div className="bg-white dark:bg-slate-900 border border-slate-200/50 dark:border-slate-900/50 p-6 rounded-2xl shadow-sm">
            <h3 className="font-bold text-sm text-slate-800 dark:text-slate-100 mb-4 flex items-center gap-2">
              <Plus size={16} className="text-brand-500" /> Create Scheduled Trip
            </h3>
            
            <form onSubmit={handleCreateTrip} className="space-y-4">
              <div className="flex flex-col">
                <label className="text-[10px] font-bold text-slate-400 uppercase tracking-wider mb-1">Select Bus</label>
                <select
                  required
                  value={tripBusId}
                  onChange={e => setTripBusId(e.target.value)}
                  className="bg-slate-50 dark:bg-slate-950 border border-slate-300/40 dark:border-slate-800/40 px-3 py-2 rounded-xl text-xs"
                >
                  <option value="">-- Choose Fleet Vehicle --</option>
                  {buses.map(b => (
                    <option key={b.id} value={b.id}>{b.bus_number} ({b.bus_type})</option>
                  ))}
                </select>
              </div>

              <div className="flex flex-col">
                <label className="text-[10px] font-bold text-slate-400 uppercase tracking-wider mb-1">Select Route</label>
                <select
                  required
                  value={tripRouteId}
                  onChange={e => setTripRouteId(e.target.value)}
                  className="bg-slate-50 dark:bg-slate-950 border border-slate-300/40 dark:border-slate-800/40 px-3 py-2 rounded-xl text-xs"
                >
                  <option value="">-- Choose Route --</option>
                  {routes.map(r => (
                    <option key={r.id} value={r.id}>
                      {r.source_city?.name} → {r.destination_city?.name} ({r.distance_km} km)
                    </option>
                  ))}
                </select>
              </div>

              <div className="flex flex-col">
                <label className="text-[10px] font-bold text-slate-400 uppercase tracking-wider mb-1">Departure Time</label>
                <input
                  type="datetime-local"
                  required
                  value={tripDeparture}
                  onChange={e => setTripDeparture(e.target.value)}
                  className="bg-slate-50 dark:bg-slate-950 border border-slate-300/40 dark:border-slate-800/40 px-3 py-2 rounded-xl text-xs focus:ring-1 focus:ring-brand-500 outline-none font-sans"
                />
              </div>

              <div className="flex flex-col">
                <label className="text-[10px] font-bold text-slate-400 uppercase tracking-wider mb-1">Arrival Time</label>
                <input
                  type="datetime-local"
                  required
                  value={tripArrival}
                  onChange={e => setTripArrival(e.target.value)}
                  className="bg-slate-50 dark:bg-slate-950 border border-slate-300/40 dark:border-slate-800/40 px-3 py-2 rounded-xl text-xs focus:ring-1 focus:ring-brand-500 outline-none font-sans"
                />
              </div>

              <div className="flex flex-col">
                <label className="text-[10px] font-bold text-slate-400 uppercase tracking-wider mb-1">Base Price (INR)</label>
                <input
                  type="number"
                  required
                  placeholder="e.g. 750"
                  value={tripPrice}
                  onChange={e => setTripPrice(e.target.value)}
                  className="bg-slate-50 dark:bg-slate-950 border border-slate-300/40 dark:border-slate-800/40 px-3 py-2 rounded-xl text-xs focus:ring-1 focus:ring-brand-500 outline-none font-bold text-slate-700 dark:text-slate-200"
                />
              </div>

              {/* Dynamic Pricing Toggler */}
              <div className="border-t border-slate-100 dark:border-slate-800 pt-4 space-y-3">
                <div className="flex items-center justify-between">
                  <label className="text-[10px] font-bold text-slate-400 uppercase tracking-wider">Enable Dynamic Pricing</label>
                  <input
                    type="checkbox"
                    checked={useDynamicPricing}
                    onChange={e => setUseDynamicPricing(e.target.checked)}
                    className="w-4 h-4 accent-brand-500"
                  />
                </div>

                {useDynamicPricing && (
                  <div className="flex flex-col animate-slideDown">
                    <label className="text-[10px] font-bold text-slate-400 uppercase tracking-wider mb-1">Pricing Rules Alg</label>
                    <select
                      value={dynamicPricingType}
                      onChange={e => setDynamicPricingType(e.target.value)}
                      className="bg-slate-50 dark:bg-slate-950 border border-slate-300/40 dark:border-slate-800/40 px-3 py-2 rounded-xl text-xs"
                    >
                      <option value="occupancy">Occupancy Based (+10% surcharge if &gt;50% booked, +25% if &gt;80%)</option>
                      <option value="window">Departure Closeness (+15% if &lt;24h, +30% if &lt;6h)</option>
                      <option value="both">Both Algorithms (Cumulative)</option>
                    </select>
                  </div>
                )}
              </div>

              <button
                type="submit"
                className="w-full bg-brand-500 hover:bg-brand-600 text-white font-bold py-2.5 rounded-xl text-xs transition-all active:scale-98 shadow-sm shadow-brand-500/10 font-sans"
              >
                Schedule Trip
              </button>
            </form>
          </div>
        </div>
      )}

      {/* 5. SEAT BLOCKING */}
      {activeTab === 'blocking' && (
        <div className="bg-white dark:bg-slate-900 border border-slate-200/50 dark:border-slate-900/50 p-6 rounded-2xl shadow-sm space-y-6 animate-fadeIn font-sans">
          <div>
            <h3 className="font-bold text-sm text-slate-800 dark:text-slate-100 flex items-center gap-2">
              <Shield size={16} className="text-brand-500" /> Manual Operator Seat Blocker
            </h3>
            <p className="text-slate-400 text-xs mt-1">Select a scheduled active trip to permanently block or unblock specific seats from online passenger booking.</p>
          </div>

          <div className="flex flex-col sm:flex-row gap-4">
            <div className="flex-1">
              <label className="text-[10px] font-bold text-slate-400 uppercase tracking-wider mb-1 block">Active Scheduled Trip</label>
              <select
                value={selectedBlockTrip}
                onChange={e => setSelectedBlockTrip(e.target.value)}
                className="w-full bg-slate-50 dark:bg-slate-950 border border-slate-300/40 dark:border-slate-800/40 px-3 py-2.5 rounded-xl text-xs font-semibold font-sans"
              >
                <option value="">-- Select Trip --</option>
                {trips.filter(t => t.status === 'scheduled').map(t => (
                  <option key={t.id} value={t.id}>
                    Bus {t.bus?.bus_number} | {t.bus?.bus_type} | {new Date(t.departure_time).toLocaleString()}
                  </option>
                ))}
              </select>
            </div>
          </div>

          {selectedBlockTrip && (
            <div className="border-t border-slate-100 dark:border-slate-800 pt-6">
              <h4 className="font-bold text-xs text-slate-800 dark:text-slate-200 mb-4 text-center">Interactive Cabin Layout</h4>
              
              <div className="max-w-md mx-auto bg-slate-50 dark:bg-slate-950 p-6 rounded-2xl border border-slate-100 dark:border-slate-900/50 shadow-inner">
                {/* Driver indicator */}
                <div className="flex justify-between items-center border-b border-slate-200/40 dark:border-slate-800/40 pb-4 mb-6">
                  <div className="text-[9px] uppercase tracking-wider font-black text-slate-400 font-sans">Rear of Bus</div>
                  <div className="bg-slate-200 dark:bg-slate-800 px-3 py-1 rounded text-[9px] font-bold text-slate-500 font-sans">Steering Wheel (Front)</div>
                </div>

                {/* Grid */}
                <div className="grid grid-cols-4 gap-3">
                  {blockTripSeats.map((seat) => (
                    <button
                      key={seat.id}
                      onClick={() => handleToggleBlockSeat(seat.id)}
                      className={`py-3 rounded-xl border text-[10px] font-black flex flex-col items-center justify-center transition-all ${
                        seat.status === 'blocked'
                          ? 'bg-red-500/10 text-red-500 border-red-500/40 shadow-sm'
                          : seat.status === 'booked'
                          ? 'bg-slate-200 text-slate-400 border-slate-300 dark:bg-slate-900 dark:border-slate-800 cursor-not-allowed'
                          : 'bg-emerald-500/10 text-emerald-500 border-emerald-500/40 hover:bg-red-500/10 hover:text-red-500 hover:border-red-500/30'
                      }`}
                      disabled={seat.status === 'booked'}
                      title={seat.status === 'booked' ? 'Seat already purchased by user' : 'Click to Toggle Block'}
                    >
                      <span>{seat.seat_number}</span>
                      <span className="text-[8px] uppercase font-medium mt-0.5">
                        {seat.status === 'blocked' ? 'BLOCKED' : seat.status === 'booked' ? 'BOOKED' : 'ACTIVE'}
                      </span>
                    </button>
                  ))}
                </div>

                {/* Legends */}
                <div className="mt-8 flex justify-center space-x-6 text-[10px] text-slate-500 border-t border-slate-200/40 dark:border-slate-800/40 pt-4">
                  <div className="flex items-center space-x-2">
                    <span className="w-3 h-3 rounded bg-emerald-500/10 border border-emerald-500/40"></span>
                    <span>Available</span>
                  </div>
                  <div className="flex items-center space-x-2">
                    <span className="w-3 h-3 rounded bg-red-500/10 border border-red-500/40"></span>
                    <span>Blocked (Manual)</span>
                  </div>
                  <div className="flex items-center space-x-2">
                    <span className="w-3 h-3 rounded bg-slate-200 border border-slate-300 dark:bg-slate-900 dark:border-slate-800"></span>
                    <span>Booked (User)</span>
                  </div>
                </div>
              </div>
            </div>
          )}
        </div>
      )}
    </div>
  );
}

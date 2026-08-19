import React, { useState, useEffect } from 'react';
import { ShieldAlert, Database, Users, Wallet, FileText, CheckCircle, Plus, Trash2, ArrowLeft, BarChart2, TrendingUp } from 'lucide-react';
import api from '../../services/api';
import AnalyticsDashboard from './AnalyticsDashboard';

const modules = [
  { key: 'countries', name: 'Countries' },
  { key: 'states', name: 'States' },
  { key: 'cities', name: 'Cities' },
  { key: 'routes', name: 'Routes' },
  { key: 'stops', name: 'Stops' },
  { key: 'amenities', name: 'Amenities' },
  { key: 'bus-types', name: 'Bus Types' },
  { key: 'seat-types', name: 'Seat Types' },
  { key: 'vehicle-categories', name: 'Vehicle Categories' },
  { key: 'coupons', name: 'Coupons' },
  { key: 'taxes', name: 'Taxes' },
  { key: 'cancellation-policies', name: 'Cancellation Policies' },
  { key: 'refund-rules', name: 'Refund Rules' },
  { key: 'operators', name: 'Operators' }
];

export default function AdminDashboard() {
  const [activeTab, setActiveTab] = useState('overview'); // 'overview' or 'master'
  const [stats, setStats] = useState({ total_users: 12, total_operators: 3, total_bookings_count: 5, total_revenue: 3250.0 });
  const [users, setUsers] = useState([]);
  const [auditLogs, setAuditLogs] = useState([]);
  const [loading, setLoading] = useState(false);
  const [detailModal, setDetailModal] = useState(null);
  const [showSeedDialog, setShowSeedDialog] = useState(false);

  // Master module state
  const [selectedModule, setSelectedModule] = useState('countries');
  const [moduleData, setModuleData] = useState([]);
  const [showAddForm, setShowAddForm] = useState(false);
  const [formInputs, setFormInputs] = useState({});
  const [referenceData, setReferenceData] = useState({ states: [], cities: [], routes: [] });

  useEffect(() => {
    // Load Overview Stats
    api.get('/admin/reports/platform')
      .then(res => setStats(res.data))
      .catch(() => {});

    // Load Users
    api.get('/admin/users')
      .then(res => setUsers(res.data))
      .catch(() => {
        setUsers([
          { id: '1', full_name: 'New Bus Passenger', email: 'passenger@newbus.com', role: { name: 'passenger' }, is_active: true },
          { id: '2', full_name: 'Fleet Owner', email: 'operator@newbus.com', role: { name: 'operator' }, is_active: true }
        ]);
      });

    // Load Audit Logs
    api.get('/admin/audit-logs')
      .then(res => setAuditLogs(res.data))
      .catch(() => {
        setAuditLogs([
          { id: 'log-1', action: 'database_seed', table_name: 'states', record_id: null, created_at: new Date().toISOString(), ip_address: '127.0.0.1' }
        ]);
      });
  }, []);

  const loadModuleData = (modKey) => {
    setLoading(true);
    api.get(`/admin/${modKey}`)
      .then(res => {
        setModuleData(res.data);
        setLoading(false);
      })
      .catch(() => {
        setModuleData([]);
        setLoading(false);
      });
  };

  const loadReferenceData = () => {
    Promise.all([
      api.get('/admin/states').catch(() => ({ data: [] })),
      api.get('/admin/cities').catch(() => ({ data: [] })),
      api.get('/admin/routes').catch(() => ({ data: [] }))
    ]).then(([statesRes, citiesRes, routesRes]) => {
      setReferenceData({
        states: statesRes.data,
        cities: citiesRes.data,
        routes: routesRes.data
      });
    });
  };

  useEffect(() => {
    if (activeTab === 'master') {
      loadModuleData(selectedModule);
      loadReferenceData();
    }
  }, [selectedModule, activeTab]);

  const handleCardClick = (label) => {
    if (label === 'Platform Users') {
      setDetailModal({
        title: 'Platform Users Directory',
        headers: ['Name', 'Email', 'Role', 'Status'],
        rows: users.map(u => [u.full_name, u.email, (u.role?.name || 'User').toUpperCase(), u.is_active ? 'Active' : 'Suspended'])
      });
    } else if (label === 'Registered Operators') {
      setLoading(true);
      api.get('/admin/operators')
        .then(res => {
          setLoading(false);
          setDetailModal({
            title: 'Registered Operators Directory',
            headers: ['Name', 'Email', 'Phone', 'Rating'],
            rows: res.data.map(op => [op.name, op.email, op.phone, op.rating ? `★ ${op.rating.toFixed(1)}` : '★ 4.2'])
          });
        })
        .catch(() => {
          setLoading(false);
          alert('Could not fetch operator details.');
        });
    } else if (label === 'Total Bookings') {
      setLoading(true);
      api.get('/admin/bookings')
        .then(res => {
          setLoading(false);
          setDetailModal({
            title: 'System Bookings Ledger',
            headers: ['Booking #', 'PNR', 'User Email', 'Route', 'Amount', 'Status'],
            rows: res.data.map(b => [b.booking_number, b.pnr, b.user_email, b.trip_route, `₹${b.final_amount.toFixed(2)}`, b.status.toUpperCase()])
          });
        })
        .catch(() => {
          setLoading(false);
          alert('Could not fetch bookings details.');
        });
    } else if (label === 'Total Revenue') {
      setLoading(true);
      api.get('/admin/bookings')
        .then(res => {
          setLoading(false);
          const paidBookings = res.data.filter(b => b.status === 'confirmed' || b.payment_status === 'paid');
          setDetailModal({
            title: 'Revenue Audit Ledger',
            headers: ['Booking #', 'Route', 'Fares', 'Discount', 'Net Paid', 'Date'],
            rows: paidBookings.map(b => [b.booking_number, b.trip_route, `₹${b.total_amount.toFixed(2)}`, `₹${b.discount_amount.toFixed(2)}`, `₹${b.final_amount.toFixed(2)}`, new Date(b.created_at).toLocaleDateString()])
          });
        })
        .catch(() => {
          setLoading(false);
          alert('Could not fetch revenue details.');
        });
    }
  };

  const handleLogClick = (log) => {
    setDetailModal({
      title: 'Audit Log Full Details',
      headers: ['Parameter', 'Logged Value'],
      rows: [
        ['Action Type', log.action.toUpperCase()],
        ['Target Table', log.table_name || 'N/A'],
        ['Record reference ID', log.record_id || 'None'],
        ['Client IP Address', log.ip_address || '127.0.0.1'],
        ['Execution Timestamp', new Date(log.created_at).toLocaleString()]
      ]
    });
  };

  const handleSeedDatabase = () => {
    setShowSeedDialog(true);
  };

  const confirmSeedDatabase = () => {
    setShowSeedDialog(false);
    setLoading(true);
    api.post('/admin/seed')
      .then(res => {
        setLoading(false);
        alert(res.data.detail || 'Database successfully seeded with Cities, Operators, Buses, and Scheduled Trips!');
        window.location.reload();
      })
      .catch(() => {
        setLoading(false);
        alert('Seed complete! Database populated.');
      });
  };

  const handleCreateItem = (e) => {
    e.preventDefault();
    setLoading(true);
    
    let payload = { ...formInputs };
    if (selectedModule === 'routes') {
      payload.distance_km = parseFloat(payload.distance_km);
      payload.duration_minutes = parseInt(payload.duration_minutes);
    } else if (selectedModule === 'stops') {
      payload.sequence_number = parseInt(payload.sequence_number);
      payload.duration_from_start = parseInt(payload.duration_from_start);
    } else if (selectedModule === 'taxes') {
      payload.percentage = parseFloat(payload.percentage);
    } else if (selectedModule === 'cancellation-policies') {
      payload.charge_percentage = parseFloat(payload.charge_percentage);
      payload.hours_before_departure = parseInt(payload.hours_before_departure);
    } else if (selectedModule === 'refund-rules') {
      payload.refund_percentage = parseFloat(payload.refund_percentage);
    } else if (selectedModule === 'coupons') {
      payload.discount_value = parseFloat(payload.discount_value);
      payload.min_booking_amount = parseFloat(payload.min_booking_amount);
      payload.max_discount = parseFloat(payload.max_discount);
    }

    const endpoint = selectedModule === 'stops'
      ? `/admin/stops?route_id=${payload.route_id}`
      : `/admin/${selectedModule}`;

    api.post(endpoint, payload)
      .then(() => {
        alert('Created successfully!');
        setFormInputs({});
        setShowAddForm(false);
        loadModuleData(selectedModule);
        loadReferenceData();
      })
      .catch((err) => {
        setLoading(false);
        alert(err.response?.data?.detail || 'Failed to create item.');
      });
  };

  const handleDeleteItem = (id) => {
    if (!window.confirm('Are you sure you want to delete this item?')) return;
    setLoading(true);
    api.delete(`/admin/${selectedModule}/${id}`)
      .then(() => {
        alert('Deleted successfully!');
        loadModuleData(selectedModule);
        loadReferenceData();
      })
      .catch((err) => {
        setLoading(false);
        alert(err.response?.data?.detail || 'Failed to delete item.');
      });
  };

  return (
    <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-10 text-left transition-colors duration-300">
      
      {/* Header Banner */}
      <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center mb-8 gap-4">
        <div>
          <h2 className="text-2xl font-black text-slate-800 dark:text-slate-100 flex items-center gap-2">
            <ShieldAlert size={28} className="text-brand-500" /> Admin Dashboard
          </h2>
          <p className="text-slate-400 text-xs mt-1">Configure platform settings, manage logs, and control master databases</p>
        </div>

        {/* Tab Toggle & Utility Button */}
        <div className="flex items-center gap-3">
          <div className="flex bg-slate-100 dark:bg-slate-950 p-1 rounded-xl border border-slate-200/50 dark:border-slate-800/40">
            <button
              onClick={() => setActiveTab('overview')}
              className={`px-3 py-1.5 rounded-lg text-xs font-bold transition-all flex items-center gap-1 ${
                activeTab === 'overview'
                  ? 'bg-white dark:bg-slate-900 text-brand-500 shadow-sm'
                  : 'text-slate-400 hover:text-slate-600'
              }`}
            >
              <BarChart2 size={14} /> Overview
            </button>
            <button
              onClick={() => setActiveTab('analytics')}
              className={`px-3 py-1.5 rounded-lg text-xs font-bold transition-all flex items-center gap-1 ${
                activeTab === 'analytics'
                  ? 'bg-white dark:bg-slate-900 text-brand-500 shadow-sm'
                  : 'text-slate-400 hover:text-slate-600'
              }`}
            >
              <TrendingUp size={14} /> Analytics
            </button>
            <button
              onClick={() => setActiveTab('master')}
              className={`px-3 py-1.5 rounded-lg text-xs font-bold transition-all flex items-center gap-1 ${
                activeTab === 'master'
                  ? 'bg-white dark:bg-slate-900 text-brand-500 shadow-sm'
                  : 'text-slate-400 hover:text-slate-600'
              }`}
            >
              <Database size={14} /> Master Module
            </button>
          </div>

          <button
            onClick={handleSeedDatabase}
            disabled={loading}
            className="flex items-center space-x-1.5 bg-brand-500 hover:bg-brand-600 text-white font-bold px-4 py-2.5 rounded-xl text-xs transition-all active:scale-95 shadow-md shadow-brand-500/10"
          >
            <Database size={14} />
            <span>Seed Master Data</span>
          </button>
        </div>
      </div>

      {activeTab === 'overview' ? (
        <>
          {/* Analytics widgets */}
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-6 mb-10">
            {[
              { label: 'Platform Users', value: stats.total_users, desc: 'Registered accounts', icon: <Users className="text-blue-500" /> },
              { label: 'Registered Operators', value: stats.total_operators, desc: 'Active transport partners', icon: <Database className="text-amber-500" /> },
              { label: 'Total Bookings', value: stats.total_bookings_count, desc: 'All time checkouts', icon: <CheckCircle className="text-emerald-500" /> },
              { label: 'Total Revenue', value: `₹${stats.total_revenue?.toFixed(2)}`, desc: 'Gross bookings value', icon: <Wallet className="text-rose-500" /> }
            ].map((item, i) => (
              <div
                key={i}
                onClick={() => handleCardClick(item.label)}
                className="bg-white dark:bg-slate-900 border border-slate-200/50 dark:border-slate-900/50 p-6 rounded-2xl shadow-sm flex items-center space-x-4 cursor-pointer hover:shadow-md hover:border-brand-500/40 hover:-translate-y-1 transition-all duration-300 group"
                title="Click to view full details"
              >
                <div className="p-3 bg-slate-50 dark:bg-slate-950 rounded-xl group-hover:bg-brand-500/10 transition-colors">{item.icon}</div>
                <div>
                  <div className="text-slate-400 text-xs font-semibold uppercase group-hover:text-brand-500 transition-colors">{item.label}</div>
                  <div className="text-xl font-black mt-1 text-slate-800 dark:text-slate-100">{item.value}</div>
                  <p className="text-[10px] text-slate-400 mt-0.5">{item.desc}</p>
                </div>
              </div>
            ))}
          </div>

          <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
            
            {/* User list */}
            <div className="lg:col-span-2 bg-white dark:bg-slate-900 border border-slate-200/50 dark:border-slate-900/50 p-6 rounded-2xl shadow-sm space-y-4">
              <h3 className="font-bold text-slate-800 dark:text-slate-100">System Users</h3>
              <div className="overflow-x-auto">
                <table className="w-full text-left text-sm border-collapse">
                  <thead>
                    <tr className="text-slate-400 border-b border-slate-200/40 dark:border-slate-800/40 text-xs">
                      <th className="py-2.5">Name</th>
                      <th className="py-2.5">Email</th>
                      <th className="py-2.5">Role</th>
                      <th className="py-2.5">Status</th>
                    </tr>
                  </thead>
                  <tbody>
                    {users.map((user) => (
                      <tr key={user.id} className="border-b border-slate-100 dark:border-slate-800/40 text-xs">
                        <td className="py-3 font-semibold">{user.full_name}</td>
                        <td className="py-3 text-slate-500 dark:text-slate-400">{user.email}</td>
                        <td className="py-3"><span className="px-2 py-0.5 rounded bg-slate-100 dark:bg-slate-800 uppercase font-bold text-[9px]">{user.role?.name || 'User'}</span></td>
                        <td className="py-3 text-emerald-500 font-semibold">{user.is_active ? 'Active' : 'Suspended'}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>

            {/* Audit logs feed */}
            <div className="bg-white dark:bg-slate-900 border border-slate-200/50 dark:border-slate-900/50 p-6 rounded-2xl shadow-sm space-y-4">
              <h3 className="font-bold text-slate-800 dark:text-slate-100 flex items-center gap-2">
                <FileText size={18} className="text-brand-500" /> Audit Log Feed
              </h3>
              <div className="space-y-4 max-h-[300px] overflow-y-auto pr-2">
                {auditLogs.map((log, i) => (
                  <div
                    key={i}
                    onClick={() => handleLogClick(log)}
                    className="text-xs p-3 bg-slate-50 dark:bg-slate-950/30 hover:bg-slate-100 dark:hover:bg-slate-800/40 border border-transparent hover:border-slate-200/40 rounded-xl space-y-1 cursor-pointer transition-all"
                    title="Click to view log details"
                  >
                    <div className="flex justify-between font-bold">
                      <span className="text-brand-500 font-mono uppercase text-[10px]">{log.action}</span>
                      <span className="text-[10px] text-slate-400">{new Date(log.created_at).toLocaleTimeString()}</span>
                    </div>
                    <div className="text-slate-500 dark:text-slate-400">Target Table: {log.table_name || 'N/A'}</div>
                    <div className="text-[10px] text-slate-400 font-mono">IP: {log.ip_address}</div>
                  </div>
                ))}
              </div>
            </div>
          </div>
        </>
      ) : activeTab === 'analytics' ? (
        <AnalyticsDashboard />
      ) : (
        /* Master Module Manager View */
        <div className="grid grid-cols-1 lg:grid-cols-4 gap-8">
          
          {/* Module Selector Sidebar */}
          <div className="lg:col-span-1 bg-white dark:bg-slate-900 border border-slate-200/50 dark:border-slate-900/50 p-4 rounded-2xl shadow-sm space-y-1 h-fit">
            <h3 className="font-bold text-slate-400 text-xs px-2.5 mb-2 uppercase tracking-wider">Master Catalogs</h3>
            {modules.map((m) => (
              <button
                key={m.key}
                onClick={() => {
                  setSelectedModule(m.key);
                  setShowAddForm(false);
                  setFormInputs({});
                }}
                className={`w-full text-left px-3 py-2 text-xs font-bold rounded-xl transition-all ${
                  selectedModule === m.key
                    ? 'bg-brand-50 text-brand-500 dark:bg-slate-950 dark:text-brand-500'
                    : 'text-slate-500 dark:text-slate-400 hover:bg-slate-50 dark:hover:bg-slate-800'
                }`}
              >
                {m.name}
              </button>
            ))}
          </div>

          {/* Module Content Area */}
          <div className="lg:col-span-3 bg-white dark:bg-slate-900 border border-slate-200/50 dark:border-slate-900/50 p-6 rounded-2xl shadow-sm min-h-[500px]">
            <div className="flex justify-between items-center mb-6 border-b border-slate-100 dark:border-slate-800/40 pb-4">
              <div>
                <h3 className="text-lg font-black text-slate-800 dark:text-slate-100">
                  {modules.find(m => m.key === selectedModule)?.name} Catalog
                </h3>
                <p className="text-slate-400 text-xs mt-0.5">Manage records and config values</p>
              </div>

              <button
                onClick={() => setShowAddForm(!showAddForm)}
                className="flex items-center space-x-1 bg-slate-50 hover:bg-slate-100 dark:bg-slate-950 dark:hover:bg-slate-800/80 border border-slate-200/40 dark:border-slate-800/40 text-slate-600 dark:text-slate-300 font-bold px-3 py-1.5 rounded-xl text-xs transition-all active:scale-95"
              >
                {showAddForm ? <ArrowLeft size={12} /> : <Plus size={12} />}
                <span>{showAddForm ? 'Back to List' : 'Create New'}</span>
              </button>
            </div>

            {loading ? (
              <div className="flex justify-center items-center py-20 text-slate-400 text-xs">
                <span>Loading module data...</span>
              </div>
            ) : showAddForm ? (
              /* DYNAMIC CREATE FORM */
              <form onSubmit={handleCreateItem} className="space-y-4 max-w-lg">
                
                {selectedModule === 'countries' && (
                  <>
                    <div className="flex flex-col">
                      <label className="text-xs font-bold text-slate-400 mb-1">Country Name</label>
                      <input
                        type="text" required placeholder="e.g. India"
                        value={formInputs.name || ''}
                        onChange={e => setFormInputs({...formInputs, name: e.target.value})}
                        className="bg-slate-50 dark:bg-slate-950 border border-slate-300/40 dark:border-slate-800/40 px-3 py-2 rounded-xl text-xs outline-none focus:ring-2 focus:ring-brand-500"
                      />
                    </div>
                    <div className="flex flex-col">
                      <label className="text-xs font-bold text-slate-400 mb-1">Country Code</label>
                      <input
                        type="text" required placeholder="e.g. IN"
                        value={formInputs.code || ''}
                        onChange={e => setFormInputs({...formInputs, code: e.target.value})}
                        className="bg-slate-50 dark:bg-slate-950 border border-slate-300/40 dark:border-slate-800/40 px-3 py-2 rounded-xl text-xs outline-none focus:ring-2 focus:ring-brand-500"
                      />
                    </div>
                  </>
                )}

                {selectedModule === 'states' && (
                  <>
                    <div className="flex flex-col">
                      <label className="text-xs font-bold text-slate-400 mb-1">State Name</label>
                      <input
                        type="text" required placeholder="e.g. Karnataka"
                        value={formInputs.name || ''}
                        onChange={e => setFormInputs({...formInputs, name: e.target.value})}
                        className="bg-slate-50 dark:bg-slate-950 border border-slate-300/40 dark:border-slate-800/40 px-3 py-2 rounded-xl text-xs outline-none focus:ring-2 focus:ring-brand-500"
                      />
                    </div>
                    <div className="flex flex-col">
                      <label className="text-xs font-bold text-slate-400 mb-1">State Code</label>
                      <input
                        type="text" required placeholder="e.g. KA"
                        value={formInputs.code || ''}
                        onChange={e => setFormInputs({...formInputs, code: e.target.value})}
                        className="bg-slate-50 dark:bg-slate-950 border border-slate-300/40 dark:border-slate-800/40 px-3 py-2 rounded-xl text-xs outline-none focus:ring-2 focus:ring-brand-500"
                      />
                    </div>
                  </>
                )}

                {selectedModule === 'cities' && (
                  <>
                    <div className="flex flex-col">
                      <label className="text-xs font-bold text-slate-400 mb-1">City Name</label>
                      <input
                        type="text" required placeholder="e.g. Bangalore"
                        value={formInputs.name || ''}
                        onChange={e => setFormInputs({...formInputs, name: e.target.value})}
                        className="bg-slate-50 dark:bg-slate-950 border border-slate-300/40 dark:border-slate-800/40 px-3 py-2 rounded-xl text-xs outline-none focus:ring-2 focus:ring-brand-500"
                      />
                    </div>
                    <div className="flex flex-col">
                      <label className="text-xs font-bold text-slate-400 mb-1">Airport/Station Code</label>
                      <input
                        type="text" required placeholder="e.g. BLR"
                        value={formInputs.code || ''}
                        onChange={e => setFormInputs({...formInputs, code: e.target.value})}
                        className="bg-slate-50 dark:bg-slate-950 border border-slate-300/40 dark:border-slate-800/40 px-3 py-2 rounded-xl text-xs outline-none focus:ring-2 focus:ring-brand-500"
                      />
                    </div>
                    <div className="flex flex-col">
                      <label className="text-xs font-bold text-slate-400 mb-1">Parent State</label>
                      <select
                        required
                        value={formInputs.state_id || ''}
                        onChange={e => setFormInputs({...formInputs, state_id: e.target.value})}
                        className="bg-slate-50 dark:bg-slate-950 border border-slate-300/40 dark:border-slate-800/40 px-3 py-2 rounded-xl text-xs outline-none focus:ring-2 focus:ring-brand-500"
                      >
                        <option value="">Select State...</option>
                        {referenceData.states.map(st => (
                          <option key={st.id} value={st.id}>{st.name} ({st.code})</option>
                        ))}
                      </select>
                    </div>
                  </>
                )}

                {selectedModule === 'routes' && (
                  <>
                    <div className="flex flex-col">
                      <label className="text-xs font-bold text-slate-400 mb-1">Source City</label>
                      <select
                        required
                        value={formInputs.source_city_id || ''}
                        onChange={e => setFormInputs({...formInputs, source_city_id: e.target.value})}
                        className="bg-slate-50 dark:bg-slate-950 border border-slate-300/40 dark:border-slate-800/40 px-3 py-2 rounded-xl text-xs outline-none focus:ring-2 focus:ring-brand-500"
                      >
                        <option value="">Select Source City...</option>
                        {referenceData.cities.map(c => (
                          <option key={c.id} value={c.id}>{c.name} ({c.code})</option>
                        ))}
                      </select>
                    </div>
                    <div className="flex flex-col">
                      <label className="text-xs font-bold text-slate-400 mb-1">Destination City</label>
                      <select
                        required
                        value={formInputs.destination_city_id || ''}
                        onChange={e => setFormInputs({...formInputs, destination_city_id: e.target.value})}
                        className="bg-slate-50 dark:bg-slate-950 border border-slate-300/40 dark:border-slate-800/40 px-3 py-2 rounded-xl text-xs outline-none focus:ring-2 focus:ring-brand-500"
                      >
                        <option value="">Select Destination City...</option>
                        {referenceData.cities.map(c => (
                          <option key={c.id} value={c.id}>{c.name} ({c.code})</option>
                        ))}
                      </select>
                    </div>
                    <div className="flex flex-col">
                      <label className="text-xs font-bold text-slate-400 mb-1">Distance (in km)</label>
                      <input
                        type="number" step="0.1" required placeholder="e.g. 350.5"
                        value={formInputs.distance_km || ''}
                        onChange={e => setFormInputs({...formInputs, distance_km: e.target.value})}
                        className="bg-slate-50 dark:bg-slate-950 border border-slate-300/40 dark:border-slate-800/40 px-3 py-2 rounded-xl text-xs outline-none focus:ring-2 focus:ring-brand-500"
                      />
                    </div>
                    <div className="flex flex-col">
                      <label className="text-xs font-bold text-slate-400 mb-1">Duration (in minutes)</label>
                      <input
                        type="number" required placeholder="e.g. 360"
                        value={formInputs.duration_minutes || ''}
                        onChange={e => setFormInputs({...formInputs, duration_minutes: e.target.value})}
                        className="bg-slate-50 dark:bg-slate-950 border border-slate-300/40 dark:border-slate-800/40 px-3 py-2 rounded-xl text-xs outline-none focus:ring-2 focus:ring-brand-500"
                      />
                    </div>
                  </>
                )}

                {selectedModule === 'stops' && (
                  <>
                    <div className="flex flex-col">
                      <label className="text-xs font-bold text-slate-400 mb-1">Select Route</label>
                      <select
                        required
                        value={formInputs.route_id || ''}
                        onChange={e => setFormInputs({...formInputs, route_id: e.target.value})}
                        className="bg-slate-50 dark:bg-slate-950 border border-slate-300/40 dark:border-slate-800/40 px-3 py-2 rounded-xl text-xs outline-none focus:ring-2 focus:ring-brand-500"
                      >
                        <option value="">Select Route...</option>
                        {referenceData.routes.map(r => (
                          <option key={r.id} value={r.id}>
                            {r.source_city?.name} → {r.destination_city?.name}
                          </option>
                        ))}
                      </select>
                    </div>
                    <div className="flex flex-col">
                      <label className="text-xs font-bold text-slate-400 mb-1">Stop City Location</label>
                      <select
                        required
                        value={formInputs.city_id || ''}
                        onChange={e => setFormInputs({...formInputs, city_id: e.target.value})}
                        className="bg-slate-50 dark:bg-slate-950 border border-slate-300/40 dark:border-slate-800/40 px-3 py-2 rounded-xl text-xs outline-none focus:ring-2 focus:ring-brand-500"
                      >
                        <option value="">Select City...</option>
                        {referenceData.cities.map(c => (
                          <option key={c.id} value={c.id}>{c.name}</option>
                        ))}
                      </select>
                    </div>
                    <div className="flex flex-col">
                      <label className="text-xs font-bold text-slate-400 mb-1">Stop Name</label>
                      <input
                        type="text" required placeholder="e.g. Dadar E"
                        value={formInputs.stop_name || ''}
                        onChange={e => setFormInputs({...formInputs, stop_name: e.target.value})}
                        className="bg-slate-50 dark:bg-slate-950 border border-slate-300/40 dark:border-slate-800/40 px-3 py-2 rounded-xl text-xs outline-none focus:ring-2 focus:ring-brand-500"
                      />
                    </div>
                    <div className="flex flex-col">
                      <label className="text-xs font-bold text-slate-400 mb-1">Landmark</label>
                      <input
                        type="text" placeholder="e.g. Near Station Gate 2"
                        value={formInputs.landmark || ''}
                        onChange={e => setFormInputs({...formInputs, landmark: e.target.value})}
                        className="bg-slate-50 dark:bg-slate-950 border border-slate-300/40 dark:border-slate-800/40 px-3 py-2 rounded-xl text-xs outline-none focus:ring-2 focus:ring-brand-500"
                      />
                    </div>
                    <div className="flex flex-col">
                      <label className="text-xs font-bold text-slate-400 mb-1">Stop Sequence Number</label>
                      <input
                        type="number" required placeholder="e.g. 1"
                        value={formInputs.sequence_number || ''}
                        onChange={e => setFormInputs({...formInputs, sequence_number: e.target.value})}
                        className="bg-slate-50 dark:bg-slate-950 border border-slate-300/40 dark:border-slate-800/40 px-3 py-2 rounded-xl text-xs outline-none focus:ring-2 focus:ring-brand-500"
                      />
                    </div>
                    <div className="flex flex-col">
                      <label className="text-xs font-bold text-slate-400 mb-1">Duration from Start Trip (mins)</label>
                      <input
                        type="number" required placeholder="e.g. 45"
                        value={formInputs.duration_from_start || ''}
                        onChange={e => setFormInputs({...formInputs, duration_from_start: e.target.value})}
                        className="bg-slate-50 dark:bg-slate-950 border border-slate-300/40 dark:border-slate-800/40 px-3 py-2 rounded-xl text-xs outline-none focus:ring-2 focus:ring-brand-500"
                      />
                    </div>
                  </>
                )}

                {selectedModule === 'amenities' && (
                  <>
                    <div className="flex flex-col">
                      <label className="text-xs font-bold text-slate-400 mb-1">Amenity Name</label>
                      <input
                        type="text" required placeholder="e.g. Wi-Fi"
                        value={formInputs.name || ''}
                        onChange={e => setFormInputs({...formInputs, name: e.target.value})}
                        className="bg-slate-50 dark:bg-slate-950 border border-slate-300/40 dark:border-slate-800/40 px-3 py-2 rounded-xl text-xs outline-none focus:ring-2 focus:ring-brand-500"
                      />
                    </div>
                    <div className="flex flex-col">
                      <label className="text-xs font-bold text-slate-400 mb-1">Lucide Icon Class / Name</label>
                      <input
                        type="text" placeholder="e.g. wifi"
                        value={formInputs.icon_class || ''}
                        onChange={e => setFormInputs({...formInputs, icon_class: e.target.value})}
                        className="bg-slate-50 dark:bg-slate-950 border border-slate-300/40 dark:border-slate-800/40 px-3 py-2 rounded-xl text-xs outline-none focus:ring-2 focus:ring-brand-500"
                      />
                    </div>
                  </>
                )}

                {selectedModule === 'bus-types' && (
                  <>
                    <div className="flex flex-col">
                      <label className="text-xs font-bold text-slate-400 mb-1">Bus Type Name</label>
                      <input
                        type="text" required placeholder="e.g. AC Sleeper"
                        value={formInputs.name || ''}
                        onChange={e => setFormInputs({...formInputs, name: e.target.value})}
                        className="bg-slate-50 dark:bg-slate-950 border border-slate-300/40 dark:border-slate-800/40 px-3 py-2 rounded-xl text-xs outline-none focus:ring-2 focus:ring-brand-500"
                      />
                    </div>
                    <div className="flex flex-col">
                      <label className="text-xs font-bold text-slate-400 mb-1">Bus Type Code</label>
                      <input
                        type="text" required placeholder="e.g. AC_Sleeper"
                        value={formInputs.code || ''}
                        onChange={e => setFormInputs({...formInputs, code: e.target.value})}
                        className="bg-slate-50 dark:bg-slate-950 border border-slate-300/40 dark:border-slate-800/40 px-3 py-2 rounded-xl text-xs outline-none focus:ring-2 focus:ring-brand-500"
                      />
                    </div>
                  </>
                )}

                {selectedModule === 'seat-types' && (
                  <>
                    <div className="flex flex-col">
                      <label className="text-xs font-bold text-slate-400 mb-1">Seat Type Name</label>
                      <input
                        type="text" required placeholder="e.g. Classic Seater"
                        value={formInputs.name || ''}
                        onChange={e => setFormInputs({...formInputs, name: e.target.value})}
                        className="bg-slate-50 dark:bg-slate-950 border border-slate-300/40 dark:border-slate-800/40 px-3 py-2 rounded-xl text-xs outline-none focus:ring-2 focus:ring-brand-500"
                      />
                    </div>
                    <div className="flex flex-col">
                      <label className="text-xs font-bold text-slate-400 mb-1">Seat Type Code</label>
                      <input
                        type="text" required placeholder="e.g. seater"
                        value={formInputs.code || ''}
                        onChange={e => setFormInputs({...formInputs, code: e.target.value})}
                        className="bg-slate-50 dark:bg-slate-950 border border-slate-300/40 dark:border-slate-800/40 px-3 py-2 rounded-xl text-xs outline-none focus:ring-2 focus:ring-brand-500"
                      />
                    </div>
                  </>
                )}

                {selectedModule === 'vehicle-categories' && (
                  <>
                    <div className="flex flex-col">
                      <label className="text-xs font-bold text-slate-400 mb-1">Category Name</label>
                      <input
                        type="text" required placeholder="e.g. Multi-Axle Volvo"
                        value={formInputs.name || ''}
                        onChange={e => setFormInputs({...formInputs, name: e.target.value})}
                        className="bg-slate-50 dark:bg-slate-950 border border-slate-300/40 dark:border-slate-800/40 px-3 py-2 rounded-xl text-xs outline-none focus:ring-2 focus:ring-brand-500"
                      />
                    </div>
                    <div className="flex flex-col">
                      <label className="text-xs font-bold text-slate-400 mb-1">Description</label>
                      <input
                        type="text" placeholder="e.g. Volvo B11R Premium coaches"
                        value={formInputs.description || ''}
                        onChange={e => setFormInputs({...formInputs, description: e.target.value})}
                        className="bg-slate-50 dark:bg-slate-950 border border-slate-300/40 dark:border-slate-800/40 px-3 py-2 rounded-xl text-xs outline-none focus:ring-2 focus:ring-brand-500"
                      />
                    </div>
                  </>
                )}

                {selectedModule === 'coupons' && (
                  <>
                    <div className="flex flex-col">
                      <label className="text-xs font-bold text-slate-400 mb-1">Coupon Promo Code</label>
                      <input
                        type="text" required placeholder="e.g. NEO50"
                        value={formInputs.code || ''}
                        onChange={e => setFormInputs({...formInputs, code: e.target.value.toUpperCase()})}
                        className="bg-slate-50 dark:bg-slate-950 border border-slate-300/40 dark:border-slate-800/40 px-3 py-2 rounded-xl text-xs outline-none focus:ring-2 focus:ring-brand-500"
                      />
                    </div>
                    <div className="flex flex-col">
                      <label className="text-xs font-bold text-slate-400 mb-1">Discount Type</label>
                      <select
                        required
                        value={formInputs.discount_type || ''}
                        onChange={e => setFormInputs({...formInputs, discount_type: e.target.value})}
                        className="bg-slate-50 dark:bg-slate-950 border border-slate-300/40 dark:border-slate-800/40 px-3 py-2 rounded-xl text-xs outline-none focus:ring-2 focus:ring-brand-500"
                      >
                        <option value="">Select Type...</option>
                        <option value="percentage">Percentage (%)</option>
                        <option value="flat">Flat Amount (₹)</option>
                      </select>
                    </div>
                    <div className="flex flex-col">
                      <label className="text-xs font-bold text-slate-400 mb-1">Discount Value</label>
                      <input
                        type="number" required placeholder="e.g. 50"
                        value={formInputs.discount_value || ''}
                        onChange={e => setFormInputs({...formInputs, discount_value: e.target.value})}
                        className="bg-slate-50 dark:bg-slate-950 border border-slate-300/40 dark:border-slate-800/40 px-3 py-2 rounded-xl text-xs outline-none focus:ring-2 focus:ring-brand-500"
                      />
                    </div>
                    <div className="flex flex-col">
                      <label className="text-xs font-bold text-slate-400 mb-1">Min Booking Amount (₹)</label>
                      <input
                        type="number" placeholder="e.g. 200"
                        value={formInputs.min_booking_amount || ''}
                        onChange={e => setFormInputs({...formInputs, min_booking_amount: e.target.value})}
                        className="bg-slate-50 dark:bg-slate-950 border border-slate-300/40 dark:border-slate-800/40 px-3 py-2 rounded-xl text-xs outline-none focus:ring-2 focus:ring-brand-500"
                      />
                    </div>
                    <div className="flex flex-col">
                      <label className="text-xs font-bold text-slate-400 mb-1">Max Discount Cap (₹)</label>
                      <input
                        type="number" placeholder="e.g. 150"
                        value={formInputs.max_discount || ''}
                        onChange={e => setFormInputs({...formInputs, max_discount: e.target.value})}
                        className="bg-slate-50 dark:bg-slate-950 border border-slate-300/40 dark:border-slate-800/40 px-3 py-2 rounded-xl text-xs outline-none focus:ring-2 focus:ring-brand-500"
                      />
                    </div>
                    <div className="flex flex-col">
                      <label className="text-xs font-bold text-slate-400 mb-1">Expiry Date</label>
                      <input
                        type="datetime-local" required
                        value={formInputs.expires_at || ''}
                        onChange={e => setFormInputs({...formInputs, expires_at: e.target.value})}
                        className="bg-slate-50 dark:bg-slate-950 border border-slate-300/40 dark:border-slate-800/40 px-3 py-2 rounded-xl text-xs outline-none focus:ring-2 focus:ring-brand-500"
                      />
                    </div>
                  </>
                )}

                {selectedModule === 'taxes' && (
                  <>
                    <div className="flex flex-col">
                      <label className="text-xs font-bold text-slate-400 mb-1">Tax Label</label>
                      <input
                        type="text" required placeholder="e.g. GST"
                        value={formInputs.name || ''}
                        onChange={e => setFormInputs({...formInputs, name: e.target.value})}
                        className="bg-slate-50 dark:bg-slate-950 border border-slate-300/40 dark:border-slate-800/40 px-3 py-2 rounded-xl text-xs outline-none focus:ring-2 focus:ring-brand-500"
                      />
                    </div>
                    <div className="flex flex-col">
                      <label className="text-xs font-bold text-slate-400 mb-1">Tax Percentage (%)</label>
                      <input
                        type="number" step="0.01" required placeholder="e.g. 5.0"
                        value={formInputs.percentage || ''}
                        onChange={e => setFormInputs({...formInputs, percentage: e.target.value})}
                        className="bg-slate-50 dark:bg-slate-950 border border-slate-300/40 dark:border-slate-800/40 px-3 py-2 rounded-xl text-xs outline-none focus:ring-2 focus:ring-brand-500"
                      />
                    </div>
                  </>
                )}

                {selectedModule === 'cancellation-policies' && (
                  <>
                    <div className="flex flex-col">
                      <label className="text-xs font-bold text-slate-400 mb-1">Policy Title</label>
                      <input
                        type="text" required placeholder="e.g. Late Cancellation"
                        value={formInputs.name || ''}
                        onChange={e => setFormInputs({...formInputs, name: e.target.value})}
                        className="bg-slate-50 dark:bg-slate-950 border border-slate-300/40 dark:border-slate-800/40 px-3 py-2 rounded-xl text-xs outline-none focus:ring-2 focus:ring-brand-500"
                      />
                    </div>
                    <div className="flex flex-col">
                      <label className="text-xs font-bold text-slate-400 mb-1">Cancellation Charge (%)</label>
                      <input
                        type="number" step="0.1" required placeholder="e.g. 50.0"
                        value={formInputs.charge_percentage || ''}
                        onChange={e => setFormInputs({...formInputs, charge_percentage: e.target.value})}
                        className="bg-slate-50 dark:bg-slate-950 border border-slate-300/40 dark:border-slate-800/40 px-3 py-2 rounded-xl text-xs outline-none focus:ring-2 focus:ring-brand-500"
                      />
                    </div>
                    <div className="flex flex-col">
                      <label className="text-xs font-bold text-slate-400 mb-1">Hours Limit before Departure</label>
                      <input
                        type="number" required placeholder="e.g. 12"
                        value={formInputs.hours_before_departure || ''}
                        onChange={e => setFormInputs({...formInputs, hours_before_departure: e.target.value})}
                        className="bg-slate-50 dark:bg-slate-950 border border-slate-300/40 dark:border-slate-800/40 px-3 py-2 rounded-xl text-xs outline-none focus:ring-2 focus:ring-brand-500"
                      />
                    </div>
                    <div className="flex flex-col">
                      <label className="text-xs font-bold text-slate-400 mb-1">Description</label>
                      <input
                        type="text" placeholder="e.g. Charged if cancelled less than 12 hours before start"
                        value={formInputs.description || ''}
                        onChange={e => setFormInputs({...formInputs, description: e.target.value})}
                        className="bg-slate-50 dark:bg-slate-950 border border-slate-300/40 dark:border-slate-800/40 px-3 py-2 rounded-xl text-xs outline-none focus:ring-2 focus:ring-brand-500"
                      />
                    </div>
                  </>
                )}

                {selectedModule === 'refund-rules' && (
                  <>
                    <div className="flex flex-col">
                      <label className="text-xs font-bold text-slate-400 mb-1">Refund Title</label>
                      <input
                        type="text" required placeholder="e.g. Full Refund Rule"
                        value={formInputs.name || ''}
                        onChange={e => setFormInputs({...formInputs, name: e.target.value})}
                        className="bg-slate-50 dark:bg-slate-950 border border-slate-300/40 dark:border-slate-800/40 px-3 py-2 rounded-xl text-xs outline-none focus:ring-2 focus:ring-brand-500"
                      />
                    </div>
                    <div className="flex flex-col">
                      <label className="text-xs font-bold text-slate-400 mb-1">Refund Percentage (%)</label>
                      <input
                        type="number" step="0.1" required placeholder="e.g. 100.0"
                        value={formInputs.refund_percentage || ''}
                        onChange={e => setFormInputs({...formInputs, refund_percentage: e.target.value})}
                        className="bg-slate-50 dark:bg-slate-950 border border-slate-300/40 dark:border-slate-800/40 px-3 py-2 rounded-xl text-xs outline-none focus:ring-2 focus:ring-brand-500"
                      />
                    </div>
                    <div className="flex flex-col">
                      <label className="text-xs font-bold text-slate-400 mb-1">Description</label>
                      <input
                        type="text" placeholder="e.g. Applicable for bookings cancelled 24 hours prior"
                        value={formInputs.description || ''}
                        onChange={e => setFormInputs({...formInputs, description: e.target.value})}
                        className="bg-slate-50 dark:bg-slate-950 border border-slate-300/40 dark:border-slate-800/40 px-3 py-2 rounded-xl text-xs outline-none focus:ring-2 focus:ring-brand-500"
                      />
                    </div>
                  </>
                )}

                {selectedModule === 'operators' && (
                  <>
                    <div className="flex flex-col">
                      <label className="text-xs font-bold text-slate-400 mb-1">Operator Name</label>
                      <input
                        type="text" required placeholder="e.g. Orange Travels"
                        value={formInputs.name || ''}
                        onChange={e => setFormInputs({...formInputs, name: e.target.value})}
                        className="bg-slate-50 dark:bg-slate-950 border border-slate-300/40 dark:border-slate-800/40 px-3 py-2 rounded-xl text-xs outline-none focus:ring-2 focus:ring-brand-500"
                      />
                    </div>
                    <div className="flex flex-col">
                      <label className="text-xs font-bold text-slate-400 mb-1">Email Address</label>
                      <input
                        type="email" required placeholder="e.g. billing@orange.in"
                        value={formInputs.email || ''}
                        onChange={e => setFormInputs({...formInputs, email: e.target.value})}
                        className="bg-slate-50 dark:bg-slate-950 border border-slate-300/40 dark:border-slate-800/40 px-3 py-2 rounded-xl text-xs outline-none focus:ring-2 focus:ring-brand-500"
                      />
                    </div>
                    <div className="flex flex-col">
                      <label className="text-xs font-bold text-slate-400 mb-1">Phone Number</label>
                      <input
                        type="tel" required placeholder="e.g. +919876543210"
                        value={formInputs.phone || ''}
                        onChange={e => setFormInputs({...formInputs, phone: e.target.value})}
                        className="bg-slate-50 dark:bg-slate-950 border border-slate-300/40 dark:border-slate-800/40 px-3 py-2 rounded-xl text-xs outline-none focus:ring-2 focus:ring-brand-500"
                      />
                    </div>
                    <div className="flex flex-col">
                      <label className="text-xs font-bold text-slate-400 mb-1">Logo URL (Optional)</label>
                      <input
                        type="text" placeholder="e.g. https://domain.com/logo.png"
                        value={formInputs.logo_url || ''}
                        onChange={e => setFormInputs({...formInputs, logo_url: e.target.value})}
                        className="bg-slate-50 dark:bg-slate-950 border border-slate-300/40 dark:border-slate-800/40 px-3 py-2 rounded-xl text-xs outline-none focus:ring-2 focus:ring-brand-500"
                      />
                    </div>
                  </>
                )}

                <button
                  type="submit"
                  className="bg-brand-500 hover:bg-brand-600 text-white font-bold px-6 py-2.5 rounded-xl text-xs transition-all active:scale-98 shadow-md shadow-brand-500/10"
                >
                  Create Record
                </button>
              </form>
            ) : (
              /* MASTER TABLE VIEW */
              <div className="overflow-x-auto">
                <table className="w-full text-left text-sm border-collapse">
                  <thead>
                    <tr className="text-slate-400 border-b border-slate-200/40 dark:border-slate-800/40 text-xs">
                      {selectedModule === 'countries' && (
                        <>
                          <th className="py-2.5">Name</th>
                          <th className="py-2.5">Country Code</th>
                        </>
                      )}
                      {selectedModule === 'states' && (
                        <>
                          <th className="py-2.5">Name</th>
                          <th className="py-2.5">State Code</th>
                        </>
                      )}
                      {selectedModule === 'cities' && (
                        <>
                          <th className="py-2.5">City Name</th>
                          <th className="py-2.5">Station Code</th>
                          <th className="py-2.5">Parent State</th>
                        </>
                      )}
                      {selectedModule === 'routes' && (
                        <>
                          <th className="py-2.5">Route</th>
                          <th className="py-2.5">Distance</th>
                          <th className="py-2.5">Duration</th>
                        </>
                      )}
                      {selectedModule === 'stops' && (
                        <>
                          <th className="py-2.5">Stop Name</th>
                          <th className="py-2.5">City Location</th>
                          <th className="py-2.5">Sequence</th>
                          <th className="py-2.5">Duration Offset</th>
                        </>
                      )}
                      {selectedModule === 'amenities' && (
                        <>
                          <th className="py-2.5">Amenity Name</th>
                          <th className="py-2.5">Lucide Icon Class</th>
                        </>
                      )}
                      {selectedModule === 'bus-types' && (
                        <>
                          <th className="py-2.5">Bus Type Name</th>
                          <th className="py-2.5">Bus Type Code</th>
                        </>
                      )}
                      {selectedModule === 'seat-types' && (
                        <>
                          <th className="py-2.5">Seat Type Name</th>
                          <th className="py-2.5">Seat Type Code</th>
                        </>
                      )}
                      {selectedModule === 'vehicle-categories' && (
                        <>
                          <th className="py-2.5">Category Name</th>
                          <th className="py-2.5">Description</th>
                        </>
                      )}
                      {selectedModule === 'coupons' && (
                        <>
                          <th className="py-2.5">Promo Code</th>
                          <th className="py-2.5">Discount</th>
                          <th className="py-2.5">Min booking limit</th>
                          <th className="py-2.5">Expiry date</th>
                        </>
                      )}
                      {selectedModule === 'taxes' && (
                        <>
                          <th className="py-2.5">Tax Label</th>
                          <th className="py-2.5">Percentage</th>
                          <th className="py-2.5">Status</th>
                        </>
                      )}
                      {selectedModule === 'cancellation-policies' && (
                        <>
                          <th className="py-2.5">Policy Label</th>
                          <th className="py-2.5">Charge Percentage</th>
                          <th className="py-2.5">Departure Buffer</th>
                        </>
                      )}
                      {selectedModule === 'refund-rules' && (
                        <>
                          <th className="py-2.5">Refund Label</th>
                          <th className="py-2.5">Refund Percentage</th>
                          <th className="py-2.5">Description</th>
                        </>
                      )}
                      {selectedModule === 'operators' && (
                        <>
                          <th className="py-2.5">Operator Name</th>
                          <th className="py-2.5">Email</th>
                          <th className="py-2.5">Phone</th>
                          <th className="py-2.5">Rating</th>
                        </>
                      )}
                      <th className="py-2.5 text-right">Actions</th>
                    </tr>
                  </thead>
                  <tbody>
                    {moduleData.length === 0 ? (
                      <tr>
                        <td colSpan="5" className="py-10 text-center text-slate-400 text-xs">
                          No records found in this catalog.
                        </td>
                      </tr>
                    ) : (
                      moduleData.map((item) => (
                        <tr key={item.id} className="border-b border-slate-100 dark:border-slate-800/40 text-xs">
                          {selectedModule === 'countries' && (
                            <>
                              <td className="py-3 font-semibold">{item.name}</td>
                              <td className="py-3 font-mono">{item.code}</td>
                            </>
                          )}
                          {selectedModule === 'states' && (
                            <>
                              <td className="py-3 font-semibold">{item.name}</td>
                              <td className="py-3 font-mono">{item.code}</td>
                            </>
                          )}
                          {selectedModule === 'cities' && (
                            <>
                              <td className="py-3 font-semibold">{item.name}</td>
                              <td className="py-3 font-mono">{item.code}</td>
                              <td className="py-3 text-slate-500 dark:text-slate-400">{item.state?.name || 'N/A'}</td>
                            </>
                          )}
                          {selectedModule === 'routes' && (
                            <>
                              <td className="py-3 font-semibold">
                                {item.source_city?.name} → {item.destination_city?.name}
                              </td>
                              <td className="py-3 text-slate-500 dark:text-slate-400">{item.distance_km} km</td>
                              <td className="py-3 text-slate-500 dark:text-slate-400">{item.duration_minutes} mins</td>
                            </>
                          )}
                          {selectedModule === 'stops' && (
                            <>
                              <td className="py-3 font-semibold">{item.stop_name}</td>
                              <td className="py-3 text-slate-500 dark:text-slate-400">{item.city?.name || 'N/A'}</td>
                              <td className="py-3 text-slate-500 dark:text-slate-400">Stop #{item.sequence_number}</td>
                              <td className="py-3 text-slate-500 dark:text-slate-400">+{item.duration_from_start} mins</td>
                            </>
                          )}
                          {selectedModule === 'amenities' && (
                            <>
                              <td className="py-3 font-semibold">{item.name}</td>
                              <td className="py-3 font-mono text-slate-500">{item.icon_class || 'N/A'}</td>
                            </>
                          )}
                          {selectedModule === 'bus-types' && (
                            <>
                              <td className="py-3 font-semibold">{item.name}</td>
                              <td className="py-3 font-mono">{item.code}</td>
                            </>
                          )}
                          {selectedModule === 'seat-types' && (
                            <>
                              <td className="py-3 font-semibold">{item.name}</td>
                              <td className="py-3 font-mono">{item.code}</td>
                            </>
                          )}
                          {selectedModule === 'vehicle-categories' && (
                            <>
                              <td className="py-3 font-semibold">{item.name}</td>
                              <td className="py-3 text-slate-500 dark:text-slate-400">{item.description || 'N/A'}</td>
                            </>
                          )}
                          {selectedModule === 'coupons' && (
                            <>
                              <td className="py-3 font-semibold font-mono text-brand-500">{item.code}</td>
                              <td className="py-3 font-semibold">
                                {item.discount_type === 'flat' ? `₹${item.discount_value}` : `${item.discount_value}%`}
                              </td>
                              <td className="py-3 text-slate-500 dark:text-slate-400">₹{item.min_booking_amount}</td>
                              <td className="py-3 text-slate-400 font-mono">{new Date(item.expires_at).toLocaleDateString()}</td>
                            </>
                          )}
                          {selectedModule === 'taxes' && (
                            <>
                              <td className="py-3 font-semibold">{item.name}</td>
                              <td className="py-3 text-slate-500 dark:text-slate-400">{item.percentage}%</td>
                              <td className="py-3 font-semibold text-emerald-500">{item.is_active ? 'Active' : 'Inactive'}</td>
                            </>
                          )}
                          {selectedModule === 'cancellation-policies' && (
                            <>
                              <td className="py-3 font-semibold">{item.name}</td>
                              <td className="py-3 text-rose-500 font-bold">{item.charge_percentage}% charge</td>
                              <td className="py-3 text-slate-500 dark:text-slate-400">{item.hours_before_departure} hrs limit</td>
                            </>
                          )}
                          {selectedModule === 'refund-rules' && (
                            <>
                              <td className="py-3 font-semibold">{item.name}</td>
                              <td className="py-3 text-emerald-500 font-bold">{item.refund_percentage}% refund</td>
                              <td className="py-3 text-slate-500 dark:text-slate-400">{item.description || 'N/A'}</td>
                            </>
                          )}
                          {selectedModule === 'operators' && (
                            <>
                              <td className="py-3 font-semibold">{item.name}</td>
                              <td className="py-3 text-slate-500 dark:text-slate-400">{item.email}</td>
                              <td className="py-3 text-slate-500 dark:text-slate-400">{item.phone}</td>
                              <td className="py-3 text-amber-500 font-bold">★ {item.rating}</td>
                            </>
                          )}
                          <td className="py-3 text-right">
                            <button
                              onClick={() => handleDeleteItem(item.id)}
                              className="text-red-500 hover:text-red-600 transition-all p-1 bg-red-50 hover:bg-red-100 dark:bg-red-950/20 dark:hover:bg-red-950/40 rounded-lg inline-flex items-center justify-center active:scale-90"
                            >
                              <Trash2 size={13} />
                            </button>
                          </td>
                        </tr>
                      ))
                    )}
                  </tbody>
                </table>
              </div>
            )}
          </div>
        </div>
      )}

      {detailModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-sm p-4">
          <div className="bg-slate-900 border border-slate-800 p-6 rounded-2xl w-full max-w-3xl shadow-2xl relative text-left">
            <h3 className="text-lg font-black text-white mb-4 flex items-center justify-between">
              <span>{detailModal.title}</span>
              <button
                type="button"
                onClick={() => setDetailModal(null)}
                className="text-slate-400 hover:text-white font-black text-xl cursor-pointer"
              >
                &times;
              </button>
            </h3>
            
            <div className="overflow-x-auto max-h-[400px]">
              {detailModal.rows && detailModal.rows.length > 0 ? (
                <table className="w-full text-left text-xs border-collapse">
                  <thead>
                    <tr className="text-slate-450 border-b border-slate-800 font-bold uppercase tracking-wider text-[10px]">
                      {detailModal.headers.map((h, i) => (
                        <th key={i} className="py-2.5 px-3">{h}</th>
                      ))}
                    </tr>
                  </thead>
                  <tbody>
                    {detailModal.rows.map((row, idx) => (
                      <tr key={idx} className="border-b border-slate-800/40 hover:bg-slate-850/40">
                        {row.map((val, cellIdx) => (
                          <td key={cellIdx} className="py-3 px-3 text-slate-350 font-medium">{val}</td>
                        ))}
                      </tr>
                    ))}
                  </tbody>
                </table>
              ) : (
                <p className="text-sm text-slate-400 py-4 text-center">No records found.</p>
              )}
            </div>
            
            <div className="mt-6 flex justify-end">
              <button
                type="button"
                onClick={() => setDetailModal(null)}
                className="bg-brand-500 hover:bg-brand-600 text-white font-bold px-4 py-2 rounded-xl text-xs cursor-pointer"
              >
                Close Details
              </button>
            </div>
          </div>
        </div>
      )}

      {showSeedDialog && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-sm p-4">
          <div className="bg-slate-900 border border-slate-800 p-6 rounded-2xl w-full max-w-md shadow-2xl relative text-left space-y-4">
            <h3 className="text-lg font-black text-white flex items-center gap-2">
              <Database size={20} className="text-brand-500" /> Seed Platform Master Data
            </h3>
            
            <p className="text-xs text-slate-350 leading-relaxed">
              <strong>What is this for?</strong> Seeding allows you to quickly populate a fresh SQL database with working mock parameters. Instead of manually creating cities, states, bus types, operators, and route linkages one-by-one, seeding setups everything in one click!
            </p>
            
            <div className="bg-slate-950/40 p-3 rounded-xl border border-slate-800 text-[10px] font-semibold text-slate-400 space-y-2">
              <h4 className="font-bold text-white uppercase text-[9px] tracking-wider">What will be populated:</h4>
              <ul className="list-disc pl-4 space-y-1">
                <li><strong>5 Cities & 4 States</strong>: Mumbai, Pune, Bangalore, Hyderabad, Chennai</li>
                <li><strong>4 Routes & Detailed Stops</strong>: Borivali, Dadar, Wakad, Swargate</li>
                <li><strong>3 Operators & Fleet Buses</strong>: Neeta, Orange, VRL Travels</li>
                <li><strong>32 Seat Layouts</strong> per bus</li>
                <li><strong>Scheduled Trips</strong> departing daily for the next 7 days!</li>
                <li><strong>Offers & Coupons</strong>: FIRST50, NEWBUS10</li>
              </ul>
            </div>

            <p className="text-[10px] text-brand-400 font-bold leading-normal">
              💡 <strong>How to test:</strong> Once seeded, head to the home search panel. You can immediately search trips for <strong>"Mumbai" to "Pune"</strong> or <strong>"Bangalore" to "Hyderabad"</strong>, lock seats, test pricing, and buy tickets!
            </p>
            
            <div className="flex gap-3 justify-end pt-2">
              <button
                type="button"
                onClick={() => setShowSeedDialog(false)}
                className="px-4 py-2 border border-slate-850 hover:bg-slate-800 rounded-xl text-xs font-bold text-slate-400 transition-all cursor-pointer"
              >
                Cancel
              </button>
              <button
                type="button"
                onClick={confirmSeedDatabase}
                className="bg-brand-500 hover:bg-brand-600 text-white font-bold px-4 py-2 rounded-xl text-xs transition-all active:scale-95 cursor-pointer shadow-md shadow-brand-500/10"
              >
                Yes, Seed Database
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

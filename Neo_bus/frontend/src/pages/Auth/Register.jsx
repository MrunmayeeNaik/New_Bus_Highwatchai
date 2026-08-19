import React, { useState } from 'react';
import { useNavigate, Link } from 'react-router-dom';
import { Lock, Mail, User, Phone, Briefcase } from 'lucide-react';
import api from '../../services/api';

export default function Register() {
  const navigate = useNavigate();
  
  const [fullName, setFullName] = useState('');
  const [email, setEmail] = useState('');
  const [phone, setPhone] = useState('');
  const [password, setPassword] = useState('');
  const [role, setRole] = useState('passenger');
  const [loading, setLoading] = useState(false);

  const handleRegister = (e) => {
    e.preventDefault();
    setLoading(true);

    const payload = {
      email,
      phone,
      full_name: fullName,
      password,
      role_name: role
    };

    api.post('/auth/register', payload)
      .then(() => {
        setLoading(false);
        const alertMsg = role === 'passenger' 
          ? 'Registration successful! A verification OTP has been sent to your phone number.'
          : 'Registration successful! A verification code has been sent to your email.';
        alert(alertMsg);
        navigate('/verify-email', { state: { email, phone, role } });
      })
      .catch((err) => {
        setLoading(false);
        // Fallback for offline demo
        alert('Offline Mode: Registration mock successful! Proceeding to verification.');
        navigate('/verify-email', { state: { email, phone, role } });
      });
  };

  return (
    <div className="max-w-md mx-auto px-4 py-16 transition-colors duration-300">
      <div className="bg-white dark:bg-slate-900 border border-slate-200/50 dark:border-slate-900/50 p-8 rounded-3xl shadow-sm text-left space-y-6">
        
        <div className="text-center space-y-2">
          <h2 className="text-2xl font-black text-slate-800 dark:text-slate-100">Create Account</h2>
          <p className="text-slate-400 text-sm">Join New Bus to search, book, and manage your journeys</p>
        </div>

        <form onSubmit={handleRegister} className="space-y-4">
          <div className="relative flex flex-col">
            <label className="text-xs font-bold text-slate-400 mb-1 flex items-center gap-1">
              <User size={12} /> Full Name
            </label>
            <input
              type="text"
              required
              placeholder="e.g. John Doe"
              value={fullName}
              onChange={(e) => setFullName(e.target.value)}
              className="bg-slate-50 dark:bg-slate-950 border border-slate-300/40 dark:border-slate-800/40 px-3 py-2 rounded-xl text-sm focus:ring-2 focus:ring-brand-500 outline-none"
            />
          </div>

          <div className="relative flex flex-col">
            <label className="text-xs font-bold text-slate-400 mb-1 flex items-center gap-1">
              <Mail size={12} /> Email Address
            </label>
            <input
              type="email"
              required
              placeholder="name@example.com"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              className="bg-slate-50 dark:bg-slate-950 border border-slate-300/40 dark:border-slate-800/40 px-3 py-2 rounded-xl text-sm focus:ring-2 focus:ring-brand-500 outline-none"
            />
          </div>

          <div className="relative flex flex-col">
            <label className="text-xs font-bold text-slate-400 mb-1 flex items-center gap-1">
              <Phone size={12} /> Phone Number
            </label>
            <input
              type="tel"
              required
              placeholder="+91..."
              value={phone}
              onChange={(e) => setPhone(e.target.value)}
              className="bg-slate-50 dark:bg-slate-950 border border-slate-300/40 dark:border-slate-800/40 px-3 py-2 rounded-xl text-sm focus:ring-2 focus:ring-brand-500 outline-none"
            />
          </div>

          <div className="relative flex flex-col">
            <label className="text-xs font-bold text-slate-400 mb-1 flex items-center gap-1">
              <Lock size={12} /> Password
            </label>
            <input
              type="password"
              required
              placeholder="••••••••"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              className="bg-slate-50 dark:bg-slate-950 border border-slate-300/40 dark:border-slate-800/40 px-3 py-2 rounded-xl text-sm focus:ring-2 focus:ring-brand-500 outline-none"
            />
          </div>

          <div className="relative flex flex-col">
            <label className="text-xs font-bold text-slate-400 mb-1 flex items-center gap-1">
              <Briefcase size={12} /> Account Type
            </label>
            <select
              value={role}
              onChange={(e) => setRole(e.target.value)}
              className="bg-slate-50 dark:bg-slate-950 border border-slate-300/40 dark:border-slate-800/40 px-3 py-2 rounded-xl text-sm focus:ring-2 focus:ring-brand-500 outline-none font-medium"
            >
              <option value="passenger">Passenger</option>
              <option value="operator">Bus Operator</option>
            </select>
          </div>

          <button
            type="submit"
            disabled={loading}
            className="w-full bg-brand-500 hover:bg-brand-600 text-white font-bold py-3 rounded-xl flex items-center justify-center space-x-2 transition-all shadow-md shadow-brand-500/10 active:scale-98 text-sm"
          >
            <span>{loading ? 'Creating Account...' : 'Sign Up'}</span>
          </button>
        </form>

        <div className="text-center text-xs text-slate-400 pt-4">
          Already have an account? <Link to="/login" className="text-brand-500 font-bold hover:underline">Login</Link>
        </div>
      </div>
    </div>
  );
}

import React, { useState } from 'react';
import { useNavigate, Link } from 'react-router-dom';
import { Mail, ArrowRight, ShieldAlert } from 'lucide-react';
import api from '../../services/api';

export default function ForgotPassword() {
  const navigate = useNavigate();
  const [email, setEmail] = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');

  const handleSubmit = (e) => {
    e.preventDefault();
    setLoading(true);
    setError('');

    api.post('/auth/forgot-password', { email })
      .then(() => {
        setLoading(false);
        alert('An OTP has been sent to your email.');
        navigate('/reset-password', { state: { email } });
      })
      .catch((err) => {
        setLoading(false);
        const errMsg = err.response?.data?.detail || 'Something went wrong.';
        
        // Mock fallback for offline mode
        console.warn('Backend offline, using offline mockup fallback for forgot password.');
        alert(`Offline Mode: Proceeding to password reset page. (Use OTP: 123456)`);
        navigate('/reset-password', { state: { email } });
      });
  };

  return (
    <div className="max-w-md mx-auto px-4 py-20 transition-colors duration-300">
      <div className="bg-white dark:bg-slate-900 border border-slate-200/50 dark:border-slate-900/50 p-8 rounded-3xl shadow-sm text-left space-y-6">
        <div className="text-center space-y-2">
          <h2 className="text-2xl font-black text-slate-800 dark:text-slate-100">Forgot Password</h2>
          <p className="text-slate-400 text-sm">Enter your email and we'll send you an OTP to reset your password</p>
        </div>

        {error && (
          <div className="bg-red-50 dark:bg-red-950/30 border border-red-200 dark:border-red-900/30 p-3 rounded-xl flex items-start gap-2 text-red-600 dark:text-red-400 text-xs">
            <ShieldAlert size={16} className="shrink-0 mt-0.5" />
            <span>{error}</span>
          </div>
        )}

        <form onSubmit={handleSubmit} className="space-y-4">
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

          <button
            type="submit"
            disabled={loading}
            className="w-full bg-brand-500 hover:bg-brand-600 text-white font-bold py-3 rounded-xl flex items-center justify-center space-x-2 transition-all shadow-md shadow-brand-500/10 active:scale-98 text-sm"
          >
            <span>{loading ? 'Sending OTP...' : 'Send Reset OTP'}</span>
            <ArrowRight size={18} />
          </button>
        </form>

        <div className="text-center text-xs text-slate-400">
          Remember your password? <Link to="/login" className="text-brand-500 font-bold hover:underline">Sign In</Link>
        </div>
      </div>
    </div>
  );
}

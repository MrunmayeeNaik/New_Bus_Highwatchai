import React, { useState } from 'react';
import { useLocation, useNavigate } from 'react-router-dom';
import { ShieldCheck, Wallet, CreditCard, CheckCircle, Clock, AlertTriangle, RefreshCw } from 'lucide-react';
import api, { releaseSeatLocksOnUnload } from '../services/api';

export default function Payment() {
  const location = useLocation();
  const navigate = useNavigate();
  const { booking: initialBooking } = location.state || { booking: null };

  const [booking, setBooking] = useState(initialBooking);
  const [paymentMethod, setPaymentMethod] = useState('stripe');
  const [processing, setProcessing] = useState(false);
  const [simulateFailure, setSimulateFailure] = useState(false);
  const [failedAttempts, setFailedAttempts] = useState(0);
  const [paymentStatus, setPaymentStatus] = useState('idle'); // idle, processing, success, failed, exceeded

  const [timeLeft, setTimeLeft] = useState(600); // 10 minutes
  const [walletBalance, setWalletBalance] = useState(0);

  React.useEffect(() => {
    if (localStorage.getItem('access_token')) {
      api.get('/auth/me')
        .then(res => {
          if (res.data.wallet) setWalletBalance(res.data.wallet.balance);
        })
        .catch(() => {});
    }
  }, []);

  React.useEffect(() => {
    if (!booking) return;
    const timer = setInterval(() => {
      setTimeLeft(prev => {
        if (prev <= 1) {
          clearInterval(timer);
          alert('Seat hold has expired. Please select and lock seats again.');
          api.post('/bookings/seats/unlock', {
            trip_id: booking.trip_id,
            seat_ids: booking.passengers.map(p => p.seat_id)
          }).catch(() => {});
          navigate('/');
          return 0;
        }
        return prev - 1;
      });
    }, 1000);
    return () => clearInterval(timer);
  }, [booking, navigate]);

  // Release the seat hold immediately if the user closes the tab/browser mid-payment,
  // instead of leaving the seats locked until the 10-minute TTL expires on its own.
  React.useEffect(() => {
    if (!booking) return;
    const seatIds = booking.passengers.map(p => p.seat_id);
    const handleUnload = () => releaseSeatLocksOnUnload(booking.trip_id, seatIds);
    window.addEventListener('beforeunload', handleUnload);
    window.addEventListener('pagehide', handleUnload);
    return () => {
      window.removeEventListener('beforeunload', handleUnload);
      window.removeEventListener('pagehide', handleUnload);
    };
  }, [booking]);

  const formatTime = (seconds) => {
    const m = Math.floor(seconds / 60).toString().padStart(2, '0');
    const s = (seconds % 60).toString().padStart(2, '0');
    return `${m}:${s}`;
  };

  if (!booking) {
    return <div className="text-center py-12">No booking record found.</div>;
  }

  const handlePay = (e) => {
    if (e) e.preventDefault();
    setProcessing(true);
    setPaymentStatus('processing');

    const transactionId = `TXN-${paymentMethod.toUpperCase()}-${Math.floor(Math.random() * 90000000) + 10000000}`;
    
    const payload = {
      booking_id: booking.id,
      payment_gateway: paymentMethod,
      transaction_id: transactionId,
      amount: booking.final_amount,
      status: simulateFailure ? 'failed' : 'success'
    };

    api.post('/bookings/payment', payload)
      .then(res => {
        setProcessing(false);
        if (simulateFailure) {
          const nextFailures = failedAttempts + 1;
          setFailedAttempts(nextFailures);
          if (nextFailures >= 3) {
            setPaymentStatus('exceeded');
            alert('Payment failed. Maximum retry limit of 3 attempts exceeded.');
          } else {
            setPaymentStatus('failed');
            alert(`Payment transaction failed! Attempt ${nextFailures}/3.`);
          }
          return;
        }
        setPaymentStatus('success');
        alert('Payment confirmed! Ticket generated.');
        navigate('/ticket', { state: { booking: res.data } });
      })
      .catch(err => {
        setProcessing(false);
        const nextFailures = failedAttempts + 1;
        setFailedAttempts(nextFailures);
        if (nextFailures >= 3) {
          setPaymentStatus('exceeded');
        } else {
          setPaymentStatus('failed');
        }
        alert(err.response?.data?.detail || 'Payment transaction failed.');
      });
  };

  const handleRetry = () => {
    setProcessing(true);
    // Request backend retry order
    api.post(`/bookings/${booking.id}/retry`)
      .then(res => {
        setProcessing(false);
        setPaymentStatus('idle');
        alert('New payment order generated. You can now try again!');
      })
      .catch(err => {
        setProcessing(false);
        alert(err.response?.data?.detail || 'Retry validation failed.');
      });
  };

  const paymentGateways = [
    { id: 'stripe', name: 'Stripe Credit', icon: <CreditCard size={18} /> },
    { id: 'razorpay', name: 'Razorpay UPI', icon: <ShieldCheck size={18} /> },
    { id: 'wallet', name: `Wallet (Bal: ₹${walletBalance.toFixed(2)})`, icon: <Wallet size={18} />, disabled: walletBalance < booking.final_amount },
    { id: 'phonepe', name: 'PhonePe', icon: <ShieldCheck size={18} /> },
    { id: 'upi', name: 'Instant UPI', icon: <ShieldCheck size={18} /> },
    { id: 'netbanking', name: 'NetBanking', icon: <CreditCard size={18} /> },
    { id: 'creditcard', name: 'Credit Card', icon: <CreditCard size={18} /> },
    { id: 'debitcard', name: 'Debit Card', icon: <CreditCard size={18} /> }
  ];

  return (
    <div className="max-w-xl mx-auto px-4 py-12">
      <div className="bg-white dark:bg-slate-900 border border-slate-200/50 dark:border-slate-800/50 p-6 rounded-2xl shadow-sm space-y-6">
        <div className="flex justify-between items-center border-b border-slate-100 dark:border-slate-800 pb-4">
          <h2 className="text-xl font-bold text-slate-800 dark:text-slate-100">Checkout Payment</h2>
          <div className="flex items-center space-x-1.5 bg-amber-50 dark:bg-amber-950/20 px-3 py-1 rounded-lg border border-amber-200 dark:border-amber-900/50 text-amber-800 dark:text-amber-400 font-mono text-xs font-bold">
            <Clock size={12} className="animate-pulse" />
            <span>{formatTime(timeLeft)}</span>
          </div>
        </div>

        {/* Invoice Header */}
        <div className="p-4 bg-slate-50 dark:bg-slate-950 rounded-xl flex justify-between items-center">
          <div>
            <div className="text-slate-400 text-xs uppercase tracking-wider">Total Amount</div>
            <div className="text-2xl font-black text-brand-500">₹{booking.final_amount.toFixed(2)}</div>
          </div>
          <div className="text-right">
            <span className="text-xs font-semibold text-slate-400 block">PNR: {booking.pnr}</span>
            <span className="text-[10px] text-slate-400 font-medium">No: {booking.booking_number}</span>
          </div>
        </div>

        {paymentStatus === 'exceeded' ? (
          <div className="p-4 bg-red-50 dark:bg-red-950/20 border border-red-200/50 rounded-xl text-center space-y-3">
            <AlertTriangle size={32} className="text-red-500 mx-auto" />
            <h3 className="font-bold text-red-600 dark:text-red-400">Payment Limit Exceeded</h3>
            <p className="text-xs text-slate-500">You have reached the maximum of 3 failed checkout attempts. The seats hold has been released. Please start a new booking.</p>
            <button
              onClick={() => navigate('/')}
              className="w-full bg-slate-150 hover:bg-slate-200 dark:bg-slate-800 py-2 rounded-xl text-xs font-bold"
            >
              Back to Home
            </button>
          </div>
        ) : paymentStatus === 'failed' ? (
          <div className="p-4 bg-amber-50 dark:bg-amber-950/20 border border-amber-200/50 rounded-xl text-center space-y-3">
            <AlertTriangle size={32} className="text-amber-500 mx-auto" />
            <h3 className="font-bold text-amber-600 dark:text-amber-400">Payment Transaction Failed</h3>
            <p className="text-xs text-slate-500">Transaction was rejected by gateway provider. Attempts: {failedAttempts}/3.</p>
            <button
              onClick={handleRetry}
              disabled={processing}
              className="w-full bg-brand-500 hover:bg-brand-600 text-white font-bold py-2.5 rounded-xl flex items-center justify-center space-x-2 text-xs"
            >
              <RefreshCw size={14} className={processing ? 'animate-spin' : ''} />
              <span>Retry Payment (Verify Hold & Order)</span>
            </button>
          </div>
        ) : (
          <form onSubmit={handlePay} className="space-y-6">
            <div>
              <label className="text-xs font-bold text-slate-400 uppercase">Payment Method</label>
              <div className="grid grid-cols-2 gap-3 mt-2">
                {paymentGateways.map(g => (
                  <button
                    key={g.id}
                    type="button"
                    disabled={g.disabled}
                    onClick={() => setPaymentMethod(g.id)}
                    className={`p-3 rounded-xl border flex items-center space-x-2 font-semibold text-xs transition-all text-left ${
                      g.disabled
                        ? 'opacity-30 cursor-not-allowed border-slate-100 text-slate-350 dark:border-slate-850'
                        : paymentMethod === g.id
                        ? 'border-brand-500 bg-brand-50/15 text-brand-500 dark:bg-brand-950/20'
                        : 'border-slate-200 dark:border-slate-800 text-slate-600 dark:text-slate-400'
                    }`}
                  >
                    {g.icon}
                    <span className="truncate">{g.name}</span>
                  </button>
                ))}
              </div>
            </div>

            {paymentMethod === 'wallet' && (
              <div className="p-3 bg-emerald-50 dark:bg-emerald-950/20 text-emerald-600 dark:text-emerald-400 text-xs rounded-xl font-medium border border-emerald-100 dark:border-emerald-900/30">
                Payment will be deducted instantly from your secure New Bus wallet.
              </div>
            )}

            <div className="flex items-center space-x-2 bg-slate-50 dark:bg-slate-950/50 p-3 rounded-xl border border-slate-100 dark:border-slate-850">
              <input
                type="checkbox"
                id="simulate-failure"
                checked={simulateFailure}
                onChange={(e) => setSimulateFailure(e.target.checked)}
                className="rounded text-brand-500 focus:ring-brand-500 h-4 w-4 bg-slate-100 dark:bg-slate-900 border-slate-300 cursor-pointer"
              />
              <label htmlFor="simulate-failure" className="text-xs font-bold text-slate-500 cursor-pointer select-none">
                Simulate Payment Failure (Fails checkout at gateway)
              </label>
            </div>

            <button
              type="submit"
              disabled={processing}
              className="w-full bg-brand-500 hover:bg-brand-600 text-white font-bold py-3 rounded-xl flex items-center justify-center space-x-2 transition-all shadow-md shadow-brand-500/10 active:scale-98 text-sm"
            >
              {processing ? (
                <span>Authorizing Transaction...</span>
              ) : (
                <>
                  <ShieldCheck size={18} />
                  <span>Pay Final ₹{booking.final_amount.toFixed(2)}</span>
                </>
              )}
            </button>
          </form>
        )}
      </div>
    </div>
  );
}

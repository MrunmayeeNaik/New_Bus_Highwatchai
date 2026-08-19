import React, { useState, useEffect } from 'react';
import { Wallet as WalletIcon, ArrowDownCircle, ArrowUpCircle, ShieldCheck } from 'lucide-react';
import api from '../services/api';

export default function Wallet({ auth }) {
  const [addAmount, setAddAmount] = useState('');
  const [transactions, setTransactions] = useState([]);
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    // Fetch user transactions
    api.get('/auth/wallet/transactions')
      .then(res => {
        setTransactions(res.data);
      })
      .catch(() => {
        // Fallback mock transactions
        setTransactions([
          { id: 'tx-1', amount: 100.0, transaction_type: 'credit', description: 'Promo Registration Credit', created_at: new Date().toISOString() }
        ]);
      });
  }, [auth.wallet.balance]);

  const handleAddMoney = (e) => {
    e.preventDefault();
    if (!addAmount || parseFloat(addAmount) <= 0) return;
    
    setLoading(true);
    setTimeout(() => {
      auth.addWallet(parseFloat(addAmount));
      
      const newTx = {
        id: `tx-${Math.floor(Math.random() * 9000) + 1000}`,
        amount: parseFloat(addAmount),
        transaction_type: 'credit',
        description: 'Loaded Money via Cards Gateway',
        created_at: new Date().toISOString()
      };
      setTransactions(prev => [newTx, ...prev]);
      setAddAmount('');
      setLoading(false);
      alert('Money successfully added to your New Bus wallet!');
    }, 1500);
  };

  return (
    <div className="max-w-4xl mx-auto px-4 py-12 transition-colors duration-300">
      <h2 className="text-2xl font-extrabold tracking-tight mb-8">New Bus Wallet</h2>

      <div className="grid grid-cols-1 md:grid-cols-3 gap-8">
        
        {/* Balance Card & Add Money Form */}
        <div className="space-y-6">
          <div className="bg-gradient-to-r from-emerald-500 to-teal-600 p-6 rounded-2xl text-white shadow-md">
            <div className="flex justify-between items-center">
              <span className="text-xs uppercase font-bold tracking-wider opacity-85">Available Balance</span>
              <WalletIcon size={24} />
            </div>
            <div className="text-3xl font-black mt-4">₹{auth.wallet.balance.toFixed(2)}</div>
            <p className="text-[10px] text-emerald-100 mt-2">Active. Eligible for instant ticket refunds.</p>
          </div>

          <div className="bg-white dark:bg-slate-900 border border-slate-200/50 dark:border-slate-900/50 p-6 rounded-2xl text-left space-y-4 shadow-sm">
            <h3 className="font-bold text-sm text-slate-800 dark:text-slate-200">Load Wallet Balance</h3>
            <form onSubmit={handleAddMoney} className="space-y-4">
              <input
                type="number"
                required
                placeholder="Enter amount (₹)"
                value={addAmount}
                onChange={(e) => setAddAmount(e.target.value)}
                className="w-full bg-slate-50 dark:bg-slate-950 border border-slate-300/40 dark:border-slate-800/40 px-3 py-2 rounded-xl text-sm focus:ring-2 focus:ring-brand-500 outline-none"
              />
              <button
                type="submit"
                disabled={loading}
                className="w-full bg-emerald-500 hover:bg-emerald-600 text-white font-bold py-2.5 rounded-xl text-xs flex items-center justify-center space-x-1 shadow-md shadow-emerald-500/10 transition-all active:scale-98"
              >
                <ShieldCheck size={16} />
                <span>{loading ? 'Processing...' : 'Load Money'}</span>
              </button>
            </form>
          </div>
        </div>

        {/* Ledger Transaction Logs list */}
        <div className="md:col-span-2 space-y-6 text-left">
          <div className="bg-white dark:bg-slate-900 border border-slate-200/50 dark:border-slate-900/50 p-6 rounded-2xl shadow-sm">
            <h3 className="font-bold text-slate-800 dark:text-slate-200 mb-6">Wallet Transactions</h3>
            
            <div className="space-y-4">
              {transactions.length === 0 ? (
                <p className="text-slate-400 text-sm">No transaction records found.</p>
              ) : (
                transactions.map((tx) => (
                  <div key={tx.id} className="flex justify-between items-center p-3 hover:bg-slate-50 dark:hover:bg-slate-950/20 rounded-xl transition-colors">
                    <div className="flex items-center space-x-3">
                      {tx.transaction_type === 'credit' ? (
                        <ArrowUpCircle className="text-emerald-500" size={24} />
                      ) : (
                        <ArrowDownCircle className="text-rose-500" size={24} />
                      )}
                      <div>
                        <div className="font-semibold text-sm text-slate-800 dark:text-slate-100">{tx.description}</div>
                        <div className="text-[10px] text-slate-400 mt-0.5">
                          {new Date(tx.created_at).toLocaleString()}
                        </div>
                      </div>
                    </div>
                    <span className={`font-extrabold text-sm ${
                      tx.transaction_type === 'credit' ? 'text-emerald-500' : 'text-rose-500'
                    }`}>
                      {tx.transaction_type === 'credit' ? '+' : '-'}₹{Math.abs(tx.amount).toFixed(2)}
                    </span>
                  </div>
                ))
              )}
            </div>
          </div>
        </div>

      </div>
    </div>
  );
}

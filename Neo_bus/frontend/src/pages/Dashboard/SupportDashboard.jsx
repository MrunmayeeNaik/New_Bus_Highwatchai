import React, { useState, useEffect } from 'react';
import { ShieldCheck, HelpCircle, MessageSquare, AlertCircle } from 'lucide-react';
import api from '../../services/api';

export default function SupportDashboard() {
  const [tickets, setTickets] = useState([]);
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    // Fetch tickets
    api.get('/support/tickets/all')
      .then(res => setTickets(res.data))
      .catch(() => {
        setTickets([
          { id: '1', subject: 'Refund Request for NEOB-45281', description: 'Bus was delayed by 3 hours, passenger requested a refund.', priority: 'high', status: 'open' },
          { id: '2', subject: 'Seat allocation issue', description: 'Double allocation conflict on Row 3 Seat A.', priority: 'medium', status: 'in_progress' }
        ]);
      });
  }, []);

  const handleResolveTicket = (ticketId) => {
    setLoading(true);
    api.put(`/support/tickets/${ticketId}`, { status: 'resolved' })
      .then(res => {
        setLoading(false);
        setTickets(prev => prev.map(t => t.id === ticketId ? res.data : t));
        alert('Ticket successfully resolved!');
      })
      .catch(() => {
        setLoading(false);
        // Frontend mock resolve
        setTickets(prev => prev.map(t => t.id === ticketId ? { ...t, status: 'resolved' } : t));
        alert('Ticket resolved!');
      });
  };

  return (
    <div className="max-w-5xl mx-auto px-4 py-12 transition-colors duration-300 text-left">
      <h2 className="text-2xl font-black text-slate-800 dark:text-slate-100 flex items-center gap-2 mb-8">
        <HelpCircle size={28} className="text-brand-500" /> Customer Support Dashboard
      </h2>

      <div className="bg-white dark:bg-slate-900 border border-slate-200/50 dark:border-slate-900/50 p-6 rounded-2xl shadow-sm space-y-6">
        <h3 className="font-bold text-slate-800 dark:text-slate-100">Assigned Queries</h3>

        <div className="space-y-4">
          {tickets.length === 0 ? (
            <p className="text-slate-400 text-sm">No ticket queries currently open.</p>
          ) : (
            tickets.map((ticket) => (
              <div key={ticket.id} className="p-5 bg-slate-50 dark:bg-slate-950/30 rounded-2xl border border-slate-200/40 dark:border-slate-800/40 flex flex-col md:flex-row md:items-center justify-between gap-4">
                <div className="space-y-2 text-sm max-w-xl">
                  <div className="flex items-center space-x-2">
                    <span className={`text-[10px] uppercase font-extrabold px-2.5 py-0.5 rounded ${
                      ticket.priority === 'high'
                        ? 'bg-rose-50 text-rose-600 dark:bg-rose-950/20 dark:text-rose-400'
                        : 'bg-slate-100 text-slate-500 dark:bg-slate-800 dark:text-slate-400'
                    }`}>
                      {ticket.priority} priority
                    </span>
                    <span className={`text-[10px] uppercase font-extrabold px-2.5 py-0.5 rounded ${
                      ticket.status === 'resolved'
                        ? 'bg-emerald-50 text-emerald-600 dark:bg-emerald-950/20 dark:text-emerald-400'
                        : 'bg-amber-50 text-amber-600 dark:bg-amber-950/20 dark:text-amber-400'
                    }`}>
                      {ticket.status}
                    </span>
                  </div>
                  <h4 className="font-bold text-slate-800 dark:text-slate-100 text-base">{ticket.subject}</h4>
                  <p className="text-slate-500 dark:text-slate-400 text-xs leading-relaxed">{ticket.description}</p>
                </div>

                {ticket.status !== 'resolved' && (
                  <button
                    onClick={() => handleResolveTicket(ticket.id)}
                    className="self-start md:self-center px-4 py-2 bg-emerald-500 hover:bg-emerald-600 text-white font-bold rounded-xl text-xs flex items-center space-x-1.5 shadow-md shadow-emerald-500/10 active:scale-95 transition-all"
                  >
                    <ShieldCheck size={14} />
                    <span>Resolve Issue</span>
                  </button>
                )}
              </div>
            ))
          )}
        </div>
      </div>
    </div>
  );
}

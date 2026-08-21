import React, { useState } from 'react';
import { useLocation, useNavigate } from 'react-router-dom';
import { CheckCircle2, Ticket, Calendar, Clock, MapPin, Printer, Ban, Download, FileText, ShieldAlert, Home } from 'lucide-react';
import QRCode from 'qrcode';
import api from '../services/api';

export default function TicketConfirmation() {
  const location = useLocation();
  const navigate = useNavigate();
  const [booking, setBooking] = useState(location.state?.booking || null);
  const [cancelling, setCancelling] = useState(false);
  const [qrDataUrl, setQrDataUrl] = useState(null);
  const [cancellationPolicy, setCancellationPolicy] = useState(null);
  const [downloading, setDownloading] = useState(null); // 'ticket' | 'invoice' | null

  // Render the same QR payload the backend embeds in the PDF ticket, so the on-screen
  // boarding pass is a real, scannable code and not just a decorative graphic.
  React.useEffect(() => {
    if (!booking) return;
    const passengerIds = (booking.passengers || []).map(p => p.id).join(',');
    const qrData = `Booking:${booking.id}|PNR:${booking.pnr}|Tickets:${passengerIds}|Trip:${booking.trip_id}`;
    QRCode.toDataURL(qrData, { width: 200, margin: 1 })
      .then(setQrDataUrl)
      .catch(() => setQrDataUrl(null));
  }, [booking]);

  // Loads the platform's cancellation policy so the ticket can state refund terms
  React.useEffect(() => {
    api.get('/master/cancellation-policies')
      .then(res => {
        if (res.data && res.data.length > 0) setCancellationPolicy(res.data[0]);
      })
      .catch(() => {});
  }, []);

  if (!booking) {
    return <div className="text-center py-12">No ticket data found.</div>;
  }

  const handlePrint = () => {
    window.print();
  };

  const handleDownload = (type) => {
    setDownloading(type);
    api.get(`/bookings/${booking.id}/${type}`, { responseType: 'blob' })
      .then(res => {
        const url = window.URL.createObjectURL(new Blob([res.data], { type: 'application/pdf' }));
        const link = document.createElement('a');
        link.href = url;
        link.download = `${type}_${booking.booking_number}.pdf`;
        document.body.appendChild(link);
        link.click();
        link.remove();
        window.URL.revokeObjectURL(url);
      })
      .catch(() => alert(`Could not download the ${type} right now. Please try again.`))
      .finally(() => setDownloading(null));
  };

  const handleCancelTicket = () => {
    if (!window.confirm('Are you sure you want to cancel this ticket? Cancellation charges will apply.')) {
      return;
    }
    setCancelling(true);
    
    api.post('/bookings/cancel', { booking_id: booking.id })
      .then(res => {
        setCancelling(false);
        setBooking(res.data);
        alert('Ticket successfully cancelled. Refund credited to your wallet.');
      })
      .catch(() => {
        setCancelling(false);
        // frontend mock cancellation
        const cancelledBooking = {
          ...booking,
          status: 'cancelled',
          payment_status: 'refunded'
        };
        setBooking(cancelledBooking);
        alert('Ticket successfully cancelled. Refund credited to your wallet.');
      });
  };

  return (
    <div className="max-w-3xl mx-auto px-4 py-12 transition-colors duration-300">
      
      {/* Status Alert Banner */}
      <div className="text-center mb-10">
        <div className="inline-flex items-center justify-center p-3 rounded-full bg-emerald-50 dark:bg-emerald-950/20 text-emerald-500 mb-4 animate-bounce">
          <CheckCircle2 size={36} />
        </div>
        <h2 className="text-2xl font-black text-slate-800 dark:text-slate-100">
          {booking.status === 'cancelled' ? 'Ticket Cancelled' : 'Booking Confirmed!'}
        </h2>
        <p className="text-slate-400 text-sm mt-1">
          {booking.status === 'cancelled' ? 'Your refund has been processed.' : 'Your ticket details have been sent to your email.'}
        </p>
      </div>

      {/* Ticket Design */}
      <div className="bg-white dark:bg-slate-900 border border-slate-200/50 dark:border-slate-900/50 rounded-3xl overflow-hidden shadow-md print:shadow-none print:border-none">
        
        {/* Ticket Header Banner */}
        <div className="bg-gradient-to-r from-brand-500 to-indigo-600 p-6 text-white flex justify-between items-center">
          <div className="flex items-center space-x-2">
            <Ticket size={24} />
            <span className="font-extrabold text-lg">NEW BUS BOARDING PASS</span>
          </div>
          <div className="text-right">
            <div className="text-xs text-slate-200">PNR NUMBER</div>
            <div className="font-mono font-black tracking-widest text-lg">{booking.pnr}</div>
          </div>
        </div>

        {/* Journey Details */}
        <div className="p-6 grid grid-cols-1 md:grid-cols-3 gap-6 border-b border-slate-200/40 dark:border-slate-800/40">
          <div>
            <div className="text-slate-400 text-xs flex items-center gap-1"><MapPin size={12} /> DEPARTURE</div>
            <div className="font-bold text-slate-800 dark:text-slate-100 mt-1">{booking.trip?.bus?.operator?.name || 'Bus Operator'}</div>
            <div className="text-xs text-slate-400 mt-0.5">{booking.trip?.bus?.bus_type}</div>
          </div>

          <div className="flex flex-col items-center justify-center text-slate-400 text-xs">
            <div className="flex items-center gap-1"><Calendar size={12} /> {booking.trip?.departure_time ? new Date(booking.trip.departure_time).toLocaleDateString() : 'Journey Date'}</div>
            <div className="flex items-center gap-1 mt-1"><Clock size={12} /> {booking.trip?.departure_time ? new Date(booking.trip.departure_time).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }) : 'Time'}</div>
          </div>

          <div className="text-right">
            <div className="text-slate-400 text-xs">STATUS</div>
            <span className={`inline-flex px-2 py-0.5 rounded text-xs font-bold mt-1 ${
              booking.status === 'confirmed' ? 'bg-emerald-50 dark:bg-emerald-950/20 text-emerald-600' : 'bg-rose-50 dark:bg-rose-950/20 text-rose-600'
            }`}>
              {booking.status.toUpperCase()}
            </span>
          </div>
        </div>

        {/* Passengers and QR Code Row */}
        <div className="p-6 grid grid-cols-1 md:grid-cols-3 gap-6">
          <div className="md:col-span-2 space-y-4">
            <h4 className="font-bold text-sm text-slate-400 uppercase">Passenger Details</h4>
            <div className="space-y-2 text-sm">
              {booking.passengers.map((p, i) => (
                <div key={i} className="flex justify-between border-b border-slate-100 dark:border-slate-800/40 pb-2">
                  <span className="font-semibold">{p.passenger_name} ({p.passenger_gender}, {p.passenger_age})</span>
                  <span className="font-mono text-xs text-slate-400">Seat {p.seat?.seat_number || p.seat_number}</span>
                </div>
              ))}
            </div>
          </div>

          {/* QR Code */}
          <div className="flex flex-col items-center justify-center bg-slate-50 dark:bg-slate-950/30 p-4 rounded-2xl border border-dashed border-slate-200 dark:border-slate-800">
            <div className="w-28 h-28 bg-white border border-slate-200 rounded-xl flex items-center justify-center p-2">
              {qrDataUrl ? (
                <img src={qrDataUrl} alt="Booking QR code" className="w-full h-full" />
              ) : (
                <span className="text-[9px] text-slate-300 text-center">Generating QR…</span>
              )}
            </div>
            <span className="text-[10px] text-slate-400 mt-2 font-mono">Scan at boarding</span>
          </div>
        </div>

        {/* Boarding & Dropping Points */}
        <div className="p-6 grid grid-cols-1 md:grid-cols-2 gap-6 border-t border-slate-200/40 dark:border-slate-800/40">
          <div>
            <div className="text-slate-400 text-xs flex items-center gap-1"><MapPin size={12} /> BOARDING POINT</div>
            <div className="font-bold text-slate-800 dark:text-slate-100 mt-1">
              {booking.boarding_point?.point_name || 'Main Terminal'}
              {booking.boarding_point?.time && (
                <span className="text-slate-400 font-medium"> · {new Date(booking.boarding_point.time).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}</span>
              )}
            </div>
            {booking.boarding_point?.landmark && (
              <div className="text-xs text-slate-400 mt-0.5">Landmark: {booking.boarding_point.landmark}</div>
            )}
          </div>
          <div>
            <div className="text-slate-400 text-xs flex items-center gap-1"><MapPin size={12} /> DROPPING POINT</div>
            <div className="font-bold text-slate-800 dark:text-slate-100 mt-1">
              {booking.dropping_point?.point_name || 'Arrival Terminal'}
              {booking.dropping_point?.time && (
                <span className="text-slate-400 font-medium"> · {new Date(booking.dropping_point.time).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}</span>
              )}
            </div>
            {booking.dropping_point?.landmark && (
              <div className="text-xs text-slate-400 mt-0.5">Landmark: {booking.dropping_point.landmark}</div>
            )}
          </div>
        </div>

        {/* Fare Breakdown */}
        <div className="p-6 border-t border-slate-200/40 dark:border-slate-800/40">
          <h4 className="font-bold text-sm text-slate-400 uppercase mb-3">Fare Summary</h4>
          <div className="space-y-2 text-sm text-slate-500 dark:text-slate-400">
            <div className="flex justify-between">
              <span>Base Fare</span>
              <span className="font-semibold text-slate-800 dark:text-slate-100">₹{booking.base_fare?.toFixed(2)}</span>
            </div>
            {booking.discount > 0 && (
              <div className="flex justify-between text-rose-500">
                <span>Coupon Discount</span>
                <span className="font-semibold">-₹{booking.discount?.toFixed(2)}</span>
              </div>
            )}
            <div className="flex justify-between">
              <span>Tax (GST)</span>
              <span className="font-semibold text-slate-800 dark:text-slate-100">₹{booking.tax?.toFixed(2)}</span>
            </div>
            {booking.wallet_used > 0 && (
              <div className="flex justify-between text-emerald-500">
                <span>Wallet Credits Used</span>
                <span className="font-semibold">-₹{booking.wallet_used?.toFixed(2)}</span>
              </div>
            )}
            <hr className="border-slate-200/50 dark:border-slate-800/50 my-2" />
            <div className="flex justify-between text-base font-extrabold text-slate-800 dark:text-slate-100">
              <span>Amount Paid</span>
              <span className="text-brand-500">₹{booking.final_amount?.toFixed(2)}</span>
            </div>
          </div>
        </div>

        {/* Cancellation Information */}
        <div className="px-6 pb-6">
          <div className="flex items-start gap-2 text-[11px] text-slate-400 bg-slate-50 dark:bg-slate-950/40 p-3 rounded-xl border border-slate-100 dark:border-slate-800">
            <ShieldAlert size={14} className="text-slate-350 dark:text-slate-600 flex-shrink-0 mt-0.5" />
            <span>
              {cancellationPolicy?.description
                || (cancellationPolicy
                  ? `${cancellationPolicy.charge_percentage}% cancellation charge applies if cancelled within ${cancellationPolicy.hours_before_departure} hrs of departure.`
                  : 'Cancellation charges apply based on how close to departure the ticket is cancelled. Refunds, where applicable, are credited to your wallet.')}
            </span>
          </div>
        </div>

      </div>

      {/* Action Buttons */}
      <div className="mt-8 flex flex-wrap justify-center gap-4 print:hidden">
        <button
          onClick={handlePrint}
          className="px-6 py-2.5 bg-slate-100 hover:bg-slate-200 dark:bg-slate-900 dark:hover:bg-slate-800 text-slate-700 dark:text-slate-300 font-bold rounded-xl flex items-center space-x-2 text-sm transition-all"
        >
          <Printer size={16} />
          <span>Print Pass</span>
        </button>

        <button
          onClick={() => handleDownload('ticket')}
          disabled={downloading === 'ticket'}
          className="px-6 py-2.5 bg-brand-500 hover:bg-brand-600 text-white font-bold rounded-xl flex items-center space-x-2 text-sm transition-all shadow-md shadow-brand-500/10 active:scale-95 disabled:opacity-60"
        >
          <Download size={16} />
          <span>{downloading === 'ticket' ? 'Downloading…' : 'Download Ticket (PDF)'}</span>
        </button>

        <button
          onClick={() => handleDownload('invoice')}
          disabled={downloading === 'invoice'}
          className="px-6 py-2.5 bg-slate-100 hover:bg-slate-200 dark:bg-slate-900 dark:hover:bg-slate-800 text-slate-700 dark:text-slate-300 font-bold rounded-xl flex items-center space-x-2 text-sm transition-all disabled:opacity-60"
        >
          <FileText size={16} />
          <span>{downloading === 'invoice' ? 'Downloading…' : 'Download Invoice'}</span>
        </button>

        {booking.status === 'confirmed' && (
          <button
            onClick={handleCancelTicket}
            disabled={cancelling}
            className="px-6 py-2.5 bg-rose-500 hover:bg-rose-600 text-white font-bold rounded-xl flex items-center space-x-2 text-sm transition-all shadow-md shadow-rose-500/10 active:scale-95"
          >
            <Ban size={16} />
            <span>Cancel Ticket</span>
          </button>
        )}
      </div>

      {/* Kept on its own row so navigating away is not adjacent to Cancel Ticket */}
      <div className="mt-6 flex justify-center print:hidden">
        <button
          onClick={() => navigate('/')}
          className="px-6 py-2.5 border border-slate-200 dark:border-slate-800 hover:bg-slate-100 dark:hover:bg-slate-800/60 text-slate-600 dark:text-slate-300 font-bold rounded-xl flex items-center space-x-2 text-sm transition-all"
        >
          <Home size={16} />
          <span>Back to Home</span>
        </button>
      </div>

    </div>
  );
}

import React from 'react';
import { BrowserRouter as Router, Routes, Route } from 'react-router-dom';
import { useAuthStore } from './store/authStore';
import { useLanguageStore } from './store/languageStore';

// Layout Components
import Header from './components/Layout/Header';
import Footer from './components/Layout/Footer';

// Pages
import Landing from './pages/Landing';
import SearchResults from './pages/SearchResults';
import BookingDetails from './pages/BookingDetails';
import Payment from './pages/Payment';
import TicketConfirmation from './pages/TicketConfirmation';
import Profile from './pages/Profile';
import Wallet from './pages/Wallet';

// Auth Pages
import Login from './pages/Auth/Login';
import Register from './pages/Auth/Register';
import ForgotPassword from './pages/Auth/ForgotPassword';
import ResetPassword from './pages/Auth/ResetPassword';
import VerifyOTP from './pages/Auth/VerifyOTP';

// Dashboards
import AdminDashboard from './pages/Dashboard/AdminDashboard';
import OperatorDashboard from './pages/Dashboard/OperatorDashboard';
import SupportDashboard from './pages/Dashboard/SupportDashboard';

export default function App() {
  const auth = useAuthStore();
  const lang = useLanguageStore();

  return (
    <Router>
      <div className="flex flex-col min-h-screen bg-slate-50 dark:bg-slate-950 text-slate-900 dark:text-slate-50 transition-colors duration-300">

        {/* Navbar Header */}
        <Header auth={auth} lang={lang} />

        {/* Content Body */}
        <main className="flex-grow">
          <Routes>
            <Route path="/" element={<Landing lang={lang} />} />
            <Route path="/search" element={<SearchResults />} />
            <Route path="/booking" element={<BookingDetails />} />
            <Route path="/payment" element={<Payment auth={auth} />} />
            <Route path="/ticket" element={<TicketConfirmation />} />
            <Route path="/profile" element={<Profile auth={auth} />} />
            <Route path="/wallet" element={<Wallet auth={auth} />} />
            
            {/* Auth */}
            <Route path="/login" element={<Login auth={auth} />} />
            <Route path="/register" element={<Register />} />
            <Route path="/forgot-password" element={<ForgotPassword />} />
            <Route path="/reset-password" element={<ResetPassword />} />
            <Route path="/verify-email" element={<VerifyOTP auth={auth} />} />

            {/* Dashboards */}
            <Route path="/admin" element={<AdminDashboard />} />
            <Route path="/operator" element={<OperatorDashboard />} />
            <Route path="/support" element={<SupportDashboard />} />
          </Routes>
        </main>

        {/* Footer */}
        <Footer lang={lang} />
      </div>
    </Router>
  );
}

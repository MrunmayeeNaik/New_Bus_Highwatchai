import React, { useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { Bus, Moon, Sun, Wallet, User as UserIcon, LogOut, Shield, Menu, X, Home, HelpCircle, ChevronRight } from 'lucide-react';
import { LANGUAGES } from '../../i18n/translations';

export default function Header({ auth, lang }) {
  const navigate = useNavigate();
  const [showSidebar, setShowSidebar] = useState(false);
  const [showLangMenu, setShowLangMenu] = useState(false);
  const t = lang.t;

  const handleLogout = () => {
    auth.logoutStore();
    navigate('/');
  };

  const getDashboardPath = () => {
    if (!auth.user) return '/profile';
    const role = auth.user.role?.name || sessionStorage.getItem('user_role');
    if (role === 'admin' || role === 'super_admin') return '/admin';
    if (role === 'operator' || role === 'operator_staff') return '/operator';
    if (role === 'support') return '/support';
    return '/profile';
  };

  return (
    <>
    <header className="sticky top-0 z-50 backdrop-blur-md bg-white/70 dark:bg-slate-950/70 border-b border-slate-200/50 dark:border-slate-900/50 transition-colors duration-300">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
        <div className="flex items-center justify-between h-16">
          {/* Logo */}
          <Link to="/" className="flex items-center space-x-2 group">
            <div className="bg-brand-500 text-white p-2 rounded-xl group-hover:scale-105 transition-transform">
              <Bus size={24} />
            </div>
            <span className="font-extrabold text-xl tracking-tight bg-gradient-to-r from-brand-500 to-indigo-500 bg-clip-text text-transparent">
              New Bus
            </span>
          </Link>

          {/* Nav Items */}
          <div className="flex items-center space-x-4">
            {/* Theme Toggle */}
            <button
              onClick={() => auth.setDarkMode(!auth.darkMode)}
              className="p-2 text-slate-500 hover:text-brand-500 dark:text-slate-400 dark:hover:text-brand-400 rounded-lg hover:bg-slate-100 dark:hover:bg-slate-900 transition-colors"
            >
              {auth.darkMode ? <Sun size={20} /> : <Moon size={20} />}
            </button>

            {auth.token ? (
              <>
                {/* Wallet Balance */}
                <Link to="/wallet" className="flex items-center space-x-1.5 px-3 py-1.5 rounded-lg bg-emerald-50 dark:bg-emerald-950/30 border border-emerald-200/40 dark:border-emerald-900/30 text-emerald-600 dark:text-emerald-400 text-sm font-semibold">
                  <Wallet size={16} />
                  <span>₹{auth.wallet?.balance?.toFixed(2) || '0.00'}</span>
                </Link>

                {/* Profile Shortcut triggers sidebar drawer */}
                <button
                  type="button"
                  onClick={() => setShowSidebar(true)}
                  className="flex items-center space-x-1.5 px-3 py-1.5 rounded-lg text-sm font-bold text-slate-700 hover:text-brand-500 dark:text-slate-300 dark:hover:text-brand-400 hover:bg-slate-100 dark:hover:bg-slate-900/50 cursor-pointer transition-all active:scale-95"
                >
                  <UserIcon size={16} />
                  <span>{auth.user?.full_name || t('nav.profileFallback')}</span>
                </button>
              </>
            ) : (
              <div className="flex items-center space-x-2">
                <Link
                  to="/login"
                  className="px-4 py-2 text-sm font-semibold text-slate-700 hover:text-brand-500 dark:text-slate-300 dark:hover:text-brand-400 transition-colors"
                >
                  {t('nav.login')}
                </Link>
                <Link
                  to="/register"
                  className="px-4 py-2 text-sm font-semibold text-white bg-brand-500 hover:bg-brand-600 rounded-xl transition-all shadow-md shadow-brand-500/20"
                >
                  {t('nav.register')}
                </Link>
              </div>
            )}
          </div>
        </div>
      </div>
    </header>

      {/* Sidebar Backdrop Overlay */}
      {showSidebar && (
        <div
          className="fixed inset-0 z-[100] bg-black/60 backdrop-blur-sm transition-opacity duration-300"
          onClick={() => setShowSidebar(false)}
        />
      )}      {/* Sidebar Drawer Panel (Right Side) */}
      <div
        className={`fixed inset-y-0 right-0 w-80 bg-white dark:bg-slate-950 text-slate-800 dark:text-slate-100 shadow-2xl z-[110] flex flex-col transform transition-transform duration-300 ease-in-out border-l border-slate-200 dark:border-slate-800 ${
          showSidebar ? 'translate-x-0' : 'translate-x-full'
        }`}
      >
        {/* Header */}
        <div className="flex items-center justify-between p-4 border-b border-slate-200 dark:border-slate-800 bg-slate-50 dark:bg-slate-950/20">
          <span className="font-extrabold text-sm text-slate-600 dark:text-slate-300 uppercase tracking-wider">{t('sidebar.account')}</span>
          <button
            type="button"
            onClick={() => setShowSidebar(false)}
            className="p-1.5 text-slate-400 hover:text-slate-700 dark:text-slate-400 dark:hover:text-white rounded-lg hover:bg-slate-100 dark:hover:bg-slate-800 transition-colors cursor-pointer"
          >
            <X size={18} />
          </button>
        </div>

        {/* Scrollable Menu Items */}
        <div className="flex-grow overflow-y-auto divide-y divide-slate-100 dark:divide-slate-800/65 text-left text-xs">
          
          {/* User Account Quick Info Block */}
          {auth.token && (
            <div className="p-4 bg-slate-50/50 dark:bg-slate-950/25 space-y-2">
              <div className="flex items-center space-x-3">
                <div className="h-10 w-10 rounded-full bg-brand-500/10 dark:bg-brand-500/20 text-brand-500 dark:text-brand-400 border border-brand-500/20 dark:border-brand-500/30 flex items-center justify-center font-bold text-base uppercase">
                  {auth.user?.full_name?.charAt(0) || 'U'}
                </div>
                <div className="overflow-hidden">
                  <div className="font-bold text-sm text-slate-800 dark:text-white truncate max-w-[180px]">
                    {auth.user?.full_name || t('sidebar.userFallback')}
                  </div>
                  <div className="text-xs text-slate-500 dark:text-slate-400 truncate max-w-[180px]">
                    {auth.user?.email}
                  </div>
                </div>
              </div>
              <div className="flex gap-2">
                <span className="inline-block px-2 py-0.5 rounded bg-brand-500/5 dark:bg-brand-500/10 border border-brand-500/10 dark:border-brand-500/20 text-[9px] uppercase font-extrabold text-brand-500 dark:text-brand-400 tracking-wider">
                  {auth.user?.role?.name || 'Passenger'}
                </span>
                <span className="inline-block px-2 py-0.5 rounded bg-emerald-500/5 dark:bg-emerald-500/10 border border-emerald-500/10 dark:border-emerald-500/20 text-[9px] uppercase font-extrabold text-emerald-500 dark:text-emerald-400 tracking-wider">
                  Active Session
                </span>
              </div>
            </div>
          )}

          {/* Section: My Details */}
          <div className="p-4 space-y-2">
            <h4 className="text-[10px] font-black text-slate-400 dark:text-slate-500 uppercase tracking-wider mb-2">{t('sidebar.myDetails')}</h4>

            <Link
              to="/profile"
              onClick={() => setShowSidebar(false)}
              className="flex items-center justify-between p-2 rounded-lg hover:bg-slate-50 dark:hover:bg-slate-800/40 text-slate-600 dark:text-slate-300 hover:text-brand-500 dark:hover:text-white transition-all font-semibold"
            >
              <div className="flex items-center space-x-3">
                <span className="text-slate-400 dark:text-slate-500 text-sm">📋</span>
                <span>{t('sidebar.bookings')}</span>
              </div>
              <ChevronRight size={14} className="text-slate-300 dark:text-slate-600" />
            </Link>

            <button
              onClick={() => {
                alert("🎁 Scratch Cards: You have 3 scratch cards waiting! Total Points: 120.");
              }}
              className="w-full flex items-center justify-between p-2 rounded-lg hover:bg-slate-50 dark:hover:bg-slate-800/40 text-slate-600 dark:text-slate-300 hover:text-brand-500 dark:hover:text-white transition-all font-semibold text-left cursor-pointer"
            >
              <div className="flex items-center space-x-3">
                <span className="text-slate-400 dark:text-slate-500 text-sm">🎁</span>
                <span>{t('sidebar.scratchCards')}</span>
              </div>
              <ChevronRight size={14} className="text-slate-300 dark:text-slate-600" />
            </button>

            <Link
              to="/profile"
              onClick={() => setShowSidebar(false)}
              className="flex items-center justify-between p-2 rounded-lg hover:bg-slate-50 dark:hover:bg-slate-800/40 text-slate-650 dark:text-slate-300 hover:text-brand-500 dark:hover:text-white transition-all font-semibold"
            >
              <div className="flex items-center space-x-3">
                <UserIcon size={15} className="text-slate-400 dark:text-slate-550" />
                <span>{t('sidebar.personalInfo')}</span>
              </div>
              <ChevronRight size={14} className="text-slate-300 dark:text-slate-600" />
            </Link>
          </div>

          {/* Section: Payments */}
          <div className="p-4 space-y-2">
            <h4 className="text-[10px] font-black text-slate-400 dark:text-slate-500 uppercase tracking-wider mb-2">{t('sidebar.payments')}</h4>

            <Link
              to="/wallet"
              onClick={() => setShowSidebar(false)}
              className="flex items-center justify-between p-2 rounded-lg hover:bg-slate-50 dark:hover:bg-slate-800/40 text-slate-600 dark:text-slate-300 hover:text-brand-500 dark:hover:text-white transition-all font-semibold"
            >
              <div className="flex items-center space-x-3">
                <Wallet size={15} className="text-slate-400 dark:text-slate-550" />
                <span>{t('sidebar.wallet')}</span>
              </div>
              <div className="flex items-center space-x-1.5">
                <span className="text-[10px] bg-emerald-500/5 dark:bg-emerald-500/10 border border-emerald-500/10 dark:border-emerald-500/20 text-emerald-600 dark:text-emerald-400 px-2 py-0.5 rounded font-extrabold">
                  ₹{auth.wallet?.balance?.toFixed(2) || '0.00'}
                </span>
                <ChevronRight size={14} className="text-slate-300 dark:text-slate-600" />
              </div>
            </Link>
          </div>

          {/* Section: Admin / Operator Controls (if applicable) */}
          {(auth.user?.role?.name === 'admin' || auth.user?.role?.name === 'super_admin' || auth.user?.role?.name === 'operator' || auth.user?.role?.name === 'operator_staff') && (
            <div className="p-4 space-y-2 bg-brand-500/5 dark:bg-brand-500/5">
              <h4 className="text-[10px] font-black text-brand-500 dark:text-brand-400 uppercase tracking-wider mb-2">{t('sidebar.systemControls')}</h4>

              <Link
                to={getDashboardPath()}
                onClick={() => setShowSidebar(false)}
                className="flex items-center justify-between p-2 rounded-lg hover:bg-slate-50 dark:hover:bg-slate-800/40 text-slate-600 dark:text-slate-300 hover:text-brand-500 dark:hover:text-white transition-all font-semibold"
              >
                <div className="flex items-center space-x-3">
                  <Shield size={15} className="text-brand-500 dark:text-brand-400" />
                  <span>{t('sidebar.controlCenter')}</span>
                </div>
                <ChevronRight size={14} className="text-slate-300 dark:text-slate-600" />
              </Link>
            </div>
          )}

          {/* Section: More */}
          <div className="p-4 space-y-2">
            <h4 className="text-[10px] font-black text-slate-400 dark:text-slate-500 uppercase tracking-wider mb-2">{t('sidebar.more')}</h4>

            <Link
              to="/"
              onClick={() => {
                setShowSidebar(false);
                setTimeout(() => {
                  window.scrollTo({ top: document.body.scrollHeight, behavior: 'smooth' });
                }, 300);
              }}
              className="flex items-center justify-between p-2 rounded-lg hover:bg-slate-50 dark:hover:bg-slate-800/40 text-slate-600 dark:text-slate-300 hover:text-brand-500 dark:hover:text-white transition-all font-semibold"
            >
              <div className="flex items-center space-x-3">
                <span className="text-slate-450">🏷️</span>
                <span>{t('sidebar.offers')}</span>
              </div>
              <ChevronRight size={14} className="text-slate-300 dark:text-slate-600" />
            </Link>


            <button
              onClick={() => alert("New Bus Travel Portal\nVersion: 1.0.0 (Production Build)\nEquipped with instant seat hold release, ladies booking priority rules, and wallet check-outs.")}
              className="w-full flex items-center justify-between p-2 rounded-lg hover:bg-slate-50 dark:hover:bg-slate-800/40 text-slate-600 dark:text-slate-300 hover:text-brand-500 dark:hover:text-white transition-all font-semibold text-left cursor-pointer"
            >
              <div className="flex items-center space-x-3">
                <span className="text-slate-455">ℹ️</span>
                <span>{t('sidebar.aboutApp')}</span>
              </div>
              <ChevronRight size={14} className="text-slate-300 dark:text-slate-600" />
            </button>

            <Link
              to="/support"
              onClick={() => setShowSidebar(false)}
              className="flex items-center justify-between p-2 rounded-lg hover:bg-slate-50 dark:hover:bg-slate-800/40 text-slate-600 dark:text-slate-300 hover:text-brand-500 dark:hover:text-white transition-all font-semibold"
            >
              <div className="flex items-center space-x-3">
                <HelpCircle size={15} className="text-slate-400 dark:text-slate-550" />
                <span>{t('sidebar.help')}</span>
              </div>
              <ChevronRight size={14} className="text-slate-300 dark:text-slate-600" />
            </Link>

            <Link
              to="/profile"
              onClick={() => setShowSidebar(false)}
              className="flex items-center justify-between p-2 rounded-lg hover:bg-slate-50 dark:hover:bg-slate-800/40 text-slate-600 dark:text-slate-300 hover:text-brand-500 dark:hover:text-white transition-all font-semibold"
            >
              <div className="flex items-center space-x-3">
                <span className="text-slate-455">🚫</span>
                <span>{t('sidebar.cancelTicket')}</span>
              </div>
              <ChevronRight size={14} className="text-slate-300 dark:text-slate-600" />
            </Link>

            <Link
              to="/profile"
              onClick={() => setShowSidebar(false)}
              className="flex items-center justify-between p-2 rounded-lg hover:bg-slate-50 dark:hover:bg-slate-800/40 text-slate-600 dark:text-slate-300 hover:text-brand-500 dark:hover:text-white transition-all font-semibold"
            >
              <div className="flex items-center space-x-3">
                <span className="text-slate-455">🔄</span>
                <span>{t('sidebar.rescheduleTicket')}</span>
              </div>
              <ChevronRight size={14} className="text-slate-300 dark:text-slate-600" />
            </Link>

            <Link
              to="/"
              onClick={() => setShowSidebar(false)}
              className="flex items-center justify-between p-2 rounded-lg hover:bg-slate-50 dark:hover:bg-slate-800/40 text-slate-600 dark:text-slate-300 hover:text-brand-500 dark:hover:text-white transition-all font-semibold"
            >
              <div className="flex items-center space-x-3">
                <span className="text-slate-455">🔍</span>
                <span>{t('sidebar.searchTicket')}</span>
              </div>
              <ChevronRight size={14} className="text-slate-300 dark:text-slate-600" />
            </Link>

            {/* Language selector: opens a dropdown of supported languages, persisted via lang.setLanguage */}
            <div className="relative flex items-center justify-between p-2 text-slate-500 dark:text-slate-400 font-semibold">
              <div className="flex items-center space-x-3">
                <span className="text-slate-400 dark:text-slate-550 font-bold">Aa</span>
                <span>{t('sidebar.language')}</span>
              </div>
              <button
                type="button"
                onClick={() => setShowLangMenu((prev) => !prev)}
                className="flex items-center gap-1 text-slate-600 dark:text-slate-400 font-bold hover:text-brand-500 dark:hover:text-brand-400 transition-colors cursor-pointer"
              >
                <span>{LANGUAGES.find((l) => l.code === lang.language)?.label || 'English'}</span>
                <ChevronRight size={14} className={`transition-transform ${showLangMenu ? 'rotate-90' : ''}`} />
              </button>
              {showLangMenu && (
                <div className="absolute right-0 top-full mt-1 bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-xl shadow-xl overflow-hidden z-10 w-32">
                  {LANGUAGES.map((l) => (
                    <button
                      key={l.code}
                      type="button"
                      onClick={() => {
                        lang.setLanguage(l.code);
                        setShowLangMenu(false);
                      }}
                      className={`w-full text-left px-4 py-2 text-xs font-semibold hover:bg-slate-100 dark:hover:bg-slate-800 transition-colors cursor-pointer ${lang.language === l.code ? 'text-brand-500' : 'text-slate-600 dark:text-slate-300'}`}
                    >
                      {l.label}
                    </button>
                  ))}
                </div>
              )}
            </div>

            <div className="flex items-center justify-between p-2 text-slate-500 dark:text-slate-400 font-semibold">
              <div className="flex items-center space-x-3">
                <span className="text-slate-400 dark:text-slate-550">🔔</span>
                <span>{t('sidebar.notifications')}</span>
              </div>
              <ChevronRight size={14} className="text-slate-300 dark:text-slate-600" />
            </div>

            <div className="flex items-center justify-between p-2 text-slate-500 dark:text-slate-400 font-semibold">
              <div className="flex items-center space-x-3">
                <span className="text-slate-400 dark:text-slate-550">📍</span>
                <span>{t('sidebar.country')}</span>
              </div>
              <span className="text-slate-600 dark:text-slate-400 font-bold">India</span>
            </div>

            <div className="flex items-center justify-between p-2 text-slate-500 dark:text-slate-400 font-semibold">
              <div className="flex items-center space-x-3">
                <span className="text-slate-400 dark:text-slate-550">👩</span>
                <span>{t('sidebar.bookingForWomen')}</span>
              </div>
              <span className="text-emerald-600 dark:text-emerald-400 bg-emerald-500/5 dark:bg-emerald-500/10 border border-emerald-500/10 dark:border-emerald-500/20 px-2 py-0.5 rounded text-[9px] uppercase font-black">{t('sidebar.yes')}</span>
            </div>

            <div className="flex items-center justify-between p-2 text-slate-500 dark:text-slate-400 font-semibold">
              <div className="flex items-center space-x-3">
                <span className="text-slate-400 dark:text-slate-550">🔑</span>
                <span>{t('sidebar.passkey')}</span>
              </div>
              <ChevronRight size={14} className="text-slate-300 dark:text-slate-600" />
            </div>
          </div>

          {/* Section: Account Management */}
          <div className="p-4 space-y-2 bg-slate-50/50 dark:bg-slate-950/10">
            <button
              onClick={() => {
                setShowSidebar(false);
                handleLogout();
              }}
              className="w-full flex items-center justify-between p-2 rounded-lg hover:bg-rose-500/5 dark:hover:bg-rose-500/10 text-rose-600 dark:text-rose-400 transition-all font-semibold text-left cursor-pointer"
            >
              <div className="flex items-center space-x-3">
                <LogOut size={15} className="text-rose-500" />
                <span>{t('sidebar.logout')}</span>
              </div>
              <ChevronRight size={14} className="text-slate-300 dark:text-slate-600" />
            </button>

            <button
              onClick={() => {
                if (window.confirm("Are you sure you want to log out from all 3 registered devices?")) {
                  setShowSidebar(false);
                  handleLogout();
                }
              }}
              className="w-full flex items-center justify-between p-2 rounded-lg hover:bg-rose-500/5 dark:hover:bg-rose-500/10 text-rose-500/80 dark:text-rose-350 transition-all font-semibold text-left cursor-pointer"
            >
              <div className="flex items-center space-x-3">
                <LogOut size={15} className="text-rose-500 opacity-60" />
                <span>{t('sidebar.logoutAll')}</span>
              </div>
              <ChevronRight size={14} className="text-slate-300 dark:text-slate-600" />
            </button>
          </div>
        </div>
      </div>
    </>
  );
}

import React from 'react';
import { Bus, Heart } from 'lucide-react';

export default function Footer({ lang }) {
  const t = lang.t;

  return (
    <footer className="bg-slate-100 dark:bg-slate-950 border-t border-slate-200/50 dark:border-slate-900/50 py-12 transition-colors duration-300">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
        <div className="grid grid-cols-1 md:grid-cols-4 gap-8">
          {/* Brand Info */}
          <div className="space-y-4">
            <div className="flex items-center space-x-2">
              <div className="bg-brand-500 text-white p-1.5 rounded-lg">
                <Bus size={18} />
              </div>
              <span className="font-extrabold text-lg bg-gradient-to-r from-brand-500 to-rose-500 bg-clip-text text-transparent">
                New Bus
              </span>
            </div>
            <p className="text-sm text-slate-500 dark:text-slate-400 leading-relaxed">
              {t('footer.tagline')}
            </p>
          </div>

          {/* Quick Links */}
          <div>
            <h3 className="font-bold text-sm text-slate-800 dark:text-slate-200 uppercase tracking-wider mb-4">
              {t('footer.bookTickets')}
            </h3>
            <ul className="space-y-2 text-sm text-slate-500 dark:text-slate-400">
              <li><a href="#" className="hover:text-brand-500 transition-colors">{t('footer.searchBuses')}</a></li>
              <li><a href="#" className="hover:text-brand-500 transition-colors">{t('footer.popularRoutes')}</a></li>
              <li><a href="#" className="hover:text-brand-500 transition-colors">{t('footer.offersCoupons')}</a></li>
              <li><a href="#" className="hover:text-brand-500 transition-colors">{t('footer.schedulesRoutes')}</a></li>
            </ul>
          </div>

          {/* Support */}
          <div>
            <h3 className="font-bold text-sm text-slate-800 dark:text-slate-200 uppercase tracking-wider mb-4">
              {t('footer.supportHub')}
            </h3>
            <ul className="space-y-2 text-sm text-slate-500 dark:text-slate-400">
              <li><a href="#" className="hover:text-brand-500 transition-colors">{t('footer.cancellationRules')}</a></li>
              <li><a href="#" className="hover:text-brand-500 transition-colors">{t('footer.refundPolicies')}</a></li>
              <li><a href="#" className="hover:text-brand-500 transition-colors">{t('footer.helpTickets')}</a></li>
              <li><a href="#" className="hover:text-brand-500 transition-colors">{t('footer.termsOfService')}</a></li>
            </ul>
          </div>

          {/* Platforms */}
          <div>
            <h3 className="font-bold text-sm text-slate-800 dark:text-slate-200 uppercase tracking-wider mb-4">
              {t('footer.availablePlatforms')}
            </h3>
            <div className="space-y-2">
              <div className="bg-slate-200/50 dark:bg-slate-900/50 border border-slate-300/30 dark:border-slate-800/30 px-3 py-2 rounded-lg flex items-center space-x-2 text-xs">
                <span>🤖</span>
                <div>
                  <div className="font-semibold">{t('footer.androidStore')}</div>
                  <div className="text-[10px] text-slate-500">{t('footer.downloadApp')}</div>
                </div>
              </div>
              <div className="bg-slate-200/50 dark:bg-slate-900/50 border border-slate-300/30 dark:border-slate-800/30 px-3 py-2 rounded-lg flex items-center space-x-2 text-xs">
                <span>🍏</span>
                <div>
                  <div className="font-semibold">{t('footer.iosStore')}</div>
                  <div className="text-[10px] text-slate-500">{t('footer.downloadIos')}</div>
                </div>
              </div>
            </div>
          </div>
        </div>

        <div className="border-t border-slate-200/50 dark:border-slate-900/50 mt-12 pt-6 flex flex-col md:flex-row items-center justify-between text-xs text-slate-500">
          <div>© {new Date().getFullYear()} {t('footer.rightsReserved')}</div>
          <div className="flex items-center space-x-1 mt-4 md:mt-0">
            <span>{t('footer.madeWith')}</span>
            <Heart size={12} className="text-brand-500 fill-brand-500" />
            <span>{t('footer.forTravelers')}</span>
          </div>
        </div>
      </div>
    </footer>
  );
}

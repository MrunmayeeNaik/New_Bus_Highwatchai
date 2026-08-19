import { useState } from 'react';
import { translate } from '../i18n/translations';

// Reads/writes the selected UI language, persisted in localStorage across sessions
export function useLanguageStore() {
  const [language, setLanguageState] = useState(localStorage.getItem('language') || 'en');

  const setLanguage = (code) => {
    localStorage.setItem('language', code);
    setLanguageState(code);
  };

  // Shorthand translator bound to the currently selected language
  const t = (key) => translate(language, key);

  return { language, setLanguage, t };
}

import { useState, useEffect } from 'react';

export function useAuthStore() {
  const [user, setUser] = useState(null);
  const [wallet, setWallet] = useState({ balance: 100.0 });
  const [token, setToken] = useState(sessionStorage.getItem('access_token'));
  const [darkMode, setDarkMode] = useState(localStorage.getItem('theme') === 'dark');

  // Sync state with sessionStorage on initialization
  useEffect(() => {
    const savedUser = sessionStorage.getItem('user_profile');
    if (savedUser) {
      try {
        setUser(JSON.parse(savedUser));
      } catch (e) {
        sessionStorage.removeItem('user_profile');
      }
    }
  }, []);

  // Update theme document class when dark mode changes
  useEffect(() => {
    if (darkMode) {
      document.documentElement.classList.add('dark');
      localStorage.setItem('theme', 'dark');
    } else {
      document.documentElement.classList.remove('dark');
      localStorage.setItem('theme', 'light');
    }
  }, [darkMode]);

  const loginStore = (accessToken, refreshToken, roleName, userObj) => {
    sessionStorage.setItem('access_token', accessToken);
    sessionStorage.setItem('refresh_token', refreshToken);
    sessionStorage.setItem('user_role', roleName);
    sessionStorage.setItem('user_profile', JSON.stringify(userObj));
    setToken(accessToken);
    setUser(userObj);
    if (userObj.wallet) {
      setWallet(userObj.wallet);
    }
  };

  const logoutStore = () => {
    sessionStorage.clear();
    setToken(null);
    setUser(null);
    setWallet({ balance: 0.0 });
  };

  const deductWallet = (amount) => {
    setWallet((prev) => ({ ...prev, balance: Math.max(prev.balance - amount, 0) }));
  };

  const addWallet = (amount) => {
    setWallet((prev) => ({ ...prev, balance: prev.balance + amount }));
  };

  return {
    user,
    token,
    wallet,
    darkMode,
    setDarkMode,
    loginStore,
    logoutStore,
    deductWallet,
    addWallet,
    setUser,
    setWallet,
  };
}

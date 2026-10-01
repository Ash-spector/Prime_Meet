import React, { useEffect, useState } from 'react';
import { Layers } from 'lucide-react';
import {
  api,
  clearClientCache,
  getStoredToken,
  setStoredToken,
} from './client/api.ts';
import { LoginView } from './components/LoginView.tsx';
import { PrimeMeetWorkspace } from './components/PrimeMeetWorkspace.tsx';
import { User } from './shared/types.ts';

export default function App() {
  const [user, setUser] = useState<User | null>(null);
  const [initializing, setInitializing] = useState<boolean>(true);
  const [darkMode, setDarkMode] = useState<boolean>(() => {
    const saved = localStorage.getItem('primemeet_theme_v2');
    return saved === 'dark';
  });

  useEffect(() => {
    const root = document.documentElement;
    if (darkMode) {
      root.classList.add('dark');
      localStorage.setItem('primemeet_theme_v2', 'dark');
    } else {
      root.classList.remove('dark');
      localStorage.setItem('primemeet_theme_v2', 'light');
    }
  }, [darkMode]);

  useEffect(() => {
    const token = getStoredToken();
    if (!token) {
      setInitializing(false);
      return;
    }
    api
      .getMe()
      .then((res) => {
        setUser(res.user);
      })
      .catch(() => {
        clearClientCache();
        setStoredToken(null);
        setUser(null);
      })
      .finally(() => {
        setInitializing(false);
      });
  }, []);

  const handleAuthenticated = (authenticatedUser: User) => {
    clearClientCache();
    setUser(authenticatedUser);
  };

  const handleLogout = async () => {
    await api.logout();
    clearClientCache();
    setUser(null);
  };

  const handleQuickSwitchUser = async (email: string) => {
    clearClientCache();
    const cfg = await api.getDevConfig();
    const pw = cfg.demoPassword || 'PrimeMeet2026!';
    const res = await api.login(email, pw);
    setUser(res.user);
  };

  if (initializing) {
    return (
      <div className="min-h-screen w-full flex flex-col items-center justify-center bg-[#F8FAFC] dark:bg-[#0F172A] text-slate-900 dark:text-slate-100 gap-3">
        <div className="w-11 h-11 rounded-2xl btn-3d-primary flex items-center justify-center text-white animate-pulse">
          <Layers className="w-5 h-5" />
        </div>
        <div className="text-xs font-semibold text-slate-500 dark:text-slate-400">
          Loading PrimeMeet Workspace...
        </div>
      </div>
    );
  }

  if (!user) {
    return (
      <LoginView
        onAuthenticated={handleAuthenticated}
        darkMode={darkMode}
        onToggleDarkMode={() => setDarkMode((d) => !d)}
      />
    );
  }

  return (
    <PrimeMeetWorkspace
      key={user.id}
      user={user}
      onUserUpdated={(updated) => setUser(updated)}
      onLogout={handleLogout}
      onQuickSwitchUser={handleQuickSwitchUser}
      darkMode={darkMode}
      onToggleDarkMode={() => setDarkMode((d) => !d)}
    />
  );
}

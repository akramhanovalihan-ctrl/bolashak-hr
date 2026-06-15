import { createContext, useContext, useEffect, useState, type ReactNode } from 'react';
import { api, type User } from '../api/client';

interface AuthContextValue {
  user: User | null;
  loading: boolean;
  login: (email: string, password: string, remember?: boolean) => Promise<void>;
  logout: () => Promise<void>;
}

const AuthContext = createContext<AuthContextValue | null>(null);

export function AuthProvider({ children }: { children: ReactNode }) {
  const [user, setUser] = useState<User | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    api.me()
      .then(({ user }) => setUser(user))
      .catch(() => setUser(null))
      .finally(() => setLoading(false));
  }, []);

  const login = async (email: string, password: string, remember = false) => {
    const { user } = await api.login(email, password, remember);
    setUser(user);
    localStorage.setItem('bolashak_remember', remember ? '1' : '0');
    if (remember) {
      localStorage.setItem('bolashak_last_email', email);
    } else {
      localStorage.removeItem('bolashak_last_email');
    }
  };

  const logout = async () => {
    await api.logout();
    setUser(null);
    localStorage.removeItem('bolashak_last_email');
  };

  return (
    <AuthContext.Provider value={{ user, loading, login, logout }}>
      {children}
    </AuthContext.Provider>
  );
}

export function useAuth() {
  const ctx = useContext(AuthContext);
  if (!ctx) throw new Error('useAuth must be used within AuthProvider');
  return ctx;
}

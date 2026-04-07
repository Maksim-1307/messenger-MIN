import { createContext, useContext, useState, useEffect, useCallback } from 'react';
import { useNavigate } from 'react-router-dom';
import type { User, LoginCredentials, RegisterCredentials, AuthContextType } from '../types/auth';
import { api } from '../utils/api';

const AuthContext = createContext<AuthContextType | null>(null);

const TOKEN_KEY = 'auth_token';
const USER_KEY = 'auth_user';

const getTokenFromStorage = (): string | null => {
  return localStorage.getItem(TOKEN_KEY);
};

const getUserFromStorage = (): User | null => {
  const userStr = localStorage.getItem(USER_KEY);
  if (!userStr) return null;
  try {
    return JSON.parse(userStr);
  } catch {
    return null;
  }
};

const setAuthData = (token: string, user: User): void => {
  localStorage.setItem(TOKEN_KEY, token);
  localStorage.setItem(USER_KEY, JSON.stringify(user));
};

const clearAuthData = (): void => {
  localStorage.removeItem(TOKEN_KEY);
  localStorage.removeItem(USER_KEY);
};

export const AuthProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const [user, setUser] = useState<User | null>(getUserFromStorage);
  const [token, setToken] = useState<string | null>(getTokenFromStorage);
  const [isLoading, setIsLoading] = useState(true);

  const navigate = useNavigate();

  useEffect(() => {
    const fetchUserProfile = async () => {
      if (!token) {
        setIsLoading(false);
        return;
      }

      try {
        const response = await api.get<{ user: User }>('/api/users/me', token);
        setUser(response.user);
        localStorage.setItem(USER_KEY, JSON.stringify(response.user));
      } catch (error) {
        console.error('Failed to fetch user profile:', error);
        // Only clear auth if the server rejected the token (401)
        // Don't clear on network errors (server down, CORS, etc.)
        if (error instanceof Error && 'status' in error && (error as any).status === 401) {
          clearAuthData();
          setUser(null);
          setToken(null);
        }
      } finally {
        setIsLoading(false);
      }
    };

    fetchUserProfile();
  }, [token]);

  const login = useCallback(async (credentials: LoginCredentials): Promise<void> => {
    const response = await api.post<{ token: string; user: { id: number; username: string } }>(
      '/api/auth/login',
      credentials
    );

    const user: User = {
      id: response.user.id,
      username: response.user.username,
      displayName: response.user.username,
      role: 'visitor',
    };

    setToken(response.token);
    setUser(user);
    setAuthData(response.token, user);
  }, []);

  const register = useCallback(async (credentials: RegisterCredentials): Promise<void> => {
    const formData = new FormData();
    formData.append('username', credentials.username);
    formData.append('password', credentials.password);
    if (credentials.displayName) {
      formData.append('displayName', credentials.displayName);
    }
    if (credentials.avatar) {
      formData.append('avatar', credentials.avatar);
    }

    await api.uploadFile<{ message: string }>('/api/auth/register', formData);

    await login({ username: credentials.username, password: credentials.password });
  }, [login]);

  const logout = useCallback((): void => {
    clearAuthData();
    setUser(null);
    setToken(null);
    navigate('/login', { replace: true });
  }, []);

  const updateUser = useCallback((userData: Partial<User>): void => {
    setUser(prev => prev ? { ...prev, ...userData } : null);
    if (user) {
      const updatedUser = { ...user, ...userData };
      localStorage.setItem(USER_KEY, JSON.stringify(updatedUser));
    }
  }, [user]);

  const isTokenValid = useCallback((token: string): boolean => {
    try {
      const decoded = JSON.parse(atob(token.split('.')[1]));
      return decoded.exp > Date.now() / 1000;
    } catch {
      return false;
    }
  }, []);

  const requireAuth = useCallback((redirectPath: string = '/login'): boolean => {
    if (!token) {
      navigate(redirectPath, { replace: true });
      return false;
    }
    return true;
  }, [navigate, token]);

  const value: AuthContextType = {
    user,
    token,
    isAuthenticated: !!user && !!token,
    isAdmin: user?.role === 'admin' || false,
    isLoading,
    requireAuth,
    login,
    register,
    logout,
    updateUser,
  };

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
};

export const useAuth = (): AuthContextType => {
  const context = useContext(AuthContext);
  if (!context) {
    throw new Error('useAuth must be used within an AuthProvider');
  }
  return context;
};

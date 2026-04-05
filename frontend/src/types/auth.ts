export interface User {
  id: number;
  username: string;
  displayName: string;
  avatarUrl?: string | null;
  role: 'visitor' | 'admin';
}

export interface LoginCredentials {
  username: string;
  password: string;
}

export interface RegisterCredentials {
  username: string;
  password: string;
  displayName: string;
  avatar?: File | null;
}

export interface LoginResponse {
  token: string;
  user: {
    id: number;
    username: string;
  };
}

export interface AuthContextType {
  user: User | null;
  token: string | null;
  isAuthenticated: boolean;
  isAdmin: boolean;
  isLoading: boolean;
  login: (credentials: LoginCredentials) => Promise<void>;
  register: (credentials: RegisterCredentials) => Promise<void>;
  logout: () => void;
  updateUser: (userData: Partial<User>) => void;
}

export interface UserProfileUpdate {
  displayName?: string;
  avatar?: File | null;
  removeAvatar?: boolean;
}

export interface ApiResponse<T = unknown> {
  message: string;
  data?: T;
  error?: string;
}

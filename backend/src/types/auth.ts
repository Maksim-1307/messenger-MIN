export interface User {
  id: string;
  username: string;
  password: string;
}

export interface JWTPayload {
  userId: string;
  username: string;
  userRole: 'admin' | 'visitor';
}

export interface LoginResponse {
  token: string;
  user: {
    id: string;
    username: string;
  };
}

export type RegisterResult = 'USER_EXISTS' | 'SUCCESS';

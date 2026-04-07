import { api, toFullUrl } from '../utils/api';

export interface UserProfile {
  id: string;
  username: string;
  displayName: string;
  role: string;
  email: string | null;
  description: string | null;
  avatarUrl: string | null;
  createdAt: string;
}

export interface UserProfileResponse {
  message: string;
  user: UserProfile;
}

export const userApi = {
  getUserProfile: (token: string, userId: string) => {
    return api.get<UserProfileResponse>(`/api/users/${userId}`, token);
  },
};

export { toFullUrl };

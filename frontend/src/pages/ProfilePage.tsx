import { useState, useEffect, type FormEvent, type ChangeEvent, useRef } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '../hooks/useAuth';
import { api, toFullUrl } from '../utils/api';
import { Input } from '../components/ui/Input';
import { Button } from '../components/ui/Button';
import type { User } from '../types/auth';
import styles from './ProfilePage.module.scss';

interface UserProfile {
  id: number;
  username: string;
  displayName: string;
  email: string | null;
  description: string | null;
  avatarUrl: string | null;
  role: string;
}

export const ProfilePage: React.FC = () => {
  const { token, updateUser, logout } = useAuth();
  const navigate = useNavigate();
  const [profile, setProfile] = useState<UserProfile | null>(null);
  const [isEditing, setIsEditing] = useState(false);
  const [isLoading, setIsLoading] = useState(true);
  const [isSaving, setIsSaving] = useState(false);
  const [error, setError] = useState('');
  const [success, setSuccess] = useState('');
  
  // Form state
  const [username, setUsername] = useState('');
  const [displayName, setDisplayName] = useState('');
  const [email, setEmail] = useState('');
  const [description, setDescription] = useState('');
  const [avatar, setAvatar] = useState<File | null>(null);
  const [avatarPreview, setAvatarPreview] = useState<string | null>(null);
  const [removeAvatar, setRemoveAvatar] = useState(false);
  const [usernameChanged, setUsernameChanged] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    const fetchProfile = async () => {
      if (!token) return;

      try {
        const response = await api.get<{ user: UserProfile }>('/api/users/me', token);
        setProfile(response.user);
        setUsername(response.user.username);
        setDisplayName(response.user.displayName);
        setEmail(response.user.email || '');
        setDescription(response.user.description || '');
        setAvatarPreview(toFullUrl(response.user.avatarUrl));
      } catch (err) {
        setError('Failed to load profile');
        console.error(err);
      } finally {
        setIsLoading(false);
      }
    };

    fetchProfile();
  }, [token]);

  const handleAvatarChange = (e: ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) {
      if (!file.type.startsWith('image/')) {
        setError('Only image files are allowed');
        return;
      }
      if (file.size > 5 * 1024 * 1024) {
        setError('Image size must be less than 5MB');
        return;
      }
      setAvatar(file);
      setRemoveAvatar(false);
      const reader = new FileReader();
      reader.onloadend = () => {
        setAvatarPreview(reader.result as string);
      };
      reader.readAsDataURL(file);
      setError('');
    }
  };

  const handleRemoveAvatar = () => {
    setAvatar(null);
    setAvatarPreview(null);
    setRemoveAvatar(true);
    fileInputRef.current!.value = '';
  };

  const handleSubmit = async (e: FormEvent) => {
    e.preventDefault();
    setError('');
    setSuccess('');
    setIsSaving(true);

    try {
      // Update profile fields
      const updateData: any = {
        username,
        displayName,
        email: email || null,
        description: description || null,
      };

      await api.put<{ user: UserProfile }>('/api/users/me', updateData, token);

      // Upload avatar if changed
      if (avatar) {
        const formData = new FormData();
        formData.append('avatar', avatar);
        await api.uploadFile<{ avatar: string }>('/api/users/avatar', formData, token);
      } else if (removeAvatar) {
        await api.delete('/api/users/avatar', token);
      }

      // Fetch updated profile
      const updatedResponse = await api.get<{ user: UserProfile; token?: string }>('/api/users/me', token);
      setProfile(updatedResponse.user);

      // Update auth context
      updateUser({
        username: updatedResponse.user.username,
        displayName: updatedResponse.user.displayName,
      } as Partial<User>);

      setIsEditing(false);
      setSuccess('Profile updated successfully');
      setAvatar(null);
      setRemoveAvatar(false);

      // Logout if username was changed
      if (usernameChanged) {
        localStorage.removeItem('auth_token');
        localStorage.removeItem('auth_user');
        window.location.replace('/login');
        return;
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to update profile');
    } finally {
      setIsSaving(false);
    }
  };

  const handleCancelEdit = () => {
    if (!profile) return;
    setUsername(profile.username);
    setDisplayName(profile.displayName);
    setEmail(profile.email || '');
    setDescription(profile.description || '');
    setAvatarPreview(toFullUrl(profile.avatarUrl));
    setAvatar(null);
    setRemoveAvatar(false);
    setUsernameChanged(false);
    setIsEditing(false);
    setError('');
  };

  if (isLoading) {
    return <div className={styles.profile__loading}>Loading...</div>;
  }

  if (!profile) {
    return <div className={styles.profile__error}>Failed to load profile</div>;
  }

  return (
    <div className={styles.profile}>
      <div className={styles.profile__container}>
        <h1 className={styles.profile__title}>Profile</h1>

        <div className={styles.profile__avatar}>
          {avatarPreview ? (
            <img src={avatarPreview} alt="Avatar" />
          ) : (
            <div className={styles.profile__avatarPlaceholder}>No Avatar</div>
          )}
        </div>

        {error && <div className={styles.profile__error}>{error}</div>}
        {success && <div className={styles.profile__success}>{success}</div>}

        {!isEditing ? (
          <div className={styles.profile__info}>
            <div className={styles.profile__field}>
              <label className={styles.profile__fieldLabel}>Username</label>
              <p className={styles.profile__fieldValue}>{profile.username}</p>
            </div>
            <div className={styles.profile__field}>
              <label className={styles.profile__fieldLabel}>Display Name</label>
              <p className={styles.profile__fieldValue}>{profile.displayName}</p>
            </div>
            {profile.email && (
              <div className={styles.profile__field}>
                <label className={styles.profile__fieldLabel}>Email</label>
                <p className={styles.profile__fieldValue}>{profile.email}</p>
              </div>
            )}
            {profile.description && (
              <div className={styles.profile__field}>
                <label className={styles.profile__fieldLabel}>Description</label>
                <p className={styles.profile__fieldValue}>{profile.description}</p>
              </div>
            )}
            <div className={styles.profile__actions}>
              <Button onClick={() => setIsEditing(true)} variant="primary">
                Edit Profile
              </Button>
              <Button onClick={logout} variant="danger">
                Logout
              </Button>
            </div>
          </div>
        ) : (
          <form onSubmit={handleSubmit} className={styles.profile__form}>
            <Input
              label="Username"
              value={username}
              onChange={(e: ChangeEvent<HTMLInputElement>) => {
                setUsername(e.target.value);
                setUsernameChanged(e.target.value !== profile?.username);
              }}
              required
            />
            {usernameChanged && (
              <div className={styles.profile__warning}>
                ⚠️ Changing your username will log you out
              </div>
            )}
            <Input
              label="Display Name"
              value={displayName}
              onChange={(e: ChangeEvent<HTMLInputElement>) => setDisplayName(e.target.value)}
              required
            />
            <Input
              label="Email (optional)"
              type="email"
              value={email}
              onChange={(e: ChangeEvent<HTMLInputElement>) => setEmail(e.target.value)}
            />
            <div className={styles.profile__textarea}>
              <label className={styles.profile__fieldLabel}>Description (optional)</label>
              <textarea
                value={description}
                onChange={(e: ChangeEvent<HTMLTextAreaElement>) => setDescription(e.target.value)}
                rows={4}
                className={styles.profile__textareaField}
              />
            </div>

            <div className={styles.profile__avatarUpload}>
              <label className={styles.profile__fieldLabel}>Avatar</label>
              <div className={styles.profile__avatarControls}>
                {avatarPreview && (
                  <Button type="button" variant="secondary" onClick={handleRemoveAvatar}>
                    Remove Avatar
                  </Button>
                )}
                <Button
                  type="button"
                  variant="secondary"
                  onClick={() => fileInputRef.current?.click()}
                >
                  {avatarPreview ? 'Change Avatar' : 'Upload Avatar'}
                </Button>
              </div>
              <input
                ref={fileInputRef}
                type="file"
                accept="image/*"
                onChange={handleAvatarChange}
                className={styles.profile__avatarInput}
              />
            </div>

            <div className={styles.profile__formActions}>
              <Button type="submit" variant="primary" disabled={isSaving}>
                {isSaving ? 'Saving...' : 'Save Changes'}
              </Button>
              <Button type="button" variant="secondary" onClick={handleCancelEdit}>
                Cancel
              </Button>
            </div>
          </form>
        )}
      </div>
    </div>
  );
};

import { useState, useEffect } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { useAuth } from '../hooks/useAuth';
import { userApi, toFullUrl } from '../api/users';
import { Button } from '../components/ui/Button';
import type { UserProfile } from '../api/users';
import styles from './UserProfilePage.module.scss';
import { Icon } from '@iconify/react';

export const UserProfilePage: React.FC = () => {
  const { userId } = useParams<{ userId: string }>();
  const { token, requireAuth } = useAuth();
  const navigate = useNavigate();

  const [profile, setProfile] = useState<UserProfile | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState('');

  // check if user is authenticated
  useEffect(() => {
    requireAuth('/login');
  }, [requireAuth]);

  useEffect(() => {
    const fetchUserProfile = async () => {
      if (!token || !userId) return;

      try {
        const response = await userApi.getUserProfile(token, userId);
        setProfile(response.user);
      } catch (err) {
        setError('Failed to load user profile');
        console.error(err);
      } finally {
        setIsLoading(false);
      }
    };

    fetchUserProfile();
  }, [token, userId]);

  if (isLoading) {
    return <div className={styles.profile__loading}>Loading...</div>;
  }

  if (!profile) {
    return (
      <div className={styles.profile__error}>
        {error || 'Failed to load user profile'}
      </div>
    );
  }

  return (
    <div className={styles.profile}>
      <div className={styles.profile__container}>
        <div className={styles.profile__header}>
          <button
            className={`${styles.profile__back} glass`}
            onClick={() => navigate(-1)}
          >
            <Icon icon="tabler:arrow-left" width={20} />
          </button>
          <h1 className={styles.profile__title}>{profile.displayName}</h1>
        </div>

        <div className={styles.profile__avatar}>
          {profile.avatarUrl ? (
            <img src={toFullUrl(profile.avatarUrl) ?? ''} alt={`${profile.displayName}'s avatar`} />
          ) : (
            <div className={styles.profile__avatarPlaceholder}>
              <span>{profile.displayName?.charAt(0).toUpperCase()}</span>
            </div>
          )}
        </div>

        <div className={styles.profile__info}>
          <div className={styles.profile__field}>
            <label className={styles.profile__fieldLabel}>Display Name</label>
            <p className={styles.profile__fieldValue}>{profile.displayName}</p>
          </div>

          <div className={styles.profile__field}>
            <label className={styles.profile__fieldLabel}>Username</label>
            <p className={styles.profile__fieldValue}>@{profile.username}</p>
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

          <div className={styles.profile__field}>
            <label className={styles.profile__fieldLabel}>Role</label>
            <p className={styles.profile__fieldValue}>{profile.role}</p>
          </div>

          <div className={styles.profile__field}>
            <label className={styles.profile__fieldLabel}>Joined</label>
            <p className={styles.profile__fieldValue}>
              {new Date(profile.createdAt).toLocaleDateString('en-US', {
                year: 'numeric',
                month: 'long',
                day: 'numeric',
              })}
            </p>
          </div>

          <div className={styles.profile__actions}>
            <Button
              onClick={() => navigate(`/chat/${userId}`)}
              variant="primary"
            >
              <Icon icon="tabler:message" width={18} />
              Send Message
            </Button>
          </div>
        </div>
      </div>
    </div>
  );
};

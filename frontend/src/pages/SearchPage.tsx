import { useState, useEffect, useCallback } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '../hooks/useAuth';
import { userApi, toFullUrl } from '../api/users';
import type { UserProfile } from '../api/users';
import { Icon } from '@iconify/react';
import styles from './SearchPage.module.scss';

export const SearchPage: React.FC = () => {
  const { token, isAuthenticated, isLoading: authLoading, requireAuth } = useAuth();
  const navigate = useNavigate();

  const [query, setQuery] = useState('');
  const [result, setResult] = useState<UserProfile | null>(null);
  const [isSearching, setIsSearching] = useState(false);
  const [notFound, setNotFound] = useState(false);
  const [hasSearched, setHasSearched] = useState(false);

  // Auth check
  useEffect(() => {
    if (!authLoading && !isAuthenticated) {
      requireAuth('/login');
    }
  }, [authLoading, isAuthenticated, requireAuth]);

  // Debounced search
  const searchUser = useCallback(async (username: string) => {
    if (!token || !username.trim()) {
      setResult(null);
      setNotFound(false);
      setHasSearched(false);
      return;
    }

    setIsSearching(true);
    setNotFound(false);
    setHasSearched(true);

    try {
      const response = await userApi.findUserByUsername(token, username.trim());
      setResult(response.user);
      setNotFound(false);
    } catch {
      setResult(null);
      setNotFound(true);
    } finally {
      setIsSearching(false);
    }
  }, [token]);

  useEffect(() => {
    const timeoutId = setTimeout(() => {
      searchUser(query);
    }, 400);

    return () => clearTimeout(timeoutId);
  }, [query, searchUser]);

  const handleUserClick = () => {
    if (result) {
      navigate(`/chats/${result.id}/info`);
    }
  };

  if (authLoading) {
    return <div className={styles.loading}>Loading...</div>;
  }

  if (!isAuthenticated) {
    return null;
  }

  return (
    <div className={styles.search}>
      <div className={styles.search__container}>
        <h1 className={styles.search__title}>Find User</h1>

        <div className={styles.search__inputWrapper}>
          <Icon icon="tabler:search" width={20} className={styles.search__inputIcon} />
          <input
            type="text"
            className={styles.search__input}
            placeholder="Enter username..."
            value={query}
            onChange={(e) => setQuery(e.target.value)}
          />
          {query && (
            <button
              className={styles.search__clear}
              onClick={() => setQuery('')}
            >
              <Icon icon="tabler:x" width={18} />
            </button>
          )}
        </div>

        {isSearching && (
          <div className={styles.search__loading}>Searching...</div>
        )}

        {!isSearching && notFound && (
          <div className={styles.search__notFound}>
            <Icon icon="tabler:user-x" width={48} />
            <p>User not found</p>
          </div>
        )}

        {!isSearching && result && (
          <div className={styles.search__result} onClick={handleUserClick}>
            <div className={styles.search__resultAvatar}>
              {result.avatarUrl ? (
                <img src={toFullUrl(result.avatarUrl) ?? ''} alt={`${result.displayName}'s avatar`} />
              ) : (
                <div className={styles.search__resultAvatarPlaceholder}>
                  <Icon icon="tabler:user" width={32} />
                </div>
              )}
            </div>
            <div className={styles.search__resultInfo}>
              <p className={styles.search__resultName}>{result.displayName || result.username}</p>
              <p className={styles.search__resultUsername}>@{result.username}</p>
            </div>
            <Icon icon="tabler:chevron-right" width={20} className={styles.search__resultArrow} />
          </div>
        )}
      </div>
    </div>
  );
};

import { useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '../hooks/useAuth';
import styles from './HomePage.module.scss';
import { Icon } from '@iconify/react';
import { NotificationToggle } from '../components/NotificationToggle';

export const HomePage: React.FC = () => {
  const { isAuthenticated, isLoading } = useAuth();
  const navigate = useNavigate();

  useEffect(() => {
    if (!isLoading && !isAuthenticated) {
      navigate('/login', { replace: true });
    }
  }, [isAuthenticated, isLoading, navigate]);

  if (isLoading) {
    return <div>Loading...</div>;
  }

  if (!isAuthenticated) {
    return null;
  }

  return (
    <div className={styles.home}>
      <h1 className={styles.home__title}>Welcome to Messenger MIN</h1>
      <p className={styles.home__subtitle}>
        A modern messaging platform for seamless communication
      </p>
      <NotificationToggle />
      <div className={styles.home__actions}>
        <button onClick={() => navigate('/chats', { replace: true })} className={styles.home__action}>
          Start chatting
          <Icon icon="tabler:arrow-right" />
        </button>
      </div>
    </div>
  );
};

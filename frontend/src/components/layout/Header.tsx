import { Link, useLocation, useNavigate } from 'react-router-dom';
import { useAuth } from '../../hooks/useAuth';
import styles from './Header.module.scss';
import { Icon } from '@iconify/react';

export const Header: React.FC = () => {
  const { isAuthenticated } = useAuth();
  const location = useLocation();
  const navigate = useNavigate();

  const isActive = (path: string) => location.pathname === path;

  return (
    <header className={styles.header}>
      <div className={styles.header__container}>
        <Link to="/chats" className={styles.header__logo}>
          <img src="/favicon.png" alt="Logo" />
          <span>MIN</span>
        </Link>

        <nav className={styles.header__nav}>
          {isAuthenticated ? (
            <>
              <Icon onClick={() => navigate('/search', { replace: true })} icon="jam:write" width={20} />
            </>
          ) : (
            <>
              <Link
                to="/login"
                className={`${styles.header__link} ${isActive('/login') ? styles['header__link--active'] : ''}`}
              >
                Login
              </Link>
              <Link
                to="/register"
                className={`${styles.header__link} ${isActive('/register') ? styles['header__link--active'] : ''}`}
              >
                Register
              </Link>
            </>
          )}
        </nav>
      </div>
    </header>
  );
};

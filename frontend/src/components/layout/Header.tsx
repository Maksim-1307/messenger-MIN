import { Link, useLocation } from 'react-router-dom';
import { useAuth } from '../../hooks/useAuth';
import styles from './Header.module.scss';

export const Header: React.FC = () => {
  const { isAuthenticated, user, logout } = useAuth();
  const location = useLocation();

  const isActive = (path: string) => location.pathname === path;

  return (
    <header className={styles.header}>
      <div className={styles.header__container}>
        <Link to="/" className={styles.header__logo}>
          Messenger MIN
        </Link>

        <nav className={styles.header__nav}>
          {isAuthenticated ? (
            <>
              <Link
                to="/profile"
                className={`${styles.header__link} ${isActive('/profile') ? styles['header__link--active'] : ''}`}
              >
                Profile
              </Link>
              <span className={styles.header__user}>
                {user?.displayName || user?.username}
              </span>
              <button onClick={logout} className={styles.header__logout}>
                Logout
              </button>
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

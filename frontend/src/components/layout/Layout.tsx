import { Outlet } from 'react-router-dom';
import { Header } from './Header';
import styles from './Layout.module.scss';

export const Layout: React.FC = () => {
  return (
    <div className={styles.layout}>
      <Header />
      <main className={styles.layout__main}>
        <Outlet />
      </main>
    </div>
  );
};

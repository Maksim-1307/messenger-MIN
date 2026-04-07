import { Outlet } from 'react-router-dom';
import { Header } from './Header';
import styles from './Layout.module.scss';
import { BottomNavigation } from './BottomNavigation';

export const Layout: React.FC = () => {
  return (
    <div className={styles.layout}>
      <Header />
      <main className={styles.layout__main}>
        <Outlet />
      </main>
      <BottomNavigation items={[
        // {
        //   icon: 'fluent:settings-32-regular',
        //   path: '/settings',
        //   label: 'Settings'
        // },
        {
          icon: 'ph:magnifying-glass',
          path: '/search',
          label: 'Search'
        },
        {
          icon: 'ph:chats-circle',
          path: '/chats',
          label: 'Chats'
        },
        {
          icon: 'ph:user-circle',
          path: '/profile',
          label: 'Profile'
        },
      ]} />
    </div>
  );
};

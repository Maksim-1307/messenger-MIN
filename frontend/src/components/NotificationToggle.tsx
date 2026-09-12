// components/NotificationToggle.tsx
import { useWebPush } from '../hooks/useWebPush';

export const NotificationToggle = () => {
  const { isSupported, isSubscribed, isLoading, error, subscribe, unsubscribe } = useWebPush();

  if (!isSupported) return <span>Уведомления не поддерживаются</span>;

  return (
    <div>
      <button
        onClick={isSubscribed ? unsubscribe : subscribe}
        disabled={isLoading}
      >
        {isLoading
          ? 'Загрузка...'
          : isSubscribed
            ? 'Отключить уведомления'
            : 'Включить уведомления'}
      </button>
      {error && <p style={{ color: 'red' }}>{error}</p>}
    </div>
  );
};
import React, { useState } from 'react';
import { urlBase64ToUint8Array } from './utils';

export const PushSubscriber = () => {
  const [isSubscribed, setIsSubscribed] = useState(false);

  const subscribeUser = async () => {
    try {

      if (!('serviceWorker' in navigator) || !('PushManager' in window)) {
        alert('Push-уведомления не поддерживаются вашим браузером');
        return;
      }

      const permission = await Notification.requestPermission();
      if (permission !== 'granted') {
        alert('Вы отклонили разрешение на уведомления');
        return;
      }

      const registration = await navigator.serviceWorker.register('/sw.js');
      await navigator.serviceWorker.ready;

      const response = await fetch('http://localhost:5000/api/vapid-public-key');
      const { publicKey } = await response.json();
      const convertedVapidKey = urlBase64ToUint8Array(publicKey);

      const subscription = await registration.pushManager.subscribe({
        userVisibleOnly: true, // Уведомления всегда видны пользователю
        applicationServerKey: convertedVapidKey
      });

      await fetch('http://localhost:5000/api/subscribe', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(subscription)
      });

      setIsSubscribed(true);
      alert('Подписка на уведомления успешно оформлена!');
    } catch (error) {
      console.error('Ошибка подписки:', error);
    }
  };

  return (
    <div>
      <button onClick={subscribeUser} disabled={isSubscribed}>
        {isSubscribed ? 'Уведомления включены' : 'Включить Push-уведомления'}
      </button>
    </div>
  );
};
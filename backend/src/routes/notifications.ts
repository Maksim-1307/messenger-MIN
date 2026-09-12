import { Router } from 'express';
import webpush from 'web-push';
import express, { type Request, type Response } from 'express';

const router = Router();

// 1. Генерация VAPID ключей (в реальности создаются 1 раз и хранятся в .env)
// const vapidKeys = webpush.generateVAPIDKeys();
const PUBLIC_VAPID_KEY = "BNaXaRlLUcsJr4CaN8p5jljW0i3Xb7PSoWq-DFA-XozgNGe1dUUsPA0Z6CzDH5vBQq8xAHVKSBASnQas63daCI0";
const PRIVATE_VAPID_KEY = "C6iAa-ylUknycKqrzexezXqOsow56XZrWrE0D5zl6Mw";

webpush.setVapidDetails(
  'mailto:admin@example.com', // Контактный email для вендора Push Service
  PUBLIC_VAPID_KEY,
  PRIVATE_VAPID_KEY
);

// Массив или таблица в БД для хранения подписок пользователей
let subscriptions: PushSubscription[] = [];

// Ручка 1: Отдать публичный ключ клиенту
router.get('/vapid-public-key', (req: Request, res: Response) => {
  res.json({ publicKey: PUBLIC_VAPID_KEY });
});

// Ручка 2: Сохранить подписку от React-приложения
router.post('/subscribe', (req: Request, res: Response) => {
  const subscription = req.body; // Объект PushSubscription
  subscriptions.push(subscription); // Сохраняем в БД
  res.status(201).json({ status: 'ok' });
});

// Ручка 3: Инициировать отправку push-уведомления
router.post('/send-notification', async (req: Request, res: Response) => {
  const { title, message } = req.body;

  const payload = JSON.stringify({
    title: title || 'Новое уведомление',
    body: message || 'У вас новое сообщение!',
    icon: '/icon-192x192.png'
  });

  // Рассылаем по всем сохраненным подпискам
  const sendPromises = subscriptions.map(sub => 
    webpush.sendNotification(sub, payload).catch(err => {
      // Если подписка недействительна (код 410 или 404), удаляем её из БД
      if (err.statusCode === 410 || err.statusCode === 404) {
        subscriptions = subscriptions.filter(s => s.endpoint !== sub.endpoint);
      }
      console.error('Ошибка отправки:', err);
    })
  );

  await Promise.all(sendPromises);
  res.status(200).json({ status: 'ok' });
});

router.post('/verify', (req: Request, res: Response) => {
  const subscription = req.body;
  let found = false;
  for (const sub of subscriptions) {
      if (sub.endpoint === subscription.endpoint) {
          found = true;
          break;
      }
    }
  res.status(200).json({ status: found ? 'ok' : 'error' });
});

export { router };
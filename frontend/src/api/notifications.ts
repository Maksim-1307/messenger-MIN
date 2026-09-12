import { api, toFullUrl } from '../utils/api';
import type {
    SubscribeResponse,
    UnsubscribeResponse,
    VerifyResponse,
    VapidPublicKeyResponse
} from '../types/notifications';

export const notificationsApi = {
    getVapidPublicKey: (token: string) => {
        return api.get<VapidPublicKeyResponse>('/api/notifications/vapid-public-key', token);
    },
    subscribe: (token: string, subscription: PushSubscription) => {
        return api.post<SubscribeResponse>('/api/notifications/subscribe', subscription, token);
    },
    verify: (token: string, subscription: PushSubscription) => {
        return api.post<VerifyResponse>('/api/notifications/verify', subscription, token);
    },
    unsubscribe: (token: string, subscription: PushSubscription) => {
        return api.post<UnsubscribeResponse>('/api/notifications/unsubscribe', subscription, token);
    }
};
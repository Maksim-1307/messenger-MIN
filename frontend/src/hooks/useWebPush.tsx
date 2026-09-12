import { 
    createContext, 
    useContext, 
    useState, 
    useEffect, 
    useRef, 
    useCallback 
} from 'react';
import { api } from '../utils/api';
import { urlBase64ToUint8Array } from '../utils/decoder';
import { notificationsApi } from '../api/notifications';
import { useAuth } from '../hooks/useAuth';

interface WebPushContextType {
  isSupported: boolean;
  isSubscribed: boolean;
  isLoading: boolean;
  error: string | null;
  subscribe: () => Promise<void>;
  unsubscribe: () => Promise<void>;
};

interface WebPushProviderProps {
  children: React.ReactNode;
};

type WebPushErrorType = 
    'NOT_SUPPORTED' | 
    'PERMISSION_DENIED' | 
    'SERVICE_WORKER_NOT_REGISTERED' |
    'VAPID_PUBLIC_KEY_NOT_FOUND' | 
    'SUBSCRIPTION_FAILED';

class WebPushError extends Error {
    constructor(type: WebPushErrorType) {
        super(type);
        this.name = 'WebPushError';
    }
}

const WebPushContext = createContext<WebPushContextType | null>(null);

export const WebPushProvider: React.FC<WebPushProviderProps> = ( { children } ) => {

    const [isSubscribed, setIsSubscribed] = useState(false);
    const [registration, setRegistration] = useState<ServiceWorkerRegistration | null>(null);
    const [isLoading, setIsLoading] = useState(false);
    const [error, setError] = useState<WebPushErrorType | null>(null);

    const [isSupported, setIsSupported] = useState(
        'serviceWorker' in navigator && 
        'PushManager' in window && 
        'Notification' in window
    );

    const isInitialized = useRef<string | null>(null);
    const { token, isAuthenticated } = useAuth();

    const getSubscription = useCallback(async () => {
        if (!registration) return null;
        const subscription = await registration.pushManager.getSubscription();
        return subscription;
    }, [registration]);

    // Reset subscription state if user is not authenticated
    useEffect(() => {
        if (!isAuthenticated) {
            setIsSubscribed(false);
            isInitialized.current = null;
        }
    }, [isAuthenticated]);

    // Register SW if supported and not registered
    useEffect(() => {

        if (!isSupported || !isAuthenticated) return;

        const registerIfNotRegistered = async () => {
            try {
                let reg = await navigator.serviceWorker.getRegistration();
                if (!reg) {
                    reg = await navigator.serviceWorker.register('/sw.js');
                }
                await navigator.serviceWorker.ready;
                if (reg.active) {
                    setRegistration(reg);
                } else {
                    console.error('Failed to register the service worker');
                    setRegistration(null);
                }
            } catch (error) {
                console.error('Failed to register the service worker:', error);
                setRegistration(null);
            }
        }

        registerIfNotRegistered();

    }, [isSupported, isAuthenticated]);

    // Single subscription initialization across re-renders
    useEffect(() => {

        if (!isAuthenticated || 
            !registration || 
            !token
        ) return;
        if (isInitialized.current === token) return;

        isInitialized.current = token;

        const check = async () => {
            try {
                const subscription = await getSubscription();
                if (!subscription) {
                    setIsSubscribed(false);
                    return;
                }
                const isValid = await notificationsApi.verify(
                    token as string,
                    subscription
                );
                if (isValid.status === 'ok') {
                    setIsSubscribed(true);
                } else {
                    await subscription.unsubscribe();
                    setIsSubscribed(false);
                }
            } catch (error) {
                console.error('Failed to verify subscription:', error);
                setIsSubscribed(false);
            }
        }

        check();

    }, [isSupported, isAuthenticated, registration, token]);

    const subscribe = useCallback(async () => {

        setError(null);

        if (!isSupported) {
            setError('NOT_SUPPORTED');
            return;
        }
        if (!registration) {
            setError('SERVICE_WORKER_NOT_REGISTERED');
            return;
        }
        
        setIsLoading(true);

        try {
            // Request permission to send push notifications
            const permission = await Notification.requestPermission();
            if (permission !== 'granted') {
                throw new WebPushError('PERMISSION_DENIED');
            }

            // Get the VAPID public key from the server
            const { publicKey } = await api.get<{ 
                publicKey: string 
            }>('/api/notifications/vapid-public-key');

            if (!publicKey) {
                throw new WebPushError('VAPID_PUBLIC_KEY_NOT_FOUND');
            }

            // Convert the VAPID public key to a Uint8Array
            const convertedVapidKey = urlBase64ToUint8Array(publicKey);

            // Skip if already subscribed
            const existingSubscription = await getSubscription();
            if (existingSubscription) {
                setIsSubscribed(true);
                return;
            }

            // Subscribe the user to push notifications
            const subscription = await registration.pushManager.subscribe({
                userVisibleOnly: true,
                applicationServerKey: convertedVapidKey as BufferSource
            });

            const response = await notificationsApi.subscribe(
                token as string, 
                subscription
            );

            if (response.status !== 'ok') {
                await subscription.unsubscribe();
                setIsSubscribed(false);
                throw new WebPushError('SUBSCRIPTION_FAILED');
            }

            setIsSubscribed(true);

        } catch (error) {
            setError('SUBSCRIPTION_FAILED');
            setIsSubscribed(false);
        } finally {
            setIsLoading(false);
        }
    }, [isSupported, registration, token]);

    const unsubscribe = useCallback(async () => {
        // Unsubscription logic
    }, []);

    const value: WebPushContextType = {
        isSupported,
        isSubscribed,
        isLoading,
        error,
        subscribe,
        unsubscribe,
    };

    return <WebPushContext.Provider value={value}>
        { children }
    </WebPushContext.Provider>;
};

export const useWebPush = () => {
  const ctx = useContext(WebPushContext);
  if (!ctx) throw new Error('useWebPush must be used within WebPushProvider');
  return ctx;
};
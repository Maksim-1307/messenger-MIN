type PushSubscription = {
  endpoint: string;
  keys: {
    p256dh: string;
    auth: string;
  };
};

export const notifyAll = async (message: string) => {

};

export const getVapidPublicKey = async (): Promise<string> => {
    return '';
};

export const subscribe = async (subscription: PushSubscription): Promise<void> => {
}
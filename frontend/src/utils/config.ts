const getEnv = (key: string, defaultValue?: string): string => {
  const value = import.meta.env[key];
  if (!value) {
    if (defaultValue !== undefined) {
      return defaultValue;
    }
    return '';
  }
  return value;
};

export const config = {
  // URLs (for backend communication)
  apiUrl: getEnv('VITE_API_URL', '/app-api'),
  socketUrl: getEnv('VITE_SOCKET_URL', '/app-socket'),

  // Recaptcha
  recaptchaSiteKey: getEnv('VITE_RECAPTCHA_SITE_KEY', ''),
} as const;

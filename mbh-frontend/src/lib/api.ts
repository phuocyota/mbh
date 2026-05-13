import axios, { AxiosError } from 'axios';

// Empty baseURL → axios dùng same-origin, request /api/... sẽ qua Vite dev proxy
// (xem vite.config.ts) hoặc reverse proxy trong production.
// Có thể override bằng VITE_API_BASE_URL trong .env nếu cần gọi backend khác origin.
const API_BASE_URL = (import.meta as any).env?.VITE_API_BASE_URL ?? '';

export const api = axios.create({
  baseURL: API_BASE_URL,
  timeout: 15000,
});

// Inject JWT
api.interceptors.request.use((config) => {
  const token = localStorage.getItem('access_token');
  if (token) {
    config.headers = config.headers ?? {};
    (config.headers as any).Authorization = `Bearer ${token}`;
  }
  return config;
});

// Auto-logout on 401
api.interceptors.response.use(
  (response) => response,
  (error: AxiosError) => {
    if (error.response?.status === 401) {
      localStorage.removeItem('access_token');
      localStorage.removeItem('user');
      if (window.location.pathname !== '/login') {
        window.location.href = '/login';
      }
    }
    return Promise.reject(error);
  },
);

export function extractError(err: unknown): string {
  if (err && typeof err === 'object' && 'response' in err) {
    const e = err as AxiosError<any>;
    const data = e.response?.data;
    if (typeof data === 'string') return data;
    if (data?.message) {
      return Array.isArray(data.message)
        ? data.message.join(', ')
        : String(data.message);
    }
    return e.message;
  }
  return String(err);
}

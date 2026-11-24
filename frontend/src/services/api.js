import axios from 'axios';

const API_BASE = typeof window !== 'undefined' && window.location.port === '5173'
    ? 'http://localhost:5000'
    : (typeof window !== 'undefined' ? window.location.origin : 'http://localhost:5000');

const api = axios.create({
    baseURL: `${API_BASE}/api`,
    headers: {
        'Content-Type': 'application/json',
    },
});

export const apiBaseUrl = API_BASE;
export default api;

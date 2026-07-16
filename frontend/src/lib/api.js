import axios from "axios";

// In production (Vercel), REACT_APP_BACKEND_URL is empty so we use relative
// paths — Vercel's rewrite rules proxy /api/* to the backend service.
// Locally, set REACT_APP_BACKEND_URL=http://localhost:8000 in frontend/.env
const BACKEND_URL = process.env.REACT_APP_BACKEND_URL || "";
export const API = `${BACKEND_URL}/api`;

// withCredentials only needed for cross-origin (local dev); on Vercel we're
// same-origin so it's unnecessary and causes CORS preflight failures.
const isCrossOrigin = Boolean(process.env.REACT_APP_BACKEND_URL);

const api = axios.create({
  baseURL: API,
  withCredentials: isCrossOrigin,
});

api.interceptors.request.use((config) => {
  const token = localStorage.getItem("ecomind_token");
  if (token) config.headers.Authorization = `Bearer ${token}`;
  return config;
});

api.interceptors.response.use(
  (r) => r,
  (err) => {
    if (err.response?.status === 401) {
      // let AuthContext handle
    }
    return Promise.reject(err);
  }
);

export default api;

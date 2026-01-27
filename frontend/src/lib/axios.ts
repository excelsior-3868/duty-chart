// src/lib/axios.ts
import axios from "axios";
const BACKEND = import.meta.env.VITE_BACKEND_HOST || "http://127.0.0.1:8000";

const api = axios.create({
  baseURL: `${BACKEND}/api`,
});

api.interceptors.request.use((config) => {
  const token = localStorage.getItem("access");
  if (token) {
    config.headers = {
      ...(config.headers || {}),
      Authorization: `Bearer ${token}`,
    };
  }
  return config;
});

export default api;
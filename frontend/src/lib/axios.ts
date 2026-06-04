// src/lib/axios.ts
import axios from "axios";
const BACKEND = import.meta.env.VITE_BACKEND_HOST || "";

const api = axios.create({
  baseURL: `${BACKEND}/api`,
  withCredentials: true,
});

api.interceptors.request.use((config) => {
  return config;
});

export default api;
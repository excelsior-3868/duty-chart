// src/services/api.ts
import axios from "axios";
import publicApi from "./publicApi";
import { ROUTES } from "@/utils/constants";

const BACKEND = import.meta.env.VITE_BACKEND_HOST || "";

// Final base URL → always "<host>/api/v1/"
const BASE_URL = `${BACKEND}/api/v1/`;

// -----------------------------
// Main API instance
// -----------------------------
const api = axios.create({
  baseURL: BASE_URL,
  withCredentials: true,
});

// -----------------------------
// REQUEST → Attach JWT
// -----------------------------
api.interceptors.request.use(
  (config) => {
    const token = localStorage.getItem("access");
    if (token && config.headers) {
      config.headers.Authorization = `Bearer ${token}`;
    }
    return config;
  },
  (error) => Promise.reject(error)
);

// -----------------------------
// RESPONSE → Auto refresh token
// -----------------------------
api.interceptors.response.use(
  (response) => response,

  async (error) => {
    const status = error?.response?.status;
    const originalConfig = error?.config || {};
    const url: string = originalConfig?.url || "";

    const isAuthEndpoint =
      url.includes("/token/") || url.includes("/token/refresh/") || url.includes("/auth/me/");

    const refreshToken = localStorage.getItem("refresh");

    if (
      status === 401 &&
      refreshToken &&
      !isAuthEndpoint &&
      !originalConfig._retry
    ) {
      originalConfig._retry = true;

      try {
        const refreshRes = await publicApi.post("/token/refresh/", {
          refresh: refreshToken,
        });

        const { access } = refreshRes.data || {};
        if (access) {
          localStorage.setItem("access", access);

          originalConfig.headers = {
            ...(originalConfig.headers || {}),
            Authorization: `Bearer ${access}`,
          };

          return api.request(originalConfig);
        }
      } catch {
        // fall through to logout
      }
    }

    // -----------------------------
    // If refresh fails → logout (only 401)
    // -----------------------------
    if (status === 401 && !isAuthEndpoint) {
      try {
        localStorage.removeItem("access");
        localStorage.removeItem("refresh");
        localStorage.removeItem("auth");
      } catch { }

      if (typeof window !== "undefined") {
        const loginUrl = ROUTES.LOGIN;
        if (window.location.pathname !== loginUrl) {
          window.location.assign(loginUrl);
        }
      }
    }

    return Promise.reject(error);
  }
);

export default api;

// src/services/publicApi.ts
import axios from "axios";

const BACKEND = import.meta.env.VITE_BACKEND_HOST || "";

const publicApi = axios.create({
  baseURL: `${BACKEND}/api`,
  withCredentials: true,
});

export default publicApi;

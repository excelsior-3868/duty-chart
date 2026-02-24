import api from "./api";

export interface Notification {
  id: number;
  title: string;
  message: string;
  notification_type: string;
  link: string | null;
  is_read: boolean;
  created_at: string;
}

export const notificationService = {
  getNotifications: async (params?: any) => {
    const response = await api.get("/notifications/", { params });
    return response.data;
  },

  markAsRead: async (id: number) => {
    const response = await api.post(`/notifications/${id}/mark_read/`);
    return response.data;
  },

  markAllAsRead: async () => {
    const response = await api.post("/notifications/mark_all_read/");
    return response.data;
  },
};

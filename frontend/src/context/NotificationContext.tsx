import React, { createContext, useContext, useEffect, useState, useCallback } from 'react';
import { notificationService, type Notification } from '@/services/notificationService';
import { useAuth } from './AuthContext';

interface NotificationContextType {
    notifications: Notification[];
    unreadCount: number;
    fetchNotifications: () => Promise<void>;
    markAsRead: (id: number) => Promise<void>;
    markAllAsRead: () => Promise<void>;
}

const NotificationContext = createContext<NotificationContextType | undefined>(undefined);

export const NotificationProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
    const [notifications, setNotifications] = useState<Notification[]>([]);
    const { user, isAuthenticated } = useAuth();

    const fetchNotifications = useCallback(async () => {
        if (!isAuthenticated) return;
        try {
            const data = await notificationService.getNotifications();
            // standard response from DRF with pagination might be { results: Notification[] }
            // or just Notification[] if no pagination is used in the ViewSet for this list.
            // Based on standard ViewSet, it might be { results, count, next, previous }
            if (data.results) {
                setNotifications(data.results);
            } else {
                setNotifications(data);
            }
        } catch (error) {
            console.error('Error fetching notifications:', error);
        }
    }, [isAuthenticated]);

    const markAsRead = async (id: number) => {
        try {
            await notificationService.markAsRead(id);
            setNotifications(prev =>
                prev.map(n => (n.id === id ? { ...n, is_read: true } : n))
            );
        } catch (error) {
            console.error('Error marking notification as read:', error);
        }
    };

    const markAllAsRead = async () => {
        try {
            await notificationService.markAllAsRead();
            setNotifications(prev => prev.map(n => ({ ...n, is_read: true })));
        } catch (error) {
            console.error('Error marking all notifications as read:', error);
        }
    };

    useEffect(() => {
        if (isAuthenticated) {
            fetchNotifications();

            // Setup WebSocket
            const protocol = window.location.protocol === 'https:' ? 'wss:' : 'ws:';
            const host = window.location.host === 'localhost:5173' || window.location.host === '127.0.0.1:5173'
                ? 'localhost:8000'
                : window.location.host;

            // Get JWT from local storage - AuthContext stores the access token directly under 'access'
            const token = localStorage.getItem('access') || '';

            const wsUrl = `${protocol}//${host}/ws/notifications/?token=${token}`;
            const socket = new WebSocket(wsUrl);

            socket.onmessage = (event) => {
                const data = JSON.parse(event.data);
                console.log('New notification received:', data);
                setNotifications(prev => [data, ...prev]);

                // Optional: show a toast or desktop notification
                if (Notification.permission === 'granted' && document.visibilityState !== 'visible') {
                    new window.Notification(data.title, { body: data.message });
                }
            };

            socket.onclose = () => {
                console.log('WebSocket connection closed');
            };

            socket.onerror = (error) => {
                console.error('WebSocket error:', error);
            };

            return () => {
                socket.close();
            };
        } else {
            setNotifications([]);
        }
    }, [isAuthenticated, fetchNotifications]);

    const unreadCount = notifications.filter(n => !n.is_read).length;

    return (
        <NotificationContext.Provider value={{
            notifications,
            unreadCount,
            fetchNotifications,
            markAsRead,
            markAllAsRead
        }}>
            {children}
        </NotificationContext.Provider>
    );
};

export const useNotifications = () => {
    const context = useContext(NotificationContext);
    if (context === undefined) {
        throw new Error('useNotifications must be used within a NotificationProvider');
    }
    return context;
};

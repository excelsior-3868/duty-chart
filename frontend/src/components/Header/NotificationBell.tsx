import { useState, useEffect } from "react";
import { Bell, Check, Trash2 } from "lucide-react";
import {
    DropdownMenu,
    DropdownMenuContent,
    DropdownMenuItem,
    DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { Button } from "@/components/ui/button";
import { ScrollArea } from "@/components/ui/scroll-area";
import api from "@/services/api";
import { cn } from "@/lib/utils";
import { useNavigate } from "react-router-dom";

export interface Notification {
    id: number;
    title: string;
    message: string;
    notification_type: 'ASSIGNMENT' | 'REMINDER' | 'SYSTEM';
    link: string;
    is_read: boolean;
    created_at_human: string;
}

export function NotificationBell() {
    const [notifications, setNotifications] = useState<Notification[]>([]);
    const [unreadCount, setUnreadCount] = useState(0);
    const navigate = useNavigate();

    const fetchNotifications = async () => {
        try {
            const { data } = await api.get("notifications/notifications/");
            setNotifications(data.results || data);
            setUnreadCount((data.results || data).filter((n: Notification) => !n.is_read).length);
        } catch (error) {
            console.error("Failed to fetch notifications:", error);
        }
    };

    useEffect(() => {
        fetchNotifications();

        const token = localStorage.getItem("access");
        if (!token) return;

        const BACKEND = import.meta.env.VITE_BACKEND_HOST || window.location.origin;
        const WS_BASE = BACKEND.replace(/^http/, 'ws');
        const wsUrl = `${WS_BASE}/ws/notifications/?token=${token}`;

        let socket: WebSocket | null = null;
        let reconnectTimeout: any;

        const connect = () => {
            socket = new WebSocket(wsUrl);

            socket.onmessage = (event) => {
                const data = JSON.parse(event.data);
                if (data) {
                    setNotifications(prev => [data, ...prev]);
                    setUnreadCount(prev => prev + 1);
                }
            };

            socket.onclose = () => {
                console.log("WebSocket connection closed. Reconnecting...");
                reconnectTimeout = setTimeout(connect, 5000);
            };

            socket.onerror = (error) => {
                console.error("WebSocket error:", error);
                socket?.close();
            };
        };

        connect();

        return () => {
            if (socket) {
                socket.onclose = null; // Prevent reconnection on intentional close
                socket.close();
            }
            if (reconnectTimeout) clearTimeout(reconnectTimeout);
        };
    }, []);

    const markAsRead = async (id: number) => {
        try {
            await api.post(`notifications/notifications/${id}/mark_as_read/`);
            fetchNotifications();
        } catch (error) {
            console.error("Failed to mark as read:", error);
        }
    };

    const markAllAsRead = async () => {
        try {
            await api.post("notifications/notifications/mark_all_as_read/");
            fetchNotifications();
        } catch (error) {
            console.error("Failed to mark all as read:", error);
        }
    };

    const handleNotificationClick = (notification: Notification) => {
        if (!notification.is_read) {
            markAsRead(notification.id);
        }
        if (notification.link) {
            navigate(notification.link);
        }
    };

    return (
        <DropdownMenu>
            <DropdownMenuTrigger asChild>
                <Button variant="ghost" size="icon" className="relative text-[hsl(var(--header-foreground))] hover:bg-primary/20">
                    <Bell className="h-5 w-5" />
                    {unreadCount > 0 && (
                        <span className="absolute -top-1 -right-1 flex h-4 w-4 items-center justify-center rounded-full bg-red-600 text-[10px] font-bold text-white">
                            {unreadCount > 9 ? "9+" : unreadCount}
                        </span>
                    )}
                </Button>
            </DropdownMenuTrigger>
            <DropdownMenuContent align="end" className="w-[320px] p-0">
                <div className="flex items-center justify-between p-4 border-b">
                    <h3 className="font-semibold text-sm">Notifications</h3>
                    {unreadCount > 0 && (
                        <Button variant="ghost" size="sm" onClick={markAllAsRead} className="h-8 text-xs text-primary hover:text-primary-hover">
                            Mark all as read
                        </Button>
                    )}
                </div>
                <ScrollArea className="h-[300px]">
                    {notifications.length === 0 ? (
                        <div className="flex flex-col items-center justify-center h-[200px] text-slate-500">
                            <Bell className="h-8 w-8 mb-2 opacity-20" />
                            <p className="text-xs">No notifications yet</p>
                        </div>
                    ) : (
                        <div className="flex flex-col">
                            {notifications.map((n) => (
                                <div
                                    key={n.id}
                                    className={cn(
                                        "p-4 border-b last:border-0 hover:bg-slate-50 cursor-pointer transition-colors",
                                        !n.is_read && "bg-primary/5"
                                    )}
                                    onClick={() => handleNotificationClick(n)}
                                >
                                    <div className="flex justify-between items-start gap-2">
                                        <div className="flex-1">
                                            <p className={cn("text-sm font-medium", !n.is_read ? "text-slate-900" : "text-slate-600")}>
                                                {n.title}
                                            </p>
                                            <p className="text-xs text-slate-500 mt-1 line-clamp-2">{n.message}</p>
                                            <p className="text-[10px] text-slate-400 mt-2">{n.created_at_human}</p>
                                        </div>
                                        {!n.is_read && (
                                            <div className="h-2 w-2 rounded-full bg-primary mt-1.5" />
                                        )}
                                    </div>
                                </div>
                            ))}
                        </div>
                    )}
                </ScrollArea>
            </DropdownMenuContent>
        </DropdownMenu>
    );
}

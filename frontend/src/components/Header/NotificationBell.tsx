import React, { useState } from 'react';
import { Bell, Check, ExternalLink } from 'lucide-react';
import { useNotifications } from '@/context/NotificationContext';
import { Button } from '@/components/ui/button';
import {
    DropdownMenu,
    DropdownMenuContent,
    DropdownMenuItem,
    DropdownMenuTrigger,
    DropdownMenuSeparator,
    DropdownMenuLabel,
} from '@/components/ui/dropdown-menu';
import { Badge } from '@/components/ui/badge';
import { ScrollArea } from '@/components/ui/scroll-area';
import { cn } from '@/lib/utils';
import { formatDistanceToNow } from 'date-fns';
import { useNavigate } from 'react-router-dom';

export const NotificationBell: React.FC = () => {
    const { notifications, unreadCount, markAsRead, markAllAsRead } = useNotifications();
    const [open, setOpen] = useState(false);
    const navigate = useNavigate();

    const handleNotificationClick = async (id: number) => {
        await markAsRead(id);
        navigate('/dashboard');
        setOpen(false);
    };

    return (
        <DropdownMenu open={open} onOpenChange={setOpen}>
            <DropdownMenuTrigger asChild>
                <Button
                    variant="ghost"
                    size="icon"
                    className="relative text-[hsl(var(--header-foreground))] hover:bg-[hsl(var(--primary-hover))]"
                >
                    <Bell className="h-5 w-5" />
                    {unreadCount > 0 && (
                        <Badge
                            className="absolute -top-1 -right-1 h-5 w-5 flex items-center justify-center p-0 bg-red-600 text-white border-2 border-[hsl(var(--header-bg))]"
                            variant="destructive"
                        >
                            {unreadCount > 9 ? '9+' : unreadCount}
                        </Badge>
                    )}
                </Button>
            </DropdownMenuTrigger>
            <DropdownMenuContent align="end" className="w-80 p-0">
                <DropdownMenuLabel className="p-4 flex items-center justify-between">
                    <span>Notifications</span>
                    {unreadCount > 0 && (
                        <Button
                            variant="ghost"
                            size="sm"
                            className="text-xs h-8 px-2 hover:bg-slate-100"
                            onClick={(e) => {
                                e.stopPropagation();
                                markAllAsRead();
                            }}
                        >
                            Mark all as read
                        </Button>
                    )}
                </DropdownMenuLabel>
                <DropdownMenuSeparator className="m-0" />
                <ScrollArea className="h-80">
                    {notifications.length === 0 ? (
                        <div className="p-4 text-center text-sm text-slate-500">
                            No notifications yet
                        </div>
                    ) : (
                        notifications.map((notification) => (
                            <DropdownMenuItem
                                key={notification.id}
                                className={cn(
                                    "flex flex-col items-start p-4 cursor-pointer focus:bg-slate-50 border-b last:border-0",
                                    !notification.is_read && "bg-blue-50/50"
                                )}
                                onClick={() => handleNotificationClick(notification.id)}
                            >
                                <div className="flex items-center justify-between w-full mb-1">
                                    <span className={cn(
                                        "text-sm font-semibold",
                                        !notification.is_read ? "text-blue-700" : "text-slate-900"
                                    )}>
                                        {notification.title}
                                    </span>
                                    {!notification.is_read && (
                                        <div className="h-2 w-2 rounded-full bg-blue-600" />
                                    )}
                                </div>
                                <p className="text-xs text-slate-600 line-clamp-2 mb-2">
                                    {notification.message}
                                </p>
                                <div className="flex items-center justify-between w-full text-[10px] text-slate-400">
                                    <span>{formatDistanceToNow(new Date(notification.created_at), { addSuffix: true })}</span>
                                    {notification.link && <ExternalLink className="h-3 w-3" />}
                                </div>
                            </DropdownMenuItem>
                        ))
                    )}
                </ScrollArea>
                <DropdownMenuSeparator className="m-0" />
                <Button
                    variant="ghost"
                    className="w-full text-xs font-medium py-3 h-auto rounded-none text-blue-600 hover:text-blue-700 hover:bg-slate-50"
                    onClick={() => {
                        navigate('/notifications');
                        setOpen(false);
                    }}
                >
                    View all notifications
                </Button>
            </DropdownMenuContent>
        </DropdownMenu>
    );
};

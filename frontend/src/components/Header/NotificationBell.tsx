import { useState, useEffect, useCallback, useRef } from "react";
import { useNavigate } from "react-router-dom";
import { formatDistanceToNow } from "date-fns";
import { Bell, CalendarClock, FileText, Info, CheckCheck, Loader2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from "@/components/ui/popover";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Separator } from "@/components/ui/separator";
import api from "@/services/api";
import { cn } from "@/lib/utils";

// Primary delivery where WebSockets aren't available (e.g. a reverse proxy
// that doesn't forward /ws/): a fast unread-count poll. 6 req/min stays well
// under the 100/min per-user API throttle.
const POLL_INTERVAL_MS = 10_000;

const buildWebSocketUrl = (token: string) => {
  const backend = (import.meta.env.VITE_BACKEND_HOST || "").replace(/\/$/, "");
  const base = backend
    ? backend.replace(/^https/, "wss").replace(/^http(?!s)/, "ws")
    : `${window.location.protocol === "https:" ? "wss" : "ws"}://${window.location.host}`;
  return `${base}/ws/notifications/?token=${encodeURIComponent(token)}`;
};

interface AppNotification {
  id: number;
  title: string;
  message: string;
  notification_type: "ASSIGNMENT" | "REMINDER" | "SYSTEM" | "DOCUMENT";
  link: string | null;
  is_read: boolean;
  created_at: string;
}

const typeIcon = (type: AppNotification["notification_type"]) => {
  switch (type) {
    case "ASSIGNMENT":
      return <CalendarClock className="h-4 w-4 text-blue-600" />;
    case "REMINDER":
      return <Bell className="h-4 w-4 text-amber-600" />;
    case "DOCUMENT":
      return <FileText className="h-4 w-4 text-emerald-600" />;
    default:
      return <Info className="h-4 w-4 text-slate-500" />;
  }
};

const cleanNotificationMessage = (msg: string) => {
  if (!msg) return "";
  let cleaned = msg;
  // Handle password reset/account creation cases:
  // "Please visit https://dutychart.ntc.net.np and use the Forgot Password option..." -> "Please use the Forgot Password option..."
  cleaned = cleaned.replace(/(?:Please\s+)?(?:visit|Visit)\s+(?:https?:\/\/)?dutychart\.ntc\.net\.np\s+and\s+/gi, "Please ");
  // Remove general "Please visit..." patterns:
  cleaned = cleaned.replace(/\s*(?:Please\s+)?(?:visit|Visit)\s+(?:https?:\/\/)?dutychart\.ntc\.net\.np(?:\/)?(?:\s+for\s+the\s+details?|\s+for\s+details?|\s+for\s+the\s+detail?|\s+for\s+detail?)?\.?/gi, "");
  // Clean up double periods or extra spaces/dots:
  cleaned = cleaned.replace(/\s*\.\s*\./g, ".").trim();
  return cleaned;
};

export const NotificationBell = () => {
  const navigate = useNavigate();
  const [open, setOpen] = useState(false);
  const [unreadCount, setUnreadCount] = useState(0);
  const [notifications, setNotifications] = useState<AppNotification[]>([]);
  const [loading, setLoading] = useState(false);

  const openRef = useRef(false);

  const fetchUnreadCount = useCallback(() => {
    api
      .get("notifications/unread_count/")
      .then((res) => {
        const count = res.data?.count ?? 0;
        setUnreadCount((prev) => {
          // New notifications arrived while the popover is open: reload the list.
          if (count > prev && openRef.current) fetchNotifications();
          return count;
        });
      })
      .catch((err) => console.error("Failed to fetch unread notification count", err));
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const fetchNotifications = useCallback(() => {
    setLoading(true);
    api
      .get("notifications/", { params: { page_size: 15 } })
      .then((res) => {
        const data = res.data?.results ?? res.data ?? [];
        setNotifications(data);
      })
      .catch((err) => console.error("Failed to fetch notifications", err))
      .finally(() => setLoading(false));
  }, []);

  useEffect(() => {
    fetchUnreadCount();
    const interval = setInterval(fetchUnreadCount, POLL_INTERVAL_MS);
    return () => clearInterval(interval);
  }, [fetchUnreadCount]);

  // Real-time push: subscribe to the user's notification channel and
  // reconnect with backoff if the connection drops.
  // Disabled in production builds until the reverse proxy forwards /ws/
  // (set VITE_ENABLE_WS=true and rebuild once nginx is configured) —
  // attempting it just fills the console with browser-logged failures.
  // Polling above delivers notifications either way.
  useEffect(() => {
    if (!import.meta.env.DEV && import.meta.env.VITE_ENABLE_WS !== "true") return;

    let ws: WebSocket | null = null;
    let retryTimer: ReturnType<typeof setTimeout> | undefined;
    let retryDelay = 1_000;
    let unmounted = false;
    let everConnected = false;
    let failedAttempts = 0;

    const connect = () => {
      const token = localStorage.getItem("access");
      if (!token) {
        retryTimer = setTimeout(connect, 10_000);
        return;
      }

      ws = new WebSocket(buildWebSocketUrl(token));

      ws.onopen = () => {
        retryDelay = 1_000;
        everConnected = true;
        failedAttempts = 0;
      };

      ws.onmessage = (event) => {
        try {
          const notification = JSON.parse(event.data) as AppNotification;
          setUnreadCount((prev) => prev + 1);
          setNotifications((prev) =>
            prev.some((n) => n.id === notification.id) ? prev : [notification, ...prev]
          );
        } catch (err) {
          console.error("Failed to parse pushed notification", err);
        }
      };

      ws.onclose = () => {
        if (unmounted) return;
        // The server/proxy doesn't support WebSockets at all (never connected
        // once): stop trying, polling carries delivery. Transient drops on a
        // previously working connection keep reconnecting indefinitely.
        if (!everConnected) {
          failedAttempts += 1;
          if (failedAttempts >= 3) return;
        }
        retryTimer = setTimeout(connect, retryDelay);
        retryDelay = Math.min(retryDelay * 2, 300_000);
      };

      ws.onerror = () => ws?.close();
    };

    connect();
    return () => {
      unmounted = true;
      if (retryTimer) clearTimeout(retryTimer);
      ws?.close();
    };
  }, []);

  const handleOpenChange = (nextOpen: boolean) => {
    setOpen(nextOpen);
    openRef.current = nextOpen;
    if (nextOpen) fetchNotifications();
  };

  const handleNotificationClick = (notification: AppNotification) => {
    if (!notification.is_read) {
      api
        .post(`notifications/${notification.id}/mark_read/`)
        .catch((err) => console.error("Failed to mark notification as read", err));
      setNotifications((prev) =>
        prev.map((n) => (n.id === notification.id ? { ...n, is_read: true } : n))
      );
      setUnreadCount((prev) => Math.max(0, prev - 1));
    }
    if (notification.link) {
      setOpen(false);
      navigate(notification.link);
    }
  };

  const handleMarkAllRead = () => {
    api
      .post("notifications/mark_all_read/")
      .then(() => {
        setNotifications((prev) => prev.map((n) => ({ ...n, is_read: true })));
        setUnreadCount(0);
      })
      .catch((err) => console.error("Failed to mark all notifications as read", err));
  };

  return (
    <Popover open={open} onOpenChange={handleOpenChange}>
      <PopoverTrigger asChild>
        <Button
          variant="ghost"
          size="icon"
          aria-label="Notifications"
          className="relative text-[hsl(var(--header-foreground))] hover:bg-white/10 active:scale-95 transition-all"
        >
          <Bell className="h-5 w-5" />
          {unreadCount > 0 && (
            <span className="absolute -top-0.5 -right-0.5 flex h-4 min-w-4 items-center justify-center rounded-full bg-red-500 px-1 text-[10px] font-bold text-white">
              {unreadCount > 99 ? "99+" : unreadCount}
            </span>
          )}
        </Button>
      </PopoverTrigger>
      <PopoverContent align="end" className="w-80 p-0 sm:w-96">
        <div className="flex items-center justify-between px-4 py-3">
          <h3 className="text-sm font-semibold">Notifications</h3>
          {unreadCount > 0 && (
            <Button
              variant="ghost"
              size="sm"
              className="h-7 gap-1 px-2 text-xs text-muted-foreground"
              onClick={handleMarkAllRead}
            >
              <CheckCheck className="h-3.5 w-3.5" />
              Mark all as read
            </Button>
          )}
        </div>
        <Separator />
        <ScrollArea className="h-[min(60vh,360px)]">
          {loading ? (
            <div className="flex items-center justify-center py-10 text-muted-foreground">
              <Loader2 className="h-5 w-5 animate-spin" />
            </div>
          ) : notifications.length === 0 ? (
            <div className="flex flex-col items-center justify-center gap-2 py-10 text-muted-foreground">
              <Bell className="h-8 w-8 opacity-40" />
              <p className="text-sm">No notifications yet</p>
            </div>
          ) : (
            <div className="divide-y">
              {notifications.map((notification) => (
                <button
                  key={notification.id}
                  type="button"
                  onClick={() => handleNotificationClick(notification)}
                  className={cn(
                    "flex w-full items-start gap-3 px-4 py-3 text-left transition-colors hover:bg-muted/60",
                    !notification.is_read && "bg-blue-50/70 dark:bg-blue-950/30"
                  )}
                >
                  <span className="mt-0.5 shrink-0">{typeIcon(notification.notification_type)}</span>
                  <span className="min-w-0 flex-1">
                    <span className="flex items-center gap-2">
                      <span className={cn("truncate text-sm", !notification.is_read && "font-semibold")}>
                        {notification.title}
                      </span>
                      {!notification.is_read && (
                        <span className="h-2 w-2 shrink-0 rounded-full bg-blue-500" />
                      )}
                    </span>
                    <span className="mt-0.5 line-clamp-2 block text-xs text-muted-foreground">
                      {cleanNotificationMessage(notification.message)}
                    </span>
                    <span className="mt-1 block text-[11px] text-muted-foreground/80">
                      {formatDistanceToNow(new Date(notification.created_at), { addSuffix: true })}
                    </span>
                  </span>
                </button>
              ))}
            </div>
          )}
        </ScrollArea>
      </PopoverContent>
    </Popover>
  );
};

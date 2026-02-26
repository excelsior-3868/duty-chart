import { useState, useEffect, useCallback } from 'react';
import { Outlet } from 'react-router-dom';
import { Header } from '@/components/Header';
import { Sidebar } from '@/components/Sidebar';
import { Footer } from '@/components/Footer';
import { useAuth } from '@/context/AuthContext';
import api from '@/services/api';
import { toast } from 'sonner';

export const MainLayout = () => {
  const [sidebarOpen, setSidebarOpen] = useState(false);
  const { logout, isAuthenticated } = useAuth();

  const toggleSidebar = () => setSidebarOpen(!sidebarOpen);
  const closeSidebar = () => setSidebarOpen(false);

  // ----------------------------------------------------------------------
  // Session Management (Timeout & Idle Logout)
  // ----------------------------------------------------------------------

  const handleSessionExpiration = useCallback((reason: string) => {
    toast.warning(reason);
    logout();
  }, [logout]);

  useEffect(() => {
    if (!isAuthenticated) return;

    // Track activity events
    const handleActivity = () => {
      // Throttle updates to localStorage by only writing once per second
      const now = Date.now();
      const lastActivityStr = localStorage.getItem('last_activity');
      const lastActivity = lastActivityStr ? parseInt(lastActivityStr, 10) : 0;

      if (now - lastActivity > 1000) {
        localStorage.setItem('last_activity', String(now));
      }
    };

    const activityEvents = ['mousedown', 'mousemove', 'keypress', 'scroll', 'touchstart'];
    activityEvents.forEach(event => document.addEventListener(event, handleActivity, { passive: true }));

    const checkSession = () => {
      const timeoutMinutesStr = localStorage.getItem('session_timeout') || '60';
      const timeoutMinutes = parseInt(timeoutMinutesStr, 10);

      const autoLogoutIdleStr = localStorage.getItem('auto_logout_idle');
      const autoLogoutIdle = autoLogoutIdleStr !== 'false';

      if (timeoutMinutes <= 0) return;

      const now = Date.now();
      const timeoutMs = timeoutMinutes * 60 * 1000;

      if (autoLogoutIdle) {
        // Idle timeout logic: Compare current time with `last_activity`
        const lastActivityStr = localStorage.getItem('last_activity');
        const lastActivity = lastActivityStr ? parseInt(lastActivityStr, 10) : now;
        if (now - lastActivity >= timeoutMs) {
          handleSessionExpiration("Logged out due to inactivity.");
        }
      } else {
        // Absolute timeout logic: Compare current time with `session_start_time`
        const startTimeStr = localStorage.getItem('session_start_time');
        const startTime = startTimeStr ? parseInt(startTimeStr, 10) : now;
        if (now - startTime >= timeoutMs) {
          handleSessionExpiration("Session has expired. Please log in again.");
        }
      }
    };

    // Check immediately on load in case returning after sleeping/closing browser
    checkSession();

    // Poll for session expiration
    const pollInterval = window.setInterval(checkSession, 10000); // Check every 10 seconds

    return () => {
      activityEvents.forEach(event => document.removeEventListener(event, handleActivity));
      clearInterval(pollInterval);
    };
  }, [isAuthenticated, handleSessionExpiration]);

  // Sync settings from backend to local storage for the timers
  useEffect(() => {
    if (isAuthenticated) {
      api.get("system-settings/").then(res => {
        const timeout = res.data.session_timeout || 60;
        const autoIdle = res.data.auto_logout_idle ?? true;

        localStorage.setItem('session_timeout', String(timeout));
        localStorage.setItem('auto_logout_idle', String(autoIdle));

        // If session start time doesn't exist, hydrate it to prevent immediate absolute logouts
        if (!localStorage.getItem('session_start_time')) {
          localStorage.setItem('session_start_time', String(Date.now()));
        }
        if (!localStorage.getItem('last_activity')) {
          localStorage.setItem('last_activity', String(Date.now()));
        }
      }).catch(err => console.error("Failed to sync security settings", err));
    }
  }, [isAuthenticated]);

  return (
    <div className="min-h-screen bg-background no-scrollbar">
      <Header onMenuClick={toggleSidebar} />

      <div className="flex">
        <Sidebar isOpen={sidebarOpen} onClose={closeSidebar} />

        {/* Main Content */}
        <main className="flex-1 lg:ml-64 no-scrollbar">
          <div className="min-h-[calc(100vh-4rem)] pt-16 no-scrollbar">
            <Outlet />
          </div>
          <Footer />
        </main>
      </div>

      {/* Overlay for mobile sidebar */}
      {sidebarOpen && (
        <div
          className="fixed inset-0 z-30 bg-black/50 lg:hidden"
          onClick={closeSidebar}
        />
      )}
    </div>
  );
};

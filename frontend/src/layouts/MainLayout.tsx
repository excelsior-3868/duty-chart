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

    let idleTimer: any;

    const startIdleTimer = () => {
      if (idleTimer) clearTimeout(idleTimer);

      const idleEnabled = localStorage.getItem('auto_logout_idle') !== 'false'; // Default to true if not set
      const timeoutMinutes = parseInt(localStorage.getItem('session_timeout') || '60');

      if (idleEnabled && timeoutMinutes > 0) {
        idleTimer = setTimeout(() => {
          handleSessionExpiration("Logged out due to inactivity.");
        }, timeoutMinutes * 60 * 1000);
      }
    };

    // Set up activity listeners for idle logout
    const activityEvents = ['mousedown', 'mousemove', 'keypress', 'scroll', 'touchstart'];
    const handleActivity = () => startIdleTimer();

    activityEvents.forEach(event => document.addEventListener(event, handleActivity));

    // Initialize timer
    startIdleTimer();

    return () => {
      activityEvents.forEach(event => document.removeEventListener(event, handleActivity));
      if (idleTimer) clearTimeout(idleTimer);
    };
  }, [isAuthenticated, handleSessionExpiration]);

  // Sync settings from backend to local storage for the timers
  useEffect(() => {
    if (isAuthenticated) {
      api.get("system-settings/").then(res => {
        localStorage.setItem('session_timeout', String(res.data.session_timeout));
        localStorage.setItem('auto_logout_idle', String(res.data.auto_logout_idle));
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

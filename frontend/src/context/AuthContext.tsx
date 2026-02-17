import React, { createContext, useContext, useState, useEffect, ReactNode } from 'react';
import api from '@/services/api';
import { toast } from 'sonner';

// ----------------------------------------------------------------------
// Types
// ----------------------------------------------------------------------

export interface AuthUser {
  id: number;
  username: string;
  full_name: string;
  email: string;
  employee_id: string;
  role: string; // "SUPERADMIN", "NETWORK_ADMIN", "OFFICE_ADMIN", "USER"
  position_name?: string;
  department_name?: string;
  image: string | null;
  office_id: number | null;
  office_name?: string;
  secondary_offices: number[];
  permissions: string[];
}

interface AuthContextType {
  user: AuthUser | null;
  isLoading: boolean;
  isAuthenticated: boolean;
  activeOffice: number | null;
  activeOfficeName: string | null;
  setActiveOffice: (officeId: number | null, officeName?: string) => void;

  // Actions
  refreshUser: () => Promise<void>;
  logout: () => void;

  // RBAC Helpers
  hasPermission: (permissionSlug: string) => boolean;
  hasRole: (roleSlug: string) => boolean;
  canManageOffice: (officeId: number) => boolean;
}

// ----------------------------------------------------------------------
// Context
// ----------------------------------------------------------------------

const AuthContext = createContext<AuthContextType | undefined>(undefined);

// ----------------------------------------------------------------------
// Provider
// ----------------------------------------------------------------------

export const AuthProvider = ({ children }: { children: ReactNode }) => {
  const [user, setUser] = useState<AuthUser | null>(null);
  const [activeOffice, setActiveOfficeState] = useState<number | null>(null);
  const [activeOfficeName, setActiveOfficeName] = useState<string | null>(null);
  const [isLoading, setIsLoading] = useState<boolean>(true);

  const setActiveOffice = (officeId: number | null, officeName?: string) => {
    setActiveOfficeState(officeId);
    if (officeName) {
      setActiveOfficeName(officeName);
    } else if (officeId === null) {
      setActiveOfficeName(null);
    }
    // If officeName is not provided but ID is, we might want to look it up, 
    // but typically we pass both from UI. ActiveOfficeName might remain stale if not carefully managed.
    // For now, assume usage provides name or we rely on initial user load.
  };

  const fetchUser = async () => {
    try {
      const token = localStorage.getItem('access');
      if (!token) {
        setUser(null);
        setActiveOfficeState(null);
        setActiveOfficeName(null);
        setIsLoading(false);
        return;
      }

      const res = await api.get('/auth/me/', {
        headers: { 'Cache-Control': 'no-cache', 'Pragma': 'no-cache' }
      });
      setUser(res.data);
      // Set default active office from user's primary office
      if (res.data.office_id) {
        setActiveOfficeState(res.data.office_id);
        setActiveOfficeName(res.data.office_name || null);
      }
    } catch (error) {
      console.error('Failed to fetch user:', error);
      // api.ts interceptor might handle logout, but let's be safe
      setUser(null);
      setActiveOfficeState(null);
      setActiveOfficeName(null);
    } finally {
      setIsLoading(false);
    }
  };

  useEffect(() => {
    fetchUser();
  }, []);

  const refreshUser = async () => {
    await fetchUser();
  };

  const logout = () => {
    localStorage.removeItem('access');
    localStorage.removeItem('refresh');
    setUser(null);
    setActiveOfficeState(null);
    setActiveOfficeName(null);
    window.location.href = '/login';
  };

  // ----------------------------------------------------------------------
  // RBAC Logic
  // ----------------------------------------------------------------------

  const hasPermission = (permissionSlug: string): boolean => {
    if (!user) return false;
    return user.permissions.includes(permissionSlug);
  };

  const hasRole = (roleSlug: string): boolean => {
    if (!user) return false;
    return user.role === roleSlug;
  };

  const canManageOffice = (officeId: number): boolean => {
    if (!user) return false;

    // If user has 'view_any_office_chart' or 'create_any_office_chart', they can manage any office
    if (user.permissions.includes('duties.view_any_office_chart') ||
      user.permissions.includes('duties.create_any_office_chart')) {
      return true;
    }

    if (user.office_id === null || user.office_id === undefined) return false;

    return Number(user.office_id) === Number(officeId);
  };

  const value = {
    user,
    activeOffice,
    activeOfficeName,
    setActiveOffice,
    isLoading,
    isAuthenticated: !!user,
    refreshUser,
    logout,
    hasPermission,
    hasRole,
    canManageOffice,
  };

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
};

// ----------------------------------------------------------------------
// Hook
// ----------------------------------------------------------------------

export const useAuth = () => {
  const context = useContext(AuthContext);
  if (context === undefined) {
    throw new Error('useAuth must be used within an AuthProvider');
  }
  return context;
};

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
  isAssignedToOffice: (officeId: number) => boolean;
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
      const res = await api.get('/auth/me/', {
        headers: { 'Cache-Control': 'no-cache', 'Pragma': 'no-cache' }
      });
      setUser(res.data);
      if (res.data.office_id) {
        setActiveOfficeState(res.data.office_id);
        setActiveOfficeName(res.data.office_name || null);
      }
    } catch (error) {
      console.error('Failed to fetch user:', error);
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

  const logout = async () => {
    try {
      await api.post('/auth/logout/');
    } catch (e) {
      console.error('Logout failed:', e);
    }
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

    // SuperAdmin can manage everything
    if (user.role === 'SUPERADMIN') return true;

    // If they are explicitly assigned to the office (primary or secondary)
    if (isAssignedToOffice(officeId)) return true;

    // If they have the explicit permission to manage any office's assignments
    if (user.permissions.includes('duties.assign_any_office_employee')) {
      return true;
    }

    return false;
  };

  const isAssignedToOffice = (officeId: number): boolean => {
    if (!user) return false;
    if (user.role === 'SUPERADMIN') return true;
    if (user.office_id === null || user.office_id === undefined) return false;

    const primaryId = Number(user.office_id);
    const secondaryIds = (user.secondary_offices || []).map(id => Number(id));

    return primaryId === Number(officeId) || secondaryIds.includes(Number(officeId));
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
    isAssignedToOffice,
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

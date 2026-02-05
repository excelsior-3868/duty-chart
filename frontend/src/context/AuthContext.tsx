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
  role: string; // "SUPERADMIN", "OFFICE_ADMIN", "USER"
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
  const [isLoading, setIsLoading] = useState<boolean>(true);

  const fetchUser = async () => {
    try {
      const token = localStorage.getItem('access');
      if (!token) {
        setUser(null);
        setIsLoading(false);
        return;
      }

      const res = await api.get('/auth/me/', {
        headers: { 'Cache-Control': 'no-cache', 'Pragma': 'no-cache' }
      });
      setUser(res.data);
    } catch (error) {
      console.error('Failed to fetch user:', error);
      // api.ts interceptor might handle logout, but let's be safe
      setUser(null);
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
    window.location.href = '/login';
  };

  // ----------------------------------------------------------------------
  // RBAC Logic
  // ----------------------------------------------------------------------

  const hasPermission = (permissionSlug: string): boolean => {
    if (!user) return false;
    if (user.role === 'SUPERADMIN') return true;
    return user.permissions.includes(permissionSlug);
  };

  const hasRole = (roleSlug: string): boolean => {
    if (!user) return false;
    return user.role === roleSlug;
  };

  const canManageOffice = (officeId: number): boolean => {
    if (!user) return false;

    // Check if user is SuperAdmin - usually they can manage all
    if (user.role === 'SUPERADMIN') return true;

    // Strict check for Primary Office only (removed secondary office check as requested)
    if (user.office_id === null || user.office_id === undefined) return false;

    return Number(user.office_id) === Number(officeId);
  };

  const value = {
    user,
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

import React from 'react';
import { useAuth } from '@/context/AuthContext';

interface ProtectProps {
  children: React.ReactNode;
  permission?: string;
  role?: string;
  fallback?: React.ReactNode;
}

export const Protect: React.FC<ProtectProps> = ({ 
  children, 
  permission, 
  role, 
  fallback = null 
}) => {
  const { hasPermission, hasRole, isLoading } = useAuth();

  if (isLoading) return null;

  if (permission && !hasPermission(permission)) {
    return <>{fallback}</>;
  }

  if (role && !hasRole(role)) {
    return <>{fallback}</>;
  }

  return <>{children}</>;
};

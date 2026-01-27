import { Navigate, useLocation } from 'react-router-dom';
import { ReactNode } from 'react';
import { ROUTES } from '@/utils/constants';
import { useAuth } from '@/context/AuthContext';

interface ProtectedRouteProps {
  children: ReactNode;
  requiredPermission?: string;
}
export const ProtectedRoute = ({ children, requiredPermission }: ProtectedRouteProps) => {
  const { isAuthenticated, isLoading, hasPermission } = useAuth();
  const location = useLocation();

  if (isLoading) {
    return <div>Loading...</div>;
  }
  
  if (!isAuthenticated) {
    return <Navigate to={ROUTES.LOGIN} replace />;
  }

  // 1. First Login Check (from Main)
  const isFirstLogin = localStorage.getItem("first_login") === "true";
  if (isFirstLogin && location.pathname !== ROUTES.CHANGE_PASSWORD) {
    return <Navigate to={ROUTES.CHANGE_PASSWORD} replace />;
  }

  // 2. Permission Check (from Roles)
  if (requiredPermission && !hasPermission(requiredPermission)) {
    return <div>You do not have permission to view this page.</div>;
  }

  return <>{children}</>;
};

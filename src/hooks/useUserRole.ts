/**
 * useUserRole Hook
 * 
 * Provides convenient access to the current user's role and role-related utilities.
 */

import { useAuth } from '../contexts/AuthContext';
import { UserRole } from '../contexts/AuthContext';

export function useUserRole() {
  const { userRole, refreshUserRole } = useAuth();

  const isAdmin = userRole === 'admin';
  const isEditor = userRole === 'editor' || isAdmin; // Admin has editor permissions too
  const isViewer = userRole === 'viewer' || isEditor; // Editor and admin have viewer permissions
  const hasRole = userRole !== null;

  return {
    userRole,
    isAdmin,
    isEditor,
    isViewer,
    hasRole,
    refreshUserRole,
  };
}

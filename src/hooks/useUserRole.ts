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
  const isViewer1 = userRole === 'viewer1' || isEditor; // Editor and admin have viewer1 permissions
  const isViewer2 = userRole === 'viewer2' || isViewer1; // Viewer1, editor and admin have viewer2 permissions
  const hasRole = userRole !== null;

  return {
    userRole,
    isAdmin,
    isEditor,
    isViewer1,
    isViewer2,
    hasRole,
    refreshUserRole,
  };
}

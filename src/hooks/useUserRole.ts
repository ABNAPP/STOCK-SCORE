import { useAuth } from '../contexts/AuthContext';
import { ViewId } from '../types/navigation';

/**
 * Custom hook for user role management and access control
 * 
 * Provides convenient access to the current user's role and role-related
 * utilities. Simplified to two roles: viewer (default, unauthenticated) and admin.
 * 
 * **Roles:**
 * - viewer: Default role, can view Score table. Can have additional allowedViews if authenticated.
 * - admin: Full access to all tables and admin functions
 * 
 * **Viewer Permissions:**
 * - Unauthenticated viewer: Only Score table
 * - Authenticated viewer without permissions: Only Score table
 * - Authenticated viewer with allowedViews: Score + views specified in allowedViews
 * 
 * @returns Object with role information and permission flags
 * @returns userRole - Current user role ('viewer' | 'admin' | null)
 * @returns isAdmin - True if user is admin
 * @returns hasRole - True if user has any role (not null)
 * @returns getAllowedViews - Function that returns allowed views for viewer, or all views for admin
 * @returns canView - Function to check if user can view a specific view
 * @returns refreshUserRole - Function to refresh user role and permissions from server
 * 
 * @example
 * ```typescript
 * const { isAdmin, canView, userRole } = useUserRole();
 * 
 * if (isAdmin) {
 *   // Show admin-only features
 * }
 * 
 * if (canView('score-board')) {
 *   // Show score-board view
 * }
 * ```
 */
export function useUserRole() {
  const { userRole, viewerPermissions, refreshUserRole } = useAuth();

  const isAdmin = userRole === 'admin';
  const hasRole = userRole !== null;

  /**
   * Get all allowed views for the current user
   * - Admin: Returns null (has access to all views)
   * - Viewer with allowedViews: Returns allowedViews array
   * - Viewer without allowedViews: Returns ['score'] only
   * - Unauthenticated: Returns ['score'] only
   */
  const getAllowedViews = (): string[] | null => {
    if (isAdmin) {
      return null; // Admin has access to all views
    }
    
    if (userRole === 'viewer' && viewerPermissions?.allowedViews) {
      // Viewer with permissions - always include 'score' even if not in allowedViews
      const views = new Set(['score', ...viewerPermissions.allowedViews]);
      return Array.from(views);
    }
    
    // Viewer without permissions or unauthenticated - only Score
    return ['score'];
  };

  /**
   * Check if user can view a specific view
   */
  const canView = (viewId: ViewId): boolean => {
    if (isAdmin) {
      return true; // Admin can view everything
    }
    
    const allowedViews = getAllowedViews();
    if (allowedViews === null) {
      return true; // Admin
    }
    
    return allowedViews.includes(viewId);
  };

  return {
    userRole,
    isAdmin,
    hasRole,
    getAllowedViews,
    canView,
    refreshUserRole,
  };
}

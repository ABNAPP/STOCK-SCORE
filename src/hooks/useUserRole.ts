import { useAuth } from '../contexts/AuthContext';
import { ViewId } from '../types/navigation';

/**
 * Custom hook for user role management and access control
 *
 * Provides convenient access to the current user's role and role-related
 * utilities. Two roles: viewer and admin. All users must be authenticated.
 *
 * **Roles:**
 * - viewer: Can view Score table and Personal Portfolio. May have additional allowedViews if granted by admin.
 * - admin: Full access to all tables and admin functions
 *
 * **Viewer Permissions:**
 * - Viewer without allowedViews: Score + Personal Portfolio only
 * - Viewer with allowedViews: Score + Personal Portfolio + views specified in allowedViews
 *
 * @returns Object with role information and permission flags
 * @returns userRole - Current user role ('viewer' | 'admin' | null)
 * @returns isAdmin - True if user is admin
 * @returns hasRole - True if user has any role (not null)
 * @returns getAllowedViews - Function that returns allowed views for viewer, or all views for admin
 * @returns canView - Function to check if user can view a specific view
 * @returns refreshUserRole - Function to refresh user role and permissions from server
 */
export function useUserRole() {
  const { userRole, viewerPermissions, refreshUserRole } = useAuth();

  const isAdmin = userRole === 'admin';
  const hasRole = userRole !== null;

  /**
   * Get all allowed views for the current user
   * - Admin: Returns null (has access to all views)
   * - Viewer with allowedViews: Score + allowedViews
   * - Viewer without allowedViews: ['score'] only
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
    
    // Viewer without extra permissions - only Score
    return ['score'];
  };

  /** Main navigation view order (used for default landing) */
  const NAV_VIEW_ORDER: ViewId[] = [
    'score',
    'score-board',
    'entry-exit-benjamin-graham',
    'fundamental-pe-industry',
    'threshold-industry',
    'personal-portfolio',
  ];

  /**
   * Get default landing view for the current user
   * - Admin: score-board
   * - Viewer: first view in allowedViews that exists in navigation
   */
  const getDefaultLandingView = (): ViewId => {
    if (isAdmin) {
      return 'score-board';
    }
    const allowed = getAllowedViews();
    if (!allowed) return 'score-board';
    for (const vid of NAV_VIEW_ORDER) {
      if (allowed.includes(vid)) return vid;
    }
    return 'score';
  };

  /**
   * Check if user can view a specific view
   */
  const canView = (viewId: ViewId): boolean => {
    // Admin view only for admin
    if (viewId === 'admin') {
      return isAdmin;
    }
    // Personal Portfolio is available to all authenticated users
    if (viewId === 'personal-portfolio') {
      return hasRole; // Any authenticated user (admin or viewer)
    }
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
    getDefaultLandingView,
    canView,
    refreshUserRole,
  };
}

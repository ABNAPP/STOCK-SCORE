import { useAuth } from '../contexts/AuthContext';

/**
 * Custom hook for user role management and access control
 * 
 * Provides convenient access to the current user's role and role-related
 * utilities. Implements hierarchical role permissions where higher roles
 * inherit permissions from lower roles.
 * 
 * **Role Hierarchy:**
 * - admin: Has all permissions (admin, editor, viewer1, viewer2)
 * - editor: Has editor, viewer1, and viewer2 permissions
 * - viewer1: Has viewer1 and viewer2 permissions
 * - viewer2: Has only viewer2 permissions
 * 
 * **Permission Inheritance:**
 * - Each role automatically has permissions of all lower roles
 * - This simplifies permission checks (e.g., isEditor includes admin)
 * 
 * @returns Object with role information and permission flags
 * @returns userRole - Current user role (admin, editor, viewer1, viewer2, or null)
 * @returns isAdmin - True if user is admin
 * @returns isEditor - True if user is editor or admin
 * @returns isViewer1 - True if user is viewer1, editor, or admin
 * @returns isViewer2 - True if user has any role (lowest permission level)
 * @returns hasRole - True if user has any role (not null)
 * @returns refreshUserRole - Function to refresh user role from server
 * 
 * @example
 * ```typescript
 * const { isAdmin, isEditor, userRole } = useUserRole();
 * 
 * if (isAdmin) {
 *   // Show admin-only features
 * }
 * 
 * if (isEditor) {
 *   // Show editor features (includes admin)
 * }
 * ```
 */
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

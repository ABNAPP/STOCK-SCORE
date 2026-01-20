import { createContext, useContext, useEffect, useState, ReactNode, useCallback } from 'react';
import { 
  User, 
  UserCredential,
  signInWithEmailAndPassword, 
  createUserWithEmailAndPassword,
  signOut,
  onAuthStateChanged,
  getIdTokenResult
} from 'firebase/auth';
import { auth } from '../config/firebase';
import { logger } from '../utils/logger';

export type UserRole = 'viewer' | 'admin' | null;

export interface ViewerPermissions {
  allowedViews?: string[];
}

interface AuthContextType {
  currentUser: User | null;
  userRole: UserRole;
  viewerPermissions: ViewerPermissions | null;
  login: (email: string, password: string) => Promise<void>;
  signup: (email: string, password: string) => Promise<UserCredential>;
  logout: () => Promise<void>;
  refreshUserRole: () => Promise<void>;
  loading: boolean;
}

const AuthContext = createContext<AuthContextType | undefined>(undefined);

/**
 * Hook to access authentication context
 * 
 * Provides access to current user, user role, and authentication methods.
 * Must be used within an AuthProvider component.
 * 
 * @returns AuthContextType with currentUser, userRole, login, signup, logout, refreshUserRole, and loading
 * @throws {Error} If used outside of AuthProvider
 * 
 * @example
 * ```typescript
 * function MyComponent() {
 *   const { currentUser, userRole, logout } = useAuth();
 *   
 *   if (!currentUser) {
 *     return <Login />;
 *   }
 *   
 *   return <div>Welcome, {currentUser.email}</div>;
 * }
 * ```
 */
export function useAuth(): AuthContextType {
  const context = useContext(AuthContext);
  if (context === undefined) {
    throw new Error('useAuth must be used within an AuthProvider');
  }
  return context;
}

/**
 * Authentication context provider
 * 
 * Provides authentication state and methods to all child components.
 * Manages user authentication, role retrieval, and auth state changes.
 * 
 * @param children - React children components that need access to auth context
 * 
 * @example
 * ```typescript
 * <AuthProvider>
 *   <App />
 * </AuthProvider>
 * ```
 */
export function AuthProvider({ children }: { children: ReactNode }) {
  const [currentUser, setCurrentUser] = useState<User | null>(null);
  const [userRole, setUserRole] = useState<UserRole>(null);
  const [viewerPermissions, setViewerPermissions] = useState<ViewerPermissions | null>(null);
  const [loading, setLoading] = useState(true);

  // Get user role from custom claims
  const getUserRole = useCallback(async (user: User | null): Promise<UserRole> => {
    if (!user) return null;
    
    try {
      const tokenResult = await getIdTokenResult(user, true); // Force refresh to get latest claims
      const role = tokenResult.claims.role as string;
      
      if (role === 'viewer' || role === 'admin') {
        return role;
      }
      
      return null;
    } catch (error) {
      logger.error('Error getting user role', error, { component: 'AuthContext', operation: 'getUserRole' });
      return null;
    }
  }, []);

  // Get viewer permissions (allowedViews) from custom claims
  const getViewerPermissions = useCallback(async (user: User | null): Promise<ViewerPermissions | null> => {
    if (!user) return null;
    
    try {
      const tokenResult = await getIdTokenResult(user, true); // Force refresh to get latest claims
      const allowedViews = tokenResult.claims.allowedViews as string[] | undefined;
      
      if (allowedViews && Array.isArray(allowedViews)) {
        return { allowedViews };
      }
      
      return null;
    } catch (error) {
      logger.error('Error getting viewer permissions', error, { component: 'AuthContext', operation: 'getViewerPermissions' });
      return null;
    }
  }, []);

  // Refresh user role and permissions (useful after admin changes permissions)
  const refreshUserRole = useCallback(async () => {
    if (currentUser) {
      const role = await getUserRole(currentUser);
      setUserRole(role);
      
      const permissions = await getViewerPermissions(currentUser);
      setViewerPermissions(permissions);
    }
  }, [currentUser, getUserRole, getViewerPermissions]);

  function signup(email: string, password: string): Promise<UserCredential> {
    return createUserWithEmailAndPassword(auth, email, password);
  }

  function login(email: string, password: string) {
    return signInWithEmailAndPassword(auth, email, password).then(() => {
      // User logged in successfully
    });
  }

  function logout() {
    return signOut(auth);
  }

  useEffect(() => {
    const unsubscribe = onAuthStateChanged(auth, async (user) => {
      setCurrentUser(user);
      
      if (user) {
        const role = await getUserRole(user);
        setUserRole(role);
        
        const permissions = await getViewerPermissions(user);
        setViewerPermissions(permissions);
      } else {
        setUserRole(null);
        setViewerPermissions(null);
      }
      
      setLoading(false);
    });

    return unsubscribe;
  }, [getUserRole, getViewerPermissions]);

  const value = {
    currentUser,
    userRole,
    viewerPermissions,
    login,
    signup,
    logout,
    refreshUserRole,
    loading
  };

  return (
    <AuthContext.Provider value={value}>
      {children}
    </AuthContext.Provider>
  );
}


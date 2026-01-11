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

export type UserRole = 'viewer' | 'editor' | 'admin' | null;

interface AuthContextType {
  currentUser: User | null;
  userRole: UserRole;
  login: (email: string, password: string) => Promise<void>;
  signup: (email: string, password: string) => Promise<UserCredential>;
  logout: () => Promise<void>;
  refreshUserRole: () => Promise<void>;
  loading: boolean;
}

const AuthContext = createContext<AuthContextType>({} as AuthContextType);

export function useAuth() {
  return useContext(AuthContext);
}

export function AuthProvider({ children }: { children: ReactNode }) {
  const [currentUser, setCurrentUser] = useState<User | null>(null);
  const [userRole, setUserRole] = useState<UserRole>(null);
  const [loading, setLoading] = useState(true);

  // Get user role from custom claims
  const getUserRole = useCallback(async (user: User | null): Promise<UserRole> => {
    if (!user) return null;
    
    try {
      const tokenResult = await getIdTokenResult(user, true); // Force refresh to get latest claims
      const role = tokenResult.claims.role as string;
      
      if (role === 'viewer' || role === 'editor' || role === 'admin') {
        return role;
      }
      
      return null;
    } catch (error) {
      console.error('Error getting user role:', error);
      return null;
    }
  }, []);

  // Refresh user role (useful after admin approves request)
  const refreshUserRole = useCallback(async () => {
    if (currentUser) {
      const role = await getUserRole(currentUser);
      setUserRole(role);
    }
  }, [currentUser, getUserRole]);

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
      } else {
        setUserRole(null);
      }
      
      setLoading(false);
    });

    return unsubscribe;
  }, [getUserRole]);

  const value = {
    currentUser,
    userRole,
    login,
    signup,
    logout,
    refreshUserRole,
    loading
  };

  return (
    <AuthContext.Provider value={value}>
      {!loading && children}
    </AuthContext.Provider>
  );
}


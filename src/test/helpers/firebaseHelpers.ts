/**
 * Firebase Test Helpers
 * 
 * Provides helper functions for mocking Firebase services in tests.
 */

import { vi } from 'vitest';
import { User } from 'firebase/auth';
import { createMockFirebaseUser, createMockFirestoreDoc } from '../fixtures/mockFirebase';

/**
 * Setup mock Firebase Auth
 */
export function mockFirebaseAuth(user: User | null = null) {
  const mockAuth = {
    currentUser: user,
    onAuthStateChanged: vi.fn((callback) => {
      callback(user);
      return vi.fn(); // Return unsubscribe function
    }),
    signInWithEmailAndPassword: vi.fn().mockResolvedValue({ user }),
    signOut: vi.fn().mockResolvedValue(undefined),
    createUserWithEmailAndPassword: vi.fn().mockResolvedValue({ user }),
  };

  return mockAuth;
}

/**
 * Mock Firestore document
 */
export function mockFirestoreDoc<T>(data: T, exists: boolean = true) {
  return createMockFirestoreDoc(data, exists);
}

/**
 * Mock Firestore collection query
 */
export function mockFirestoreCollection<T>(docs: Array<{ id: string; data: T }>) {
  return {
    docs: docs.map(doc => createMockFirestoreDoc(doc.data)),
    empty: docs.length === 0,
    size: docs.length,
    forEach: vi.fn((callback) => {
      docs.forEach(doc => {
        callback(createMockFirestoreDoc(doc.data));
      });
    }),
  };
}

/**
 * Mock Firestore error
 */
export function mockFirestoreError(code: string, message: string) {
  return {
    code,
    message,
    name: 'FirestoreError',
  };
}

/**
 * Setup complete Firebase mocks
 */
export function setupFirebaseMocks(options: {
  user?: User | null;
  firestoreData?: Record<string, unknown>;
} = {}) {
  const { user = createMockFirebaseUser(), firestoreData = {} } = options;

  const auth = mockFirebaseAuth(user);

  const firestore = {
    doc: vi.fn((collection, id) => ({
      id,
      path: `${collection}/${id}`,
    })),
    collection: vi.fn((collection) => ({
      id: collection,
      path: collection,
    })),
    getDoc: vi.fn((docRef) => {
      const key = docRef.path;
      const data = firestoreData[key];
      return Promise.resolve(createMockFirestoreDoc(data || null, !!data));
    }),
    setDoc: vi.fn().mockResolvedValue(undefined),
    updateDoc: vi.fn().mockResolvedValue(undefined),
    deleteDoc: vi.fn().mockResolvedValue(undefined),
    getDocs: vi.fn().mockResolvedValue({
      docs: [],
      empty: true,
      size: 0,
    }),
  };

  return { auth, firestore, user };
}

// Re-export for convenience
export { createMockFirebaseUser } from '../fixtures/mockFirebase';

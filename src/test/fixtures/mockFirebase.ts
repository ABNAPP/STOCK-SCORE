/**
 * Firebase Mock Fixtures
 * 
 * Provides mock implementations of Firebase services for testing.
 */

import { vi } from 'vitest';
import { User } from 'firebase/auth';
import { Timestamp } from 'firebase/firestore';

/**
 * Create a mock Firebase User
 */
export function createMockFirebaseUser(overrides: Partial<User> = {}): User {
  return {
    uid: 'test-user-id',
    email: 'test@example.com',
    displayName: 'Test User',
    emailVerified: true,
    isAnonymous: false,
    metadata: {
      creationTime: '2024-01-01T00:00:00Z',
      lastSignInTime: '2024-01-01T00:00:00Z',
    },
    providerData: [],
    refreshToken: 'mock-refresh-token',
    tenantId: null,
    delete: vi.fn(),
    getIdToken: vi.fn().mockResolvedValue('mock-id-token'),
    getIdTokenResult: vi.fn().mockResolvedValue({
      token: 'mock-id-token',
      authTime: '2024-01-01T00:00:00Z',
      issuedAtTime: '2024-01-01T00:00:00Z',
      expirationTime: '2024-01-02T00:00:00Z',
      signInProvider: 'password',
      claims: { role: 'viewer1' },
    }),
    reload: vi.fn().mockResolvedValue(undefined),
    toJSON: vi.fn().mockReturnValue({}),
    ...overrides,
  } as User;
}

/**
 * Create a mock Firestore document snapshot
 */
export function createMockFirestoreDoc<T>(data: T, exists: boolean = true) {
  return {
    exists: () => exists,
    id: 'test-doc-id',
    data: () => (exists ? data : undefined),
    metadata: {
      hasPendingWrites: false,
      isFromCache: false,
    },
    ref: {
      id: 'test-doc-id',
      path: 'test/path',
    },
  };
}

/**
 * Create a mock Firestore query snapshot
 */
export function createMockFirestoreQuerySnapshot<T>(docs: Array<{ id: string; data: T }>) {
  return {
    docs: docs.map(doc => createMockFirestoreDoc(doc.data)),
    empty: docs.length === 0,
    size: docs.length,
    metadata: {
      hasPendingWrites: false,
      isFromCache: false,
    },
    query: {},
    forEach: (callback: (doc: ReturnType<typeof createMockFirestoreDoc>) => void) => {
      docs.forEach(doc => {
        callback(createMockFirestoreDoc(doc.data));
      });
    },
  };
}

/**
 * Create a mock Firestore Timestamp
 */
export function createMockTimestamp(date: Date = new Date()): Timestamp {
  return {
    seconds: Math.floor(date.getTime() / 1000),
    nanoseconds: (date.getTime() % 1000) * 1000000,
    toDate: () => date,
    toMillis: () => date.getTime(),
    isEqual: vi.fn(),
    valueOf: () => date.getTime(),
  } as unknown as Timestamp;
}

/**
 * Mock Firebase Auth
 */
export function mockFirebaseAuth(user: User | null = null) {
  return {
    currentUser: user,
    onAuthStateChanged: vi.fn((callback) => {
      callback(user);
      return vi.fn(); // Return unsubscribe function
    }),
    signInWithEmailAndPassword: vi.fn().mockResolvedValue({ user }),
    signOut: vi.fn().mockResolvedValue(undefined),
    createUserWithEmailAndPassword: vi.fn().mockResolvedValue({ user }),
  };
}

/**
 * Mock Firestore document reference
 */
export function mockFirestoreDocRef(collection: string, id: string) {
  return {
    id,
    path: `${collection}/${id}`,
    parent: {
      id: collection,
      path: collection,
    },
  };
}

/**
 * Mock Firestore collection reference
 */
export function mockFirestoreCollectionRef(collection: string) {
  return {
    id: collection,
    path: collection,
  };
}

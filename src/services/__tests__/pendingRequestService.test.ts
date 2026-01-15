import { describe, it, expect, beforeEach, vi } from 'vitest';
import {
  createPendingRequest,
  getPendingRequest,
  getAllPendingRequests,
  updateRequestStatus,
  deletePendingRequest,
  autoApproveViewer2Request,
  PendingRequest,
  RequestType,
  RequestedRole,
} from '../pendingRequestService';
import { User } from 'firebase/auth';
import { doc, setDoc, getDoc, getDocs, updateDoc, deleteDoc, query, where, collection, serverTimestamp, Timestamp } from 'firebase/firestore';
import { httpsCallable } from 'firebase/functions';

// Mock Firebase Firestore
const mockSetDoc = vi.fn();
const mockGetDoc = vi.fn();
const mockGetDocs = vi.fn();
const mockUpdateDoc = vi.fn();
const mockDeleteDoc = vi.fn();
const mockQuery = vi.fn();
const mockWhere = vi.fn();
const mockCollection = vi.fn();
const mockServerTimestamp = vi.fn(() => ({ _methodName: 'serverTimestamp' }));

vi.mock('firebase/firestore', () => ({
  doc: vi.fn((db, collection, id) => ({ _path: { segments: [collection, id] } })),
  setDoc: vi.fn((...args) => mockSetDoc(...args)),
  getDoc: vi.fn((...args) => mockGetDoc(...args)),
  getDocs: vi.fn((...args) => mockGetDocs(...args)),
  updateDoc: vi.fn((...args) => mockUpdateDoc(...args)),
  deleteDoc: vi.fn((...args) => mockDeleteDoc(...args)),
  query: vi.fn((...args) => mockQuery(...args)),
  where: vi.fn((...args) => mockWhere(...args)),
  collection: vi.fn((...args) => mockCollection(...args)),
  serverTimestamp: vi.fn(() => mockServerTimestamp()),
  Timestamp: {
    now: vi.fn(() => ({ toMillis: () => Date.now() })),
  },
}));

// Mock Firebase Functions
const mockHttpsCallable = vi.fn();

vi.mock('firebase/functions', () => ({
  httpsCallable: vi.fn((...args) => mockHttpsCallable(...args)),
}));

vi.mock('../config/firebase', () => ({
  db: {},
  functions: {},
}));

// Mock logger
vi.mock('../../utils/logger', () => ({
  logger: {
    debug: vi.fn(),
    info: vi.fn(),
    warn: vi.fn(),
    error: vi.fn(),
  },
}));

describe('pendingRequestService', () => {
  const mockUser: User = {
    uid: 'test-user-id',
    email: 'test@example.com',
    displayName: 'Test User',
  } as User;

  beforeEach(() => {
    vi.clearAllMocks();
  });

  describe('createPendingRequest', () => {
    it('should create a new pending request', async () => {
      mockGetDoc.mockResolvedValue({
        exists: () => false,
      });
      mockSetDoc.mockResolvedValue(undefined);

      await createPendingRequest(mockUser, 'editor', 'upgrade_request');

      expect(mockSetDoc).toHaveBeenCalledWith(
        expect.any(Object),
        expect.objectContaining({
          userId: mockUser.uid,
          email: mockUser.email,
          requestedRole: 'editor',
          requestType: 'upgrade_request',
          status: 'pending',
        })
      );
    });

    it('should throw error if pending request already exists', async () => {
      mockGetDoc.mockResolvedValue({
        exists: () => true,
        data: () => ({
          status: 'pending',
        }),
      });

      await expect(
        createPendingRequest(mockUser, 'editor', 'upgrade_request')
      ).rejects.toThrow('A pending request already exists for this user');
    });

    it('should update denied request to pending', async () => {
      mockGetDoc.mockResolvedValue({
        exists: () => true,
        data: () => ({
          status: 'denied',
        }),
      });
      mockUpdateDoc.mockResolvedValue(undefined);

      await createPendingRequest(mockUser, 'editor', 'upgrade_request');

      expect(mockUpdateDoc).toHaveBeenCalledWith(
        expect.any(Object),
        expect.objectContaining({
          requestedRole: 'editor',
          requestType: 'upgrade_request',
          status: 'pending',
        })
      );
    });

    it('should handle errors during creation', async () => {
      mockGetDoc.mockResolvedValue({
        exists: () => false,
      });
      mockSetDoc.mockRejectedValue(new Error('Firestore error'));

      await expect(
        createPendingRequest(mockUser, 'editor', 'upgrade_request')
      ).rejects.toThrow();
    });
  });

  describe('getPendingRequest', () => {
    it('should return pending request if exists', async () => {
      const requestData: PendingRequest = {
        userId: mockUser.uid,
        email: mockUser.email!,
        requestedRole: 'editor',
        requestType: 'upgrade_request',
        status: 'pending',
        timestamp: Timestamp.now(),
      };

      mockGetDoc.mockResolvedValue({
        exists: () => true,
        data: () => requestData,
      });

      const result = await getPendingRequest(mockUser.uid);

      expect(result).toEqual(requestData);
    });

    it('should return null if request does not exist', async () => {
      mockGetDoc.mockResolvedValue({
        exists: () => false,
      });

      const result = await getPendingRequest(mockUser.uid);

      expect(result).toBeNull();
    });

    it('should handle errors gracefully', async () => {
      mockGetDoc.mockRejectedValue(new Error('Firestore error'));

      const result = await getPendingRequest(mockUser.uid);

      expect(result).toBeNull();
    });
  });

  describe('getAllPendingRequests', () => {
    it('should return all pending requests', async () => {
      const requests: PendingRequest[] = [
        {
          userId: 'user1',
          email: 'user1@example.com',
          requestedRole: 'editor',
          requestType: 'upgrade_request',
          status: 'pending',
          timestamp: Timestamp.now(),
        },
        {
          userId: 'user2',
          email: 'user2@example.com',
          requestedRole: 'viewer1',
          requestType: 'initial_registration',
          status: 'pending',
          timestamp: Timestamp.now(),
        },
      ];

      const mockQuerySnapshot = {
        forEach: vi.fn((callback) => {
          requests.forEach((req, index) => {
            callback({
              id: `user${index + 1}`,
              data: () => req,
            });
          });
        }),
      };

      mockGetDocs.mockResolvedValue(mockQuerySnapshot);

      const result = await getAllPendingRequests();

      expect(result).toHaveLength(2);
      expect(mockGetDocs).toHaveBeenCalled();
    });

    it('should return empty array if no pending requests', async () => {
      const mockQuerySnapshot = {
        forEach: vi.fn(),
      };

      mockGetDocs.mockResolvedValue(mockQuerySnapshot);

      const result = await getAllPendingRequests();

      expect(result).toEqual([]);
    });

    it('should sort requests by timestamp (newest first)', async () => {
      const now = Date.now();
      const requests: PendingRequest[] = [
        {
          userId: 'user1',
          email: 'user1@example.com',
          requestedRole: 'editor',
          requestType: 'upgrade_request',
          status: 'pending',
          timestamp: new Date(now - 1000) as any,
        },
        {
          userId: 'user2',
          email: 'user2@example.com',
          requestedRole: 'viewer1',
          requestType: 'initial_registration',
          status: 'pending',
          timestamp: new Date(now) as any,
        },
      ];

      const mockQuerySnapshot = {
        forEach: vi.fn((callback) => {
          requests.forEach((req, index) => {
            callback({
              id: `user${index + 1}`,
              data: () => req,
            });
          });
        }),
      };

      mockGetDocs.mockResolvedValue(mockQuerySnapshot);

      const result = await getAllPendingRequests();

      expect(result[0].userId).toBe('user2');
      expect(result[1].userId).toBe('user1');
    });

    it('should handle errors gracefully', async () => {
      mockGetDocs.mockRejectedValue(new Error('Firestore error'));

      const result = await getAllPendingRequests();

      expect(result).toEqual([]);
    });
  });

  describe('updateRequestStatus', () => {
    it('should update request status to approved', async () => {
      mockUpdateDoc.mockResolvedValue(undefined);

      await updateRequestStatus('user-id', 'approved', 'editor', 'admin-id');

      expect(mockUpdateDoc).toHaveBeenCalledWith(
        expect.any(Object),
        expect.objectContaining({
          status: 'approved',
          approvedRole: 'editor',
          approvedAt: expect.any(Object),
          approvedBy: 'admin-id',
        })
      );
    });

    it('should update request status to denied', async () => {
      mockUpdateDoc.mockResolvedValue(undefined);

      await updateRequestStatus('user-id', 'denied', undefined, 'admin-id');

      expect(mockUpdateDoc).toHaveBeenCalledWith(
        expect.any(Object),
        expect.objectContaining({
          status: 'denied',
          deniedAt: expect.any(Object),
          deniedBy: 'admin-id',
        })
      );
    });

    it('should handle errors', async () => {
      mockUpdateDoc.mockRejectedValue(new Error('Firestore error'));

      await expect(
        updateRequestStatus('user-id', 'approved', 'editor')
      ).rejects.toThrow();
    });
  });

  describe('deletePendingRequest', () => {
    it('should delete pending request', async () => {
      mockGetDoc.mockResolvedValue({
        exists: () => true,
        data: () => ({
          userId: 'user-id',
          status: 'pending',
        }),
      });
      mockDeleteDoc.mockResolvedValue(undefined);

      await deletePendingRequest('user-id');

      expect(mockDeleteDoc).toHaveBeenCalled();
    });

    it('should throw error if request not found', async () => {
      mockGetDoc.mockResolvedValue({
        exists: () => false,
      });

      await expect(deletePendingRequest('user-id')).rejects.toThrow('Request not found');
    });

    it('should throw error if request is not pending', async () => {
      mockGetDoc.mockResolvedValue({
        exists: () => true,
        data: () => ({
          userId: 'user-id',
          status: 'approved',
        }),
      });

      await expect(deletePendingRequest('user-id')).rejects.toThrow('Can only withdraw pending requests');
    });

    it('should throw error if request does not belong to user', async () => {
      mockGetDoc.mockResolvedValue({
        exists: () => true,
        data: () => ({
          userId: 'different-user-id',
          status: 'pending',
        }),
      });

      await expect(deletePendingRequest('user-id')).rejects.toThrow('Unauthorized');
    });

    it('should handle errors', async () => {
      mockGetDoc.mockRejectedValue(new Error('Firestore error'));

      await expect(deletePendingRequest('user-id')).rejects.toThrow();
    });
  });

  describe('autoApproveViewer2Request', () => {
    it('should call Cloud Function to auto-approve', async () => {
      const mockFunction = vi.fn().mockResolvedValue({ data: { success: true } });
      mockHttpsCallable.mockReturnValue(mockFunction);

      await autoApproveViewer2Request('user-id');

      expect(mockHttpsCallable).toHaveBeenCalledWith(expect.any(Object), 'autoApproveViewer2');
      expect(mockFunction).toHaveBeenCalledWith({ userId: 'user-id' });
    });

    it('should handle errors', async () => {
      const mockFunction = vi.fn().mockRejectedValue(new Error('Cloud Function error'));
      mockHttpsCallable.mockReturnValue(mockFunction);

      await expect(autoApproveViewer2Request('user-id')).rejects.toThrow();
    });
  });
});

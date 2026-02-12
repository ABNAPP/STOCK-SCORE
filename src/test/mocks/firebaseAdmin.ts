/**
 * Mock for firebase-admin (used when testing adminRefreshHelpers).
 * Provides firestore() that returns chainable collection().doc().set().
 * Captures writes for test assertions.
 */

export const appCacheWrites: Array<{ collection: string; docId: string }> = [];
export const viewDataWrites: Array<{ collection: string; docId: string }> = [];

const firestoreFn = () => ({
  collection: (name: string) => ({
    doc: (id: string) => ({
      set: async () => {
        if (name === 'appCache') appCacheWrites.push({ collection: name, docId: id });
        else if (name === 'viewData') viewDataWrites.push({ collection: name, docId: id });
        return undefined;
      },
    }),
  }),
});

firestoreFn.FieldValue = {
  serverTimestamp: () => ({}),
};

export const firestore = firestoreFn;

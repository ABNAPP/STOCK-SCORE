import { createContext, useContext, ReactNode, useCallback } from 'react';
import type { ShareableLink } from '../services/shareableLinkService';

export interface ShareableHydrationContextType {
  link: ShareableLink | null;
  consume: () => void;
}

const ShareableHydrationContext = createContext<ShareableHydrationContextType | undefined>(undefined);

export interface ShareableHydrationProviderProps {
  children: ReactNode;
  link: ShareableLink | null;
  onConsume: () => void;
}

export function ShareableHydrationProvider({ children, link, onConsume }: ShareableHydrationProviderProps) {
  const consume = useCallback(() => {
    onConsume();
  }, [onConsume]);

  const value: ShareableHydrationContextType = {
    link,
    consume,
  };

  return (
    <ShareableHydrationContext.Provider value={value}>
      {children}
    </ShareableHydrationContext.Provider>
  );
}

export function useShareableHydration(): ShareableHydrationContextType {
  const context = useContext(ShareableHydrationContext);
  if (context === undefined) {
    return {
      link: null,
      consume: () => {},
    };
  }
  return context;
}

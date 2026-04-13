import { useTranslation } from 'react-i18next';
import { EntryExitProvider } from '../../contexts/EntryExitContext';
import ISMPostureViewInner from './ISMPostureViewInner';

/**
 * ISM tab: own `EntryExitProvider` so currency loads via existing Firestore path without touching other tabs.
 */
export default function ISMPostureView() {
  return (
    <EntryExitProvider>
      <ISMPostureViewInner />
    </EntryExitProvider>
  );
}

import { useState, useEffect, useMemo } from 'react';
import { useTranslation } from 'react-i18next';
import { useAuth } from '../contexts/AuthContext';
import { useOnboarding } from '../hooks/useOnboarding';
import { useOnlineStatus } from '../hooks/useOnlineStatus';
import { useUserRole } from '../hooks/useUserRole';

interface OnboardingHelpProps {
  tableId?: string;
  isOpen?: boolean;
  onClose?: () => void;
}

export default function OnboardingHelp({ isOpen: externalIsOpen, onClose: externalOnClose }: OnboardingHelpProps) {
  const [currentStep, setCurrentStep] = useState(0);
  const { t } = useTranslation();
  const { currentUser } = useAuth();
  const isOnline = useOnlineStatus();
  const uid = currentUser?.uid ?? null;
  const {
    isCompleted,
    markCompleted,
    isOpen: internalIsOpen,
    setOpen: setInternalOpen,
    showOnboarding,
  } = useOnboarding(uid);

  const isExternallyControlled = externalIsOpen !== undefined;
  const isOpen = isExternallyControlled ? externalIsOpen : internalIsOpen;
  const { canView } = useUserRole();

  // Auto-show on first visit when not externally controlled
  useEffect(() => {
    if (!isExternallyControlled && !isCompleted) {
      const timer = setTimeout(() => {
        showOnboarding();
      }, 1000);
      return () => clearTimeout(timer);
    }
  }, [isExternallyControlled, isCompleted, showOnboarding]);

  const handleClose = () => {
    if (externalOnClose) {
      externalOnClose();
    } else {
      setInternalOpen(false);
    }
  };

  const handleMarkCompleted = () => {
    markCompleted();
    if (externalOnClose) {
      externalOnClose();
    } else {
      setInternalOpen(false);
    }
  };

  // Build steps: base (1-3) + view-specific (RBAC-filtered) + offline when offline + final
  const baseSteps = [
    { key: 'step1', icon: '👋' },
    { key: 'step2', icon: '📊' },
    { key: 'step3', icon: '🎨' },
  ];
  const viewSteps = useMemo(() => {
    const steps: Array<{ key: string; icon: string }> = [];
    if (canView('score-board') || canView('score')) {
      steps.push({ key: 'stepScoreBoard', icon: '📈' });
    }
    if (canView('entry-exit-benjamin-graham')) {
      steps.push({ key: 'stepEntryExit', icon: '📉' });
    }
    if (canView('fundamental-pe-industry')) {
      steps.push({ key: 'stepPEIndustry', icon: '🏭' });
    }
    if (canView('industry-threshold')) {
      steps.push({ key: 'stepThreshold', icon: '📊' });
    }
    return steps;
  }, [canView]);
  const offlineStep = !isOnline ? [{ key: 'step4', icon: '📴' }] : [];
  const finalStep = [{ key: 'step5', icon: '✅' }];
  const steps = [...baseSteps, ...viewSteps, ...offlineStep, ...finalStep];

  const handleNext = () => {
    if (currentStep < steps.length - 1) {
      setCurrentStep(currentStep + 1);
    } else {
      handleMarkCompleted();
    }
  };

  const handlePrevious = () => {
    if (currentStep > 0) {
      setCurrentStep(currentStep - 1);
    }
  };

  const handleSkip = () => {
    handleMarkCompleted();
  };

  if (!isOpen) {
    return null;
  }

  const stepData = steps[currentStep];
  const stepKey = stepData.key;

  return (
    <div className="fixed inset-0 bg-black bg-opacity-50 z-50 flex items-center justify-center p-4 animate-fade-in">
      <div className="bg-white dark:bg-gray-800 rounded-lg shadow-2xl max-w-lg w-full p-6 animate-fade-in-up">
        <div className="flex items-center justify-between mb-4">
          <div className="flex items-center gap-3">
            <span className="text-3xl">{stepData.icon}</span>
            <div>
              <h3 className="text-xl font-bold text-black dark:text-white">
                {t(`onboarding.${stepKey}.title`)}
              </h3>
              <p className="text-sm text-gray-500 dark:text-gray-400">
                {currentStep + 1} / {steps.length}
              </p>
            </div>
          </div>
          <button
            onClick={handleClose}
            className="text-gray-400 hover:text-gray-600 dark:hover:text-gray-300 transition-colors min-h-[44px] min-w-[44px] flex items-center justify-center"
            aria-label={t('aria.closeModal')}
          >
            <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24" aria-hidden="true">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
            </svg>
          </button>
        </div>

        <div className="mb-6">
          <p className="text-gray-700 dark:text-gray-300 leading-relaxed">
            {t(`onboarding.${stepKey}.content`)}
          </p>
        </div>

        <div className="mb-6">
          <div className="w-full bg-gray-200 dark:bg-gray-700 rounded-full h-2">
            <div
              className="bg-blue-600 dark:bg-blue-500 h-2 rounded-full transition-all duration-300"
              style={{ width: `${((currentStep + 1) / steps.length) * 100}%` }}
            />
          </div>
        </div>

        <div className="flex items-center justify-between gap-3">
          <button
            onClick={handleSkip}
            className="px-4 py-2 text-sm font-medium text-gray-600 dark:text-gray-400 hover:text-gray-800 dark:hover:text-gray-200 transition-colors min-h-[44px]"
          >
            {t('onboarding.skip')}
          </button>
          <div className="flex gap-2">
            {currentStep > 0 && (
              <button
                onClick={handlePrevious}
                className="px-4 py-2 text-sm font-medium text-gray-700 dark:text-gray-300 bg-gray-200 dark:bg-gray-700 rounded-md hover:bg-gray-300 dark:hover:bg-gray-600 transition-colors min-h-[44px]"
              >
                {t('onboarding.previous')}
              </button>
            )}
            <button
              onClick={handleNext}
              className="px-4 py-2 text-sm font-medium text-white bg-blue-600 dark:bg-blue-500 rounded-md hover:bg-blue-700 dark:hover:bg-blue-600 transition-colors min-h-[44px] flex items-center gap-2"
            >
              {currentStep === steps.length - 1 ? t('onboarding.done') : t('onboarding.next')}
              {currentStep < steps.length - 1 && (
                <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5l7 7-7 7" />
                </svg>
              )}
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}

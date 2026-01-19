import { useState, useEffect } from 'react';
import { useTranslation } from 'react-i18next';

interface OnboardingHelpProps {
  tableId?: string;
  isOpen?: boolean;
  onClose?: () => void;
}

export default function OnboardingHelp({ tableId, isOpen: externalIsOpen, onClose: externalOnClose }: OnboardingHelpProps) {
  const [internalIsOpen, setInternalIsOpen] = useState(false);
  const [currentStep, setCurrentStep] = useState(0);
  const { t, i18n } = useTranslation();
  const language = i18n.language;

  // Use external control if provided, otherwise use internal state
  const isOpen = externalIsOpen !== undefined ? externalIsOpen : internalIsOpen;

  // Check if user has completed onboarding (only for auto-open behavior when not externally controlled)
  useEffect(() => {
    if (externalIsOpen === undefined) {
      const onboardingCompleted = localStorage.getItem('stockScoreOnboardingCompleted');
      if (!onboardingCompleted) {
        // Show onboarding for first-time users after a short delay
        const timer = setTimeout(() => {
          setInternalIsOpen(true);
        }, 1000);
        return () => clearTimeout(timer);
      }
    }
  }, [externalIsOpen]);

  const markCompleted = () => {
    localStorage.setItem('stockScoreOnboardingCompleted', 'true');
    if (externalOnClose) {
      externalOnClose();
    } else {
      setInternalIsOpen(false);
    }
  };

  const onboardingSteps = language === 'sv' ? [
    {
      title: 'Välkommen till Stock Score!',
      content: 'Detta är din guide för att komma igång med Stock Score-applikationen. Klicka på "Nästa" för att lära dig mer.',
      icon: '👋'
    },
    {
      title: 'Tabellfunktioner',
      content: 'Alla tabeller stöder sökning, filtrering, sortering och kolumnsynlighet. Använd verktygsfälten ovanför varje tabell för att anpassa din vy.',
      icon: '📊'
    },
    {
      title: 'Kolumnfilter',
      content: 'Varje kolumn har ett filter-ikon i headern. Klicka på ikonen för att filtrera data direkt i kolumnen. Filter kan kombineras för mer avancerad filtrering.',
      icon: '🔍'
    },
    {
      title: 'Tooltips & Information',
      content: 'Hovra över kolumnnamn eller klicka på ikoner för att se detaljerad information om datakällor, formler och villkor. Information-ikonen (ℹ️) visar ytterligare detaljer.',
      icon: 'ℹ️'
    },
    {
      title: 'Färgkodning',
      content: 'Värden är färgkodade: GRÖN = bra, BLÅ = medel, RÖD = dåligt. Färger baseras på thresholds och branschstandarder.',
      icon: '🎨'
    },
    {
      title: 'Klar att börja!',
      content: 'Du kan alltid öppna denna guide igen genom att klicka på hjälp-ikonen i sidofältet eller header. Lycka till med din analys!',
      icon: '✅'
    }
  ] : [
    {
      title: 'Welcome to Stock Score!',
      content: 'This is your guide to get started with the Stock Score application. Click "Next" to learn more.',
      icon: '👋'
    },
    {
      title: 'Table Features',
      content: 'All tables support search, filtering, sorting, and column visibility. Use the toolbars above each table to customize your view.',
      icon: '📊'
    },
    {
      title: 'Column Filters',
      content: 'Each column has a filter icon in the header. Click the icon to filter data directly in the column. Filters can be combined for advanced filtering.',
      icon: '🔍'
    },
    {
      title: 'Tooltips & Information',
      content: 'Hover over column names or click icons to see detailed information about data sources, formulas, and conditions. The info icon (ℹ️) shows additional details.',
      icon: 'ℹ️'
    },
    {
      title: 'Color Coding',
      content: 'Values are color-coded: GREEN = good, BLUE = medium, RED = bad. Colors are based on thresholds and industry standards.',
      icon: '🎨'
    },
    {
      title: 'Ready to Start!',
      content: 'You can always open this guide again by clicking the help icon in the sidebar or header. Good luck with your analysis!',
      icon: '✅'
    }
  ];

  const handleClose = () => {
    if (externalOnClose) {
      externalOnClose();
    } else {
      setInternalIsOpen(false);
    }
  };

  const handleNext = () => {
    if (currentStep < onboardingSteps.length - 1) {
      setCurrentStep(currentStep + 1);
    } else {
      markCompleted();
    }
  };

  const handlePrevious = () => {
    if (currentStep > 0) {
      setCurrentStep(currentStep - 1);
    }
  };

  const handleSkip = () => {
    markCompleted();
  };

  if (!isOpen) {
    return null;
  }

  const currentStepData = onboardingSteps[currentStep];

  return (
    <div className="fixed inset-0 bg-black bg-opacity-50 z-50 flex items-center justify-center p-4 animate-fade-in">
      <div className="bg-white dark:bg-gray-800 rounded-lg shadow-2xl max-w-lg w-full p-6 animate-fade-in-up">
        {/* Header */}
        <div className="flex items-center justify-between mb-4">
          <div className="flex items-center gap-3">
            <span className="text-3xl">{currentStepData.icon}</span>
            <div>
              <h3 className="text-xl font-bold text-gray-900 dark:text-gray-100">
                {currentStepData.title}
              </h3>
              <p className="text-sm text-gray-500 dark:text-gray-400">
                {currentStep + 1} / {onboardingSteps.length}
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

        {/* Content */}
        <div className="mb-6">
          <p className="text-gray-700 dark:text-gray-300 leading-relaxed">
            {currentStepData.content}
          </p>
        </div>

        {/* Progress Bar */}
        <div className="mb-6">
          <div className="w-full bg-gray-200 dark:bg-gray-700 rounded-full h-2">
            <div
              className="bg-blue-600 dark:bg-blue-500 h-2 rounded-full transition-all duration-300"
              style={{ width: `${((currentStep + 1) / onboardingSteps.length) * 100}%` }}
            />
          </div>
        </div>

        {/* Footer Buttons */}
        <div className="flex items-center justify-between gap-3">
          <button
            onClick={handleSkip}
            className="px-4 py-2 text-sm font-medium text-gray-600 dark:text-gray-400 hover:text-gray-800 dark:hover:text-gray-200 transition-colors min-h-[44px]"
          >
            {language === 'sv' ? 'Hoppa över' : 'Skip'}
          </button>
          <div className="flex gap-2">
            {currentStep > 0 && (
              <button
                onClick={handlePrevious}
                className="px-4 py-2 text-sm font-medium text-gray-700 dark:text-gray-300 bg-gray-200 dark:bg-gray-700 rounded-md hover:bg-gray-300 dark:hover:bg-gray-600 transition-colors min-h-[44px]"
              >
                {language === 'sv' ? 'Föregående' : 'Previous'}
              </button>
            )}
            <button
              onClick={handleNext}
              className="px-4 py-2 text-sm font-medium text-white bg-blue-600 dark:bg-blue-500 rounded-md hover:bg-blue-700 dark:hover:bg-blue-600 transition-colors min-h-[44px] flex items-center gap-2"
            >
              {currentStep === onboardingSteps.length - 1
                ? (language === 'sv' ? 'Klar' : 'Done')
                : (language === 'sv' ? 'Nästa' : 'Next')}
              {currentStep < onboardingSteps.length - 1 && (
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


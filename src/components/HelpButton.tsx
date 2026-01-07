import { useState } from 'react';
import { useTranslation } from 'react-i18next';

interface HelpButtonProps {
  onOpenHelp: () => void;
}

export default function HelpButton({ onOpenHelp }: HelpButtonProps) {
  const { t, i18n } = useTranslation();
  const language = i18n.language;

  return (
    <button
      onClick={onOpenHelp}
      className="px-3 sm:px-4 py-2.5 sm:py-2 text-sm font-medium rounded-md border border-gray-300 dark:border-gray-500 bg-white dark:bg-gray-700 text-gray-700 dark:text-gray-300 hover:bg-gray-50 dark:hover:bg-gray-600 transition-all duration-200 hover:shadow-md hover:scale-105 active:scale-95 flex items-center gap-2 min-h-[44px] touch-manipulation"
      title={language === 'sv' ? 'Hjälp och onboarding' : 'Help and onboarding'}
      aria-label={language === 'sv' ? 'Öppna hjälp' : 'Open help'}
    >
      <svg
        className="w-5 h-5"
        fill="none"
        stroke="currentColor"
        viewBox="0 0 24 24"
      >
        <path
          strokeLinecap="round"
          strokeLinejoin="round"
          strokeWidth={2}
          d="M8.228 9c.549-1.165 2.03-2 3.772-2 2.21 0 4 1.343 4 3 0 1.4-1.278 2.575-3.006 2.907-.542.104-.994.54-.994 1.093m0 3h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z"
        />
      </svg>
      <span className="hidden sm:inline">
        {language === 'sv' ? 'Hjälp' : 'Help'}
      </span>
    </button>
  );
}


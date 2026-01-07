import { useTranslation } from 'react-i18next';

export default function SkipLinks() {
  const { t } = useTranslation();

  return (
    <div className="sr-only focus-within:not-sr-only focus-within:absolute focus-within:z-50 focus-within:top-4 focus-within:left-4">
      <a
        href="#main-content"
        className="block px-4 py-2 bg-blue-600 text-white rounded-md shadow-lg focus:outline-none focus:ring-2 focus:ring-blue-500 focus:ring-offset-2"
      >
        {t('aria.skipToContent', 'Hoppa till huvudinnehåll')}
      </a>
      <a
        href="#navigation"
        className="block px-4 py-2 bg-blue-600 text-white rounded-md shadow-lg focus:outline-none focus:ring-2 focus:ring-blue-500 focus:ring-offset-2 mt-2"
      >
        {t('aria.skipToNavigation', 'Hoppa till navigation')}
      </a>
    </div>
  );
}


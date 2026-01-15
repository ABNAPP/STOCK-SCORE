import { Component, ReactNode } from 'react';
import i18n from '../i18n/config';
import { formatError, logError } from '../utils/errorHandler';

interface Props {
  children: ReactNode;
}

interface State {
  hasError: boolean;
  error: Error | null;
}

export class ErrorBoundary extends Component<Props, State> {
  constructor(props: Props) {
    super(props);
    this.state = { hasError: false, error: null };
  }

  static getDerivedStateFromError(error: Error): State {
    return { hasError: true, error };
  }

  componentDidCatch(error: Error, errorInfo: React.ErrorInfo) {
    logError(error, {
      component: 'ErrorBoundary',
      operation: 'render component',
      additionalInfo: {
        componentStack: errorInfo.componentStack,
        errorBoundary: true,
      },
    });
  }

  render() {
    if (this.state.hasError && this.state.error) {
      const errorMessage = this.state.error.message || i18n.t('errorBoundary.unknownError');
      
      // Check if it's a Firebase configuration error
      const isFirebaseError = errorMessage.includes('Firebase') || errorMessage.includes('environment variables');
      
      return (
        <div className="min-h-screen flex items-center justify-center bg-gray-100 dark:bg-gray-900 px-4">
          <div className="max-w-2xl w-full bg-white dark:bg-gray-800 rounded-lg shadow-lg p-8">
            <div className="flex items-center mb-4">
              <svg
                className="w-8 h-8 text-red-500 mr-3"
                fill="none"
                stroke="currentColor"
                viewBox="0 0 24 24"
              >
                <path
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  strokeWidth={2}
                  d="M12 8v4m0 4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z"
                />
              </svg>
              <h2 className="text-2xl font-bold text-gray-900 dark:text-gray-100">
                {i18n.t('errorBoundary.configurationError')}
              </h2>
            </div>
            
            <div className="bg-red-50 dark:bg-red-900/20 border border-red-200 dark:border-red-800 rounded-md p-4 mb-4">
              <p className="text-red-800 dark:text-red-200 font-semibold mb-2">
                {errorMessage}
              </p>
            </div>

            {isFirebaseError && (
              <div className="bg-blue-50 dark:bg-blue-900/20 border border-blue-200 dark:border-blue-800 rounded-md p-4 mb-4">
                <h3 className="text-blue-900 dark:text-blue-200 font-semibold mb-2">
                  {i18n.t('errorBoundary.firebaseError.howToFix')}
                </h3>
                <ol className="list-decimal list-inside text-blue-800 dark:text-blue-200 space-y-2 text-sm">
                  <li>{i18n.t('errorBoundary.firebaseError.step1')}</li>
                  <li>
                    {i18n.t('errorBoundary.firebaseError.step2')}
                    <ul className="list-disc list-inside ml-4 mt-1">
                      <li>{i18n.t('errorBoundary.firebaseError.varApiKey')}</li>
                      <li>{i18n.t('errorBoundary.firebaseError.varAuthDomain')}</li>
                      <li>{i18n.t('errorBoundary.firebaseError.varProjectId')}</li>
                      <li>{i18n.t('errorBoundary.firebaseError.varStorageBucket')}</li>
                      <li>{i18n.t('errorBoundary.firebaseError.varMessagingSenderId')}</li>
                      <li>{i18n.t('errorBoundary.firebaseError.varAppId')}</li>
                    </ul>
                  </li>
                  <li>{i18n.t('errorBoundary.firebaseError.step3')}</li>
                  <li>{i18n.t('errorBoundary.firebaseError.step4')}</li>
                </ol>
              </div>
            )}

            {errorMessage.includes('useRefresh must be used within a RefreshProvider') && (
              <div className="bg-blue-50 dark:bg-blue-900/20 border border-blue-200 dark:border-blue-800 rounded-md p-4 mb-4">
                <h3 className="text-blue-900 dark:text-blue-200 font-semibold mb-2">
                  {i18n.t('errorBoundary.providerError.howToFix')}
                </h3>
                <p className="text-blue-800 dark:text-blue-200 text-sm mb-2">
                  {i18n.t('errorBoundary.providerError.description')}
                </p>
                <ol className="list-decimal list-inside text-blue-800 dark:text-blue-200 space-y-2 text-sm">
                  <li>{i18n.t('errorBoundary.providerError.step1')}</li>
                  <li>
                    {i18n.t('errorBoundary.providerError.step2')}
                    <pre className="bg-blue-100 dark:bg-blue-900 p-2 rounded mt-2 text-xs overflow-x-auto">
{`<LoadingProgressProvider>
  <RefreshProvider>
    <AutoRefreshProvider>
      ...
    </AutoRefreshProvider>
  </RefreshProvider>
</LoadingProgressProvider>`}
                    </pre>
                  </li>
                  <li>{i18n.t('errorBoundary.providerError.step3')}</li>
                  <li>{i18n.t('errorBoundary.providerError.step4')}</li>
                </ol>
              </div>
            )}

            <div className="flex justify-end space-x-3 mt-6">
              <button
                onClick={() => window.location.reload()}
                className="px-4 py-2 bg-blue-600 text-white rounded-md hover:bg-blue-700 transition-colors"
              >
                {i18n.t('errorBoundary.reloadPage')}
              </button>
            </div>
          </div>
        </div>
      );
    }

    return this.props.children;
  }
}


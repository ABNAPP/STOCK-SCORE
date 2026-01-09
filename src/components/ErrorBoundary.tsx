import { Component, ReactNode } from 'react';

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
    console.error('ErrorBoundary caught an error:', error, errorInfo);
  }

  render() {
    if (this.state.hasError && this.state.error) {
      const errorMessage = this.state.error.message || 'An unknown error occurred';
      
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
                Configuration Error
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
                  How to fix:
                </h3>
                <ol className="list-decimal list-inside text-blue-800 dark:text-blue-200 space-y-2 text-sm">
                  <li>Go to <strong>Vercel Dashboard</strong> → Your Project → <strong>Settings</strong> → <strong>Environment Variables</strong></li>
                  <li>Add all 6 Firebase environment variables:
                    <ul className="list-disc list-inside ml-4 mt-1">
                      <li>VITE_FIREBASE_API_KEY</li>
                      <li>VITE_FIREBASE_AUTH_DOMAIN</li>
                      <li>VITE_FIREBASE_PROJECT_ID</li>
                      <li>VITE_FIREBASE_STORAGE_BUCKET</li>
                      <li>VITE_FIREBASE_MESSAGING_SENDER_ID</li>
                      <li>VITE_FIREBASE_APP_ID</li>
                    </ul>
                  </li>
                  <li>Make sure to select all environments: <strong>Production</strong>, <strong>Preview</strong>, and <strong>Development</strong></li>
                  <li>After adding variables, click <strong>"Redeploy"</strong> on your latest deployment</li>
                </ol>
              </div>
            )}

            {errorMessage.includes('useRefresh must be used within a RefreshProvider') && (
              <div className="bg-blue-50 dark:bg-blue-900/20 border border-blue-200 dark:border-blue-800 rounded-md p-4 mb-4">
                <h3 className="text-blue-900 dark:text-blue-200 font-semibold mb-2">
                  Provider Context Error - How to fix:
                </h3>
                <p className="text-blue-800 dark:text-blue-200 text-sm mb-2">
                  This error indicates that <code className="bg-blue-100 dark:bg-blue-900 px-1 rounded">RefreshProvider</code> is not properly wrapping <code className="bg-blue-100 dark:bg-blue-900 px-1 rounded">AutoRefreshProvider</code>.
                </p>
                <ol className="list-decimal list-inside text-blue-800 dark:text-blue-200 space-y-2 text-sm">
                  <li>Check <code className="bg-blue-100 dark:bg-blue-900 px-1 rounded">src/App.tsx</code></li>
                  <li>Verify the provider order is:
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
                  <li>Ensure <code className="bg-blue-100 dark:bg-blue-900 px-1 rounded">RefreshProvider</code> is a direct parent of <code className="bg-blue-100 dark:bg-blue-900 px-1 rounded">AutoRefreshProvider</code></li>
                  <li>Check that <code className="bg-blue-100 dark:bg-blue-900 px-1 rounded">RefreshProvider</code> is not conditionally rendered</li>
                </ol>
              </div>
            )}

            <div className="flex justify-end space-x-3 mt-6">
              <button
                onClick={() => window.location.reload()}
                className="px-4 py-2 bg-blue-600 text-white rounded-md hover:bg-blue-700 transition-colors"
              >
                Reload Page
              </button>
            </div>
          </div>
        </div>
      );
    }

    return this.props.children;
  }
}


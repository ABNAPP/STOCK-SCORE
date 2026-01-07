import { useState } from 'react';
import { useTranslation } from 'react-i18next';
import Login from './Login';
import Signup from './Signup';

export default function AuthContainer() {
  const [isLogin, setIsLogin] = useState(true);
  const { t } = useTranslation();

  return (
    <>
      {isLogin ? (
        <div>
          <Login />
          <div className="fixed bottom-4 left-1/2 transform -translate-x-1/2">
            <button
              onClick={() => setIsLogin(false)}
              className="text-sm text-gray-600 dark:text-gray-400 hover:text-gray-800 dark:hover:text-gray-200 underline"
            >
              {t('auth.createAccount')}
            </button>
          </div>
        </div>
      ) : (
        <Signup onSwitchToLogin={() => setIsLogin(true)} />
      )}
    </>
  );
}


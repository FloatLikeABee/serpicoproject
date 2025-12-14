import React, { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '../contexts/AuthContext';
import { useTheme } from '../contexts/ThemeContext';
import ShieldLogo from '../components/ShieldLogo';

const Login: React.FC = () => {
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const { login, loginWithGoogle, loginWithApple } = useAuth();
  const { theme } = useTheme();
  const navigate = useNavigate();

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    await login(email, password);
    navigate('/');
  };

  const handleQuickLogin = async () => {
    await login('demo@serpico.com', 'demo');
    navigate('/');
  };

  return (
    <div className={`min-h-screen flex items-center justify-center ${theme === 'dark' ? 'bg-gray-900' : 'bg-gray-50'}`}>
      <div className={`w-full max-w-md p-8 rounded-lg shadow-lg ${theme === 'dark' ? 'bg-gray-800' : 'bg-white'}`}>
        <div className="flex flex-col items-center mb-8">
          <ShieldLogo size={80} />
          <h1 className="text-3xl font-bold mt-4 text-serpico-red dark:text-serpico-red-light">Serpico</h1>
          <p className="text-gray-600 dark:text-gray-400 mt-2">AI Police Assistant</p>
        </div>

        <form onSubmit={handleSubmit} className="space-y-4">
          <div>
            <label className="block text-sm font-medium mb-2 dark:text-gray-300">
              Email
            </label>
            <input
              type="email"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              className="w-full px-4 py-2 border rounded-lg focus:ring-2 focus:ring-serpico-blue dark:bg-gray-700 dark:border-gray-600 dark:text-white"
              placeholder="demo@serpico.com"
            />
          </div>

          <div>
            <label className="block text-sm font-medium mb-2 dark:text-gray-300">
              Password
            </label>
            <input
              type="password"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              className="w-full px-4 py-2 border rounded-lg focus:ring-2 focus:ring-serpico-blue dark:bg-gray-700 dark:border-gray-600 dark:text-white"
              placeholder="••••••••"
            />
          </div>

          <button
            type="submit"
            className="w-full bg-serpico-blue text-white py-2 rounded-lg hover:bg-serpico-blue-dark transition-colors"
          >
            Login
          </button>
        </form>

        <div className="mt-6">
          <button
            onClick={handleQuickLogin}
            className="w-full bg-serpico-red text-white py-2 rounded-lg hover:bg-serpico-red-dark transition-colors mb-4"
          >
            Quick Login (Mock)
          </button>
        </div>

        <div className="mt-6 space-y-3">
          <button
            onClick={async () => {
              await loginWithGoogle();
              navigate('/');
            }}
            className="w-full flex items-center justify-center gap-2 border-2 py-2 rounded-lg hover:bg-gray-100 dark:hover:bg-gray-700 transition-colors dark:border-gray-600"
          >
            <svg className="w-5 h-5" viewBox="0 0 24 24">
              <path fill="#4285F4" d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92c-.26 1.37-1.04 2.53-2.21 3.31v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.09z"/>
              <path fill="#34A853" d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z"/>
              <path fill="#FBBC05" d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.07H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.93l2.85-2.22.81-.62z"/>
              <path fill="#EA4335" d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.07l3.66 2.84c.87-2.6 3.3-4.53 6.16-4.53z"/>
            </svg>
            Sign in with Google
          </button>

          <button
            onClick={async () => {
              await loginWithApple();
              navigate('/');
            }}
            className="w-full flex items-center justify-center gap-2 border-2 py-2 rounded-lg hover:bg-gray-100 dark:hover:bg-gray-700 transition-colors dark:border-gray-600"
          >
            <svg className="w-5 h-5" viewBox="0 0 24 24" fill="currentColor">
              <path d="M17.05 20.28c-.98.95-2.05.88-3.08.4-1.09-.5-2.08-.48-3.24 0-1.44.62-2.2.44-3.06-.4C2.79 15.25 3.51 7.59 9.05 7.31c1.35.07 2.29.74 3.08.8 1.18-.24 2.31-.93 3.57-.84 1.51.12 2.65.72 3.18 1.8-2.8 1.57-2.2 4.78.48 5.94-.6 1.5-1.29 2.99-2.2 4.2l-.01-.01zm-2.03-12.23c.58-.68.97-1.63.85-2.57-.82.04-1.82.56-2.41 1.24-.53.61-.99 1.6-.85 2.53.92.07 1.87-.49 2.41-1.2z"/>
            </svg>
            Sign in with Apple
          </button>
        </div>
      </div>
    </div>
  );
};

export default Login;


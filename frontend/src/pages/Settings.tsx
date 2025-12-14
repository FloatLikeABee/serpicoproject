import React, { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '../contexts/AuthContext';
import { useTheme } from '../contexts/ThemeContext';
import ShieldLogo from '../components/ShieldLogo';

const Settings: React.FC = () => {
  const { user, logout } = useAuth();
  const { theme, toggleTheme } = useTheme();
  const navigate = useNavigate();
  const [name, setName] = useState(user?.name || '');
  const [email, setEmail] = useState(user?.email || '');
  const [role, setRole] = useState<'police' | 'civilian'>(user?.role || 'police');
  const [rank, setRank] = useState(user?.rank || '');

  const handleSave = () => {
    // In a real app, this would update the user profile
    alert('Settings saved! (Mock)');
  };

  const handleLogout = () => {
    logout();
    navigate('/login');
  };

  return (
    <div className={`h-full flex flex-col ${theme === 'dark' ? 'bg-gray-900' : 'bg-gray-50'}`}>
      <div className={`p-4 border-b ${theme === 'dark' ? 'bg-gray-800 border-gray-700' : 'bg-white border-gray-200'}`}>
        <div className="flex items-center gap-3">
          <ShieldLogo size={40} />
          <div>
            <h1 className="text-2xl font-bold text-serpico-red dark:text-serpico-red-light">Settings</h1>
            <p className="text-gray-600 dark:text-gray-400 text-sm">Manage your profile and preferences</p>
          </div>
        </div>
      </div>

      <div className="flex-1 overflow-y-auto p-4 space-y-6">
        {/* User Profile */}
        <section>
          <h2 className="text-lg font-semibold mb-4 dark:text-white">User Profile</h2>
          <div className={`p-4 rounded-lg space-y-4 ${theme === 'dark' ? 'bg-gray-800' : 'bg-white'}`}>
            <div>
              <label className="block text-sm font-medium mb-2 dark:text-gray-300">Name</label>
              <input
                type="text"
                value={name}
                onChange={(e) => setName(e.target.value)}
                className={`w-full px-4 py-2 rounded-lg border ${
                  theme === 'dark'
                    ? 'bg-gray-700 border-gray-600 text-white'
                    : 'bg-white border-gray-300'
                } focus:outline-none focus:ring-2 focus:ring-serpico-blue`}
              />
            </div>

            <div>
              <label className="block text-sm font-medium mb-2 dark:text-gray-300">Email</label>
              <input
                type="email"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                className={`w-full px-4 py-2 rounded-lg border ${
                  theme === 'dark'
                    ? 'bg-gray-700 border-gray-600 text-white'
                    : 'bg-white border-gray-300'
                } focus:outline-none focus:ring-2 focus:ring-serpico-blue`}
              />
            </div>

            <div>
              <label className="block text-sm font-medium mb-2 dark:text-gray-300">Role</label>
              <select
                value={role}
                onChange={(e) => setRole(e.target.value as 'police' | 'civilian')}
                className={`w-full px-4 py-2 rounded-lg border ${
                  theme === 'dark'
                    ? 'bg-gray-700 border-gray-600 text-white'
                    : 'bg-white border-gray-300'
                } focus:outline-none focus:ring-2 focus:ring-serpico-blue`}
              >
                <option value="police">Police</option>
                <option value="civilian">Civilian</option>
              </select>
            </div>

            {role === 'police' && (
              <div>
                <label className="block text-sm font-medium mb-2 dark:text-gray-300">Rank</label>
                <input
                  type="text"
                  value={rank}
                  onChange={(e) => setRank(e.target.value)}
                  placeholder="Officer, Sergeant, etc."
                  className={`w-full px-4 py-2 rounded-lg border ${
                    theme === 'dark'
                      ? 'bg-gray-700 border-gray-600 text-white'
                      : 'bg-white border-gray-300'
                  } focus:outline-none focus:ring-2 focus:ring-serpico-blue`}
                />
              </div>
            )}

            <button
              onClick={handleSave}
              className="w-full bg-serpico-blue text-white py-2 rounded-lg hover:bg-serpico-blue-dark transition-colors"
            >
              Save Changes
            </button>
          </div>
        </section>

        {/* Appearance */}
        <section>
          <h2 className="text-lg font-semibold mb-4 dark:text-white">Appearance</h2>
          <div className={`p-4 rounded-lg ${theme === 'dark' ? 'bg-gray-800' : 'bg-white'}`}>
            <div className="flex items-center justify-between">
              <div>
                <p className="font-medium dark:text-white">Theme</p>
                <p className="text-sm text-gray-600 dark:text-gray-400">Switch between light and dark mode</p>
              </div>
              <button
                onClick={toggleTheme}
                className={`px-4 py-2 rounded-lg ${
                  theme === 'dark'
                    ? 'bg-yellow-500 text-white'
                    : 'bg-gray-800 text-white'
                }`}
              >
                {theme === 'dark' ? '🌙 Dark' : '☀️ Light'}
              </button>
            </div>
          </div>
        </section>

        {/* Account Actions */}
        <section>
          <h2 className="text-lg font-semibold mb-4 dark:text-white">Account</h2>
          <div className={`p-4 rounded-lg space-y-3 ${theme === 'dark' ? 'bg-gray-800' : 'bg-white'}`}>
            <button
              onClick={handleLogout}
              className="w-full bg-serpico-red text-white py-2 rounded-lg hover:bg-serpico-red-dark transition-colors"
            >
              Logout
            </button>
          </div>
        </section>
      </div>
    </div>
  );
};

export default Settings;


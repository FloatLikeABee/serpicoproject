import React, { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '../contexts/AuthContext';
import ShieldLogo from '../components/ShieldLogo';

const Login: React.FC = () => {
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const { login, loginWithGoogle, loginWithApple } = useAuth();
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
    <div className="min-h-screen synth-grid-bg synth-scanlines flex items-center justify-center p-4 relative overflow-hidden">
      {/* Ambient glow orbs */}
      <div className="absolute top-1/4 left-1/4 w-64 h-64 rounded-full bg-neon-purple/20 blur-3xl animate-glow-shift pointer-events-none" />
      <div className="absolute bottom-1/4 right-1/4 w-48 h-48 rounded-full bg-neon-green/10 blur-3xl pointer-events-none" />

      <div className="w-full max-w-md relative z-10">
        <div className="game-panel p-6 sm:p-8 animate-glow-shift">
          <div className="flex flex-col items-center mb-6 sm:mb-8">
            <ShieldLogo size={72} className="sm:w-24 sm:h-24 mb-2" />
            <h1 className="font-display text-3xl sm:text-4xl font-bold neon-text-magenta tracking-widest">SERPICO</h1>
            <p className="text-sm sm:text-base text-synth-muted mt-2 font-mono tracking-wider uppercase">
              /// Neon Ops Terminal v0.1
            </p>
            <div className="mt-3 flex gap-2 text-xs font-mono text-neon-green/80">
              <span className="px-2 py-0.5 border border-neon-green/30 rounded">SYS ONLINE</span>
              <span className="px-2 py-0.5 border border-neon-cyan/30 rounded text-neon-cyan/80">SECURE LINK</span>
            </div>
          </div>

          <form onSubmit={handleSubmit} className="space-y-4">
            <div>
              <label className="block text-xs font-display font-semibold mb-2 text-neon-cyan/90 tracking-widest uppercase">
                Agent ID
              </label>
              <input
                type="email"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                className="synth-input"
                placeholder="demo@serpico.com"
              />
            </div>

            <div>
              <label className="block text-xs font-display font-semibold mb-2 text-neon-cyan/90 tracking-widest uppercase">
                Access Code
              </label>
              <input
                type="password"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                className="synth-input"
                placeholder="••••••••"
              />
            </div>

            <button type="submit" className="w-full btn-neon-primary py-3.5 rounded-lg">
              Enter Game World
            </button>
          </form>

          <div className="mt-4 sm:mt-6">
            <button
              onClick={handleQuickLogin}
              className="w-full btn-neon-danger py-3.5 rounded-lg"
            >
              Quick Deploy (Mock)
            </button>
          </div>

          <div className="mt-4 sm:mt-6 space-y-3">
            <button
              onClick={async () => {
                await loginWithGoogle();
                navigate('/');
              }}
              className="w-full flex items-center justify-center gap-2 border border-neon-purple/40 py-3 rounded-lg hover:border-neon-cyan/50 hover:shadow-neon-cyan transition-all touch-manipulation font-medium text-synth-text bg-synth-deep/50"
            >
              <svg className="w-5 h-5" viewBox="0 0 24 24">
                <path fill="#4285F4" d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92c-.26 1.37-1.04 2.53-2.21 3.31v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.09z"/>
                <path fill="#34A853" d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z"/>
                <path fill="#FBBC05" d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.07H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.93l2.85-2.22.81-.62z"/>
                <path fill="#EA4335" d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.07l3.66 2.84c.87-2.6 3.3-4.53 6.16-4.53z"/>
              </svg>
              Google Uplink
            </button>

            <button
              onClick={async () => {
                await loginWithApple();
                navigate('/');
              }}
              className="w-full flex items-center justify-center gap-2 border border-neon-purple/40 py-3 rounded-lg hover:border-neon-cyan/50 transition-all touch-manipulation font-medium text-synth-text bg-synth-deep/50"
            >
              <svg className="w-5 h-5" viewBox="0 0 24 24" fill="currentColor">
                <path d="M17.05 20.28c-.98.95-2.05.88-3.08.4-1.09-.5-2.08-.48-3.24 0-1.44.62-2.2.44-3.06-.4C2.79 15.25 3.51 7.59 9.05 7.31c1.35.07 2.29.74 3.08.8 1.18-.24 2.31-.93 3.57-.84 1.51.12 2.65.72 3.18 1.8-2.8 1.57-2.2 4.78.48 5.94-.6 1.5-1.29 2.99-2.2 4.2l-.01-.01zm-2.03-12.23c.58-.68.97-1.63.85-2.57-.82.04-1.82.56-2.41 1.24-.53.61-.99 1.6-.85 2.53.92.07 1.87-.49 2.41-1.2z"/>
              </svg>
              Apple Uplink
            </button>
          </div>
        </div>

        <p className="text-center text-xs font-mono text-synth-muted/60 mt-4 tracking-wider">
          © 198X SERPICO SYNTH DIVISION — ALL FREQUENCIES MONITORED
        </p>
      </div>
    </div>
  );
};

export default Login;

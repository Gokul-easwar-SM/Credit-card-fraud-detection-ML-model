import React, { useState } from 'react';
import { X, Lock, User as UserIcon, Shield } from 'lucide-react';
import { api } from '../api/client';
import type { User } from '../types';

interface LoginModalProps {
  isOpen: boolean;
  onClose: () => void;
  onLoginSuccess: (user: User) => void;
}

export const LoginModal: React.FC<LoginModalProps> = ({ isOpen, onClose, onLoginSuccess }) => {
  const [username, setUsername] = useState('analyst');
  const [password, setPassword] = useState('analyst123');
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);

  if (!isOpen) return null;

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);
    setLoading(true);

    try {
      const res = await api.login(username, password);
      onLoginSuccess(res.user);
      onClose();
    } catch (err: unknown) {
      if (err instanceof Error) {
        setError(err.message);
      } else {
        setError('Login failed. Please verify credentials.');
      }
    } finally {
      setLoading(false);
    }
  };

  const setPreset = (u: string, p: string) => {
    setUsername(u);
    setPassword(p);
    setError(null);
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-deep-aubergine-darker/80 backdrop-blur-sm">
      <div className="bg-deep-aubergine-card border border-deep-aubergine-border rounded-xl w-full max-w-md p-6 shadow-elevated relative">
        <button
          onClick={onClose}
          className="absolute top-4 right-4 text-slate-grey hover:text-ice-silver p-1 rounded transition-colors"
        >
          <X className="w-5 h-5" />
        </button>

        <div className="flex items-center gap-3 mb-5">
          <div className="w-9 h-9 rounded-lg bg-deep-aubergine-surface text-marigold border border-deep-aubergine-border flex items-center justify-center">
            <Lock className="w-4 h-4" />
          </div>
          <div>
            <h2 className="text-base font-bold text-ice-silver">Bank Operations Authentication</h2>
            <p className="text-xs text-muted-lavender">JWT Role-Based Access Control</p>
          </div>
        </div>

        {error && (
          <div className="mb-4 p-3 rounded bg-red-950/60 border border-red-800/60 text-red-300 text-xs">
            {error}
          </div>
        )}

        <form onSubmit={handleSubmit} className="space-y-4">
          <div>
            <label className="block text-xs font-medium text-soft-silver mb-1">Username</label>
            <div className="relative">
              <UserIcon className="w-4 h-4 absolute left-3 top-2.5 text-slate-grey" />
              <input
                type="text"
                value={username}
                onChange={(e) => setUsername(e.target.value)}
                required
                className="w-full bg-deep-aubergine-dark border border-deep-aubergine-border rounded-lg pl-9 pr-3 py-2 text-xs text-ice-silver placeholder-slate-grey focus:outline-none focus:border-marigold transition-colors"
                placeholder="analyst"
              />
            </div>
          </div>

          <div>
            <label className="block text-xs font-medium text-soft-silver mb-1">Password</label>
            <div className="relative">
              <Lock className="w-4 h-4 absolute left-3 top-2.5 text-slate-grey" />
              <input
                type="password"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                required
                className="w-full bg-deep-aubergine-dark border border-deep-aubergine-border rounded-lg pl-9 pr-3 py-2 text-xs text-ice-silver placeholder-slate-grey focus:outline-none focus:border-marigold transition-colors"
                placeholder="••••••••"
              />
            </div>
          </div>

          {/* Seeded Credentials */}
          <div className="pt-1">
            <p className="text-[11px] text-muted-lavender mb-1.5 font-medium">Internal Demo Credentials:</p>
            <div className="grid grid-cols-2 gap-2">
              <button
                type="button"
                onClick={() => setPreset('analyst', 'analyst123')}
                className="text-left px-2.5 py-1.5 rounded bg-deep-aubergine-surface hover:bg-deep-aubergine-border border border-deep-aubergine-border text-[11px] text-ice-silver transition-colors"
              >
                <div className="font-semibold text-marigold">Fraud Analyst</div>
                <div className="text-[10px] text-slate-grey">analyst / analyst123</div>
              </button>
              <button
                type="button"
                onClick={() => setPreset('admin', 'admin123')}
                className="text-left px-2.5 py-1.5 rounded bg-deep-aubergine-surface hover:bg-deep-aubergine-border border border-deep-aubergine-border text-[11px] text-ice-silver transition-colors"
              >
                <div className="font-semibold text-ice-silver">System Admin</div>
                <div className="text-[10px] text-slate-grey">admin / admin123</div>
              </button>
            </div>
          </div>

          <button
            type="submit"
            disabled={loading}
            className="w-full mt-2 py-2.5 px-4 rounded-lg bg-marigold hover:bg-marigold-light text-deep-aubergine-dark font-semibold text-xs transition-all shadow-subtle flex items-center justify-center gap-2"
          >
            <Shield className="w-4 h-4" />
            <span>{loading ? 'Authenticating...' : 'Sign In to Fraud Operations'}</span>
          </button>
        </form>
      </div>
    </div>
  );
};

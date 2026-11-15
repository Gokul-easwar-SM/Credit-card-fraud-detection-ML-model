import React from 'react';
import {
  PieChart,
  Radio,
  Cpu,
  ShieldCheck,
  UserCheck,
  CreditCard,
  BarChart3,
  Sliders,
  LogIn,
  LogOut,
  Building2,
} from 'lucide-react';
import type { User } from '../types';

export type NavigationTab =
  | 'executive'
  | 'monitoring'
  | 'risk_analysis'
  | 'prevention'
  | 'investigations'
  | 'cards'
  | 'model_intelligence'
  | 'simulation_lab';

interface NavbarProps {
  activeTab: NavigationTab;
  setActiveTab: (tab: NavigationTab) => void;
  user: User | null;
  onOpenLogin: () => void;
  onLogout: () => void;
}

export const Navbar: React.FC<NavbarProps> = ({
  activeTab,
  setActiveTab,
  user,
  onOpenLogin,
  onLogout,
}) => {
  const tabs = [
    { id: 'executive' as NavigationTab, label: 'Executive Overview', icon: PieChart },
    { id: 'monitoring' as NavigationTab, label: 'Live Monitoring', icon: Radio },
    { id: 'risk_analysis' as NavigationTab, label: 'Risk Analysis', icon: Cpu },
    { id: 'prevention' as NavigationTab, label: 'Prevention Center', icon: ShieldCheck },
    { id: 'investigations' as NavigationTab, label: 'Investigation Center', icon: UserCheck },
    { id: 'cards' as NavigationTab, label: 'Card Management', icon: CreditCard },
    { id: 'model_intelligence' as NavigationTab, label: 'Model Intelligence', icon: BarChart3 },
    { id: 'simulation_lab' as NavigationTab, label: 'Simulation Lab', icon: Sliders },
  ];

  return (
    <header className="sticky top-0 z-40 w-full border-b border-deep-aubergine-border bg-deep-aubergine-darker/95 backdrop-blur-md">
      {/* Top Banner: Bank Brand & Session Info */}
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 h-14 flex items-center justify-between border-b border-deep-aubergine-border/60">
        <div className="flex items-center gap-3">
          <div className="w-8 h-8 rounded-lg bg-deep-aubergine-surface border border-deep-aubergine-border flex items-center justify-center text-marigold shadow-subtle">
            <Building2 className="w-4 h-4" />
          </div>
          <div>
            <div className="flex items-center gap-2">
              <span className="font-bold text-sm tracking-tight text-ice-silver">
                FRAUDSENTINEL
              </span>
              <span className="text-[10px] font-mono uppercase px-1.5 py-0.5 rounded bg-deep-aubergine-surface text-marigold border border-deep-aubergine-border font-semibold">
                Bank Risk System
              </span>
            </div>
            <p className="text-[10px] text-muted-lavender hidden sm:block">
              Credit Card Fraud Prevention & Risk Operations
            </p>
          </div>
        </div>

        {/* User Auth Info */}
        <div className="flex items-center gap-3">
          {user ? (
            <div className="flex items-center gap-3">
              <div className="text-right">
                <div className="text-xs font-semibold text-ice-silver">{user.username}</div>
                <div className="text-[10px] font-mono text-marigold uppercase tracking-wider">{user.role}</div>
              </div>
              <button
                onClick={onLogout}
                title="Sign out"
                className="p-1.5 rounded-lg text-slate-grey hover:text-ice-silver hover:bg-deep-aubergine-surface border border-deep-aubergine-border transition-colors"
              >
                <LogOut className="w-3.5 h-3.5" />
              </button>
            </div>
          ) : (
            <button
              onClick={onOpenLogin}
              className="flex items-center gap-2 px-3 py-1.5 rounded-lg bg-deep-aubergine-surface hover:bg-deep-aubergine-card text-marigold border border-deep-aubergine-border text-xs font-medium transition-all"
            >
              <LogIn className="w-3.5 h-3.5" />
              <span>Analyst Login</span>
            </button>
          )}
        </div>
      </div>

      {/* Primary Navigation Tabs */}
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
        <nav className="flex items-center gap-1 overflow-x-auto py-2 scrollbar-none text-xs">
          {tabs.map((tab) => {
            const Icon = tab.icon;
            const isActive = activeTab === tab.id;
            return (
              <button
                key={tab.id}
                onClick={() => setActiveTab(tab.id)}
                className={`flex items-center gap-2 px-3 py-1.5 rounded-lg font-medium whitespace-nowrap transition-all ${
                  isActive
                    ? 'bg-deep-aubergine-surface text-marigold border border-deep-aubergine-border font-semibold shadow-subtle'
                    : 'text-soft-silver hover:text-ice-silver hover:bg-deep-aubergine-surface/50'
                }`}
              >
                <Icon className={`w-3.5 h-3.5 ${isActive ? 'text-marigold' : 'text-muted-lavender'}`} />
                <span>{tab.label}</span>
              </button>
            );
          })}
        </nav>
      </div>
    </header>
  );
};

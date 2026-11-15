import React, { useState, useEffect } from 'react';
import { Navbar, type NavigationTab } from './components/Navbar';
import { LoginModal } from './components/LoginModal';
import { ExecutiveOverview } from './pages/ExecutiveOverview';
import { LiveMonitoring } from './pages/LiveMonitoring';
import { RiskAnalysis } from './pages/RiskAnalysis';
import { PreventionCenter } from './pages/PreventionCenter';
import { InvestigationCenter } from './pages/InvestigationCenter';
import { CardManagement } from './pages/CardManagement';
import { ModelIntelligence } from './pages/ModelIntelligence';
import { SimulationLab } from './pages/SimulationLab';
import { api } from './api/client';
import type { User } from './types';

export const App: React.FC = () => {
  const [activeTab, setActiveTab] = useState<NavigationTab>('executive');
  const [user, setUser] = useState<User | null>(null);
  const [isLoginOpen, setIsLoginOpen] = useState(false);

  // Cross-page navigation context
  const [selectedRiskTxnId, setSelectedRiskTxnId] = useState<number | null>(null);
  const [selectedPreventionTxnId, setSelectedPreventionTxnId] = useState<number | null>(null);

  useEffect(() => {
    // If an auth token exists, verify current user profile
    if (api.getToken()) {
      api
        .getMe()
        .then((u) => setUser(u))
        .catch(() => {
          api.logout();
          setUser(null);
        });
    }
  }, []);

  const handleLogout = () => {
    api.logout();
    setUser(null);
  };

  const handleNavigateToRisk = (txnId?: number) => {
    if (txnId) {
      setSelectedRiskTxnId(txnId);
    }
    setActiveTab('risk_analysis');
  };

  const handleNavigateToPrevention = (txnId: number) => {
    setSelectedPreventionTxnId(txnId);
    setActiveTab('prevention');
  };

  const handleNavigateToInvestigations = () => {
    setActiveTab('investigations');
  };

  return (
    <div className="min-h-screen bg-deep-aubergine-darker text-ice-silver flex flex-col font-sans selection:bg-marigold/20 selection:text-marigold">
      {/* Top Bank Navigation Bar */}
      <Navbar
        activeTab={activeTab}
        setActiveTab={setActiveTab}
        user={user}
        onOpenLogin={() => setIsLoginOpen(true)}
        onLogout={handleLogout}
      />

      {/* Main Bank Operations Dashboard */}
      <main className="flex-1 max-w-7xl w-full mx-auto px-4 sm:px-6 lg:px-8 py-6">
        {activeTab === 'executive' && (
          <ExecutiveOverview
            onNavigateToRisk={handleNavigateToRisk}
            onNavigateToInvestigations={handleNavigateToInvestigations}
          />
        )}
        {activeTab === 'monitoring' && (
          <LiveMonitoring onSelectTransactionForRisk={handleNavigateToRisk} />
        )}
        {activeTab === 'risk_analysis' && (
          <RiskAnalysis
            initialTxnId={selectedRiskTxnId}
            onNavigateToPrevention={handleNavigateToPrevention}
          />
        )}
        {activeTab === 'prevention' && (
          <PreventionCenter initialTxnId={selectedPreventionTxnId} />
        )}
        {activeTab === 'investigations' && <InvestigationCenter />}
        {activeTab === 'cards' && <CardManagement />}
        {activeTab === 'model_intelligence' && <ModelIntelligence />}
        {activeTab === 'simulation_lab' && (
          <SimulationLab onNavigateToRisk={handleNavigateToRisk} />
        )}
      </main>

      {/* Enterprise Bank Footer */}
      <footer className="border-t border-deep-aubergine-border bg-deep-aubergine-surface/80 py-4 text-xs text-muted-lavender">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 flex flex-col sm:flex-row items-center justify-between gap-2">
          <div className="flex items-center gap-2">
            <span className="font-bold text-ice-silver">FRAUDSENTINEL</span>
            <span className="text-slate-grey">|</span>
            <span>Credit Card Fraud Prevention & Risk Operations System</span>
          </div>
          <div className="text-[11px] text-slate-grey font-mono">
            Academic Prototype · Zero Real Card Data · Final Year B.Tech Project
          </div>
        </div>
      </footer>

      {/* Analyst Login Modal */}
      <LoginModal
        isOpen={isLoginOpen}
        onClose={() => setIsLoginOpen(false)}
        onLoginSuccess={(u) => {
          setUser(u);
          setIsLoginOpen(false);
        }}
      />
    </div>
  );
};

export default App;

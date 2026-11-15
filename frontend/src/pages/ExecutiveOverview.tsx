import React, { useState, useEffect } from 'react';
import {
  ShieldAlert,
  ShieldCheck,
  Clock,
  Ban,
  Activity,
  CreditCard,
  TrendingUp,
  AlertTriangle,
  RefreshCw,
  ArrowUpRight,
  Eye,
} from 'lucide-react';
import { api } from '../api/client';
import { RiskBadge } from '../components/RiskBadge';
import type { ExecutiveOverviewData } from '../types';

interface ExecutiveOverviewProps {
  onNavigateToRisk: (txnId?: number) => void;
  onNavigateToInvestigations: () => void;
}

export const ExecutiveOverview: React.FC<ExecutiveOverviewProps> = ({
  onNavigateToRisk,
  onNavigateToInvestigations,
}) => {
  const [data, setData] = useState<ExecutiveOverviewData | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const loadMetrics = async () => {
    setLoading(true);
    setError(null);
    try {
      const res = await api.getExecutiveOverview();
      setData(res);
    } catch (err: unknown) {
      if (err instanceof Error) {
        setError(err.message);
      } else {
        setError('Failed to load executive overview data');
      }
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadMetrics();
    const interval = setInterval(loadMetrics, 10000);
    return () => clearInterval(interval);
  }, []);

  const kpi = data?.kpi;
  const dist = data?.distribution;
  const recent = data?.recent_suspicious || [];

  return (
    <div className="space-y-6">
      {/* Top Header */}
      <div className="flex flex-col md:flex-row md:items-center md:justify-between gap-4 pb-3 border-b border-deep-aubergine-border">
        <div>
          <div className="flex items-center gap-2.5">
            <h1 className="text-xl sm:text-2xl font-bold text-ice-silver tracking-tight">
              Executive Fraud Risk & Prevention Overview
            </h1>
            <span className="text-[10px] font-mono px-2 py-0.5 rounded bg-deep-aubergine-surface text-marigold border border-deep-aubergine-border font-medium">
              Real-time Portfolio
            </span>
          </div>
          <p className="text-xs text-soft-silver mt-1">
            Institutional summary of credit card transaction throughput, automated ML defense, and financial exposure
          </p>
        </div>

        <button
          onClick={loadMetrics}
          disabled={loading}
          className="self-start md:self-auto flex items-center gap-2 px-3 py-1.5 rounded-lg bg-deep-aubergine-surface hover:bg-deep-aubergine-card text-ice-silver text-xs border border-deep-aubergine-border transition-colors"
        >
          <RefreshCw className={`w-3.5 h-3.5 text-marigold ${loading ? 'animate-spin' : ''}`} />
          <span>Refresh Metrics</span>
        </button>
      </div>

      {error && (
        <div className="p-3.5 rounded-lg bg-red-950/60 border border-red-800/60 text-red-300 text-xs flex items-center gap-2">
          <AlertTriangle className="w-4 h-4 shrink-0" />
          <span>{error}</span>
        </div>
      )}

      {/* KPI Cards Grid */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
        {/* Total Transactions */}
        <div className="bg-deep-aubergine-card border border-deep-aubergine-border rounded-xl p-4 shadow-subtle">
          <div className="flex items-center justify-between text-muted-lavender text-xs mb-2">
            <span className="font-medium">Total Ingested</span>
            <Activity className="w-4 h-4 text-slate-grey" />
          </div>
          <div className="text-2xl font-bold text-ice-silver font-mono">
            {kpi?.total_transactions || 0}
          </div>
          <div className="text-[11px] text-soft-silver mt-1 font-mono">
            Vol: ₹{(kpi?.total_volume_inr || 0).toLocaleString('en-IN', { maximumFractionDigits: 0 })}
          </div>
        </div>

        {/* Fraud Detected */}
        <div className="bg-deep-aubergine-card border border-deep-aubergine-border rounded-xl p-4 shadow-subtle">
          <div className="flex items-center justify-between text-muted-lavender text-xs mb-2">
            <span className="font-medium">Fraud Detected</span>
            <ShieldAlert className="w-4 h-4 text-red-400" />
          </div>
          <div className="text-2xl font-bold text-red-400 font-mono">
            {kpi?.fraud_detected_count || 0}
          </div>
          <div className="text-[11px] text-red-300/80 mt-1 font-mono">
            At Risk: ₹{(kpi?.suspicious_value_at_risk_inr || 0).toLocaleString('en-IN', { maximumFractionDigits: 0 })}
          </div>
        </div>

        {/* Transactions Blocked */}
        <div className="bg-deep-aubergine-card border border-deep-aubergine-border rounded-xl p-4 shadow-subtle">
          <div className="flex items-center justify-between text-muted-lavender text-xs mb-2">
            <span className="font-medium">Auto-Blocked</span>
            <Ban className="w-4 h-4 text-red-400" />
          </div>
          <div className="text-2xl font-bold text-ice-silver font-mono">
            {kpi?.blocked_count || 0}
          </div>
          <div className="text-[11px] text-soft-silver mt-1 font-mono">
            Prevented: ₹{(kpi?.blocked_volume_inr || 0).toLocaleString('en-IN', { maximumFractionDigits: 0 })}
          </div>
        </div>

        {/* Transactions on Hold */}
        <div className="bg-deep-aubergine-card border border-deep-aubergine-border rounded-xl p-4 shadow-subtle">
          <div className="flex items-center justify-between text-muted-lavender text-xs mb-2">
            <span className="font-medium">Held / Step-Up</span>
            <Clock className="w-4 h-4 text-amber-400" />
          </div>
          <div className="text-2xl font-bold text-amber-400 font-mono">
            {kpi?.held_count || 0}
          </div>
          <div className="text-[11px] text-amber-300/80 mt-1 font-mono">
            Held: ₹{(kpi?.held_volume_inr || 0).toLocaleString('en-IN', { maximumFractionDigits: 0 })}
          </div>
        </div>
      </div>

      {/* Secondary Metrics Row */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
        <div className="bg-deep-aubergine-card border border-deep-aubergine-border rounded-xl p-4 flex items-center justify-between">
          <div>
            <div className="text-xs text-muted-lavender font-medium">Fraud Prevention Rate</div>
            <div className="text-xl font-bold text-ice-silver font-mono mt-0.5">
              {kpi?.prevention_rate_pct ? `${kpi.prevention_rate_pct.toFixed(1)}%` : '100.0%'}
            </div>
            <div className="text-[11px] text-emerald-400 mt-0.5">Automated policy intercept ratio</div>
          </div>
          <div className="p-3 rounded-lg bg-deep-aubergine-surface text-emerald-400">
            <ShieldCheck className="w-5 h-5" />
          </div>
        </div>

        <div className="bg-deep-aubergine-card border border-deep-aubergine-border rounded-xl p-4 flex items-center justify-between">
          <div>
            <div className="text-xs text-muted-lavender font-medium">Pending Investigations</div>
            <div className="text-xl font-bold text-marigold font-mono mt-0.5">
              {kpi?.pending_investigations || 0}
            </div>
            <div className="text-[11px] text-soft-silver mt-0.5">Assigned to fraud operations</div>
          </div>
          <button
            onClick={onNavigateToInvestigations}
            className="p-3 rounded-lg bg-deep-aubergine-surface hover:bg-deep-aubergine-border text-marigold transition-colors"
          >
            <ArrowUpRight className="w-5 h-5" />
          </button>
        </div>

        <div className="bg-deep-aubergine-card border border-deep-aubergine-border rounded-xl p-4 flex items-center justify-between">
          <div>
            <div className="text-xs text-muted-lavender font-medium">Genuine Throughput</div>
            <div className="text-xl font-bold text-ice-silver font-mono mt-0.5">
              {kpi?.genuine_count || 0}
            </div>
            <div className="text-[11px] text-soft-silver mt-0.5">
              Vol: ₹{(kpi?.genuine_volume_inr || 0).toLocaleString('en-IN', { maximumFractionDigits: 0 })}
            </div>
          </div>
          <div className="p-3 rounded-lg bg-deep-aubergine-surface text-ice-silver">
            <CreditCard className="w-5 h-5" />
          </div>
        </div>
      </div>

      {/* Analytical Charts & Channel Breakdown */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* Channel Distribution & Fraud Rates */}
        <div className="bg-deep-aubergine-card border border-deep-aubergine-border rounded-xl p-5 shadow-subtle">
          <div className="flex items-center justify-between mb-4">
            <div className="flex items-center gap-2">
              <TrendingUp className="w-4 h-4 text-marigold" />
              <h2 className="text-xs font-bold text-ice-silver uppercase tracking-wider">
                Payment Channel Volume & Risk Distribution
              </h2>
            </div>
            <span className="text-[11px] text-slate-grey font-mono">POS / Online / ATM</span>
          </div>

          <div className="space-y-4">
            {['pos', 'online', 'atm'].map((ch) => {
              const count = dist?.channels?.[ch] || 0;
              const fraud = dist?.channel_fraud?.[ch] || 0;
              const total = kpi?.total_transactions || 1;
              const pct = Math.min(100, Math.round((count / total) * 100));

              return (
                <div key={ch} className="bg-deep-aubergine-surface/70 border border-deep-aubergine-border/60 p-3 rounded-lg">
                  <div className="flex items-center justify-between text-xs mb-1.5">
                    <span className="uppercase font-mono font-semibold text-ice-silver">{ch} Payments</span>
                    <span className="text-soft-silver font-mono text-[11px]">
                      {count} txns ({pct}%) · <span className="text-red-400 font-semibold">{fraud} flagged</span>
                    </span>
                  </div>
                  <div className="w-full h-2 bg-deep-aubergine-dark rounded-full overflow-hidden">
                    <div
                      className="h-full bg-marigold rounded-full transition-all duration-500"
                      style={{ width: `${pct}%` }}
                    />
                  </div>
                </div>
              );
            })}
          </div>
        </div>

        {/* Risk Band Categorization */}
        <div className="bg-deep-aubergine-card border border-deep-aubergine-border rounded-xl p-5 shadow-subtle">
          <div className="flex items-center justify-between mb-4">
            <div className="flex items-center gap-2">
              <ShieldAlert className="w-4 h-4 text-red-400" />
              <h2 className="text-xs font-bold text-ice-silver uppercase tracking-wider">
                ML Pipeline Risk Band Categorization
              </h2>
            </div>
            <span className="text-[11px] text-slate-grey font-mono">Calibrated Sigmoid</span>
          </div>

          <div className="grid grid-cols-3 gap-3 mb-4 text-center">
            <div className="bg-deep-aubergine-surface/70 border border-emerald-900/40 p-3 rounded-lg">
              <div className="text-[11px] text-emerald-400 font-medium">Low Risk (Approved)</div>
              <div className="text-xl font-bold text-emerald-300 font-mono mt-1">
                {dist?.risk_bands?.low || 0}
              </div>
              <div className="text-[10px] text-slate-grey mt-0.5">Score &lt; 15%</div>
            </div>

            <div className="bg-deep-aubergine-surface/70 border border-amber-900/40 p-3 rounded-lg">
              <div className="text-[11px] text-amber-400 font-medium">Medium Risk (Step-Up)</div>
              <div className="text-xl font-bold text-amber-300 font-mono mt-1">
                {dist?.risk_bands?.medium || 0}
              </div>
              <div className="text-[10px] text-slate-grey mt-0.5">Score 15% – 65%</div>
            </div>

            <div className="bg-deep-aubergine-surface/70 border border-red-900/40 p-3 rounded-lg">
              <div className="text-[11px] text-red-400 font-medium">High Risk (Blocked)</div>
              <div className="text-xl font-bold text-red-300 font-mono mt-1">
                {dist?.risk_bands?.high || 0}
              </div>
              <div className="text-[10px] text-slate-grey mt-0.5">Score &ge; 65%</div>
            </div>
          </div>

          <div className="p-3 bg-deep-aubergine-surface/40 rounded-lg border border-deep-aubergine-border/60 text-[11px] text-muted-lavender leading-relaxed">
            Policy Rule: High-risk transactions are instantly declined and routed to the investigation workspace with TreeSHAP local attributions. Medium-risk triggers step-up verification alerts.
          </div>
        </div>
      </div>

      {/* Recent Suspicious Activities Table */}
      <div className="bg-deep-aubergine-card border border-deep-aubergine-border rounded-xl shadow-subtle overflow-hidden">
        <div className="p-4 border-b border-deep-aubergine-border flex items-center justify-between">
          <div className="flex items-center gap-2">
            <ShieldAlert className="w-4 h-4 text-marigold" />
            <h3 className="text-xs font-bold text-ice-silver uppercase tracking-wider">
              Recent High & Medium Suspicious Activity Log
            </h3>
          </div>
          <span className="text-[11px] text-soft-silver">Direct Live Feed</span>
        </div>

        <div className="overflow-x-auto">
          <table className="w-full text-left text-xs">
            <thead className="bg-deep-aubergine-surface/60 text-slate-grey uppercase text-[10px] tracking-wider border-b border-deep-aubergine-border">
              <tr>
                <th className="px-4 py-2.5">Transaction ID</th>
                <th className="px-4 py-2.5">Time</th>
                <th className="px-4 py-2.5">Channel</th>
                <th className="px-4 py-2.5">Amount</th>
                <th className="px-4 py-2.5">Risk Score</th>
                <th className="px-4 py-2.5">Risk Band</th>
                <th className="px-4 py-2.5">Resolution Status</th>
                <th className="px-4 py-2.5 text-right">Inspect</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-deep-aubergine-border/50 text-xs">
              {recent.length === 0 ? (
                <tr>
                  <td colSpan={8} className="py-8 text-center text-slate-grey">
                    No recent suspicious activity recorded. Run simulator or inject attacks to view live detections.
                  </td>
                </tr>
              ) : (
                recent.map((item) => (
                  <tr
                    key={item.id}
                    onClick={() => onNavigateToRisk(item.id)}
                    className="hover:bg-deep-aubergine-surface/40 transition-colors cursor-pointer"
                  >
                    <td className="px-4 py-3 font-mono text-ice-silver font-medium">{item.external_txn_id}</td>
                    <td className="px-4 py-3 text-soft-silver text-[11px] font-mono">
                      {new Date(item.occurred_at).toLocaleTimeString('en-IN', { hour12: false })}
                    </td>
                    <td className="px-4 py-3 uppercase text-[11px] text-muted-lavender">{item.channel}</td>
                    <td className="px-4 py-3 font-mono font-bold text-ice-silver">
                      ₹{item.amount.toLocaleString('en-IN', { minimumFractionDigits: 2 })}
                    </td>
                    <td className="px-4 py-3 font-mono text-marigold font-semibold">
                      {(item.score * 100).toFixed(1)}%
                    </td>
                    <td className="px-4 py-3">
                      <RiskBadge band={item.risk_band} score={item.score} size="sm" />
                    </td>
                    <td className="px-4 py-3">
                      <span className="font-mono text-[10px] uppercase px-1.5 py-0.5 rounded bg-deep-aubergine-surface text-soft-silver border border-deep-aubergine-border">
                        {item.status.replace(/_/g, ' ')}
                      </span>
                    </td>
                    <td className="px-4 py-3 text-right">
                      <button
                        onClick={(e) => {
                          e.stopPropagation();
                          onNavigateToRisk(item.id);
                        }}
                        className="p-1 rounded hover:bg-deep-aubergine-surface text-muted-lavender hover:text-marigold transition-colors"
                      >
                        <Eye className="w-3.5 h-3.5" />
                      </button>
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
};

import React, { useState, useEffect } from 'react';
import {
  Play,
  Square,
  Zap,
  Flame,
  Globe,
  Gauge,
  Moon,
  Users,
  CheckCircle2,
  AlertCircle,
  RefreshCw,
  Activity,
  ArrowRight,
} from 'lucide-react';
import { api } from '../api/client';
import { RiskBadge } from '../components/RiskBadge';
import type { SimulatorStatus, Transaction } from '../types';

interface SimulationLabProps {
  onNavigateToRisk: (txnId: number) => void;
}

export const SimulationLab: React.FC<SimulationLabProps> = ({ onNavigateToRisk }) => {
  const [status, setStatus] = useState<SimulatorStatus | null>(null);
  const [rateHz, setRateHz] = useState(1.0);
  const [loading, setLoading] = useState(false);
  const [targetCustomer, setTargetCustomer] = useState('cust_001');

  // Attack Injection state
  const [injecting, setInjecting] = useState<string | null>(null);
  const [injectedTxns, setInjectedTxns] = useState<Transaction[]>([]);
  const [feedbackMsg, setFeedbackMsg] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  const fetchStatus = async () => {
    try {
      const res = await api.getSimulatorStatus();
      setStatus(res);
      setRateHz(res.rate_hz || 1.0);
    } catch {
      // ignore
    }
  };

  useEffect(() => {
    fetchStatus();
    const interval = setInterval(fetchStatus, 3000);
    return () => clearInterval(interval);
  }, []);

  const handleToggleSimulator = async () => {
    setLoading(true);
    setError(null);
    try {
      if (status?.is_running) {
        const res = await api.stopSimulator();
        setStatus(res);
      } else {
        const res = await api.startSimulator(rateHz);
        setStatus(res);
      }
    } catch (err: unknown) {
      if (err instanceof Error) {
        setError(err.message);
      } else {
        setError('Failed to update simulator state');
      }
    } finally {
      setLoading(false);
    }
  };

  const handleInject = async (pattern: string) => {
    setInjecting(pattern);
    setError(null);
    setFeedbackMsg(null);
    try {
      const res = await api.injectPattern(pattern, targetCustomer || undefined);
      setInjectedTxns(res);
      setFeedbackMsg(
        `Injected attack pattern: ${pattern.replace(/_/g, ' ').toUpperCase()} (${res.length} transaction${
          res.length > 1 ? 's' : ''
        } evaluated).`
      );
      fetchStatus();
    } catch (err: unknown) {
      if (err instanceof Error) {
        setError(err.message);
      } else {
        setError('Failed to inject attack pattern');
      }
    } finally {
      setInjecting(null);
    }
  };

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex flex-col md:flex-row md:items-center md:justify-between gap-4 pb-3 border-b border-deep-aubergine-border">
        <div>
          <div className="flex items-center gap-2.5">
            <h1 className="text-xl sm:text-2xl font-bold text-ice-silver tracking-tight">
              Fraud Simulation & Adversarial Stress Lab
            </h1>
            <span className="text-[10px] font-mono px-2 py-0.5 rounded bg-deep-aubergine-surface text-marigold border border-deep-aubergine-border font-medium">
              Real-time Ingestion Engine
            </span>
          </div>
          <p className="text-xs text-soft-silver mt-1">
            Simulate high-throughput synthetic bank traffic, calibrate detection latency, and stress-test pipeline defenses with targeted adversarial patterns
          </p>
        </div>

        <button
          onClick={fetchStatus}
          className="self-start md:self-auto flex items-center gap-2 px-3 py-1.5 rounded-lg bg-deep-aubergine-surface hover:bg-deep-aubergine-card text-ice-silver text-xs border border-deep-aubergine-border transition-colors"
        >
          <RefreshCw className="w-3.5 h-3.5 text-marigold" />
          <span>Refresh Engine</span>
        </button>
      </div>

      {error && (
        <div className="p-3.5 rounded-lg bg-red-950/60 border border-red-800/60 text-red-300 text-xs flex items-center gap-2">
          <AlertCircle className="w-4 h-4 shrink-0" />
          <span>{error}</span>
        </div>
      )}

      {/* Simulator Engine Controls & Attack Injectors */}
      <div className="grid grid-cols-1 lg:grid-cols-12 gap-6">
        {/* Left: Background Stream Engine (4 cols) */}
        <div className="lg:col-span-4 bg-deep-aubergine-card border border-deep-aubergine-border rounded-xl p-5 shadow-subtle space-y-4">
          <div className="flex items-center justify-between pb-3 border-b border-deep-aubergine-border">
            <h2 className="text-xs font-bold text-ice-silver uppercase tracking-wider flex items-center gap-2">
              <Gauge className="w-4 h-4 text-marigold" />
              <span>Background Stream Generator</span>
            </h2>
            <span
              className={`text-[10px] font-mono font-bold px-2 py-0.5 rounded border ${
                status?.is_running
                  ? 'bg-emerald-950/60 text-emerald-300 border-emerald-800/60 animate-pulse'
                  : 'bg-deep-aubergine-surface text-slate-grey border-deep-aubergine-border'
              }`}
            >
              {status?.is_running ? 'RUNNING' : 'STOPPED'}
            </span>
          </div>

          <div className="grid grid-cols-2 gap-3 text-xs font-mono">
            <div className="bg-deep-aubergine-surface/70 p-3 rounded-lg border border-deep-aubergine-border">
              <div className="text-muted-lavender text-[10px] font-sans mb-0.5">Emitted Count</div>
              <div className="text-xl font-bold text-ice-silver">{status?.emitted_count || 0}</div>
            </div>
            <div className="bg-deep-aubergine-surface/70 p-3 rounded-lg border border-deep-aubergine-border">
              <div className="text-muted-lavender text-[10px] font-sans mb-0.5">Frequency</div>
              <div className="text-xl font-bold text-marigold">{rateHz.toFixed(1)} Hz</div>
            </div>
          </div>

          {/* Rate Slider */}
          <div>
            <div className="flex items-center justify-between text-xs font-medium text-soft-silver mb-1.5">
              <span>Emission Throughput</span>
              <span className="font-mono text-marigold">{rateHz} txns / second</span>
            </div>
            <input
              type="range"
              min="0.5"
              max="5.0"
              step="0.5"
              value={rateHz}
              onChange={(e) => setRateHz(parseFloat(e.target.value))}
              disabled={status?.is_running}
              className="w-full accent-marigold bg-deep-aubergine-dark rounded-lg cursor-pointer"
            />
            <div className="flex justify-between text-[10px] text-slate-grey mt-1">
              <span>0.5 Hz (Gentle)</span>
              <span>2.5 Hz (Standard)</span>
              <span>5.0 Hz (Peak Load)</span>
            </div>
          </div>

          <button
            onClick={handleToggleSimulator}
            disabled={loading}
            className={`w-full py-2.5 px-4 rounded-lg text-xs font-semibold flex items-center justify-center gap-2 shadow-subtle transition-all ${
              status?.is_running
                ? 'bg-red-950/70 hover:bg-red-900/70 text-red-300 border border-red-800/70'
                : 'bg-marigold hover:bg-marigold-light text-deep-aubergine-dark'
            }`}
          >
            {status?.is_running ? (
              <>
                <Square className="w-4 h-4 fill-current" />
                <span>Stop Stream Simulation</span>
              </>
            ) : (
              <>
                <Play className="w-4 h-4 fill-current" />
                <span>Start Stream Simulation</span>
              </>
            )}
          </button>
        </div>

        {/* Right: Adversarial Scenario Injectors (8 cols) */}
        <div className="lg:col-span-8 bg-deep-aubergine-card border border-deep-aubergine-border rounded-xl p-5 shadow-subtle space-y-4">
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2 pb-3 border-b border-deep-aubergine-border">
            <div>
              <h2 className="text-xs font-bold text-ice-silver uppercase tracking-wider flex items-center gap-2">
                <Zap className="w-4 h-4 text-marigold" />
                <span>Targeted Adversarial Scenario Injection Suite</span>
              </h2>
              <p className="text-[11px] text-soft-silver">
                Inject rule-breaking fraud episodes to stress-test real-time detection and policy routing
              </p>
            </div>

            <div className="flex items-center gap-2">
              <span className="text-[11px] text-muted-lavender">Target Account:</span>
              <input
                type="text"
                value={targetCustomer}
                onChange={(e) => setTargetCustomer(e.target.value)}
                placeholder="cust_001"
                className="bg-deep-aubergine-dark border border-deep-aubergine-border rounded px-2.5 py-1 text-xs font-mono text-ice-silver focus:outline-none focus:border-marigold w-28"
              />
            </div>
          </div>

          {/* 5 Attack Scenario Buttons */}
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 pt-1">
            {/* 1. Amount Spike */}
            <button
              onClick={() => handleInject('amount_spike')}
              disabled={injecting !== null}
              className="p-3.5 rounded-lg bg-deep-aubergine-surface/70 hover:bg-deep-aubergine-surface border border-deep-aubergine-border hover:border-marigold/60 text-left transition-all disabled:opacity-50"
            >
              <div className="flex items-center gap-2 mb-1.5">
                <div className="p-1 rounded bg-deep-aubergine-dark text-marigold">
                  <Flame className="w-4 h-4" />
                </div>
                <span className="text-xs font-bold text-ice-silver">Amount Surge (20x)</span>
              </div>
              <p className="text-[11px] text-soft-silver leading-relaxed">
                Injects an anomalous transaction 20x higher than {targetCustomer || 'the target'}&apos;s historical baseline.
              </p>
            </button>

            {/* 2. Impossible Travel */}
            <button
              onClick={() => handleInject('impossible_travel')}
              disabled={injecting !== null}
              className="p-3.5 rounded-lg bg-deep-aubergine-surface/70 hover:bg-deep-aubergine-surface border border-deep-aubergine-border hover:border-marigold/60 text-left transition-all disabled:opacity-50"
            >
              <div className="flex items-center gap-2 mb-1.5">
                <div className="p-1 rounded bg-deep-aubergine-dark text-marigold">
                  <Globe className="w-4 h-4" />
                </div>
                <span className="text-xs font-bold text-ice-silver">Impossible Travel (&gt;600 km/h)</span>
              </div>
              <p className="text-[11px] text-soft-silver leading-relaxed">
                Simulates rapid consecutive payments from Mumbai and London within 10 minutes.
              </p>
            </button>

            {/* 3. Velocity Burst */}
            <button
              onClick={() => handleInject('velocity_burst')}
              disabled={injecting !== null}
              className="p-3.5 rounded-lg bg-deep-aubergine-surface/70 hover:bg-deep-aubergine-surface border border-deep-aubergine-border hover:border-marigold/60 text-left transition-all disabled:opacity-50"
            >
              <div className="flex items-center gap-2 mb-1.5">
                <div className="p-1 rounded bg-deep-aubergine-dark text-marigold">
                  <Activity className="w-4 h-4" />
                </div>
                <span className="text-xs font-bold text-ice-silver">Velocity Burst (6 txns/min)</span>
              </div>
              <p className="text-[11px] text-soft-silver leading-relaxed">
                Injects 6 rapid micro-transactions in 60 seconds testing the velocity sliding-window feature.
              </p>
            </button>

            {/* 4. New Device at Night */}
            <button
              onClick={() => handleInject('new_device_night')}
              disabled={injecting !== null}
              className="p-3.5 rounded-lg bg-deep-aubergine-surface/70 hover:bg-deep-aubergine-surface border border-deep-aubergine-border hover:border-marigold/60 text-left transition-all disabled:opacity-50"
            >
              <div className="flex items-center gap-2 mb-1.5">
                <div className="p-1 rounded bg-deep-aubergine-dark text-marigold">
                  <Moon className="w-4 h-4" />
                </div>
                <span className="text-xs font-bold text-ice-silver">New Device at Night (3:30 AM)</span>
              </div>
              <p className="text-[11px] text-soft-silver leading-relaxed">
                Simulates nocturnal account takeover attempt originating from an unrecognized device ID.
              </p>
            </button>

            {/* 5. Shared Device Ring */}
            <button
              onClick={() => handleInject('shared_device_ring')}
              disabled={injecting !== null}
              className="sm:col-span-2 p-3.5 rounded-lg bg-deep-aubergine-surface/70 hover:bg-deep-aubergine-surface border border-deep-aubergine-border hover:border-marigold/60 text-left transition-all disabled:opacity-50"
            >
              <div className="flex items-center gap-2 mb-1.5">
                <div className="p-1 rounded bg-deep-aubergine-dark text-marigold">
                  <Users className="w-4 h-4" />
                </div>
                <span className="text-xs font-bold text-ice-silver">Shared Device Fraud Ring</span>
              </div>
              <p className="text-[11px] text-soft-silver leading-relaxed">
                Simulates organized syndicate activity: transactions across 4 customer accounts originating from a single compromised device key.
              </p>
            </button>
          </div>
        </div>
      </div>

      {/* Injected Transactions Feedback Table */}
      {feedbackMsg && (
        <div className="p-3.5 rounded-lg bg-emerald-950/60 border border-emerald-800/60 text-emerald-300 text-xs flex items-center gap-2">
          <CheckCircle2 className="w-4 h-4 shrink-0 text-emerald-400" />
          <span>{feedbackMsg}</span>
        </div>
      )}

      {injectedTxns.length > 0 && (
        <div className="bg-deep-aubergine-card border border-deep-aubergine-border rounded-xl p-5 shadow-subtle space-y-3">
          <div className="flex items-center justify-between pb-2 border-b border-deep-aubergine-border">
            <h3 className="text-xs font-bold uppercase tracking-wider text-ice-silver">
              Evaluated Injected Transactions ({injectedTxns.length})
            </h3>
            <span className="text-xs text-soft-silver font-mono">Streamed & Queued</span>
          </div>

          <div className="overflow-x-auto">
            <table className="w-full text-left text-xs font-mono">
              <thead className="bg-deep-aubergine-surface/70 text-slate-grey text-[10px] uppercase tracking-wider">
                <tr>
                  <th className="px-3 py-2">Txn ID</th>
                  <th className="px-3 py-2">Customer</th>
                  <th className="px-3 py-2">Amount</th>
                  <th className="px-3 py-2">Channel</th>
                  <th className="px-3 py-2">Calibrated Score</th>
                  <th className="px-3 py-2">Risk Band</th>
                  <th className="px-3 py-2">Policy Action</th>
                  <th className="px-3 py-2 text-right">Inspect</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-deep-aubergine-border/50 text-xs">
                {injectedTxns.map((t) => {
                  const p = t.prediction;
                  return (
                    <tr key={t.id} className="hover:bg-deep-aubergine-surface/40 transition-colors">
                      <td className="px-3 py-2 text-ice-silver font-semibold">{t.external_txn_id}</td>
                      <td className="px-3 py-2 text-soft-silver">{t.external_customer_id}</td>
                      <td className="px-3 py-2 font-bold text-ice-silver">
                        ₹{t.amount.toLocaleString('en-IN', { minimumFractionDigits: 2 })}
                      </td>
                      <td className="px-3 py-2 uppercase text-slate-grey">{t.channel}</td>
                      <td className="px-3 py-2 text-marigold font-semibold">
                        {p?.calibrated_score ? `${(p.calibrated_score * 100).toFixed(1)}%` : '—'}
                      </td>
                      <td className="px-3 py-2 font-sans">
                        {p && <RiskBadge band={p.risk_band} score={p.calibrated_score} size="sm" />}
                      </td>
                      <td className="px-3 py-2 text-ice-silver font-sans text-[11px]">{p?.recommended_action || '—'}</td>
                      <td className="px-3 py-2 text-right font-sans">
                        <button
                          onClick={() => onNavigateToRisk(t.id)}
                          className="inline-flex items-center gap-1 px-2 py-0.5 rounded bg-deep-aubergine-surface text-marigold border border-deep-aubergine-border hover:bg-deep-aubergine-card text-[11px]"
                        >
                          <span>Analyze</span>
                          <ArrowRight className="w-3 h-3" />
                        </button>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        </div>
      )}
    </div>
  );
};

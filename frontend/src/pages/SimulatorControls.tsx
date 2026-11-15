import React, { useState, useEffect } from 'react';
import {
  Activity,
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
} from 'lucide-react';
import { api } from '../api/client';
import { RiskBadge } from '../components/RiskBadge';
import type { SimulatorStatus, Transaction } from '../types';

export const SimulatorControls: React.FC = () => {
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
      setFeedbackMsg(`Successfully injected attack pattern: ${pattern.replace(/_/g, ' ')} (${res.length} transaction${res.length > 1 ? 's' : ''} evaluated).`);
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
      <div className="flex flex-col md:flex-row md:items-center md:justify-between gap-4 pb-2 border-b border-slate-800">
        <div>
          <h1 className="text-xl sm:text-2xl font-bold text-white tracking-tight flex items-center gap-2.5">
            <Activity className="w-6 h-6 text-amber-400" />
            <span>Transaction Stream Simulator & Attack Injector</span>
          </h1>
          <p className="text-xs text-slate-400 mt-1">
            Generate synthetic realistic transaction streams and test real-time pipeline defenses with targeted adversarial injections
          </p>
        </div>

        <button
          onClick={fetchStatus}
          className="self-start md:self-auto flex items-center gap-2 px-3 py-1.5 rounded-lg bg-slate-800 text-slate-300 hover:text-white text-xs border border-slate-700 transition-colors"
        >
          <RefreshCw className="w-3.5 h-3.5" />
          <span>Refresh Status</span>
        </button>
      </div>

      {error && (
        <div className="p-4 rounded-xl bg-rose-500/10 border border-rose-500/30 text-rose-300 text-xs flex items-center gap-2">
          <AlertCircle className="w-4 h-4 shrink-0" />
          <span>{error}</span>
        </div>
      )}

      {/* Simulator Engine Status & Controls */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* Left: Background Engine Controls (1 col) */}
        <div className="bg-slate-900/80 border border-slate-800 rounded-2xl p-5 shadow-xl space-y-4">
          <div className="flex items-center justify-between">
            <h2 className="text-sm font-bold text-white flex items-center gap-2">
              <Gauge className="w-4 h-4 text-teal-400" />
              <span>Background Stream Engine</span>
            </h2>
            <span
              className={`text-[10px] font-mono font-bold px-2 py-0.5 rounded-full border ${
                status?.is_running
                  ? 'bg-emerald-500/15 text-emerald-400 border-emerald-500/30 animate-pulse'
                  : 'bg-slate-800 text-slate-400 border-slate-700'
              }`}
            >
              {status?.is_running ? 'STREAM RUNNING' : 'IDLE / STOPPED'}
            </span>
          </div>

          <div className="grid grid-cols-2 gap-3 text-xs">
            <div className="bg-slate-950/70 p-3 rounded-xl border border-slate-800">
              <div className="text-slate-400 mb-1">Emitted Count</div>
              <div className="text-xl font-bold text-white font-mono">{status?.emitted_count || 0}</div>
            </div>
            <div className="bg-slate-950/70 p-3 rounded-xl border border-slate-800">
              <div className="text-slate-400 mb-1">Emission Rate</div>
              <div className="text-xl font-bold text-amber-400 font-mono">{rateHz.toFixed(1)} Hz</div>
            </div>
          </div>

          {/* Rate Slider */}
          <div>
            <label className="block text-xs font-medium text-slate-300 mb-1 flex items-center justify-between">
              <span>Emission Frequency</span>
              <span className="font-mono text-amber-400">{rateHz} txns / second</span>
            </label>
            <input
              type="range"
              min="0.5"
              max="5.0"
              step="0.5"
              value={rateHz}
              onChange={(e) => setRateHz(parseFloat(e.target.value))}
              disabled={status?.is_running}
              className="w-full accent-teal-500 bg-slate-800 rounded-lg cursor-pointer"
            />
            <div className="flex justify-between text-[10px] text-slate-400 mt-1">
              <span>0.5 Hz (Slow)</span>
              <span>2.5 Hz (Medium)</span>
              <span>5.0 Hz (High Load)</span>
            </div>
          </div>

          <button
            onClick={handleToggleSimulator}
            disabled={loading}
            className={`w-full py-2.5 px-4 rounded-xl text-xs font-semibold flex items-center justify-center gap-2 shadow-lg transition-all ${
              status?.is_running
                ? 'bg-rose-600 hover:bg-rose-500 text-white shadow-rose-600/20'
                : 'bg-teal-600 hover:bg-teal-500 text-white shadow-teal-600/20'
            }`}
          >
            {status?.is_running ? (
              <>
                <Square className="w-4 h-4 fill-white" />
                <span>Stop Stream Simulation</span>
              </>
            ) : (
              <>
                <Play className="w-4 h-4 fill-white" />
                <span>Start Real-time Stream Generator</span>
              </>
            )}
          </button>
        </div>

        {/* Right: Adversarial Pattern Injector (2 cols) */}
        <div className="lg:col-span-2 bg-slate-900/80 border border-slate-800 rounded-2xl p-5 shadow-xl space-y-4">
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2">
            <div>
              <h2 className="text-sm font-bold text-white flex items-center gap-2">
                <Zap className="w-4 h-4 text-amber-400" />
                <span>Adversarial Attack Scenario Injector</span>
              </h2>
              <p className="text-xs text-slate-400">
                Trigger targeted anomaly and fraud patterns to test detector response in real-time
              </p>
            </div>

            {/* Target Customer Input */}
            <div className="flex items-center gap-2">
              <span className="text-xs text-slate-400">Target:</span>
              <input
                type="text"
                value={targetCustomer}
                onChange={(e) => setTargetCustomer(e.target.value)}
                placeholder="cust_001"
                className="bg-slate-950 border border-slate-800 rounded-lg px-2.5 py-1 text-xs font-mono text-slate-200 focus:outline-none focus:border-amber-500 w-28"
              />
            </div>
          </div>

          {/* 5 Attack Buttons Grid */}
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 pt-2">
            {/* 1. Amount Spike */}
            <button
              onClick={() => handleInject('amount_spike')}
              disabled={injecting !== null}
              className="p-3.5 rounded-xl bg-slate-950 hover:bg-slate-900 border border-slate-800 hover:border-amber-500/50 text-left transition-all group disabled:opacity-50"
            >
              <div className="flex items-center gap-2.5 mb-1.5">
                <div className="p-1.5 rounded-lg bg-amber-500/10 text-amber-400 group-hover:scale-110 transition-transform">
                  <Flame className="w-4 h-4" />
                </div>
                <span className="text-xs font-bold text-slate-200 group-hover:text-amber-400">Amount Spike</span>
              </div>
              <p className="text-[11px] text-slate-400 leading-relaxed">
                Injects a 20x spending surge on {targetCustomer || 'the target'} compared to their historical median.
              </p>
            </button>

            {/* 2. Impossible Travel */}
            <button
              onClick={() => handleInject('impossible_travel')}
              disabled={injecting !== null}
              className="p-3.5 rounded-xl bg-slate-950 hover:bg-slate-900 border border-slate-800 hover:border-sky-500/50 text-left transition-all group disabled:opacity-50"
            >
              <div className="flex items-center gap-2.5 mb-1.5">
                <div className="p-1.5 rounded-lg bg-sky-500/10 text-sky-400 group-hover:scale-110 transition-transform">
                  <Globe className="w-4 h-4" />
                </div>
                <span className="text-xs font-bold text-slate-200 group-hover:text-sky-400">Impossible Travel</span>
              </div>
              <p className="text-[11px] text-slate-400 leading-relaxed">
                Simulates consecutive transactions from Mumbai and London within 10 minutes (&gt;600 km/h speed).
              </p>
            </button>

            {/* 3. Velocity Burst */}
            <button
              onClick={() => handleInject('velocity_burst')}
              disabled={injecting !== null}
              className="p-3.5 rounded-xl bg-slate-950 hover:bg-slate-900 border border-slate-800 hover:border-rose-500/50 text-left transition-all group disabled:opacity-50"
            >
              <div className="flex items-center gap-2.5 mb-1.5">
                <div className="p-1.5 rounded-lg bg-rose-500/10 text-rose-400 group-hover:scale-110 transition-transform">
                  <Activity className="w-4 h-4" />
                </div>
                <span className="text-xs font-bold text-slate-200 group-hover:text-rose-400">Velocity Burst</span>
              </div>
              <p className="text-[11px] text-slate-400 leading-relaxed">
                Injects 6 rapid micro-transactions within 60 seconds testing the velocity sliding window features.
              </p>
            </button>

            {/* 4. New Device at Night */}
            <button
              onClick={() => handleInject('new_device_night')}
              disabled={injecting !== null}
              className="p-3.5 rounded-xl bg-slate-950 hover:bg-slate-900 border border-slate-800 hover:border-indigo-500/50 text-left transition-all group disabled:opacity-50"
            >
              <div className="flex items-center gap-2.5 mb-1.5">
                <div className="p-1.5 rounded-lg bg-indigo-500/10 text-indigo-400 group-hover:scale-110 transition-transform">
                  <Moon className="w-4 h-4" />
                </div>
                <span className="text-xs font-bold text-slate-200 group-hover:text-indigo-400">
                  New Device at Night
                </span>
              </div>
              <p className="text-[11px] text-slate-400 leading-relaxed">
                Simulates account takeover attempt at 3:30 AM from a brand-new device fingerprint.
              </p>
            </button>

            {/* 5. Shared Device Ring */}
            <button
              onClick={() => handleInject('shared_device_ring')}
              disabled={injecting !== null}
              className="sm:col-span-2 p-3.5 rounded-xl bg-slate-950 hover:bg-slate-900 border border-slate-800 hover:border-emerald-500/50 text-left transition-all group disabled:opacity-50"
            >
              <div className="flex items-center gap-2.5 mb-1.5">
                <div className="p-1.5 rounded-lg bg-emerald-500/10 text-emerald-400 group-hover:scale-110 transition-transform">
                  <Users className="w-4 h-4" />
                </div>
                <span className="text-xs font-bold text-slate-200 group-hover:text-emerald-400">
                  Shared Device Fraud Ring
                </span>
              </div>
              <p className="text-[11px] text-slate-400 leading-relaxed">
                Injects transactions across 4 different customer IDs all originating from a single compromised device key.
              </p>
            </button>
          </div>
        </div>
      </div>

      {/* Injected Transactions Feedback Table */}
      {feedbackMsg && (
        <div className="p-4 rounded-xl bg-teal-500/10 border border-teal-500/30 text-teal-300 text-xs flex items-center gap-2">
          <CheckCircle2 className="w-4 h-4 shrink-0 text-teal-400" />
          <span>{feedbackMsg}</span>
        </div>
      )}

      {injectedTxns.length > 0 && (
        <div className="bg-slate-900/80 border border-slate-800 rounded-2xl p-5 shadow-xl space-y-3 animate-in fade-in duration-300">
          <div className="flex items-center justify-between">
            <h3 className="text-xs font-bold uppercase tracking-wider text-slate-300">
              Evaluated Injected Transactions ({injectedTxns.length})
            </h3>
            <span className="text-xs text-slate-400">Streamed to SSE & Queued for Review</span>
          </div>

          <div className="overflow-x-auto">
            <table className="w-full text-left text-xs">
              <thead className="bg-slate-950/80 text-slate-400 font-mono text-[11px]">
                <tr>
                  <th className="px-3 py-2">Txn ID</th>
                  <th className="px-3 py-2">Customer</th>
                  <th className="px-3 py-2">Amount</th>
                  <th className="px-3 py-2">Channel</th>
                  <th className="px-3 py-2">Calibrated Score</th>
                  <th className="px-3 py-2">Risk Band</th>
                  <th className="px-3 py-2">Policy Action</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-800/60 font-mono text-xs">
                {injectedTxns.map((t) => {
                  const p = t.prediction;
                  return (
                    <tr key={t.id} className="hover:bg-slate-800/30">
                      <td className="px-3 py-2 text-slate-300">{t.external_txn_id}</td>
                      <td className="px-3 py-2 text-slate-400">{t.external_customer_id}</td>
                      <td className="px-3 py-2 font-bold text-white">
                        ₹{t.amount.toLocaleString('en-IN', { minimumFractionDigits: 2 })}
                      </td>
                      <td className="px-3 py-2 uppercase text-slate-400">{t.channel}</td>
                      <td className="px-3 py-2 text-amber-400">
                        {p?.calibrated_score ? `${(p.calibrated_score * 100).toFixed(1)}%` : '—'}
                      </td>
                      <td className="px-3 py-2 font-sans">
                        {p && <RiskBadge band={p.risk_band} score={p.calibrated_score} size="sm" />}
                      </td>
                      <td className="px-3 py-2 text-indigo-300">{p?.recommended_action || '—'}</td>
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

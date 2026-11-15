import React, { useState, useEffect } from 'react';
import {
  Cpu,
  Search,
  ShieldAlert,
  TrendingUp,
  CreditCard,
  MapPin,
  Clock,
  Sparkles,
  ArrowRight,
  AlertTriangle,
} from 'lucide-react';
import { api } from '../api/client';
import { RiskBadge } from '../components/RiskBadge';
import { ShapAttributionBar } from '../components/ShapAttributionBar';
import type { Transaction, TransactionDetail } from '../types';

interface RiskAnalysisProps {
  initialTxnId?: number | null;
  onNavigateToPrevention: (txnId: number) => void;
}

export const RiskAnalysis: React.FC<RiskAnalysisProps> = ({
  initialTxnId,
  onNavigateToPrevention,
}) => {
  const [txnIdInput, setTxnIdInput] = useState<string>(initialTxnId ? initialTxnId.toString() : '');
  const [detail, setDetail] = useState<TransactionDetail | null>(null);
  const [recentTxns, setRecentTxns] = useState<Transaction[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // Load recent transactions for the dropdown
  useEffect(() => {
    api
      .listTransactions('?page=1&page_size=10&sort_order=desc')
      .then((res) => {
        setRecentTxns(res.items);
        if (!initialTxnId && res.items.length > 0) {
          fetchTransactionAnalysis(res.items[0].id);
        }
      })
      .catch(() => {});
  }, [initialTxnId]);

  useEffect(() => {
    if (initialTxnId) {
      setTxnIdInput(initialTxnId.toString());
      fetchTransactionAnalysis(initialTxnId);
    }
  }, [initialTxnId]);

  const fetchTransactionAnalysis = async (id: number) => {
    setLoading(true);
    setError(null);
    try {
      const res = await api.getTransactionDetail(id);
      setDetail(res);
      setTxnIdInput(id.toString());
    } catch (err: unknown) {
      if (err instanceof Error) {
        setError(err.message);
      } else {
        setError(`Failed to retrieve transaction #${id}`);
      }
    } finally {
      setLoading(false);
    }
  };

  const handleSearch = (e: React.FormEvent) => {
    e.preventDefault();
    const id = parseInt(txnIdInput.trim(), 10);
    if (!isNaN(id)) {
      fetchTransactionAnalysis(id);
    }
  };

  const pred = detail?.prediction;

  return (
    <div className="space-y-6">
      {/* Header & Transaction Selector */}
      <div className="flex flex-col md:flex-row md:items-center md:justify-between gap-4 pb-3 border-b border-deep-aubergine-border">
        <div>
          <div className="flex items-center gap-2.5">
            <h1 className="text-xl sm:text-2xl font-bold text-ice-silver tracking-tight">
              Fraud Detection & Risk Analysis Workspace
            </h1>
            <span className="text-[10px] font-mono px-2 py-0.5 rounded bg-deep-aubergine-surface text-marigold border border-deep-aubergine-border font-medium">
              TreeSHAP Explainability
            </span>
          </div>
          <p className="text-xs text-soft-silver mt-1">
            Deep-dive ML inference inspection, ensemble anomaly scoring, feature attribution waterfalls, and counterfactuals
          </p>
        </div>

        {/* Transaction Search Box */}
        <form onSubmit={handleSearch} className="flex items-center gap-2">
          <div className="relative">
            <Search className="w-3.5 h-3.5 absolute left-3 top-2.5 text-slate-grey" />
            <input
              type="text"
              value={txnIdInput}
              onChange={(e) => setTxnIdInput(e.target.value)}
              placeholder="Enter Transaction ID (e.g. 1)"
              className="bg-deep-aubergine-dark border border-deep-aubergine-border rounded-lg pl-8 pr-3 py-1.5 text-xs text-ice-silver placeholder-slate-grey focus:outline-none focus:border-marigold w-44 font-mono"
            />
          </div>
          <button
            type="submit"
            disabled={loading}
            className="px-3 py-1.5 rounded-lg bg-deep-aubergine-surface hover:bg-deep-aubergine-card text-marigold border border-deep-aubergine-border text-xs font-semibold transition-colors"
          >
            {loading ? 'Analyzing...' : 'Inspect'}
          </button>
        </form>
      </div>

      {/* Quick Select from Recent Transactions */}
      {recentTxns.length > 0 && (
        <div className="flex items-center gap-2 overflow-x-auto pb-1 text-xs">
          <span className="text-[11px] text-muted-lavender whitespace-nowrap">Recent Cases:</span>
          {recentTxns.slice(0, 6).map((t) => (
            <button
              key={t.id}
              onClick={() => fetchTransactionAnalysis(t.id)}
              className={`px-2.5 py-1 rounded font-mono text-[11px] border whitespace-nowrap transition-colors ${
                detail?.id === t.id
                  ? 'bg-deep-aubergine-surface text-marigold border-marigold'
                  : 'bg-deep-aubergine-card text-soft-silver border-deep-aubergine-border hover:text-ice-silver'
              }`}
            >
              #{t.id} (₹{t.amount.toFixed(0)})
            </button>
          ))}
        </div>
      )}

      {error && (
        <div className="p-3.5 rounded-lg bg-red-950/60 border border-red-800/60 text-red-300 text-xs flex items-center gap-2">
          <AlertTriangle className="w-4 h-4 shrink-0" />
          <span>{error}</span>
        </div>
      )}

      {detail && (
        <div className="grid grid-cols-1 lg:grid-cols-12 gap-6">
          {/* Left Column: Transaction Metadata & ML Assessment (5 cols) */}
          <div className="lg:col-span-5 space-y-6">
            {/* Transaction Overview Card */}
            <div className="bg-deep-aubergine-card border border-deep-aubergine-border rounded-xl p-5 shadow-subtle space-y-4">
              <div className="flex items-center justify-between pb-3 border-b border-deep-aubergine-border">
                <div className="flex items-center gap-2">
                  <CreditCard className="w-4 h-4 text-marigold" />
                  <h2 className="text-xs font-bold text-ice-silver uppercase tracking-wider">
                    Transaction Profile
                  </h2>
                </div>
                <span className="font-mono text-xs text-marigold font-bold">#{detail.id}</span>
              </div>

              <div className="grid grid-cols-2 gap-3 text-xs">
                <div className="bg-deep-aubergine-surface/70 p-3 rounded-lg border border-deep-aubergine-border">
                  <div className="text-muted-lavender text-[11px] mb-0.5">Amount</div>
                  <div className="text-lg font-bold text-ice-silver font-mono">
                    ₹{detail.amount.toLocaleString('en-IN', { minimumFractionDigits: 2 })}
                  </div>
                </div>

                <div className="bg-deep-aubergine-surface/70 p-3 rounded-lg border border-deep-aubergine-border">
                  <div className="text-muted-lavender text-[11px] mb-0.5">Customer ID</div>
                  <div className="text-xs font-semibold text-ice-silver font-mono truncate">
                    {detail.external_customer_id}
                  </div>
                </div>

                <div className="bg-deep-aubergine-surface/70 p-3 rounded-lg border border-deep-aubergine-border">
                  <div className="text-muted-lavender text-[11px] mb-0.5">Payment Channel</div>
                  <div className="text-xs font-semibold text-ice-silver uppercase">{detail.channel}</div>
                </div>

                <div className="bg-deep-aubergine-surface/70 p-3 rounded-lg border border-deep-aubergine-border">
                  <div className="text-muted-lavender text-[11px] mb-0.5">Source Type</div>
                  <div className="text-xs font-semibold text-soft-silver uppercase">{detail.source}</div>
                </div>
              </div>

              <div className="space-y-2 text-xs font-mono">
                <div className="flex items-center justify-between text-soft-silver">
                  <span className="flex items-center gap-1.5">
                    <Clock className="w-3.5 h-3.5 text-muted-lavender" />
                    <span>Timestamp:</span>
                  </span>
                  <span>{new Date(detail.occurred_at).toLocaleString()}</span>
                </div>

                <div className="flex items-center justify-between text-soft-silver">
                  <span className="flex items-center gap-1.5">
                    <MapPin className="w-3.5 h-3.5 text-muted-lavender" />
                    <span>Geo Coordinates:</span>
                  </span>
                  <span>
                    {detail.lat != null && detail.lon != null ? `${detail.lat.toFixed(4)}, ${detail.lon.toFixed(4)}` : 'N/A'}
                  </span>
                </div>

                <div className="flex items-center justify-between text-soft-silver">
                  <span>Device Fingerprint:</span>
                  <span className="truncate max-w-[150px]">{detail.device_key || 'Unknown'}</span>
                </div>
              </div>

              {/* Action Button */}
              <button
                onClick={() => onNavigateToPrevention(detail.id)}
                className="w-full mt-2 py-2 px-3 rounded-lg bg-deep-aubergine-surface hover:bg-deep-aubergine-border text-marigold text-xs font-semibold border border-deep-aubergine-border flex items-center justify-center gap-2 transition-all"
              >
                <span>Take Prevention Decision</span>
                <ArrowRight className="w-3.5 h-3.5" />
              </button>
            </div>

            {/* Model Evaluation & Ensemble Scores */}
            <div className="bg-deep-aubergine-card border border-deep-aubergine-border rounded-xl p-5 shadow-subtle space-y-4">
              <div className="flex items-center justify-between pb-3 border-b border-deep-aubergine-border">
                <div className="flex items-center gap-2">
                  <Cpu className="w-4 h-4 text-marigold" />
                  <h2 className="text-xs font-bold text-ice-silver uppercase tracking-wider">
                    Model Risk Assessment
                  </h2>
                </div>
                {pred && <RiskBadge band={pred.risk_band} score={pred.calibrated_score} size="md" />}
              </div>

              {pred ? (
                <div className="space-y-3">
                  <div className="grid grid-cols-2 gap-3 text-xs">
                    <div className="bg-deep-aubergine-surface/70 p-3 rounded-lg border border-deep-aubergine-border">
                      <div className="text-muted-lavender text-[11px] mb-0.5">Calibrated Probability</div>
                      <div className="text-xl font-bold text-marigold font-mono">
                        {(pred.calibrated_score * 100).toFixed(2)}%
                      </div>
                      <div className="text-[10px] text-slate-grey mt-0.5">Platt Sigmoid Calibrated</div>
                    </div>

                    <div className="bg-deep-aubergine-surface/70 p-3 rounded-lg border border-deep-aubergine-border">
                      <div className="text-muted-lavender text-[11px] mb-0.5">Raw Anomaly Score</div>
                      <div className="text-xl font-bold text-ice-silver font-mono">
                        {(pred.raw_score * 100).toFixed(2)}%
                      </div>
                      <div className="text-[10px] text-slate-grey mt-0.5">LightGBM Gradient Booster</div>
                    </div>
                  </div>

                  <div className="p-3 rounded-lg bg-deep-aubergine-surface/50 border border-deep-aubergine-border text-xs">
                    <div className="text-muted-lavender text-[11px] mb-1 font-medium">Recommended Action:</div>
                    <div className="font-mono font-bold text-ice-silver text-sm">{pred.recommended_action}</div>
                    <div className="text-[11px] text-soft-silver mt-1">
                      Enforced by cost-optimization threshold matrix (C_fp = ₹50, C_fn = transaction amount).
                    </div>
                  </div>
                </div>
              ) : (
                <p className="text-xs text-slate-grey italic">No model prediction available for this transaction.</p>
              )}
            </div>
          </div>

          {/* Right Column: TreeSHAP Waterfall & Counterfactuals (7 cols) */}
          <div className="lg:col-span-7 space-y-6">
            {/* TreeSHAP Waterfall Card */}
            <div className="bg-deep-aubergine-card border border-deep-aubergine-border rounded-xl p-5 shadow-subtle space-y-4">
              <div className="flex items-center justify-between pb-3 border-b border-deep-aubergine-border">
                <div className="flex items-center gap-2">
                  <TrendingUp className="w-4 h-4 text-marigold" />
                  <h2 className="text-xs font-bold text-ice-silver uppercase tracking-wider">
                    TreeSHAP Local Feature Attributions
                  </h2>
                </div>
                <span className="text-[11px] text-slate-grey font-mono">Additive Feature Attribution</span>
              </div>

              <p className="text-xs text-soft-silver leading-relaxed">
                Feature attribution values quantify the exact marginal contribution of each behavioral feature towards the predicted fraud probability.
              </p>

              <ShapAttributionBar drivers={detail.top_drivers || []} />
            </div>

            {/* Plain English Reason Codes */}
            {pred?.reason_codes && pred.reason_codes.length > 0 && (
              <div className="bg-deep-aubergine-card border border-deep-aubergine-border rounded-xl p-5 shadow-subtle space-y-3">
                <div className="flex items-center gap-2 pb-2 border-b border-deep-aubergine-border">
                  <ShieldAlert className="w-4 h-4 text-red-400" />
                  <h3 className="text-xs font-bold text-ice-silver uppercase tracking-wider">
                    Identified Fraud & Risk Indicators
                  </h3>
                </div>

                <ul className="space-y-2">
                  {pred.reason_codes.map((rc, idx) => (
                    <li
                      key={idx}
                      className="p-2.5 rounded-lg bg-deep-aubergine-surface/70 border border-red-950/60 text-xs text-ice-silver flex items-center gap-2.5"
                    >
                      <span className="w-2 h-2 rounded-full bg-red-400 shrink-0" />
                      <span>{rc}</span>
                    </li>
                  ))}
                </ul>
              </div>
            )}

            {/* Actionable Counterfactual Explanation */}
            {pred?.counterfactual_hint && (
              <div className="bg-deep-aubergine-card border border-deep-aubergine-border rounded-xl p-5 shadow-subtle space-y-2">
                <div className="flex items-center gap-2 text-marigold text-xs font-bold uppercase tracking-wider">
                  <Sparkles className="w-4 h-4" />
                  <span>Actionable Counterfactual Explanation</span>
                </div>
                <p className="text-xs text-ice-silver bg-deep-aubergine-surface/70 border border-deep-aubergine-border p-3.5 rounded-lg leading-relaxed italic">
                  &quot;{pred.counterfactual_hint}&quot;
                </p>
                <p className="text-[11px] text-muted-lavender">
                  Counterfactual reasoning calculates the minimal perturbation required in transaction parameters for the decision to flip from suspicious to genuine.
                </p>
              </div>
            )}
          </div>
        </div>
      )}
    </div>
  );
};

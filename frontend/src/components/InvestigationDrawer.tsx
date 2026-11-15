import React, { useEffect, useState } from 'react';
import {
  X,
  ShieldAlert,
  Clock,
  User,
  CreditCard,
  MapPin,
  Cpu,
  CheckCircle2,
  AlertCircle,
  HelpCircle,
  Send,
  Smartphone,
} from 'lucide-react';
import { api } from '../api/client';
import { RiskBadge } from './RiskBadge';
import { ShapAttributionBar } from './ShapAttributionBar';
import type { InvestigationDetail, InvestigationStatus } from '../types';

interface InvestigationDrawerProps {
  investigationId: number | null;
  onClose: () => void;
  onUpdate: () => void;
}

export const InvestigationDrawer: React.FC<InvestigationDrawerProps> = ({
  investigationId,
  onClose,
  onUpdate,
}) => {
  const [detail, setDetail] = useState<InvestigationDetail | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [notes, setNotes] = useState('');
  const [submitting, setSubmitting] = useState(false);
  const [successMsg, setSuccessMsg] = useState<string | null>(null);

  useEffect(() => {
    if (!investigationId) {
      setDetail(null);
      return;
    }

    const fetchDetail = async () => {
      setLoading(true);
      setError(null);
      setSuccessMsg(null);
      try {
        const data = await api.getInvestigation(investigationId);
        setDetail(data);
        setNotes(data.notes || '');
      } catch (err: unknown) {
        if (err instanceof Error) {
          setError(err.message);
        } else {
          setError('Failed to load investigation details.');
        }
      } finally {
        setLoading(false);
      }
    };

    fetchDetail();
  }, [investigationId]);

  if (!investigationId) return null;

  const handleStatusChange = async (newStatus: InvestigationStatus) => {
    if (!detail) return;
    setSubmitting(true);
    setSuccessMsg(null);
    setError(null);

    try {
      const updated = await api.updateInvestigation(detail.id, newStatus, notes);
      setDetail(updated);
      setSuccessMsg(`Investigation status updated to "${newStatus.replace('_', ' ')}".`);
      onUpdate();
    } catch (err: unknown) {
      if (err instanceof Error) {
        setError(err.message);
      } else {
        setError('Failed to update investigation.');
      }
    } finally {
      setSubmitting(false);
    }
  };

  const txn = detail?.transaction;
  const pred = txn?.prediction;

  return (
    <div className="fixed inset-0 z-50 overflow-hidden bg-black/70 backdrop-blur-sm flex justify-end animate-in fade-in duration-200">
      <div className="w-full max-w-2xl bg-deep-aubergine-darker border-l border-deep-aubergine-border h-full flex flex-col shadow-2xl overflow-y-auto">
        {/* Header */}
        <div className="sticky top-0 z-10 bg-deep-aubergine-surface/95 backdrop-blur-md border-b border-deep-aubergine-border p-4 sm:p-6 flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div className="w-9 h-9 rounded-lg bg-deep-aubergine-card text-marigold border border-deep-aubergine-border flex items-center justify-center">
              <ShieldAlert className="w-5 h-5" />
            </div>
            <div>
              <div className="flex items-center gap-2">
                <h2 className="text-base font-bold text-ice-silver">Investigation #{investigationId}</h2>
                {detail && (
                  <span
                    className={`text-xs uppercase px-2 py-0.5 rounded font-mono font-semibold ${
                      detail.status === 'confirmed_fraud'
                        ? 'bg-status-danger-bg text-status-danger-text border border-status-danger-border'
                        : detail.status === 'marked_genuine'
                        ? 'bg-status-success-bg text-status-success-text border border-status-success-border'
                        : detail.status === 'under_investigation'
                        ? 'bg-status-warning-bg text-status-warning-text border border-status-warning-border'
                        : 'bg-deep-aubergine-card text-soft-silver border border-deep-aubergine-border'
                    }`}
                  >
                    {detail.status.replace('_', ' ')}
                  </span>
                )}
              </div>
              <p className="text-xs text-muted-lavender">
                Txn: <span className="font-mono text-soft-silver">{txn?.external_txn_id || '...'}</span>
              </p>
            </div>
          </div>
          <button
            onClick={onClose}
            className="p-2 rounded-lg text-slate-grey hover:text-ice-silver hover:bg-deep-aubergine-card transition-colors"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Content Body */}
        <div className="p-4 sm:p-6 space-y-6 flex-1">
          {loading && (
            <div className="flex items-center justify-center py-16 text-muted-lavender">
              <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-marigold mb-2 mr-3" />
              <span>Loading investigation details...</span>
            </div>
          )}

          {error && (
            <div className="p-4 rounded-xl bg-status-danger-bg border border-status-danger-border text-status-danger-text text-sm flex items-start gap-3">
              <AlertCircle className="w-5 h-5 shrink-0 mt-0.5" />
              <div>
                <p className="font-semibold">Error</p>
                <p className="text-xs">{error}</p>
              </div>
            </div>
          )}

          {successMsg && (
            <div className="p-4 rounded-xl bg-status-success-bg border border-status-success-border text-status-success-text text-sm flex items-center gap-3">
              <CheckCircle2 className="w-5 h-5 shrink-0" />
              <span>{successMsg}</span>
            </div>
          )}

          {detail && txn && (
            <>
              {/* Transaction Summary Card */}
              <div className="bg-deep-aubergine-card border border-deep-aubergine-border rounded-xl p-4 sm:p-5">
                <h3 className="text-xs font-semibold uppercase tracking-wider text-muted-lavender mb-3 flex items-center gap-2">
                  <CreditCard className="w-4 h-4 text-marigold" />
                  <span>Transaction Overview</span>
                </h3>
                <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 text-xs">
                  <div className="bg-deep-aubergine-surface p-2.5 rounded-lg border border-deep-aubergine-border">
                    <div className="text-muted-lavender mb-0.5">Amount</div>
                    <div className="text-base font-bold text-ice-silver">
                      ₹{txn.amount.toLocaleString('en-IN', { minimumFractionDigits: 2 })}
                    </div>
                  </div>
                  <div className="bg-deep-aubergine-surface p-2.5 rounded-lg border border-deep-aubergine-border">
                    <div className="text-muted-lavender mb-0.5">Customer ID</div>
                    <div className="font-mono font-medium text-soft-silver truncate">{txn.external_customer_id}</div>
                  </div>
                  <div className="bg-deep-aubergine-surface p-2.5 rounded-lg border border-deep-aubergine-border">
                    <div className="text-muted-lavender mb-0.5">Payment Channel</div>
                    <div className="font-semibold text-soft-silver uppercase">{txn.channel}</div>
                  </div>
                  <div className="bg-deep-aubergine-surface p-2.5 rounded-lg border border-deep-aubergine-border">
                    <div className="text-muted-lavender mb-0.5">Timestamp</div>
                    <div className="text-ice-silver text-[11px] font-mono">
                      {new Date(txn.occurred_at).toLocaleTimeString('en-IN', { hour12: false })}{' '}
                      <span className="text-muted-lavender">({new Date(txn.occurred_at).toLocaleDateString()})</span>
                    </div>
                  </div>
                </div>

                <div className="mt-3 grid grid-cols-2 gap-3 text-xs">
                  <div className="flex items-center gap-2 text-muted-lavender bg-deep-aubergine-surface/60 p-2 rounded-lg border border-deep-aubergine-border/60">
                    <MapPin className="w-3.5 h-3.5 text-muted-lavender shrink-0" />
                    <span className="truncate">
                      Lat: {txn.lat !== null && txn.lat !== undefined ? txn.lat.toFixed(4) : 'N/A'}, Lon:{' '}
                      {txn.lon !== null && txn.lon !== undefined ? txn.lon.toFixed(4) : 'N/A'}
                    </span>
                  </div>
                  <div className="flex items-center gap-2 text-muted-lavender bg-deep-aubergine-surface/60 p-2 rounded-lg border border-deep-aubergine-border/60">
                    <Smartphone className="w-3.5 h-3.5 text-muted-lavender shrink-0" />
                    <span className="truncate font-mono">Device: {txn.device_key || 'Unknown'}</span>
                  </div>
                </div>
              </div>

              {/* Machine Prediction & Explainability */}
              <div className="bg-deep-aubergine-card border border-deep-aubergine-border rounded-xl p-4 sm:p-5">
                <h3 className="text-xs font-semibold uppercase tracking-wider text-muted-lavender mb-3 flex items-center justify-between">
                  <div className="flex items-center gap-2">
                    <Cpu className="w-4 h-4 text-marigold" />
                    <span>ML Pipeline Assessment</span>
                  </div>
                  {pred && <RiskBadge band={pred.risk_band} score={pred.calibrated_score} size="md" />}
                </h3>

                {pred ? (
                  <div className="space-y-4">
                    <div className="grid grid-cols-3 gap-2 text-xs">
                      <div className="bg-deep-aubergine-surface p-2.5 rounded-lg border border-deep-aubergine-border">
                        <div className="text-muted-lavender">Calibrated Prob</div>
                        <div className="text-sm font-bold text-marigold">
                          {(pred.calibrated_score * 100).toFixed(2)}%
                        </div>
                      </div>
                      <div className="bg-deep-aubergine-surface p-2.5 rounded-lg border border-deep-aubergine-border">
                        <div className="text-muted-lavender">Raw Anomaly Score</div>
                        <div className="text-sm font-semibold text-soft-silver">
                          {(pred.raw_score * 100).toFixed(2)}%
                        </div>
                      </div>
                      <div className="bg-deep-aubergine-surface p-2.5 rounded-lg border border-deep-aubergine-border">
                        <div className="text-muted-lavender">Policy Action</div>
                        <div className="text-xs font-mono font-semibold text-marigold truncate">
                          {pred.recommended_action}
                        </div>
                      </div>
                    </div>

                    {/* Plain English Reason Codes */}
                    {pred.reason_codes && pred.reason_codes.length > 0 && (
                      <div>
                        <div className="text-xs font-semibold text-ice-silver mb-2">Detected Risk Indicators:</div>
                        <ul className="space-y-1.5">
                          {pred.reason_codes.map((rc, idx) => (
                            <li
                              key={idx}
                              className="text-xs text-soft-silver bg-deep-aubergine-surface border border-deep-aubergine-border px-3 py-1.5 rounded-lg flex items-center gap-2"
                            >
                              <span className="w-1.5 h-1.5 rounded-full bg-status-danger-text" />
                              <span>{rc}</span>
                            </li>
                          ))}
                        </ul>
                      </div>
                    )}

                    {/* Counterfactual Hint */}
                    {pred.counterfactual_hint && (
                      <div className="p-3 rounded-lg bg-deep-aubergine-surface border border-deep-aubergine-border text-xs">
                        <div className="flex items-center gap-1.5 text-marigold font-semibold mb-1">
                          <HelpCircle className="w-3.5 h-3.5" />
                          <span>Actionable Counterfactual Explanation:</span>
                        </div>
                        <p className="text-soft-silver leading-relaxed italic">{pred.counterfactual_hint}</p>
                      </div>
                    )}

                    {/* TreeSHAP Feature Attributions */}
                    <div>
                      <div className="text-xs font-semibold text-ice-silver mb-2">
                        TreeSHAP Feature Attributions (Local Explanation):
                      </div>
                      <ShapAttributionBar drivers={txn.top_drivers || []} />
                    </div>
                  </div>
                ) : (
                  <p className="text-xs text-muted-lavender italic">No ML prediction recorded for this transaction.</p>
                )}
              </div>

              {/* Customer 2-Way Verification Status */}
              <div className="bg-deep-aubergine-card border border-deep-aubergine-border rounded-xl p-4 sm:p-5">
                <h3 className="text-xs font-semibold uppercase tracking-wider text-muted-lavender mb-3 flex items-center gap-2">
                  <Smartphone className="w-4 h-4 text-marigold" />
                  <span>Customer 2-Way Verification Alert</span>
                </h3>

                {detail.customer_verification ? (
                  <div className="p-3 rounded-lg bg-deep-aubergine-surface border border-deep-aubergine-border text-xs space-y-2">
                    <div className="flex items-center justify-between">
                      <span className="text-muted-lavender">Channel: {detail.customer_verification.channel.toUpperCase()}</span>
                      <span
                        className={`font-semibold px-2 py-0.5 rounded text-[10px] ${
                          detail.customer_verification.status === 'delivered'
                            ? 'bg-status-success-bg text-status-success-text border border-status-success-border'
                            : 'bg-deep-aubergine-card text-muted-lavender'
                        }`}
                      >
                        {detail.customer_verification.status}
                      </span>
                    </div>
                    <p className="text-soft-silver italic bg-deep-aubergine-card p-2.5 rounded border border-deep-aubergine-border/60">
                      &quot;{detail.customer_verification.message}&quot;
                    </p>
                  </div>
                ) : (
                  <div className="text-xs text-muted-lavender italic bg-deep-aubergine-surface p-3 rounded-lg border border-deep-aubergine-border/60">
                    No customer verification alert was triggered for this transaction.
                  </div>
                )}
              </div>

              {/* Human Analyst Resolution Panel */}
              <div className="bg-deep-aubergine-surface border border-marigold/30 rounded-xl p-4 sm:p-5 shadow-xl">
                <h3 className="text-xs font-bold uppercase tracking-wider text-marigold mb-3 flex items-center justify-between">
                  <div className="flex items-center gap-2">
                    <User className="w-4 h-4 text-marigold" />
                    <span>Analyst Decision & Audit Logging</span>
                  </div>
                  <div className="text-[11px] text-muted-lavender lowercase font-normal">
                    {detail.analyst_username ? `logged by: ${detail.analyst_username}` : 'unassigned'}
                  </div>
                </h3>

                <div className="space-y-3">
                  <div>
                    <label className="block text-xs font-medium text-ice-silver mb-1">
                      Case Notes & Investigation Rationale
                    </label>
                    <textarea
                      value={notes}
                      onChange={(e) => setNotes(e.target.value)}
                      rows={3}
                      placeholder="Add investigation findings, customer contact details, or policy rationale..."
                      className="w-full bg-deep-aubergine-card border border-deep-aubergine-border rounded-lg p-2.5 text-xs text-ice-silver placeholder-slate-grey focus:outline-none focus:border-marigold"
                    />
                  </div>

                  <div className="flex flex-wrap items-center gap-2 pt-1">
                    <button
                      type="button"
                      disabled={submitting || detail.status === 'under_investigation'}
                      onClick={() => handleStatusChange('under_investigation')}
                      className="px-3 py-2 rounded-lg bg-status-warning-bg hover:bg-amber-900/40 text-status-warning-text border border-status-warning-border text-xs font-medium transition-all disabled:opacity-40"
                    >
                      Set Under Investigation
                    </button>

                    <button
                      type="button"
                      disabled={submitting || detail.status === 'marked_genuine'}
                      onClick={() => handleStatusChange('marked_genuine')}
                      className="px-3 py-2 rounded-lg bg-status-success-bg hover:bg-emerald-900/40 text-status-success-text border border-status-success-border text-xs font-medium transition-all disabled:opacity-40 flex items-center gap-1.5"
                    >
                      <CheckCircle2 className="w-3.5 h-3.5" />
                      <span>Mark Genuine (False Positive)</span>
                    </button>

                    <button
                      type="button"
                      disabled={submitting || detail.status === 'confirmed_fraud'}
                      onClick={() => handleStatusChange('confirmed_fraud')}
                      className="px-3 py-2 rounded-lg bg-status-danger-bg hover:bg-rose-900/40 text-status-danger-text border border-status-danger-border text-xs font-medium transition-all disabled:opacity-40 flex items-center gap-1.5"
                    >
                      <ShieldAlert className="w-3.5 h-3.5" />
                      <span>Confirm Fraud</span>
                    </button>

                    <button
                      type="button"
                      disabled={submitting}
                      onClick={() => handleStatusChange(detail.status)}
                      className="ml-auto px-3 py-2 rounded-lg bg-deep-aubergine-card hover:bg-deep-aubergine text-ice-silver text-xs font-medium border border-deep-aubergine-border transition-all disabled:opacity-40 flex items-center gap-1.5"
                    >
                      <Send className="w-3 h-3" />
                      <span>Save Notes</span>
                    </button>
                  </div>

                  <div className="flex items-center gap-2 text-[10px] text-muted-lavender pt-1">
                    <Clock className="w-3 h-3" />
                    <span>Last updated: {new Date(detail.updated_at).toLocaleString()}</span>
                  </div>
                </div>
              </div>
            </>
          )}
        </div>
      </div>
    </div>
  );
};

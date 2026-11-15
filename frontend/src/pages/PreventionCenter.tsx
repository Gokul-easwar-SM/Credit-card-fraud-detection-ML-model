import React, { useState, useEffect } from 'react';
import {
  ShieldCheck,
  Ban,
  Clock,
  Flag,
  Send,
  Smartphone,
  CreditCard,
  AlertTriangle,
  CheckCircle2,
  Lock,
  Unlock,
  RefreshCw,
} from 'lucide-react';
import { api } from '../api/client';
import { RiskBadge } from '../components/RiskBadge';
import type { AlertRecord, CardRecord, Transaction, TransactionAction, TransactionDetail } from '../types';

interface PreventionCenterProps {
  initialTxnId?: number | null;
}

export const PreventionCenter: React.FC<PreventionCenterProps> = ({ initialTxnId }) => {
  const [selectedTxn, setSelectedTxn] = useState<TransactionDetail | null>(null);
  const [txnSearchId, setTxnSearchId] = useState(initialTxnId ? initialTxnId.toString() : '');
  const [recentFlagged, setRecentFlagged] = useState<Transaction[]>([]);
  const [actionNotes, setActionNotes] = useState('');
  const [submittingAction, setSubmittingAction] = useState(false);
  const [feedback, setFeedback] = useState<{ message: string; type: 'success' | 'alert' } | null>(null);

  // Card Freeze State
  const [customerCard, setCustomerCard] = useState<CardRecord | null>(null);
  const [freezingCard, setFreezingCard] = useState(false);

  // SMS Verification State
  const [smsPhone, setSmsPhone] = useState('+91 98765 42019');
  const [smsMessage, setSmsMessage] = useState('');
  const [sendingSms, setSendingSms] = useState(false);
  const [recentAlerts, setRecentAlerts] = useState<AlertRecord[]>([]);

  const loadData = async () => {
    try {
      const [txnsRes, alertsRes] = await Promise.all([
        api.listTransactions('?page=1&page_size=15&risk_band=high,medium'),
        api.listAlerts(),
      ]);
      setRecentFlagged(txnsRes.items);
      setRecentAlerts(alertsRes);

      if (initialTxnId) {
        loadTransactionDetail(initialTxnId);
      } else if (txnsRes.items.length > 0 && !selectedTxn) {
        loadTransactionDetail(txnsRes.items[0].id);
      }
    } catch {
      // ignore
    }
  };

  useEffect(() => {
    loadData();
  }, [initialTxnId]);

  const loadTransactionDetail = async (id: number) => {
    try {
      const res = await api.getTransactionDetail(id);
      setSelectedTxn(res);
      setTxnSearchId(id.toString());
      setActionNotes('');
      setFeedback(null);

      // Pre-fill default SMS alert message
      setSmsMessage(
        `[FraudSentinel Security Alert] Transaction of INR ${res.amount.toFixed(
          2
        )} on your card flagged for verification. Reply YES if authorized or NO to freeze.`
      );

      // Fetch customer card
      try {
        const cardRes = await api.getCard(res.external_customer_id);
        setCustomerCard(cardRes);
      } catch {
        setCustomerCard(null);
      }
    } catch (err: unknown) {
      if (err instanceof Error) {
        setFeedback({ message: err.message, type: 'alert' });
      }
    }
  };

  const handleExecuteAction = async (action: TransactionAction) => {
    if (!selectedTxn) return;
    setSubmittingAction(true);
    setFeedback(null);
    try {
      const updated = await api.executeTransactionAction(
        selectedTxn.id,
        action,
        actionNotes || `Prevention Center Analyst Action: ${action.toUpperCase()}`
      );
      setSelectedTxn(updated);
      setFeedback({
        message: `Transaction #${selectedTxn.id} successfully marked as ${action.toUpperCase()}. Audit log updated.`,
        type: 'success',
      });

      // Reload card if action was block (which freezes card)
      if (action === 'block') {
        const cardRes = await api.getCard(selectedTxn.external_customer_id);
        setCustomerCard(cardRes);
      }
      loadData();
    } catch (err: unknown) {
      if (err instanceof Error) {
        setFeedback({ message: err.message, type: 'alert' });
      }
    } finally {
      setSubmittingAction(false);
    }
  };

  const handleToggleFreezeCard = async () => {
    if (!customerCard) return;
    setFreezingCard(true);
    try {
      const reason = customerCard.status === 'frozen' ? 'Analyst unfreeze authorization' : 'Fraud prevention freeze';
      const updated = await api.toggleCardFreeze(customerCard.id, reason);
      setCustomerCard(updated);
      setFeedback({
        message: `Card ${updated.card_number_masked} status updated to ${updated.status.toUpperCase()}.`,
        type: 'success',
      });
    } catch (err: unknown) {
      if (err instanceof Error) {
        setFeedback({ message: err.message, type: 'alert' });
      }
    } finally {
      setFreezingCard(false);
    }
  };

  const handleSendVerificationSms = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!selectedTxn) return;
    setSendingSms(true);
    try {
      await api.sendVerificationSms({
        transaction_id: selectedTxn.id,
        phone: smsPhone,
        custom_message: smsMessage,
      });
      setFeedback({
        message: `Real-time SMS dispatched to ${smsPhone}. Delivery status: DELIVERED.`,
        type: 'success',
      });
      const alerts = await api.listAlerts();
      setRecentAlerts(alerts);
    } catch (err: unknown) {
      if (err instanceof Error) {
        setFeedback({ message: err.message, type: 'alert' });
      }
    } finally {
      setSendingSms(false);
    }
  };

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex flex-col md:flex-row md:items-center md:justify-between gap-4 pb-3 border-b border-deep-aubergine-border">
        <div>
          <div className="flex items-center gap-2.5">
            <h1 className="text-xl sm:text-2xl font-bold text-ice-silver tracking-tight">
              Transaction Prevention & Decision Center
            </h1>
            <span className="text-[10px] font-mono px-2 py-0.5 rounded bg-deep-aubergine-surface text-marigold border border-deep-aubergine-border font-medium">
              Intervention Hub
            </span>
          </div>
          <p className="text-xs text-soft-silver mt-1">
            Execute decisive bank actions (Approve, Hold, Block), enforce card freeze protocols, and dispatch real-time 2-way verification SMS
          </p>
        </div>

        <button
          onClick={loadData}
          className="self-start md:self-auto flex items-center gap-2 px-3 py-1.5 rounded-lg bg-deep-aubergine-surface hover:bg-deep-aubergine-card text-ice-silver text-xs border border-deep-aubergine-border transition-colors"
        >
          <RefreshCw className="w-3.5 h-3.5 text-marigold" />
          <span>Refresh Actions</span>
        </button>
      </div>

      {feedback && (
        <div
          className={`p-3.5 rounded-lg text-xs flex items-center gap-2.5 ${
            feedback.type === 'success'
              ? 'bg-emerald-950/60 border border-emerald-800/60 text-emerald-300'
              : 'bg-red-950/60 border border-red-800/60 text-red-300'
          }`}
        >
          {feedback.type === 'success' ? (
            <CheckCircle2 className="w-4 h-4 shrink-0 text-emerald-400" />
          ) : (
            <AlertTriangle className="w-4 h-4 shrink-0 text-red-400" />
          )}
          <span>{feedback.message}</span>
        </div>
      )}

      {/* Main Grid */}
      <div className="grid grid-cols-1 lg:grid-cols-12 gap-6">
        {/* Left: Transaction Selector & Prevention Action Console (7 cols) */}
        <div className="lg:col-span-7 space-y-6">
          {/* Target Transaction Card */}
          <div className="bg-deep-aubergine-card border border-deep-aubergine-border rounded-xl p-5 shadow-subtle space-y-4">
            <div className="flex items-center justify-between pb-3 border-b border-deep-aubergine-border">
              <div className="flex items-center gap-2">
                <CreditCard className="w-4 h-4 text-marigold" />
                <h2 className="text-xs font-bold text-ice-silver uppercase tracking-wider">
                  Target Transaction for Prevention
                </h2>
              </div>

              {/* Txn ID manual lookup & Quick select */}
              <div className="flex items-center gap-2">
                {recentFlagged.length > 0 && (
                  <select
                    value={selectedTxn?.id || ''}
                    onChange={(e) => {
                      const id = parseInt(e.target.value, 10);
                      if (!isNaN(id)) loadTransactionDetail(id);
                    }}
                    className="bg-deep-aubergine-dark border border-deep-aubergine-border rounded px-2 py-1 text-xs text-ice-silver focus:outline-none focus:border-marigold max-w-[140px] truncate"
                  >
                    <option value="" disabled>Flagged Txns</option>
                    {recentFlagged.map((t) => (
                      <option key={t.id} value={t.id}>
                        #{t.id} - ₹{t.amount} ({t.channel})
                      </option>
                    ))}
                  </select>
                )}
                <input
                  type="text"
                  value={txnSearchId}
                  onChange={(e) => setTxnSearchId(e.target.value)}
                  placeholder="Txn ID"
                  className="bg-deep-aubergine-dark border border-deep-aubergine-border rounded px-2 py-1 text-xs text-ice-silver font-mono w-16 focus:outline-none focus:border-marigold"
                />
                <button
                  onClick={() => {
                    const id = parseInt(txnSearchId, 10);
                    if (!isNaN(id)) loadTransactionDetail(id);
                  }}
                  className="px-2.5 py-1 rounded bg-deep-aubergine-surface text-marigold text-xs font-medium border border-deep-aubergine-border hover:bg-deep-aubergine-border"
                >
                  Load
                </button>
              </div>
            </div>

            {selectedTxn ? (
              <div className="space-y-4">
                <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 text-xs">
                  <div className="bg-deep-aubergine-surface/70 p-2.5 rounded-lg border border-deep-aubergine-border">
                    <div className="text-muted-lavender text-[10px]">Amount</div>
                    <div className="text-base font-bold text-ice-silver font-mono">
                      ₹{selectedTxn.amount.toLocaleString('en-IN', { minimumFractionDigits: 2 })}
                    </div>
                  </div>

                  <div className="bg-deep-aubergine-surface/70 p-2.5 rounded-lg border border-deep-aubergine-border">
                    <div className="text-muted-lavender text-[10px]">Customer</div>
                    <div className="text-xs font-semibold text-ice-silver font-mono truncate">
                      {selectedTxn.external_customer_id}
                    </div>
                  </div>

                  <div className="bg-deep-aubergine-surface/70 p-2.5 rounded-lg border border-deep-aubergine-border">
                    <div className="text-muted-lavender text-[10px]">Channel</div>
                    <div className="text-xs font-semibold text-ice-silver uppercase">{selectedTxn.channel}</div>
                  </div>

                  <div className="bg-deep-aubergine-surface/70 p-2.5 rounded-lg border border-deep-aubergine-border">
                    <div className="text-muted-lavender text-[10px]">ML Risk</div>
                    <div className="mt-0.5">
                      {selectedTxn.prediction && (
                        <RiskBadge
                          band={selectedTxn.prediction.risk_band}
                          score={selectedTxn.prediction.calibrated_score}
                          size="sm"
                        />
                      )}
                    </div>
                  </div>
                </div>

                {/* Analyst Notes Input */}
                <div>
                  <label className="block text-xs font-medium text-soft-silver mb-1.5">
                    Analyst Prevention Justification & Policy Notes
                  </label>
                  <textarea
                    value={actionNotes}
                    onChange={(e) => setActionNotes(e.target.value)}
                    rows={2}
                    placeholder="Enter reason for approval, hold, or fraud block..."
                    className="w-full bg-deep-aubergine-dark border border-deep-aubergine-border rounded-lg p-2.5 text-xs text-ice-silver placeholder-slate-grey focus:outline-none focus:border-marigold"
                  />
                </div>

                {/* The 4 Core Prevention Action Buttons */}
                <div className="grid grid-cols-2 sm:grid-cols-4 gap-2 pt-1">
                  {/* Approve */}
                  <button
                    onClick={() => handleExecuteAction('approve')}
                    disabled={submittingAction}
                    className="py-2.5 px-3 rounded-lg bg-emerald-950/60 hover:bg-emerald-900/60 text-emerald-300 border border-emerald-800/60 text-xs font-semibold flex items-center justify-center gap-1.5 transition-all shadow-subtle disabled:opacity-50"
                  >
                    <ShieldCheck className="w-3.5 h-3.5 text-emerald-400" />
                    <span>Approve (Clear)</span>
                  </button>

                  {/* Hold */}
                  <button
                    onClick={() => handleExecuteAction('hold')}
                    disabled={submittingAction}
                    className="py-2.5 px-3 rounded-lg bg-amber-950/60 hover:bg-amber-900/60 text-amber-300 border border-amber-800/60 text-xs font-semibold flex items-center justify-center gap-1.5 transition-all shadow-subtle disabled:opacity-50"
                  >
                    <Clock className="w-3.5 h-3.5 text-amber-400" />
                    <span>Place on Hold</span>
                  </button>

                  {/* Block */}
                  <button
                    onClick={() => handleExecuteAction('block')}
                    disabled={submittingAction}
                    className="py-2.5 px-3 rounded-lg bg-red-950/70 hover:bg-red-900/70 text-red-300 border border-red-800/70 text-xs font-semibold flex items-center justify-center gap-1.5 transition-all shadow-subtle disabled:opacity-50"
                  >
                    <Ban className="w-3.5 h-3.5 text-red-400" />
                    <span>Block & Freeze</span>
                  </button>

                  {/* Flag */}
                  <button
                    onClick={() => handleExecuteAction('flag')}
                    disabled={submittingAction}
                    className="py-2.5 px-3 rounded-lg bg-deep-aubergine-surface hover:bg-deep-aubergine-border text-marigold border border-deep-aubergine-border text-xs font-semibold flex items-center justify-center gap-1.5 transition-all shadow-subtle disabled:opacity-50"
                  >
                    <Flag className="w-3.5 h-3.5 text-marigold" />
                    <span>Flag for Review</span>
                  </button>
                </div>
              </div>
            ) : (
              <p className="text-xs text-slate-grey italic">Select a transaction to take prevention action.</p>
            )}
          </div>

          {/* Customer Card Security & Freeze Controls */}
          <div className="bg-deep-aubergine-card border border-deep-aubergine-border rounded-xl p-5 shadow-subtle space-y-4">
            <div className="flex items-center justify-between pb-3 border-b border-deep-aubergine-border">
              <div className="flex items-center gap-2">
                <CreditCard className="w-4 h-4 text-marigold" />
                <h3 className="text-xs font-bold text-ice-silver uppercase tracking-wider">
                  Customer Card Security & Freeze Status
                </h3>
              </div>
              {customerCard && (
                <span
                  className={`text-[10px] font-mono font-bold uppercase px-2 py-0.5 rounded border ${
                    customerCard.status === 'frozen'
                      ? 'bg-amber-950/60 text-amber-300 border-amber-800/60'
                      : customerCard.status === 'blocked'
                      ? 'bg-red-950/60 text-red-300 border-red-800/60'
                      : 'bg-emerald-950/60 text-emerald-300 border-emerald-800/60'
                  }`}
                >
                  CARD {customerCard.status}
                </span>
              )}
            </div>

            {customerCard ? (
              <div className="space-y-3">
                <div className="grid grid-cols-2 sm:grid-cols-3 gap-3 text-xs">
                  <div className="bg-deep-aubergine-surface/70 p-2.5 rounded-lg border border-deep-aubergine-border">
                    <div className="text-muted-lavender text-[10px]">Masked Card</div>
                    <div className="font-mono font-bold text-ice-silver">{customerCard.card_number_masked}</div>
                  </div>
                  <div className="bg-deep-aubergine-surface/70 p-2.5 rounded-lg border border-deep-aubergine-border">
                    <div className="text-muted-lavender text-[10px]">Card Product</div>
                    <div className="font-semibold text-soft-silver">{customerCard.card_type}</div>
                  </div>
                  <div className="bg-deep-aubergine-surface/70 p-2.5 rounded-lg border border-deep-aubergine-border">
                    <div className="text-muted-lavender text-[10px]">Daily Limit</div>
                    <div className="font-mono font-bold text-ice-silver">
                      ₹{customerCard.daily_limit.toLocaleString('en-IN')}
                    </div>
                  </div>
                </div>

                {customerCard.last_freeze_reason && (
                  <p className="text-[11px] text-amber-300 bg-amber-950/40 border border-amber-800/40 p-2.5 rounded-lg italic">
                    Freeze Reason: {customerCard.last_freeze_reason}
                  </p>
                )}

                <div className="flex items-center gap-3 pt-1">
                  <button
                    onClick={handleToggleFreezeCard}
                    disabled={freezingCard || customerCard.status === 'blocked'}
                    className={`py-2 px-3.5 rounded-lg text-xs font-semibold flex items-center gap-2 border transition-all ${
                      customerCard.status === 'frozen'
                        ? 'bg-emerald-950/60 hover:bg-emerald-900/60 text-emerald-300 border-emerald-800/60'
                        : 'bg-amber-950/60 hover:bg-amber-900/60 text-amber-300 border-amber-800/60'
                    }`}
                  >
                    {customerCard.status === 'frozen' ? (
                      <>
                        <Unlock className="w-3.5 h-3.5 text-emerald-400" />
                        <span>Unfreeze Card</span>
                      </>
                    ) : (
                      <>
                        <Lock className="w-3.5 h-3.5 text-amber-400" />
                        <span>Freeze Customer Card</span>
                      </>
                    )}
                  </button>

                  <span className="text-[11px] text-slate-grey">
                    Freezing prevents all POS, Online, and ATM transactions immediately.
                  </span>
                </div>
              </div>
            ) : (
              <p className="text-xs text-slate-grey italic">No card record found for current customer.</p>
            )}
          </div>
        </div>

        {/* Right: Real-Time Outbound SMS Step-Up Verification (5 cols) */}
        <div className="lg:col-span-5 space-y-6">
          <div className="bg-deep-aubergine-card border border-deep-aubergine-border rounded-xl p-5 shadow-subtle space-y-4">
            <div className="flex items-center justify-between pb-3 border-b border-deep-aubergine-border">
              <div className="flex items-center gap-2">
                <Smartphone className="w-4 h-4 text-marigold" />
                <h3 className="text-xs font-bold text-ice-silver uppercase tracking-wider">
                  Outbound Real-Time SMS Dispatch
                </h3>
              </div>
              <span className="text-[10px] font-mono text-emerald-400 uppercase">Live Gateway</span>
            </div>

            <form onSubmit={handleSendVerificationSms} className="space-y-3">
              <div>
                <label className="block text-[11px] font-medium text-soft-silver mb-1">Cardholder Phone Number</label>
                <input
                  type="text"
                  value={smsPhone}
                  onChange={(e) => setSmsPhone(e.target.value)}
                  required
                  className="w-full bg-deep-aubergine-dark border border-deep-aubergine-border rounded-lg px-3 py-1.5 text-xs font-mono text-ice-silver focus:outline-none focus:border-marigold"
                />
              </div>

              <div>
                <label className="block text-[11px] font-medium text-soft-silver mb-1">Security Alert Message</label>
                <textarea
                  value={smsMessage}
                  onChange={(e) => setSmsMessage(e.target.value)}
                  rows={3}
                  required
                  className="w-full bg-deep-aubergine-dark border border-deep-aubergine-border rounded-lg p-2 text-xs text-ice-silver focus:outline-none focus:border-marigold leading-relaxed"
                />
              </div>

              <button
                type="submit"
                disabled={sendingSms || !selectedTxn}
                className="w-full py-2 px-3 rounded-lg bg-deep-aubergine-surface hover:bg-deep-aubergine-card text-marigold text-xs font-semibold border border-deep-aubergine-border flex items-center justify-center gap-2 transition-all disabled:opacity-50"
              >
                <Send className="w-3.5 h-3.5" />
                <span>{sendingSms ? 'Dispatching SMS...' : 'Dispatch Verification SMS'}</span>
              </button>
            </form>
          </div>

          {/* Outbound SMS Verification History Log */}
          <div className="bg-deep-aubergine-card border border-deep-aubergine-border rounded-xl p-5 shadow-subtle space-y-3">
            <div className="flex items-center justify-between pb-2 border-b border-deep-aubergine-border">
              <h4 className="text-xs font-bold text-ice-silver uppercase tracking-wider">
                SMS Delivery & Response Log
              </h4>
              <span className="text-[11px] text-slate-grey">Real-Time Trace</span>
            </div>

            <div className="space-y-2.5 max-h-72 overflow-y-auto pr-1">
              {recentAlerts.length === 0 ? (
                <p className="text-xs text-slate-grey italic text-center py-4">No outbound alerts recorded.</p>
              ) : (
                recentAlerts.map((al) => (
                  <div
                    key={al.id}
                    className="p-2.5 rounded-lg bg-deep-aubergine-surface/60 border border-deep-aubergine-border text-xs space-y-1.5"
                  >
                    <div className="flex items-center justify-between">
                      <span className="font-mono text-[11px] text-ice-silver font-semibold">
                        Txn #{al.transaction_id} · {al.external_customer_id}
                      </span>
                      <span className="text-[10px] font-mono uppercase px-1.5 py-0.2 rounded bg-emerald-950/60 text-emerald-400 border border-emerald-800/40">
                        {al.status}
                      </span>
                    </div>

                    <p className="text-[11px] text-soft-silver italic bg-deep-aubergine-dark/60 p-2 rounded border border-deep-aubergine-border/40">
                      &quot;{al.message}&quot;
                    </p>

                    <div className="flex items-center justify-between text-[10px] text-slate-grey font-mono pt-0.5">
                      <span>{new Date(al.created_at).toLocaleTimeString()}</span>
                      <span>
                        Response:{' '}
                        <span
                          className={`font-semibold ${
                            al.customer_response === 'yes_me'
                              ? 'text-emerald-400'
                              : al.customer_response === 'not_me'
                              ? 'text-red-400'
                              : 'text-amber-400'
                          }`}
                        >
                          {al.customer_response || 'Pending Response'}
                        </span>
                      </span>
                    </div>
                  </div>
                ))
              )}
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};

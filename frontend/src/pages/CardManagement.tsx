import React, { useState, useEffect, useCallback } from 'react';
import {
  CreditCard,
  Lock,
  Unlock,
  Ban,
  Search,
  RefreshCw,
  AlertCircle,
  CheckCircle2,
  Sliders,
  Globe,
  Wifi,
} from 'lucide-react';
import { api } from '../api/client';
import type { CardRecord } from '../types';

export const CardManagement: React.FC = () => {
  const [cards, setCards] = useState<CardRecord[]>([]);
  const [total, setTotal] = useState(0);
  const [page, setPage] = useState(1);
  const [pageSize] = useState(20);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [search, setSearch] = useState('');
  const [statusFilter, setStatusFilter] = useState<string>('');
  const [actionFeedback, setActionFeedback] = useState<string | null>(null);

  // Edit Limit Modal State
  const [editingCard, setEditingCard] = useState<CardRecord | null>(null);
  const [editDailyLimit, setEditDailyLimit] = useState('');
  const [editInternational, setEditInternational] = useState(true);
  const [editOnline, setEditOnline] = useState(true);
  const [savingSettings, setSavingSettings] = useState(false);

  const loadCards = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const q = new URLSearchParams();
      q.set('page', page.toString());
      q.set('page_size', pageSize.toString());
      if (statusFilter) q.set('status', statusFilter);
      if (search) q.set('search', search);

      const res = await api.listCards(`?${q.toString()}`);
      setCards(res.items);
      setTotal(res.total);
    } catch (err: unknown) {
      if (err instanceof Error) {
        setError(err.message);
      } else {
        setError('Failed to load card records');
      }
    } finally {
      setLoading(false);
    }
  }, [page, pageSize, statusFilter, search]);

  useEffect(() => {
    loadCards();
  }, [loadCards]);

  const handleToggleFreeze = async (card: CardRecord) => {
    const isFrozen = card.status === 'frozen';
    const reason = isFrozen ? 'Analyst verified unfreeze' : 'Fraud risk freeze initiated';
    try {
      const updated = await api.toggleCardFreeze(card.id, reason);
      setActionFeedback(`Card ${updated.card_number_masked} status changed to ${updated.status.toUpperCase()}.`);
      loadCards();
    } catch (err: unknown) {
      if (err instanceof Error) setError(err.message);
    }
  };

  const handleBlockCard = async (card: CardRecord) => {
    if (!window.confirm(`Are you sure you want to permanently BLOCK card ${card.card_number_masked}?`)) return;
    try {
      const updated = await api.blockCard(card.id, 'Permanent block due to confirmed compromise');
      setActionFeedback(`Card ${updated.card_number_masked} has been PERMANENTLY BLOCKED.`);
      loadCards();
    } catch (err: unknown) {
      if (err instanceof Error) setError(err.message);
    }
  };

  const handleOpenEditSettings = (card: CardRecord) => {
    setEditingCard(card);
    setEditDailyLimit(card.daily_limit.toString());
    setEditInternational(card.international_enabled);
    setEditOnline(card.online_enabled);
  };

  const handleSaveSettings = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!editingCard) return;
    setSavingSettings(true);
    try {
      await api.updateCardSettings(editingCard.id, {
        daily_limit: parseFloat(editDailyLimit) || undefined,
        international_enabled: editInternational,
        online_enabled: editOnline,
      });
      setActionFeedback(`Settings updated for ${editingCard.card_number_masked}.`);
      setEditingCard(null);
      loadCards();
    } catch (err: unknown) {
      if (err instanceof Error) setError(err.message);
    } finally {
      setSavingSettings(false);
    }
  };

  const activeCount = cards.filter((c) => c.status === 'active').length;
  const frozenCount = cards.filter((c) => c.status === 'frozen').length;
  const blockedCount = cards.filter((c) => c.status === 'blocked').length;

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex flex-col md:flex-row md:items-center md:justify-between gap-4 pb-3 border-b border-deep-aubergine-border">
        <div>
          <div className="flex items-center gap-2.5">
            <h1 className="text-xl sm:text-2xl font-bold text-ice-silver tracking-tight">
              Card Portfolio & Security Management
            </h1>
            <span className="text-[10px] font-mono px-2 py-0.5 rounded bg-deep-aubergine-surface text-marigold border border-deep-aubergine-border font-medium">
              Zero PAN Architecture
            </span>
          </div>
          <p className="text-xs text-soft-silver mt-1">
            Enterprise card inventory, masked identifiers, transaction velocity limits, and real-time freeze controls
          </p>
        </div>

        <button
          onClick={loadCards}
          disabled={loading}
          className="self-start md:self-auto flex items-center gap-2 px-3 py-1.5 rounded-lg bg-deep-aubergine-surface hover:bg-deep-aubergine-card text-ice-silver text-xs border border-deep-aubergine-border transition-colors"
        >
          <RefreshCw className={`w-3.5 h-3.5 text-marigold ${loading ? 'animate-spin' : ''}`} />
          <span>Refresh Portfolio</span>
        </button>
      </div>

      {actionFeedback && (
        <div className="p-3.5 rounded-lg bg-emerald-950/60 border border-emerald-800/60 text-emerald-300 text-xs flex items-center justify-between">
          <div className="flex items-center gap-2">
            <CheckCircle2 className="w-4 h-4 text-emerald-400" />
            <span>{actionFeedback}</span>
          </div>
          <button onClick={() => setActionFeedback(null)} className="text-emerald-400 font-bold ml-2">
            ×
          </button>
        </div>
      )}

      {error && (
        <div className="p-3.5 rounded-lg bg-red-950/60 border border-red-800/60 text-red-300 text-xs flex items-center gap-2">
          <AlertCircle className="w-4 h-4 shrink-0" />
          <span>{error}</span>
        </div>
      )}

      {/* KPI Cards */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
        <div className="bg-deep-aubergine-card border border-deep-aubergine-border rounded-xl p-4 shadow-subtle">
          <div className="text-xs text-muted-lavender font-medium mb-1 flex items-center justify-between">
            <span>Portfolio Cards</span>
            <CreditCard className="w-4 h-4 text-slate-grey" />
          </div>
          <div className="text-2xl font-bold text-ice-silver font-mono">{total}</div>
          <div className="text-[11px] text-soft-silver mt-0.5">Total registered customer cards</div>
        </div>

        <div className="bg-deep-aubergine-card border border-deep-aubergine-border rounded-xl p-4 shadow-subtle">
          <div className="text-xs text-muted-lavender font-medium mb-1 flex items-center justify-between">
            <span>Active Operational</span>
            <CheckCircle2 className="w-4 h-4 text-emerald-400" />
          </div>
          <div className="text-2xl font-bold text-emerald-400 font-mono">{activeCount}</div>
          <div className="text-[11px] text-emerald-400/80 mt-0.5">Full processing authorization</div>
        </div>

        <div className="bg-deep-aubergine-card border border-deep-aubergine-border rounded-xl p-4 shadow-subtle">
          <div className="text-xs text-muted-lavender font-medium mb-1 flex items-center justify-between">
            <span>Temporarily Frozen</span>
            <Lock className="w-4 h-4 text-amber-400" />
          </div>
          <div className="text-2xl font-bold text-amber-400 font-mono">{frozenCount}</div>
          <div className="text-[11px] text-amber-300/80 mt-0.5">Fraud review step-up active</div>
        </div>

        <div className="bg-deep-aubergine-card border border-deep-aubergine-border rounded-xl p-4 shadow-subtle">
          <div className="text-xs text-muted-lavender font-medium mb-1 flex items-center justify-between">
            <span>Permanently Blocked</span>
            <Ban className="w-4 h-4 text-red-400" />
          </div>
          <div className="text-2xl font-bold text-red-400 font-mono">{blockedCount}</div>
          <div className="text-[11px] text-red-300/80 mt-0.5">Confirmed compromise lock</div>
        </div>
      </div>

      {/* Filter and Search Bar */}
      <div className="bg-deep-aubergine-card border border-deep-aubergine-border rounded-xl p-4 shadow-subtle flex flex-col md:flex-row md:items-center justify-between gap-3">
        <div className="relative flex-1">
          <Search className="w-4 h-4 absolute left-3 top-2.5 text-slate-grey" />
          <input
            type="text"
            value={search}
            onChange={(e) => {
              setSearch(e.target.value);
              setPage(1);
            }}
            placeholder="Search by Customer ID (cust_...) or Masked Card Number..."
            className="w-full bg-deep-aubergine-dark border border-deep-aubergine-border rounded-lg pl-9 pr-3 py-2 text-xs text-ice-silver placeholder-slate-grey focus:outline-none focus:border-marigold"
          />
        </div>

        <div className="flex items-center gap-2 text-xs">
          <span className="text-muted-lavender">Status:</span>
          {['', 'active', 'frozen', 'blocked'].map((st) => (
            <button
              key={st}
              onClick={() => {
                setStatusFilter(st);
                setPage(1);
              }}
              className={`px-2.5 py-1 rounded font-medium capitalize transition-all ${
                statusFilter === st
                  ? 'bg-deep-aubergine-surface text-marigold border border-deep-aubergine-border'
                  : 'bg-deep-aubergine-dark text-soft-silver border border-deep-aubergine-border/60 hover:text-ice-silver'
              }`}
            >
              {st || 'All'}
            </button>
          ))}
        </div>
      </div>

      {/* Cards Table */}
      <div className="bg-deep-aubergine-card border border-deep-aubergine-border rounded-xl shadow-subtle overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full text-left text-xs">
            <thead className="bg-deep-aubergine-surface/70 text-slate-grey uppercase text-[10px] tracking-wider border-b border-deep-aubergine-border">
              <tr>
                <th className="px-4 py-3">Masked Card Number</th>
                <th className="px-4 py-3">Customer ID</th>
                <th className="px-4 py-3">Card Product</th>
                <th className="px-4 py-3">Status</th>
                <th className="px-4 py-3">Daily Limit</th>
                <th className="px-4 py-3">Channels</th>
                <th className="px-4 py-3">Last Freeze Reason</th>
                <th className="px-4 py-3 text-right">Security Actions</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-deep-aubergine-border/50 text-xs">
              {loading ? (
                <tr>
                  <td colSpan={8} className="py-12 text-center text-slate-grey font-sans">
                    <div className="flex items-center justify-center gap-2">
                      <div className="animate-spin rounded-full h-4 w-4 border-b-2 border-marigold" />
                      <span>Loading card portfolio...</span>
                    </div>
                  </td>
                </tr>
              ) : cards.length === 0 ? (
                <tr>
                  <td colSpan={8} className="py-12 text-center text-slate-grey">
                    No card records found.
                  </td>
                </tr>
              ) : (
                cards.map((c) => {
                  return (
                    <tr key={c.id} className="hover:bg-deep-aubergine-surface/40 transition-colors">
                      {/* Masked Card Number */}
                      <td className="px-4 py-3 font-mono font-bold text-ice-silver flex items-center gap-2">
                        <CreditCard className="w-4 h-4 text-marigold" />
                        <span>{c.card_number_masked}</span>
                      </td>

                      {/* Customer ID */}
                      <td className="px-4 py-3 font-mono text-soft-silver">{c.external_customer_id}</td>

                      {/* Product */}
                      <td className="px-4 py-3 text-ice-silver">{c.card_type}</td>

                      {/* Status */}
                      <td className="px-4 py-3">
                        <span
                          className={`inline-block text-[10px] font-mono uppercase font-semibold px-2 py-0.5 rounded border ${
                            c.status === 'active'
                              ? 'bg-emerald-950/60 text-emerald-300 border-emerald-800/60'
                              : c.status === 'frozen'
                              ? 'bg-amber-950/60 text-amber-300 border-amber-800/60'
                              : 'bg-red-950/60 text-red-300 border-red-800/60'
                          }`}
                        >
                          {c.status}
                        </span>
                      </td>

                      {/* Daily Limit */}
                      <td className="px-4 py-3 font-mono text-ice-silver">
                        ₹{c.daily_limit.toLocaleString('en-IN', { minimumFractionDigits: 0 })}
                      </td>

                      {/* Channel Permissions */}
                      <td className="px-4 py-3">
                        <div className="flex items-center gap-2 text-[10px]">
                          <span
                            className={`flex items-center gap-1 ${
                              c.online_enabled ? 'text-emerald-400' : 'text-slate-grey line-through'
                            }`}
                          >
                            <Wifi className="w-3 h-3" /> Online
                          </span>
                          <span
                            className={`flex items-center gap-1 ${
                              c.international_enabled ? 'text-emerald-400' : 'text-slate-grey line-through'
                            }`}
                          >
                            <Globe className="w-3 h-3" /> Int&apos;l
                          </span>
                        </div>
                      </td>

                      {/* Freeze Reason */}
                      <td className="px-4 py-3 text-[11px] text-muted-lavender italic truncate max-w-[160px]">
                        {c.last_freeze_reason || '—'}
                      </td>

                      {/* Actions */}
                      <td className="px-4 py-3 text-right">
                        <div className="flex items-center justify-end gap-1.5">
                          {c.status !== 'blocked' && (
                            <button
                              onClick={() => handleToggleFreeze(c)}
                              title={c.status === 'frozen' ? 'Unfreeze Card' : 'Freeze Card'}
                              className={`p-1.5 rounded border transition-colors ${
                                c.status === 'frozen'
                                  ? 'bg-emerald-950/60 text-emerald-300 border-emerald-800/60 hover:bg-emerald-900/60'
                                  : 'bg-amber-950/60 text-amber-300 border-amber-800/60 hover:bg-amber-900/60'
                              }`}
                            >
                              {c.status === 'frozen' ? <Unlock className="w-3.5 h-3.5" /> : <Lock className="w-3.5 h-3.5" />}
                            </button>
                          )}

                          <button
                            onClick={() => handleOpenEditSettings(c)}
                            title="Edit Card Limits & Settings"
                            className="p-1.5 rounded bg-deep-aubergine-surface text-soft-silver border border-deep-aubergine-border hover:text-ice-silver transition-colors"
                          >
                            <Sliders className="w-3.5 h-3.5" />
                          </button>

                          {c.status !== 'blocked' && (
                            <button
                              onClick={() => handleBlockCard(c)}
                              title="Permanently Block Card"
                              className="p-1.5 rounded bg-red-950/60 text-red-300 border border-red-800/60 hover:bg-red-900/60 transition-colors"
                            >
                              <Ban className="w-3.5 h-3.5" />
                            </button>
                          )}
                        </div>
                      </td>
                    </tr>
                  );
                })
              )}
            </tbody>
          </table>
        </div>
      </div>

      {/* Edit Limit Modal */}
      {editingCard && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-deep-aubergine-darker/80 backdrop-blur-sm">
          <div className="bg-deep-aubergine-card border border-deep-aubergine-border rounded-xl w-full max-w-md p-6 shadow-elevated">
            <h3 className="text-sm font-bold text-ice-silver mb-3 flex items-center gap-2">
              <Sliders className="w-4 h-4 text-marigold" />
              <span>Modify Settings: {editingCard.card_number_masked}</span>
            </h3>

            <form onSubmit={handleSaveSettings} className="space-y-4 text-xs">
              <div>
                <label className="block text-soft-silver mb-1">Daily Spending Limit (₹ INR)</label>
                <input
                  type="number"
                  value={editDailyLimit}
                  onChange={(e) => setEditDailyLimit(e.target.value)}
                  required
                  className="w-full bg-deep-aubergine-dark border border-deep-aubergine-border rounded-lg p-2 text-ice-silver font-mono focus:border-marigold focus:outline-none"
                />
              </div>

              <div className="space-y-2 pt-1">
                <label className="flex items-center gap-2 cursor-pointer">
                  <input
                    type="checkbox"
                    checked={editOnline}
                    onChange={(e) => setEditOnline(e.target.checked)}
                    className="accent-marigold"
                  />
                  <span className="text-ice-silver">Allow Online E-Commerce Transactions</span>
                </label>

                <label className="flex items-center gap-2 cursor-pointer">
                  <input
                    type="checkbox"
                    checked={editInternational}
                    onChange={(e) => setEditInternational(e.target.checked)}
                    className="accent-marigold"
                  />
                  <span className="text-ice-silver">Allow International Cross-Border Transactions</span>
                </label>
              </div>

              <div className="flex items-center justify-end gap-2 pt-3 border-t border-deep-aubergine-border">
                <button
                  type="button"
                  onClick={() => setEditingCard(null)}
                  className="px-3 py-1.5 rounded bg-deep-aubergine-surface text-soft-silver border border-deep-aubergine-border"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={savingSettings}
                  className="px-3 py-1.5 rounded bg-marigold text-deep-aubergine-dark font-semibold shadow-subtle hover:bg-marigold-light"
                >
                  {savingSettings ? 'Saving...' : 'Save Settings'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
};

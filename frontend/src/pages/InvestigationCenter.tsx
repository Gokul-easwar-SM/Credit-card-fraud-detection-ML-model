import React, { useState, useEffect, useCallback } from 'react';
import {
  UserCheck,
  Search,
  RefreshCw,
  AlertCircle,
  Clock,
  ArrowUpDown,
  ChevronLeft,
  ChevronRight,
  Eye,
  ShieldAlert,
  ShieldCheck,
} from 'lucide-react';
import { api } from '../api/client';
import { RiskBadge } from '../components/RiskBadge';
import { InvestigationDrawer } from '../components/InvestigationDrawer';
import type { InvestigationListItem } from '../types';

export const InvestigationCenter: React.FC = () => {
  const [items, setItems] = useState<InvestigationListItem[]>([]);
  const [total, setTotal] = useState(0);
  const [page, setPage] = useState(1);
  const [pageSize] = useState(15);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // Filters
  const [statusFilter, setStatusFilter] = useState<string>('');
  const [riskBandFilter, setRiskBandFilter] = useState<string>('');
  const [searchQuery, setSearchQuery] = useState('');
  const [sortBy, setSortBy] = useState<'priority_score' | 'occurred_at' | 'amount'>('priority_score');
  const [sortOrder, setSortOrder] = useState<'desc' | 'asc'>('desc');

  // Selected investigation for detail workspace
  const [selectedId, setSelectedId] = useState<number | null>(null);

  const loadInvestigations = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const params = new URLSearchParams();
      params.set('page', page.toString());
      params.set('page_size', pageSize.toString());
      if (statusFilter) params.set('status', statusFilter);
      if (riskBandFilter) params.set('risk_band', riskBandFilter);
      if (searchQuery) params.set('search', searchQuery);
      params.set('sort_by', sortBy);
      params.set('sort_order', sortOrder);

      const res = await api.listInvestigations(`?${params.toString()}`);
      setItems(res.items);
      setTotal(res.total);
    } catch (err: unknown) {
      if (err instanceof Error) {
        setError(err.message);
      } else {
        setError('Failed to fetch investigations queue');
      }
    } finally {
      setLoading(false);
    }
  }, [page, pageSize, statusFilter, riskBandFilter, searchQuery, sortBy, sortOrder]);

  useEffect(() => {
    loadInvestigations();
  }, [loadInvestigations]);

  const pendingCount = items.filter((i) => i.status === 'pending_review').length;
  const inProgressCount = items.filter((i) => i.status === 'under_investigation').length;
  const confirmedFraudCount = items.filter((i) => i.status === 'confirmed_fraud').length;
  const genuineCount = items.filter((i) => i.status === 'marked_genuine').length;

  const totalPages = Math.ceil(total / pageSize) || 1;

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex flex-col md:flex-row md:items-center md:justify-between gap-4 pb-3 border-b border-deep-aubergine-border">
        <div>
          <div className="flex items-center gap-2.5">
            <h1 className="text-xl sm:text-2xl font-bold text-ice-silver tracking-tight">
              Fraud Investigation Center & Analyst Workspace
            </h1>
            <span className="text-[10px] font-mono px-2 py-0.5 rounded bg-deep-aubergine-surface text-marigold border border-deep-aubergine-border font-medium">
              Human-in-the-Loop Triage
            </span>
          </div>
          <p className="text-xs text-soft-silver mt-1">
            Priority-ranked triage queue, TreeSHAP explainability review, decision audit logging, and case resolution
          </p>
        </div>

        <button
          onClick={loadInvestigations}
          disabled={loading}
          className="self-start md:self-auto flex items-center gap-2 px-3 py-1.5 rounded-lg bg-deep-aubergine-surface hover:bg-deep-aubergine-card text-ice-silver text-xs border border-deep-aubergine-border transition-colors"
        >
          <RefreshCw className={`w-3.5 h-3.5 text-marigold ${loading ? 'animate-spin' : ''}`} />
          <span>Refresh Queue</span>
        </button>
      </div>

      {/* KPI Status Summary Cards */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
        <div className="bg-deep-aubergine-card border border-deep-aubergine-border rounded-xl p-4 shadow-subtle">
          <div className="flex items-center justify-between text-muted-lavender text-xs mb-2">
            <span>Pending Review</span>
            <Clock className="w-4 h-4 text-amber-400" />
          </div>
          <div className="text-2xl font-bold text-ice-silver font-mono">{pendingCount}</div>
          <div className="text-[11px] text-amber-400/80 mt-1">Awaiting analyst action</div>
        </div>

        <div className="bg-deep-aubergine-card border border-deep-aubergine-border rounded-xl p-4 shadow-subtle">
          <div className="flex items-center justify-between text-muted-lavender text-xs mb-2">
            <span>In Progress</span>
            <UserCheck className="w-4 h-4 text-marigold" />
          </div>
          <div className="text-2xl font-bold text-marigold font-mono">{inProgressCount}</div>
          <div className="text-[11px] text-soft-silver mt-1">Under investigation</div>
        </div>

        <div className="bg-deep-aubergine-card border border-deep-aubergine-border rounded-xl p-4 shadow-subtle">
          <div className="flex items-center justify-between text-muted-lavender text-xs mb-2">
            <span>Confirmed Fraud</span>
            <ShieldAlert className="w-4 h-4 text-red-400" />
          </div>
          <div className="text-2xl font-bold text-red-400 font-mono">{confirmedFraudCount}</div>
          <div className="text-[11px] text-red-300/80 mt-1">Ground-truth labels recorded</div>
        </div>

        <div className="bg-deep-aubergine-card border border-deep-aubergine-border rounded-xl p-4 shadow-subtle">
          <div className="flex items-center justify-between text-muted-lavender text-xs mb-2">
            <span>Marked Genuine</span>
            <ShieldCheck className="w-4 h-4 text-emerald-400" />
          </div>
          <div className="text-2xl font-bold text-emerald-400 font-mono">{genuineCount}</div>
          <div className="text-[11px] text-emerald-400/80 mt-1">Cleared false positives</div>
        </div>
      </div>

      {/* Filter and Search Bar */}
      <div className="bg-deep-aubergine-card border border-deep-aubergine-border rounded-xl p-4 shadow-subtle space-y-3">
        <div className="flex flex-col md:flex-row md:items-center justify-between gap-3">
          <div className="relative flex-1">
            <Search className="w-4 h-4 absolute left-3 top-2.5 text-slate-grey" />
            <input
              type="text"
              value={searchQuery}
              onChange={(e) => {
                setSearchQuery(e.target.value);
                setPage(1);
              }}
              placeholder="Search by Transaction ID, Customer ID, or Case Notes..."
              className="w-full bg-deep-aubergine-dark border border-deep-aubergine-border rounded-lg pl-9 pr-3 py-2 text-xs text-ice-silver placeholder-slate-grey focus:outline-none focus:border-marigold"
            />
          </div>

          <div className="flex items-center gap-2">
            <ArrowUpDown className="w-3.5 h-3.5 text-slate-grey" />
            <select
              value={sortBy}
              onChange={(e) => setSortBy(e.target.value as 'priority_score' | 'occurred_at' | 'amount')}
              className="bg-deep-aubergine-dark border border-deep-aubergine-border rounded-lg px-2.5 py-1.5 text-xs text-ice-silver focus:outline-none focus:border-marigold"
            >
              <option value="priority_score">Priority Score</option>
              <option value="amount">Amount</option>
              <option value="occurred_at">Transaction Time</option>
            </select>

            <button
              onClick={() => setSortOrder(sortOrder === 'desc' ? 'asc' : 'desc')}
              className="px-2.5 py-1.5 rounded-lg bg-deep-aubergine-dark border border-deep-aubergine-border text-xs text-soft-silver hover:text-ice-silver font-mono"
            >
              {sortOrder.toUpperCase()}
            </button>
          </div>
        </div>

        {/* Filter Pills */}
        <div className="flex flex-wrap items-center gap-2 pt-2 border-t border-deep-aubergine-border/60 text-xs">
          <span className="text-muted-lavender mr-1">Status:</span>
          {[
            { label: 'All', value: '' },
            { label: 'Pending', value: 'pending_review' },
            { label: 'Investigating', value: 'under_investigation' },
            { label: 'Confirmed Fraud', value: 'confirmed_fraud' },
            { label: 'Marked Genuine', value: 'marked_genuine' },
          ].map((st) => (
            <button
              key={st.value}
              onClick={() => {
                setStatusFilter(st.value);
                setPage(1);
              }}
              className={`px-2.5 py-1 rounded font-medium transition-all ${
                statusFilter === st.value
                  ? 'bg-deep-aubergine-surface text-marigold border border-deep-aubergine-border'
                  : 'bg-deep-aubergine-dark text-soft-silver border border-deep-aubergine-border/60 hover:text-ice-silver'
              }`}
            >
              {st.label}
            </button>
          ))}

          <div className="w-px h-4 bg-deep-aubergine-border mx-1 hidden sm:block" />

          <span className="text-muted-lavender mr-1">Risk:</span>
          {[
            { label: 'All', value: '' },
            { label: 'High', value: 'high' },
            { label: 'Medium', value: 'medium' },
            { label: 'Low', value: 'low' },
          ].map((rb) => (
            <button
              key={rb.value}
              onClick={() => {
                setRiskBandFilter(rb.value);
                setPage(1);
              }}
              className={`px-2.5 py-1 rounded font-medium transition-all ${
                riskBandFilter === rb.value
                  ? 'bg-deep-aubergine-surface text-marigold border border-deep-aubergine-border'
                  : 'bg-deep-aubergine-dark text-soft-silver border border-deep-aubergine-border/60 hover:text-ice-silver'
              }`}
            >
              {rb.label}
            </button>
          ))}
        </div>
      </div>

      {error && (
        <div className="p-3.5 rounded-lg bg-red-950/60 border border-red-800/60 text-red-300 text-xs flex items-center gap-2">
          <AlertCircle className="w-4 h-4 shrink-0" />
          <span>{error}</span>
        </div>
      )}

      {/* Investigations Table */}
      <div className="bg-deep-aubergine-card border border-deep-aubergine-border rounded-xl shadow-subtle overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full text-left text-xs">
            <thead className="bg-deep-aubergine-surface/70 text-slate-grey uppercase text-[10px] tracking-wider border-b border-deep-aubergine-border">
              <tr>
                <th className="px-4 py-3 text-center">Priority</th>
                <th className="px-4 py-3">Txn ID / Time</th>
                <th className="px-4 py-3">Customer ID</th>
                <th className="px-4 py-3">Channel</th>
                <th className="px-4 py-3">Amount (INR)</th>
                <th className="px-4 py-3">ML Assessment</th>
                <th className="px-4 py-3">Status</th>
                <th className="px-4 py-3">Analyst</th>
                <th className="px-4 py-3 text-right">Workspace</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-deep-aubergine-border/50 text-xs font-mono">
              {loading ? (
                <tr>
                  <td colSpan={9} className="py-12 text-center text-slate-grey font-sans">
                    <div className="flex items-center justify-center gap-2">
                      <div className="animate-spin rounded-full h-4 w-4 border-b-2 border-marigold" />
                      <span>Loading investigation cases...</span>
                    </div>
                  </td>
                </tr>
              ) : items.length === 0 ? (
                <tr>
                  <td colSpan={9} className="py-12 text-center text-slate-grey font-sans">
                    No investigations match current filter criteria.
                  </td>
                </tr>
              ) : (
                items.map((item) => (
                  <tr
                    key={item.id}
                    className="hover:bg-deep-aubergine-surface/40 transition-colors cursor-pointer"
                    onClick={() => setSelectedId(item.id)}
                  >
                    {/* Priority Score */}
                    <td className="px-4 py-3 text-center">
                      <span
                        className={`inline-block font-mono font-bold px-2 py-0.5 rounded text-[11px] ${
                          item.priority_score >= 80
                            ? 'bg-red-950/60 text-red-300 border border-red-800/60'
                            : item.priority_score >= 50
                            ? 'bg-amber-950/60 text-amber-300 border border-amber-800/60'
                            : 'bg-deep-aubergine-surface text-soft-silver'
                        }`}
                      >
                        {item.priority_score.toFixed(1)}
                      </span>
                    </td>

                    {/* Txn ID / Time */}
                    <td className="px-4 py-3 font-sans">
                      <div className="font-mono text-ice-silver font-medium truncate max-w-[140px]">
                        {item.external_txn_id}
                      </div>
                      <div className="text-[10px] text-slate-grey font-mono">
                        {new Date(item.occurred_at).toLocaleTimeString('en-IN', { hour12: false })}{' '}
                        <span>({new Date(item.occurred_at).toLocaleDateString()})</span>
                      </div>
                    </td>

                    {/* Customer */}
                    <td className="px-4 py-3 text-soft-silver">{item.external_customer_id}</td>

                    {/* Channel */}
                    <td className="px-4 py-3 uppercase text-[11px] text-slate-grey">{item.channel}</td>

                    {/* Amount */}
                    <td className="px-4 py-3 font-bold text-ice-silver">
                      ₹{item.amount.toLocaleString('en-IN', { minimumFractionDigits: 2 })}
                    </td>

                    {/* ML Assessment */}
                    <td className="px-4 py-3 font-sans">
                      <RiskBadge band={item.risk_band} score={item.calibrated_score} size="sm" />
                    </td>

                    {/* Status */}
                    <td className="px-4 py-3 font-sans">
                      <span
                        className={`inline-block text-[10px] font-semibold uppercase px-2 py-0.5 rounded border ${
                          item.status === 'confirmed_fraud'
                            ? 'bg-red-950/60 text-red-300 border-red-800/60'
                            : item.status === 'marked_genuine'
                            ? 'bg-emerald-950/60 text-emerald-300 border-emerald-800/60'
                            : item.status === 'under_investigation'
                            ? 'bg-amber-950/60 text-amber-300 border-amber-800/60'
                            : 'bg-deep-aubergine-surface text-soft-silver border-deep-aubergine-border'
                        }`}
                      >
                        {item.status.replace(/_/g, ' ')}
                      </span>
                    </td>

                    {/* Analyst */}
                    <td className="px-4 py-3 text-muted-lavender text-[11px] font-sans">
                      {item.analyst_username || 'Unassigned'}
                    </td>

                    {/* Action */}
                    <td className="px-4 py-3 text-right font-sans">
                      <button
                        onClick={(e) => {
                          e.stopPropagation();
                          setSelectedId(item.id);
                        }}
                        className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded bg-deep-aubergine-surface hover:bg-deep-aubergine-card text-marigold border border-deep-aubergine-border text-xs font-semibold transition-colors"
                      >
                        <Eye className="w-3.5 h-3.5" />
                        <span>Inspect</span>
                      </button>
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>

        {/* Pagination Bar */}
        <div className="bg-deep-aubergine-surface/70 border-t border-deep-aubergine-border px-4 py-3 flex items-center justify-between text-xs text-soft-silver font-sans">
          <div>
            Showing {(page - 1) * pageSize + 1} to {Math.min(page * pageSize, total)} of {total} cases
          </div>
          <div className="flex items-center gap-2">
            <button
              disabled={page <= 1}
              onClick={() => setPage(page - 1)}
              className="p-1.5 rounded bg-deep-aubergine-card border border-deep-aubergine-border text-ice-silver disabled:opacity-40"
            >
              <ChevronLeft className="w-4 h-4" />
            </button>
            <span className="font-mono text-marigold">
              Page {page} of {totalPages}
            </span>
            <button
              disabled={page >= totalPages}
              onClick={() => setPage(page + 1)}
              className="p-1.5 rounded bg-deep-aubergine-card border border-deep-aubergine-border text-ice-silver disabled:opacity-40"
            >
              <ChevronRight className="w-4 h-4" />
            </button>
          </div>
        </div>
      </div>

      {/* Investigation Workspace Drawer */}
      <InvestigationDrawer
        investigationId={selectedId}
        onClose={() => setSelectedId(null)}
        onUpdate={loadInvestigations}
      />
    </div>
  );
};

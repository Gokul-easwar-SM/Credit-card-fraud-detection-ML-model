import React, { useState, useEffect, useCallback } from 'react';
import {
  UserCheck,
  Search,
  Filter,
  RefreshCw,
  AlertCircle,
  ShieldAlert,
  ShieldCheck,
  Clock,
  ArrowUpDown,
  ChevronLeft,
  ChevronRight,
  Eye,
  Activity,
} from 'lucide-react';
import { api } from '../api/client';
import { RiskBadge } from '../components/RiskBadge';
import { InvestigationDrawer } from '../components/InvestigationDrawer';
import type { InvestigationListItem } from '../types';

export const AnalystDashboard: React.FC = () => {
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

  // Selected investigation for detail drawer
  const [selectedId, setSelectedId] = useState<number | null>(null);

  // Fetch investigations
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
        setError('Failed to fetch investigations');
      }
    } finally {
      setLoading(false);
    }
  }, [page, pageSize, statusFilter, riskBandFilter, searchQuery, sortBy, sortOrder]);

  useEffect(() => {
    loadInvestigations();
  }, [loadInvestigations]);

  // Derived KPI calculations
  const pendingCount = items.filter((i) => i.status === 'pending_review').length;
  const underInvestCount = items.filter((i) => i.status === 'under_investigation').length;
  const confirmedFraudCount = items.filter((i) => i.status === 'confirmed_fraud').length;
  const genuineCount = items.filter((i) => i.status === 'marked_genuine').length;

  const totalPages = Math.ceil(total / pageSize) || 1;

  return (
    <div className="space-y-6">
      {/* Page Title & Controls */}
      <div className="flex flex-col md:flex-row md:items-center md:justify-between gap-4 pb-2 border-b border-slate-800">
        <div>
          <h1 className="text-xl sm:text-2xl font-bold text-white tracking-tight flex items-center gap-2.5">
            <UserCheck className="w-6 h-6 text-indigo-400" />
            <span>Fraud Analyst Investigation Queue</span>
          </h1>
          <p className="text-xs text-slate-400 mt-1">
            Part B: Priority-ranked human analyst triage queue with audit logging and decision resolution
          </p>
        </div>

        <button
          onClick={loadInvestigations}
          disabled={loading}
          className="self-start md:self-auto flex items-center gap-2 px-3.5 py-2 rounded-xl bg-slate-800 hover:bg-slate-700 text-slate-200 text-xs font-medium border border-slate-700 shadow-sm transition-all"
        >
          <RefreshCw className={`w-3.5 h-3.5 ${loading ? 'animate-spin' : ''}`} />
          <span>Refresh Queue</span>
        </button>
      </div>

      {/* KPI Cards */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
        <div className="bg-slate-900/80 border border-slate-800 rounded-2xl p-4 shadow-lg">
          <div className="flex items-center justify-between text-slate-400 text-xs mb-2">
            <span>Pending Review</span>
            <Clock className="w-4 h-4 text-amber-400" />
          </div>
          <div className="text-2xl font-bold text-white font-mono">{pendingCount}</div>
          <div className="text-[11px] text-amber-400/80 mt-1">Requires analyst attention</div>
        </div>

        <div className="bg-slate-900/80 border border-slate-800 rounded-2xl p-4 shadow-lg">
          <div className="flex items-center justify-between text-slate-400 text-xs mb-2">
            <span>In Progress</span>
            <Activity className="w-4 h-4 text-indigo-400" />
          </div>
          <div className="text-2xl font-bold text-indigo-300 font-mono">{underInvestCount}</div>
          <div className="text-[11px] text-slate-400 mt-1">Under investigation</div>
        </div>

        <div className="bg-slate-900/80 border border-slate-800 rounded-2xl p-4 shadow-lg">
          <div className="flex items-center justify-between text-slate-400 text-xs mb-2">
            <span>Confirmed Frauds</span>
            <ShieldAlert className="w-4 h-4 text-rose-400" />
          </div>
          <div className="text-2xl font-bold text-rose-400 font-mono">{confirmedFraudCount}</div>
          <div className="text-[11px] text-rose-400/80 mt-1">Confirmed unauthorized</div>
        </div>

        <div className="bg-slate-900/80 border border-slate-800 rounded-2xl p-4 shadow-lg">
          <div className="flex items-center justify-between text-slate-400 text-xs mb-2">
            <span>Marked Genuine</span>
            <ShieldCheck className="w-4 h-4 text-emerald-400" />
          </div>
          <div className="text-2xl font-bold text-emerald-400 font-mono">{genuineCount}</div>
          <div className="text-[11px] text-emerald-400/80 mt-1">Resolved false positives</div>
        </div>
      </div>

      {/* Filter and Search Bar */}
      <div className="bg-slate-900/80 border border-slate-800 rounded-2xl p-4 shadow-xl space-y-3">
        <div className="flex flex-col md:flex-row md:items-center justify-between gap-3">
          {/* Search Box */}
          <div className="relative flex-1">
            <Search className="w-4 h-4 absolute left-3 top-3 text-slate-500" />
            <input
              type="text"
              value={searchQuery}
              onChange={(e) => {
                setSearchQuery(e.target.value);
                setPage(1);
              }}
              placeholder="Search by Customer ID (cust_...) or Transaction ID..."
              className="w-full bg-slate-950 border border-slate-800 rounded-xl pl-9 pr-3 py-2 text-xs text-slate-200 placeholder-slate-600 focus:outline-none focus:border-indigo-500"
            />
          </div>

          {/* Sort Selector */}
          <div className="flex items-center gap-2">
            <ArrowUpDown className="w-3.5 h-3.5 text-slate-400" />
            <select
              value={sortBy}
              onChange={(e) => setSortBy(e.target.value as 'priority_score' | 'occurred_at' | 'amount')}
              className="bg-slate-950 border border-slate-800 rounded-xl px-3 py-2 text-xs text-slate-300 focus:outline-none focus:border-indigo-500"
            >
              <option value="priority_score">Priority Score</option>
              <option value="amount">Amount</option>
              <option value="occurred_at">Transaction Time</option>
            </select>

            <button
              onClick={() => setSortOrder(sortOrder === 'desc' ? 'asc' : 'desc')}
              className="px-2.5 py-2 rounded-xl bg-slate-950 border border-slate-800 text-xs text-slate-400 hover:text-slate-200"
            >
              {sortOrder.toUpperCase()}
            </button>
          </div>
        </div>

        {/* Filter Pills */}
        <div className="flex flex-wrap items-center gap-2 pt-1 border-t border-slate-800/60">
          <div className="flex items-center gap-1.5 text-xs text-slate-400 mr-2">
            <Filter className="w-3.5 h-3.5" />
            <span>Status:</span>
          </div>
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
              className={`px-2.5 py-1 rounded-lg text-xs font-medium transition-all ${
                statusFilter === st.value
                  ? 'bg-indigo-600 text-white shadow-sm'
                  : 'bg-slate-950 text-slate-400 hover:text-slate-200 border border-slate-800'
              }`}
            >
              {st.label}
            </button>
          ))}

          <div className="w-px h-4 bg-slate-800 mx-1 hidden sm:block" />

          <div className="flex items-center gap-1.5 text-xs text-slate-400 mr-2">
            <span>Risk:</span>
          </div>
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
              className={`px-2.5 py-1 rounded-lg text-xs font-medium transition-all ${
                riskBandFilter === rb.value
                  ? 'bg-slate-700 text-white'
                  : 'bg-slate-950 text-slate-400 hover:text-slate-200 border border-slate-800'
              }`}
            >
              {rb.label}
            </button>
          ))}
        </div>
      </div>

      {/* Error state */}
      {error && (
        <div className="p-4 rounded-xl bg-rose-500/10 border border-rose-500/30 text-rose-300 text-xs flex items-center gap-2">
          <AlertCircle className="w-4 h-4 shrink-0" />
          <span>{error}</span>
        </div>
      )}

      {/* Investigations Table */}
      <div className="bg-slate-900/80 border border-slate-800 rounded-2xl shadow-xl overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full text-left text-xs">
            <thead className="bg-slate-950/80 border-b border-slate-800 text-slate-400 font-medium uppercase tracking-wider">
              <tr>
                <th className="px-4 py-3 text-center">Priority</th>
                <th className="px-4 py-3">Txn ID / Time</th>
                <th className="px-4 py-3">Customer</th>
                <th className="px-4 py-3">Channel</th>
                <th className="px-4 py-3">Amount</th>
                <th className="px-4 py-3">ML Assessment</th>
                <th className="px-4 py-3">Status</th>
                <th className="px-4 py-3">Analyst</th>
                <th className="px-4 py-3 text-right">Action</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-800/60">
              {loading ? (
                <tr>
                  <td colSpan={9} className="py-12 text-center text-slate-400">
                    <div className="flex items-center justify-center gap-2">
                      <div className="animate-spin rounded-full h-4 w-4 border-b-2 border-indigo-500" />
                      <span>Loading investigation cases...</span>
                    </div>
                  </td>
                </tr>
              ) : items.length === 0 ? (
                <tr>
                  <td colSpan={9} className="py-12 text-center text-slate-500">
                    No investigations match current filter criteria.
                  </td>
                </tr>
              ) : (
                items.map((item) => (
                  <tr
                    key={item.id}
                    className="hover:bg-slate-800/40 transition-colors group cursor-pointer"
                    onClick={() => setSelectedId(item.id)}
                  >
                    {/* Priority Score */}
                    <td className="px-4 py-3 text-center">
                      <span
                        className={`inline-block font-mono font-bold px-2 py-0.5 rounded text-[11px] ${
                          item.priority_score >= 80
                            ? 'bg-rose-500/20 text-rose-300 border border-rose-500/40'
                            : item.priority_score >= 50
                            ? 'bg-amber-500/20 text-amber-300 border border-amber-500/40'
                            : 'bg-slate-800 text-slate-400'
                        }`}
                      >
                        {item.priority_score.toFixed(1)}
                      </span>
                    </td>

                    {/* Txn ID / Time */}
                    <td className="px-4 py-3">
                      <div className="font-mono text-slate-200 font-medium truncate max-w-[140px]">
                        {item.external_txn_id}
                      </div>
                      <div className="text-[10px] text-slate-400">
                        {new Date(item.occurred_at).toLocaleTimeString('en-IN', { hour12: false })}{' '}
                        <span>({new Date(item.occurred_at).toLocaleDateString()})</span>
                      </div>
                    </td>

                    {/* Customer */}
                    <td className="px-4 py-3 font-mono text-slate-300">{item.external_customer_id}</td>

                    {/* Channel */}
                    <td className="px-4 py-3 uppercase font-mono text-slate-400 text-[11px]">{item.channel}</td>

                    {/* Amount */}
                    <td className="px-4 py-3 font-bold text-white">
                      ₹{item.amount.toLocaleString('en-IN', { minimumFractionDigits: 2 })}
                    </td>

                    {/* ML Assessment */}
                    <td className="px-4 py-3">
                      <RiskBadge band={item.risk_band} score={item.calibrated_score} size="sm" />
                    </td>

                    {/* Status */}
                    <td className="px-4 py-3">
                      <span
                        className={`inline-block text-[10px] font-semibold uppercase px-2 py-0.5 rounded ${
                          item.status === 'confirmed_fraud'
                            ? 'bg-rose-500/15 text-rose-300 border border-rose-500/30'
                            : item.status === 'marked_genuine'
                            ? 'bg-emerald-500/15 text-emerald-300 border border-emerald-500/30'
                            : item.status === 'under_investigation'
                            ? 'bg-amber-500/15 text-amber-300 border border-amber-500/30'
                            : 'bg-slate-800 text-slate-400 border border-slate-700'
                        }`}
                      >
                        {item.status.replace('_', ' ')}
                      </span>
                    </td>

                    {/* Analyst */}
                    <td className="px-4 py-3 text-slate-400 text-[11px]">{item.analyst_username || '—'}</td>

                    {/* Action */}
                    <td className="px-4 py-3 text-right">
                      <button
                        onClick={(e) => {
                          e.stopPropagation();
                          setSelectedId(item.id);
                        }}
                        className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-lg bg-indigo-600/20 hover:bg-indigo-600 text-indigo-300 hover:text-white border border-indigo-500/30 text-xs font-medium transition-all"
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
        <div className="bg-slate-950/80 border-t border-slate-800 px-4 py-3 flex items-center justify-between text-xs text-slate-400">
          <div>
            Showing {(page - 1) * pageSize + 1} to {Math.min(page * pageSize, total)} of {total} cases
          </div>
          <div className="flex items-center gap-2">
            <button
              disabled={page <= 1}
              onClick={() => setPage(page - 1)}
              className="p-1.5 rounded-lg border border-slate-800 text-slate-300 hover:bg-slate-800 disabled:opacity-40 transition-colors"
            >
              <ChevronLeft className="w-4 h-4" />
            </button>
            <span className="font-mono text-slate-300">
              Page {page} of {totalPages}
            </span>
            <button
              disabled={page >= totalPages}
              onClick={() => setPage(page + 1)}
              className="p-1.5 rounded-lg border border-slate-800 text-slate-300 hover:bg-slate-800 disabled:opacity-40 transition-colors"
            >
              <ChevronRight className="w-4 h-4" />
            </button>
          </div>
        </div>
      </div>

      {/* Detail Drawer */}
      <InvestigationDrawer
        investigationId={selectedId}
        onClose={() => setSelectedId(null)}
        onUpdate={loadInvestigations}
      />
    </div>
  );
};

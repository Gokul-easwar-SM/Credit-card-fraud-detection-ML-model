import React, { useState, useEffect, useRef, useCallback } from 'react';
import {
  Search,
  Filter,
  RefreshCw,
  Pause,
  Play,
  Eye,
  AlertCircle,
  MapPin,
  CreditCard,
} from 'lucide-react';
import { api } from '../api/client';
import { RiskBadge } from '../components/RiskBadge';
import { InvestigationDrawer } from '../components/InvestigationDrawer';
import type { Transaction } from '../types';

interface LiveMonitoringProps {
  onSelectTransactionForRisk: (txnId: number) => void;
}

export const LiveMonitoring: React.FC<LiveMonitoringProps> = ({ onSelectTransactionForRisk }) => {
  const [transactions, setTransactions] = useState<Transaction[]>([]);
  const [total, setTotal] = useState(0);
  const [page, setPage] = useState(1);
  const [pageSize] = useState(25);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // Filters
  const [search, setSearch] = useState('');
  const [channelFilter, setChannelFilter] = useState<string>('');
  const [riskFilter, setRiskFilter] = useState<string>('');

  // SSE Stream State
  const [isStreaming, setIsStreaming] = useState(true);
  const isStreamingRef = useRef(true);
  isStreamingRef.current = isStreaming;

  const [drawerInvestigationId, setDrawerInvestigationId] = useState<number | null>(null);

  // Helper to generate deterministic masked card number
  const getMaskedCard = (t: Transaction): string => {
    if (t.card_number_masked) return t.card_number_masked;
    const h = Math.abs(
      (t.external_customer_id || '').split('').reduce((acc, c) => acc + c.charCodeAt(0), 0)
    );
    const last4 = (1000 + (h % 9000)).toString();
    return `•••• •••• •••• ${last4}`;
  };

  const getStatusDisplay = (t: Transaction) => {
    if (t.investigation?.status === 'confirmed_fraud') {
      return { label: 'Blocked', color: 'bg-red-950/60 text-red-300 border-red-800/60' };
    }
    if (t.investigation?.status === 'marked_genuine') {
      return { label: 'Approved', color: 'bg-emerald-950/60 text-emerald-300 border-emerald-800/60' };
    }
    if (t.investigation?.status === 'under_investigation' || t.prediction?.risk_band === 'medium') {
      return { label: 'On Hold', color: 'bg-amber-950/60 text-amber-300 border-amber-800/60' };
    }
    if (t.prediction?.risk_band === 'high') {
      return { label: 'Blocked', color: 'bg-red-950/60 text-red-300 border-red-800/60' };
    }
    return { label: 'Approved', color: 'bg-emerald-950/60 text-emerald-300 border-emerald-800/60' };
  };

  const loadHistorical = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const q = new URLSearchParams();
      q.set('page', page.toString());
      q.set('page_size', pageSize.toString());
      if (channelFilter) q.set('channel', channelFilter);
      if (riskFilter) q.set('risk_band', riskFilter);
      if (search) q.set('search', search);

      const res = await api.listTransactions(`?${q.toString()}`);
      setTransactions(res.items);
      setTotal(res.total);
    } catch (err: unknown) {
      if (err instanceof Error) {
        setError(err.message);
      } else {
        setError('Failed to fetch transactions');
      }
    } finally {
      setLoading(false);
    }
  }, [page, pageSize, channelFilter, riskFilter, search]);

  useEffect(() => {
    loadHistorical();
  }, [loadHistorical]);

  // Connect to SSE Stream
  useEffect(() => {
    const es = api.createEventSource();

    es.onmessage = (event) => {
      try {
        const parsed = JSON.parse(event.data);
        if (parsed.event === 'transaction' && parsed.data) {
          const newTxn = parsed.data as Transaction;
          if (isStreamingRef.current && page === 1 && !search && !channelFilter && !riskFilter) {
            setTransactions((prev) => [newTxn, ...prev.slice(0, pageSize - 1)]);
            setTotal((prev) => prev + 1);
          }
        }
      } catch {
        // Heartbeat or malformed event
      }
    };

    return () => {
      es.close();
    };
  }, [page, search, channelFilter, riskFilter, pageSize]);

  const handleRowClick = (txn: Transaction) => {
    if (txn.investigation?.id) {
      setDrawerInvestigationId(txn.investigation.id);
    } else {
      onSelectTransactionForRisk(txn.id);
    }
  };

  return (
    <div className="space-y-6">
      {/* Page Title & SSE Stream Status */}
      <div className="flex flex-col md:flex-row md:items-center md:justify-between gap-4 pb-3 border-b border-deep-aubergine-border">
        <div>
          <div className="flex items-center gap-2.5">
            <h1 className="text-xl sm:text-2xl font-bold text-ice-silver tracking-tight">
              Live Transaction Monitoring Terminal
            </h1>
            <div
              className={`inline-flex items-center gap-1.5 px-2.5 py-0.5 rounded text-[11px] font-mono border ${
                isStreaming
                  ? 'bg-emerald-950/60 text-emerald-300 border-emerald-800/60'
                  : 'bg-amber-950/60 text-amber-300 border-amber-800/60'
              }`}
            >
              <span className={`w-1.5 h-1.5 rounded-full ${isStreaming ? 'bg-emerald-400 animate-pulse' : 'bg-amber-400'}`} />
              <span>{isStreaming ? 'STREAMING ACTIVE' : 'STREAM PAUSED'}</span>
            </div>
          </div>
          <p className="text-xs text-soft-silver mt-1">
            Real-time automated transaction ingestion, masked card mapping, ML risk inference, and instant policy status
          </p>
        </div>

        <div className="flex items-center gap-2">
          <button
            onClick={() => setIsStreaming(!isStreaming)}
            className={`flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-medium border transition-colors ${
              isStreaming
                ? 'bg-deep-aubergine-surface text-ice-silver border-deep-aubergine-border hover:bg-deep-aubergine-card'
                : 'bg-amber-950/60 text-amber-300 border-amber-800/60'
            }`}
          >
            {isStreaming ? <Pause className="w-3.5 h-3.5 text-marigold" /> : <Play className="w-3.5 h-3.5 text-emerald-400" />}
            <span>{isStreaming ? 'Pause Stream' : 'Resume Stream'}</span>
          </button>

          <button
            onClick={loadHistorical}
            disabled={loading}
            className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-deep-aubergine-surface hover:bg-deep-aubergine-card text-ice-silver text-xs border border-deep-aubergine-border transition-colors"
          >
            <RefreshCw className={`w-3.5 h-3.5 text-marigold ${loading ? 'animate-spin' : ''}`} />
            <span>Refresh</span>
          </button>
        </div>
      </div>

      {error && (
        <div className="p-3.5 rounded-lg bg-red-950/60 border border-red-800/60 text-red-300 text-xs flex items-center gap-2">
          <AlertCircle className="w-4 h-4 shrink-0" />
          <span>{error}</span>
        </div>
      )}

      {/* Filter and Search Bar */}
      <div className="bg-deep-aubergine-card border border-deep-aubergine-border rounded-xl p-4 shadow-subtle space-y-3">
        <div className="flex flex-col md:flex-row md:items-center justify-between gap-3">
          <div className="relative flex-1">
            <Search className="w-4 h-4 absolute left-3 top-2.5 text-slate-grey" />
            <input
              type="text"
              value={search}
              onChange={(e) => {
                setSearch(e.target.value);
                setPage(1);
              }}
              placeholder="Filter by Transaction ID, Customer ID, or Masked Card..."
              className="w-full bg-deep-aubergine-dark border border-deep-aubergine-border rounded-lg pl-9 pr-3 py-2 text-xs text-ice-silver placeholder-slate-grey focus:outline-none focus:border-marigold transition-colors"
            />
          </div>

          <div className="flex items-center gap-2">
            <div className="flex items-center gap-1 text-xs text-muted-lavender">
              <Filter className="w-3.5 h-3.5" />
              <span>Channel:</span>
            </div>
            <select
              value={channelFilter}
              onChange={(e) => {
                setChannelFilter(e.target.value);
                setPage(1);
              }}
              className="bg-deep-aubergine-dark border border-deep-aubergine-border rounded-lg px-2.5 py-1.5 text-xs text-ice-silver focus:outline-none focus:border-marigold"
            >
              <option value="">All Channels</option>
              <option value="pos">POS</option>
              <option value="online">Online</option>
              <option value="atm">ATM</option>
            </select>

            <div className="flex items-center gap-1 text-xs text-muted-lavender ml-2">
              <span>Risk:</span>
            </div>
            <select
              value={riskFilter}
              onChange={(e) => {
                setRiskFilter(e.target.value);
                setPage(1);
              }}
              className="bg-deep-aubergine-dark border border-deep-aubergine-border rounded-lg px-2.5 py-1.5 text-xs text-ice-silver focus:outline-none focus:border-marigold"
            >
              <option value="">All Bands</option>
              <option value="high">High Risk</option>
              <option value="medium">Medium Risk</option>
              <option value="low">Low Risk</option>
            </select>
          </div>
        </div>
      </div>

      {/* Transaction Table */}
      <div className="bg-deep-aubergine-card border border-deep-aubergine-border rounded-xl shadow-subtle overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full text-left text-xs">
            <thead className="bg-deep-aubergine-surface/70 text-slate-grey uppercase text-[10px] tracking-wider border-b border-deep-aubergine-border">
              <tr>
                <th className="px-4 py-3">Transaction ID</th>
                <th className="px-4 py-3">Card Number</th>
                <th className="px-4 py-3">Customer ID</th>
                <th className="px-4 py-3">Amount (INR)</th>
                <th className="px-4 py-3">Channel</th>
                <th className="px-4 py-3">Location</th>
                <th className="px-4 py-3">Timestamp</th>
                <th className="px-4 py-3">Risk Assessment</th>
                <th className="px-4 py-3">Status</th>
                <th className="px-4 py-3 text-right">Actions</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-deep-aubergine-border/50 text-xs font-mono">
              {loading ? (
                <tr>
                  <td colSpan={10} className="py-12 text-center text-slate-grey font-sans">
                    <div className="flex items-center justify-center gap-2">
                      <div className="animate-spin rounded-full h-4 w-4 border-b-2 border-marigold" />
                      <span>Loading real-time transactions...</span>
                    </div>
                  </td>
                </tr>
              ) : transactions.length === 0 ? (
                <tr>
                  <td colSpan={10} className="py-12 text-center text-slate-grey font-sans">
                    No transactions match the criteria. Start the simulator in Simulation Lab to generate stream.
                  </td>
                </tr>
              ) : (
                transactions.map((t) => {
                  const statusInfo = getStatusDisplay(t);
                  const pred = t.prediction;
                  return (
                    <tr
                      key={t.id}
                      onClick={() => handleRowClick(t)}
                      className="hover:bg-deep-aubergine-surface/40 transition-colors cursor-pointer"
                    >
                      {/* Txn ID */}
                      <td className="px-4 py-3 font-medium text-ice-silver">{t.external_txn_id}</td>

                      {/* Masked Card Number */}
                      <td className="px-4 py-3 text-soft-silver font-sans flex items-center gap-1.5">
                        <CreditCard className="w-3.5 h-3.5 text-muted-lavender" />
                        <span>{getMaskedCard(t)}</span>
                      </td>

                      {/* Customer ID */}
                      <td className="px-4 py-3 text-muted-lavender font-sans">{t.external_customer_id}</td>

                      {/* Amount */}
                      <td className="px-4 py-3 font-bold text-ice-silver">
                        ₹{t.amount.toLocaleString('en-IN', { minimumFractionDigits: 2 })}
                      </td>

                      {/* Channel */}
                      <td className="px-4 py-3 uppercase text-[11px] text-soft-silver">{t.channel}</td>

                      {/* Location */}
                      <td className="px-4 py-3 text-slate-grey font-sans text-[11px]">
                        {t.lat !== null && t.lon !== null && t.lat !== undefined && t.lon !== undefined ? (
                          <span className="flex items-center gap-1">
                            <MapPin className="w-3 h-3 text-muted-lavender" />
                            <span>
                              {t.lat.toFixed(2)}, {t.lon.toFixed(2)}
                            </span>
                          </span>
                        ) : (
                          'Online / POS'
                        )}
                      </td>

                      {/* Timestamp */}
                      <td className="px-4 py-3 text-slate-grey text-[11px]">
                        {new Date(t.occurred_at).toLocaleTimeString('en-IN', { hour12: false })}{' '}
                        <span className="text-[10px] opacity-75">
                          ({new Date(t.occurred_at).toLocaleDateString()})
                        </span>
                      </td>

                      {/* Risk Assessment */}
                      <td className="px-4 py-3 font-sans">
                        {pred ? (
                          <RiskBadge band={pred.risk_band} score={pred.calibrated_score} size="sm" />
                        ) : (
                          <span className="text-[10px] text-slate-grey">Evaluating...</span>
                        )}
                      </td>

                      {/* Status */}
                      <td className="px-4 py-3 font-sans">
                        <span
                          className={`inline-block text-[10px] font-semibold uppercase px-2 py-0.5 rounded border ${statusInfo.color}`}
                        >
                          {statusInfo.label}
                        </span>
                      </td>

                      {/* Actions */}
                      <td className="px-4 py-3 text-right font-sans">
                        <button
                          onClick={(e) => {
                            e.stopPropagation();
                            onSelectTransactionForRisk(t.id);
                          }}
                          className="inline-flex items-center gap-1 px-2.5 py-1 rounded bg-deep-aubergine-surface hover:bg-deep-aubergine-border text-marigold text-[11px] border border-deep-aubergine-border transition-colors"
                        >
                          <Eye className="w-3 h-3" />
                          <span>Analyze</span>
                        </button>
                      </td>
                    </tr>
                  );
                })
              )}
            </tbody>
          </table>
        </div>

        {/* Pagination Bar */}
        <div className="bg-deep-aubergine-surface/70 border-t border-deep-aubergine-border px-4 py-3 flex items-center justify-between text-xs text-soft-silver font-sans">
          <div>
            Showing {(page - 1) * pageSize + 1} to {Math.min(page * pageSize, total)} of {total} transactions
          </div>
          <div className="flex items-center gap-2">
            <button
              disabled={page <= 1}
              onClick={() => setPage(page - 1)}
              className="px-2.5 py-1 rounded bg-deep-aubergine-card border border-deep-aubergine-border text-ice-silver disabled:opacity-40"
            >
              Previous
            </button>
            <span className="font-mono text-marigold">
              Page {page} of {Math.ceil(total / pageSize) || 1}
            </span>
            <button
              disabled={page >= Math.ceil(total / pageSize)}
              onClick={() => setPage(page + 1)}
              className="px-2.5 py-1 rounded bg-deep-aubergine-card border border-deep-aubergine-border text-ice-silver disabled:opacity-40"
            >
              Next
            </button>
          </div>
        </div>
      </div>

      {/* Investigation Drawer if opened */}
      <InvestigationDrawer
        investigationId={drawerInvestigationId}
        onClose={() => setDrawerInvestigationId(null)}
        onUpdate={loadHistorical}
      />
    </div>
  );
};

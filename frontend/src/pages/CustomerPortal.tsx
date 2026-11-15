import React, { useState, useEffect, useRef } from 'react';
import {
  CreditCard,
  Send,
  Radio,
  CheckCircle2,
  ShieldCheck,
  ShieldAlert,
  Clock,
  RefreshCw,
  BellRing,
  Trash2,
  Pause,
  Play,
} from 'lucide-react';
import { api } from '../api/client';
import { RiskBadge } from '../components/RiskBadge';
import type { AlertRecord, PaymentChannel, Transaction } from '../types';

export const CustomerPortal: React.FC = () => {
  // Form State
  const [customerId, setCustomerId] = useState('cust_001');
  const [amount, setAmount] = useState('1450.00');
  const [channel, setChannel] = useState<PaymentChannel>('pos');
  const [lat, setLat] = useState('13.0827');
  const [lon, setLon] = useState('80.2707');
  const [deviceKey, setDeviceKey] = useState('dev_usr_phone_01');

  // Submission result
  const [submitting, setSubmitting] = useState(false);
  const [lastSubmittedTxn, setLastSubmittedTxn] = useState<Transaction | null>(null);
  const [submitError, setSubmitError] = useState<string | null>(null);

  // Alerts State
  const [alerts, setAlerts] = useState<AlertRecord[]>([]);
  const [loadingAlerts, setLoadingAlerts] = useState(false);
  const [alertFeedback, setAlertFeedback] = useState<{ id: number; message: string; type: 'success' | 'alert' } | null>(null);

  // SSE Stream State
  const [streamTransactions, setStreamTransactions] = useState<Transaction[]>([]);
  const [streamConnected, setStreamConnected] = useState(false);
  const [streamPaused, setStreamPaused] = useState(false);
  const streamPausedRef = useRef(false);
  streamPausedRef.current = streamPaused;

  const streamEndRef = useRef<HTMLDivElement>(null);

  // Fetch pending alerts
  const loadAlerts = async () => {
    setLoadingAlerts(true);
    try {
      const data = await api.listAlerts('pending');
      setAlerts(data);
    } catch {
      // ignore
    } finally {
      setLoadingAlerts(false);
    }
  };

  useEffect(() => {
    loadAlerts();
    const alertInterval = setInterval(loadAlerts, 5000);
    return () => clearInterval(alertInterval);
  }, []);

  // Connect to SSE Stream
  useEffect(() => {
    const es = api.createEventSource();

    es.onopen = () => {
      setStreamConnected(true);
    };

    es.onerror = () => {
      setStreamConnected(false);
    };

    es.onmessage = (event) => {
      try {
        const parsed = JSON.parse(event.data);
        if (parsed.event === 'transaction' && parsed.data) {
          if (!streamPausedRef.current) {
            setStreamTransactions((prev) => [parsed.data as Transaction, ...prev.slice(0, 49)]);
          }
        }
      } catch {
        // Heartbeat or ping event
      }
    };

    return () => {
      es.close();
      setStreamConnected(false);
    };
  }, []);

  // Submit Transaction
  const handleSubmitTransaction = async (e: React.FormEvent) => {
    e.preventDefault();
    setSubmitting(true);
    setSubmitError(null);
    setLastSubmittedTxn(null);

    try {
      const payload = {
        external_customer_id: customerId,
        amount: parseFloat(amount) || 0,
        currency: 'INR',
        channel,
        lat: parseFloat(lat) || null,
        lon: parseFloat(lon) || null,
        device_key: deviceKey || null,
        source: 'customer_portal_web',
      };

      const res = await api.createTransaction(payload);
      setLastSubmittedTxn(res);
      // Reload alerts in case an alert was created
      loadAlerts();
    } catch (err: unknown) {
      if (err instanceof Error) {
        setSubmitError(err.message);
      } else {
        setSubmitError('Failed to process transaction');
      }
    } finally {
      setSubmitting(false);
    }
  };

  // Respond to Customer 2-Way Alert
  const handleAlertResponse = async (alertId: number, response: 'yes_me' | 'not_me') => {
    try {
      await api.respondToAlert(alertId, response);
      if (response === 'yes_me') {
        setAlertFeedback({
          id: alertId,
          message: 'Confirmed! Transaction cleared and marked genuine.',
          type: 'success',
        });
      } else {
        setAlertFeedback({
          id: alertId,
          message: 'Fraud confirmed! Card step-up active; incident escalated to analyst queue.',
          type: 'alert',
        });
      }
      loadAlerts();
    } catch (err: unknown) {
      alert(err instanceof Error ? err.message : 'Failed to respond to alert');
    }
  };

  return (
    <div className="space-y-6">
      {/* Page Header */}
      <div className="flex flex-col md:flex-row md:items-center md:justify-between gap-4 pb-2 border-b border-slate-800">
        <div>
          <h1 className="text-xl sm:text-2xl font-bold text-white tracking-tight flex items-center gap-2.5">
            <Radio className="w-6 h-6 text-teal-400" />
            <span>Customer Portal & Live Transaction Stream</span>
          </h1>
          <p className="text-xs text-slate-400 mt-1">
            Part A: Real-time transaction submission, live SSE stream, and 2-way verification feedback loop
          </p>
        </div>

        {/* Live SSE Status Pill */}
        <div className="flex items-center gap-3">
          <div
            className={`inline-flex items-center gap-2 px-3 py-1.5 rounded-full text-xs font-mono border ${
              streamConnected
                ? 'bg-emerald-500/10 text-emerald-400 border-emerald-500/30'
                : 'bg-rose-500/10 text-rose-400 border-rose-500/30'
            }`}
          >
            <span
              className={`w-2 h-2 rounded-full ${
                streamConnected ? 'bg-emerald-400 animate-ping' : 'bg-rose-400'
              }`}
            />
            <span>{streamConnected ? 'SSE LIVE STREAM ACTIVE' : 'SSE RECONNECTING...'}</span>
          </div>
        </div>
      </div>

      {/* Main Grid: 3 Columns */}
      <div className="grid grid-cols-1 lg:grid-cols-12 gap-6">
        {/* Left Column: Transaction Simulation Form (4 cols) */}
        <div className="lg:col-span-4 space-y-4">
          <div className="bg-slate-900/80 border border-slate-800 rounded-2xl p-5 shadow-xl">
            <div className="flex items-center gap-2.5 mb-4 text-white font-semibold text-sm">
              <div className="w-8 h-8 rounded-lg bg-teal-500/10 text-teal-400 border border-teal-500/20 flex items-center justify-center">
                <CreditCard className="w-4 h-4" />
              </div>
              <div>
                <h2>Submit Transaction</h2>
                <p className="text-[11px] text-slate-400 font-normal">Real-time ML Scoring & Policy</p>
              </div>
            </div>

            {submitError && (
              <div className="mb-4 p-3 rounded-lg bg-rose-500/10 border border-rose-500/30 text-rose-300 text-xs">
                {submitError}
              </div>
            )}

            <form onSubmit={handleSubmitTransaction} className="space-y-3.5">
              <div>
                <label className="block text-xs font-medium text-slate-300 mb-1">Customer Identifier</label>
                <input
                  type="text"
                  value={customerId}
                  onChange={(e) => setCustomerId(e.target.value)}
                  required
                  className="w-full bg-slate-950 border border-slate-800 rounded-lg px-3 py-2 text-xs font-mono text-slate-200 focus:border-teal-500 focus:outline-none"
                  placeholder="cust_001"
                />
                <div className="flex gap-1.5 mt-1.5">
                  {['cust_001', 'cust_014', 'cust_088'].map((c) => (
                    <button
                      key={c}
                      type="button"
                      onClick={() => setCustomerId(c)}
                      className="text-[10px] px-2 py-0.5 rounded bg-slate-800 text-slate-400 hover:text-slate-200"
                    >
                      {c}
                    </button>
                  ))}
                </div>
              </div>

              <div>
                <label className="block text-xs font-medium text-slate-300 mb-1">Amount (₹ INR)</label>
                <div className="relative">
                  <span className="absolute left-3 top-2 text-xs text-slate-500 font-semibold">₹</span>
                  <input
                    type="number"
                    step="0.01"
                    min="1"
                    value={amount}
                    onChange={(e) => setAmount(e.target.value)}
                    required
                    className="w-full bg-slate-950 border border-slate-800 rounded-lg pl-7 pr-3 py-2 text-xs font-bold text-slate-100 focus:border-teal-500 focus:outline-none"
                    placeholder="1450.00"
                  />
                </div>
                <div className="flex gap-1.5 mt-1.5">
                  {[
                    { label: 'Normal ₹850', val: '850.00' },
                    { label: 'Elevated ₹12,500', val: '12500.00' },
                    { label: 'Spike ₹95,000', val: '95000.00' },
                  ].map((preset) => (
                    <button
                      key={preset.val}
                      type="button"
                      onClick={() => setAmount(preset.val)}
                      className="text-[10px] px-2 py-0.5 rounded bg-slate-800 text-slate-400 hover:text-slate-200"
                    >
                      {preset.label}
                    </button>
                  ))}
                </div>
              </div>

              <div>
                <label className="block text-xs font-medium text-slate-300 mb-1">Payment Channel</label>
                <div className="grid grid-cols-3 gap-2">
                  {(['pos', 'online', 'atm'] as PaymentChannel[]).map((ch) => (
                    <button
                      key={ch}
                      type="button"
                      onClick={() => setChannel(ch)}
                      className={`py-1.5 rounded-lg text-xs font-medium uppercase border transition-all ${
                        channel === ch
                          ? 'bg-teal-500/20 text-teal-300 border-teal-500/50'
                          : 'bg-slate-950 text-slate-400 border-slate-800 hover:bg-slate-900'
                      }`}
                    >
                      {ch}
                    </button>
                  ))}
                </div>
              </div>

              <div>
                <label className="block text-xs font-medium text-slate-300 mb-1 flex items-center justify-between">
                  <span>Geo-Location Coordinates</span>
                </label>
                <div className="grid grid-cols-2 gap-2">
                  <input
                    type="number"
                    step="any"
                    value={lat}
                    onChange={(e) => setLat(e.target.value)}
                    placeholder="Latitude"
                    className="w-full bg-slate-950 border border-slate-800 rounded-lg px-2.5 py-1.5 text-xs text-slate-200 font-mono focus:border-teal-500 focus:outline-none"
                  />
                  <input
                    type="number"
                    step="any"
                    value={lon}
                    onChange={(e) => setLon(e.target.value)}
                    placeholder="Longitude"
                    className="w-full bg-slate-950 border border-slate-800 rounded-lg px-2.5 py-1.5 text-xs text-slate-200 font-mono focus:border-teal-500 focus:outline-none"
                  />
                </div>
                <div className="flex flex-wrap gap-1.5 mt-1.5">
                  <button
                    type="button"
                    onClick={() => {
                      setLat('13.0827');
                      setLon('80.2707');
                    }}
                    className="text-[10px] px-2 py-0.5 rounded bg-slate-800 text-slate-400 hover:text-slate-200"
                  >
                    Chennai (Base)
                  </button>
                  <button
                    type="button"
                    onClick={() => {
                      setLat('19.0760');
                      setLon('72.8777');
                    }}
                    className="text-[10px] px-2 py-0.5 rounded bg-slate-800 text-slate-400 hover:text-slate-200"
                  >
                    Mumbai
                  </button>
                  <button
                    type="button"
                    onClick={() => {
                      setLat('51.5074');
                      setLon('-0.1278');
                    }}
                    className="text-[10px] px-2 py-0.5 rounded bg-rose-950/60 text-rose-300 border border-rose-900/60 hover:bg-rose-900/60"
                  >
                    London (Speed Alert)
                  </button>
                </div>
              </div>

              <div>
                <label className="block text-xs font-medium text-slate-300 mb-1">Device Fingerprint Key</label>
                <input
                  type="text"
                  value={deviceKey}
                  onChange={(e) => setDeviceKey(e.target.value)}
                  className="w-full bg-slate-950 border border-slate-800 rounded-lg px-3 py-1.5 text-xs font-mono text-slate-200 focus:border-teal-500 focus:outline-none"
                  placeholder="dev_usr_phone_01"
                />
                <div className="flex gap-1.5 mt-1.5">
                  <button
                    type="button"
                    onClick={() => setDeviceKey('dev_usr_phone_01')}
                    className="text-[10px] px-2 py-0.5 rounded bg-slate-800 text-slate-400 hover:text-slate-200"
                  >
                    Known Phone
                  </button>
                  <button
                    type="button"
                    onClick={() => setDeviceKey('dev_foreign_hack_99')}
                    className="text-[10px] px-2 py-0.5 rounded bg-rose-950/60 text-rose-300 border border-rose-900/60 hover:bg-rose-900/60"
                  >
                    Unknown Device
                  </button>
                </div>
              </div>

              <button
                type="submit"
                disabled={submitting}
                className="w-full py-2.5 px-4 rounded-xl bg-teal-600 hover:bg-teal-500 text-white font-medium text-xs transition-all shadow-lg shadow-teal-600/20 flex items-center justify-center gap-2 mt-2 disabled:opacity-50"
              >
                <Send className="w-3.5 h-3.5" />
                <span>{submitting ? 'Scoring & Policy Evaluating...' : 'Simulate Customer Payment'}</span>
              </button>
            </form>
          </div>

          {/* Last Submitted Result Card */}
          {lastSubmittedTxn && lastSubmittedTxn.prediction && (
            <div className="bg-slate-900/90 border border-slate-800 rounded-2xl p-4 shadow-xl animate-in fade-in slide-in-from-top-2 duration-300">
              <div className="flex items-center justify-between mb-2">
                <span className="text-xs font-semibold text-slate-300">Live Decision Result</span>
                <RiskBadge
                  band={lastSubmittedTxn.prediction.risk_band}
                  score={lastSubmittedTxn.prediction.calibrated_score}
                  size="sm"
                />
              </div>

              <div className="space-y-2 text-xs">
                <div className="flex items-center justify-between text-slate-400">
                  <span>Policy Action:</span>
                  <span className="font-mono font-bold text-slate-200">
                    {lastSubmittedTxn.prediction.recommended_action}
                  </span>
                </div>
                <div className="flex items-center justify-between text-slate-400">
                  <span>Calibrated Score:</span>
                  <span className="font-mono text-amber-400 font-bold">
                    {(lastSubmittedTxn.prediction.calibrated_score * 100).toFixed(1)}%
                  </span>
                </div>
                {lastSubmittedTxn.prediction.counterfactual_hint && (
                  <p className="text-[11px] text-teal-300 bg-teal-950/40 border border-teal-800/50 p-2.5 rounded-lg italic">
                    💡 {lastSubmittedTxn.prediction.counterfactual_hint}
                  </p>
                )}
              </div>
            </div>
          )}
        </div>

        {/* Middle Column: Two-Way Verification Alerts ("Was this you?") (4 cols) */}
        <div className="lg:col-span-4 space-y-4">
          <div className="bg-slate-900/80 border border-slate-800 rounded-2xl p-5 shadow-xl flex flex-col h-full">
            <div className="flex items-center justify-between mb-4">
              <div className="flex items-center gap-2.5">
                <div className="w-8 h-8 rounded-lg bg-amber-500/10 text-amber-400 border border-amber-500/20 flex items-center justify-center">
                  <BellRing className="w-4 h-4 animate-bounce" />
                </div>
                <div>
                  <h2 className="text-white font-semibold text-sm">Two-Way Customer Alerts</h2>
                  <p className="text-[11px] text-slate-400">&quot;Was this you?&quot; Step-Up Verification</p>
                </div>
              </div>
              <button
                onClick={loadAlerts}
                disabled={loadingAlerts}
                title="Refresh alerts"
                className="p-1.5 rounded-lg text-slate-400 hover:text-slate-200 hover:bg-slate-800 transition-colors"
              >
                <RefreshCw className={`w-3.5 h-3.5 ${loadingAlerts ? 'animate-spin' : ''}`} />
              </button>
            </div>

            {/* Alert Response Banner */}
            {alertFeedback && (
              <div
                className={`mb-3 p-3 rounded-xl text-xs flex items-center gap-2 ${
                  alertFeedback.type === 'success'
                    ? 'bg-emerald-500/15 border border-emerald-500/30 text-emerald-300'
                    : 'bg-rose-500/15 border border-rose-500/30 text-rose-300'
                }`}
              >
                {alertFeedback.type === 'success' ? (
                  <ShieldCheck className="w-4 h-4 shrink-0" />
                ) : (
                  <ShieldAlert className="w-4 h-4 shrink-0" />
                )}
                <span>{alertFeedback.message}</span>
              </div>
            )}

            {/* Alerts List */}
            <div className="flex-1 space-y-3 overflow-y-auto max-h-[600px] pr-1">
              {alerts.length === 0 ? (
                <div className="text-center py-12 px-4 border border-dashed border-slate-800 rounded-xl">
                  <ShieldCheck className="w-8 h-8 text-slate-600 mx-auto mb-2" />
                  <p className="text-xs text-slate-400 font-medium">No pending verification alerts</p>
                  <p className="text-[11px] text-slate-600 mt-1">
                    When the model flags a medium-risk transaction (e.g. ₹12,500+ or novel channel), an interactive SMS/push
                    prompt appears here.
                  </p>
                </div>
              ) : (
                alerts.map((al) => (
                  <div
                    key={al.id}
                    className="bg-slate-950 border border-amber-500/30 rounded-xl p-3.5 shadow-md relative overflow-hidden"
                  >
                    <div className="absolute top-0 right-0 w-16 h-16 bg-amber-500/5 rounded-full blur-xl pointer-events-none" />

                    <div className="flex items-center justify-between text-xs mb-2">
                      <span className="font-mono text-slate-400">{al.external_customer_id}</span>
                      <span className="text-[10px] uppercase font-mono px-1.5 py-0.5 rounded bg-amber-500/20 text-amber-300 border border-amber-500/30">
                        {al.channel} alert
                      </span>
                    </div>

                    <p className="text-xs text-slate-200 mb-3 bg-slate-900/80 p-2.5 rounded-lg border border-slate-800 leading-relaxed font-sans">
                      &quot;{al.message}&quot;
                    </p>

                    <div className="text-[10px] text-slate-500 mb-3 flex items-center gap-1">
                      <Clock className="w-3 h-3" />
                      <span>{new Date(al.created_at).toLocaleTimeString()}</span>
                    </div>

                    {/* Customer Action Buttons */}
                    <div className="grid grid-cols-2 gap-2">
                      <button
                        onClick={() => handleAlertResponse(al.id, 'yes_me')}
                        className="py-1.5 px-2 rounded-lg bg-emerald-600/90 hover:bg-emerald-500 text-white text-xs font-medium flex items-center justify-center gap-1.5 transition-all shadow-sm"
                      >
                        <CheckCircle2 className="w-3.5 h-3.5" />
                        <span>Yes, it was me</span>
                      </button>

                      <button
                        onClick={() => handleAlertResponse(al.id, 'not_me')}
                        className="py-1.5 px-2 rounded-lg bg-rose-600/90 hover:bg-rose-500 text-white text-xs font-medium flex items-center justify-center gap-1.5 transition-all shadow-sm"
                      >
                        <ShieldAlert className="w-3.5 h-3.5" />
                        <span>No! Fraud</span>
                      </button>
                    </div>
                  </div>
                ))
              )}
            </div>
          </div>
        </div>

        {/* Right Column: Real-Time SSE Live Stream (4 cols) */}
        <div className="lg:col-span-4 space-y-4">
          <div className="bg-slate-900/80 border border-slate-800 rounded-2xl p-5 shadow-xl flex flex-col h-full">
            <div className="flex items-center justify-between mb-3">
              <div className="flex items-center gap-2">
                <span className="relative flex h-3 w-3">
                  <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-teal-400 opacity-75"></span>
                  <span className="relative inline-flex rounded-full h-3 w-3 bg-teal-500"></span>
                </span>
                <h2 className="text-white font-semibold text-sm">Live SSE Transaction Ticker</h2>
              </div>

              <div className="flex items-center gap-1">
                <button
                  onClick={() => setStreamPaused(!streamPaused)}
                  title={streamPaused ? 'Resume stream' : 'Pause stream'}
                  className={`p-1.5 rounded-lg border text-xs transition-colors ${
                    streamPaused
                      ? 'bg-amber-500/20 text-amber-300 border-amber-500/30'
                      : 'bg-slate-800 text-slate-400 border-slate-700 hover:text-slate-200'
                  }`}
                >
                  {streamPaused ? <Play className="w-3.5 h-3.5" /> : <Pause className="w-3.5 h-3.5" />}
                </button>
                <button
                  onClick={() => setStreamTransactions([])}
                  title="Clear stream ticker"
                  className="p-1.5 rounded-lg bg-slate-800 text-slate-400 border border-slate-700 hover:text-rose-400 transition-colors"
                >
                  <Trash2 className="w-3.5 h-3.5" />
                </button>
              </div>
            </div>

            <div className="text-[11px] text-slate-400 mb-3 flex items-center justify-between">
              <span>Showing last {streamTransactions.length} events</span>
              {streamPaused && <span className="text-amber-400 font-semibold">[STREAM PAUSED]</span>}
            </div>

            {/* Stream List */}
            <div className="flex-1 space-y-2 overflow-y-auto max-h-[600px] pr-1">
              {streamTransactions.length === 0 ? (
                <div className="text-center py-16 px-4 border border-dashed border-slate-800 rounded-xl">
                  <Radio className="w-8 h-8 text-slate-600 mx-auto mb-2" />
                  <p className="text-xs text-slate-400 font-medium">Waiting for transaction events...</p>
                  <p className="text-[11px] text-slate-600 mt-1">
                    Submit a transaction on the left or activate the background simulator to see live events stream here.
                  </p>
                </div>
              ) : (
                streamTransactions.map((tx, idx) => {
                  const p = tx.prediction;
                  return (
                    <div
                      key={tx.id || idx}
                      className="bg-slate-950 border border-slate-800/80 rounded-xl p-3 hover:border-slate-700 transition-all text-xs"
                    >
                      <div className="flex items-center justify-between mb-1.5">
                        <div className="flex items-center gap-1.5">
                          <span className="font-bold text-white text-sm">
                            ₹{tx.amount.toLocaleString('en-IN', { minimumFractionDigits: 2 })}
                          </span>
                          <span className="text-[10px] uppercase font-mono px-1 rounded bg-slate-800 text-slate-400">
                            {tx.channel}
                          </span>
                        </div>
                        {p && <RiskBadge band={p.risk_band} score={p.calibrated_score} size="sm" />}
                      </div>

                      <div className="flex items-center justify-between text-[11px] text-slate-400">
                        <span className="font-mono truncate max-w-[120px]">{tx.external_customer_id}</span>
                        <span>{new Date(tx.occurred_at).toLocaleTimeString('en-IN', { hour12: false })}</span>
                      </div>
                    </div>
                  );
                })
              )}
              <div ref={streamEndRef} />
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};

import { useEffect, useState } from "react";
export const BASE: string = import.meta.env.VITE_API_URL ?? "http://localhost:8000";

export type User = { id: number; username: string; email: string; role: "analyst" | "admin" | "auditor" };
export type Card = { id: number; card_number_masked: string; card_type: string; status: string; daily_limit?: number; current_day_spend?: number; last_freeze_reason?: string | null; external_customer_id?: string };
export type Customer = { id: number; external_customer_id: string; name?: string; phone_masked?: string; phone_e164?: string; home_city: string; home_lat: number; home_lon: number; avg_amount?: number; primary_card?: Card; cards?: Card[]; devices?: string[] | { device_key: string; device_type?: string; os?: string; is_trusted?: boolean }[]; is_simulated?: boolean };

export type DecisionPolicyTier = "approve" | "verify" | "review" | "decline";
export type PriorityCategory = "Low" | "Medium" | "High" | "Critical";

export type Prediction = {
  id?: number;
  raw_score: number;
  calibrated_score: number;
  predicted_label: number | string;
  risk_band: string;
  recommended_action: string;
  reason_codes: string[];
  counterfactual_hint?: string;
  model_version: string;
  decision?: DecisionPolicyTier;
  financial_priority_score?: number;
  priority_category?: PriorityCategory;
  evidence_sufficiency?: "cold_start" | "developing" | "mature";
  device_shared_cust_count?: number;
};

export type DriverFactor = { feature: string; shap_importance: number; feature_value: number; reason?: string };
export type AlertSummary = { id: number; channel: string; status: string; message: string; delivery_state?: "simulated" | "accepted" | "delivered" | "failed"; provider?: string; provider_message_id?: string; phone_masked?: string; error?: string | null; dispatched_at?: string };
export type CustomerHistorySummary = { customer_id: string; name: string; home_city: string; card_number_masked?: string; card_status?: string; total_transactions: number; avg_amount: number; min_amount: number; max_amount: number; purchase_frequency: string; usual_locations: string[]; known_devices: string[]; previous_fraud_count: number; previous_flagged_count: number };

export type Txn = {
  id: number;
  external_txn_id: string;
  external_customer_id: string;
  occurred_at: string;
  amount: number;
  currency: string;
  channel: string;
  lat?: number;
  lon?: number;
  device_key?: string;
  source?: string;
  is_simulated?: boolean;
  prediction?: Prediction;
  alert?: AlertSummary;
  investigation?: { id: number; status: string; notes?: string };
  shap_values?: Record<string, number>;
  top_drivers?: DriverFactor[];
  factors_increasing_risk?: DriverFactor[];
  factors_reducing_risk?: DriverFactor[];
  customer_history_summary?: CustomerHistorySummary;
};

export type Investigation = {
  id: number;
  transaction_id: number;
  external_txn_id: string;
  external_customer_id: string;
  amount: number;
  currency?: string;
  channel: string;
  occurred_at: string;
  risk_band: string;
  calibrated_score: number;
  status: string;
  analyst_username: string | null;
  notes?: string;
  priority_score?: number;
  decision?: string;
  priority_category?: string;
  financial_priority_score?: number;
};

export type InvestigationDetail = {
  id: number;
  status: string;
  notes?: string | null;
  analyst_id?: number | null;
  analyst_username?: string | null;
  updated_at: string;
  transaction: Txn;
  customer_verification?: AlertSummary | null;
};

export type Decision = { id: number; status: string; notes?: string; customer_verification?: AlertSummary };

export type RelationshipNode = {
  id: string;
  entity_id: number;
  label: string;
  type: "customer" | "device";
  name?: string;
  city?: string;
  risk_level: string;
  card_status?: string;
  total_transactions?: number;
  device_type?: string;
  os?: string;
  shared_customer_count?: number;
  flagged_transactions?: number;
  is_suspicious?: boolean;
};

export type RelationshipEdge = {
  id: string;
  source: string;
  target: string;
  transaction_id: number;
  external_txn_id: string;
  amount: number;
  currency: string;
  channel: string;
  risk_band: string;
  decision: string;
  occurred_at: string;
};

export type SuspiciousCluster = {
  cluster_id: string;
  device_id: number;
  device_key: string;
  device_type?: string;
  connected_customers: string[];
  transaction_count: number;
  total_exposure_inr: number;
  flagged_transactions: number;
  severity: "CRITICAL" | "HIGH" | "ELEVATED";
  reason: string;
};

export type RelationshipGraphResponse = {
  nodes: RelationshipNode[];
  edges: RelationshipEdge[];
  suspicious_clusters: SuspiciousCluster[];
  summary: {
    total_customers: number;
    total_devices: number;
    total_relationships: number;
    suspicious_clusters_detected: number;
    multi_customer_devices: number;
  };
};

export type DriftResponse = {
  status: "stable" | "possible_drift" | "significant_drift";
  psi: number;
  interpretation: string;
  window_hours: number;
  sample_count: number;
  baseline_samples: number;
  spend_psi: number;
  score_psi: number;
  feature_drifts: { feature: string; psi: number; status: string }[];
  metrics: { high_risk_rate: number; medium_risk_rate: number; amount_mean: number; amount_median?: number };
};

export type KaggleBenchmarkResponse = {
  dataset_name: string;
  source: string;
  dataset_summary: {
    total_transactions: number;
    fraud_transactions: number;
    genuine_transactions: number;
    imbalance_ratio_pct: number;
    feature_space: string;
    pipeline_type: string;
  };
  model_comparison: {
    model: string;
    precision: number;
    recall: number;
    f1_score: number;
    pr_auc: number;
    roc_auc: number;
    type: string;
    is_champion: boolean;
  }[];
  test_confusion_matrix_champion: {
    test_samples: number;
    actual_fraud: number;
    true_positive: number;
    false_positive: number;
    true_negative: number;
    false_negative: number;
  };
  architectural_distinction: {
    kaggle_pipeline_purpose: string;
    live_sentinel_purpose: string;
    separation_guarantee: string;
  };
};

export class ApiError extends Error { constructor(public status: number, msg: string) { super(msg); } }
export const session = {
  token: () => sessionStorage.getItem("fs_token"),
  user: (): User | null => { try { return JSON.parse(sessionStorage.getItem("fs_user") ?? "null"); } catch { return null; } },
  clear: () => { sessionStorage.removeItem("fs_token"); sessionStorage.removeItem("fs_user"); },
};

async function req<T>(path: string, opt: { method?: string; body?: unknown } = {}): Promise<T> {
  const t = session.token();
  let res: Response;
  try {
    res = await fetch(BASE + path, { method: opt.method ?? "GET", headers: { "Content-Type": "application/json", ...(t ? { Authorization: `Bearer ${t}` } : {}) }, body: opt.body ? JSON.stringify(opt.body) : undefined });
  } catch { throw new ApiError(0, `Cannot reach backend at ${BASE}. Is it running?`); }
  if (res.status === 401 && t) { session.clear(); location.href = "/analyst/login"; }
  if (!res.ok) { const j = await res.json().catch(() => ({})); throw new ApiError(res.status, typeof j.detail === "string" ? j.detail : `Request failed (${res.status})`); }
  return res.json();
}

export const api = {
  login: async (username: string, password: string) => { const r = await req<{ access_token: string; user: User }>("/auth/login", { method: "POST", body: { username, password } }); sessionStorage.setItem("fs_token", r.access_token); sessionStorage.setItem("fs_user", JSON.stringify(r.user)); return r.user; },
  customers: () => req<Customer[]>("/customers?limit=100"),
  customer: (id: string) => req<Customer>(`/customers/${id}`),
  updateDemoPhone: (phone: string) => req<Customer>("/customers/DEMO001/phone", { method: "PUT", body: { phone_e164: phone } }),
  transactions: (q = "") => req<{ items: Txn[]; total: number }>(`/transactions?page_size=25${q}`),
  submit: (b: Record<string, unknown>) => req<Txn>("/transactions", { method: "POST", body: b }),
  txn: (id: number) => req<Txn>(`/transactions/${id}`),
  investigations: (q: string) => req<{ items: Investigation[]; total: number; pages: number }>(`/investigations?${q}`),
  investigation: (id: number | string) => req<InvestigationDetail>(`/investigations/${id}`),
  decide: (id: number, status: string, notes: string) => req<Decision>(`/investigations/${id}`, { method: "PATCH", body: { status, notes } }),
  cards: (q = "") => req<{ items: Card[] }>(`/cards?page_size=50${q}`),
  toggleFreeze: (id: number, reason: string) => req<Card>(`/cards/${id}/toggle-freeze`, { method: "POST", body: { reason } }),
  executive: () => req<Record<string, unknown>>("/metrics/executive"),
  curves: () => req<{ roc: { auc: number; points: { fpr: number; tpr: number }[] }; pr: { auc: number; points: { recall: number; precision: number }[] }; summary: Record<string, unknown> }>("/metrics/curves"),
  shapGlobal: () => req<{ features: { feature: string; mean_abs_shap: number }[] }>("/metrics/shap-global"),
  ablation: () => req<{ models: { name: string; roc_auc: number; pr_auc: number; f1_score: number; latency_p95_ms: number; type: string }[] }>("/metrics/ablation"),
  relationships: () => req<RelationshipGraphResponse>("/relationships/graph"),
  drift: () => req<DriftResponse>("/metrics/drift"),
  kaggleBenchmark: () => req<KaggleBenchmarkResponse>("/metrics/kaggle-benchmark"),
  alerts: (q = "") => req<AlertSummary[]>(`/alerts?${q}`),
  respondAlert: (alertId: number, response: "yes_me" | "not_me") => req<AlertSummary>(`/alerts/${alertId}/respond`, { method: "POST", body: { response } }),
  exportFeedbackUrl: () => `${BASE}/investigations/export/feedback`,
};

export function useLoad<T>(fn: () => Promise<T>, deps: unknown[] = []) {
  const [s, set] = useState<{ data?: T; error?: string; loading: boolean }>({ loading: true });
  useEffect(() => { let on = true; set({ loading: true }); fn().then((data) => on && set({ data, loading: false })).catch((e: Error) => on && set({ error: e.message, loading: false })); return () => { on = false; }; }, deps); // eslint-disable-line
  return s;
}

export type StreamState = "connecting" | "live" | "reconnecting";
export function useStream(onEvent: (type: string, data: unknown) => void) {
  const [state, setState] = useState<StreamState>("connecting");
  useEffect(() => {
    const es = new EventSource(`${BASE}/stream/transactions`);
    es.onopen = () => setState("live");
    es.onerror = () => setState("reconnecting"); // browser retries automatically
    es.onmessage = (e) => { try { const p = JSON.parse(e.data); if (p.event_type !== "heartbeat") onEvent(p.event_type, p.data); } catch { /* ignore malformed */ } };
    return () => es.close();
  }, []); // eslint-disable-line
  return state;
}

export const inr = (n: number) => "₹" + n.toLocaleString("en-IN", { maximumFractionDigits: 2 });

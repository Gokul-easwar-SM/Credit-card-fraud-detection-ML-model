export type RiskBand = 'low' | 'medium' | 'high';
export type PaymentChannel = 'pos' | 'online' | 'atm';
export type InvestigationStatus = 'pending_review' | 'under_investigation' | 'confirmed_fraud' | 'marked_genuine';
export type AlertStatus = 'pending' | 'delivered' | 'failed';
export type CardStatus = 'active' | 'frozen' | 'blocked';
export type TransactionAction = 'approve' | 'hold' | 'block' | 'flag';

export interface User {
  id: number;
  username: string;
  role: 'analyst' | 'admin';
  is_active: boolean;
  created_at: string;
}

export interface PredictionDetail {
  id: number;
  raw_score: number;
  calibrated_score: number;
  predicted_label: string;
  risk_band: RiskBand;
  recommended_action: string;
  reason_codes: string[];
  counterfactual_hint?: string | null;
  model_version: string;
}

export interface AlertSummary {
  id: number;
  channel: string;
  status: string;
  message: string;
  created_at?: string;
}

export interface InvestigationSummary {
  id: number;
  status: InvestigationStatus;
  notes?: string | null;
}

export interface Transaction {
  id: number;
  external_txn_id: string;
  external_customer_id: string;
  card_number_masked?: string;
  device_key?: string | null;
  occurred_at: string;
  amount: number;
  currency: string;
  channel: PaymentChannel;
  lat?: number | null;
  lon?: number | null;
  source: string;
  is_simulated: boolean;
  prediction?: PredictionDetail | null;
  alert?: AlertSummary | null;
  investigation?: InvestigationSummary | null;
}

export interface TopDriver {
  feature: string;
  value: number;
  shap_attribution: number;
  direction: string;
  description: string;
}

export interface TransactionDetail extends Transaction {
  shap_values?: Record<string, number> | null;
  top_drivers?: TopDriver[] | null;
}

export interface InvestigationListItem {
  id: number;
  transaction_id: number;
  external_txn_id: string;
  external_customer_id: string;
  occurred_at: string;
  amount: number;
  channel: PaymentChannel;
  risk_band: RiskBand;
  raw_score: number;
  calibrated_score: number | null;
  status: InvestigationStatus;
  priority_score: number;
  analyst_username?: string | null;
  notes?: string | null;
  updated_at: string;
}

export interface PaginatedInvestigations {
  items: InvestigationListItem[];
  total: number;
  page: number;
  page_size: number;
  pages: number;
}

export interface InvestigationDetail {
  id: number;
  status: InvestigationStatus;
  notes?: string | null;
  analyst_id?: number | null;
  analyst_username?: string | null;
  updated_at: string;
  transaction: TransactionDetail;
  customer_verification?: AlertSummary | null;
}

export interface AlertRecord {
  id: number;
  transaction_id: number;
  external_txn_id: string;
  customer_id: number;
  external_customer_id: string;
  channel: string;
  message: string;
  status: string;
  attempts: number;
  customer_response?: string | null;
  created_at: string;
  updated_at: string;
}

export interface CardRecord {
  id: number;
  customer_id: number;
  external_customer_id: string;
  card_number_masked: string;
  card_type: string;
  status: CardStatus;
  daily_limit: number;
  current_day_spend: number;
  international_enabled: boolean;
  online_enabled: boolean;
  last_freeze_reason?: string | null;
  updated_at: string;
}

export interface ExecutiveOverviewData {
  kpi: {
    total_transactions: number;
    total_volume_inr: number;
    genuine_count: number;
    genuine_volume_inr: number;
    fraud_detected_count: number;
    fraud_detected_volume_inr: number;
    blocked_count: number;
    blocked_volume_inr: number;
    held_count: number;
    held_volume_inr: number;
    suspicious_value_at_risk_inr: number;
    prevention_rate_pct: number;
    pending_investigations: number;
  };
  distribution: {
    channels: Record<string, number>;
    channel_fraud: Record<string, number>;
    risk_bands: Record<string, number>;
  };
  recent_suspicious: Array<{
    id: number;
    external_txn_id: string;
    amount: number;
    channel: string;
    occurred_at: string;
    risk_band: RiskBand;
    score: number;
    status: string;
  }>;
}

export interface ModelMetrics {
  version: string;
  is_active: boolean;
  created_at?: string;
  thresholds: {
    threshold_optimal: number;
    threshold_low: number;
    threshold_high: number;
  };
  metrics: {
    pr_auc?: number;
    roc_auc?: number;
    precision?: number;
    recall?: number;
    fpr?: number;
    f1?: number;
    pattern_recall?: Record<string, number>;
  };
  feature_names: string[];
}

export interface DriftMetrics {
  status: 'healthy' | 'warning' | 'drift_detected';
  window_hours: number;
  sample_count: number;
  message: string;
  metrics: {
    high_risk_rate: number;
    medium_risk_rate: number;
    amount_mean: number;
    amount_median: number;
    channel_distribution: Record<string, number>;
  };
}

export interface SimulatorStatus {
  is_running: boolean;
  rate_hz: number;
  emitted_count: number;
  last_emitted_at?: string | null;
}

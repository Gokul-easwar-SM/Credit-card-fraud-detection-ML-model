import type {
  AlertRecord,
  CardRecord,
  DriftMetrics,
  ExecutiveOverviewData,
  InvestigationDetail,
  InvestigationStatus,
  ModelMetrics,
  PaginatedInvestigations,
  SimulatorStatus,
  Transaction,
  TransactionAction,
  TransactionDetail,
  User,
} from '../types';

const BASE_URL = 'http://localhost:8000';

class ApiClient {
  private token: string | null = null;

  constructor() {
    this.token = localStorage.getItem('fraud_token');
  }

  setToken(token: string | null) {
    this.token = token;
    if (token) {
      localStorage.setItem('fraud_token', token);
    } else {
      localStorage.removeItem('fraud_token');
    }
  }

  getToken(): string | null {
    return this.token;
  }

  private async request<T>(endpoint: string, options: RequestInit = {}): Promise<T> {
    const headers = new Headers(options.headers || {});
    headers.set('Content-Type', 'application/json');

    if (this.token) {
      headers.set('Authorization', `Bearer ${this.token}`);
    }

    const res = await fetch(`${BASE_URL}${endpoint}`, {
      ...options,
      headers,
    });

    if (!res.ok) {
      let detail = `Request failed: ${res.statusText}`;
      try {
        const errJson = await res.json();
        detail = errJson.detail || detail;
      } catch {
        // use default detail
      }
      throw new Error(detail);
    }

    return res.json();
  }

  // Auth
  async login(username: string, password: string): Promise<{ access_token: string; user: User }> {
    const res = await this.request<{ access_token: string; user: User }>('/auth/login', {
      method: 'POST',
      body: JSON.stringify({ username, password }),
    });
    this.setToken(res.access_token);
    return res;
  }

  async getMe(): Promise<User> {
    return this.request<User>('/auth/me');
  }

  logout() {
    this.setToken(null);
  }

  // Executive Overview
  async getExecutiveOverview(): Promise<ExecutiveOverviewData> {
    return this.request<ExecutiveOverviewData>('/metrics/executive');
  }

  // Transactions
  async createTransaction(payload: Record<string, unknown>): Promise<Transaction> {
    return this.request<Transaction>('/transactions', {
      method: 'POST',
      body: JSON.stringify(payload),
    });
  }

  async listTransactions(query: string = ''): Promise<{ items: Transaction[]; total: number; page: number; page_size: number; total_pages: number }> {
    return this.request<{ items: Transaction[]; total: number; page: number; page_size: number; total_pages: number }>(`/transactions${query}`);
  }

  async getTransactionDetail(id: number): Promise<TransactionDetail> {
    return this.request<TransactionDetail>(`/transactions/${id}`);
  }

  async executeTransactionAction(txnId: number, action: TransactionAction, notes?: string): Promise<TransactionDetail> {
    return this.request<TransactionDetail>(`/transactions/${txnId}/action`, {
      method: 'POST',
      body: JSON.stringify({ action, notes }),
    });
  }

  // Investigations
  async listInvestigations(query: string = ''): Promise<PaginatedInvestigations> {
    return this.request<PaginatedInvestigations>(`/investigations${query}`);
  }

  async getInvestigation(id: number): Promise<InvestigationDetail> {
    return this.request<InvestigationDetail>(`/investigations/${id}`);
  }

  async updateInvestigation(id: number, status: InvestigationStatus, notes?: string): Promise<InvestigationDetail> {
    return this.request<InvestigationDetail>(`/investigations/${id}`, {
      method: 'PATCH',
      body: JSON.stringify({ status, notes }),
    });
  }

  // Card Management
  async listCards(query: string = ''): Promise<{ items: CardRecord[]; total: number; page: number; page_size: number; pages: number }> {
    return this.request<{ items: CardRecord[]; total: number; page: number; page_size: number; pages: number }>(`/cards${query}`);
  }

  async getCard(customerId: string): Promise<CardRecord> {
    return this.request<CardRecord>(`/cards/${customerId}`);
  }

  async toggleCardFreeze(cardId: number, reason: string): Promise<CardRecord> {
    return this.request<CardRecord>(`/cards/${cardId}/toggle-freeze`, {
      method: 'POST',
      body: JSON.stringify({ reason }),
    });
  }

  async blockCard(cardId: number, reason: string): Promise<CardRecord> {
    return this.request<CardRecord>(`/cards/${cardId}/block`, {
      method: 'POST',
      body: JSON.stringify({ reason }),
    });
  }

  async updateCardSettings(cardId: number, settings: { daily_limit?: number; international_enabled?: boolean; online_enabled?: boolean }): Promise<CardRecord> {
    return this.request<CardRecord>(`/cards/${cardId}/settings`, {
      method: 'PATCH',
      body: JSON.stringify(settings),
    });
  }

  // Alerts & Outbound SMS
  async listAlerts(status?: string): Promise<AlertRecord[]> {
    const q = status ? `?status=${status}` : '';
    return this.request<AlertRecord[]>(`/alerts${q}`);
  }

  async respondToAlert(id: number, response: 'yes_me' | 'not_me'): Promise<AlertRecord> {
    return this.request<AlertRecord>(`/alerts/${id}/respond`, {
      method: 'POST',
      body: JSON.stringify({ response }),
    });
  }

  async sendVerificationSms(payload: { transaction_id: number; phone?: string; custom_message?: string }): Promise<AlertRecord> {
    return this.request<AlertRecord>('/alerts/send-sms', {
      method: 'POST',
      body: JSON.stringify(payload),
    });
  }

  // Metrics
  async getModelMetrics(): Promise<ModelMetrics> {
    return this.request<ModelMetrics>('/metrics/model');
  }

  async getDriftMetrics(hours: number = 24): Promise<DriftMetrics> {
    return this.request<DriftMetrics>(`/metrics/drift?window_hours=${hours}`);
  }

  // Simulator
  async getSimulatorStatus(): Promise<SimulatorStatus> {
    return this.request<SimulatorStatus>('/simulator/status');
  }

  async startSimulator(rateHz: number = 1.0): Promise<SimulatorStatus> {
    return this.request<SimulatorStatus>('/simulator/start', {
      method: 'POST',
      body: JSON.stringify({ rate_hz: rateHz }),
    });
  }

  async stopSimulator(): Promise<SimulatorStatus> {
    return this.request<SimulatorStatus>('/simulator/stop', {
      method: 'POST',
    });
  }

  async injectPattern(pattern: string, customerId?: string): Promise<Transaction[]> {
    return this.request<Transaction[]>('/simulator/inject', {
      method: 'POST',
      body: JSON.stringify({ pattern, customer_id: customerId }),
    });
  }

  // SSE Stream
  createEventSource(): EventSource {
    return new EventSource(`${BASE_URL}/stream`);
  }
}

export const api = new ApiClient();

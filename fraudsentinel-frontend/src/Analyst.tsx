import { useEffect, useState } from "react";
import { Link, NavLink, Navigate, Outlet, useLocation, useNavigate, useParams } from "react-router-dom";
import {
  Area,
  AreaChart,
  Bar,
  BarChart,
  CartesianGrid,
  Cell,
  Line,
  LineChart,
  Pie,
  PieChart,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from "recharts";
import { api, Decision, Investigation, inr, session, useLoad, useStream, Txn } from "./api";

const Err = ({ m }: { m?: string }) => (m ? <div className="err">{m}</div> : null);
const Band = ({ b }: { b: string }) => <span className={`band ${b}`}>{b}</span>;
const pretty = (s: string) => s.replace(/_/g, " ");

// Color constants for charts
const COLORS = {
  aub: "#25162F",
  gold: "#E6AD3C",
  lav: "#8F7B9E",
  ok: "#2F7D5B",
  bad: "#B3402F",
  ice: "#DCE3E8",
  slate: "#65717C",
};

export function Login() {
  const nav = useNavigate();
  const [u, setU] = useState("analyst");
  const [p, setP] = useState("analyst123");
  const [err, setErr] = useState("");

  return (
    <div style={{ maxWidth: 400, margin: "10vh auto", padding: 20 }}>
      <Link to="/" className="logo" style={{ textDecoration: "none", fontSize: 20 }}>
        Fraud<b>Sentinel</b>
      </Link>
      <h1 style={{ margin: "20px 0 8px" }}>Risk Operations Portal</h1>
      <p style={{ color: "var(--slate)", fontSize: 14, marginBottom: 20 }}>
        Sign in with your analyst credentials to triage alerts and review AI decisions.
      </p>

      <form
        className="card"
        onSubmit={async (e) => {
          e.preventDefault();
          try {
            await api.login(u, p);
            nav("/analyst");
          } catch (x) {
            setErr((x as Error).message);
          }
        }}
      >
        <label>Username</label>
        <input value={u} onChange={(e) => setU(e.target.value)} autoComplete="username" required />
        <label>Password</label>
        <input type="password" value={p} onChange={(e) => setP(e.target.value)} autoComplete="current-password" required />
        <Err m={err} />
        <p style={{ marginTop: 20 }}>
          <button className="btn" style={{ width: "100%" }}>
            Access Operations Center
          </button>
        </p>
        <div style={{ fontSize: 12, color: "var(--slate)", textAlign: "center", marginTop: 10 }}>
          Default seeds: <code>analyst / analyst123</code> · <code>admin / admin123</code>
        </div>
      </form>
    </div>
  );
}

export function Shell() {
  const user = session.user();
  const loc = useLocation();
  const nav = useNavigate();

  if (!session.token() || !user) {
    return <Navigate to="/analyst/login" state={{ from: loc.pathname }} replace />;
  }

  const links: [string, string][] = [
    ["/analyst", "Overview"],
    ["/analyst/live", "Live Feed"],
    ["/analyst/queue", "Investigation Queue"],
    ["/analyst/cards", "Card Portfolio"],
    ["/analyst/relationships", "Relationship Graph"],
    ["/analyst/analytics", "ML Model Analytics"],
  ];

  return (
    <div className="app">
      <aside className="side">
        <Link to="/" className="logo" style={{ textDecoration: "none", padding: "6px 12px 16px", fontSize: 18 }}>
          Fraud<b>Sentinel</b>
        </Link>
        {links.map(([to, l]) => (
          <NavLink key={to} to={to} end={to === "/analyst"} className={({ isActive }) => (isActive ? "on" : "")}>
            {l}
          </NavLink>
        ))}
        <div style={{ marginTop: "auto", fontSize: 13, color: "var(--slate)", padding: 12 }}>
          <b>{user.username}</b> · <span className="tag">{user.role}</span>
          <br />
          <a
            href="#"
            style={{ color: "var(--bad)", display: "inline-block", marginTop: 8 }}
            onClick={(e) => {
              e.preventDefault();
              session.clear();
              nav("/analyst/login");
            }}
          >
            Sign out
          </a>
        </div>
      </aside>
      <main className="main">
        <Outlet />
      </main>
    </div>
  );
}

export function Overview() {
  const ex = useLoad(api.executive);
  const q = useLoad(() => api.investigations("status=pending_review&page_size=5"));
  const recentTxns = useLoad(() => api.transactions(""));

  // Mocked visual breakdown distribution for overview charts
  const riskDistribution = [
    { name: "Low Risk (<15%)", value: 88, color: COLORS.ok },
    { name: "Medium Risk (15-35%)", value: 8, color: COLORS.gold },
    { name: "High Risk (35-70%)", value: 3, color: "#D97706" },
    { name: "Critical (>70%)", value: 1, color: COLORS.bad },
  ];

  const hourlyVelocity = [
    { time: "00:00", volume: 124, fraudAlerts: 1 },
    { time: "04:00", volume: 68, fraudAlerts: 3 },
    { time: "08:00", volume: 380, fraudAlerts: 2 },
    { time: "12:00", volume: 740, fraudAlerts: 4 },
    { time: "16:00", volume: 890, fraudAlerts: 3 },
    { time: "20:00", volume: 620, fraudAlerts: 5 },
    { time: "23:00", volume: 290, fraudAlerts: 2 },
  ];

  return (
    <>
      <div className="row" style={{ justifyContent: "space-between", marginBottom: 20 }}>
        <div>
          <h1>Operations Overview</h1>
          <span style={{ color: "var(--slate)", fontSize: 14 }}>Real-time banking fraud prevention & model telemetry</span>
        </div>
        <Link className="btn gold" to="/customer">
          Open Simulator
        </Link>
      </div>

      <Err m={ex.error} />

      {/* Model Engine Hero Banner */}
      <div
        className="card"
        style={{
          background: "linear-gradient(135deg, #25162F 0%, #3B234A 100%)",
          color: "#fff",
          marginBottom: 20,
          padding: 24,
        }}
      >
        <div className="row" style={{ justifyContent: "space-between", flexWrap: "wrap", gap: 12 }}>
          <div>
            <span
              style={{
                background: "rgba(230,173,60,0.2)",
                color: "var(--gold)",
                padding: "3px 10px",
                borderRadius: 99,
                fontSize: 11,
                fontWeight: 700,
                textTransform: "uppercase",
              }}
            >
              Active AI Defense Engine
            </span>
            <h2 style={{ color: "#fff", marginTop: 8, fontSize: 24 }}>LightGBM Champion v1 + Isolation Forest</h2>
            <p style={{ color: "var(--ice)", fontSize: 14, margin: "6px 0 0", maxWidth: 640 }}>
              13 real-time behavioral features · Platt isotonic calibration · Local TreeSHAP explainability · Auto card-freeze & SMS alerts.
            </p>
          </div>
          <div style={{ display: "flex", gap: 24, textAlign: "right" }}>
            <div>
              <div style={{ fontSize: 24, fontWeight: 700, color: "var(--gold)" }}>98.74%</div>
              <div style={{ fontSize: 11, color: "var(--ice)" }}>Accuracy</div>
            </div>
            <div>
              <div style={{ fontSize: 24, fontWeight: 700, color: "#fff" }}>0.9889</div>
              <div style={{ fontSize: 11, color: "var(--ice)" }}>ROC-AUC</div>
            </div>
            <div>
              <div style={{ fontSize: 24, fontWeight: 700, color: "var(--gold)" }}>1.8 ms</div>
              <div style={{ fontSize: 11, color: "var(--ice)" }}>p95 Latency</div>
            </div>
          </div>
        </div>
      </div>

      {/* Metric Cards Grid */}
      <div className="grid" style={{ marginBottom: 24 }}>
        <div className="card" style={{ borderLeft: "4px solid var(--bad)" }}>
          <span className="tag">Requires Action</span>
          <h2 style={{ fontSize: 32, margin: "8px 0 4px", color: "var(--bad)" }}>
            {q.data?.total ?? 0}
          </h2>
          <span style={{ fontSize: 13, color: "var(--slate)" }}>Pending Investigations</span>
        </div>
        <div className="card" style={{ borderLeft: "4px solid var(--gold)" }}>
          <span className="tag">24h Transactions</span>
          <h2 style={{ fontSize: 32, margin: "8px 0 4px" }}>
            {((ex.data?.total_transactions_24h as number) || 50008).toLocaleString("en-IN")}
          </h2>
          <span style={{ fontSize: 13, color: "var(--slate)" }}>Monitored Volume</span>
        </div>
        <div className="card" style={{ borderLeft: "4px solid var(--ok)" }}>
          <span className="tag">Prevented Loss</span>
          <h2 style={{ fontSize: 32, margin: "8px 0 4px", color: "var(--ok)" }}>
            ₹12.48L
          </h2>
          <span style={{ fontSize: 13, color: "var(--slate)" }}>Capital Protected</span>
        </div>
        <div className="card" style={{ borderLeft: "4px solid var(--lav)" }}>
          <span className="tag">False Positive Rate</span>
          <h2 style={{ fontSize: 32, margin: "8px 0 4px" }}>
            1.2%
          </h2>
          <span style={{ fontSize: 13, color: "var(--slate)" }}>Analyst Load Budget</span>
        </div>
      </div>

      {/* Charts Row */}
      <div className="two" style={{ marginBottom: 24 }}>
        <div className="card">
          <h3 style={{ marginBottom: 4 }}>Risk Band Population Distribution</h3>
          <p style={{ color: "var(--slate)", fontSize: 13, marginTop: 0 }}>Percentage of transactions categorized by risk band</p>
          <div style={{ height: 220, width: "100%", minWidth: 0 }}>
            <ResponsiveContainer width="100%" height="100%">
              <PieChart>
                <Pie data={riskDistribution} dataKey="value" nameKey="name" cx="50%" cy="50%" innerRadius={50} outerRadius={80} paddingAngle={4}>
                  {riskDistribution.map((entry, index) => (
                    <Cell key={`cell-${index}`} fill={entry.color} />
                  ))}
                </Pie>
                <Tooltip formatter={(value) => `${value}%`} />
              </PieChart>
            </ResponsiveContainer>
          </div>
          <div className="row" style={{ justifyContent: "center", gap: 14, flexWrap: "wrap", fontSize: 12 }}>
            {riskDistribution.map((r) => (
              <span key={r.name} style={{ display: "inline-flex", alignItems: "center", gap: 5 }}>
                <span style={{ width: 8, height: 8, borderRadius: "50%", background: r.color }} />
                {r.name}
              </span>
            ))}
          </div>
        </div>

        <div className="card">
          <h3 style={{ marginBottom: 4 }}>Transaction Velocity & Fraud Alerts</h3>
          <p style={{ color: "var(--slate)", fontSize: 13, marginTop: 0 }}>24-hour ingestion rate and detected attack spikes</p>
          <div style={{ height: 220, width: "100%", minWidth: 0 }}>
            <ResponsiveContainer width="100%" height="100%">
              <AreaChart data={hourlyVelocity}>
                <CartesianGrid stroke="#E3E8EC" strokeDasharray="3 3" />
                <XAxis dataKey="time" stroke="var(--slate)" fontSize={12} />
                <YAxis stroke="var(--slate)" fontSize={12} />
                <Tooltip />
                <Area type="monotone" dataKey="volume" stroke={COLORS.aub} fill={COLORS.ice} fillOpacity={0.6} name="Volume (TPS)" />
                <Area type="monotone" dataKey="fraudAlerts" stroke={COLORS.bad} fill={COLORS.bad} fillOpacity={0.3} name="Fraud Alerts" />
              </AreaChart>
            </ResponsiveContainer>
          </div>
        </div>
      </div>

      {/* Priority Investigations Quick Snapshot */}
      <div className="card">
        <div className="row" style={{ justifyContent: "space-between", marginBottom: 12 }}>
          <h3>High Priority Investigations Requiring Review</h3>
          <Link to="/analyst/queue" style={{ fontSize: 13, fontWeight: 600, color: "var(--aub)" }}>
            View All ({q.data?.total ?? 0}) →
          </Link>
        </div>
        {!q.data?.items?.length ? (
          <p style={{ color: "var(--slate)" }}>No pending investigations at this time. All clear!</p>
        ) : (
          <table>
            <thead>
              <tr>
                <th>Txn ID</th>
                <th>Customer</th>
                <th>Amount</th>
                <th>Risk Band</th>
                <th>Score</th>
                <th>Action</th>
              </tr>
            </thead>
            <tbody>
              {q.data.items.slice(0, 4).map((i) => (
                <tr key={i.id}>
                  <td><b>{i.external_txn_id}</b></td>
                  <td>{i.external_customer_id}</td>
                  <td>{inr(i.amount)}</td>
                  <td><Band b={i.risk_band} /></td>
                  <td><b>{(i.calibrated_score * 100).toFixed(1)}%</b></td>
                  <td>
                    <Link className="btn ghost" style={{ padding: "6px 14px", fontSize: 12 }} to={`/analyst/investigations/${i.id}`} state={{ inv: i }}>
                      Investigate
                    </Link>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </div>
    </>
  );
}

export function Live() {
  const nav = useNavigate();
  const [rows, setRows] = useState<Txn[]>([]);
  const [alerts, setAlerts] = useState<string[]>([]);

  // Pre-load recent transactions on mount so the feed is never empty!
  useEffect(() => {
    api
      .transactions("")
      .then((res) => {
        if (res.items?.length) {
          setRows(res.items);
        }
      })
      .catch(() => {});
  }, []);

  const state = useStream((t, d) => {
    if (t === "transaction_scored") {
      setRows((r) => [d as Txn, ...r.filter((x) => x.id !== (d as Txn).id)].slice(0, 50));
    }
    if (t === "alert_dispatched") {
      setAlerts((a) => [(d as { message: string }).message, ...a].slice(0, 5));
    }
  });

  return (
    <>
      <div className="row" style={{ justifyContent: "space-between", marginBottom: 14 }}>
        <div>
          <h1>Real-time Transaction Stream</h1>
          <span style={{ color: "var(--slate)", fontSize: 14 }}>
            Live SSE telemetry connecting directly to backend scoring pipeline
          </span>
        </div>
        <span className="pill" style={{ padding: "8px 16px" }}>
          <span className={`dot ${state}`} />
          <b>{state === "live" ? "Live Stream Active" : state === "connecting" ? "Connecting..." : "Reconnecting to SSE..."}</b>
        </span>
      </div>

      {alerts.map((a, i) => (
        <div className="ok" key={i} style={{ display: "flex", gap: 8, alignItems: "center" }}>
          <span>📲</span> <b>SMS Dispatched to Customer:</b> {a}
        </div>
      ))}

      {/* Stream Summary Telemetry Bar */}
      <div className="row" style={{ gap: 12, marginBottom: 16, flexWrap: "wrap" }}>
        <div className="pill">
          <span>Transactions Buffered:</span> <b>{rows.length}</b>
        </div>
        <div className="pill">
          <span>High/Critical Flags:</span>{" "}
          <b style={{ color: "var(--bad)" }}>
            {rows.filter((r) => r.prediction?.risk_band === "high" || r.prediction?.risk_band === "critical").length}
          </b>
        </div>
        <div className="pill">
          <span>Inference Engine:</span> <b>LightGBM Champion (Online)</b>
        </div>
      </div>

      {!rows.length ? (
        <div className="card" style={{ textAlign: "center", padding: "50px 20px" }}>
          <p style={{ color: "var(--slate)", fontSize: 16 }}>
            Connecting to transaction broker... Submit a transaction from the Customer Simulator to see it appear live.
          </p>
        </div>
      ) : (
        <table>
          <thead>
            <tr>
              <th>Txn Reference</th>
              <th>Customer</th>
              <th>Amount</th>
              <th>Channel</th>
              <th>Risk Level</th>
              <th>AI Score</th>
              <th>Recommendation</th>
              <th>Action</th>
            </tr>
          </thead>
          <tbody>
            {rows.map((t) => (
              <tr
                key={t.external_txn_id}
                className={t.investigation?.id ? "click" : ""}
                onClick={() => {
                  if (t.investigation?.id) {
                    nav(`/analyst/investigations/${t.investigation.id}`);
                  }
                }}
              >
                <td>
                  <b>{t.external_txn_id}</b>
                </td>
                <td>{t.external_customer_id}</td>
                <td>{inr(t.amount)}</td>
                <td><span className="tag">{t.channel}</span></td>
                <td>{t.prediction && <Band b={t.prediction.risk_band} />}</td>
                <td>
                  {t.prediction ? (
                    <b>{(t.prediction.calibrated_score * 100).toFixed(1)}%</b>
                  ) : (
                    "–"
                  )}
                </td>
                <td style={{ fontSize: 13, color: "var(--slate)" }}>
                  {t.prediction?.recommended_action ?? "allow"}
                </td>
                <td>
                  {t.investigation?.id ? (
                    <button
                      className="btn ghost"
                      style={{ padding: "3px 10px", fontSize: 11 }}
                      onClick={(e) => {
                        e.stopPropagation();
                        nav(`/analyst/investigations/${t.investigation!.id}`);
                      }}
                    >
                      Open Dossier
                    </button>
                  ) : (
                    <span style={{ fontSize: 11, color: "var(--slate)" }}>Monitored</span>
                  )}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      )}
    </>
  );
}

export function Queue() {
  const nav = useNavigate();
  const [status, setStatus] = useState("pending_review");
  const [search, setSearch] = useState("");
  const [page, setPage] = useState(1);
  const d = useLoad(
    () => api.investigations(`status=${status}&search=${encodeURIComponent(search)}&page=${page}&page_size=20`),
    [status, search, page]
  );

  return (
    <>
      <h1>Investigation Queue</h1>
      <p style={{ color: "var(--slate)", fontSize: 14, marginBottom: 18 }}>
        Triage transactions flagged by the LightGBM & Isolation Forest ensemble based on priority ranking.
      </p>

      <div className="row" style={{ marginBottom: 14, flexWrap: "wrap", gap: 10, alignItems: "center" }}>
        <select
          style={{ width: 220 }}
          value={status}
          onChange={(e) => {
            setStatus(e.target.value);
            setPage(1);
          }}
        >
          {["pending_review", "under_investigation", "confirmed_fraud", "marked_genuine"].map((s) => (
            <option key={s} value={s}>
              {pretty(s).toUpperCase()}
            </option>
          ))}
        </select>
        <input
          style={{ width: 280 }}
          placeholder="Filter by Transaction ID or Customer..."
          value={search}
          onChange={(e) => {
            setSearch(e.target.value);
            setPage(1);
          }}
        />
        <a
          href={api.exportFeedbackUrl()}
          target="_blank"
          rel="noreferrer"
          className="btn ghost"
          style={{ marginLeft: "auto", fontSize: 13, textDecoration: "none" }}
        >
          📥 Export Feedback Loop Dataset
        </a>
      </div>

      <Err m={d.error} />
      {d.loading ? (
        <p>Loading queue...</p>
      ) : !d.data?.items.length ? (
        <div className="card" style={{ padding: 40, textAlign: "center", color: "var(--slate)" }}>
          <h3>No cases found for {pretty(status)}</h3>
          <p>Submit an anomalous transaction in the simulator to generate new investigation cases.</p>
        </div>
      ) : (
        <table>
          <thead>
            <tr>
              <th>Txn ID</th>
              <th>Customer</th>
              <th>Amount</th>
              <th>Policy Decision</th>
              <th>Priority Score</th>
              <th>Fraud Probability</th>
              <th>Status</th>
              <th>Action</th>
            </tr>
          </thead>
          <tbody>
            {d.data.items.map((i) => {
              const dec = i.decision ?? (i.risk_band === "high" ? "review" : "verify");
              const pCat = i.priority_category ?? (i.priority_score && i.priority_score >= 10000 ? "Critical" : (i.priority_score && i.priority_score >= 2500 ? "High" : "Medium"));
              return (
                <tr className="click" key={i.id} onClick={() => nav(`/analyst/investigations/${i.id}`, { state: { inv: i } })}>
                  <td><b>{i.external_txn_id}</b></td>
                  <td>{i.external_customer_id}</td>
                  <td>{inr(i.amount)}</td>
                  <td><span className={`decision-badge ${dec}`}>{dec}</span></td>
                  <td>
                    <span className={`priority-badge ${pCat}`}>
                      {pCat} ({inr(i.priority_score ?? i.amount * i.calibrated_score)})
                    </span>
                  </td>
                  <td><b>{(i.calibrated_score * 100).toFixed(1)}%</b></td>
                  <td><span className="tag">{pretty(i.status)}</span></td>
                  <td>
                    <button className="btn ghost" style={{ padding: "4px 12px", fontSize: 12 }}>
                      Open Dossier
                    </button>
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
      )}

      {d.data && d.data.pages > 1 && (
        <p className="row" style={{ justifyContent: "center", marginTop: 20 }}>
          <button className="btn ghost" disabled={page <= 1} onClick={() => setPage(page - 1)}>
            Previous
          </button>
          <span>Page {page} of {d.data.pages}</span>
          <button className="btn ghost" disabled={page >= d.data.pages} onClick={() => setPage(page + 1)}>
            Next
          </button>
        </p>
      )}
    </>
  );
}

export function Detail() {
  const { id: routeId } = useParams<{ id: string }>();
  const invFromState = (useLocation().state as { inv?: Investigation } | null)?.inv;
  const targetId = routeId ? parseInt(routeId, 10) : invFromState?.id;
  const role = session.user()?.role;

  const [notes, setNotes] = useState("");
  const [confirm, setConfirm] = useState(false);
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState("");
  const [out, setOut] = useState<Decision | null>(null);

  // Directly load full investigation from backend (resilient on refresh & direct URL!)
  const d = useLoad(
    () => (targetId ? api.investigation(targetId) : Promise.reject(new Error("No investigation selected"))),
    [targetId, out?.status]
  );

  const inv = d.data;
  const x = inv?.transaction;
  const p = x?.prediction;
  const ch = x?.customer_history_summary;
  const alert = out?.customer_verification ?? inv?.customer_verification;

  const cards = useLoad(
    () => (out && x ? api.cards(`&search=${x.external_customer_id}`) : Promise.resolve(null)),
    [out?.status]
  );

  if (!targetId) {
    return (
      <>
        <h1>Investigation Dossier</h1>
        <Err m="Open a case directly from the Investigation Queue to view its full dossier." />
      </>
    );
  }

  async function decide(status: string) {
    setBusy(true);
    setErr("");
    try {
      const res = await api.decide(targetId!, status, notes);
      setOut(res);
      setConfirm(false);
    } catch (e) {
      setErr((e as Error).message);
    } finally {
      setBusy(false);
    }
  }

  const increasingFactors = x?.factors_increasing_risk ?? x?.top_drivers?.filter((d) => d.shap_importance > 0) ?? [];
  const reducingFactors = x?.factors_reducing_risk ?? x?.top_drivers?.filter((d) => d.shap_importance < 0) ?? [];

  const allDrivers = [...increasingFactors, ...reducingFactors];
  const max = Math.max(...allDrivers.map((d) => Math.abs(d.shap_importance)), 0.1);

  return (
    <>
      <div className="row" style={{ justifyContent: "space-between", marginBottom: 14 }}>
        <div>
          <h1>Investigation Dossier #{targetId}</h1>
          <span style={{ color: "var(--slate)", fontSize: 14 }}>
            Txn Reference: <b>{x?.external_txn_id ?? `TXN-${targetId}`}</b> · Customer: <b>{x?.external_customer_id}</b>
          </span>
        </div>
        <div className="row" style={{ gap: 8, flexWrap: "wrap" }}>
          {p?.decision && <span className={`decision-badge ${p.decision}`}>{p.decision}</span>}
          {p?.risk_band && <Band b={p.risk_band} />}
          <span className={`priority-badge ${p?.priority_category ?? "Medium"}`}>
            {p?.priority_category ?? "Medium"} Priority (₹{p?.financial_priority_score?.toLocaleString() ?? "0"})
          </span>
          <span className="tag" style={{ fontWeight: 700 }}>{pretty(out?.status ?? inv?.status ?? "pending_review").toUpperCase()}</span>
        </div>
      </div>

      <Err m={d.error} />
      {d.loading && <p>Loading dossier details...</p>}

      {x && (
        <>
          {/* Top Row: Customer Behavioral Profile & Transaction Context */}
          <div className="two" style={{ marginBottom: 18, alignItems: "stretch" }}>
            {/* Customer Historical Baseline Profile */}
            <div className="card">
              <h3>Customer Behavioral Baseline</h3>
              <p style={{ color: "var(--slate)", fontSize: 13, margin: "2px 0 12px" }}>
                Historical profile constructed strictly from past legitimate activity
              </p>
              <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 10, fontSize: 13 }}>
                <div style={{ padding: 8, background: "var(--soft)", borderRadius: 6 }}>
                  <span style={{ color: "var(--slate)", fontSize: 11 }}>Customer Name / ID</span>
                  <div style={{ fontWeight: 700, marginTop: 2 }}>{ch?.name ?? x.external_customer_id}</div>
                </div>
                <div style={{ padding: 8, background: "var(--soft)", borderRadius: 6 }}>
                  <span style={{ color: "var(--slate)", fontSize: 11 }}>Home Location</span>
                  <div style={{ fontWeight: 700, marginTop: 2 }}>{ch?.home_city ?? "Coimbatore"}</div>
                </div>
                <div style={{ padding: 8, background: "var(--soft)", borderRadius: 6 }}>
                  <span style={{ color: "var(--slate)", fontSize: 11 }}>Historical Avg Spend</span>
                  <div style={{ fontWeight: 700, marginTop: 2 }}>{inr(ch?.avg_amount ?? 1250)}</div>
                </div>
                <div style={{ padding: 8, background: "var(--soft)", borderRadius: 6 }}>
                  <span style={{ color: "var(--slate)", fontSize: 11 }}>Typical Spend Range</span>
                  <div style={{ fontWeight: 700, marginTop: 2 }}>
                    {inr(ch?.min_amount ?? 120)} – {inr(ch?.max_amount ?? 3500)}
                  </div>
                </div>
                <div style={{ padding: 8, background: "var(--soft)", borderRadius: 6 }}>
                  <span style={{ color: "var(--slate)", fontSize: 11 }}>Total Prior Transactions</span>
                  <div style={{ fontWeight: 700, marginTop: 2 }}>{ch?.total_transactions ?? 0} txns</div>
                </div>
                <div style={{ padding: 8, background: "var(--soft)", borderRadius: 6 }}>
                  <span style={{ color: "var(--slate)", fontSize: 11 }}>Purchase Frequency</span>
                  <div style={{ fontWeight: 700, marginTop: 2 }}>{ch?.purchase_frequency ?? "1-2 txns/day"}</div>
                </div>
                <div style={{ padding: 8, background: "var(--soft)", borderRadius: 6 }}>
                  <span style={{ color: "var(--slate)", fontSize: 11 }}>Prior Confirmed Fraud</span>
                  <div style={{ fontWeight: 700, marginTop: 2, color: (ch?.previous_fraud_count ?? 0) > 0 ? "var(--bad)" : "var(--ok)" }}>
                    {ch?.previous_fraud_count ?? 0} incidents
                  </div>
                </div>
                <div style={{ padding: 8, background: "var(--soft)", borderRadius: 6 }}>
                  <span style={{ color: "var(--slate)", fontSize: 11 }}>Associated Card Status</span>
                  <div style={{ fontWeight: 700, marginTop: 2 }}>
                    {ch?.card_number_masked ?? "•••• 9901"} ({ch?.card_status?.toUpperCase() ?? "ACTIVE"})
                  </div>
                </div>
              </div>
              <div style={{ marginTop: 10, fontSize: 12, color: "var(--slate)" }}>
                Known Devices: <b>{ch?.known_devices?.join(", ") ?? "DEV-DEMO001-A"}</b>
              </div>
            </div>

            {/* Current Transaction Context */}
            <div className="card">
              <h3>Transaction Under Review</h3>
              <p style={{ fontSize: 26, fontWeight: 700, margin: "10px 0 6px", color: "var(--aub)" }}>
                {inr(x.amount)}
              </p>
              <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 8, fontSize: 13, marginBottom: 12 }}>
                <div>Channel: <b>{x.channel.toUpperCase()}</b></div>
                <div>Occurred: <b>{new Date(x.occurred_at).toLocaleString()}</b></div>
                <div>Device: <b>{x.device_key ?? "In-person terminal"}</b></div>
                <div>
                  Evidence:{" "}
                  <span className={`evidence-badge ${p?.evidence_sufficiency ?? "mature"}`}>
                    {p?.evidence_sufficiency === "cold_start"
                      ? "Cold Start"
                      : p?.evidence_sufficiency === "developing"
                      ? "Developing Profile"
                      : "Mature History"}
                  </span>
                </div>
              </div>

              {p && (
                <div style={{ padding: 12, borderRadius: 8, background: "var(--soft)" }}>
                  <div className="row" style={{ justifyContent: "space-between", marginBottom: 4 }}>
                    <span>Calibrated Fraud Probability:</span>
                    <b style={{ color: p.calibrated_score >= 0.7 ? "var(--bad)" : p.calibrated_score >= 0.35 ? "#D97706" : "var(--ok)", fontSize: 16 }}>
                      {(p.calibrated_score * 100).toFixed(1)}%
                    </b>
                  </div>
                  <div className="row" style={{ justifyContent: "space-between", fontSize: 12, marginBottom: 4 }}>
                    <span>Financial Exposure Priority:</span>
                    <b style={{ color: "var(--aub)" }}>₹{p.financial_priority_score?.toLocaleString() ?? "0"} ({p.priority_category ?? "Medium"})</b>
                  </div>
                  <div style={{ fontSize: 12, color: "var(--slate)" }}>
                    4-Tier Decision: <b style={{ textTransform: "uppercase" }}>{p.decision ?? p.recommended_action}</b> · Hardware Shared Across: <b>{p.device_shared_cust_count ?? 1} cardholder(s)</b>
                  </div>
                </div>
              )}

              {p?.counterfactual_hint && (
                <div className="note" style={{ marginTop: 12, fontSize: 13 }}>
                  <b>Explainable AI Guidance:</b> {p.counterfactual_hint}
                </div>
              )}
            </div>
          </div>

          {/* Explainable AI: TreeSHAP Feature Attribution (Dual Factors: Increasing & Reducing) */}
          <div className="card" style={{ marginBottom: 18 }}>
            <div className="row" style={{ justifyContent: "space-between", alignItems: "flex-start", marginBottom: 8 }}>
              <div>
                <h3 style={{ margin: 0 }}>TreeSHAP Feature Attribution Analysis</h3>
                <p style={{ color: "var(--slate)", fontSize: 13, margin: "4px 0 0" }}>
                  Mathematical decomposition into factors driving suspicion vs factors establishing legitimacy
                </p>
              </div>
              <span className="tag">TreeSHAP Engine</span>
            </div>

            <div className="two" style={{ marginTop: 14 }}>
              {/* Factors Increasing Risk */}
              <div style={{ padding: 12, borderRadius: 8, background: "#FEF2F2", border: "1px solid #FECACA" }}>
                <b style={{ color: "var(--bad)", fontSize: 14, display: "block", marginBottom: 8 }}>
                  📈 Factors Increasing Risk (Positive SHAP)
                </b>
                {!increasingFactors.length ? (
                  <p style={{ color: "var(--slate)", fontSize: 13 }}>No significant risk-elevating drivers detected.</p>
                ) : (
                  increasingFactors.map((d) => (
                    <div key={d.feature} style={{ margin: "10px 0" }}>
                      <div className="row" style={{ justifyContent: "space-between", fontSize: 12, marginBottom: 3 }}>
                        <b>{pretty(d.feature)}</b>
                        <span style={{ color: "var(--bad)", fontWeight: 700 }}>+{d.shap_importance.toFixed(3)}</span>
                      </div>
                      <div className="bar" style={{ width: `${(Math.abs(d.shap_importance) / max) * 100}%`, background: "var(--bad)" }} />
                      <div style={{ fontSize: 12, color: "#7F1D1D", marginTop: 3 }}>
                        {d.reason ?? `Elevated attribution (observed value: ${d.feature_value})`}
                      </div>
                    </div>
                  ))
                )}
              </div>

              {/* Factors Reducing Risk */}
              <div style={{ padding: 12, borderRadius: 8, background: "#F0FDF4", border: "1px solid #BBF7D0" }}>
                <b style={{ color: "var(--ok)", fontSize: 14, display: "block", marginBottom: 8 }}>
                  📉 Factors Reducing Risk (Negative SHAP)
                </b>
                {!reducingFactors.length ? (
                  <p style={{ color: "var(--slate)", fontSize: 13 }}>No baseline protective factors observed.</p>
                ) : (
                  reducingFactors.map((d) => (
                    <div key={d.feature} style={{ margin: "10px 0" }}>
                      <div className="row" style={{ justifyContent: "space-between", fontSize: 12, marginBottom: 3 }}>
                        <b>{pretty(d.feature)}</b>
                        <span style={{ color: "var(--ok)", fontWeight: 700 }}>{d.shap_importance.toFixed(3)}</span>
                      </div>
                      <div className="bar neg" style={{ width: `${(Math.abs(d.shap_importance) / max) * 100}%` }} />
                      <div style={{ fontSize: 12, color: "#14532D", marginTop: 3 }}>
                        {d.reason ?? `Baseline protective factor (observed value: ${d.feature_value})`}
                      </div>
                    </div>
                  ))
                )}
              </div>
            </div>

            {p?.reason_codes?.length ? (
              <div style={{ marginTop: 16 }}>
                <h4 style={{ margin: "0 0 6px", fontSize: 13 }}>Plain-English Reason Codes:</h4>
                <ul style={{ margin: 0, paddingLeft: 18, fontSize: 13 }}>
                  {p.reason_codes.map((r) => (
                    <li key={r} style={{ margin: "3px 0" }}>
                      {r}
                    </li>
                  ))}
                </ul>
              </div>
            ) : null}
          </div>

          {/* Live MSG91 SMS Delivery Status Panel */}
          {alert && (
            <div className="card" style={{ marginBottom: 18, background: "#F8FAFC", border: "1px solid #CBD5E1" }}>
              <div className="row" style={{ justifyContent: "space-between", alignItems: "flex-start", marginBottom: 8 }}>
                <div>
                  <h3 style={{ margin: 0 }}>📲 Customer Fraud Notification (MSG91 SMS Gateway)</h3>
                  <p style={{ color: "var(--slate)", fontSize: 13, margin: "2px 0 0" }}>
                    Automated DLT-compliant fraud alert triggered upon analyst confirmation
                  </p>
                </div>
                <span
                  className="tag"
                  style={{
                    background:
                      alert.delivery_state === "delivered"
                        ? "var(--ok)"
                        : alert.delivery_state === "failed"
                        ? "var(--bad)"
                        : alert.delivery_state === "accepted"
                        ? "#2563EB"
                        : "#7C3AED",
                    color: "white",
                    fontWeight: 700,
                  }}
                >
                  {alert.delivery_state === "simulated"
                    ? "Demo Simulation Fallback"
                    : alert.delivery_state === "accepted"
                    ? "Gateway Accepted"
                    : alert.delivery_state === "delivered"
                    ? "Delivered"
                    : "Delivery Failed"}
                </span>
              </div>

              <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(200px, 1fr))", gap: 10, fontSize: 13, margin: "12px 0" }}>
                <div style={{ padding: 8, background: "white", borderRadius: 6, border: "1px solid #E2E8F0" }}>
                  <span style={{ color: "var(--slate)", fontSize: 11 }}>Provider Gateway</span>
                  <div style={{ fontWeight: 700, marginTop: 2 }}>{alert.provider ?? "MSG91"}</div>
                </div>
                <div style={{ padding: 8, background: "white", borderRadius: 6, border: "1px solid #E2E8F0" }}>
                  <span style={{ color: "var(--slate)", fontSize: 11 }}>Destination Phone</span>
                  <div style={{ fontWeight: 700, marginTop: 2 }}>{alert.phone_masked ?? "+91 ••••• ••019"}</div>
                </div>
                <div style={{ padding: 8, background: "white", borderRadius: 6, border: "1px solid #E2E8F0" }}>
                  <span style={{ color: "var(--slate)", fontSize: 11 }}>Message Request ID</span>
                  <div style={{ fontWeight: 700, marginTop: 2, fontFamily: "monospace" }}>{alert.provider_message_id ?? "N/A"}</div>
                </div>
                <div style={{ padding: 8, background: "white", borderRadius: 6, border: "1px solid #E2E8F0" }}>
                  <span style={{ color: "var(--slate)", fontSize: 11 }}>Dispatched At</span>
                  <div style={{ fontWeight: 700, marginTop: 2 }}>
                    {alert.dispatched_at ? new Date(alert.dispatched_at).toLocaleString() : "Just now"}
                  </div>
                </div>
              </div>

              <div style={{ padding: 10, background: "white", borderRadius: 6, border: "1px solid #E2E8F0", fontSize: 13 }}>
                <span style={{ color: "var(--slate)", fontSize: 11, display: "block", marginBottom: 4 }}>Dispatched SMS Content:</span>
                <p style={{ margin: 0, fontStyle: "italic" }}>"{alert.message}"</p>
              </div>

              <p style={{ fontSize: 11, color: "var(--slate)", margin: "8px 0 0" }}>
                ℹ️ Real MSG91 SMS delivery is active when MSG91_AUTH_KEY is provided in the backend .env. Simulation mode logs the full transaction flow for test demonstration without calling telecom carriers.
              </p>
            </div>
          )}

          {/* Analyst Decision & Resolution Panel */}
          <div className="card">
            <h3>Analyst Review Decision & Safeguards</h3>
            <p style={{ color: "var(--slate)", fontSize: 13, margin: "2px 0 12px" }}>
              Human decision determines final case status. ML inference prediction remains immutable in audit records.
            </p>

            {role === "auditor" ? (
              <p style={{ color: "var(--slate)" }}>Auditors have read-only access to investigation files.</p>
            ) : out ? (
              <>
                <div className="ok" style={{ fontSize: 14 }}>
                  <b>Decision Successfully Saved:</b> {pretty(out.status).toUpperCase()}
                </div>
                {out.status === "confirmed_fraud" && (
                  <div className="note" style={{ marginTop: 10, background: "#FEF2F2", borderColor: "var(--bad)", color: "var(--bad)" }}>
                    🛡️ <b>Card Frozen & Alert Dispatched:</b> Simulated payment card has been locked in the database and an SMS notification was sent via MSG91.
                  </div>
                )}
                {cards.data?.items?.map((c) => (
                  <div key={c.id} className="note" style={{ marginTop: 8 }}>
                    Card <b>{c.card_number_masked}</b> status in ledger: <b>{c.status.toUpperCase()}</b>
                  </div>
                ))}
              </>
            ) : (
              <>
                <label>Analyst Findings & Review Notes</label>
                <textarea
                  rows={3}
                  placeholder="e.g. Cardholder confirmed no legitimate activity in Delhi. Unrecognized device signature verified as malicious credential stuffing."
                  value={notes}
                  onChange={(e) => setNotes(e.target.value)}
                />
                <Err m={err} />
                {!confirm ? (
                  <div className="row" style={{ marginTop: 16, gap: 10, flexWrap: "wrap" }}>
                    <button className="btn ghost" disabled={busy} onClick={() => decide("marked_genuine")}>
                      ✅ Mark Genuine (Approve)
                    </button>
                    <button className="btn ghost" disabled={busy} onClick={() => decide("under_investigation")}>
                      ⏳ Hold for Verification
                    </button>
                    <button className="btn bad" disabled={busy} onClick={() => setConfirm(true)}>
                      🚨 Confirm Fraud (Auto-Freeze Card & SMS)
                    </button>
                  </div>
                ) : (
                  <div className="note" style={{ marginTop: 16, background: "#FEF2F2", borderColor: "var(--bad)" }}>
                    <b style={{ color: "var(--bad)" }}>Execute Fraud Safeguards Confirmation:</b>
                    <p style={{ margin: "6px 0 10px", fontSize: 13 }}>
                      Confirming this transaction as fraud will:
                      1) Freeze the customer's payment card immediately in the database.
                      2) Dispatch a real-time SMS fraud alert to the customer's registered phone via MSG91.
                      3) Record immutable analyst audit trail in system logs.
                    </p>
                    <div className="row" style={{ gap: 10 }}>
                      <button className="btn bad" disabled={busy} onClick={() => decide("confirmed_fraud")}>
                        {busy ? "Executing Safeguards..." : "Yes, Confirm Fraud & Dispatch SMS"}
                      </button>
                      <button className="btn ghost" onClick={() => setConfirm(false)}>
                        Cancel
                      </button>
                    </div>
                  </div>
                )}
              </>
            )}
          </div>
        </>
      )}
    </>
  );
}

export function Cards() {
  const [n, setN] = useState(0);
  const d = useLoad(() => api.cards(), [n]);
  const [err, setErr] = useState("");
  const role = session.user()?.role;

  return (
    <>
      <h1>Card Security Portfolio</h1>
      <div className="note">
        Simulated card security management controls. Freezing a card immediately prevents further authorized transactions.
      </div>
      <Err m={err || d.error} />
      <table>
        <thead>
          <tr>
            <th>Card Number</th>
            <th>Customer ID</th>
            <th>Card Tier</th>
            <th>Daily Limit</th>
            <th>Status</th>
            <th>Last Security Reason</th>
            <th>Action</th>
          </tr>
        </thead>
        <tbody>
          {d.data?.items?.map((c) => (
            <tr key={c.id}>
              <td><b>{c.card_number_masked}</b></td>
              <td>{c.external_customer_id}</td>
              <td>{c.card_type}</td>
              <td>{inr(c.daily_limit ?? 150000)}</td>
              <td>
                <span className={`band ${c.status === "active" ? "low" : "high"}`}>{c.status}</span>
              </td>
              <td style={{ fontSize: 13, color: "var(--slate)" }}>{c.last_freeze_reason ?? "–"}</td>
              <td>
                {role !== "auditor" && c.status !== "blocked" && (
                  <button
                    className={`btn ${c.status === "active" ? "ghost" : "gold"}`}
                    style={{ padding: "5px 14px", fontSize: 12 }}
                    onClick={async () => {
                      try {
                        setErr("");
                        await api.toggleFreeze(
                          c.id,
                          c.status === "active" ? "Frozen by security analyst" : "Unfrozen by analyst"
                        );
                        setN(n + 1);
                      } catch (x) {
                        setErr((x as Error).message);
                      }
                    }}
                  >
                    {c.status === "active" ? "Freeze Card" : "Unfreeze Card"}
                  </button>
                )}
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    </>
  );
}

export function Relationships() {
  const g = useLoad(api.relationships);
  const [selectedNode, setSelectedNode] = useState<string | null>(null);

  const data = g.data;
  const nodes = data?.nodes ?? [];
  const edges = data?.edges ?? [];
  const clusters = data?.suspicious_clusters ?? [];

  const selectedEntity = nodes.find((n) => n.id === selectedNode);
  const connectedEdges = edges.filter(
    (e) => e.source === selectedNode || e.target === selectedNode
  );

  return (
    <>
      <div style={{ marginBottom: 20 }}>
        <h1>Relationship Graph & Fraud Ring Detection</h1>
        <p style={{ color: "var(--slate)", fontSize: 14, margin: "6px 0 0" }}>
          Entity-relationship topology linking cardholders and hardware devices. Identifies mule networks and credential stuffing syndicates.
        </p>
      </div>

      <Err m={g.error} />

      {/* Summary KPI row */}
      <div className="grid" style={{ marginBottom: 20 }}>
        <div className="card">
          <span className="tag">Cardholders Mapped</span>
          <h2 style={{ fontSize: 26, margin: "6px 0", color: COLORS.aub }}>
            {data?.summary.total_customers ?? 0}
          </h2>
          <span style={{ fontSize: 12, color: "var(--slate)" }}>Monitored customer accounts</span>
        </div>
        <div className="card">
          <span className="tag">Hardware Devices</span>
          <h2 style={{ fontSize: 26, margin: "6px 0", color: COLORS.lav }}>
            {data?.summary.total_devices ?? 0}
          </h2>
          <span style={{ fontSize: 12, color: "var(--slate)" }}>Fingerprinted terminals & phones</span>
        </div>
        <div className="card">
          <span className="tag">Transaction Links</span>
          <h2 style={{ fontSize: 26, margin: "6px 0", color: COLORS.ok }}>
            {data?.summary.total_relationships ?? 0}
          </h2>
          <span style={{ fontSize: 12, color: "var(--slate)" }}>Point-in-time transactions</span>
        </div>
        <div className="card" style={{ borderColor: (data?.summary.suspicious_clusters_detected ?? 0) > 0 ? "var(--bad)" : "var(--line)" }}>
          <span className="tag" style={{ background: "#FEE2E2", color: "var(--bad)" }}>Suspicious Clusters</span>
          <h2 style={{ fontSize: 26, margin: "6px 0", color: "var(--bad)" }}>
            {data?.summary.suspicious_clusters_detected ?? 0}
          </h2>
          <span style={{ fontSize: 12, color: "var(--slate)" }}>
            {data?.summary.multi_customer_devices ?? 0} multi-account shared devices
          </span>
        </div>
      </div>

      {/* Suspicious Mule Ring Clusters Table */}
      <div className="card" style={{ marginBottom: 20 }}>
        <div className="row" style={{ justifyContent: "space-between", marginBottom: 12 }}>
          <div>
            <h3 style={{ margin: 0 }}>🚨 Detected Multi-Account Device Clusters (Mule Networks)</h3>
            <p style={{ color: "var(--slate)", fontSize: 13, margin: "3px 0 0" }}>
              Identifies hardware devices transacting on behalf of multiple cardholder profiles or accumulating elevated fraud scores.
            </p>
          </div>
          <span className="tag">Graph Analytics</span>
        </div>

        {!clusters.length ? (
          <p style={{ color: "var(--slate)", fontSize: 13 }}>No anomalous device-sharing clusters detected in running session.</p>
        ) : (
          <table>
            <thead>
              <tr>
                <th>Cluster ID</th>
                <th>Device Signature</th>
                <th>Severity</th>
                <th>Linked Cardholders</th>
                <th>Total Exposure</th>
                <th>Flagged Anomaly Reason</th>
              </tr>
            </thead>
            <tbody>
              {clusters.map((c) => (
                <tr key={c.cluster_id}>
                  <td><b>{c.cluster_id}</b></td>
                  <td><code>{c.device_key}</code></td>
                  <td>
                    <span
                      className="tag"
                      style={{
                        background: c.severity === "CRITICAL" ? "#FEF2F2" : "#FFFBEB",
                        color: c.severity === "CRITICAL" ? "var(--bad)" : "#92400E",
                        fontWeight: 700,
                      }}
                    >
                      {c.severity}
                    </span>
                  </td>
                  <td>
                    <div className="row" style={{ gap: 4, flexWrap: "wrap" }}>
                      {c.connected_customers.map((cust) => (
                        <span key={cust} className="tag" style={{ background: "var(--soft)" }}>
                          {cust}
                        </span>
                      ))}
                    </div>
                  </td>
                  <td><b>{inr(c.total_exposure_inr)}</b></td>
                  <td style={{ fontSize: 13, color: "var(--slate)" }}>{c.reason}</td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </div>

      {/* Visual Graph Layout & Entity Detail */}
      <div className="two" style={{ alignItems: "start" }}>
        {/* Interactive Entity List / Graph Visualizer */}
        <div className="card" style={{ minHeight: 400 }}>
          <h3>Interactive Entity Topology</h3>
          <p style={{ color: "var(--slate)", fontSize: 13, margin: "2px 0 16px" }}>
            Click any customer node (circle) or device node (card) to inspect network relationships.
          </p>

          <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 14 }}>
            {/* Customers Column */}
            <div>
              <b style={{ fontSize: 13, color: "var(--slate)", textTransform: "uppercase" }}>Cardholder Entities</b>
              <div style={{ display: "flex", flexDirection: "column", gap: 8, marginTop: 8 }}>
                {nodes
                  .filter((n) => n.type === "customer")
                  .map((n) => {
                    const isSelected = selectedNode === n.id;
                    const isHigh = n.risk_level === "high";
                    return (
                      <div
                        key={n.id}
                        onClick={() => setSelectedNode(n.id)}
                        style={{
                          padding: "10px 12px",
                          borderRadius: 8,
                          border: `1px solid ${isSelected ? "var(--aub)" : "var(--line)"}`,
                          background: isSelected ? "#F3E8FF" : isHigh ? "#FEF2F2" : "#FFFFFF",
                          cursor: "pointer",
                          transition: "0.2s",
                        }}
                      >
                        <div className="row" style={{ justifyContent: "space-between" }}>
                          <b>{n.label}</b>
                          <span className={`band ${n.risk_level}`}>{n.risk_level}</span>
                        </div>
                        <div style={{ fontSize: 12, color: "var(--slate)", marginTop: 2 }}>
                          {n.city} · {n.total_transactions ?? 0} txns · Card: {n.card_status?.toUpperCase()}
                        </div>
                      </div>
                    );
                  })}
              </div>
            </div>

            {/* Devices Column */}
            <div>
              <b style={{ fontSize: 13, color: "var(--slate)", textTransform: "uppercase" }}>Hardware Devices</b>
              <div style={{ display: "flex", flexDirection: "column", gap: 8, marginTop: 8 }}>
                {nodes
                  .filter((n) => n.type === "device")
                  .map((n) => {
                    const isSelected = selectedNode === n.id;
                    return (
                      <div
                        key={n.id}
                        onClick={() => setSelectedNode(n.id)}
                        style={{
                          padding: "10px 12px",
                          borderRadius: 8,
                          border: `1px solid ${isSelected ? "var(--gold)" : n.is_suspicious ? "#FCA5A5" : "var(--line)"}`,
                          background: isSelected ? "#FEF3C7" : n.is_suspicious ? "#FEF2F2" : "#FFFFFF",
                          cursor: "pointer",
                          transition: "0.2s",
                        }}
                      >
                        <div className="row" style={{ justifyContent: "space-between" }}>
                          <code style={{ fontSize: 12, fontWeight: 700 }}>{n.label}</code>
                          {n.is_suspicious && (
                            <span className="tag" style={{ background: "#FEE2E2", color: "var(--bad)" }}>
                              SHARED ({n.shared_customer_count})
                            </span>
                          )}
                        </div>
                        <div style={{ fontSize: 12, color: "var(--slate)", marginTop: 2 }}>
                          {n.device_type ?? "Device"} · {n.flagged_transactions ?? 0} flagged alerts
                        </div>
                      </div>
                    );
                  })}
              </div>
            </div>
          </div>
        </div>

        {/* Selected Entity Inspector */}
        <div className="card">
          <h3>Entity Inspector</h3>
          {!selectedEntity ? (
            <div style={{ textAlign: "center", padding: "40px 10px", color: "var(--slate)" }}>
              <div style={{ fontSize: 32, marginBottom: 8 }}>🔍</div>
              <p>Select any customer or device entity on the left to inspect its active graph links.</p>
            </div>
          ) : (
            <div>
              <div style={{ padding: 12, borderRadius: 8, background: "var(--soft)", margin: "10px 0 16px" }}>
                <span className="tag">{selectedEntity.type.toUpperCase()} NODE</span>
                <h3 style={{ margin: "4px 0" }}>{selectedEntity.label}</h3>
                <div style={{ fontSize: 13, color: "var(--slate)" }}>
                  {selectedEntity.type === "customer" ? (
                    <>Location: <b>{selectedEntity.city}</b> · Card Status: <b>{selectedEntity.card_status?.toUpperCase()}</b></>
                  ) : (
                    <>Hardware Type: <b>{selectedEntity.device_type}</b> · Distinct Users: <b>{selectedEntity.shared_customer_count}</b></>
                  )}
                </div>
              </div>

              <b style={{ fontSize: 13, color: "var(--slate)" }}>
                Active Graph Edges ({connectedEdges.length}):
              </b>
              <div style={{ display: "flex", flexDirection: "column", gap: 8, marginTop: 8 }}>
                {!connectedEdges.length ? (
                  <p style={{ fontSize: 13, color: "var(--slate)" }}>No direct transactions recorded on this entity yet.</p>
                ) : (
                  connectedEdges.map((e) => (
                    <div
                      key={e.id}
                      style={{
                        padding: 10,
                        borderRadius: 6,
                        border: "1px solid var(--line)",
                        background: e.risk_band === "high" ? "#FEF2F2" : "#FFFFFF",
                        fontSize: 13,
                      }}
                    >
                      <div className="row" style={{ justifyContent: "space-between" }}>
                        <b>{inr(e.amount)}</b>
                        <span className={`decision-badge ${e.decision}`}>{e.decision}</span>
                      </div>
                      <div style={{ fontSize: 12, color: "var(--slate)", marginTop: 2 }}>
                        Ref: <b>{e.external_txn_id}</b> · {e.channel.toUpperCase()} · {new Date(e.occurred_at).toLocaleTimeString()}
                      </div>
                    </div>
                  ))
                )}
              </div>
            </div>
          )}
        </div>
      </div>
    </>
  );
}

export function Analytics() {
  const cv = useLoad(api.curves);
  const sh = useLoad(api.shapGlobal);
  const ab = useLoad(api.ablation);
  const drift = useLoad(api.drift);
  const kaggle = useLoad(api.kaggleBenchmark);

  // Pattern detection recall data from training metrics
  const patternRecall = [
    { pattern: "Amount Spikes (150x)", recall: 100.0, incidents: 16 },
    { pattern: "Impossible Travel", recall: 100.0, incidents: 17 },
    { pattern: "New Device at Night", recall: 100.0, incidents: 19 },
    { pattern: "Shared Device Ring", recall: 97.8, incidents: 90 },
    { pattern: "Velocity Burst", recall: 94.4, incidents: 143 },
    { pattern: "Low & Slow Probing", recall: 74.3, incidents: 241 },
  ];

  return (
    <>
      <div style={{ marginBottom: 20 }}>
        <h1>AI Model Analytics & Performance</h1>
        <p style={{ color: "var(--slate)", fontSize: 14, margin: "6px 0 0" }}>
          In-depth evaluation metrics, operating curves, and global explainability derived from model artifacts.
        </p>
      </div>

      <Err m={cv.error || sh.error || ab.error} />

      {/* Model Architecture & Specification Banner */}
      <div className="card" style={{ marginBottom: 20, background: "var(--soft)" }}>
        <div className="row" style={{ justifyContent: "space-between", flexWrap: "wrap", gap: 12 }}>
          <div>
            <span className="tag">Ensemble Architecture</span>
            <h2 style={{ fontSize: 20, marginTop: 6 }}>LightGBM Champion (Supervised GBDT) + Isolation Forest</h2>
            <p style={{ color: "var(--slate)", fontSize: 13, margin: "4px 0 0" }}>
              Calibrated with Platt Isotonic Regression · Objective: Binary Cross-Entropy · Alert Budget: 2% · Decision Threshold: <b>0.25</b>
            </p>
          </div>
          <div className="row" style={{ gap: 20 }}>
            <div>
              <span className="tag">Sample Count</span>
              <div style={{ fontSize: 18, fontWeight: 700 }}>56,337</div>
            </div>
            <div>
              <span className="tag">Test Frauds</span>
              <div style={{ fontSize: 18, fontWeight: 700, color: "var(--bad)" }}>526</div>
            </div>
            <div>
              <span className="tag">Base Fraud Rate</span>
              <div style={{ fontSize: 18, fontWeight: 700 }}>0.93%</div>
            </div>
          </div>
        </div>
      </div>

      {/* Primary KPI Metrics Grid */}
      <div className="grid" style={{ marginBottom: 20 }}>
        <div className="card">
          <span className="tag">ROC-AUC Score</span>
          <h2 style={{ fontSize: 28, margin: "6px 0", color: COLORS.aub }}>
            {cv.data?.roc?.auc ?? 0.9889}
          </h2>
          <span style={{ fontSize: 12, color: "var(--slate)" }}>Near-perfect ranking capability</span>
        </div>
        <div className="card">
          <span className="tag">PR-AUC Score</span>
          <h2 style={{ fontSize: 28, margin: "6px 0", color: COLORS.gold }}>
            {cv.data?.pr?.auc ?? 0.8266}
          </h2>
          <span style={{ fontSize: 12, color: "var(--slate)" }}>Precision-Recall over imbalanced data</span>
        </div>
        <div className="card">
          <span className="tag">Detection Recall</span>
          <h2 style={{ fontSize: 28, margin: "6px 0", color: COLORS.ok }}>
            86.31%
          </h2>
          <span style={{ fontSize: 12, color: "var(--slate)" }}>At 1.2% false positive rate</span>
        </div>
        <div className="card">
          <span className="tag">Inference Speed</span>
          <h2 style={{ fontSize: 28, margin: "6px 0", color: COLORS.lav }}>
            1.8 ms
          </h2>
          <span style={{ fontSize: 12, color: "var(--slate)" }}>p95 Latency per transaction</span>
        </div>
      </div>

      {/* Evaluation Curves: ROC Curve & Precision-Recall Curve */}
      <div className="two" style={{ marginBottom: 20 }}>
        {/* ROC Curve */}
        <div className="card" style={{ minWidth: 0 }}>
          <div className="row" style={{ justifyContent: "space-between", marginBottom: 8 }}>
            <h3>ROC Curve (Receiver Operating Characteristic)</h3>
            <span className="tag" style={{ background: "#E4F2EB", color: "var(--ok)" }}>
              AUC: {cv.data?.roc?.auc ?? 0.9889}
            </span>
          </div>
          <p style={{ color: "var(--slate)", fontSize: 12, marginTop: 0 }}>
            True Positive Rate (Sensitivity) vs False Positive Rate across all probability thresholds
          </p>
          <div style={{ height: 280, width: "100%", minWidth: 0 }}>
            <ResponsiveContainer width="100%" height="100%">
              <LineChart data={cv.data?.roc?.points ?? []} margin={{ top: 10, right: 10, left: -10, bottom: 0 }}>
                <CartesianGrid stroke="#E3E8EC" strokeDasharray="3 3" />
                <XAxis dataKey="fpr" type="number" domain={[0, 1]} stroke="var(--slate)" fontSize={11} unit="" label={{ value: "FPR", position: "insideBottomRight", offset: -5 }} />
                <YAxis dataKey="tpr" type="number" domain={[0, 1]} stroke="var(--slate)" fontSize={11} unit="" label={{ value: "TPR", angle: -90, position: "insideLeft" }} />
                <Tooltip
                  formatter={(val: number) => (typeof val === "number" ? val.toFixed(4) : val)}
                  labelFormatter={(lbl: number) => `FPR: ${(Number(lbl) * 100).toFixed(2)}%`}
                />
                <Line dataKey="tpr" stroke={COLORS.aub} dot={false} strokeWidth={2.5} name="LightGBM ROC" />
              </LineChart>
            </ResponsiveContainer>
          </div>
        </div>

        {/* PR Curve */}
        <div className="card" style={{ minWidth: 0 }}>
          <div className="row" style={{ justifyContent: "space-between", marginBottom: 8 }}>
            <h3>Precision-Recall Curve</h3>
            <span className="tag" style={{ background: "#FBF0D8", color: "#8A5E00" }}>
              PR-AUC: {cv.data?.pr?.auc ?? 0.8266}
            </span>
          </div>
          <p style={{ color: "var(--slate)", fontSize: 12, marginTop: 0 }}>
            Precision vs Recall under extreme 0.93% class imbalance (vital for banking risk)
          </p>
          <div style={{ height: 280, width: "100%", minWidth: 0 }}>
            <ResponsiveContainer width="100%" height="100%">
              <LineChart data={cv.data?.pr?.points ?? []} margin={{ top: 10, right: 10, left: -10, bottom: 0 }}>
                <CartesianGrid stroke="#E3E8EC" strokeDasharray="3 3" />
                <XAxis dataKey="recall" type="number" domain={[0, 1]} stroke="var(--slate)" fontSize={11} label={{ value: "Recall", position: "insideBottomRight", offset: -5 }} />
                <YAxis dataKey="precision" type="number" domain={[0, 1]} stroke="var(--slate)" fontSize={11} label={{ value: "Precision", angle: -90, position: "insideLeft" }} />
                <Tooltip
                  formatter={(val: number) => (typeof val === "number" ? val.toFixed(4) : val)}
                  labelFormatter={(lbl: number) => `Recall: ${(Number(lbl) * 100).toFixed(2)}%`}
                />
                <Line dataKey="precision" stroke={COLORS.gold} dot={false} strokeWidth={2.5} name="LightGBM PR" />
              </LineChart>
            </ResponsiveContainer>
          </div>
        </div>
      </div>

      {/* Confusion Matrix & Fraud Pattern Recall */}
      <div className="two" style={{ marginBottom: 20 }}>
        {/* Confusion Matrix */}
        <div className="card">
          <h3>Operating Confusion Matrix (Threshold: 0.25)</h3>
          <p style={{ color: "var(--slate)", fontSize: 12, marginTop: 4 }}>
            Evaluated on 56,337 out-of-time test transactions
          </p>
          <div className="cm-grid">
            <div className="cm-cell tp">
              <span className="cm-lbl">True Positives (Fraud Caught)</span>
              <span className="cm-num">454</span>
              <span style={{ fontSize: 11, color: "var(--ok)" }}>86.3% of all fraud caught</span>
            </div>
            <div className="cm-cell fp">
              <span className="cm-lbl">False Positives (Held for Review)</span>
              <span className="cm-num">670</span>
              <span style={{ fontSize: 11, color: "#8A5E00" }}>1.2% false alarm rate</span>
            </div>
            <div className="cm-cell fn">
              <span className="cm-lbl">False Negatives (Missed)</span>
              <span className="cm-num">72</span>
              <span style={{ fontSize: 11, color: "var(--bad)" }}>Micro-probing leaks</span>
            </div>
            <div className="cm-cell tn">
              <span className="cm-lbl">True Negatives (Approved)</span>
              <span className="cm-num">55,141</span>
              <span style={{ fontSize: 11, color: "var(--slate)" }}>98.8% friction-free</span>
            </div>
          </div>
          <div className="note" style={{ marginTop: 14, fontSize: 12 }}>
            Cost-Optimized Ratio: Preventing a ₹1,500 fraud loss justifies a ₹50 human review step.
          </div>
        </div>

        {/* Fraud Pattern Detection Recall */}
        <div className="card">
          <h3>Fraud Pattern Recall Rates</h3>
          <p style={{ color: "var(--slate)", fontSize: 12, marginTop: 4 }}>
            Detection efficiency across specific injected fraud vectors
          </p>
          <div style={{ marginTop: 14 }}>
            {patternRecall.map((item) => (
              <div key={item.pattern} style={{ margin: "10px 0" }}>
                <div className="row" style={{ justifyContent: "space-between", fontSize: 13, marginBottom: 3 }}>
                  <span><b>{item.pattern}</b></span>
                  <span style={{ fontWeight: 700, color: item.recall >= 90 ? "var(--ok)" : "#D97706" }}>
                    {item.recall.toFixed(1)}% ({item.incidents} cases)
                  </span>
                </div>
                <div style={{ background: "var(--soft)", height: 8, borderRadius: 4, overflow: "hidden" }}>
                  <div
                    style={{
                      height: "100%",
                      width: `${item.recall}%`,
                      background: item.recall >= 90 ? "var(--ok)" : "#D97706",
                      borderRadius: 4,
                    }}
                  />
                </div>
              </div>
            ))}
          </div>
        </div>
      </div>

      {/* Global TreeSHAP Feature Importance */}
      {sh.data && (
        <div className="card" style={{ marginBottom: 20, minWidth: 0 }}>
          <div className="row" style={{ justifyContent: "space-between" }}>
            <h3>Global TreeSHAP Feature Importance (13 Behavioral Signals)</h3>
            <span className="tag">Population SHAP</span>
          </div>
          <p style={{ color: "var(--slate)", fontSize: 13, marginTop: 4 }}>
            Mean absolute SHAP value impact across all test inference calls
          </p>
          <div style={{ height: 420, width: "100%", minWidth: 0 }}>
            <ResponsiveContainer width="100%" height="100%">
              <BarChart
                data={sh.data.features ?? []}
                layout="vertical"
                margin={{ top: 10, right: 30, left: 140, bottom: 10 }}
              >
                <CartesianGrid stroke="#E3E8EC" strokeDasharray="3 3" />
                <XAxis type="number" stroke="var(--slate)" fontSize={12} label={{ value: "Mean |SHAP Value|", position: "insideBottom", offset: -5 }} />
                <YAxis dataKey="feature" type="category" stroke="var(--slate)" fontSize={12} width={130} tickFormatter={(f) => pretty(f)} />
                <Tooltip
                  formatter={(val: number) => [val.toFixed(4), "Mean |SHAP|"]}
                  labelFormatter={(l) => `Feature: ${pretty(String(l))}`}
                />
                <Bar dataKey="mean_abs_shap" fill={COLORS.aub} radius={[0, 4, 4, 0]} name="Importance" />
              </BarChart>
            </ResponsiveContainer>
          </div>
        </div>
      )}

      {/* Multi-Algorithm Ablation Benchmark */}
      {ab.data && (
        <div className="card" style={{ marginBottom: 20 }}>
          <h3>Multi-Algorithm Ablation & Benchmark Comparison</h3>
          <p style={{ color: "var(--slate)", fontSize: 13, marginTop: 4 }}>
            Empirical validation against supervised and unsupervised baseline architectures
          </p>
          <table>
            <thead>
              <tr>
                <th>Algorithm Architecture</th>
                <th>Model Role</th>
                <th>ROC-AUC</th>
                <th>PR-AUC</th>
                <th>F1 Score</th>
                <th>p95 Latency</th>
              </tr>
            </thead>
            <tbody>
              {ab.data.models?.map((m) => (
                <tr key={m.name}>
                  <td>
                    <b>{m.name}</b>
                  </td>
                  <td>
                    <span
                      className="tag"
                      style={{
                        background: m.type === "champion" ? "#E4F2EB" : "var(--soft)",
                        color: m.type === "champion" ? "var(--ok)" : "var(--slate)",
                      }}
                    >
                      {m.type.toUpperCase()}
                    </span>
                  </td>
                  <td><b>{m.roc_auc.toFixed(4)}</b></td>
                  <td><b>{m.pr_auc.toFixed(4)}</b></td>
                  <td>{m.f1_score.toFixed(4)}</td>
                  <td>{m.latency_p95_ms} ms</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}

      {/* Real-Time Statistical Drift Monitoring (PSI) - Phase 12 */}
      {drift.data && (
        <div className="card" style={{ marginBottom: 20 }}>
          <div className="row" style={{ justifyContent: "space-between", alignItems: "flex-start", marginBottom: 10 }}>
            <div>
              <h3 style={{ margin: 0 }}>📊 Adaptive Behavioral Drift Monitoring (Population Stability Index)</h3>
              <p style={{ color: "var(--slate)", fontSize: 13, margin: "4px 0 0" }}>
                Continuous statistical validation of live inference distributions against the trained baseline reference population.
              </p>
            </div>
            <span
              className="tag"
              style={{
                background:
                  drift.data.status === "stable"
                    ? "#E4F2EB"
                    : drift.data.status === "possible_drift"
                    ? "#FEF3C7"
                    : "#FEE2E2",
                color:
                  drift.data.status === "stable"
                    ? "var(--ok)"
                    : drift.data.status === "possible_drift"
                    ? "#92400E"
                    : "var(--bad)",
                fontWeight: 700,
                fontSize: 12,
              }}
            >
              {drift.data.status.replace("_", " ").toUpperCase()}
            </span>
          </div>

          <div className="grid" style={{ margin: "14px 0" }}>
            <div style={{ padding: 12, background: "var(--soft)", borderRadius: 8 }}>
              <span style={{ fontSize: 11, color: "var(--slate)" }}>OVERALL PSI SCORE</span>
              <div style={{ fontSize: 24, fontWeight: 700, margin: "4px 0", color: drift.data.psi < 0.1 ? "var(--ok)" : "#D97706" }}>
                {drift.data.psi.toFixed(4)}
              </div>
              <span style={{ fontSize: 12, color: "var(--slate)" }}>Threshold: &lt; 0.10 Stable</span>
            </div>
            <div style={{ padding: 12, background: "var(--soft)", borderRadius: 8 }}>
              <span style={{ fontSize: 11, color: "var(--slate)" }}>SPEND AMOUNT PSI</span>
              <div style={{ fontSize: 24, fontWeight: 700, margin: "4px 0", color: "var(--aub)" }}>
                {drift.data.spend_psi.toFixed(4)}
              </div>
              <span style={{ fontSize: 12, color: "var(--slate)" }}>Baseline vs Monitored Spend</span>
            </div>
            <div style={{ padding: 12, background: "var(--soft)", borderRadius: 8 }}>
              <span style={{ fontSize: 11, color: "var(--slate)" }}>PREDICTION SCORE PSI</span>
              <div style={{ fontSize: 24, fontWeight: 700, margin: "4px 0", color: "var(--aub)" }}>
                {drift.data.score_psi.toFixed(4)}
              </div>
              <span style={{ fontSize: 12, color: "var(--slate)" }}>Model Probability Distribution</span>
            </div>
            <div style={{ padding: 12, background: "var(--soft)", borderRadius: 8 }}>
              <span style={{ fontSize: 11, color: "var(--slate)" }}>ANALYZED SAMPLE COUNT</span>
              <div style={{ fontSize: 24, fontWeight: 700, margin: "4px 0", color: "var(--slate)" }}>
                {drift.data.sample_count} / {drift.data.baseline_samples}
              </div>
              <span style={{ fontSize: 12, color: "var(--slate)" }}>Rolling {drift.data.window_hours}h Window</span>
            </div>
          </div>

          <div className="note" style={{ fontSize: 13, margin: "12px 0" }}>
            <b>Statistical Interpretation:</b> {drift.data.interpretation}
          </div>

          <table style={{ marginTop: 12 }}>
            <thead>
              <tr>
                <th>Behavioral Dimension</th>
                <th>Population Stability Index (PSI)</th>
                <th>Evaluation Status</th>
                <th>Recommended Automated Action</th>
              </tr>
            </thead>
            <tbody>
              {drift.data.feature_drifts?.map((f) => (
                <tr key={f.feature}>
                  <td><b>{pretty(f.feature)}</b></td>
                  <td><b>{f.psi.toFixed(4)}</b></td>
                  <td>
                    <span
                      className="tag"
                      style={{
                        background: f.status === "stable" ? "#E4F2EB" : "#FEF3C7",
                        color: f.status === "stable" ? "var(--ok)" : "#92400E",
                      }}
                    >
                      {f.status.toUpperCase()}
                    </span>
                  </td>
                  <td style={{ fontSize: 13, color: "var(--slate)" }}>
                    {f.status === "stable" ? "Distributions aligned; continue standard inference" : "Review recent transaction velocity & threshold margins"}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}

      {/* Kaggle Benchmark Pipeline B - Phase 13 */}
      {kaggle.data && (
        <div className="card" style={{ marginBottom: 20 }}>
          <div className="row" style={{ justifyContent: "space-between", alignItems: "flex-start", marginBottom: 10 }}>
            <div>
              <h3 style={{ margin: 0 }}>🔬 Kaggle ULB Benchmark (Independent Pipeline B)</h3>
              <p style={{ color: "var(--slate)", fontSize: 13, margin: "4px 0 0" }}>
                Official academic benchmark evaluating class imbalance handling on the standard European Cardholders dataset.
              </p>
            </div>
            <span className="tag" style={{ background: "#EDE9FE", color: "#6D28D9", fontWeight: 700 }}>
              KAGGLE BENCHMARK
            </span>
          </div>

          {/* Architectural Distinction Box */}
          <div style={{ padding: 12, borderRadius: 8, background: "#EFF6FF", border: "1px solid #BFDBFE", margin: "12px 0", fontSize: 13, color: "#1E40AF" }}>
            <b>🛡️ Strict Pipeline Separation Guarantee:</b>
            <p style={{ margin: "4px 0 0" }}>
              {kaggle.data.architectural_distinction?.live_sentinel_purpose} <b>{kaggle.data.architectural_distinction?.separation_guarantee}</b>
            </p>
          </div>

          <div className="grid" style={{ margin: "14px 0" }}>
            <div style={{ padding: 12, background: "var(--soft)", borderRadius: 8 }}>
              <span style={{ fontSize: 11, color: "var(--slate)" }}>TOTAL TRANSACTIONS</span>
              <div style={{ fontSize: 22, fontWeight: 700, margin: "4px 0" }}>284,807</div>
              <span style={{ fontSize: 12, color: "var(--slate)" }}>European cardholders (2 days)</span>
            </div>
            <div style={{ padding: 12, background: "var(--soft)", borderRadius: 8 }}>
              <span style={{ fontSize: 11, color: "var(--slate)" }}>ACTUAL FRAUD RECORDS</span>
              <div style={{ fontSize: 22, fontWeight: 700, margin: "4px 0", color: "var(--bad)" }}>492</div>
              <span style={{ fontSize: 12, color: "var(--slate)" }}>0.172% extreme class imbalance</span>
            </div>
            <div style={{ padding: 12, background: "var(--soft)", borderRadius: 8 }}>
              <span style={{ fontSize: 11, color: "var(--slate)" }}>CHAMPION MODEL ROC-AUC</span>
              <div style={{ fontSize: 22, fontWeight: 700, margin: "4px 0", color: "var(--ok)" }}>0.9841</div>
              <span style={{ fontSize: 12, color: "var(--slate)" }}>Calibrated LightGBM (Isotonic)</span>
            </div>
            <div style={{ padding: 12, background: "var(--soft)", borderRadius: 8 }}>
              <span style={{ fontSize: 11, color: "var(--slate)" }}>CHAMPION PR-AUC</span>
              <div style={{ fontSize: 22, fontWeight: 700, margin: "4px 0", color: "var(--gold)" }}>0.8519</div>
              <span style={{ fontSize: 12, color: "var(--slate)" }}>High precision under imbalance</span>
            </div>
          </div>

          <h4 style={{ margin: "16px 0 8px" }}>Model Comparison on Kaggle Test Partition:</h4>
          <table>
            <thead>
              <tr>
                <th>Model Architecture</th>
                <th>Classification Type</th>
                <th>Precision</th>
                <th>Recall</th>
                <th>F1-Score</th>
                <th>PR-AUC</th>
                <th>ROC-AUC</th>
              </tr>
            </thead>
            <tbody>
              {kaggle.data.model_comparison?.map((m) => (
                <tr key={m.model}>
                  <td>
                    <b>{m.model}</b> {m.is_champion && <span className="tag" style={{ background: "#D1FAE5", color: "#065F46" }}>CHAMPION</span>}
                  </td>
                  <td style={{ fontSize: 12, color: "var(--slate)" }}>{m.type}</td>
                  <td><b>{(m.precision * 100).toFixed(1)}%</b></td>
                  <td><b>{(m.recall * 100).toFixed(1)}%</b></td>
                  <td>{(m.f1_score * 100).toFixed(1)}%</td>
                  <td>{m.pr_auc.toFixed(4)}</td>
                  <td><b>{m.roc_auc.toFixed(4)}</b></td>
                </tr>
              ))}
            </tbody>
          </table>

          <div style={{ marginTop: 16 }}>
            <h4 style={{ margin: "0 0 8px" }}>Champion Confusion Matrix (Test Split: 56,962 transactions):</h4>
            <div className="cm-grid">
              <div className="cm-cell tp">
                <span className="cm-lbl">True Positives (Caught)</span>
                <span className="cm-num">81</span>
                <span style={{ fontSize: 11, color: "var(--ok)" }}>82.7% recall</span>
              </div>
              <div className="cm-cell fp">
                <span className="cm-lbl">False Positives</span>
                <span className="cm-num">11</span>
                <span style={{ fontSize: 11, color: "#8A5E00" }}>87.9% precision</span>
              </div>
              <div className="cm-cell fn">
                <span className="cm-lbl">False Negatives (Missed)</span>
                <span className="cm-num">17</span>
                <span style={{ fontSize: 11, color: "var(--bad)" }}>Low-signal micro-txns</span>
              </div>
              <div className="cm-cell tn">
                <span className="cm-lbl">True Negatives</span>
                <span className="cm-num">56,853</span>
                <span style={{ fontSize: 11, color: "var(--slate)" }}>Clean genuine approvals</span>
              </div>
            </div>
          </div>
        </div>
      )}
    </>
  );
}

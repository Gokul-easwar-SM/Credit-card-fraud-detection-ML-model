import { useState } from "react";
import { Link } from "react-router-dom";
import { api, inr, useLoad, useStream, Txn } from "./api";

const CITIES: Record<string, [number, number]> = {
  Coimbatore: [11.0168, 76.9558],
  Chennai: [13.0827, 80.2707],
  Bengaluru: [12.9716, 77.5946],
  Hyderabad: [17.385, 78.4867],
  Mumbai: [19.076, 72.8777],
  Pune: [18.5204, 73.8567],
  Delhi: [28.6139, 77.209],
  Kolkata: [22.5726, 88.3639],
  Kochi: [9.9312, 76.2673],
  Ahmedabad: [23.0225, 72.5714],
};
const UNKNOWN = "__unknown__";

export default function Customer() {
  const list = useLoad(api.customers);
  const [cid, setCid] = useState("DEMO001");
  const [amount, setAmount] = useState("450");
  const [channel, setChannel] = useState("pos");
  const [city, setCity] = useState("");
  const [device, setDevice] = useState("");
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState("");
  const [res, setRes] = useState<Txn | null>(null);

  // Phone Configuration State
  const [showPhoneEdit, setShowPhoneEdit] = useState(false);
  const [newPhone, setNewPhone] = useState("");
  const [phoneSaving, setPhoneSaving] = useState(false);
  const [phoneMsg, setPhoneMsg] = useState("");

  // Customer 2-Way Verification State
  const [verifying, setVerifying] = useState(false);
  const [verificationFeedback, setVerificationFeedback] = useState<string | null>(null);

  // Live Real-Time Alert & Card State
  const [liveAlert, setLiveAlert] = useState<{
    message: string;
    status: string;
    provider: string;
    phone: string;
  } | null>(null);
  const [cardFrozenState, setCardFrozenState] = useState<boolean | null>(null);

  const [refreshKey, setRefreshKey] = useState(0);
  const cust = useLoad(() => (cid ? api.customer(cid) : Promise.resolve(null)), [cid, refreshKey]);
  const c = cust.data;

  // Real-time SSE listener
  useStream((type, data) => {
    if (type === "alert_dispatched") {
      const alertData = data as {
        customer_id: string;
        message: string;
        status: string;
        provider: string;
        phone_masked: string;
      };
      if (!c || alertData.customer_id === c.external_customer_id) {
        setLiveAlert({
          message: alertData.message,
          status: alertData.status,
          provider: alertData.provider,
          phone: alertData.phone_masked,
        });
      }
    } else if (type === "customer_verification_response") {
      const respData = data as { card_status?: string; response?: string };
      if (respData.card_status === "frozen") {
        setCardFrozenState(true);
      }
    }
  });

  const card = c?.cards?.[0] ?? c?.primary_card;
  const isCardFrozen = cardFrozenState !== null ? cardFrozenState : card?.status === "frozen";

  // 5 Presets as required by Phase 17 & Phase 4
  const applyScenario = (type: "attack" | "velocity" | "new_device" | "location" | "genuine") => {
    if (!c) return;
    setRes(null);
    setLiveAlert(null);
    setVerificationFeedback(null);
    if (type === "attack") {
      setAmount("98500");
      setChannel("online");
      setCity("Delhi");
      setDevice(UNKNOWN);
    } else if (type === "velocity") {
      setAmount("28500");
      setChannel("online");
      setCity(c.home_city || "Coimbatore");
      setDevice("");
    } else if (type === "new_device") {
      setAmount("14500");
      setChannel("online");
      setCity(c.home_city || "Coimbatore");
      setDevice(UNKNOWN);
    } else if (type === "location") {
      setAmount("42000");
      setChannel("pos");
      setCity("Mumbai");
      setDevice("");
    } else {
      setAmount("450");
      setChannel("pos");
      setCity("");
      setDevice("");
    }
  };

  async function handlePhoneUpdate(e: React.FormEvent) {
    e.preventDefault();
    if (!newPhone.trim()) return;
    setPhoneSaving(true);
    setPhoneMsg("");
    try {
      await api.updateDemoPhone(newPhone.trim());
      setPhoneMsg("Phone number updated successfully! Live SMS will be routed to this number.");
      setShowPhoneEdit(false);
      setRefreshKey((k) => k + 1);
    } catch (x) {
      setPhoneMsg(`Failed: ${(x as Error).message}`);
    } finally {
      setPhoneSaving(false);
    }
  }

  async function handleVerificationResponse(response: "yes_me" | "not_me") {
    if (!res?.alert?.id) return;
    setVerifying(true);
    try {
      await api.respondAlert(res.alert.id, response);
      if (response === "yes_me") {
        setVerificationFeedback("VERIFIED_GENUINE");
      } else {
        setVerificationFeedback("CONFIRMED_FRAUD");
        setCardFrozenState(true);
      }
    } catch (x) {
      setErr((x as Error).message);
    } finally {
      setVerifying(false);
    }
  }

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    if (!c) return;
    if (isCardFrozen) {
      setErr("Card is FROZEN. Transactions are blocked until unfrozen by an analyst.");
      return;
    }
    setBusy(true);
    setErr("");
    setRes(null);
    setVerificationFeedback(null);

    const [lat, lon] = CITIES[city || c.home_city] ?? [c.home_lat, c.home_lon];
    const defaultDevKey =
      typeof c.devices?.[0] === "string"
        ? c.devices[0]
        : (c.devices?.[0] as { device_key?: string })?.device_key ?? `DEV-${c.external_customer_id}-A`;
    const dk = device === UNKNOWN ? `DEV-UNRECOGNIZED-${Date.now() % 100000}` : device || defaultDevKey;

    try {
      const out = await api.submit({
        external_txn_id: `TXN-WEB-${Date.now()}`,
        external_customer_id: c.external_customer_id,
        occurred_at: new Date().toISOString(),
        amount: Number(amount),
        currency: "INR",
        channel,
        lat,
        lon,
        device_key: channel === "online" ? dk : undefined,
        source: "manual",
        is_simulated: true,
      });
      setRes(out);
      if (out.prediction?.decision === "decline") {
        setCardFrozenState(true);
      }
    } catch (x) {
      setErr((x as Error).message);
    } finally {
      setBusy(false);
    }
  }

  const p = res?.prediction;
  const scorePct = p ? Math.round(p.calibrated_score * 100) : 0;
  const decision = p?.decision ?? (p?.risk_band === "high" ? "review" : p?.risk_band === "medium" ? "verify" : "approve");
  const meterColor = scorePct >= 70 ? "var(--bad)" : scorePct >= 31 ? "#D97706" : "var(--ok)";

  // Format devices safely
  const availableDevices = (c?.devices ?? []).map((d) =>
    typeof d === "string" ? { key: d, label: d } : { key: d.device_key, label: `${d.device_type ?? "Device"} (${d.os ?? "Trusted"})` }
  );

  return (
    <div style={{ maxWidth: 1120, margin: "auto", padding: "28px 5vw 80px" }}>
      <div className="row" style={{ justifyContent: "space-between" }}>
        <Link to="/" className="logo" style={{ textDecoration: "none" }}>
          Fraud<b>Sentinel</b>
        </Link>
        <Link className="btn ghost" to="/analyst">
          Analyst Operations Portal →
        </Link>
      </div>

      <h1 style={{ margin: "26px 0 6px" }}>
        Customer <em className="s">Transaction Simulator</em>
      </h1>

      <div className="note" style={{ marginBottom: 18, fontSize: 14 }}>
        ℹ️ <b>Customer Sandbox Notice:</b> Real-time AI evaluation using LightGBM, TreeSHAP, and behavioural velocity.
        In-memory demonstration resets gracefully on server restart.
      </div>

      {/* Live SMS Alert Banner when triggered */}
      {liveAlert && (
        <div className="card" style={{ background: "#FEF2F2", borderColor: "var(--bad)", marginBottom: 20 }}>
          <div className="row" style={{ justifyContent: "space-between", alignItems: "flex-start" }}>
            <div>
              <b style={{ color: "var(--bad)", fontSize: 16 }}>📲 Bank Security Alert Received</b>
              <p style={{ margin: "6px 0 0", fontSize: 14, color: "#1E293B" }}>{liveAlert.message}</p>
              <div style={{ fontSize: 12, color: "var(--slate)", marginTop: 6 }}>
                Gateway: <b>{liveAlert.provider}</b> · Phone: <b>{liveAlert.phone}</b> · Status: <b>{liveAlert.status.toUpperCase()}</b>
              </div>
            </div>
            <span className="tag" style={{ background: "var(--bad)", color: "white" }}>Alert Dispatched</span>
          </div>
        </div>
      )}

      {/* 5 Presets Scenario Bar */}
      <div className="card" style={{ marginBottom: 20, background: "var(--soft)" }}>
        <div className="row" style={{ justifyContent: "space-between", marginBottom: 10 }}>
          <span className="tag">Quick Test Scenarios (1-Click Presets)</span>
          <span style={{ fontSize: 12, color: "var(--slate)" }}>Injects point-in-time behavioural anomalies</span>
        </div>
        <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(200px, 1fr))", gap: 8 }}>
          <button type="button" className="preset-btn" onClick={() => applyScenario("genuine")}>
            <b style={{ color: "var(--ok)", display: "block" }}>☕ Regular Coffee</b>
            ₹450 · POS swipe · Home city
          </button>
          <button type="button" className="preset-btn" onClick={() => applyScenario("attack")}>
            <b style={{ color: "var(--bad)", display: "block" }}>🚨 Impossible Travel</b>
            ₹98,500 · Delhi at night · New device
          </button>
          <button type="button" className="preset-btn" onClick={() => applyScenario("new_device")}>
            <b style={{ color: "#D97706", display: "block" }}>📱 New Device Anomaly</b>
            ₹14,500 · Unknown hardware
          </button>
          <button type="button" className="preset-btn" onClick={() => applyScenario("velocity")}>
            <b style={{ color: "#D97706", display: "block" }}>⚡ Velocity Burst</b>
            ₹28,500 · High frequency spike
          </button>
          <button type="button" className="preset-btn" onClick={() => applyScenario("location")}>
            <b style={{ color: "var(--aub)", display: "block" }}>✈️ Distant Location</b>
            ₹42,000 · Mumbai cross-city POS
          </button>
        </div>
      </div>

      {list.error && <div className="err">{list.error}</div>}

      <div className="two" style={{ alignItems: "start" }}>
        {/* Left Column: Payment Form */}
        <form className="card" onSubmit={submit}>
          {isCardFrozen && (
            <div style={{ padding: 12, borderRadius: 8, background: "#FEF2F2", border: "1px solid #FCA5A5", color: "var(--bad)", marginBottom: 16, fontSize: 13 }}>
              <b>⚠️ CARD STATUS: FROZEN</b>
              <p style={{ margin: "4px 0 0" }}>
                Card has been placed on protective hold. Transactions are declined to protect account funds.
              </p>
            </div>
          )}

          <label>Demo customer profile</label>
          <select
            required
            value={cid}
            onChange={(e) => {
              setCid(e.target.value);
              setDevice("");
              setCity("");
              setRes(null);
              setCardFrozenState(null);
              setLiveAlert(null);
              setVerificationFeedback(null);
            }}
          >
            <option value="">{list.loading ? "Loading customers..." : "Select a customer"}</option>
            {list.data?.map((x) => (
              <option key={x.id} value={x.external_customer_id}>
                {x.name ? `${x.name} (${x.external_customer_id})` : x.external_customer_id} · {x.home_city}
              </option>
            ))}
          </select>

          {c && (
            <div style={{ padding: 10, borderRadius: 8, background: "var(--soft)", margin: "10px 0 14px", fontSize: 13 }}>
              <div className="row" style={{ justifyContent: "space-between" }}>
                <span>Payment Card:</span>
                <b>
                  {card?.card_number_masked ?? "•••• •••• •••• 9901"}{" "}
                  <span style={{ color: isCardFrozen ? "var(--bad)" : "var(--ok)", fontWeight: 700 }}>
                    ({isCardFrozen ? "FROZEN" : "ACTIVE"})
                  </span>
                </b>
              </div>
              <div className="row" style={{ justifyContent: "space-between", marginTop: 4 }}>
                <span>SMS Alert Mobile:</span>
                <b>{c.phone_masked ?? "+91 ••••• ••019"}</b>
              </div>
              <div style={{ marginTop: 6, textAlign: "right" }}>
                <a
                  href="#"
                  style={{ fontSize: 12, color: "var(--gold)" }}
                  onClick={(e) => {
                    e.preventDefault();
                    setShowPhoneEdit(!showPhoneEdit);
                  }}
                >
                  {showPhoneEdit ? "Close phone settings" : "⚙️ Configure real phone for live SMS"}
                </a>
              </div>
            </div>
          )}

          {showPhoneEdit && (
            <div style={{ padding: 12, border: "1px dashed var(--gold)", borderRadius: 8, marginBottom: 14, background: "#FFFDF5" }}>
              <span style={{ fontSize: 12, fontWeight: 700, color: "#92400E" }}>Connect Personal Phone for Live MSG91 SMS:</span>
              <p style={{ fontSize: 12, color: "var(--slate)", margin: "4px 0 8px" }}>
                Enter your mobile number in E.164 format (+91...) to receive real SMS alerts when fraud is flagged.
              </p>
              <div className="row" style={{ gap: 8 }}>
                <input
                  style={{ flex: 1 }}
                  placeholder="+919876543210"
                  value={newPhone}
                  onChange={(e) => setNewPhone(e.target.value)}
                />
                <button type="button" className="btn" disabled={phoneSaving} onClick={handlePhoneUpdate}>
                  {phoneSaving ? "Saving..." : "Save Phone"}
                </button>
              </div>
              {phoneMsg && <div style={{ fontSize: 12, marginTop: 6, color: phoneMsg.startsWith("Failed") ? "var(--bad)" : "var(--ok)" }}>{phoneMsg}</div>}
            </div>
          )}

          <label>Transaction Amount (INR)</label>
          <input
            type="number"
            min="1"
            step="0.01"
            required
            value={amount}
            onChange={(e) => setAmount(e.target.value)}
            disabled={isCardFrozen}
          />

          <label>Payment Channel</label>
          <select value={channel} onChange={(e) => setChannel(e.target.value)} disabled={isCardFrozen}>
            <option value="pos">POS (Physical terminal swipe)</option>
            <option value="online">Online Payment (e-Commerce)</option>
            <option value="atm">ATM Withdrawal</option>
          </select>

          <label>Transaction Location (City)</label>
          <select value={city} onChange={(e) => setCity(e.target.value)} disabled={isCardFrozen}>
            <option value="">Home City ({c?.home_city ?? "Coimbatore"})</option>
            {Object.keys(CITIES).map((k) => (
              <option key={k} value={k}>
                {k}
              </option>
            ))}
          </select>

          {channel === "online" && (
            <>
              <label>Device Signature</label>
              <select value={device} onChange={(e) => setDevice(e.target.value)} disabled={isCardFrozen}>
                {availableDevices.map((d) => (
                  <option key={d.key} value={d.key}>
                    {d.label}
                  </option>
                ))}
                <option value={UNKNOWN}>⚠️ Unrecognised / new attacker device</option>
              </select>
            </>
          )}

          <p style={{ marginTop: 20 }}>
            <button className="btn gold" style={{ width: "100%" }} disabled={!c || busy || isCardFrozen}>
              {busy ? "Scoring with LightGBM & TreeSHAP..." : isCardFrozen ? "Card Frozen – Cannot Transact" : "Submit Payment for AI Evaluation"}
            </button>
          </p>
          {err && <div className="err">{err}</div>}
        </form>

        {/* Right Column: Submission Result & AI Evaluation */}
        <div className="card">
          {!res ? (
            <div style={{ textAlign: "center", padding: "36px 16px" }}>
              <div style={{ fontSize: 44, marginBottom: 12 }}>💳</div>
              <h3 style={{ margin: "0 0 6px" }}>Ready for Evaluation</h3>
              <p style={{ color: "var(--slate)", fontSize: 14, maxWidth: 360, margin: "auto" }}>
                Select a preset scenario above or enter custom transaction parameters to test our dual-tier LightGBM & Isolation Forest AI detection engine in real time.
              </p>
              <div style={{ marginTop: 24, textAlign: "left", background: "var(--soft)", padding: 14, borderRadius: 8, fontSize: 13 }}>
                <b>4-Tier Policy Pipeline:</b>
                <ol style={{ margin: "8px 0 0", paddingLeft: 18, color: "var(--slate)" }}>
                  <li style={{ margin: "4px 0" }}><b>Approve:</b> Low score (≤ 12.5%) → Seamless clearance.</li>
                  <li style={{ margin: "4px 0" }}><b>Verify:</b> Medium score (12.5% – 31.2%) → 2-way customer confirmation.</li>
                  <li style={{ margin: "4px 0" }}><b>Review:</b> High score (31.2% – 70%) → Analyst investigation dossier.</li>
                  <li style={{ margin: "4px 0" }}><b>Decline:</b> Critical score (&gt; 70%) → Auto-protection hold & card freeze.</li>
                </ol>
              </div>
            </div>
          ) : (
            <>
              {/* Header with 4-Tier Policy Badge & Priority */}
              <div className="row" style={{ justifyContent: "space-between", alignItems: "flex-start" }}>
                <div>
                  <h2 style={{ fontSize: 28, margin: 0 }}>{inr(res.amount)}</h2>
                  <span style={{ fontSize: 12, color: "var(--slate)" }}>
                    {res.channel.toUpperCase()} · Ref: <b>{res.external_txn_id}</b>
                  </span>
                </div>
                <div style={{ textAlign: "right" }}>
                  <span className={`decision-badge ${decision}`}>{decision}</span>
                  <div style={{ marginTop: 4 }}>
                    <span className={`priority-badge ${p?.priority_category ?? "Low"}`}>
                      {p?.priority_category ?? "Low"} Priority (₹{p?.financial_priority_score?.toLocaleString() ?? "0"})
                    </span>
                  </div>
                </div>
              </div>

              {/* Transaction Metadata & Cold Start Indicator */}
              <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 8, margin: "16px 0", fontSize: 13, background: "var(--soft)", padding: 12, borderRadius: 8 }}>
                <div>Location: <b>{city || c?.home_city || "Coimbatore"}</b></div>
                <div>Channel: <b>{res.channel.toUpperCase()}</b></div>
                <div>Time: <b>{new Date(res.occurred_at).toLocaleTimeString()}</b></div>
                <div>
                  Profile:{" "}
                  <span className={`evidence-badge ${p?.evidence_sufficiency ?? "mature"}`}>
                    {p?.evidence_sufficiency === "cold_start"
                      ? "Cold Start (<3 txns)"
                      : p?.evidence_sufficiency === "developing"
                      ? "Developing Profile"
                      : "Mature History"}
                  </span>
                </div>
              </div>

              {/* Visual Risk Gauge Meter */}
              <div style={{ margin: "18px 0" }}>
                <div className="row" style={{ justifyContent: "space-between", fontSize: 13, marginBottom: 6 }}>
                  <span><b>Calibrated Fraud Probability</b></span>
                  <span style={{ color: meterColor, fontWeight: 700, fontSize: 16 }}>{scorePct}%</span>
                </div>
                <div style={{ background: "var(--soft)", height: 12, borderRadius: 6, overflow: "hidden" }}>
                  <div
                    style={{
                      height: "100%",
                      width: `${Math.max(4, scorePct)}%`,
                      background: meterColor,
                      transition: "width 0.6s ease",
                    }}
                  />
                </div>
                <div className="row" style={{ justifyContent: "space-between", fontSize: 11, color: "var(--slate)", marginTop: 4 }}>
                  <span>0% (Approve)</span>
                  <span>Verify: 12.5%</span>
                  <span>Review: 31.2%</span>
                  <span>Decline: 70%</span>
                </div>
              </div>

              {/* 4-Tier Policy Guidance Banner */}
              <div style={{ padding: 12, borderRadius: 8, background: decision === "decline" ? "#FEF2F2" : decision === "review" ? "#FFFBEB" : decision === "verify" ? "#EFF6FF" : "#F0FDF4", border: `1px solid ${meterColor}`, fontSize: 13, margin: "14px 0" }}>
                <p style={{ margin: 0, fontWeight: 600, color: decision === "decline" ? "var(--bad)" : decision === "review" ? "#B45309" : decision === "verify" ? "#1D4ED8" : "var(--ok)" }}>
                  {decision === "decline"
                    ? "🚨 CRITICAL DECLINE: Transaction blocked under policy rules. Card automatically frozen for account protection."
                    : decision === "review"
                    ? "⚠️ ANALYST REVIEW: High-risk anomaly routed to fraud operations priority queue."
                    : decision === "verify"
                    ? "⏳ STEP-UP VERIFICATION: Elevated risk detected. Customer verification initiated."
                    : "✅ FRICTIONLESS APPROVAL: Transaction cleared cleanly within normal behavioural thresholds."}
                </p>
                <p style={{ margin: "6px 0 0", color: "var(--slate)", fontSize: 12 }}>
                  Policy Action: <b>{p?.recommended_action?.toUpperCase()}</b> · Inference Engine: <b>{p?.model_version}</b> (Raw: {(p?.raw_score ?? 0).toFixed(4)})
                </p>
              </div>

              {/* 2-Way Customer Verification Box (Phase 9) */}
              {res?.alert && (
                <div className="card" style={{ background: "#FFFBEB", border: "1px solid #FCD34D", margin: "14px 0" }}>
                  <div className="row" style={{ justifyContent: "space-between", marginBottom: 6 }}>
                    <b style={{ color: "#92400E", fontSize: 14 }}>🔔 Step-Up Customer Verification</b>
                    <span className="tag" style={{ background: "#FDE68A", color: "#92400E" }}>Interactive 2-Way</span>
                  </div>
                  <p style={{ fontSize: 14, margin: "4px 0 10px", color: "#1E293B" }}>
                    <b>Was this transaction made by you?</b><br />
                    Amount: <b>{inr(res.amount)}</b> · Channel: <b>{res.channel.toUpperCase()}</b> · City: <b>{city || c?.home_city || "Coimbatore"}</b>
                  </p>

                  {verificationFeedback === "VERIFIED_GENUINE" ? (
                    <div className="ok" style={{ margin: 0, fontSize: 13 }}>
                      ✅ <b>You confirmed this transaction was authentic.</b> Analyst queue updated; card remains active.
                    </div>
                  ) : verificationFeedback === "CONFIRMED_FRAUD" ? (
                    <div className="err" style={{ margin: 0, fontSize: 13 }}>
                      🛡️ <b>You reported unauthorized activity!</b> Card has been frozen immediately and case escalated to priority investigation.
                    </div>
                  ) : (
                    <div className="row" style={{ gap: 10, marginTop: 10 }}>
                      <button
                        type="button"
                        className="btn"
                        style={{ background: "var(--ok)", fontSize: 13, padding: "8px 16px" }}
                        disabled={verifying}
                        onClick={() => handleVerificationResponse("yes_me")}
                      >
                        {verifying ? "Submitting..." : "✅ Yes, this was my transaction"}
                      </button>
                      <button
                        type="button"
                        className="btn bad"
                        style={{ fontSize: 13, padding: "8px 16px" }}
                        disabled={verifying}
                        onClick={() => handleVerificationResponse("not_me")}
                      >
                        {verifying ? "Submitting..." : "❌ No, I did not make this"}
                      </button>
                    </div>
                  )}
                </div>
              )}

              {p?.reason_codes?.length ? (
                <div style={{ margin: "14px 0" }}>
                  <h4 style={{ margin: "0 0 8px", fontSize: 14 }}>Key Behavioral Risk Factors (TreeSHAP):</h4>
                  <ul style={{ margin: 0, paddingLeft: 18, fontSize: 13 }}>
                    {p.reason_codes.map((r) => (
                      <li key={r} style={{ margin: "4px 0" }}>
                        {r}
                      </li>
                    ))}
                  </ul>
                </div>
              ) : null}

              {p?.counterfactual_hint && (
                <div className="note" style={{ fontSize: 13, margin: "14px 0" }}>
                  <b>Counterfactual Explainability:</b> {p.counterfactual_hint}
                </div>
              )}
            </>
          )}
        </div>
      </div>
    </div>
  );
}

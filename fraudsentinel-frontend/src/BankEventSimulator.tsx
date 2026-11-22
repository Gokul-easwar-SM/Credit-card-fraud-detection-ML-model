import { useEffect, useState } from "react";
import { Link, useNavigate } from "react-router-dom";
import { api, inr, useLoad, useStream, Txn } from "./api";

interface TerminalInfo {
  terminal_id: string;
  merchant_id: string;
  merchant_name: string;
  category?: string;
  merchant_category?: string;
  channel: string;
  city: string;
  latitude?: number;
  longitude?: number;
  lat?: number;
  lon?: number;
  address?: string;
}

export default function BankEventSimulator() {
  const nav = useNavigate();
  const customersLoad = useLoad(api.customers);
  const terminalsLoad = useLoad(api.simulatorTerminals);
  const statusLoad = useLoad(api.simulatorStatus);

  // Form State
  const [cid, setCid] = useState("DEMO001");
  const [channel, setChannel] = useState<"pos" | "atm" | "online">("pos");
  const [terminalId, setTerminalId] = useState("POS-CJB-001");
  const [atmId, setAtmId] = useState("ATM-CJB-001");
  const [gateway, setGateway] = useState("GATEWAY-RAZORPAY");
  const [ipAddress, setIpAddress] = useState("182.73.12.50"); // Coimbatore
  const [amount, setAmount] = useState("450");
  const [deviceKey, setDeviceKey] = useState("");

  // Execution state
  const [busy, setBusy] = useState(false);
  const [activeScenario, setActiveScenario] = useState<string | null>(null);
  const [err, setErr] = useState("");
  const [lastEmitted, setLastEmitted] = useState<Txn | null>(null);
  const [emittedLog, setEmittedLog] = useState<Txn[]>([]);
  const [switchRunning, setSwitchRunning] = useState(false);

  // Selected customer details
  const custLoad = useLoad(() => (cid ? api.customer(cid) : Promise.resolve(null)), [cid]);
  const currentCust = custLoad.data;

  // Background SSE listener for emitted events
  useStream((type, data) => {
    if (type === "transaction_scored") {
      const txn = data as Txn;
      setEmittedLog((prev) => [txn, ...prev.filter((t) => t.id !== txn.id)].slice(0, 20));
    }
  });

  useEffect(() => {
    if (statusLoad.data) {
      setSwitchRunning(statusLoad.data.is_running);
    }
  }, [statusLoad.data]);

  // Sync default device key when customer loads
  useEffect(() => {
    if (currentCust?.known_devices?.length) {
      setDeviceKey(currentCust.known_devices[0]);
    } else {
      setDeviceKey("DEV-DEFAULT-01");
    }
  }, [currentCust]);

  // Terminal lists
  const posTerminals: TerminalInfo[] = (terminalsLoad.data?.terminals as TerminalInfo[] | undefined)?.filter((t) => t.channel === "pos") ?? [
    { terminal_id: "POS-CJB-001", merchant_id: "MERCH-CJB-01", merchant_name: "Annapoorna Coffee House", category: "dining", channel: "pos", city: "Coimbatore", latitude: 11.0168, longitude: 76.9558 },
    { terminal_id: "POS-CJB-002", merchant_id: "MERCH-CJB-02", merchant_name: "Nilgiris Supermarket", category: "grocery", channel: "pos", city: "Coimbatore", latitude: 11.025, longitude: 76.965 },
    { terminal_id: "POS-DEL-001", merchant_id: "MERCH-DEL-01", merchant_name: "Zaveri Luxury Jewelers", category: "jewelry", channel: "pos", city: "Delhi", latitude: 28.6315, longitude: 77.2167 },
    { terminal_id: "POS-BOM-001", merchant_id: "MERCH-BOM-01", merchant_name: "Croma Mega Electronics", category: "electronics", channel: "pos", city: "Mumbai", latitude: 19.0596, longitude: 72.8295 },
    { terminal_id: "POS-BLR-001", merchant_id: "MERCH-BLR-01", merchant_name: "Indiranagar Artisan Bakery", category: "dining", channel: "pos", city: "Bengaluru", latitude: 12.9784, longitude: 77.6408 },
  ];

  const atmTerminals: TerminalInfo[] = (terminalsLoad.data?.terminals as TerminalInfo[] | undefined)?.filter((t) => t.channel === "atm") ?? [
    { terminal_id: "ATM-CJB-001", merchant_id: "BANK-CJB-ATM", merchant_name: "State Bank ATM - Gandhipuram", category: "atm", channel: "atm", city: "Coimbatore", latitude: 11.0185, longitude: 76.9644 },
    { terminal_id: "ATM-DEL-001", merchant_id: "BANK-DEL-ATM", merchant_name: "HDFC ATM - Connaught Place", category: "atm", channel: "atm", city: "Delhi", latitude: 28.6328, longitude: 77.2195 },
    { terminal_id: "ATM-BOM-001", merchant_id: "BANK-BOM-ATM", merchant_name: "ICICI ATM - Bandra West", category: "atm", channel: "atm", city: "Mumbai", latitude: 19.0601, longitude: 72.8361 },
    { terminal_id: "ATM-BLR-001", merchant_id: "BANK-BLR-ATM", merchant_name: "Axis ATM - Koramangala", category: "atm", channel: "atm", city: "Bengaluru", latitude: 12.9352, longitude: 77.6245 },
  ];

  const activeTerminal = channel === "pos"
    ? posTerminals.find((t) => t.terminal_id === terminalId) || posTerminals[0]
    : atmTerminals.find((t) => t.terminal_id === atmId) || atmTerminals[0];

  // 7 Pre-Packaged Controlled Demo Scenarios
  const scenarios = [
    {
      id: "normal_usual_location",
      title: "1. Normal Transaction (Usual Location)",
      desc: "Aarav Patel spends ₹450 at his regular coffee shop in Coimbatore (POS-CJB-001). Recognized terminal and normal spending range.",
      expected: "Low Risk (<15%) · Auto-Approved",
      badge: "low",
    },
    {
      id: "high_value_unusual_location",
      title: "2. High-Value at Unusual Location",
      desc: "Aarav Patel attempts ₹85,000 at Luxury Jewelers in Delhi (POS-DEL-001). 68× his baseline spend + cross-country physical terminal.",
      expected: "High / Critical Risk (>75%) · Flagged for Review",
      badge: "bad",
    },
    {
      id: "stolen_card_another_city",
      title: "3. Stolen-Card in Another City",
      desc: "Physical card presented at an electronics store in Mumbai (POS-BOM-001) for ₹48,000 without prior cardholder travel.",
      expected: "High Risk (>70%) · Flagged for Review",
      badge: "bad",
    },
    {
      id: "impossible_travel",
      title: "4. Impossible Travel Velocity",
      desc: "Card swiped in Bengaluru (POS-BLR-001) just 15 minutes after a transaction in Coimbatore (360 km distance = 1,440 km/h speed).",
      expected: "Critical Anomaly · Impossible Physical Speed Flag",
      badge: "bad",
    },
    {
      id: "new_device_unusual_location",
      title: "5. New Device & Unusual Location",
      desc: "Online e-commerce transaction of ₹24,000 originating from a new device key on an unmapped IP subnet in Jaipur.",
      expected: "High Risk (>65%) · Step-Up Verification Recommended",
      badge: "high",
    },
    {
      id: "high_velocity_burst",
      title: "6. High Transaction Velocity",
      desc: "4 rapid cash withdrawals within 3 minutes at Coimbatore ATM (ATM-CJB-001). Sudden burst exceeding velocity baseline.",
      expected: "Elevated Risk (Review) · Velocity Burst Flagged",
      badge: "high",
    },
    {
      id: "normal_new_location",
      title: "7. Normal Spend at New Location (Legitimate Travel)",
      desc: "Aarav Patel buys lunch for ₹950 in Bengaluru (POS-BLR-001) 5 hours after his Coimbatore transaction (60 km/h travel). Valid travel window, normal amount.",
      expected: "Low-Moderate Risk (<25%) · Approved (New Location ≠ Fraud)",
      badge: "low",
    },
  ];

  async function triggerScenario(scId: string) {
    setBusy(true);
    setActiveScenario(scId);
    setErr("");
    try {
      const res = await api.simulatorScenario(scId, cid);
      if (res && res.length > 0) {
        const last = res[res.length - 1];
        setLastEmitted(last);
        setEmittedLog((prev) => [...res.reverse(), ...prev].slice(0, 25));
      }
    } catch (e) {
      setErr((e as Error).message);
    } finally {
      setBusy(false);
      setActiveScenario(null);
    }
  }

  async function emitCustomEvent() {
    setBusy(true);
    setErr("");
    try {
      const body = {
        customer_id: cid,
        amount: parseFloat(amount) || 500,
        channel,
        terminal_id: channel !== "online" ? activeTerminal?.terminal_id : undefined,
        merchant_id: channel === "online" ? gateway : activeTerminal?.merchant_id,
        ip_address: channel === "online" ? ipAddress : undefined,
        device_key: deviceKey || undefined,
      };
      const res = await api.simulatorCustomEvent(body);
      setLastEmitted(res);
      setEmittedLog((prev) => [res, ...prev.filter((t) => t.id !== res.id)].slice(0, 25));
    } catch (e) {
      setErr((e as Error).message);
    } finally {
      setBusy(false);
    }
  }

  async function toggleContinuousSwitch() {
    setBusy(true);
    try {
      if (switchRunning) {
        await api.simulatorStop();
        setSwitchRunning(false);
      } else {
        await api.simulatorStart(1.0);
        setSwitchRunning(true);
      }
    } catch (e) {
      setErr((e as Error).message);
    } finally {
      setBusy(false);
    }
  }

  return (
    <div style={{ maxWidth: 1200, margin: "0 auto", padding: "20px 24px" }}>
      {/* Top Navigation */}
      <nav className="top" style={{ marginBottom: 20, paddingBottom: 12, borderBottom: "1px solid #E2E8F0" }}>
        <div className="row" style={{ gap: 12 }}>
          <Link to="/" className="logo" style={{ textDecoration: "none" }}>
            Fraud<b>Sentinel</b>
          </Link>
          <span className="tag" style={{ background: "#25162F", color: "#E6AD3C", fontWeight: 700 }}>
            BANK SWITCH SIMULATOR
          </span>
        </div>
        <div className="row" style={{ gap: 10 }}>
          <Link className="btn ghost" to="/analyst/live">
            Live Stream Feed
          </Link>
          <Link className="btn" to="/analyst">
            Analyst Operations Portal
          </Link>
        </div>
      </nav>

      {/* Institutional Architecture Banner */}
      <div
        className="card"
        style={{
          background: "linear-gradient(135deg, #25162F 0%, #3B204C 100%)",
          color: "white",
          padding: "24px 28px",
          marginBottom: 24,
          borderRadius: 12,
          boxShadow: "0 10px 25px -5px rgba(37, 22, 47, 0.3)",
        }}
      >
        <div className="row" style={{ justifyContent: "space-between", alignItems: "flex-start", flexWrap: "wrap", gap: 16 }}>
          <div style={{ maxWidth: 760 }}>
            <span
              style={{
                display: "inline-block",
                padding: "4px 10px",
                borderRadius: 4,
                background: "#E6AD3C",
                color: "#25162F",
                fontSize: 11,
                fontWeight: 800,
                letterSpacing: "0.08em",
                marginBottom: 8,
              }}
            >
              BANK-SIDE PAYMENT SWITCH CONTROLLER · DEMO / SANDBOX DATA
            </span>
            <h1 style={{ color: "white", margin: "4px 0 10px", fontSize: 26, letterSpacing: "-0.02em" }}>
              Simulate Core Banking Payment Processing Events
            </h1>
            <p style={{ color: "#DCE3E8", fontSize: 14, lineHeight: 1.6, margin: 0 }}>
              FraudSentinel is a <b>bank-side fraud prevention system</b> that operates inside core banking and switch infrastructure.
              Cardholders swipe ordinary cards at physical POS terminals, withdraw from ATMs, or transact on e-commerce gateways.
              This controller acts as the bank payment switch—emitting transaction events into the automated intelligence pipeline to evaluate behavioral & geospatial risk before surfacing alerts to bank analysts.
            </p>
          </div>

          {/* Continuous Switch Toggle */}
          <div
            style={{
              padding: 16,
              background: "rgba(255, 255, 255, 0.08)",
              borderRadius: 8,
              border: "1px solid rgba(255, 255, 255, 0.15)",
              minWidth: 260,
              textAlign: "center",
            }}
          >
            <div style={{ fontSize: 12, color: "#DCE3E8", marginBottom: 6 }}>Automated Switch Feed (1 Hz)</div>
            <div className="row" style={{ justifyContent: "center", alignItems: "center", gap: 8, marginBottom: 12 }}>
              <span className={`dot ${switchRunning ? "live" : "dead"}`} />
              <b style={{ color: switchRunning ? "#22C55E" : "#94A3B8" }}>
                {switchRunning ? "Switch Feed Active" : "Switch Idle"}
              </b>
            </div>
            <button
              className={`btn ${switchRunning ? "bad" : "gold"}`}
              style={{ width: "100%", padding: "8px 16px", fontSize: 13 }}
              disabled={busy}
              onClick={toggleContinuousSwitch}
            >
              {switchRunning ? "⏹ Stop Switch Feed" : "▶ Start Continuous Stream"}
            </button>
          </div>
        </div>
      </div>

      {err && <div className="err" style={{ marginBottom: 16 }}>{err}</div>}

      {/* Two Column Layout: Scenarios vs Custom Bank Event Builder */}
      <div className="two" style={{ gap: 24, alignItems: "start", marginBottom: 28 }}>
        {/* Left Column: 7 Controlled Demo Scenarios */}
        <div>
          <div className="row" style={{ justifyContent: "space-between", alignItems: "center", marginBottom: 12 }}>
            <h2 style={{ margin: 0, fontSize: 18 }}>1. Controlled Demonstration Scenarios</h2>
            <span className="tag">Full ML Pipeline</span>
          </div>
          <p style={{ color: "var(--slate)", fontSize: 13, marginTop: 0, marginBottom: 16 }}>
            Inject controlled payment scenarios directly into the switch. Each scenario constructs real historical customer vectors, calculates speed and terminal metrics, and runs LightGBM + TreeSHAP.
          </p>

          <div style={{ display: "flex", flexDirection: "column", gap: 12 }}>
            {scenarios.map((sc) => (
              <div
                key={sc.id}
                className="card"
                style={{
                  padding: 16,
                  transition: "all 0.15s ease",
                  borderLeft: `4px solid ${
                    sc.badge === "low" ? "var(--ok)" : sc.badge === "bad" ? "var(--bad)" : "var(--gold)"
                  }`,
                }}
              >
                <div className="row" style={{ justifyContent: "space-between", alignItems: "flex-start", marginBottom: 4 }}>
                  <b style={{ fontSize: 14 }}>{sc.title}</b>
                  <span
                    className="tag"
                    style={{
                      fontSize: 11,
                      background: sc.badge === "low" ? "#DCFCE7" : sc.badge === "bad" ? "#FEE2E2" : "#FEF3C7",
                      color: sc.badge === "low" ? "#166534" : sc.badge === "bad" ? "#991B1B" : "#92400E",
                      fontWeight: 700,
                    }}
                  >
                    {sc.expected}
                  </span>
                </div>
                <p style={{ fontSize: 13, color: "var(--slate)", margin: "4px 0 12px", lineHeight: 1.45 }}>
                  {sc.desc}
                </p>
                <div className="row" style={{ justifyContent: "flex-end" }}>
                  <button
                    className="btn ghost"
                    style={{ padding: "6px 14px", fontSize: 12 }}
                    disabled={busy}
                    onClick={() => triggerScenario(sc.id)}
                  >
                    {busy && activeScenario === sc.id ? "Injecting Switch Event..." : "⚡ Inject Scenario Event"}
                  </button>
                </div>
              </div>
            ))}
          </div>
        </div>

        {/* Right Column: Custom Bank Transaction Event Generator */}
        <div>
          <div className="row" style={{ justifyContent: "space-between", alignItems: "center", marginBottom: 12 }}>
            <h2 style={{ margin: 0, fontSize: 18 }}>2. Custom Bank Switch Event Builder</h2>
            <span className="tag">ISO 8583 / JSON Payload</span>
          </div>
          <p style={{ color: "var(--slate)", fontSize: 13, marginTop: 0, marginBottom: 16 }}>
            Construct an arbitrary bank payment authorization event. Terminal locations are retrieved from the certified merchant registry; IP geolocation is resolved automatically.
          </p>

          <div className="card" style={{ padding: 20 }}>
            {/* Customer Profile Selection */}
            <label style={{ fontSize: 12, fontWeight: 700, color: "var(--slate)", textTransform: "uppercase" }}>
              Select Cardholder Profile
            </label>
            <select value={cid} onChange={(e) => setCid(e.target.value)} style={{ marginBottom: 12 }}>
              {Array.isArray(customersLoad.data) ? (
                customersLoad.data.map((cust) => (
                  <option key={cust.external_customer_id} value={cust.external_customer_id}>
                    {cust.name} ({cust.external_customer_id}) · {cust.home_city}
                  </option>
                ))
              ) : (
                <>
                  <option value="DEMO001">Aarav Patel (DEMO001) · Coimbatore</option>
                  <option value="CUST00001">Priya Sharma (CUST00001) · Chennai</option>
                  <option value="CUST00002">Vikram Malhotra (CUST00002) · Bengaluru</option>
                  <option value="CUST00003">Neha Gupta (CUST00003) · Mumbai</option>
                  <option value="CUST00004">Rajesh Kumar (CUST00004) · Delhi</option>
                  <option value="CUST00005">Cold-Start Customer (CUST00005) · No History</option>
                </>
              )}
            </select>

            {/* Customer Historical Baseline Snapshot */}
            {currentCust && (
              <div
                style={{
                  padding: 12,
                  background: "var(--soft)",
                  borderRadius: 8,
                  fontSize: 12,
                  marginBottom: 16,
                  border: "1px solid #E2E8F0",
                }}
              >
                <div style={{ fontWeight: 700, color: "var(--aub)", marginBottom: 4 }}>
                  📊 Verified Historical Baseline Profile:
                </div>
                <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 6 }}>
                  <div>Home City: <b>{currentCust.home_city}</b></div>
                  <div>Avg Spend: <b>{inr(currentCust.avg_amount ?? 1250)}</b></div>
                  <div>Historical Txns: <b>{currentCust.total_historical_txns ?? 32} txns</b></div>
                  <div>Card Status: <b style={{ color: currentCust.cards?.[0]?.status === "frozen" ? "var(--bad)" : "var(--ok)" }}>
                    {currentCust.cards?.[0]?.status?.toUpperCase() ?? "ACTIVE"}
                  </b></div>
                </div>
              </div>
            )}

            {/* Payment Channel */}
            <label style={{ fontSize: 12, fontWeight: 700, color: "var(--slate)", textTransform: "uppercase" }}>
              Payment Channel
            </label>
            <div className="row" style={{ gap: 10, marginBottom: 14 }}>
              {(["pos", "atm", "online"] as const).map((ch) => (
                <button
                  key={ch}
                  type="button"
                  className={`btn ${channel === ch ? "" : "ghost"}`}
                  style={{ flex: 1, padding: "8px 12px", fontSize: 12, textTransform: "uppercase" }}
                  onClick={() => setChannel(ch)}
                >
                  {ch === "pos" ? "💳 POS Terminal" : ch === "atm" ? "🏧 ATM Cash" : "🌐 E-Commerce"}
                </button>
              ))}
            </div>

            {/* Channel-Specific Hardware Terminal & Location Selector */}
            {channel === "pos" && (
              <div style={{ marginBottom: 14 }}>
                <label style={{ fontSize: 12, fontWeight: 700, color: "var(--slate)", textTransform: "uppercase" }}>
                  Registered Merchant POS Terminal
                </label>
                <select value={terminalId} onChange={(e) => setTerminalId(e.target.value)}>
                  {posTerminals.map((t) => (
                    <option key={t.terminal_id} value={t.terminal_id}>
                      {t.merchant_name} ({t.city}) · {t.terminal_id}
                    </option>
                  ))}
                </select>
                <div style={{ fontSize: 11, color: "var(--slate)", marginTop: 4 }}>
                  Registered Coordinates: <b>{(activeTerminal?.latitude ?? activeTerminal?.lat ?? 11.0168).toFixed(4)}°N, {(activeTerminal?.longitude ?? activeTerminal?.lon ?? 76.9558).toFixed(4)}°E</b> ({activeTerminal?.city}) · Category: <b>{activeTerminal?.category ?? activeTerminal?.merchant_category ?? "Retail"}</b>
                </div>
              </div>
            )}

            {channel === "atm" && (
              <div style={{ marginBottom: 14 }}>
                <label style={{ fontSize: 12, fontWeight: 700, color: "var(--slate)", textTransform: "uppercase" }}>
                  Registered ATM Cash Dispenser
                </label>
                <select value={atmId} onChange={(e) => setAtmId(e.target.value)}>
                  {atmTerminals.map((t) => (
                    <option key={t.terminal_id} value={t.terminal_id}>
                      {t.merchant_name} ({t.city}) · {t.terminal_id}
                    </option>
                  ))}
                </select>
                <div style={{ fontSize: 11, color: "var(--slate)", marginTop: 4 }}>
                  Registered Coordinates: <b>{(activeTerminal?.latitude ?? activeTerminal?.lat ?? 11.0185).toFixed(4)}°N, {(activeTerminal?.longitude ?? activeTerminal?.lon ?? 76.9644).toFixed(4)}°E</b> ({activeTerminal?.city})
                </div>
              </div>
            )}

            {channel === "online" && (
              <div style={{ marginBottom: 14 }}>
                <label style={{ fontSize: 12, fontWeight: 700, color: "var(--slate)", textTransform: "uppercase" }}>
                  Payment Gateway
                </label>
                <select value={gateway} onChange={(e) => setGateway(e.target.value)} style={{ marginBottom: 10 }}>
                  <option value="GATEWAY-RAZORPAY">Razorpay Payment Gateway (E-Commerce)</option>
                  <option value="GATEWAY-BILLDESK">BillDesk Payment Gateway (Utilities)</option>
                  <option value="GATEWAY-CCAVENUE">CCAvenue Payment Gateway (Travel)</option>
                  <option value="GATEWAY-SHOPIFY">Shopify Direct Storefront</option>
                </select>

                <label style={{ fontSize: 12, fontWeight: 700, color: "var(--slate)", textTransform: "uppercase" }}>
                  Cardholder Client IP Address (Geo-Resolved by Switch)
                </label>
                <select value={ipAddress} onChange={(e) => setIpAddress(e.target.value)}>
                  <option value="182.73.12.50">182.73.12.50 · Coimbatore Broadband (BSNL Fiber)</option>
                  <option value="103.211.14.22">103.211.14.22 · Chennai Subnet (Airtel Broadband)</option>
                  <option value="14.139.186.10">14.139.186.10 · Bengaluru Subnet (Jio Fiber)</option>
                  <option value="122.161.45.89">122.161.45.89 · Delhi Subnet (ACT Fibernet)</option>
                  <option value="49.36.128.45">49.36.128.45 · Jaipur Subnet (Vodafone Idea)</option>
                  <option value="198.51.100.99">198.51.100.99 · Unmapped / Tor Exit Node (No Location)</option>
                </select>
              </div>
            )}

            {/* Amount Input */}
            <label style={{ fontSize: 12, fontWeight: 700, color: "var(--slate)", textTransform: "uppercase" }}>
              Transaction Amount (INR ₹)
            </label>
            <input
              type="number"
              value={amount}
              onChange={(e) => setAmount(e.target.value)}
              placeholder="e.g. 1500"
              style={{ marginBottom: 14 }}
            />

            {/* Device Key */}
            <label style={{ fontSize: 12, fontWeight: 700, color: "var(--slate)", textTransform: "uppercase" }}>
              Device Identifier
            </label>
            <input
              type="text"
              value={deviceKey}
              onChange={(e) => setDeviceKey(e.target.value)}
              placeholder="e.g. DEV-DEMO001-A (leave empty for unrecognised hardware)"
              style={{ marginBottom: 16 }}
            />

            <button
              className="btn"
              style={{ width: "100%", padding: "12px 18px", fontSize: 14 }}
              disabled={busy}
              onClick={emitCustomEvent}
            >
              {busy ? "Transmitting to Bank Switch..." : "📤 Transmit Event to Bank Switch"}
            </button>
          </div>
        </div>
      </div>

      {/* Latest Scored Transaction Inspection Banner */}
      {lastEmitted && (
        <div
          className="card"
          style={{
            marginBottom: 24,
            padding: 20,
            background: "#F8FAFC",
            border: `2px solid ${
              lastEmitted.prediction?.risk_band === "high" || lastEmitted.prediction?.risk_band === "critical"
                ? "var(--bad)"
                : "var(--ok)"
            }`,
          }}
        >
          <div className="row" style={{ justifyContent: "space-between", alignItems: "center", marginBottom: 10 }}>
            <div>
              <span className="tag" style={{ background: "var(--aub)", color: "white", fontWeight: 700 }}>
                LATEST SWITCH EVENT SCORED
              </span>
              <h3 style={{ margin: "6px 0 0" }}>
                Txn Ref: <b>{lastEmitted.external_txn_id}</b> · {inr(lastEmitted.amount)} · {lastEmitted.channel.toUpperCase()}
              </h3>
            </div>
            <div className="row" style={{ gap: 8 }}>
              {lastEmitted.prediction && (
                <span className={`band ${lastEmitted.prediction.risk_band}`}>
                  {lastEmitted.prediction.risk_band.toUpperCase()} ({(lastEmitted.prediction.calibrated_score * 100).toFixed(1)}%)
                </span>
              )}
              {lastEmitted.prediction?.decision && (
                <span className={`decision-badge ${lastEmitted.prediction.decision}`}>
                  {lastEmitted.prediction.decision.toUpperCase()}
                </span>
              )}
            </div>
          </div>

          <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(200px, 1fr))", gap: 10, fontSize: 13, marginBottom: 14 }}>
            <div>Customer: <b>{lastEmitted.external_customer_id}</b></div>
            <div>Location: <b>{lastEmitted.city ?? "Unknown"}</b> ({lastEmitted.location_source ?? "N/A"})</div>
            <div>Merchant / Terminal: <b>{lastEmitted.merchant_name ?? lastEmitted.terminal_id ?? "Direct"}</b></div>
            <div>Travel Speed: <b>{lastEmitted.speed_kmh != null ? `${lastEmitted.speed_kmh.toFixed(1)} km/h` : "N/A"}</b></div>
            <div>Distance from Prev: <b>{lastEmitted.distance_from_prev_km != null ? `${lastEmitted.distance_from_prev_km.toFixed(1)} km` : "N/A"}</b></div>
            <div>Unusual Location: <b style={{ color: lastEmitted.is_unusual_location ? "var(--bad)" : "var(--ok)" }}>
              {lastEmitted.is_unusual_location ? "YES (ANOMALY)" : "NO (BASELINE)"}
            </b></div>
          </div>

          {lastEmitted.prediction?.counterfactual_hint && (
            <div className="note" style={{ marginBottom: 12, fontSize: 13 }}>
              <b>Counterfactual AI Advice:</b> {lastEmitted.prediction.counterfactual_hint}
            </div>
          )}

          <div className="row" style={{ justifyContent: "flex-end", gap: 10 }}>
            {lastEmitted.investigation?.id ? (
              <button
                className="btn"
                style={{ padding: "8px 16px" }}
                onClick={() => nav(`/analyst/investigations/${lastEmitted.investigation!.id}`)}
              >
                🔍 Open Case in Analyst Dossier #{lastEmitted.investigation.id}
              </button>
            ) : (
              <Link className="btn ghost" to="/analyst/live">
                View Live in Monitoring Stream →
              </Link>
            )}
          </div>
        </div>
      )}

      {/* Emitted Events Ledger */}
      <div className="card" style={{ padding: 20 }}>
        <div className="row" style={{ justifyContent: "space-between", alignItems: "center", marginBottom: 14 }}>
          <div>
            <h3 style={{ margin: 0 }}>Recent Simulated Bank Switch Events</h3>
            <span style={{ fontSize: 13, color: "var(--slate)" }}>
              Buffered transaction events transmitted through core banking simulator
            </span>
          </div>
          <span className="pill">
            <b>{emittedLog.length}</b> events recorded
          </span>
        </div>

        {!emittedLog.length ? (
          <p style={{ color: "var(--slate)", textAlign: "center", padding: "30px 0" }}>
            No transaction events emitted yet. Click any demonstration scenario or transmit a custom bank event above.
          </p>
        ) : (
          <table>
            <thead>
              <tr>
                <th>Txn ID</th>
                <th>Customer</th>
                <th>Amount</th>
                <th>Channel</th>
                <th>Location</th>
                <th>Speed / Dist</th>
                <th>AI Risk Score</th>
                <th>Action</th>
              </tr>
            </thead>
            <tbody>
              {emittedLog.map((t) => (
                <tr key={t.external_txn_id || t.id}>
                  <td><b>{t.external_txn_id}</b></td>
                  <td>{t.external_customer_id}</td>
                  <td>{inr(t.amount)}</td>
                  <td><span className="tag">{t.channel}</span></td>
                  <td>{t.city ?? "–"}</td>
                  <td style={{ fontSize: 12 }}>
                    {t.speed_kmh != null ? `${t.speed_kmh.toFixed(0)} km/h (${t.distance_from_prev_km?.toFixed(0)} km)` : "–"}
                  </td>
                  <td>
                    {t.prediction ? (
                      <span className={`band ${t.prediction.risk_band}`}>
                        {(t.prediction.calibrated_score * 100).toFixed(1)}%
                      </span>
                    ) : "–"}
                  </td>
                  <td>
                    {t.investigation?.id ? (
                      <button
                        className="btn ghost"
                        style={{ padding: "4px 10px", fontSize: 11 }}
                        onClick={() => nav(`/analyst/investigations/${t.investigation!.id}`)}
                      >
                        Investigate
                      </button>
                    ) : (
                      <span style={{ fontSize: 11, color: "var(--slate)" }}>Approved</span>
                    )}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </div>

      <footer style={{ marginTop: 24, textAlign: "center", color: "var(--slate)", fontSize: 12 }}>
        FraudSentinel Core Banking Switch Controller · Certified Bank-Side Real-Time Fraud Prevention System · Academic Prototype
      </footer>
    </div>
  );
}

import { Canvas, useFrame } from "@react-three/fiber";
import { useEffect, useMemo, useRef } from "react";
import * as THREE from "three";
import { Link } from "react-router-dom";

function face(bg: string, fg: string, num: string) {
  const c = document.createElement("canvas");
  c.width = 856;
  c.height = 540;
  const g = c.getContext("2d")!;
  g.fillStyle = bg;
  g.fillRect(0, 0, 856, 540);
  g.fillStyle = fg;
  g.font = "700 40px sans-serif";
  g.fillText("FraudSentinel", 50, 90);
  g.fillStyle = "#E6AD3C";
  g.fillRect(50, 190, 90, 66);
  g.fillStyle = fg;
  g.font = "500 52px monospace";
  g.fillText(num, 50, 400);
  g.font = "500 24px sans-serif";
  g.fillText("BANK PAYMENT SWITCH · CORE ENGINE", 50, 480);
  return new THREE.CanvasTexture(c);
}

function FloatCard({
  bg,
  fg,
  num,
  pos,
  rot,
  speed,
}: {
  bg: string;
  fg: string;
  num: string;
  pos: [number, number, number];
  rot: [number, number, number];
  speed: number;
}) {
  const ref = useRef<THREE.Mesh>(null);
  const tex = useMemo(() => face(bg, fg, num), [bg, fg, num]);
  useFrame(({ clock }) => {
    const t = clock.elapsedTime * speed;
    if (ref.current) {
      ref.current.position.y = pos[1] + Math.sin(t) * 0.18;
      ref.current.rotation.y = rot[1] + Math.sin(t * 0.7) * 0.25;
      ref.current.rotation.x = rot[0] + Math.cos(t * 0.6) * 0.08;
    }
  });
  return (
    <mesh ref={ref} position={pos} rotation={rot}>
      <boxGeometry args={[3.2, 2.02, 0.06]} />
      <meshStandardMaterial map={tex} roughness={0.35} metalness={0.25} />
    </mesh>
  );
}

function Reveal({ children, cls = "" }: { children: React.ReactNode; cls?: string }) {
  const r = useRef<HTMLDivElement>(null);
  useEffect(() => {
    const o = new IntersectionObserver(([e]) => e.isIntersecting && r.current?.classList.add("in"), {
      threshold: 0.15,
    });
    r.current && o.observe(r.current);
    return () => o.disconnect();
  }, []);
  return <div ref={r} className={`rv ${cls}`}>{children}</div>;
}

const steps = [
  "Payment Terminal / ATM / Web Swipe",
  "Bank Switch Stream Ingestion",
  "Behavioral & Geospatial Intelligence",
  "Dual LightGBM & Isolation Forest Scoring",
  "TreeSHAP Explainable Attribution",
  "Real-Time Analyst Radar & Investigation",
];

export default function Landing() {
  return (
    <div>
      <nav className="top">
        <span className="logo">
          Fraud<b>Sentinel</b>
        </span>
        <span className="row" style={{ gap: 10 }}>
          <Link className="btn ghost" to="/simulator">
            Bank Switch Simulator
          </Link>
          <Link className="btn" to="/analyst">
            Analyst Operations Portal
          </Link>
        </span>
      </nav>

      <header className="hero">
        <div>
          <span className="tag" style={{ background: "rgba(230, 173, 60, 0.2)", color: "#E6AD3C", fontWeight: 700, marginBottom: 12, display: "inline-block" }}>
            BANK-SIDE REAL-TIME FRAUD PREVENTION SYSTEM
          </span>
          <h1>
            Every Switch Transaction Has a Story. We Detect the <em className="s">Risk</em> in Milliseconds.
          </h1>
          <p>
            Operating inside institutional core banking and payment processing networks. Intercepting transaction streams from POS terminals, ATMs, and e-commerce payment rails to protect cardholders through behavioral analytics and explainable AI.
          </p>
          <div className="cta">
            <Link className="btn gold" to="/analyst">
              Open Analyst Operations Portal
            </Link>
            <Link className="btn ghost" to="/simulator" style={{ color: "white", borderColor: "rgba(255, 255, 255, 0.4)" }}>
              Launch Bank Switch Simulator
            </Link>
          </div>
        </div>
        <div className="stage" aria-hidden="true">
          <Canvas dpr={[1, 1.75]} camera={{ position: [0, 0, 7], fov: 40 }}>
            <ambientLight intensity={0.9} />
            <directionalLight position={[4, 5, 6]} intensity={1.6} />
            <FloatCard bg="#25162F" fg="#fff" num="•••• 1247" pos={[0.6, 0.9, 0]} rot={[0.2, -0.5, 0.18]} speed={0.9} />
            <FloatCard bg="#E6AD3C" fg="#25162F" num="•••• 8912" pos={[-0.5, -1.1, 0.8]} rot={[-0.1, 0.45, -0.2]} speed={0.7} />
          </Canvas>
        </div>
      </header>

      <section className="sec">
        <Reveal>
          <span className="tag">Institutional Architecture</span>
          <h2>
            Bank-side intelligence, <em className="s">invisible</em> to the legitimate customer.
          </h2>
          <p className="lead">
            Cardholders use their ordinary bank cards at everyday merchant terminals, ATMs, or web storefronts. FraudSentinel receives payment switch authorization events, compares each event against deep persistent customer behavioral baselines, and flags anomalies before settlement.
          </p>
          <div className="grid">
            {[
              ["Amount Anomaly", "Z-score and spending ratios evaluated against individual multi-week historical baselines."],
              ["Geospatial Velocity", "Calculates physical distance and travel speed between consecutive terminal locations to identify impossible transit."],
              ["Terminal & Hardware Profiling", "Cross-references registered POS/ATM hardware IDs and known cardholder device signatures."],
              ["Behavioral Burst Velocity", "Monitors rolling 1-hour and 24-hour transaction frequency to stop card-cloning and skimming bursts."],
            ].map(([a, b]) => (
              <div className="card" key={a}>
                <h3>{a}</h3>
                <p style={{ color: "var(--slate)" }}>{b}</p>
              </div>
            ))}
          </div>
        </Reveal>
      </section>

      <section className="sec alt" id="how">
        <div>
          <Reveal>
            <span className="tag">How it works</span>
            <h2>
              From payment authorization to <em className="s">case resolution</em> in real time.
            </h2>
            <p className="lead">
              Machine learning algorithms provide sub-15ms calibrated risk scores and SHAP attribution. Bank fraud analysts make the informed final decision.
            </p>
            <div className="steps">
              {steps.map((s, i) => (
                <span key={s} className="row">
                  <span className={`step ${i === 5 ? "on" : ""}`}>
                    {i + 1}. {s}
                  </span>
                  {i < steps.length - 1 && <span className="arrow">→</span>}
                </span>
              ))}
            </div>
          </Reveal>
        </div>
      </section>

      <section className="sec">
        <Reveal>
          <span className="tag">Explainable AI</span>
          <h2>
            Not a black box. <em className="s">Actionable reasons</em> for bank analysts.
          </h2>
          <p className="lead">
            Every flagged transaction decomposes into bidirectional TreeSHAP feature attributions—highlighting factors elevating suspicion alongside protective factors establishing legitimacy.
          </p>
          <div className="card" style={{ maxWidth: 680 }}>
            <span className="tag">TreeSHAP Attribution Decomposition</span>
            {[
              { n: "Amount vs Historical Mean (Z-Score > 4.2)", w: 88, col: "var(--bad)" },
              { n: "Geospatial Travel Velocity (1,440 km/h Impossible)", w: 95, col: "var(--bad)" },
              { n: "Unregistered Physical POS Terminal", w: 62, col: "var(--bad)" },
              { n: "Established Cardholder Account (32 Past Txns)", w: 40, col: "var(--ok)" },
            ].map(({ n, w, col }) => (
              <div key={n} style={{ margin: "14px 0" }}>
                <div className="row" style={{ justifyContent: "space-between", fontSize: 13 }}>
                  <b>{n}</b>
                  <span style={{ color: col, fontWeight: 700 }}>{col === "var(--bad)" ? "pushes risk up" : "reduces risk"}</span>
                </div>
                <div className="bar" style={{ width: `${w}%`, background: col }} />
              </div>
            ))}
            <p style={{ color: "var(--slate)", marginBottom: 0, marginTop: 12, fontSize: 13 }}>
              Counterfactual Guidance: "If the transaction occurred at customer's home terminal within Coimbatore, risk score would decrease from 82% to 11%."
            </p>
          </div>
        </Reveal>
      </section>

      <section className="sec alt">
        <div>
          <Reveal>
            <span className="tag">Investigation & Response</span>
            <h2>
              Full Analyst Operations Suite with <em className="s">Safe Safeguards</em>.
            </h2>
            <p className="lead">
              Bank analysts investigate alerts via interactive geospatial radar maps, review travel speed vectors, inspect customer baseline profiles, and execute actions (mark genuine, request step-up verification, temporary simulated card lock, escalation).
            </p>
            <div className="steps">
              {["Switch Alert", "Geospatial Radar", "Step-Up Challenge", "Simulated Card Freeze", "Audit Ledger"].map((s, i) => (
                <span key={s} className="row">
                  <span className="step">{s}</span>
                  {i < 4 && <span className="arrow">→</span>}
                </span>
              ))}
            </div>
          </Reveal>
        </div>
      </section>

      <section className="sec">
        <div>
          <Reveal>
            <h2>
              Explore the complete bank fraud monitoring system, <em className="s">end to end</em>.
            </h2>
            <p className="lead">
              Inject transactions through the Bank Switch Simulator and watch them stream in real-time onto the Analyst Operations Radar.
            </p>
            <div className="cta row">
              <Link className="btn gold" to="/analyst">
                Open Analyst Portal
              </Link>
              <Link className="btn" to="/simulator">
                Open Bank Switch Simulator
              </Link>
            </div>
          </Reveal>
        </div>
      </section>

      <footer className="sec" style={{ color: "var(--slate)", fontSize: 13 }}>
        FraudSentinel Core Banking Prevention System · Academic demonstration prototype · All transactions, terminal locations, and card actions operate within simulated bank sandboxes.
      </footer>
    </div>
  );
}

import { Canvas, useFrame } from "@react-three/fiber";
import { useEffect, useMemo, useRef } from "react";
import * as THREE from "three";
import { Link } from "react-router-dom";

function face(bg: string, fg: string, num: string) {
  const c = document.createElement("canvas"); c.width = 856; c.height = 540;
  const g = c.getContext("2d")!; g.fillStyle = bg; g.fillRect(0, 0, 856, 540);
  g.fillStyle = fg; g.font = "700 40px sans-serif"; g.fillText("FraudSentinel", 50, 90);
  g.fillStyle = "#E6AD3C"; g.fillRect(50, 190, 90, 66);
  g.fillStyle = fg; g.font = "500 52px monospace"; g.fillText(num, 50, 400);
  g.font = "500 24px sans-serif"; g.fillText("DEMO CARD · SIMULATED", 50, 480);
  return new THREE.CanvasTexture(c);
}
function FloatCard({ bg, fg, num, pos, rot, speed }: { bg: string; fg: string; num: string; pos: [number, number, number]; rot: [number, number, number]; speed: number }) {
  const ref = useRef<THREE.Mesh>(null); const tex = useMemo(() => face(bg, fg, num), [bg, fg, num]);
  useFrame(({ clock }) => { const t = clock.elapsedTime * speed; if (ref.current) { ref.current.position.y = pos[1] + Math.sin(t) * 0.18; ref.current.rotation.y = rot[1] + Math.sin(t * 0.7) * 0.25; ref.current.rotation.x = rot[0] + Math.cos(t * 0.6) * 0.08; } });
  return <mesh ref={ref} position={pos} rotation={rot}><boxGeometry args={[3.2, 2.02, 0.06]} /><meshStandardMaterial map={tex} roughness={0.35} metalness={0.25} /></mesh>;
}
function Reveal({ children, cls = "" }: { children: React.ReactNode; cls?: string }) {
  const r = useRef<HTMLDivElement>(null);
  useEffect(() => { const o = new IntersectionObserver(([e]) => e.isIntersecting && r.current?.classList.add("in"), { threshold: 0.15 }); r.current && o.observe(r.current); return () => o.disconnect(); }, []);
  return <div ref={r} className={`rv ${cls}`}>{children}</div>;
}
const steps = ["Transaction", "Feature analysis", "ML prediction", "Risk score", "Explainable AI", "Analyst decision"];

export default function Landing() {
  return <div>
    <nav className="top"><span className="logo">Fraud<b>Sentinel</b></span><span className="row"><Link className="btn ghost" to="/customer">Customer demo</Link><Link className="btn" to="/analyst">Analyst portal</Link></span></nav>
    <header className="hero">
      <div><h1>Every Transaction Has a Story. We Detect the <em className="s">Risk</em> Behind It.</h1>
        <p>Intelligent fraud detection powered by machine learning, behavioural analysis, and explainable AI.</p>
        <div className="cta"><a className="btn gold" href="#how">Explore FraudSentinel</a><Link className="btn" to="/customer">Experience the Demo</Link></div></div>
      <div className="stage" aria-hidden="true"><Canvas dpr={[1, 1.75]} camera={{ position: [0, 0, 7], fov: 40 }}>
        <ambientLight intensity={0.9} /><directionalLight position={[4, 5, 6]} intensity={1.6} />
        <FloatCard bg="#25162F" fg="#fff" num="•••• 1247" pos={[0.6, 0.9, 0]} rot={[0.2, -0.5, 0.18]} speed={0.9} />
        <FloatCard bg="#E6AD3C" fg="#25162F" num="•••• 8912" pos={[-0.5, -1.1, 0.8]} rot={[-0.1, 0.45, -0.2]} speed={0.7} />
      </Canvas></div>
    </header>
    <section className="sec"><Reveal><span className="tag">The problem</span><h2>Fraud rarely looks like fraud. It looks <em className="s">unusual</em>.</h2>
      <p className="lead">A purchase far above a customer's norm, from a city they have never visited, on a device they have never used, at an hour they are normally asleep. Single signals are weak. Together they tell a story.</p>
      <div className="grid">{[["Amount", "Far above the customer's usual spend"], ["Location", "Distance and travel speed that cannot be real"], ["Device", "A device never seen on this account"], ["Behaviour", "Unusual hour, burst of rapid purchases"]].map(([a, b]) => <div className="card" key={a}><h3>{a}</h3><p style={{ color: "var(--slate)" }}>{b}</p></div>)}</div></Reveal></section>
    <section className="sec alt" id="how"><div><Reveal><span className="tag">How it works</span><h2>From a swipe to a <em className="s">decision</em> in seconds.</h2>
      <p className="lead">The model scores every transaction. A person makes the final call.</p>
      <div className="steps">{steps.map((s, i) => <span key={s} className="row"><span className={`step ${i === 5 ? "on" : ""}`}>{i + 1}. {s}</span>{i < 5 && <span className="arrow">→</span>}</span>)}</div></Reveal></div></section>
    <section className="sec"><Reveal><span className="tag">Explainable AI</span><h2>Not just a score. The <em className="s">reasons</em>.</h2>
      <p className="lead">Each flagged transaction shows which behaviours pushed the risk up, using SHAP contributions and a counterfactual hint. <b>The bars below are illustrative.</b> Live values appear in the analyst portal.</p>
      <div className="card" style={{ maxWidth: 640 }}><span className="tag">Illustrative example</span>{[["Amount vs. average", 90], ["Unusual hour", 60], ["New device", 42]].map(([n, w]) => <div key={n as string} style={{ margin: "14px 0" }}><div className="row" style={{ justifyContent: "space-between" }}><span>{n}</span><span style={{ color: "var(--slate)" }}>pushes risk up</span></div><div className="bar" style={{ width: `${w}%` }} /></div>)}
        <p style={{ color: "var(--slate)", marginBottom: 0 }}>Counterfactual: "If the amount were within 1.5× the customer's average, the risk would drop significantly."</p></div></Reveal></section>
    <section className="sec alt"><div><Reveal><span className="tag">Human decision</span><h2>AI provides the evidence. The analyst <em className="s">decides</em>.</h2>
      <p className="lead">Mark as genuine, hold for verification, or confirm fraud. Nothing is blocked by the model alone.</p></Reveal></div></section>
    <section className="sec"><Reveal><span className="tag">Protection</span><h2>Confirmed fraud triggers <em className="s">protection</em>.</h2>
      <p className="lead">The backend freezes the card and notifies the customer. In this prototype the card action is simulated and no real card or money is affected.</p>
      <div className="steps">{["Confirmed fraud", "Simulated card freeze", "Customer SMS"].map((s, i) => <span key={s} className="row"><span className="step">{s}</span>{i < 2 && <span className="arrow">→</span>}</span>)}</div></Reveal></section>
    <section className="sec alt"><div><Reveal><h2>See the whole journey, <em className="s">end to end</em>.</h2>
      <p className="lead">Submit a transaction as a customer, then investigate it as an analyst.</p>
      <div className="cta row"><Link className="btn gold" to="/customer">Open customer portal</Link><Link className="btn" to="/analyst">Open analyst portal</Link></div></Reveal></div></section>
    <footer className="sec" style={{ color: "var(--slate)", fontSize: 13 }}>Academic prototype. All transactions are simulated; no real payments, cards or bank data.</footer>
  </div>;
}

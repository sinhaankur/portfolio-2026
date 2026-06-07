import { useEffect, useState } from "react";
import { motion } from "framer-motion";
import { invoke } from "@tauri-apps/api/core";
import "./App.css";
import { UniverseBackdrop } from "./components/universe-backdrop";

type DailyBrief = {
  agent_name: string;
  owner: string;
  generated_at_unix: number;
  focus: string;
  next_actions: string[];
};

function App() {
  const [name, setName] = useState("Ankur");
  const [status, setStatus] = useState("checking");
  const [brief, setBrief] = useState<DailyBrief | null>(null);
  const [interactive, setInteractive] = useState(false);

  useEffect(() => {
    invoke<string>("healthcheck")
      .then((v) => setStatus(v))
      .catch(() => setStatus("offline"));
  }, []);

  async function generateBrief() {
    const response = await invoke<DailyBrief>("build_daily_brief", {
      name: name.trim() || undefined,
    });
    setBrief(response);
  }

  return (
    <main className="shell">
      <UniverseBackdrop interactive={interactive} />

      <header className="topbar">
        <div className="brand">
          <img src="/nomi-mark.svg" alt="Nomi logo" className="mark" />
          <div>
            <p className="kicker">01 — Personal Agent</p>
            <h1>Nomi</h1>
          </div>
        </div>
        <div className="top-actions">
          <p className="status">Rust core: {status}</p>
          <button className="ghost" onClick={() => setInteractive((v) => !v)}>
            {interactive ? "Exit orbit mode" : "Tap to explore"}
          </button>
        </div>
      </header>

      <motion.section
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.45 }}
        className="panel"
      >
        <p className="eyebrow">02 — Operator surface</p>
        <h2>Daily command interface</h2>
        <label htmlFor="owner">Operator</label>
        <div className="controls">
          <input
            id="owner"
            value={name}
            onChange={(e) => setName(e.currentTarget.value)}
            placeholder="Your name"
          />
          <button onClick={generateBrief}>Generate daily brief</button>
        </div>
      </motion.section>

      {brief && (
        <motion.section
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.35 }}
          className="panel"
        >
          <p className="eyebrow">03 — Nomi output</p>
          <h2>{brief.agent_name} plan for {brief.owner}</h2>
          <p>{brief.focus}</p>
          <ul>
            {brief.next_actions.map((action) => (
              <li key={action}>{action}</li>
            ))}
          </ul>
          <p className="timestamp">Generated at UNIX: {brief.generated_at_unix}</p>
        </motion.section>
      )}
    </main>
  );
}

export default App;

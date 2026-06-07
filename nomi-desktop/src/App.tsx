import { useEffect, useState } from "react";
import { invoke } from "@tauri-apps/api/core";
import "./App.css";

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
      <header className="topbar">
        <div className="brand">
          <img src="/nomi-mark.svg" alt="Nomi logo" className="mark" />
          <div>
            <p className="kicker">Personal Agent</p>
            <h1>Nomi</h1>
          </div>
        </div>
        <p className="status">Rust core: {status}</p>
      </header>

      <section className="panel">
        <label htmlFor="owner">Owner</label>
        <div className="controls">
          <input
            id="owner"
            value={name}
            onChange={(e) => setName(e.currentTarget.value)}
            placeholder="Your name"
          />
          <button onClick={generateBrief}>Generate daily brief</button>
        </div>
      </section>

      {brief && (
        <section className="panel">
          <h2>{brief.agent_name} plan for {brief.owner}</h2>
          <p>{brief.focus}</p>
          <ul>
            {brief.next_actions.map((action) => (
              <li key={action}>{action}</li>
            ))}
          </ul>
          <p className="timestamp">Generated at UNIX: {brief.generated_at_unix}</p>
        </section>
      )}
    </main>
  );
}

export default App;

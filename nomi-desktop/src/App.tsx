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

type LlmResponse = {
  provider: string;
  endpoint: string;
  model: string;
  content: string;
};

type UnhostedProfile = {
  mode: string;
  endpointHint: string;
  notes: string[];
};

function App() {
  const [name, setName] = useState("Ankur");
  const [status, setStatus] = useState("checking");
  const [brief, setBrief] = useState<DailyBrief | null>(null);
  const [interactive, setInteractive] = useState(false);
  const [endpoint, setEndpoint] = useState("http://localhost:11434/v1");
  const [model, setModel] = useState("qwen3:14b");
  const [apiKey, setApiKey] = useState("");
  const [systemPrompt, setSystemPrompt] = useState(
    "You are Nomi, a personal execution-focused AI operator. Be concise and practical.",
  );
  const [taskPrompt, setTaskPrompt] = useState("Plan my next 90 minutes for maximum output.");
  const [agentReply, setAgentReply] = useState<LlmResponse | null>(null);
  const [llmError, setLlmError] = useState("");
  const [running, setRunning] = useState(false);
  const [unhostedProfile, setUnhostedProfile] = useState<UnhostedProfile | null>(null);

  useEffect(() => {
    invoke<string>("healthcheck")
      .then((v) => setStatus(v))
      .catch(() => setStatus("offline"));

    invoke<UnhostedProfile>("unhosted_reference_profile")
      .then((profile) => setUnhostedProfile(profile))
      .catch(() => setUnhostedProfile(null));
  }, []);

  async function generateBrief() {
    const response = await invoke<DailyBrief>("build_daily_brief", {
      name: name.trim() || undefined,
    });
    setBrief(response);
  }

  async function runAgentTask() {
    setRunning(true);
    setLlmError("");
    try {
      const response = await invoke<LlmResponse>("run_llm_chat", {
        request: {
          endpoint: endpoint.trim(),
          model: model.trim(),
          prompt: taskPrompt,
          systemPrompt,
          apiKey: apiKey.trim() || undefined,
          temperature: 0.4,
          maxTokens: 600,
        },
      });
      setAgentReply(response);
    } catch (error) {
      setAgentReply(null);
      setLlmError(typeof error === "string" ? error : "Failed to run LLM task.");
    } finally {
      setRunning(false);
    }
  }

  function applyUnhostedReference() {
    if (!unhostedProfile) return;
    setEndpoint(unhostedProfile.endpointHint);
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

      <motion.section
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.5 }}
        className="panel"
      >
        <div className="panel-head">
          <div>
            <p className="eyebrow">03 — LLM core</p>
            <h2>Unhosted-compatible runtime connection</h2>
          </div>
          <button className="ghost" onClick={applyUnhostedReference}>
            Use Unhosted reference
          </button>
        </div>

        <div className="llm-grid">
          <label>
            Endpoint
            <input value={endpoint} onChange={(e) => setEndpoint(e.currentTarget.value)} placeholder="https://your-unhosted-endpoint/v1" />
          </label>
          <label>
            Model
            <input value={model} onChange={(e) => setModel(e.currentTarget.value)} placeholder="qwen3:14b" />
          </label>
          <label>
            API key (optional for local)
            <input value={apiKey} onChange={(e) => setApiKey(e.currentTarget.value)} placeholder="sk-..." />
          </label>
          <label className="full">
            System prompt
            <textarea value={systemPrompt} onChange={(e) => setSystemPrompt(e.currentTarget.value)} rows={3} />
          </label>
          <label className="full">
            Task prompt
            <textarea value={taskPrompt} onChange={(e) => setTaskPrompt(e.currentTarget.value)} rows={4} />
          </label>
        </div>

        {unhostedProfile && (
          <ul className="hint-list">
            {unhostedProfile.notes.map((note) => (
              <li key={note}>{note}</li>
            ))}
          </ul>
        )}

        <div className="controls">
          <button onClick={runAgentTask} disabled={running}>
            {running ? "Running..." : "Run personal agent task"}
          </button>
        </div>

        {llmError && <p className="error">{llmError}</p>}

        {agentReply && (
          <div className="reply-block">
            <p className="eyebrow">Provider · {agentReply.provider}</p>
            <p className="timestamp">Endpoint: {agentReply.endpoint}</p>
            <p className="timestamp">Model: {agentReply.model}</p>
            <p className="reply-text">{agentReply.content}</p>
          </div>
        )}
      </motion.section>

      {brief && (
        <motion.section
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.35 }}
          className="panel"
        >
          <p className="eyebrow">04 — Nomi output</p>
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

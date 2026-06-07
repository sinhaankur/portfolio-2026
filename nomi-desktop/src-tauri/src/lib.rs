use serde::Deserialize;
use serde::Serialize;
use serde_json::{json, Value};
use std::time::{SystemTime, UNIX_EPOCH};

#[derive(Serialize)]
struct DailyBrief {
    agent_name: &'static str,
    owner: String,
    generated_at_unix: u64,
    focus: &'static str,
    next_actions: Vec<&'static str>,
}

#[tauri::command]
fn build_daily_brief(name: Option<String>) -> DailyBrief {
    let owner = name
        .unwrap_or_else(|| "Ankur".to_string())
        .trim()
        .to_string();

    let generated_at_unix = SystemTime::now()
        .duration_since(UNIX_EPOCH)
        .map(|d| d.as_secs())
        .unwrap_or(0);

    DailyBrief {
        agent_name: "Nomi",
        owner,
        generated_at_unix,
        focus: "Protect focus blocks and convert intent into shippable actions.",
        next_actions: vec![
            "Lock a 45-minute build window with zero context switching.",
            "Ship one concrete feature before opening communication tools.",
            "Close with a short retro note for the next startup context.",
        ],
    }
}

#[tauri::command]
fn healthcheck() -> &'static str {
    "nomi-ready"
}

#[derive(Deserialize)]
#[serde(rename_all = "camelCase")]
struct LlmRequest {
    endpoint: String,
    model: String,
    prompt: String,
    system_prompt: Option<String>,
    api_key: Option<String>,
    temperature: Option<f32>,
    max_tokens: Option<u32>,
}

#[derive(Serialize)]
#[serde(rename_all = "camelCase")]
struct LlmResponse {
    provider: String,
    endpoint: String,
    model: String,
    content: String,
}

#[derive(Serialize)]
#[serde(rename_all = "camelCase")]
struct UnhostedProfile {
    mode: &'static str,
    endpoint_hint: &'static str,
    notes: Vec<&'static str>,
}

fn parse_content(value: &Value) -> Option<String> {
    let content = value
        .get("choices")
        .and_then(|c| c.get(0))
        .and_then(|c| c.get("message"))
        .and_then(|m| m.get("content"))?;

    match content {
        Value::String(s) => Some(s.clone()),
        Value::Array(parts) => {
            let joined = parts
                .iter()
                .filter_map(|part| part.get("text").and_then(Value::as_str))
                .collect::<Vec<_>>()
                .join("\n");
            if joined.is_empty() {
                None
            } else {
                Some(joined)
            }
        }
        _ => None,
    }
}

#[tauri::command]
async fn run_llm_chat(request: LlmRequest) -> Result<LlmResponse, String> {
    let endpoint = request.endpoint.trim().trim_end_matches('/').to_string();
    if endpoint.is_empty() {
        return Err("LLM endpoint is required.".to_string());
    }
    if request.model.trim().is_empty() {
        return Err("Model name is required.".to_string());
    }
    if request.prompt.trim().is_empty() {
        return Err("Prompt is required.".to_string());
    }

    let url = format!("{endpoint}/chat/completions");
    let mut messages = vec![json!({ "role": "system", "content": request.system_prompt.unwrap_or_else(|| "You are Nomi, a local-first personal AI operator focused on practical execution.".to_string()) })];
    messages.push(json!({ "role": "user", "content": request.prompt }));

    let mut body = json!({
        "model": request.model,
        "messages": messages,
        "stream": false,
    });

    if let Some(t) = request.temperature {
        body["temperature"] = json!(t);
    }
    if let Some(m) = request.max_tokens {
        body["max_tokens"] = json!(m);
    }

    let client = reqwest::Client::new();
    let mut req = client.post(url).json(&body);
    if let Some(key) = request.api_key.filter(|k| !k.trim().is_empty()) {
        req = req.bearer_auth(key);
    }

    let resp = req.send().await.map_err(|e| format!("Network error: {e}"))?;
    let status = resp.status();
    let payload: Value = resp
        .json()
        .await
        .map_err(|e| format!("Invalid JSON response: {e}"))?;

    if !status.is_success() {
        let err_msg = payload
            .get("error")
            .and_then(|e| e.get("message"))
            .and_then(Value::as_str)
            .unwrap_or("Unknown LLM API error");
        return Err(format!("API error ({status}): {err_msg}"));
    }

    let content = parse_content(&payload)
        .ok_or_else(|| "No assistant content found in response.".to_string())?;

    Ok(LlmResponse {
        provider: "openai-compatible".to_string(),
        endpoint,
        model: request.model,
        content,
    })
}

#[tauri::command]
fn unhosted_reference_profile() -> UnhostedProfile {
    UnhostedProfile {
        mode: "openai-compatible",
        endpoint_hint: "https://your-unhosted-endpoint/v1",
        notes: vec![
            "Use your Unhosted gateway URL and key in the LLM panel.",
            "Nomi sends chat/completions requests over a standard OpenAI-compatible schema.",
            "For local-only mode, switch endpoint to Ollama or LM Studio.",
        ],
    }
}

#[cfg_attr(mobile, tauri::mobile_entry_point)]
pub fn run() {
    tauri::Builder::default()
        .plugin(tauri_plugin_opener::init())
        .invoke_handler(tauri::generate_handler![
            build_daily_brief,
            healthcheck,
            run_llm_chat,
            unhosted_reference_profile
        ])
        .run(tauri::generate_context!())
        .expect("error while running tauri application");
}

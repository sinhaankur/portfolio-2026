use serde::Serialize;
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

#[cfg_attr(mobile, tauri::mobile_entry_point)]
pub fn run() {
    tauri::Builder::default()
        .plugin(tauri_plugin_opener::init())
        .invoke_handler(tauri::generate_handler![build_daily_brief, healthcheck])
        .run(tauri::generate_context!())
        .expect("error while running tauri application");
}

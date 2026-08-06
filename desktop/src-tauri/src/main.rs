// Prevents an extra console window on Windows in release.
#![cfg_attr(not(debug_assertions), windows_subsystem = "windows")]

use std::net::TcpStream;
use std::process::{Child, Command};
use std::sync::Mutex;
use std::time::Duration;
use tauri::{Manager, WindowEvent};

const PORT: u16 = 8123;

// Holds the spawned backend process so we can kill it when the app closes.
struct Backend(Mutex<Option<Child>>);

// Check for a signed update on startup; if there is one, ask the doctor (in Bangla) and,
// on yes, download + install + relaunch. Data is untouched (it lives in the data dir, and
// the new version snapshots the DB before any schema change), so this is always safe.
async fn check_for_update(handle: tauri::AppHandle) {
    use tauri_plugin_dialog::{DialogExt, MessageDialogButtons};
    use tauri_plugin_updater::UpdaterExt;

    let updater = match handle.updater() {
        Ok(u) => u,
        Err(_) => return,
    };
    let update = match updater.check().await {
        Ok(Some(u)) => u,
        _ => return, // no update, offline, or check failed → do nothing (never blocks)
    };
    let msg = format!(
        "নতুন সংস্করণ ({}) পাওয়া গেছে। এখন আপডেট করবেন?\n\nআপনার সব তথ্য সম্পূর্ণ নিরাপদ থাকবে।",
        update.version
    );
    let yes = handle
        .dialog()
        .message(msg)
        .title("আপডেট আছে")
        .buttons(MessageDialogButtons::OkCancelCustom(
            "এখন আপডেট করুন".to_string(),
            "পরে".to_string(),
        ))
        .blocking_show();
    if !yes {
        return;
    }
    if update.download_and_install(|_, _| {}, || {}).await.is_ok() {
        handle
            .dialog()
            .message("আপডেট সম্পন্ন হয়েছে। অ্যাপটি আবার চালু হচ্ছে।")
            .title("সম্পন্ন")
            .blocking_show();
        handle.restart();
    }
}

fn main() {
    tauri::Builder::default()
        .plugin(tauri_plugin_updater::Builder::new().build())
        .plugin(tauri_plugin_process::init())
        .plugin(tauri_plugin_dialog::init())
        .manage(Backend(Mutex::new(None)))
        .setup(|app| {
            let res = app.path().resource_dir()?;
            let backend_dir = res.join("resources").join("backend");
            // Universal build: each arch slice picks its own bundled Node binary.
            let node_name = if cfg!(windows) {
                "node.exe"
            } else if cfg!(target_arch = "aarch64") {
                "node-arm64"
            } else {
                "node-x64"
            };
            let node = res.join("resources").join("bin").join(node_name);

            // Per-user, persistent data dir (SQLite db + uploads + backups live here).
            let data_dir = app.path().app_data_dir()?;
            std::fs::create_dir_all(&data_dir).ok();
            let db_url = format!("file:{}", data_dir.join("dento.db").display());

            let child = Command::new(&node)
                .arg("dist/main.js")
                .current_dir(&backend_dir)
                .env("APP_MODE", "offline")
                .env("DATABASE_URL", db_url)
                .env("DATA_DIR", data_dir.to_string_lossy().to_string())
                .env("PORT", PORT.to_string())
                .spawn()
                .expect("failed to start the Dento Khata backend");

            app.state::<Backend>().0.lock().unwrap().replace(child);

            // When the backend is listening, point the window at it (it serves the UI + API
            // on one port, so LAN devices use the same address).
            let window = app.get_webview_window("main").expect("main window");
            std::thread::spawn(move || {
                for _ in 0..300 {
                    if TcpStream::connect(("127.0.0.1", PORT)).is_ok() {
                        break;
                    }
                    std::thread::sleep(Duration::from_millis(400));
                }
                let _ = window.eval(&format!(
                    "window.location.replace('http://127.0.0.1:{}')",
                    PORT
                ));
            });

            // Check for updates in the background (never blocks the app).
            let handle = app.handle().clone();
            tauri::async_runtime::spawn(async move {
                check_for_update(handle).await;
            });

            Ok(())
        })
        .on_window_event(|window, event| {
            if let WindowEvent::Destroyed = event {
                if let Some(mut child) = window
                    .app_handle()
                    .state::<Backend>()
                    .0
                    .lock()
                    .unwrap()
                    .take()
                {
                    let _ = child.kill();
                }
            }
        })
        .run(tauri::generate_context!())
        .expect("error while running Dento Khata");
}

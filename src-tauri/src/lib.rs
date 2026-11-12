mod commands;

use commands::files::load_paths;
use commands::rename::{execute_rename, rollback_rename};
use tauri::{include_image, Manager};

const APP_ICON: tauri::image::Image<'_> = include_image!("icons/32x32.png");

#[cfg_attr(mobile, tauri::mobile_entry_point)]
pub fn run() {
    tauri::Builder::default()
        .plugin(tauri_plugin_opener::init())
        .plugin(tauri_plugin_dialog::init())
        .invoke_handler(tauri::generate_handler![load_paths, execute_rename, rollback_rename])
        .setup(|app| {
            for (_, window) in app.webview_windows() {
                let _ = window.set_icon(APP_ICON.clone());
            }
            Ok(())
        })
        .run(tauri::generate_context!())
        .expect("error while running tauri application");
}

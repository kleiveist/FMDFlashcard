use std::{
    fs,
    path::{Path, PathBuf},
};

use tauri::Manager;
use walkdir::{DirEntry, WalkDir};

#[derive(serde::Serialize)]
struct VaultFile {
    path: String,
    relative_path: String,
}

#[derive(serde::Deserialize, serde::Serialize, Default)]
struct AppSettings {
    vault_path: Option<String>,
    theme: Option<String>,
    accent_color: Option<String>,
}

impl AppSettings {
    fn is_empty(&self) -> bool {
        self.vault_path.is_none() && self.theme.is_none() && self.accent_color.is_none()
    }
}

fn is_hidden(entry: &DirEntry) -> bool {
    entry.file_name().to_string_lossy().starts_with('.')
}

fn is_markdown(path: &Path) -> bool {
    match path.extension().and_then(|ext| ext.to_str()) {
        Some(ext) => {
            ext.eq_ignore_ascii_case("md")
                || ext.eq_ignore_ascii_case("markdown")
                || ext.eq_ignore_ascii_case("mdx")
        }
        None => false,
    }
}

fn settings_path(app: &tauri::AppHandle) -> Result<PathBuf, String> {
    app.path()
        .app_data_dir()
        .map_err(|err| err.to_string())
        .map(|dir| dir.join("settings.json"))
}

fn read_settings(path: &Path) -> Result<AppSettings, String> {
    if !path.exists() {
        return Ok(AppSettings::default());
    }

    let data = fs::read_to_string(path).map_err(|err| err.to_string())?;
    serde_json::from_str(&data).map_err(|err| err.to_string())
}

fn write_settings(path: &Path, settings: &AppSettings) -> Result<(), String> {
    if settings.is_empty() {
        if path.exists() {
            fs::remove_file(path).map_err(|err| err.to_string())?;
        }
        return Ok(());
    }

    if let Some(parent) = path.parent() {
        fs::create_dir_all(parent).map_err(|err| err.to_string())?;
    }

    let data = serde_json::to_string_pretty(settings).map_err(|err| err.to_string())?;
    fs::write(path, data).map_err(|err| err.to_string())
}

#[tauri::command]
fn load_app_settings(app: tauri::AppHandle) -> Result<AppSettings, String> {
    let path = settings_path(&app)?;
    read_settings(&path)
}

#[tauri::command]
fn save_app_settings(
    app: tauri::AppHandle,
    vault_path: Option<String>,
    theme: Option<String>,
    accent_color: Option<String>,
) -> Result<(), String> {
    let path = settings_path(&app)?;
    let settings = AppSettings {
        vault_path,
        theme,
        accent_color,
    };
    write_settings(&path, &settings)
}

#[tauri::command]
fn load_vault_path(app: tauri::AppHandle) -> Result<Option<String>, String> {
    let path = settings_path(&app)?;
    let settings = read_settings(&path)?;
    Ok(settings.vault_path)
}

#[tauri::command]
fn save_vault_path(app: tauri::AppHandle, vault_path: Option<String>) -> Result<(), String> {
    let path = settings_path(&app)?;
    let mut settings = read_settings(&path)?;
    settings.vault_path = vault_path;
    write_settings(&path, &settings)
}

#[tauri::command]
fn list_markdown_files(vault_path: String) -> Result<Vec<VaultFile>, String> {
    let root = PathBuf::from(vault_path);
    if !root.exists() {
        return Err("Vault path does not exist.".to_string());
    }
    if !root.is_dir() {
        return Err("Vault path is not a directory.".to_string());
    }

    let mut files = Vec::new();
    for entry in WalkDir::new(&root)
        .into_iter()
        .filter_entry(|entry| !is_hidden(entry))
    {
        let entry = match entry {
            Ok(entry) => entry,
            Err(_) => continue,
        };
        if entry.file_type().is_file() {
            let path = entry.path();
            if is_markdown(path) {
                let relative = path.strip_prefix(&root).unwrap_or(path);
                files.push(VaultFile {
                    path: path.to_string_lossy().to_string(),
                    relative_path: relative.to_string_lossy().to_string(),
                });
            }
        }
    }

    files.sort_by(|a, b| a.relative_path.cmp(&b.relative_path));
    Ok(files)
}

#[tauri::command]
fn read_text_file(path: String) -> Result<String, String> {
    let path = PathBuf::from(path);
    if !path.exists() {
        return Err("File not found.".to_string());
    }
    if !path.is_file() {
        return Err("Path is not a file.".to_string());
    }
    if !is_markdown(&path) {
        return Err("Only markdown files are supported.".to_string());
    }
    fs::read_to_string(&path).map_err(|err| err.to_string())
}

#[cfg_attr(mobile, tauri::mobile_entry_point)]
pub fn run() {
    tauri::Builder::default()
        .plugin(tauri_plugin_dialog::init())
        .plugin(tauri_plugin_opener::init())
        .invoke_handler(tauri::generate_handler![
            load_app_settings,
            save_app_settings,
            load_vault_path,
            save_vault_path,
            list_markdown_files,
            read_text_file
        ])
        .run(tauri::generate_context!())
        .expect("error while running tauri application");
}

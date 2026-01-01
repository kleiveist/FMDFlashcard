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
struct VaultSettings {
    vault_path: Option<String>,
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

#[tauri::command]
fn load_vault_path(app: tauri::AppHandle) -> Result<Option<String>, String> {
    let path = settings_path(&app)?;
    if !path.exists() {
        return Ok(None);
    }

    let data = fs::read_to_string(&path).map_err(|err| err.to_string())?;
    let settings: VaultSettings = serde_json::from_str(&data).map_err(|err| err.to_string())?;
    Ok(settings.vault_path)
}

#[tauri::command]
fn save_vault_path(app: tauri::AppHandle, vault_path: Option<String>) -> Result<(), String> {
    let path = settings_path(&app)?;

    if vault_path.is_none() {
        if path.exists() {
            fs::remove_file(&path).map_err(|err| err.to_string())?;
        }
        return Ok(());
    }

    if let Some(parent) = path.parent() {
        fs::create_dir_all(parent).map_err(|err| err.to_string())?;
    }

    let settings = VaultSettings { vault_path };
    let data = serde_json::to_string_pretty(&settings).map_err(|err| err.to_string())?;
    fs::write(&path, data).map_err(|err| err.to_string())
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
            load_vault_path,
            save_vault_path,
            list_markdown_files,
            read_text_file
        ])
        .run(tauri::generate_context!())
        .expect("error while running tauri application");
}

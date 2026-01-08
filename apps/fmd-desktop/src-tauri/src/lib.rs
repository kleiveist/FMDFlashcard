use std::{
    collections::HashMap,
    fs,
    path::{Component, Path, PathBuf},
};

use tauri::Manager;
use walkdir::{DirEntry, WalkDir};

#[derive(serde::Serialize)]
struct VaultFile {
    path: String,
    relative_path: String,
}

#[derive(serde::Deserialize, serde::Serialize, Default, Clone)]
#[serde(default)]
struct ExamAiEvaluation {
    enabled: bool,
    provider: Option<String>,
}

#[derive(serde::Deserialize, serde::Serialize, Default, Clone)]
struct AppSettings {
    active_note_path: Option<String>,
    vault_path: Option<String>,
    theme: Option<String>,
    accent_color: Option<String>,
    editor_exact_colors: Option<bool>,
    editor_blueprint_grid: Option<bool>,
    editor_blueprint_grid_intensity: Option<String>,
    language: Option<String>,
    max_files_per_scan: Option<String>,
    scan_parallelism: Option<String>,
    flashcard_order: Option<String>,
    flashcard_mode: Option<String>,
    flashcard_scope: Option<String>,
    flashcard_page_size: Option<u32>,
    flashcard_solution_reveal_enabled: Option<bool>,
    flashcard_stats_reset_mode: Option<String>,
    fast_flashcard_order: Option<String>,
    fast_flashcard_mode: Option<String>,
    fast_flashcard_scope: Option<String>,
    fast_flashcard_duration: Option<u32>,
    spaced_repetition_boxes: Option<u32>,
    spaced_repetition_order: Option<String>,
    spaced_repetition_page_size: Option<u32>,
    spaced_repetition_repetition_strength: Option<String>,
    spaced_repetition_stats_view: Option<String>,
    right_toolbar_collapsed: Option<bool>,
    exam_max_total_points: Option<u32>,
    exam_task_count: Option<u32>,
    exam_task_points: Option<Vec<u32>>,
    exam_ai_evaluation: Option<ExamAiEvaluation>,
}

#[derive(serde::Deserialize, serde::Serialize, Default, Clone)]
#[serde(rename_all = "camelCase", default)]
struct SpacedRepetitionCardState {
    #[serde(rename = "box", skip_serializing_if = "Option::is_none")]
    r#box: Option<u32>,
    #[serde(skip_serializing_if = "Option::is_none")]
    box_canonical: Option<u32>,
    attempts: u32,
    last_result: Option<String>,
    last_reviewed_at: Option<String>,
}

#[derive(serde::Deserialize, serde::Serialize, Default, Clone)]
#[serde(rename_all = "camelCase", default)]
struct SpacedRepetitionUserState {
    card_states: HashMap<String, SpacedRepetitionCardState>,
    last_loaded_at: Option<String>,
    #[serde(skip_serializing_if = "HashMap::is_empty")]
    completed_per_day: HashMap<String, u32>,
}

#[derive(serde::Deserialize, serde::Serialize, Default, Clone)]
#[serde(rename_all = "camelCase")]
struct SpacedRepetitionUser {
    id: String,
    name: String,
    created_at: String,
}

#[derive(serde::Deserialize, serde::Serialize, Default, Clone)]
#[serde(rename_all = "camelCase")]
struct SpacedRepetitionStorage {
    users: Vec<SpacedRepetitionUser>,
    user_state_by_id: HashMap<String, SpacedRepetitionUserState>,
    last_active_user_id: Option<String>,
}

#[derive(serde::Deserialize, serde::Serialize, Default)]
#[serde(rename_all = "camelCase", default)]
struct FastFlashcardSession {
    id: String,
    ended_at: String,
    score: i32,
    correct: u32,
    incorrect: u32,
    total: u32,
    accuracy: f32,
    pace: f32,
    duration_ms: u64,
}

#[derive(serde::Deserialize, serde::Serialize, Default)]
#[serde(rename_all = "camelCase", default)]
struct FastFlashcardStorage {
    sessions: Vec<FastFlashcardSession>,
}

impl AppSettings {
    fn is_empty(&self) -> bool {
        self.vault_path.is_none()
            && self.active_note_path.is_none()
            && self.theme.is_none()
            && self.accent_color.is_none()
            && self.editor_exact_colors.is_none()
            && self.editor_blueprint_grid.is_none()
            && self.editor_blueprint_grid_intensity.is_none()
            && self.language.is_none()
            && self.max_files_per_scan.is_none()
            && self.scan_parallelism.is_none()
            && self.flashcard_order.is_none()
            && self.flashcard_mode.is_none()
            && self.flashcard_scope.is_none()
            && self.flashcard_page_size.is_none()
            && self.flashcard_solution_reveal_enabled.is_none()
            && self.flashcard_stats_reset_mode.is_none()
            && self.fast_flashcard_order.is_none()
            && self.fast_flashcard_mode.is_none()
            && self.fast_flashcard_scope.is_none()
            && self.fast_flashcard_duration.is_none()
            && self.spaced_repetition_boxes.is_none()
            && self.spaced_repetition_order.is_none()
            && self.spaced_repetition_page_size.is_none()
            && self.spaced_repetition_repetition_strength.is_none()
            && self.spaced_repetition_stats_view.is_none()
            && self.right_toolbar_collapsed.is_none()
            && self.exam_max_total_points.is_none()
            && self.exam_task_count.is_none()
            && self.exam_task_points.is_none()
            && self.exam_ai_evaluation.is_none()
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

fn sanitize_relative_path(relative_path: &str) -> Result<PathBuf, String> {
    if relative_path.trim().is_empty() {
        return Err("Path is empty.".to_string());
    }
    let relative = Path::new(relative_path);
    if relative.is_absolute() {
        return Err("Path must be relative.".to_string());
    }
    for component in relative.components() {
        match component {
            Component::ParentDir | Component::RootDir | Component::Prefix(_) => {
                return Err("Path is not allowed.".to_string())
            }
            _ => {}
        }
    }
    Ok(relative.to_path_buf())
}

fn format_relative_path(path: &Path) -> String {
    path.to_string_lossy().replace('\\', "/")
}

fn settings_path(app: &tauri::AppHandle) -> Result<PathBuf, String> {
    app.path()
        .app_data_dir()
        .map_err(|err| err.to_string())
        .map(|dir| dir.join("settings.json"))
}

fn spaced_repetition_path(app: &tauri::AppHandle) -> Result<PathBuf, String> {
    app.path()
        .app_data_dir()
        .map_err(|err| err.to_string())
        .map(|dir| dir.join("spaced_repetition.json"))
}

fn fast_flashcard_path(app: &tauri::AppHandle) -> Result<PathBuf, String> {
    app.path()
        .app_data_dir()
        .map_err(|err| err.to_string())
        .map(|dir| dir.join("fast_flashcard.json"))
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

const LEGACY_SPACED_REPETITION_KEY: &str = "spacedRepetition:legacy";

fn read_spaced_repetition_file(
    path: &Path,
) -> Result<HashMap<String, SpacedRepetitionStorage>, String> {
    if !path.exists() {
        return Ok(HashMap::new());
    }

    let data = fs::read_to_string(path).map_err(|err| err.to_string())?;
    if data.trim().is_empty() {
        return Ok(HashMap::new());
    }

    if let Ok(map) =
        serde_json::from_str::<HashMap<String, SpacedRepetitionStorage>>(&data)
    {
        return Ok(map);
    }

    if let Ok(storage) = serde_json::from_str::<SpacedRepetitionStorage>(&data) {
        let mut map = HashMap::new();
        map.insert(LEGACY_SPACED_REPETITION_KEY.to_string(), storage);
        return Ok(map);
    }

    Ok(HashMap::new())
}

fn write_spaced_repetition_file(
    path: &Path,
    entries: &HashMap<String, SpacedRepetitionStorage>,
) -> Result<(), String> {
    if let Some(parent) = path.parent() {
        fs::create_dir_all(parent).map_err(|err| err.to_string())?;
    }

    let data = serde_json::to_string_pretty(entries).map_err(|err| err.to_string())?;
    fs::write(path, data).map_err(|err| err.to_string())
}

fn read_fast_flashcard_data(path: &Path) -> Result<FastFlashcardStorage, String> {
    if !path.exists() {
        return Ok(FastFlashcardStorage::default());
    }

    let data = fs::read_to_string(path).map_err(|err| err.to_string())?;
    match serde_json::from_str(&data) {
        Ok(storage) => Ok(storage),
        Err(_) => Ok(FastFlashcardStorage::default()),
    }
}

fn write_fast_flashcard_data(
    path: &Path,
    storage: &FastFlashcardStorage,
) -> Result<(), String> {
    if let Some(parent) = path.parent() {
        fs::create_dir_all(parent).map_err(|err| err.to_string())?;
    }

    let data = serde_json::to_string_pretty(storage).map_err(|err| err.to_string())?;
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
    active_note_path: Option<String>,
    vault_path: Option<String>,
    theme: Option<String>,
    accent_color: Option<String>,
    editor_exact_colors: Option<bool>,
    editor_blueprint_grid: Option<bool>,
    editor_blueprint_grid_intensity: Option<String>,
    language: Option<String>,
    max_files_per_scan: Option<String>,
    scan_parallelism: Option<String>,
    flashcard_order: Option<String>,
    flashcard_mode: Option<String>,
    flashcard_scope: Option<String>,
    flashcard_page_size: Option<u32>,
    flashcard_solution_reveal_enabled: Option<bool>,
    flashcard_stats_reset_mode: Option<String>,
    fast_flashcard_order: Option<String>,
    fast_flashcard_mode: Option<String>,
    fast_flashcard_scope: Option<String>,
    fast_flashcard_duration: Option<u32>,
    spaced_repetition_boxes: Option<u32>,
    spaced_repetition_order: Option<String>,
    spaced_repetition_page_size: Option<u32>,
    spaced_repetition_repetition_strength: Option<String>,
    spaced_repetition_stats_view: Option<String>,
    right_toolbar_collapsed: Option<bool>,
    exam_max_total_points: Option<u32>,
    exam_task_count: Option<u32>,
    exam_task_points: Option<Vec<u32>>,
    exam_ai_evaluation: Option<ExamAiEvaluation>,
) -> Result<(), String> {
    let path = settings_path(&app)?;
    let settings = AppSettings {
        active_note_path,
        vault_path,
        theme,
        accent_color,
        editor_exact_colors,
        editor_blueprint_grid,
        editor_blueprint_grid_intensity,
        language,
        max_files_per_scan,
        scan_parallelism,
        flashcard_order,
        flashcard_mode,
        flashcard_scope,
        flashcard_page_size,
        flashcard_solution_reveal_enabled,
        flashcard_stats_reset_mode,
        fast_flashcard_order,
        fast_flashcard_mode,
        fast_flashcard_scope,
        fast_flashcard_duration,
        spaced_repetition_boxes,
        spaced_repetition_order,
        spaced_repetition_page_size,
        spaced_repetition_repetition_strength,
        spaced_repetition_stats_view,
        right_toolbar_collapsed,
        exam_max_total_points,
        exam_task_count,
        exam_task_points,
        exam_ai_evaluation,
    };
    write_settings(&path, &settings)
}

#[tauri::command]
fn load_spaced_repetition_data(
    app: tauri::AppHandle,
    key: String,
) -> Result<SpacedRepetitionStorage, String> {
    let path = spaced_repetition_path(&app)?;
    let entries = read_spaced_repetition_file(&path)?;
    Ok(entries
        .get(&key)
        .cloned()
        .or_else(|| entries.get(LEGACY_SPACED_REPETITION_KEY).cloned())
        .unwrap_or_default())
}

#[tauri::command]
fn save_spaced_repetition_data(
    app: tauri::AppHandle,
    key: String,
    storage: SpacedRepetitionStorage,
) -> Result<(), String> {
    let path = spaced_repetition_path(&app)?;
    let mut entries = read_spaced_repetition_file(&path)?;
    entries.insert(key, storage);
    entries.remove(LEGACY_SPACED_REPETITION_KEY);
    write_spaced_repetition_file(&path, &entries)
}

#[tauri::command]
fn load_fast_flashcard_data(app: tauri::AppHandle) -> Result<FastFlashcardStorage, String> {
    let path = fast_flashcard_path(&app)?;
    read_fast_flashcard_data(&path)
}

#[tauri::command]
fn save_fast_flashcard_data(
    app: tauri::AppHandle,
    storage: FastFlashcardStorage,
) -> Result<(), String> {
    let path = fast_flashcard_path(&app)?;
    write_fast_flashcard_data(&path, &storage)
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

#[tauri::command]
fn write_text_file(path: String, contents: String) -> Result<(), String> {
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
    fs::write(path, contents).map_err(|err| err.to_string())
}

#[tauri::command]
fn create_markdown_file(
    vault_path: String,
    relative_path: String,
) -> Result<VaultFile, String> {
    let root = PathBuf::from(&vault_path);
    if !root.exists() {
        return Err("Vault path does not exist.".to_string());
    }
    if !root.is_dir() {
        return Err("Vault path is not a directory.".to_string());
    }
    let relative = sanitize_relative_path(&relative_path)?;
    let full_path = root.join(&relative);
    if !full_path.starts_with(&root) {
        return Err("Path is outside the vault.".to_string());
    }
    if full_path.exists() {
        return Err("File already exists.".to_string());
    }
    match full_path.extension().and_then(|ext| ext.to_str()) {
        Some(ext) if ext.eq_ignore_ascii_case("md") => {}
        _ => return Err("Only .md files are supported.".to_string()),
    }
    if let Some(parent) = full_path.parent() {
        fs::create_dir_all(parent).map_err(|err| err.to_string())?;
    }
    fs::write(&full_path, "").map_err(|err| err.to_string())?;
    Ok(VaultFile {
        path: full_path.to_string_lossy().to_string(),
        relative_path: format_relative_path(&relative),
    })
}

#[tauri::command]
fn create_directory(vault_path: String, relative_path: String) -> Result<(), String> {
    let root = PathBuf::from(&vault_path);
    if !root.exists() {
        return Err("Vault path does not exist.".to_string());
    }
    if !root.is_dir() {
        return Err("Vault path is not a directory.".to_string());
    }
    let relative = sanitize_relative_path(&relative_path)?;
    let full_path = root.join(&relative);
    if !full_path.starts_with(&root) {
        return Err("Path is outside the vault.".to_string());
    }
    if full_path.exists() {
        return Err("Folder already exists.".to_string());
    }
    if let Some(parent) = full_path.parent() {
        fs::create_dir_all(parent).map_err(|err| err.to_string())?;
    }
    fs::create_dir(&full_path).map_err(|err| err.to_string())
}

#[cfg_attr(mobile, tauri::mobile_entry_point)]
pub fn run() {
    tauri::Builder::default()
        .plugin(tauri_plugin_dialog::init())
        .plugin(tauri_plugin_opener::init())
        .invoke_handler(tauri::generate_handler![
            load_app_settings,
            save_app_settings,
            load_spaced_repetition_data,
            save_spaced_repetition_data,
            load_fast_flashcard_data,
            save_fast_flashcard_data,
            load_vault_path,
            save_vault_path,
            list_markdown_files,
            read_text_file,
            write_text_file,
            create_markdown_file,
            create_directory
        ])
        .run(tauri::generate_context!())
        .expect("error while running tauri application");
}

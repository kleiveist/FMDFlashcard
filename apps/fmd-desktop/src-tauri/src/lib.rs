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

#[derive(serde::Serialize)]
struct VaultScanResults {
    files: Vec<VaultFile>,
    folders: Vec<String>,
}

#[derive(serde::Serialize)]
#[serde(rename_all = "camelCase")]
struct PathInfo {
    exists: bool,
    is_dir: bool,
}

#[derive(serde::Deserialize, serde::Serialize, Default, Clone)]
#[serde(default)]
struct ExamAiEvaluation {
    enabled: bool,
    provider: Option<String>,
}

#[derive(serde::Deserialize, serde::Serialize, Default, Clone)]
#[serde(default)]
struct KeyboardShortcutSettings {
    version: Option<u32>,
    bindings: HashMap<String, Option<String>>,
}

#[derive(serde::Deserialize, serde::Serialize, Default, Clone)]
#[serde(rename_all = "camelCase")]
struct RecentVaultEntry {
    id: Option<String>,
    path: String,
    last_opened_at: Option<String>,
    status: Option<String>,
    last_seen_at: Option<String>,
    last_error: Option<String>,
}

#[derive(serde::Deserialize, serde::Serialize, Default, Clone)]
#[serde(rename_all = "camelCase", default)]
struct MarkdownEditorAccentColor {
    light_hex: Option<String>,
    dark_hex: Option<String>,
    custom_swatches: Option<Vec<String>>,
}

#[derive(serde::Deserialize, serde::Serialize, Default, Clone)]
#[serde(rename_all = "camelCase", default)]
struct MarkdownEditorSettings {
    accent_color: Option<MarkdownEditorAccentColor>,
    accent_color_hex: Option<String>,
}

#[derive(serde::Deserialize, serde::Serialize, Default, Clone)]
struct AppSettings {
    active_note_path: Option<String>,
    vault_path: Option<String>,
    recent_vaults: Option<Vec<RecentVaultEntry>>,
    user_vault_mode: Option<String>,
    user_vault_custom_path: Option<String>,
    user_vault_last_path: Option<String>,
    user_vault_selected_auto_path: Option<String>,
    user_vault_selected_custom_path: Option<String>,
    theme: Option<String>,
    accent_color: Option<String>,
    #[serde(rename = "markdownEditor")]
    markdown_editor: Option<MarkdownEditorSettings>,
    editor_exact_colors: Option<bool>,
    editor_markdown_exact_colors_enabled: Option<bool>,
    editor_markdown_custom_accent_hex: Option<String>,
    editor_blueprint_grid: Option<bool>,
    editor_blueprint_grid_intensity: Option<String>,
    editor_markdown_view_edit_enabled: Option<bool>,
    editor_markdown_preview_default_mode: Option<String>,
    exam_editor_show_move_buttons: Option<bool>,
    language: Option<String>,
    max_files_per_scan: Option<String>,
    scan_parallelism: Option<String>,
    show_hidden_folders: Option<bool>,
    show_empty_folders: Option<bool>,
    hidden_folders_level: Option<u32>,
    hidden_folders_level_vault: Option<u32>,
    hidden_folders_level_index: Option<u32>,
    flashcard_order: Option<String>,
    flashcard_mode: Option<String>,
    flashcard_scope: Option<String>,
    flashcard_page_size: Option<u32>,
    flashcard_solution_reveal_enabled: Option<bool>,
    flashcard_stats_reset_mode: Option<String>,
    flashcard_help_enabled: Option<bool>,
    fast_flashcard_order: Option<String>,
    fast_flashcard_mode: Option<String>,
    fast_flashcard_scope: Option<String>,
    fast_flashcard_duration: Option<u32>,
    fast_flashcard_help_enabled: Option<bool>,
    spaced_repetition_boxes: Option<u32>,
    spaced_repetition_order: Option<String>,
    spaced_repetition_page_size: Option<u32>,
    spaced_repetition_repetition_strength: Option<String>,
    spaced_repetition_stats_view: Option<String>,
    spaced_repetition_help_enabled: Option<bool>,
    right_toolbar_collapsed: Option<bool>,
    exam_max_total_points: Option<u32>,
    exam_task_count: Option<u32>,
    exam_task_points: Option<Vec<u32>>,
    exam_ai_evaluation: Option<ExamAiEvaluation>,
    exam_auto_cards_enabled: Option<bool>,
    exam_auto_cards_types: Option<HashMap<String, bool>>,
    exam_auto_cards_return_on_correct: Option<bool>,
    exam_grade_scale: Option<String>,
    exam_help_enabled: Option<bool>,
    keyboard_shortcuts: Option<KeyboardShortcutSettings>,
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

#[derive(serde::Deserialize, serde::Serialize, Default, Clone)]
#[serde(rename_all = "camelCase", default)]
struct ExamRun {
    id: String,
    started_at: String,
    ended_at: String,
    duration_ms: u64,
    user_id: Option<String>,
    user_name: String,
    exam_file_path: String,
    tasks_detected: u32,
    max_points: u32,
    achieved_points: u32,
    percent: u32,
    passed: bool,
    grade: Option<String>,
    grade_scale_id: Option<String>,
}

#[derive(serde::Deserialize, serde::Serialize, Default, Clone)]
#[serde(rename_all = "camelCase", default)]
struct ExamRunStorage {
    runs: Vec<ExamRun>,
}

impl AppSettings {
    fn is_empty(&self) -> bool {
        self.vault_path.is_none()
            && self.recent_vaults.is_none()
            && self.user_vault_mode.is_none()
            && self.user_vault_custom_path.is_none()
            && self.user_vault_last_path.is_none()
            && self.user_vault_selected_auto_path.is_none()
            && self.user_vault_selected_custom_path.is_none()
            && self.active_note_path.is_none()
            && self.theme.is_none()
            && self.accent_color.is_none()
            && self.markdown_editor.is_none()
            && self.editor_exact_colors.is_none()
            && self.editor_markdown_exact_colors_enabled.is_none()
            && self.editor_markdown_custom_accent_hex.is_none()
            && self.editor_blueprint_grid.is_none()
            && self.editor_blueprint_grid_intensity.is_none()
            && self.exam_editor_show_move_buttons.is_none()
            && self.language.is_none()
            && self.max_files_per_scan.is_none()
            && self.scan_parallelism.is_none()
            && self.show_hidden_folders.is_none()
            && self.show_empty_folders.is_none()
            && self.hidden_folders_level.is_none()
            && self.hidden_folders_level_vault.is_none()
            && self.hidden_folders_level_index.is_none()
            && self.flashcard_order.is_none()
            && self.flashcard_mode.is_none()
            && self.flashcard_scope.is_none()
            && self.flashcard_page_size.is_none()
            && self.flashcard_solution_reveal_enabled.is_none()
            && self.flashcard_stats_reset_mode.is_none()
            && self.flashcard_help_enabled.is_none()
            && self.fast_flashcard_order.is_none()
            && self.fast_flashcard_mode.is_none()
            && self.fast_flashcard_scope.is_none()
            && self.fast_flashcard_duration.is_none()
            && self.fast_flashcard_help_enabled.is_none()
            && self.spaced_repetition_boxes.is_none()
            && self.spaced_repetition_order.is_none()
            && self.spaced_repetition_page_size.is_none()
            && self.spaced_repetition_repetition_strength.is_none()
            && self.spaced_repetition_stats_view.is_none()
            && self.spaced_repetition_help_enabled.is_none()
            && self.right_toolbar_collapsed.is_none()
            && self.exam_max_total_points.is_none()
            && self.exam_task_count.is_none()
            && self.exam_task_points.is_none()
            && self.exam_ai_evaluation.is_none()
            && self.exam_auto_cards_enabled.is_none()
            && self.exam_auto_cards_types.is_none()
            && self.exam_auto_cards_return_on_correct.is_none()
            && self.exam_grade_scale.is_none()
            && self.exam_help_enabled.is_none()
            && self.keyboard_shortcuts.is_none()
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

fn is_json(path: &Path) -> bool {
    match path.extension().and_then(|ext| ext.to_str()) {
        Some(ext) => ext.eq_ignore_ascii_case("json"),
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

fn exam_runs_path(app: &tauri::AppHandle) -> Result<PathBuf, String> {
    app.path()
        .app_data_dir()
        .map_err(|err| err.to_string())
        .map(|dir| dir.join("exam_runs.json"))
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

fn read_exam_runs_data(path: &Path) -> Result<ExamRunStorage, String> {
    if !path.exists() {
        return Ok(ExamRunStorage::default());
    }

    let data = fs::read_to_string(path).map_err(|err| err.to_string())?;
    match serde_json::from_str(&data) {
        Ok(storage) => Ok(storage),
        Err(_) => Ok(ExamRunStorage::default()),
    }
}

fn write_exam_runs_data(path: &Path, storage: &ExamRunStorage) -> Result<(), String> {
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
    recent_vaults: Option<Vec<RecentVaultEntry>>,
    user_vault_mode: Option<String>,
    user_vault_custom_path: Option<String>,
    user_vault_last_path: Option<String>,
    user_vault_selected_auto_path: Option<String>,
    user_vault_selected_custom_path: Option<String>,
    theme: Option<String>,
    accent_color: Option<String>,
    markdown_editor: Option<MarkdownEditorSettings>,
    editor_exact_colors: Option<bool>,
    editor_markdown_exact_colors_enabled: Option<bool>,
    editor_markdown_custom_accent_hex: Option<String>,
    editor_blueprint_grid: Option<bool>,
    editor_blueprint_grid_intensity: Option<String>,
    editor_markdown_view_edit_enabled: Option<bool>,
    editor_markdown_preview_default_mode: Option<String>,
    exam_editor_show_move_buttons: Option<bool>,
    language: Option<String>,
    max_files_per_scan: Option<String>,
    scan_parallelism: Option<String>,
    show_hidden_folders: Option<bool>,
    show_empty_folders: Option<bool>,
    flashcard_order: Option<String>,
    flashcard_mode: Option<String>,
    flashcard_scope: Option<String>,
    flashcard_page_size: Option<u32>,
    flashcard_solution_reveal_enabled: Option<bool>,
    flashcard_stats_reset_mode: Option<String>,
    flashcard_help_enabled: Option<bool>,
    fast_flashcard_order: Option<String>,
    fast_flashcard_mode: Option<String>,
    fast_flashcard_scope: Option<String>,
    fast_flashcard_duration: Option<u32>,
    fast_flashcard_help_enabled: Option<bool>,
    spaced_repetition_boxes: Option<u32>,
    spaced_repetition_order: Option<String>,
    spaced_repetition_page_size: Option<u32>,
    spaced_repetition_repetition_strength: Option<String>,
    spaced_repetition_stats_view: Option<String>,
    spaced_repetition_help_enabled: Option<bool>,
    right_toolbar_collapsed: Option<bool>,
    exam_max_total_points: Option<u32>,
    exam_task_count: Option<u32>,
    exam_task_points: Option<Vec<u32>>,
    exam_ai_evaluation: Option<ExamAiEvaluation>,
    exam_auto_cards_enabled: Option<bool>,
    exam_auto_cards_types: Option<HashMap<String, bool>>,
    exam_auto_cards_return_on_correct: Option<bool>,
    exam_grade_scale: Option<String>,
    exam_help_enabled: Option<bool>,
    keyboard_shortcuts: Option<KeyboardShortcutSettings>,
) -> Result<(), String> {
    let path = settings_path(&app)?;
    let settings = AppSettings {
        active_note_path,
        vault_path,
        recent_vaults,
        user_vault_mode,
        user_vault_custom_path,
        user_vault_last_path,
        user_vault_selected_auto_path,
        user_vault_selected_custom_path,
        theme,
        accent_color,
        markdown_editor,
        editor_exact_colors,
        editor_markdown_exact_colors_enabled,
        editor_markdown_custom_accent_hex,
        editor_blueprint_grid,
        editor_blueprint_grid_intensity,
        editor_markdown_view_edit_enabled,
        editor_markdown_preview_default_mode,
        exam_editor_show_move_buttons,
        language,
        max_files_per_scan,
        scan_parallelism,
        show_hidden_folders,
        show_empty_folders,
        hidden_folders_level: None,
        hidden_folders_level_vault: None,
        hidden_folders_level_index: None,
        flashcard_order,
        flashcard_mode,
        flashcard_scope,
        flashcard_page_size,
        flashcard_solution_reveal_enabled,
        flashcard_stats_reset_mode,
        flashcard_help_enabled,
        fast_flashcard_order,
        fast_flashcard_mode,
        fast_flashcard_scope,
        fast_flashcard_duration,
        fast_flashcard_help_enabled,
        spaced_repetition_boxes,
        spaced_repetition_order,
        spaced_repetition_page_size,
        spaced_repetition_repetition_strength,
        spaced_repetition_stats_view,
        spaced_repetition_help_enabled,
        right_toolbar_collapsed,
        exam_max_total_points,
        exam_task_count,
        exam_task_points,
        exam_ai_evaluation,
        exam_auto_cards_enabled,
        exam_auto_cards_types,
        exam_auto_cards_return_on_correct,
        exam_grade_scale,
        exam_help_enabled,
        keyboard_shortcuts,
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
fn load_exam_run_data(app: tauri::AppHandle) -> Result<ExamRunStorage, String> {
    let path = exam_runs_path(&app)?;
    read_exam_runs_data(&path)
}

#[tauri::command]
fn save_exam_run_data(
    app: tauri::AppHandle,
    storage: ExamRunStorage,
) -> Result<(), String> {
    let path = exam_runs_path(&app)?;
    write_exam_runs_data(&path, &storage)
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
fn list_vault_entries(
    vault_path: String,
    show_hidden_folders: Option<bool>,
) -> Result<VaultScanResults, String> {
    let root = PathBuf::from(vault_path);
    if !root.exists() {
        return Err("Vault path does not exist.".to_string());
    }
    if !root.is_dir() {
        return Err("Vault path is not a directory.".to_string());
    }

    let mut files = Vec::new();
    let mut folders = Vec::new();
    let include_hidden = show_hidden_folders.unwrap_or(false);
    for entry in WalkDir::new(&root)
        .into_iter()
        .filter_entry(|entry| include_hidden || !is_hidden(entry))
    {
        let entry = match entry {
            Ok(entry) => entry,
            Err(_) => continue,
        };
        let path = entry.path();
        if entry.file_type().is_dir() {
            if entry.depth() == 0 {
                continue;
            }
            let relative = path.strip_prefix(&root).unwrap_or(path);
            let relative = relative.to_string_lossy().to_string();
            if !relative.is_empty() {
                folders.push(relative);
            }
            continue;
        }
        if entry.file_type().is_file() && is_markdown(path) {
            let relative = path.strip_prefix(&root).unwrap_or(path);
            files.push(VaultFile {
                path: path.to_string_lossy().to_string(),
                relative_path: relative.to_string_lossy().to_string(),
            });
        }
    }

    files.sort_by(|a, b| a.relative_path.cmp(&b.relative_path));
    folders.sort();
    Ok(VaultScanResults { files, folders })
}

#[tauri::command]
fn list_markdown_files(
    vault_path: String,
    show_hidden_folders: Option<bool>,
) -> Result<Vec<VaultFile>, String> {
    let root = PathBuf::from(vault_path);
    if !root.exists() {
        return Err("Vault path does not exist.".to_string());
    }
    if !root.is_dir() {
        return Err("Vault path is not a directory.".to_string());
    }

    let mut files = Vec::new();
    let include_hidden = show_hidden_folders.unwrap_or(false);
    for entry in WalkDir::new(&root)
        .into_iter()
        .filter_entry(|entry| include_hidden || !is_hidden(entry))
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
fn get_path_info(path: String) -> Result<PathInfo, String> {
    let path = PathBuf::from(path);
    if !path.exists() {
        return Ok(PathInfo {
            exists: false,
            is_dir: false,
        });
    }
    let metadata = fs::metadata(&path).map_err(|err| err.to_string())?;
    Ok(PathInfo {
        exists: true,
        is_dir: metadata.is_dir(),
    })
}

#[tauri::command]
fn list_directories(path: String) -> Result<Vec<String>, String> {
    let path = PathBuf::from(path);
    if !path.exists() {
        return Ok(Vec::new());
    }
    if !path.is_dir() {
        return Err("Path is not a directory.".to_string());
    }
    let mut entries = Vec::new();
    for entry in fs::read_dir(path).map_err(|err| err.to_string())? {
        let entry = entry.map_err(|err| err.to_string())?;
        let file_type = entry.file_type().map_err(|err| err.to_string())?;
        if file_type.is_dir() {
            entries.push(entry.file_name().to_string_lossy().to_string());
        }
    }
    entries.sort();
    Ok(entries)
}

#[tauri::command]
fn ensure_directory(path: String) -> Result<(), String> {
    let path = PathBuf::from(path);
    if path.exists() && !path.is_dir() {
        return Err("Path is not a directory.".to_string());
    }
    fs::create_dir_all(path).map_err(|err| err.to_string())
}

#[tauri::command]
fn read_json_file(path: String) -> Result<String, String> {
    let path = PathBuf::from(path);
    if !path.exists() {
        return Err("File not found.".to_string());
    }
    if !path.is_file() {
        return Err("Path is not a file.".to_string());
    }
    if !is_json(&path) {
        return Err("Only JSON files are supported.".to_string());
    }
    fs::read_to_string(path).map_err(|err| err.to_string())
}

#[tauri::command]
fn write_json_file(path: String, contents: String) -> Result<(), String> {
    let path = PathBuf::from(path);
    if !is_json(&path) {
        return Err("Only JSON files are supported.".to_string());
    }
    if let Some(parent) = path.parent() {
        fs::create_dir_all(parent).map_err(|err| err.to_string())?;
    }
    fs::write(path, contents).map_err(|err| err.to_string())
}

#[tauri::command]
fn rename_json_file(from: String, to: String) -> Result<(), String> {
    let from = PathBuf::from(from);
    let to = PathBuf::from(to);
    if !is_json(&from) || !is_json(&to) {
        return Err("Only JSON files are supported.".to_string());
    }
    if !from.exists() {
        return Err("Source file not found.".to_string());
    }
    if from.is_dir() {
        return Err("Source path is not a file.".to_string());
    }
    if let Some(parent) = to.parent() {
        fs::create_dir_all(parent).map_err(|err| err.to_string())?;
    }
    if to.exists() {
        if to.is_dir() {
            return Err("Target path is not a file.".to_string());
        }
        fs::remove_file(&to).map_err(|err| err.to_string())?;
    }
    fs::rename(&from, &to).map_err(|err| err.to_string())
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
    if !is_markdown(&path) {
        return Err("Only markdown files are supported.".to_string());
    }
    if path.exists() {
        if !path.is_file() {
            return Err("Path is not a file.".to_string());
        }
    } else if let Some(parent) = path.parent() {
        fs::create_dir_all(parent).map_err(|err| err.to_string())?;
    }
    fs::write(path, contents).map_err(|err| err.to_string())
}

#[tauri::command]
fn delete_markdown_file(
    vault_path: String,
    relative_path: String,
) -> Result<(), String> {
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
    if !full_path.exists() {
        return Err("File not found.".to_string());
    }
    if !full_path.is_file() {
        return Err("Path is not a file.".to_string());
    }
    if !is_markdown(&full_path) {
        return Err("Only markdown files are supported.".to_string());
    }
    fs::remove_file(&full_path).map_err(|err| err.to_string())
}

#[tauri::command]
fn move_markdown_file(
    vault_path: String,
    from_relative_path: String,
    to_relative_path: String,
) -> Result<VaultFile, String> {
    let root = PathBuf::from(&vault_path);
    if !root.exists() {
        return Err("Vault path does not exist.".to_string());
    }
    if !root.is_dir() {
        return Err("Vault path is not a directory.".to_string());
    }
    let from_relative = sanitize_relative_path(&from_relative_path)?;
    let to_relative = sanitize_relative_path(&to_relative_path)?;
    let from_full = root.join(&from_relative);
    let to_full = root.join(&to_relative);
    if !from_full.starts_with(&root) || !to_full.starts_with(&root) {
        return Err("Path is outside the vault.".to_string());
    }
    if from_full == to_full {
        return Err("Target path matches source.".to_string());
    }
    if !from_full.exists() {
        return Err("File not found.".to_string());
    }
    if !from_full.is_file() {
        return Err("Path is not a file.".to_string());
    }
    if !is_markdown(&from_full) || !is_markdown(&to_full) {
        return Err("Only markdown files are supported.".to_string());
    }
    if to_full.exists() {
        return Err("File already exists.".to_string());
    }
    if let Some(parent) = to_full.parent() {
        if !parent.exists() {
            return Err("Target folder does not exist.".to_string());
        }
        if !parent.is_dir() {
            return Err("Target folder is not a directory.".to_string());
        }
    }
    fs::rename(&from_full, &to_full).map_err(|err| err.to_string())?;
    Ok(VaultFile {
        path: to_full.to_string_lossy().to_string(),
        relative_path: format_relative_path(&to_relative),
    })
}

#[tauri::command]
fn move_directory(
    vault_path: String,
    from_relative_path: String,
    to_relative_path: String,
) -> Result<(), String> {
    let root = PathBuf::from(&vault_path);
    if !root.exists() {
        return Err("Vault path does not exist.".to_string());
    }
    if !root.is_dir() {
        return Err("Vault path is not a directory.".to_string());
    }
    let from_relative = sanitize_relative_path(&from_relative_path)?;
    let to_relative = sanitize_relative_path(&to_relative_path)?;
    let from_full = root.join(&from_relative);
    let to_full = root.join(&to_relative);
    if !from_full.starts_with(&root) || !to_full.starts_with(&root) {
        return Err("Path is outside the vault.".to_string());
    }
    if from_full == to_full {
        return Err("Target path matches source.".to_string());
    }
    if !from_full.exists() {
        return Err("Folder not found.".to_string());
    }
    if !from_full.is_dir() {
        return Err("Path is not a directory.".to_string());
    }
    if to_full.starts_with(&from_full) {
        return Err("Cannot move a folder into itself.".to_string());
    }
    if to_full.exists() {
        return Err("Folder already exists.".to_string());
    }
    if let Some(parent) = to_full.parent() {
        if !parent.exists() {
            return Err("Target folder does not exist.".to_string());
        }
        if !parent.is_dir() {
            return Err("Target folder is not a directory.".to_string());
        }
    }
    fs::rename(&from_full, &to_full).map_err(|err| err.to_string())
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

#[tauri::command]
fn delete_directory(vault_path: String, relative_path: String) -> Result<(), String> {
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
    if !full_path.exists() {
        return Err("Folder not found.".to_string());
    }
    if !full_path.is_dir() {
        return Err("Path is not a directory.".to_string());
    }
    fs::remove_dir_all(&full_path).map_err(|err| err.to_string())
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
            load_exam_run_data,
            save_exam_run_data,
            load_vault_path,
            save_vault_path,
            list_markdown_files,
            list_vault_entries,
            get_path_info,
            list_directories,
            ensure_directory,
            read_json_file,
            write_json_file,
            rename_json_file,
            read_text_file,
            write_text_file,
            delete_markdown_file,
            move_markdown_file,
            move_directory,
            create_markdown_file,
            create_directory,
            delete_directory
        ])
        .run(tauri::generate_context!())
        .expect("error while running tauri application");
}

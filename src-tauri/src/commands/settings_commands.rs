use crate::config::{self, AppSettings};
use crate::AppError;
use tauri::{AppHandle, Manager};

fn settings_file(app: &AppHandle) -> Result<std::path::PathBuf, AppError> {
    let app_dir = app.path().app_data_dir().map_err(|error| AppError::Config {
        message: format!("Failed to get app data directory: {}", error),
    })?;
    Ok(config::settings::settings_path(&app_dir))
}

#[tauri::command]
pub fn load_app_settings(app: AppHandle) -> Result<AppSettings, AppError> {
    config::settings::load_from_file(&settings_file(&app)?)
}

#[tauri::command]
pub fn save_app_settings(app: AppHandle, settings: AppSettings) -> Result<AppSettings, AppError> {
    config::settings::save_to_file(&settings_file(&app)?, &settings)?;
    Ok(settings)
}

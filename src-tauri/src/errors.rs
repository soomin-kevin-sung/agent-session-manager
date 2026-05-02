use serde::Serialize;
use thiserror::Error;

#[derive(Error, Debug)]
pub enum AppError {
    #[error("Database error: {0}")]
    Database(#[from] sqlx::Error),

    #[error("Not found: {entity} with id {id}")]
    NotFound { entity: String, id: String },

    #[error("Validation error: {message}")]
    Validation { message: String },

    #[error("Permission denied: {message}")]
    Permission { message: String },

    #[error("Config error: {message}")]
    Config { message: String },

    #[error("Serialization error: {0}")]
    Serialization(#[from] serde_json::Error),

    #[error("Internal error: {message}")]
    Internal { message: String },
}

#[derive(Serialize, Debug, Clone)]
pub struct IpcError {
    pub code: String,
    pub message_key: String,
    pub fallback_message: String,
    pub details: Option<serde_json::Value>,
    pub recoverable: bool,
}

impl From<AppError> for IpcError {
    fn from(err: AppError) -> Self {
        match &err {
            AppError::Database(_) => IpcError {
                code: "DATABASE_ERROR".into(),
                message_key: "errors.database.general".into(),
                fallback_message: err.to_string(),
                details: None,
                recoverable: true,
            },
            AppError::NotFound { entity, id } => IpcError {
                code: "NOT_FOUND".into(),
                message_key: format!("errors.notFound.{}", entity),
                fallback_message: err.to_string(),
                details: Some(serde_json::json!({ "entity": entity, "id": id })),
                recoverable: false,
            },
            AppError::Validation { message } => IpcError {
                code: "VALIDATION_ERROR".into(),
                message_key: "errors.validation".into(),
                fallback_message: err.to_string(),
                details: Some(serde_json::json!({ "message": message })),
                recoverable: false,
            },
            AppError::Permission { message } => IpcError {
                code: "PERMISSION_DENIED".into(),
                message_key: "errors.permission.denied".into(),
                fallback_message: err.to_string(),
                details: Some(serde_json::json!({ "message": message })),
                recoverable: false,
            },
            AppError::Config { message } => IpcError {
                code: "CONFIG_ERROR".into(),
                message_key: "errors.config".into(),
                fallback_message: err.to_string(),
                details: Some(serde_json::json!({ "message": message })),
                recoverable: false,
            },
            AppError::Serialization(_) => IpcError {
                code: "SERIALIZATION_ERROR".into(),
                message_key: "errors.serialization".into(),
                fallback_message: err.to_string(),
                details: None,
                recoverable: false,
            },
            AppError::Internal { .. } => IpcError {
                code: "INTERNAL_ERROR".into(),
                message_key: "errors.internal".into(),
                fallback_message: "An internal error occurred".into(),
                details: None,
                recoverable: false,
            },
        }
    }
}

// Implement Serialize for AppError so it can be returned from Tauri commands
impl Serialize for AppError {
    fn serialize<S>(&self, serializer: S) -> Result<S::Ok, S::Error>
    where
        S: serde::Serializer,
    {
        let ipc_error = IpcError::from_ref(self);
        ipc_error.serialize(serializer)
    }
}

impl IpcError {
    fn from_ref(err: &AppError) -> Self {
        match err {
            AppError::Database(e) => IpcError {
                code: "DATABASE_ERROR".into(),
                message_key: "errors.database.general".into(),
                fallback_message: e.to_string(),
                details: None,
                recoverable: true,
            },
            AppError::NotFound { entity, id } => IpcError {
                code: "NOT_FOUND".into(),
                message_key: format!("errors.notFound.{}", entity),
                fallback_message: format!("Not found: {} with id {}", entity, id),
                details: Some(serde_json::json!({ "entity": entity, "id": id })),
                recoverable: false,
            },
            AppError::Validation { message } => IpcError {
                code: "VALIDATION_ERROR".into(),
                message_key: "errors.validation".into(),
                fallback_message: format!("Validation error: {}", message),
                details: Some(serde_json::json!({ "message": message })),
                recoverable: false,
            },
            AppError::Permission { message } => IpcError {
                code: "PERMISSION_DENIED".into(),
                message_key: "errors.permission.denied".into(),
                fallback_message: format!("Permission denied: {}", message),
                details: Some(serde_json::json!({ "message": message })),
                recoverable: false,
            },
            AppError::Config { message } => IpcError {
                code: "CONFIG_ERROR".into(),
                message_key: "errors.config".into(),
                fallback_message: format!("Config error: {}", message),
                details: Some(serde_json::json!({ "message": message })),
                recoverable: false,
            },
            AppError::Serialization(e) => IpcError {
                code: "SERIALIZATION_ERROR".into(),
                message_key: "errors.serialization".into(),
                fallback_message: e.to_string(),
                details: None,
                recoverable: false,
            },
            AppError::Internal { .. } => IpcError {
                code: "INTERNAL_ERROR".into(),
                message_key: "errors.internal".into(),
                fallback_message: "An internal error occurred".into(),
                details: None,
                recoverable: false,
            },
        }
    }
}

pub type AppResult<T> = Result<T, AppError>;

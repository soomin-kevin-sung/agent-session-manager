use crate::config::AppSettings;
use crate::db::DbPool;
use crate::process::ProcessManager;
use crate::runtime::registry::RuntimeRegistry;

pub struct AppState {
    pub db: DbPool,
    pub settings: AppSettings,
    pub process_manager: ProcessManager,
    pub runtime_registry: RuntimeRegistry,
}

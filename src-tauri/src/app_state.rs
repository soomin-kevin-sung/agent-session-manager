use crate::config::AppSettings;
use crate::db::DbPool;

pub struct AppState {
    pub db: DbPool,
    pub settings: AppSettings,
}

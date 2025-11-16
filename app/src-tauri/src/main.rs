// Prevents additional console window on Windows in release, DO NOT REMOVE!!
#![cfg_attr(not(debug_assertions), windows_subsystem = "windows")]

mod db;
mod timer;

use serde::{Deserialize, Serialize};
use tauri::State;
use tauri::{Emitter, Manager};
use timer::{StoppedSession, TimerState};
use uuid::Uuid;

#[derive(Debug, Serialize, Deserialize)]
struct BookListItem {
    id: String,
    title: String,
    priority: i32,
    status: String,
}

#[derive(Debug, Serialize, Deserialize)]
struct SessionPayload {
    id: Option<String>,
    book_id: String,
    start_at: String,
    end_at: Option<String>,
}

// Note: The SQL operations will be done via frontend using tauri-plugin-sql
// These commands are just stubs that generate IDs - actual DB ops happen in JS

#[tauri::command]
fn create_book(
    _title: String,
    _authors: Vec<String>,
) -> Result<String, String> {
    let id = Uuid::new_v4().to_string();
    Ok(id)
}

#[tauri::command]
fn list_books() -> Result<Vec<BookListItem>, String> {
    // This will be implemented by calling SQL from frontend
    // Returning empty for now to allow compilation
    Ok(vec![])
}

#[tauri::command]
fn upsert_session(
    _payload: SessionPayload,
) -> Result<String, String> {
    let id = _payload.id.unwrap_or_else(|| Uuid::new_v4().to_string());
    Ok(id)
}

#[tauri::command]
fn timer_start(
    state: State<TimerState>,
    book_id: String,
    start_at_iso: String,
) -> Result<String, String> {
    state.start(book_id, start_at_iso)
}

#[tauri::command]
fn timer_stop(state: State<TimerState>, end_at_iso: String) -> Result<StoppedSession, String> {
    state.stop(end_at_iso)
}

#[tauri::command]
fn get_database_name() -> String {
    if cfg!(debug_assertions) {
        "sqlite:reading_tracker_dev.db".to_string()
    } else {
        "sqlite:reading_tracker.db".to_string()
    }
}

fn main() {
    tauri::Builder::default()
        .plugin(tauri_plugin_store::Builder::default().build())
        .setup(|app| {
            // Initialize database with migrations
            let app_handle = app.handle().clone();
            tauri::async_runtime::spawn(async move {
                db::init_db(&app_handle).await.expect("Failed to initialize database");
            });

            // Initialize timer state
            let timer_state = TimerState::new();
            let timer_state_for_tick = timer_state.clone_state();
            app.manage(timer_state);

            // Timer tick background task
            let app_handle_clone = app.handle().clone();
            tauri::async_runtime::spawn(async move {
                loop {
                    tokio::time::sleep(tokio::time::Duration::from_secs(1)).await;
                    
                    if let Some(elapsed) = timer_state_for_tick.get_elapsed_seconds() {
                        let _ = app_handle_clone.emit("timer://tick", elapsed);
                    }
                }
            });

            Ok(())
        })
        .invoke_handler(tauri::generate_handler![
            create_book,
            list_books,
            upsert_session,
            timer_start,
            timer_stop,
            get_database_name
        ])
        .run(tauri::generate_context!())
        .expect("error while running tauri application");
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn test_create_book_returns_valid_uuid() {
        let result = create_book("Test Book".to_string(), vec!["Author 1".to_string()]);
        assert!(result.is_ok());
        
        let id = result.unwrap();
        assert!(!id.is_empty());
        // Verify it's a valid UUID format
        assert!(Uuid::parse_str(&id).is_ok());
    }

    #[test]
    fn test_list_books_returns_empty_initially() {
        let result = list_books();
        assert!(result.is_ok());
        assert_eq!(result.unwrap().len(), 0);
    }

    #[test]
    fn test_upsert_session_with_id() {
        let payload = SessionPayload {
            id: Some("test-session-123".to_string()),
            book_id: "book-456".to_string(),
            start_at: "2025-11-08T10:00:00Z".to_string(),
            end_at: None,
        };

        let result = upsert_session(payload);
        assert!(result.is_ok());
        assert_eq!(result.unwrap(), "test-session-123");
    }

    #[test]
    fn test_upsert_session_generates_id_when_none() {
        let payload = SessionPayload {
            id: None,
            book_id: "book-789".to_string(),
            start_at: "2025-11-08T10:00:00Z".to_string(),
            end_at: Some("2025-11-08T11:00:00Z".to_string()),
        };

        let result = upsert_session(payload);
        assert!(result.is_ok());
        
        let id = result.unwrap();
        assert!(!id.is_empty());
        assert!(Uuid::parse_str(&id).is_ok());
    }

    #[test]
    fn test_session_payload_serialization() {
        let payload = SessionPayload {
            id: Some("session-1".to_string()),
            book_id: "book-1".to_string(),
            start_at: "2025-11-08T10:00:00Z".to_string(),
            end_at: Some("2025-11-08T11:00:00Z".to_string()),
        };

        let json = serde_json::to_string(&payload).unwrap();
        let deserialized: SessionPayload = serde_json::from_str(&json).unwrap();

        assert_eq!(deserialized.id, payload.id);
        assert_eq!(deserialized.book_id, payload.book_id);
        assert_eq!(deserialized.start_at, payload.start_at);
        assert_eq!(deserialized.end_at, payload.end_at);
    }

    #[test]
    fn test_book_list_item_serialization() {
        let item = BookListItem {
            id: "book-1".to_string(),
            title: "Test Book".to_string(),
            priority: 5,
            status: "active".to_string(),
        };

        let json = serde_json::to_string(&item).unwrap();
        let deserialized: BookListItem = serde_json::from_str(&json).unwrap();

        assert_eq!(deserialized.id, item.id);
        assert_eq!(deserialized.title, item.title);
        assert_eq!(deserialized.priority, item.priority);
        assert_eq!(deserialized.status, item.status);
    }
}

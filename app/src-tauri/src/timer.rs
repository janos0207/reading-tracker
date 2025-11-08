use serde::{Deserialize, Serialize};
use std::sync::Mutex;
use uuid::Uuid;

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct TimerSession {
    pub session_id: String,
    pub book_id: String,
    pub start_at: String,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct StoppedSession {
    pub session_id: String,
    pub book_id: String,
    pub start_at: String,
    pub end_at: String,
}

pub struct TimerState {
    pub current_session: Mutex<Option<TimerSession>>,
}

impl TimerState {
    pub fn new() -> Self {
        TimerState {
            current_session: Mutex::new(None),
        }
    }

    pub fn start(&self, book_id: String, start_at_iso: String) -> Result<String, String> {
        let mut session = self.current_session.lock().unwrap();
        
        if session.is_some() {
            return Err("A timer session is already running".to_string());
        }

        let session_id = Uuid::new_v4().to_string();
        
        *session = Some(TimerSession {
            session_id: session_id.clone(),
            book_id,
            start_at: start_at_iso,
        });

        Ok(session_id)
    }

    pub fn stop(&self, end_at_iso: String) -> Result<StoppedSession, String> {
        let mut session = self.current_session.lock().unwrap();
        
        match session.take() {
            Some(timer_session) => {
                Ok(StoppedSession {
                    session_id: timer_session.session_id,
                    book_id: timer_session.book_id,
                    start_at: timer_session.start_at,
                    end_at: end_at_iso,
                })
            }
            None => Err("No timer session is currently running".to_string()),
        }
    }
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn test_timer_start() {
        let timer_state = TimerState::new();
        let book_id = "test-book-123".to_string();
        let start_at = "2025-11-08T10:00:00Z".to_string();

        let result = timer_state.start(book_id.clone(), start_at.clone());
        assert!(result.is_ok());

        let session_id = result.unwrap();
        assert!(!session_id.is_empty());

        // Verify session is stored
        let session = timer_state.current_session.lock().unwrap();
        assert!(session.is_some());
        if let Some(s) = session.as_ref() {
            assert_eq!(s.book_id, book_id);
            assert_eq!(s.start_at, start_at);
        }
    }

    #[test]
    fn test_timer_start_fails_when_already_running() {
        let timer_state = TimerState::new();
        
        // Start first session
        timer_state.start("book1".to_string(), "2025-11-08T10:00:00Z".to_string()).unwrap();
        
        // Try to start second session
        let result = timer_state.start("book2".to_string(), "2025-11-08T11:00:00Z".to_string());
        assert!(result.is_err());
        assert_eq!(result.unwrap_err(), "A timer session is already running");
    }

    #[test]
    fn test_timer_stop() {
        let timer_state = TimerState::new();
        let book_id = "test-book-456".to_string();
        let start_at = "2025-11-08T10:00:00Z".to_string();
        let end_at = "2025-11-08T11:30:00Z".to_string();

        // Start session
        let session_id = timer_state.start(book_id.clone(), start_at.clone()).unwrap();

        // Stop session
        let result = timer_state.stop(end_at.clone());
        assert!(result.is_ok());

        let stopped = result.unwrap();
        assert_eq!(stopped.session_id, session_id);
        assert_eq!(stopped.book_id, book_id);
        assert_eq!(stopped.start_at, start_at);
        assert_eq!(stopped.end_at, end_at);

        // Verify session is cleared
        let session = timer_state.current_session.lock().unwrap();
        assert!(session.is_none());
    }

    #[test]
    fn test_timer_stop_fails_when_not_running() {
        let timer_state = TimerState::new();
        
        let result = timer_state.stop("2025-11-08T11:00:00Z".to_string());
        assert!(result.is_err());
        assert_eq!(result.unwrap_err(), "No timer session is currently running");
    }

    #[test]
    fn test_timer_session_serialization() {
        let session = TimerSession {
            session_id: "test-id".to_string(),
            book_id: "book-id".to_string(),
            start_at: "2025-11-08T10:00:00Z".to_string(),
        };

        let json = serde_json::to_string(&session).unwrap();
        let deserialized: TimerSession = serde_json::from_str(&json).unwrap();

        assert_eq!(deserialized.session_id, session.session_id);
        assert_eq!(deserialized.book_id, session.book_id);
        assert_eq!(deserialized.start_at, session.start_at);
    }

    #[test]
    fn test_stopped_session_serialization() {
        let stopped = StoppedSession {
            session_id: "test-id".to_string(),
            book_id: "book-id".to_string(),
            start_at: "2025-11-08T10:00:00Z".to_string(),
            end_at: "2025-11-08T11:30:00Z".to_string(),
        };

        let json = serde_json::to_string(&stopped).unwrap();
        let deserialized: StoppedSession = serde_json::from_str(&json).unwrap();

        assert_eq!(deserialized.session_id, stopped.session_id);
        assert_eq!(deserialized.book_id, stopped.book_id);
        assert_eq!(deserialized.start_at, stopped.start_at);
        assert_eq!(deserialized.end_at, stopped.end_at);
    }
}

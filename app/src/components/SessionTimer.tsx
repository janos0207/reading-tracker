import { useEffect, useState, useCallback } from "react";
import { askConfirm } from "../lib/dialog";
import {
  timerStart,
  timerStop,
  upsertSession,
  onTimerTick,
  getActiveSession,
  stopActiveSession,
} from "../lib/api";

interface SessionTimerProps {
  bookId: string;
  activeBookId: string | null;
  onSessionChange: () => void;
}

export function SessionTimer({
  bookId,
  activeBookId,
  onSessionChange,
}: SessionTimerProps) {
  const [isRunning, setIsRunning] = useState(false);
  const [elapsedSeconds, setElapsedSeconds] = useState(0);
  const [error, setError] = useState<string | null>(null);

  // Update isRunning based on activeBookId
  useEffect(() => {
    setIsRunning(activeBookId === bookId);
  }, [activeBookId, bookId]);

  // Format seconds as mm:ss
  const formatTime = (seconds: number): string => {
    const mins = Math.floor(seconds / 60);
    const secs = seconds % 60;
    return `${mins.toString().padStart(2, "0")}:${secs
      .toString()
      .padStart(2, "0")}`;
  };

  // Set up timer tick listener
  useEffect(() => {
    let unlisten: (() => void) | undefined;

    const setupListener = async () => {
      unlisten = await onTimerTick((elapsed) => {
        if (activeBookId === bookId) {
          setElapsedSeconds(elapsed);
        }
      });
    };

    setupListener();

    return () => {
      if (unlisten) {
        unlisten();
      }
    };
  }, [activeBookId, bookId]);

  const handleStart = useCallback(async () => {
    try {
      setError(null);

      // Check for existing active session
      const activeSession = await getActiveSession();

      if (activeSession) {
        // Ask user to confirm switching
        const bookIdMatch = activeSession.book_id === bookId;
        if (bookIdMatch) {
          // Same book, just start (edge case - shouldn't happen in normal flow)
          console.warn("Starting session for already active book");
        } else {
          const confirmed = await askConfirm(
            "There is an ongoing reading session. Stop it and start reading this book instead?"
          );

          if (!confirmed) {
            // User cancelled
            return;
          }

          // Stop the existing session
          const now = new Date().toISOString();
          await stopActiveSession(now);
          await timerStop(now);
        }
      }

      // Start new session
      const now = new Date().toISOString();
      const newSessionId = await timerStart(bookId, now);

      // Create initial session record (start-only)
      await upsertSession({
        id: newSessionId,
        book_id: bookId,
        start_at: now,
      });

      setElapsedSeconds(0);
      onSessionChange(); // Notify parent to refresh active session
    } catch (err) {
      setError(err instanceof Error ? err.message : String(err));
      console.error("Failed to start timer:", err);
    }
  }, [bookId, onSessionChange]);

  const handleStop = useCallback(async () => {
    try {
      setError(null);
      const now = new Date().toISOString();

      // Stop the timer in Rust
      const stoppedSession = await timerStop(now);

      // Update session with end time in database
      await upsertSession({
        id: stoppedSession.session_id,
        book_id: stoppedSession.book_id,
        start_at: stoppedSession.start_at,
        end_at: stoppedSession.end_at,
      });

      setElapsedSeconds(0);
      onSessionChange(); // Notify parent to refresh active session
    } catch (err) {
      setError(err instanceof Error ? err.message : String(err));
      console.error("Failed to stop timer:", err);
    }
  }, [onSessionChange]);

  return (
    <div className="session-timer">
      <div className="timer-display">{formatTime(elapsedSeconds)}</div>
      <div className="timer-controls">
        {!isRunning ? (
          <button onClick={handleStart} className="btn btn-start">
            Start
          </button>
        ) : (
          <button onClick={handleStop} className="btn btn-stop">
            Stop
          </button>
        )}
      </div>
      {error && <div className="error">{error}</div>}
    </div>
  );
}

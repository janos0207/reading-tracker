import { useEffect, useState, useCallback } from "react";
import { timerStart, timerStop, upsertSession, onTimerTick } from "../lib/api";

interface SessionTimerProps {
  bookId: string;
}

export function SessionTimer({ bookId }: SessionTimerProps) {
  const [isRunning, setIsRunning] = useState(false);
  const [elapsedSeconds, setElapsedSeconds] = useState(0);
  const [error, setError] = useState<string | null>(null);

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
        setElapsedSeconds(elapsed);
      });
    };

    setupListener();

    return () => {
      if (unlisten) {
        unlisten();
      }
    };
  }, []);

  const handleStart = useCallback(async () => {
    try {
      setError(null);
      const now = new Date().toISOString();

      // Start the timer in Rust
      const newSessionId = await timerStart(bookId, now);

      // Create initial session record (start-only)
      await upsertSession({
        id: newSessionId,
        book_id: bookId,
        start_at: now,
      });

      setIsRunning(true);
      setElapsedSeconds(0);
    } catch (err) {
      setError(err instanceof Error ? err.message : String(err));
      console.error("Failed to start timer:", err);
    }
  }, [bookId]);

  const handleStop = useCallback(async () => {
    try {
      setError(null);
      const now = new Date().toISOString();

      // Stop the timer in Rust
      const stoppedSession = await timerStop(now);

      // Update session with end time
      await upsertSession({
        id: stoppedSession.session_id,
        book_id: stoppedSession.book_id,
        start_at: stoppedSession.start_at,
        end_at: stoppedSession.end_at,
      });

      setIsRunning(false);
      setElapsedSeconds(0);
    } catch (err) {
      setError(err instanceof Error ? err.message : String(err));
      console.error("Failed to stop timer:", err);
    }
  }, []);

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

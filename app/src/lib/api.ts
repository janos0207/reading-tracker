import { invoke } from "@tauri-apps/api/core";
import { listen } from "@tauri-apps/api/event";
import Database from "@tauri-apps/plugin-sql";

let db: Database | null = null;

async function getDb(): Promise<Database> {
  if (!db) {
    // Get database name from backend to ensure consistency
    const dbName = await invoke<string>("get_database_name");
    db = await Database.load(dbName);
  }
  return db;
}

export interface Book {
  id: string;
  title: string;
  authors?: string;
  priority: number;
  status: string;
  created_at?: string;
  updated_at?: string;
}

export interface SessionPayload {
  id?: string;
  book_id: string;
  start_at: string;
  end_at?: string;
}

export interface Session {
  id: string;
  book_id: string;
  start_at: string;
  end_at: string | null;
  created_at: string;
  updated_at: string;
}

export interface StoppedSession {
  session_id: string;
  book_id: string;
  start_at: string;
  end_at: string;
}

/**
 * Create a new book
 */
export async function createBook(
  title: string,
  authors: string[]
): Promise<string> {
  const id = await invoke<string>("create_book", { title, authors });
  const database = await getDb();
  const now = new Date().toISOString();
  const authorsStr = authors.join(", "); // Comma-separated string

  await database.execute(
    "INSERT INTO books (id, title, authors, priority, status, created_at, updated_at) VALUES (?, ?, ?, ?, ?, ?, ?)",
    [id, title, authorsStr, 0, "active", now, now]
  );

  return id;
}

/**
 * List all books, ordered by priority (smaller = higher priority)
 */
export async function listBooks(): Promise<Book[]> {
  const database = await getDb();
  const results = await database.select<Book[]>(
    "SELECT id, title, authors, priority, status, created_at, updated_at FROM books ORDER BY priority ASC, created_at DESC"
  );
  return results;
}

/**
 * Upsert a session (create or update)
 */
export async function upsertSession(payload: SessionPayload): Promise<string> {
  const id = await invoke<string>("upsert_session", { payload });
  const database = await getDb();
  const now = new Date().toISOString();

  // Check if session exists
  const existing = await database.select<{ id: string }[]>(
    "SELECT id FROM sessions WHERE id = ?",
    [id]
  );

  if (existing.length > 0) {
    // Update existing session
    await database.execute(
      "UPDATE sessions SET end_at = ?, updated_at = ? WHERE id = ?",
      [payload.end_at || null, now, id]
    );
  } else {
    // Insert new session
    await database.execute(
      "INSERT INTO sessions (id, book_id, start_at, end_at, created_at, updated_at) VALUES (?, ?, ?, ?, ?, ?)",
      [id, payload.book_id, payload.start_at, payload.end_at || null, now, now]
    );
  }

  return id;
}

/**
 * Start a timer session
 */
export async function timerStart(
  bookId: string,
  startAtIso: string
): Promise<string> {
  return await invoke<string>("timer_start", { bookId, startAtIso });
}

/**
 * Stop the current timer session
 */
export async function timerStop(endAtIso: string): Promise<StoppedSession> {
  return await invoke<StoppedSession>("timer_stop", { endAtIso });
}

/**
 * Listen to timer tick events
 */
export async function onTimerTick(callback: (elapsedSeconds: number) => void) {
  return await listen<number>("timer://tick", (event) => {
    callback(event.payload);
  });
}

/**
 * Get the current active session (if any)
 * Returns the session with end_at = null, or null if none exists
 */
export async function getActiveSession(): Promise<Session | null> {
  const database = await getDb();
  const results = await database.select<Session[]>(
    "SELECT id, book_id, start_at, end_at, created_at, updated_at FROM sessions WHERE end_at IS NULL LIMIT 1"
  );
  return results.length > 0 ? results[0] : null;
}

/**
 * Stop the active session by setting its end_at timestamp
 */
export async function stopActiveSession(endAt: string): Promise<void> {
  const database = await getDb();
  const now = new Date().toISOString();
  await database.execute(
    "UPDATE sessions SET end_at = ?, updated_at = ? WHERE end_at IS NULL",
    [endAt, now]
  );
}

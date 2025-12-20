import { useState, useEffect } from "react";
import {
  createBook,
  listBooks,
  Book,
  getActiveSession,
  timerStart,
} from "./lib/api";
import { SessionTimer } from "./components/SessionTimer";
import "./App.css";

function App() {
  const [books, setBooks] = useState<Book[]>([]);
  const [newBookTitle, setNewBookTitle] = useState("");
  const [newBookAuthors, setNewBookAuthors] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);
  const [activeBookId, setActiveBookId] = useState<string | null>(null);

  // Load books and restore active session on mount
  useEffect(() => {
    loadBooks();
    restoreActiveSession();
  }, []);

  const loadBooks = async () => {
    try {
      setError(null);
      const bookList = await listBooks();
      setBooks(bookList);
    } catch (err) {
      setError(err instanceof Error ? err.message : String(err));
      console.error("Failed to load books:", err);
    }
  };

  const restoreActiveSession = async () => {
    try {
      const activeSession = await getActiveSession();
      if (activeSession) {
        // Found an active session, restore it
        setActiveBookId(activeSession.book_id);

        // Reconstruct the timer in Rust state
        // The timer needs to know when the session started to calculate elapsed time
        await timerStart(activeSession.book_id, activeSession.start_at);
      }
    } catch (err) {
      console.error("Failed to restore active session:", err);
      // Non-critical error, don't show to user
    }
  };

  const handleSessionChange = async () => {
    // Refresh active session when timer starts or stops
    try {
      const activeSession = await getActiveSession();
      setActiveBookId(activeSession ? activeSession.book_id : null);
    } catch (err) {
      console.error("Failed to refresh active session:", err);
    }
  };

  const handleAddBook = async (e: React.FormEvent) => {
    e.preventDefault();

    if (!newBookTitle.trim()) {
      setError("Book title is required");
      return;
    }

    setLoading(true);
    try {
      setError(null);
      const authors = newBookAuthors
        .split(",")
        .map((a) => a.trim())
        .filter((a) => a.length > 0);

      await createBook(newBookTitle, authors);

      // Clear form
      setNewBookTitle("");
      setNewBookAuthors("");

      // Refresh book list
      await loadBooks();
    } catch (err) {
      setError(err instanceof Error ? err.message : String(err));
      console.error("Failed to create book:", err);
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="app">
      <header>
        <h1>Reading Tracker</h1>
      </header>

      <main>
        <section className="add-book-section">
          <h2>Add New Book</h2>
          <form onSubmit={handleAddBook}>
            <div className="form-group">
              <label htmlFor="title">Title:</label>
              <input
                type="text"
                id="title"
                value={newBookTitle}
                onChange={(e) => setNewBookTitle(e.target.value)}
                placeholder="Enter book title"
                disabled={loading}
              />
            </div>
            <div className="form-group">
              <label htmlFor="authors">Authors (comma-separated):</label>
              <input
                type="text"
                id="authors"
                value={newBookAuthors}
                onChange={(e) => setNewBookAuthors(e.target.value)}
                placeholder="e.g., John Doe, Jane Smith"
                disabled={loading}
              />
            </div>
            <button
              type="submit"
              className="btn btn-primary"
              disabled={loading}
            >
              {loading ? "Adding..." : "Add Book"}
            </button>
          </form>
          {error && <div className="error">{error}</div>}
        </section>

        <section className="books-section">
          <h2>My Books</h2>
          {books.length === 0 ? (
            <p className="empty-state">
              No books yet. Add your first book above!
            </p>
          ) : (
            <div className="books-list">
              {books.map((book) => (
                <div key={book.id} className="book-row">
                  <div className="book-info">
                    <h3>{book.title}</h3>
                    <span className="book-status">{book.status}</span>
                  </div>
                  <SessionTimer
                    bookId={book.id}
                    activeBookId={activeBookId}
                    onSessionChange={handleSessionChange}
                  />
                </div>
              ))}
            </div>
          )}
        </section>
      </main>
    </div>
  );
}

export default App;

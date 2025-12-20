import { describe, it, expect, vi, beforeEach } from "vitest";
import { render, screen, fireEvent, waitFor } from "@testing-library/react";
import App from "./App";
import * as api from "./lib/api";

// Mock the API module
vi.mock("./lib/api", () => ({
  createBook: vi.fn(),
  listBooks: vi.fn(),
  timerStart: vi.fn(),
  timerStop: vi.fn(),
  upsertSession: vi.fn(),
  onTimerTick: vi.fn(),
  getActiveSession: vi.fn(),
  stopActiveSession: vi.fn(),
}));

// Mock SessionTimer component to simplify testing
vi.mock("./components/SessionTimer", () => ({
  SessionTimer: ({
    bookId,
    activeBookId,
  }: {
    bookId: string;
    activeBookId: string | null;
  }) => (
    <div data-testid={`timer-${bookId}`}>
      Timer for {bookId} {activeBookId === bookId ? "(active)" : ""}
    </div>
  ),
}));

describe("App Component", () => {
  const mockUnlisten = vi.fn();

  beforeEach(() => {
    vi.clearAllMocks();
    (api.listBooks as any).mockResolvedValue([]);
    (api.onTimerTick as any).mockResolvedValue(mockUnlisten);
    (api.getActiveSession as any).mockResolvedValue(null); // No active session by default
  });

  describe("Initial Render", () => {
    it("should render the app header", async () => {
      render(<App />);

      expect(screen.getByText("Reading Tracker")).toBeInTheDocument();
    });

    it("should render the add book form", async () => {
      render(<App />);

      expect(screen.getByText("Add New Book")).toBeInTheDocument();
      expect(screen.getByLabelText(/title/i)).toBeInTheDocument();
      expect(screen.getByLabelText(/authors/i)).toBeInTheDocument();
      expect(
        screen.getByRole("button", { name: /add book/i })
      ).toBeInTheDocument();
    });

    it("should load and display books on mount", async () => {
      const mockBooks = [
        {
          id: "book-1",
          title: "Test Book 1",
          authors: "Author A", // Comma-separated string
          priority: 5,
          status: "active",
        },
        {
          id: "book-2",
          title: "Test Book 2",
          authors: "Author B", // Comma-separated string
          priority: 3,
          status: "completed",
        },
      ];

      (api.listBooks as any).mockResolvedValue(mockBooks);

      render(<App />);

      await waitFor(() => {
        expect(api.listBooks).toHaveBeenCalled();
      });

      await waitFor(() => {
        expect(screen.getByText("Test Book 1")).toBeInTheDocument();
        expect(screen.getByText("Test Book 2")).toBeInTheDocument();
      });
    });

    it("should display empty state when no books exist", async () => {
      (api.listBooks as any).mockResolvedValue([]);

      render(<App />);

      await waitFor(() => {
        expect(screen.getByText(/no books yet/i)).toBeInTheDocument();
      });
    });
  });

  describe("Add Book Form", () => {
    it("should update title input when typing", async () => {
      render(<App />);

      const titleInput = screen.getByLabelText(/title/i) as HTMLInputElement;
      fireEvent.change(titleInput, { target: { value: "New Book Title" } });

      expect(titleInput.value).toBe("New Book Title");
    });

    it("should update authors input when typing", async () => {
      render(<App />);

      const authorsInput = screen.getByLabelText(
        /authors/i
      ) as HTMLInputElement;
      fireEvent.change(authorsInput, {
        target: { value: "John Doe, Jane Smith" },
      });

      expect(authorsInput.value).toBe("John Doe, Jane Smith");
    });

    it("should create a book when form is submitted", async () => {
      const mockBookId = "new-book-123";
      (api.createBook as any).mockResolvedValue(mockBookId);
      (api.listBooks as any).mockResolvedValue([]);

      render(<App />);

      const titleInput = screen.getByLabelText(/title/i);
      const authorsInput = screen.getByLabelText(/authors/i);
      const submitButton = screen.getByRole("button", { name: /add book/i });

      fireEvent.change(titleInput, { target: { value: "My New Book" } });
      fireEvent.change(authorsInput, {
        target: { value: "Author One, Author Two" },
      });
      fireEvent.click(submitButton);

      await waitFor(() => {
        expect(api.createBook).toHaveBeenCalledWith("My New Book", [
          "Author One",
          "Author Two",
        ]);
      });
    });

    it("should parse comma-separated authors correctly", async () => {
      const mockBookId = "new-book-456";
      (api.createBook as any).mockResolvedValue(mockBookId);
      (api.listBooks as any).mockResolvedValue([]);

      render(<App />);

      const titleInput = screen.getByLabelText(/title/i);
      const authorsInput = screen.getByLabelText(/authors/i);
      const submitButton = screen.getByRole("button", { name: /add book/i });

      fireEvent.change(titleInput, { target: { value: "Test Book" } });
      fireEvent.change(authorsInput, {
        target: { value: "John Doe,  Jane Smith  , Bob Johnson" },
      });
      fireEvent.click(submitButton);

      await waitFor(() => {
        expect(api.createBook).toHaveBeenCalledWith("Test Book", [
          "John Doe",
          "Jane Smith",
          "Bob Johnson",
        ]);
      });
    });

    it("should handle empty authors list", async () => {
      const mockBookId = "new-book-789";
      (api.createBook as any).mockResolvedValue(mockBookId);
      (api.listBooks as any).mockResolvedValue([]);

      render(<App />);

      const titleInput = screen.getByLabelText(/title/i);
      const submitButton = screen.getByRole("button", { name: /add book/i });

      fireEvent.change(titleInput, { target: { value: "Solo Book" } });
      fireEvent.click(submitButton);

      await waitFor(() => {
        expect(api.createBook).toHaveBeenCalledWith("Solo Book", []);
      });
    });

    it("should show error if title is empty", async () => {
      render(<App />);

      const submitButton = screen.getByRole("button", { name: /add book/i });
      fireEvent.click(submitButton);

      await waitFor(() => {
        expect(screen.getByText("Book title is required")).toBeInTheDocument();
      });

      expect(api.createBook).not.toHaveBeenCalled();
    });

    it("should clear form after successful submission", async () => {
      const mockBookId = "new-book-clear";
      (api.createBook as any).mockResolvedValue(mockBookId);
      (api.listBooks as any).mockResolvedValue([]);

      render(<App />);

      const titleInput = screen.getByLabelText(/title/i) as HTMLInputElement;
      const authorsInput = screen.getByLabelText(
        /authors/i
      ) as HTMLInputElement;
      const submitButton = screen.getByRole("button", { name: /add book/i });

      fireEvent.change(titleInput, { target: { value: "My Book" } });
      fireEvent.change(authorsInput, { target: { value: "Author Name" } });
      fireEvent.click(submitButton);

      await waitFor(() => {
        expect(titleInput.value).toBe("");
        expect(authorsInput.value).toBe("");
      });
    });

    it("should refresh book list after adding a book", async () => {
      const mockBookId = "new-book-refresh";
      const initialBooks = [
        {
          id: "book-1",
          title: "Existing Book",
          authors: "Author",
          priority: 0,
          status: "active",
        },
      ];
      const updatedBooks = [
        ...initialBooks,
        {
          id: mockBookId,
          title: "New Book",
          authors: "New Author",
          priority: 0,
          status: "active",
        },
      ];

      (api.createBook as any).mockResolvedValue(mockBookId);
      (api.listBooks as any)
        .mockResolvedValueOnce(initialBooks)
        .mockResolvedValueOnce(updatedBooks);

      render(<App />);

      await waitFor(() => {
        expect(screen.getByText("Existing Book")).toBeInTheDocument();
      });

      const titleInput = screen.getByLabelText(/title/i);
      const submitButton = screen.getByRole("button", { name: /add book/i });

      fireEvent.change(titleInput, { target: { value: "New Book" } });
      fireEvent.click(submitButton);

      await waitFor(() => {
        expect(api.listBooks).toHaveBeenCalledTimes(2);
      });

      await waitFor(() => {
        expect(screen.getByText("New Book")).toBeInTheDocument();
      });
    });

    it("should disable form inputs while submitting", async () => {
      const mockBookId = "new-book-loading";
      let resolveCreate: (value: string) => void;
      const createPromise = new Promise<string>((resolve) => {
        resolveCreate = resolve;
      });

      (api.createBook as any).mockReturnValue(createPromise);
      (api.listBooks as any).mockResolvedValue([]);

      render(<App />);

      const titleInput = screen.getByLabelText(/title/i) as HTMLInputElement;
      const authorsInput = screen.getByLabelText(
        /authors/i
      ) as HTMLInputElement;
      const submitButton = screen.getByRole("button", {
        name: /add book/i,
      }) as HTMLButtonElement;

      fireEvent.change(titleInput, { target: { value: "Loading Test" } });
      fireEvent.click(submitButton);

      await waitFor(() => {
        expect(titleInput.disabled).toBe(true);
        expect(authorsInput.disabled).toBe(true);
        expect(submitButton.disabled).toBe(true);
      });

      // Resolve the promise
      resolveCreate!(mockBookId);

      await waitFor(() => {
        expect(titleInput.disabled).toBe(false);
        expect(authorsInput.disabled).toBe(false);
        expect(submitButton.disabled).toBe(false);
      });
    });

    it("should display error message if book creation fails", async () => {
      (api.createBook as any).mockRejectedValue(
        new Error("Failed to create book")
      );
      (api.listBooks as any).mockResolvedValue([]);

      render(<App />);

      const titleInput = screen.getByLabelText(/title/i);
      const submitButton = screen.getByRole("button", { name: /add book/i });

      fireEvent.change(titleInput, { target: { value: "Failing Book" } });
      fireEvent.click(submitButton);

      await waitFor(() => {
        expect(screen.getByText("Failed to create book")).toBeInTheDocument();
      });
    });
  });

  describe("Books List Display", () => {
    it("should render SessionTimer for each book", async () => {
      const mockBooks = [
        {
          id: "book-1",
          title: "Book One",
          authors: "Author A",
          priority: 5,
          status: "active",
        },
        {
          id: "book-2",
          title: "Book Two",
          authors: "Author B",
          priority: 3,
          status: "active",
        },
      ];

      (api.listBooks as any).mockResolvedValue(mockBooks);

      render(<App />);

      await waitFor(() => {
        expect(screen.getByTestId("timer-book-1")).toBeInTheDocument();
        expect(screen.getByTestId("timer-book-2")).toBeInTheDocument();
      });
    });

    it("should display book status", async () => {
      const mockBooks = [
        {
          id: "book-status",
          title: "Status Test Book",
          authors: "Author",
          priority: 0,
          status: "completed",
        },
      ];

      (api.listBooks as any).mockResolvedValue(mockBooks);

      render(<App />);

      await waitFor(() => {
        expect(screen.getByText("completed")).toBeInTheDocument();
      });
    });

    it("should display multiple books in order", async () => {
      const mockBooks = [
        {
          id: "book-1",
          title: "First Book",
          authors: "Author",
          priority: 0,
          status: "active",
        },
        {
          id: "book-2",
          title: "Second Book",
          authors: "Author",
          priority: 0,
          status: "active",
        },
        {
          id: "book-3",
          title: "Third Book",
          authors: "Author",
          priority: 0,
          status: "active",
        },
      ];

      (api.listBooks as any).mockResolvedValue(mockBooks);

      render(<App />);

      await waitFor(() => {
        expect(screen.getByText("First Book")).toBeInTheDocument();
        expect(screen.getByText("Second Book")).toBeInTheDocument();
        expect(screen.getByText("Third Book")).toBeInTheDocument();
      });
    });
  });

  describe("Session Restoration", () => {
    it("should restore active session on mount", async () => {
      const activeSession = {
        id: "session-123",
        book_id: "book-1",
        start_at: "2025-11-16T10:00:00Z",
        end_at: null,
        created_at: "2025-11-16T10:00:00Z",
        updated_at: "2025-11-16T10:00:00Z",
      };

      const mockBooks = [
        {
          id: "book-1",
          title: "Active Book",
          authors: "Author",
          priority: 0,
          status: "active",
        },
      ];

      (api.getActiveSession as any).mockResolvedValue(activeSession);
      (api.listBooks as any).mockResolvedValue(mockBooks);
      (api.timerStart as any).mockResolvedValue("session-123");

      render(<App />);

      await waitFor(() => {
        expect(api.getActiveSession).toHaveBeenCalled();
        expect(api.timerStart).toHaveBeenCalledWith(
          "book-1",
          "2025-11-16T10:00:00Z"
        );
      });
    });
  });

  describe("Error Handling", () => {
    it("should handle error when loading books fails", async () => {
      const consoleErrorSpy = vi
        .spyOn(console, "error")
        .mockImplementation(() => {});
      (api.listBooks as any).mockRejectedValue(
        new Error("Database connection failed")
      );

      render(<App />);

      await waitFor(() => {
        expect(api.listBooks).toHaveBeenCalled();
      });

      // The error should be logged
      expect(consoleErrorSpy).toHaveBeenCalledWith(
        "Failed to load books:",
        expect.any(Error)
      );

      consoleErrorSpy.mockRestore();
    });
  });
});

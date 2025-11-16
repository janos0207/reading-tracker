import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import { invoke } from "@tauri-apps/api/core";
import { listen } from "@tauri-apps/api/event";

// Mock Tauri modules
vi.mock("@tauri-apps/api/core", () => ({
  invoke: vi.fn(),
}));

vi.mock("@tauri-apps/api/event", () => ({
  listen: vi.fn(),
}));

// Create a mockDb that will be reused
const mockDb = {
  execute: vi.fn().mockResolvedValue(undefined),
  select: vi.fn().mockResolvedValue([]),
};

vi.mock("@tauri-apps/plugin-sql", () => {
  return {
    default: {
      load: vi.fn(() => Promise.resolve(mockDb)),
    },
  };
});

describe("API Functions", () => {
  beforeEach(async () => {
    vi.clearAllMocks();
    mockDb.execute.mockClear();
    mockDb.select.mockClear();
    mockDb.execute.mockResolvedValue(undefined);
    mockDb.select.mockResolvedValue([]);
  });

  afterEach(() => {
    vi.clearAllMocks();
  });

  describe("createBook", () => {
    it("should create a book and insert it into the database", async () => {
      const mockId = "test-book-id-123";
      (invoke as any).mockResolvedValue(mockId);

      const { createBook } = await import("./api");
      const result = await createBook("Test Book", [
        "Author One",
        "Author Two",
      ]);

      expect(invoke).toHaveBeenCalledWith("create_book", {
        title: "Test Book",
        authors: ["Author One", "Author Two"],
      });

      expect(mockDb.execute).toHaveBeenCalledWith(
        expect.stringContaining("INSERT INTO books"),
        expect.arrayContaining([
          mockId,
          "Test Book",
          JSON.stringify(["Author One", "Author Two"]),
          0,
          "active",
        ])
      );

      expect(result).toBe(mockId);
    });

    it("should handle empty authors array", async () => {
      const mockId = "test-book-id-456";
      (invoke as any).mockResolvedValue(mockId);

      const { createBook } = await import("./api");
      const result = await createBook("Solo Book", []);

      expect(mockDb.execute).toHaveBeenCalledWith(
        expect.stringContaining("INSERT INTO books"),
        expect.arrayContaining([mockId, "Solo Book", JSON.stringify([])])
      );

      expect(result).toBe(mockId);
    });

    it("should throw error if invoke fails", async () => {
      (invoke as any).mockRejectedValue(new Error("Backend error"));

      const { createBook } = await import("./api");
      await expect(createBook("Failing Book", [])).rejects.toThrow(
        "Backend error"
      );
    });
  });

  describe("listBooks", () => {
    it("should return list of books from database", async () => {
      const mockBooks = [
        {
          id: "book-1",
          title: "Book One",
          authors: JSON.stringify(["Author A"]),
          priority: 5,
          status: "active",
          created_at: "2025-11-08T10:00:00Z",
          updated_at: "2025-11-08T10:00:00Z",
        },
        {
          id: "book-2",
          title: "Book Two",
          authors: JSON.stringify(["Author B", "Author C"]),
          priority: 3,
          status: "completed",
          created_at: "2025-11-08T11:00:00Z",
          updated_at: "2025-11-08T11:00:00Z",
        },
      ];

      mockDb.select.mockResolvedValue(mockBooks);

      const { listBooks } = await import("./api");
      const result = await listBooks();

      expect(mockDb.select).toHaveBeenCalledWith(
        expect.stringContaining("SELECT id, title, authors, priority, status")
      );

      expect(result).toEqual(mockBooks);
      expect(result).toHaveLength(2);
    });

    it("should return empty array when no books exist", async () => {
      mockDb.select.mockResolvedValue([]);

      const { listBooks } = await import("./api");
      const result = await listBooks();

      expect(result).toEqual([]);
    });
  });

  describe("upsertSession", () => {
    it("should create a new session when it does not exist", async () => {
      const mockId = "session-id-123";
      (invoke as any).mockResolvedValue(mockId);
      mockDb.select.mockResolvedValue([]); // No existing session

      const payload = {
        book_id: "book-123",
        start_at: "2025-11-09T10:00:00Z",
      };

      const { upsertSession } = await import("./api");
      const result = await upsertSession(payload);

      expect(invoke).toHaveBeenCalledWith("upsert_session", { payload });

      expect(mockDb.select).toHaveBeenCalledWith(
        "SELECT id FROM sessions WHERE id = ?",
        [mockId]
      );

      expect(mockDb.execute).toHaveBeenCalledWith(
        expect.stringContaining("INSERT INTO sessions"),
        expect.arrayContaining([
          mockId,
          "book-123",
          "2025-11-09T10:00:00Z",
          null,
        ])
      );

      expect(result).toBe(mockId);
    });

    it("should update existing session with end time", async () => {
      const mockId = "session-id-456";
      (invoke as any).mockResolvedValue(mockId);
      mockDb.select.mockResolvedValue([{ id: mockId }]); // Session exists

      const payload = {
        id: mockId,
        book_id: "book-456",
        start_at: "2025-11-09T10:00:00Z",
        end_at: "2025-11-09T11:30:00Z",
      };

      const { upsertSession } = await import("./api");
      const result = await upsertSession(payload);

      expect(mockDb.execute).toHaveBeenCalledWith(
        expect.stringContaining("UPDATE sessions"),
        expect.arrayContaining([
          "2025-11-09T11:30:00Z",
          expect.any(String),
          mockId,
        ])
      );

      expect(result).toBe(mockId);
    });

    it("should handle session without end time", async () => {
      const mockId = "session-id-789";
      (invoke as any).mockResolvedValue(mockId);
      mockDb.select.mockResolvedValue([]);

      const payload = {
        book_id: "book-789",
        start_at: "2025-11-09T10:00:00Z",
        end_at: undefined,
      };

      const { upsertSession } = await import("./api");
      await upsertSession(payload);

      expect(mockDb.execute).toHaveBeenCalledWith(
        expect.stringContaining("INSERT INTO sessions"),
        expect.arrayContaining([
          mockId,
          "book-789",
          "2025-11-09T10:00:00Z",
          null,
        ])
      );
    });
  });

  describe("timerStart", () => {
    it("should invoke timer_start command with correct parameters", async () => {
      const mockSessionId = "session-abc-123";
      (invoke as any).mockResolvedValue(mockSessionId);

      const { timerStart } = await import("./api");
      const result = await timerStart("book-xyz", "2025-11-09T10:00:00Z");

      expect(invoke).toHaveBeenCalledWith("timer_start", {
        bookId: "book-xyz",
        startAtIso: "2025-11-09T10:00:00Z",
      });

      expect(result).toBe(mockSessionId);
    });

    it("should throw error if timer is already running", async () => {
      (invoke as any).mockRejectedValue(
        new Error("A timer session is already running")
      );

      const { timerStart } = await import("./api");
      await expect(
        timerStart("book-xyz", "2025-11-09T10:00:00Z")
      ).rejects.toThrow("A timer session is already running");
    });
  });

  describe("timerStop", () => {
    it("should invoke timer_stop command and return stopped session", async () => {
      const mockStoppedSession = {
        session_id: "session-123",
        book_id: "book-456",
        start_at: "2025-11-09T10:00:00Z",
        end_at: "2025-11-09T11:30:00Z",
      };

      (invoke as any).mockResolvedValue(mockStoppedSession);

      const { timerStop } = await import("./api");
      const result = await timerStop("2025-11-09T11:30:00Z");

      expect(invoke).toHaveBeenCalledWith("timer_stop", {
        endAtIso: "2025-11-09T11:30:00Z",
      });

      expect(result).toEqual(mockStoppedSession);
    });

    it("should throw error if no timer is running", async () => {
      (invoke as any).mockRejectedValue(
        new Error("No timer session is currently running")
      );

      const { timerStop } = await import("./api");
      await expect(timerStop("2025-11-09T11:30:00Z")).rejects.toThrow(
        "No timer session is currently running"
      );
    });
  });

  describe("onTimerTick", () => {
    it("should set up event listener for timer ticks", async () => {
      const mockUnlisten = vi.fn();
      (listen as any).mockResolvedValue(mockUnlisten);

      const callback = vi.fn();

      const { onTimerTick } = await import("./api");
      const unlisten = await onTimerTick(callback);

      expect(listen).toHaveBeenCalledWith("timer://tick", expect.any(Function));
      expect(unlisten).toBe(mockUnlisten);
    });

    it("should call callback with elapsed seconds when event fires", async () => {
      const callback = vi.fn();
      let eventHandler: any;

      (listen as any).mockImplementation((_eventName: string, handler: any) => {
        eventHandler = handler;
        return Promise.resolve(vi.fn());
      });

      const { onTimerTick } = await import("./api");
      await onTimerTick(callback);

      // Simulate event emission
      eventHandler({ payload: 42 });

      expect(callback).toHaveBeenCalledWith(42);
    });

    it("should handle multiple tick events", async () => {
      const callback = vi.fn();
      let eventHandler: any;

      (listen as any).mockImplementation((_eventName: string, handler: any) => {
        eventHandler = handler;
        return Promise.resolve(vi.fn());
      });

      const { onTimerTick } = await import("./api");
      await onTimerTick(callback);

      // Simulate multiple events
      eventHandler({ payload: 1 });
      eventHandler({ payload: 2 });
      eventHandler({ payload: 3 });

      expect(callback).toHaveBeenCalledTimes(3);
      expect(callback).toHaveBeenNthCalledWith(1, 1);
      expect(callback).toHaveBeenNthCalledWith(2, 2);
      expect(callback).toHaveBeenNthCalledWith(3, 3);
    });
  });
});

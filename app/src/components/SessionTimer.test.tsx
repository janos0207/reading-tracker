import { describe, it, expect, vi, beforeEach } from "vitest";
import { render, screen, fireEvent, waitFor } from "@testing-library/react";
import { SessionTimer } from "./SessionTimer";

import * as api from "../lib/api";
import * as dialog from "../lib/dialog";

// Mock the API module
vi.mock("../lib/api", () => ({
  timerStart: vi.fn(),
  timerStop: vi.fn(),
  upsertSession: vi.fn(),
  onTimerTick: vi.fn(),
  getActiveSession: vi.fn(),
  stopActiveSession: vi.fn(),
}));

// Mock dialog wrapper
vi.mock("../lib/dialog", () => ({
  askConfirm: vi.fn(),
}));

describe("SessionTimer Component (New Behavior)", () => {
  const mockBookId = "test-book-123";
  const mockOnSessionChange = vi.fn();
  let mockUnlisten: ReturnType<typeof vi.fn>;

  beforeEach(() => {
    vi.clearAllMocks();
    mockUnlisten = vi.fn();
    (api.onTimerTick as any).mockResolvedValue(mockUnlisten);
    (api.getActiveSession as any).mockResolvedValue(null);
  });

  describe("Initial Render", () => {
    it("should render with Start button when not active", () => {
      render(
        <SessionTimer
          bookId={mockBookId}
          activeBookId={null}
          onSessionChange={mockOnSessionChange}
        />
      );

      expect(screen.getByText("00:00")).toBeInTheDocument();
      expect(
        screen.getByRole("button", { name: /start/i })
      ).toBeInTheDocument();
    });

    it("should render with Stop button when active", () => {
      render(
        <SessionTimer
          bookId={mockBookId}
          activeBookId={mockBookId}
          onSessionChange={mockOnSessionChange}
        />
      );

      expect(screen.getByRole("button", { name: /stop/i })).toBeInTheDocument();
    });

    it("should render with Start button when another book is active", () => {
      render(
        <SessionTimer
          bookId={mockBookId}
          activeBookId="other-book-id"
          onSessionChange={mockOnSessionChange}
        />
      );

      expect(
        screen.getByRole("button", { name: /start/i })
      ).toBeInTheDocument();
    });
  });

  describe("Start Button - No Active Session", () => {
    it("should start timer when no active session exists", async () => {
      const mockSessionId = "new-session-123";
      (api.getActiveSession as any).mockResolvedValue(null);
      (api.timerStart as any).mockResolvedValue(mockSessionId);
      (api.upsertSession as any).mockResolvedValue(mockSessionId);

      render(
        <SessionTimer
          bookId={mockBookId}
          activeBookId={null}
          onSessionChange={mockOnSessionChange}
        />
      );

      const startButton = screen.getByRole("button", { name: /start/i });
      fireEvent.click(startButton);

      await waitFor(() => {
        expect(api.getActiveSession).toHaveBeenCalled();
        expect(api.timerStart).toHaveBeenCalledWith(
          mockBookId,
          expect.stringMatching(/^\d{4}-\d{2}-\d{2}T/)
        );
        expect(mockOnSessionChange).toHaveBeenCalled();
      });
    });
  });

  describe("Start Button - With Active Session", () => {
    it("should prompt user before switching books", async () => {
      const activeSession = {
        id: "active-session-456",
        book_id: "other-book-789",
        start_at: "2025-11-16T10:00:00Z",
        end_at: null,
        created_at: "2025-11-16T10:00:00Z",
        updated_at: "2025-11-16T10:00:00Z",
      };

      (api.getActiveSession as any).mockResolvedValue(activeSession);
      (dialog.askConfirm as any).mockResolvedValue(false);
      render(
        <SessionTimer
          bookId={mockBookId}
          activeBookId="other-book-789"
          onSessionChange={mockOnSessionChange}
        />
      );

      const startButton = screen.getByRole("button", { name: /start/i });
      fireEvent.click(startButton);

      await waitFor(() => {
        expect(dialog.askConfirm).toHaveBeenCalledWith(
          expect.stringContaining("ongoing reading session")
        );
      });

      // Should not start new timer if user cancelled
      expect(api.timerStart).not.toHaveBeenCalled();

      // nothing else
    });

    it("should switch sessions when user confirms", async () => {
      const activeSession = {
        id: "active-session-456",
        book_id: "other-book-789",
        start_at: "2025-11-16T10:00:00Z",
        end_at: null,
        created_at: "2025-11-16T10:00:00Z",
        updated_at: "2025-11-16T10:00:00Z",
      };

      const mockNewSessionId = "new-session-999";
      (api.getActiveSession as any).mockResolvedValue(activeSession);
      (api.stopActiveSession as any).mockResolvedValue(undefined);
      (api.timerStop as any).mockResolvedValue({
        session_id: activeSession.id,
        book_id: activeSession.book_id,
        start_at: activeSession.start_at,
        end_at: "2025-11-16T11:00:00Z",
      });
      (api.timerStart as any).mockResolvedValue(mockNewSessionId);
      (api.upsertSession as any).mockResolvedValue(mockNewSessionId);

      // Mock ask to confirm
      (dialog.askConfirm as any).mockResolvedValue(true);
      render(
        <SessionTimer
          bookId={mockBookId}
          activeBookId="other-book-789"
          onSessionChange={mockOnSessionChange}
        />
      );

      const startButton = screen.getByRole("button", { name: /start/i });
      fireEvent.click(startButton);

      await waitFor(() => {
        expect(dialog.askConfirm).toHaveBeenCalled();
        expect(api.stopActiveSession).toHaveBeenCalled();
        expect(api.timerStop).toHaveBeenCalled();
        expect(api.timerStart).toHaveBeenCalledWith(
          mockBookId,
          expect.any(String)
        );
        expect(mockOnSessionChange).toHaveBeenCalled();
      });
    });
  });

  describe("Stop Button", () => {
    it("should stop the active timer", async () => {
      const mockStoppedSession = {
        session_id: "session-123",
        book_id: mockBookId,
        start_at: "2025-11-16T10:00:00Z",
        end_at: "2025-11-16T11:00:00Z",
      };

      (api.timerStop as any).mockResolvedValue(mockStoppedSession);
      (api.upsertSession as any).mockResolvedValue(
        mockStoppedSession.session_id
      );

      render(
        <SessionTimer
          bookId={mockBookId}
          activeBookId={mockBookId}
          onSessionChange={mockOnSessionChange}
        />
      );

      const stopButton = screen.getByRole("button", { name: /stop/i });
      fireEvent.click(stopButton);

      await waitFor(() => {
        expect(api.timerStop).toHaveBeenCalled();
        expect(api.upsertSession).toHaveBeenCalledWith({
          id: mockStoppedSession.session_id,
          book_id: mockStoppedSession.book_id,
          start_at: mockStoppedSession.start_at,
          end_at: mockStoppedSession.end_at,
        });
        expect(mockOnSessionChange).toHaveBeenCalled();
      });
    });
  });

  describe("Timer Display", () => {
    it("should update elapsed time when active", async () => {
      let tickCallback: ((elapsed: number) => void) | undefined;

      (api.onTimerTick as any).mockImplementation(
        (callback: (elapsed: number) => void) => {
          tickCallback = callback;
          return Promise.resolve(mockUnlisten);
        }
      );

      render(
        <SessionTimer
          bookId={mockBookId}
          activeBookId={mockBookId}
          onSessionChange={mockOnSessionChange}
        />
      );

      await waitFor(() => {
        expect(tickCallback).toBeDefined();
      });

      // Simulate 90 seconds
      tickCallback!(90);

      await waitFor(() => {
        expect(screen.getByText("01:30")).toBeInTheDocument();
      });
    });

    it("should not update elapsed time when not active", async () => {
      let tickCallback: ((elapsed: number) => void) | undefined;

      (api.onTimerTick as any).mockImplementation(
        (callback: (elapsed: number) => void) => {
          tickCallback = callback;
          return Promise.resolve(mockUnlisten);
        }
      );

      render(
        <SessionTimer
          bookId={mockBookId}
          activeBookId="other-book-id"
          onSessionChange={mockOnSessionChange}
        />
      );

      await waitFor(() => {
        expect(tickCallback).toBeDefined();
      });

      // Simulate tick (should not update this timer)
      tickCallback!(90);

      // Should still show 00:00
      expect(screen.getByText("00:00")).toBeInTheDocument();
    });
  });
});

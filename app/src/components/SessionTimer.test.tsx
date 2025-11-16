import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import { render, screen, fireEvent, waitFor } from "@testing-library/react";
import { SessionTimer } from "./SessionTimer";
import * as api from "../lib/api";

// Mock the API module
vi.mock("../lib/api", () => ({
  timerStart: vi.fn(),
  timerStop: vi.fn(),
  upsertSession: vi.fn(),
  onTimerTick: vi.fn(),
}));

describe("SessionTimer Component", () => {
  const mockBookId = "test-book-123";
  let mockUnlisten: ReturnType<typeof vi.fn>;

  beforeEach(() => {
    vi.clearAllMocks();
    mockUnlisten = vi.fn();
    (api.onTimerTick as any).mockResolvedValue(mockUnlisten);
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  describe("Initial Render", () => {
    it("should render with initial state (00:00)", () => {
      render(<SessionTimer bookId={mockBookId} />);

      expect(screen.getByText("00:00")).toBeInTheDocument();
      expect(
        screen.getByRole("button", { name: /start/i })
      ).toBeInTheDocument();
    });

    it("should set up timer tick listener on mount", async () => {
      render(<SessionTimer bookId={mockBookId} />);

      await waitFor(() => {
        expect(api.onTimerTick).toHaveBeenCalledWith(expect.any(Function));
      });
    });

    it("should clean up listener on unmount", async () => {
      const { unmount } = render(<SessionTimer bookId={mockBookId} />);

      await waitFor(() => {
        expect(api.onTimerTick).toHaveBeenCalled();
      });

      unmount();

      await waitFor(() => {
        expect(mockUnlisten).toHaveBeenCalled();
      });
    });
  });

  describe("Timer Display Formatting", () => {
    it("should format seconds correctly (00:00 to 00:59)", () => {
      render(<SessionTimer bookId={mockBookId} />);

      expect(screen.getByText("00:00")).toBeInTheDocument();
    });

    it("should format minutes and seconds correctly", async () => {
      let tickCallback: ((elapsed: number) => void) | undefined;

      (api.onTimerTick as any).mockImplementation(
        (callback: (elapsed: number) => void) => {
          tickCallback = callback;
          return Promise.resolve(mockUnlisten);
        }
      );

      render(<SessionTimer bookId={mockBookId} />);

      await waitFor(() => {
        expect(tickCallback).toBeDefined();
      });

      // Simulate 90 seconds (1 minute and 30 seconds)
      tickCallback!(90);

      await waitFor(() => {
        expect(screen.getByText("01:30")).toBeInTheDocument();
      });
    });

    it("should format large numbers correctly (99:59)", async () => {
      let tickCallback: ((elapsed: number) => void) | undefined;

      (api.onTimerTick as any).mockImplementation(
        (callback: (elapsed: number) => void) => {
          tickCallback = callback;
          return Promise.resolve(mockUnlisten);
        }
      );

      render(<SessionTimer bookId={mockBookId} />);

      await waitFor(() => {
        expect(tickCallback).toBeDefined();
      });

      // Simulate 5999 seconds (99 minutes and 59 seconds)
      tickCallback!(5999);

      await waitFor(() => {
        expect(screen.getByText("99:59")).toBeInTheDocument();
      });
    });

    it("should pad single digit minutes and seconds with zeros", async () => {
      let tickCallback: ((elapsed: number) => void) | undefined;

      (api.onTimerTick as any).mockImplementation(
        (callback: (elapsed: number) => void) => {
          tickCallback = callback;
          return Promise.resolve(mockUnlisten);
        }
      );

      render(<SessionTimer bookId={mockBookId} />);

      await waitFor(() => {
        expect(tickCallback).toBeDefined();
      });

      // Test 5 seconds
      tickCallback!(5);
      await waitFor(() => {
        expect(screen.getByText("00:05")).toBeInTheDocument();
      });

      // Test 65 seconds (1:05)
      tickCallback!(65);
      await waitFor(() => {
        expect(screen.getByText("01:05")).toBeInTheDocument();
      });
    });
  });

  describe("Start Button", () => {
    it("should call timerStart when Start button is clicked", async () => {
      const mockSessionId = "session-abc-123";
      (api.timerStart as any).mockResolvedValue(mockSessionId);
      (api.upsertSession as any).mockResolvedValue(mockSessionId);

      render(<SessionTimer bookId={mockBookId} />);

      const startButton = screen.getByRole("button", { name: /start/i });
      fireEvent.click(startButton);

      await waitFor(() => {
        expect(api.timerStart).toHaveBeenCalledWith(
          mockBookId,
          expect.stringMatching(/^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}\.\d{3}Z$/)
        );
      });
    });

    it("should create initial session record when starting timer", async () => {
      const mockSessionId = "session-def-456";
      (api.timerStart as any).mockResolvedValue(mockSessionId);
      (api.upsertSession as any).mockResolvedValue(mockSessionId);

      render(<SessionTimer bookId={mockBookId} />);

      const startButton = screen.getByRole("button", { name: /start/i });
      fireEvent.click(startButton);

      await waitFor(() => {
        expect(api.upsertSession).toHaveBeenCalledWith({
          id: mockSessionId,
          book_id: mockBookId,
          start_at: expect.stringMatching(
            /^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}\.\d{3}Z$/
          ),
        });
      });
    });

    it("should change button to Stop after starting", async () => {
      const mockSessionId = "session-ghi-789";
      (api.timerStart as any).mockResolvedValue(mockSessionId);
      (api.upsertSession as any).mockResolvedValue(mockSessionId);

      render(<SessionTimer bookId={mockBookId} />);

      const startButton = screen.getByRole("button", { name: /start/i });
      fireEvent.click(startButton);

      await waitFor(() => {
        expect(
          screen.getByRole("button", { name: /stop/i })
        ).toBeInTheDocument();
      });

      expect(
        screen.queryByRole("button", { name: /start/i })
      ).not.toBeInTheDocument();
    });

    it("should display error message if start fails", async () => {
      (api.timerStart as any).mockRejectedValue(
        new Error("A timer session is already running")
      );

      render(<SessionTimer bookId={mockBookId} />);

      const startButton = screen.getByRole("button", { name: /start/i });
      fireEvent.click(startButton);

      await waitFor(() => {
        expect(
          screen.getByText("A timer session is already running")
        ).toBeInTheDocument();
      });
    });

    it("should reset elapsed time to 0 when starting", async () => {
      let tickCallback: ((elapsed: number) => void) | undefined;

      (api.onTimerTick as any).mockImplementation(
        (callback: (elapsed: number) => void) => {
          tickCallback = callback;
          return Promise.resolve(mockUnlisten);
        }
      );

      const mockSessionId = "session-xyz-999";
      (api.timerStart as any).mockResolvedValue(mockSessionId);
      (api.upsertSession as any).mockResolvedValue(mockSessionId);

      render(<SessionTimer bookId={mockBookId} />);

      await waitFor(() => {
        expect(tickCallback).toBeDefined();
      });

      // Simulate some elapsed time
      tickCallback!(120);

      await waitFor(() => {
        expect(screen.getByText("02:00")).toBeInTheDocument();
      });

      // Start timer (which should reset to 00:00)
      const startButton = screen.getByRole("button", { name: /start/i });
      fireEvent.click(startButton);

      await waitFor(() => {
        expect(screen.getByText("00:00")).toBeInTheDocument();
      });
    });
  });

  describe("Stop Button", () => {
    beforeEach(async () => {
      const mockSessionId = "session-stop-test";
      (api.timerStart as any).mockResolvedValue(mockSessionId);
      (api.upsertSession as any).mockResolvedValue(mockSessionId);
    });

    it("should call timerStop when Stop button is clicked", async () => {
      const mockStoppedSession = {
        session_id: "session-stopped-123",
        book_id: mockBookId,
        start_at: "2025-11-09T10:00:00Z",
        end_at: "2025-11-09T11:30:00Z",
      };

      (api.timerStop as any).mockResolvedValue(mockStoppedSession);
      (api.upsertSession as any).mockResolvedValue(
        mockStoppedSession.session_id
      );

      render(<SessionTimer bookId={mockBookId} />);

      // Start the timer first
      const startButton = screen.getByRole("button", { name: /start/i });
      fireEvent.click(startButton);

      await waitFor(() => {
        expect(
          screen.getByRole("button", { name: /stop/i })
        ).toBeInTheDocument();
      });

      // Stop the timer
      const stopButton = screen.getByRole("button", { name: /stop/i });
      fireEvent.click(stopButton);

      await waitFor(() => {
        expect(api.timerStop).toHaveBeenCalledWith(
          expect.stringMatching(/^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}\.\d{3}Z$/)
        );
      });
    });

    it("should update session with end time when stopping", async () => {
      const mockStoppedSession = {
        session_id: "session-stopped-456",
        book_id: mockBookId,
        start_at: "2025-11-09T10:00:00Z",
        end_at: "2025-11-09T11:30:00Z",
      };

      (api.timerStop as any).mockResolvedValue(mockStoppedSession);
      (api.upsertSession as any).mockResolvedValue(
        mockStoppedSession.session_id
      );

      render(<SessionTimer bookId={mockBookId} />);

      // Start the timer
      const startButton = screen.getByRole("button", { name: /start/i });
      fireEvent.click(startButton);

      await waitFor(() => {
        expect(
          screen.getByRole("button", { name: /stop/i })
        ).toBeInTheDocument();
      });

      // Stop the timer
      const stopButton = screen.getByRole("button", { name: /stop/i });
      fireEvent.click(stopButton);

      await waitFor(() => {
        expect(api.upsertSession).toHaveBeenCalledWith({
          id: mockStoppedSession.session_id,
          book_id: mockStoppedSession.book_id,
          start_at: mockStoppedSession.start_at,
          end_at: mockStoppedSession.end_at,
        });
      });
    });

    it("should change button back to Start after stopping", async () => {
      const mockStoppedSession = {
        session_id: "session-stopped-789",
        book_id: mockBookId,
        start_at: "2025-11-09T10:00:00Z",
        end_at: "2025-11-09T11:30:00Z",
      };

      (api.timerStop as any).mockResolvedValue(mockStoppedSession);
      (api.upsertSession as any).mockResolvedValue(
        mockStoppedSession.session_id
      );

      render(<SessionTimer bookId={mockBookId} />);

      // Start the timer
      const startButton = screen.getByRole("button", { name: /start/i });
      fireEvent.click(startButton);

      await waitFor(() => {
        expect(
          screen.getByRole("button", { name: /stop/i })
        ).toBeInTheDocument();
      });

      // Stop the timer
      const stopButton = screen.getByRole("button", { name: /stop/i });
      fireEvent.click(stopButton);

      await waitFor(() => {
        expect(
          screen.getByRole("button", { name: /start/i })
        ).toBeInTheDocument();
      });

      expect(
        screen.queryByRole("button", { name: /stop/i })
      ).not.toBeInTheDocument();
    });

    it("should display error message if stop fails", async () => {
      (api.timerStop as any).mockRejectedValue(
        new Error("No timer session is currently running")
      );

      render(<SessionTimer bookId={mockBookId} />);

      // Start the timer
      const startButton = screen.getByRole("button", { name: /start/i });
      fireEvent.click(startButton);

      await waitFor(() => {
        expect(
          screen.getByRole("button", { name: /stop/i })
        ).toBeInTheDocument();
      });

      // Try to stop the timer
      const stopButton = screen.getByRole("button", { name: /stop/i });
      fireEvent.click(stopButton);

      await waitFor(() => {
        expect(
          screen.getByText("No timer session is currently running")
        ).toBeInTheDocument();
      });
    });

    it("should reset elapsed time to 0 after stopping", async () => {
      let tickCallback: ((elapsed: number) => void) | undefined;

      (api.onTimerTick as any).mockImplementation(
        (callback: (elapsed: number) => void) => {
          tickCallback = callback;
          return Promise.resolve(mockUnlisten);
        }
      );

      const mockStoppedSession = {
        session_id: "session-reset-test",
        book_id: mockBookId,
        start_at: "2025-11-09T10:00:00Z",
        end_at: "2025-11-09T11:30:00Z",
      };

      (api.timerStop as any).mockResolvedValue(mockStoppedSession);
      (api.upsertSession as any).mockResolvedValue(
        mockStoppedSession.session_id
      );

      render(<SessionTimer bookId={mockBookId} />);

      await waitFor(() => {
        expect(tickCallback).toBeDefined();
      });

      // Start the timer
      const startButton = screen.getByRole("button", { name: /start/i });
      fireEvent.click(startButton);

      await waitFor(() => {
        expect(
          screen.getByRole("button", { name: /stop/i })
        ).toBeInTheDocument();
      });

      // Simulate some elapsed time
      tickCallback!(180);

      await waitFor(() => {
        expect(screen.getByText("03:00")).toBeInTheDocument();
      });

      // Stop the timer
      const stopButton = screen.getByRole("button", { name: /stop/i });
      fireEvent.click(stopButton);

      await waitFor(() => {
        expect(screen.getByText("00:00")).toBeInTheDocument();
      });
    });
  });

  describe("Error Handling", () => {
    it("should clear previous error when starting timer successfully", async () => {
      const mockSessionId = "session-clear-error";

      // First attempt fails
      (api.timerStart as any).mockRejectedValueOnce(new Error("First error"));

      render(<SessionTimer bookId={mockBookId} />);

      const startButton = screen.getByRole("button", { name: /start/i });
      fireEvent.click(startButton);

      await waitFor(() => {
        expect(screen.getByText("First error")).toBeInTheDocument();
      });

      // Second attempt succeeds
      (api.timerStart as any).mockResolvedValue(mockSessionId);
      (api.upsertSession as any).mockResolvedValue(mockSessionId);

      fireEvent.click(startButton);

      await waitFor(() => {
        expect(screen.queryByText("First error")).not.toBeInTheDocument();
      });
    });
  });

  describe("Timer Integration", () => {
    it("should count up from 00:00 when timer is started and tick events are received", async () => {
      let tickCallback: ((elapsed: number) => void) | undefined;

      (api.onTimerTick as any).mockImplementation(
        (callback: (elapsed: number) => void) => {
          tickCallback = callback;
          return Promise.resolve(mockUnlisten);
        }
      );

      const mockSessionId = "session-integration-test";
      (api.timerStart as any).mockResolvedValue(mockSessionId);
      (api.upsertSession as any).mockResolvedValue(mockSessionId);

      render(<SessionTimer bookId={mockBookId} />);

      // Verify initial state
      expect(screen.getByText("00:00")).toBeInTheDocument();

      // Start the timer
      const startButton = screen.getByRole("button", { name: /start/i });
      fireEvent.click(startButton);

      await waitFor(
        () => {
          expect(api.timerStart).toHaveBeenCalled();
          expect(tickCallback).toBeDefined();
        },
        { timeout: 1000 }
      );

      // Simulate backend emitting tick events
      // After 1 second
      tickCallback!(1);
      await waitFor(
        () => {
          expect(screen.getByText("00:01")).toBeInTheDocument();
        },
        { timeout: 500 }
      );

      // After 5 seconds
      tickCallback!(5);
      await waitFor(
        () => {
          expect(screen.getByText("00:05")).toBeInTheDocument();
        },
        { timeout: 500 }
      );

      // After 65 seconds (1:05)
      tickCallback!(65);
      await waitFor(
        () => {
          expect(screen.getByText("01:05")).toBeInTheDocument();
        },
        { timeout: 500 }
      );

      // After 125 seconds (2:05)
      tickCallback!(125);
      await waitFor(
        () => {
          expect(screen.getByText("02:05")).toBeInTheDocument();
        },
        { timeout: 500 }
      );
    });

    it("should continue counting while timer is running", async () => {
      let tickCallback: ((elapsed: number) => void) | undefined;

      (api.onTimerTick as any).mockImplementation(
        (callback: (elapsed: number) => void) => {
          tickCallback = callback;
          return Promise.resolve(mockUnlisten);
        }
      );

      const mockSessionId = "session-continuous-test";
      (api.timerStart as any).mockResolvedValue(mockSessionId);
      (api.upsertSession as any).mockResolvedValue(mockSessionId);

      render(<SessionTimer bookId={mockBookId} />);

      // Start the timer
      const startButton = screen.getByRole("button", { name: /start/i });
      fireEvent.click(startButton);

      await waitFor(
        () => {
          expect(tickCallback).toBeDefined();
        },
        { timeout: 1000 }
      );

      // Simulate continuous ticking (just test a few iterations, not all 10)
      for (let i = 0; i <= 3; i++) {
        tickCallback!(i);
        await waitFor(
          () => {
            const expected = `00:${i.toString().padStart(2, "0")}`;
            expect(screen.getByText(expected)).toBeInTheDocument();
          },
          { timeout: 500 }
        );
      }
    });

    it("should stop receiving updates after timer is stopped", async () => {
      let tickCallback: ((elapsed: number) => void) | undefined;

      (api.onTimerTick as any).mockImplementation(
        (callback: (elapsed: number) => void) => {
          tickCallback = callback;
          return Promise.resolve(mockUnlisten);
        }
      );

      const mockSessionId = "session-stop-updates";
      const mockStoppedSession = {
        session_id: mockSessionId,
        book_id: mockBookId,
        start_at: "2025-11-09T10:00:00Z",
        end_at: "2025-11-09T10:05:00Z",
      };

      (api.timerStart as any).mockResolvedValue(mockSessionId);
      (api.timerStop as any).mockResolvedValue(mockStoppedSession);
      (api.upsertSession as any).mockResolvedValue(mockSessionId);

      render(<SessionTimer bookId={mockBookId} />);

      // Start timer
      const startButton = screen.getByRole("button", { name: /start/i });
      fireEvent.click(startButton);

      await waitFor(() => {
        expect(tickCallback).toBeDefined();
      });

      // Simulate ticking to 30 seconds
      tickCallback!(30);
      await waitFor(() => {
        expect(screen.getByText("00:30")).toBeInTheDocument();
      });

      // Stop timer
      const stopButton = screen.getByRole("button", { name: /stop/i });
      fireEvent.click(stopButton);

      await waitFor(() => {
        expect(screen.getByText("00:00")).toBeInTheDocument();
      });

      // Simulate more tick events (should not update the display)
      tickCallback!(60);

      // Should still show 00:00 since timer is stopped
      expect(screen.getByText("00:00")).toBeInTheDocument();
    });
  });
});

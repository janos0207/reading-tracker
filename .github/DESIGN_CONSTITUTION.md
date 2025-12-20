# Reading Tracker – Design Constitution

## Core Specification

1. Users can register books.
2. At most ONE reading session may be active at any time.
3. Starting a new session must explicitly replace or stop the current one.
4. Sessions persist (book_id, start_ts, end_ts, duration).
5. The database is the source of truth; UI reflects DB state only.

## Invariants

- Never more than one active session.
- No phantom or overlapping sessions.
- UI state must be derivable from persisted data.

## Non-Goals

- Multi-user support
- Concurrent sessions
- Background sync

## Change Policy

Any change that violates the invariants above
must be explicitly justified and approved.

# Reading Tracker - Test Documentation

## Running Tests

### Rust Tests

Run all Rust unit tests:

```bash
cd app/src-tauri
cargo test
```

Run tests with output:

```bash
cargo test -- --nocapture
```

### Frontend Tests

Run all frontend tests:

```bash
cd app
pnpm test:run
```

Run tests in watch mode:

```bash
pnpm test
```

Run tests with UI:

```bash
pnpm test:ui
```

## Test Coverage

### Rust Tests (12 tests)

**Timer Module (`timer.rs`):**

- `test_timer_start` - Verifies timer starts correctly and stores session
- `test_timer_start_fails_when_already_running` - Ensures only one timer can run at a time
- `test_timer_stop` - Verifies timer stops correctly and returns session data
- `test_timer_stop_fails_when_not_running` - Ensures timer can't stop when not running
- `test_timer_session_serialization` - Tests JSON serialization of TimerSession
- `test_stopped_session_serialization` - Tests JSON serialization of StoppedSession

**Main Commands (`main.rs`):**

- `test_create_book_returns_valid_uuid` - Verifies create_book returns valid UUID
- `test_list_books_returns_empty_initially` - Tests list_books returns empty array
- `test_upsert_session_with_id` - Tests upsert_session with provided ID
- `test_upsert_session_generates_id_when_none` - Tests ID generation when none provided
- `test_session_payload_serialization` - Tests JSON serialization of SessionPayload
- `test_book_list_item_serialization` - Tests JSON serialization of BookListItem

### Frontend Tests (2 tests)

**App Component (`App.test.tsx`):**

- `renders without crashing` - Verifies component renders successfully
- `renders an empty div` - Verifies basic structure

## Test Results

✅ **All 12 Rust tests passing**  
✅ **All 2 frontend tests passing**

## Future Test Additions

Consider adding tests for:

- Database migrations and SQL operations
- Integration tests for Tauri commands
- E2E tests for complete user flows
- Timer accuracy and edge cases
- Database transaction rollback scenarios

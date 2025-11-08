use anyhow::Result;
use tauri::AppHandle;
use tauri_plugin_sql::{Migration, MigrationKind};

pub async fn init_db(app: &AppHandle) -> Result<()> {
    let migrations = vec![
        Migration {
            version: 1,
            description: "create initial tables",
            sql: r#"
                CREATE TABLE IF NOT EXISTS books (
                    id TEXT PRIMARY KEY NOT NULL,
                    title TEXT NOT NULL,
                    authors TEXT NOT NULL,
                    priority INTEGER DEFAULT 0,
                    status TEXT DEFAULT 'active',
                    created_at TEXT NOT NULL,
                    updated_at TEXT NOT NULL
                );

                CREATE TABLE IF NOT EXISTS sessions (
                    id TEXT PRIMARY KEY NOT NULL,
                    book_id TEXT NOT NULL,
                    start_at TEXT NOT NULL,
                    end_at TEXT,
                    created_at TEXT NOT NULL,
                    updated_at TEXT NOT NULL,
                    FOREIGN KEY (book_id) REFERENCES books (id) ON DELETE CASCADE
                );

                CREATE INDEX IF NOT EXISTS idx_sessions_book_id ON sessions(book_id);
                CREATE INDEX IF NOT EXISTS idx_books_status ON books(status);
            "#,
            kind: MigrationKind::Up,
        },
    ];

    // Register the plugin with migrations
    app.plugin(
        tauri_plugin_sql::Builder::default()
            .add_migrations("sqlite:reading_tracker.db", migrations)
            .build(),
    )?;

    Ok(())
}

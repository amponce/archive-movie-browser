CREATE TABLE feedback (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  at INTEGER NOT NULL,
  kind TEXT NOT NULL,
  message TEXT NOT NULL,
  page TEXT
);
CREATE INDEX feedback_at ON feedback(at);

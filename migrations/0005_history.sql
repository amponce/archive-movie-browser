CREATE TABLE history (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  at INTEGER NOT NULL,
  kind TEXT NOT NULL,
  profile_id TEXT,
  channel_id TEXT,
  net TEXT,
  detail TEXT
);
CREATE INDEX history_at ON history(at);
CREATE INDEX history_profile ON history(profile_id);
CREATE INDEX history_net ON history(net, at);
CREATE INDEX history_kind ON history(kind, at);

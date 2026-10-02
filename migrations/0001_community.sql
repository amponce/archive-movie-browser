CREATE TABLE profiles (
  id TEXT PRIMARY KEY,
  key_hash TEXT NOT NULL,
  name TEXT NOT NULL DEFAULT '',
  archive_user TEXT NOT NULL DEFAULT '',
  agreed_at INTEGER,
  hidden INTEGER NOT NULL DEFAULT 0,
  created INTEGER NOT NULL,
  updated INTEGER NOT NULL
);
CREATE TABLE channels (
  id TEXT PRIMARY KEY,
  profile_id TEXT NOT NULL REFERENCES profiles(id),
  name TEXT NOT NULL,
  description TEXT NOT NULL DEFAULT '',
  status TEXT NOT NULL DEFAULT 'unlisted',
  submitted_at INTEGER,
  featured_at INTEGER,
  created INTEGER NOT NULL,
  updated INTEGER NOT NULL
);
CREATE INDEX channels_profile ON channels(profile_id);
CREATE INDEX channels_status ON channels(status);
CREATE TABLE channel_films (
  channel_id TEXT NOT NULL REFERENCES channels(id) ON DELETE CASCADE,
  film_id TEXT NOT NULL,
  position INTEGER NOT NULL,
  note TEXT NOT NULL DEFAULT '',
  flagged INTEGER NOT NULL DEFAULT 0,
  PRIMARY KEY (channel_id, film_id)
);
CREATE TABLE favourites (
  profile_id TEXT NOT NULL REFERENCES profiles(id),
  film_id TEXT NOT NULL,
  created INTEGER NOT NULL,
  PRIMARY KEY (profile_id, film_id)
);
CREATE TABLE channel_saves (
  profile_id TEXT NOT NULL REFERENCES profiles(id),
  channel_id TEXT NOT NULL REFERENCES channels(id) ON DELETE CASCADE,
  created INTEGER NOT NULL,
  PRIMARY KEY (profile_id, channel_id)
);
CREATE TABLE limits (
  bucket TEXT PRIMARY KEY,
  count INTEGER NOT NULL,
  until INTEGER NOT NULL
);

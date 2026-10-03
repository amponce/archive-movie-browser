ALTER TABLE profiles ADD COLUMN webauthn_user TEXT;
CREATE TABLE passkeys (
  credential_id TEXT PRIMARY KEY,
  profile_id TEXT NOT NULL REFERENCES profiles(id),
  public_key TEXT NOT NULL,
  counter INTEGER NOT NULL DEFAULT 0,
  transports TEXT NOT NULL DEFAULT '',
  created INTEGER NOT NULL
);
CREATE INDEX passkeys_profile ON passkeys(profile_id);
CREATE TABLE challenges (
  id TEXT PRIMARY KEY,
  kind TEXT NOT NULL,
  profile_id TEXT,
  until INTEGER NOT NULL
);

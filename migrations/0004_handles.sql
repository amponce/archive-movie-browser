ALTER TABLE profiles ADD COLUMN handle TEXT;
CREATE UNIQUE INDEX profiles_handle ON profiles(handle COLLATE NOCASE) WHERE handle IS NOT NULL;
CREATE TABLE handle_holds (
  handle TEXT PRIMARY KEY,
  profile_id TEXT NOT NULL REFERENCES profiles(id),
  until INTEGER NOT NULL
);

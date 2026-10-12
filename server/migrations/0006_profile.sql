-- The half-finished business of changing the number somebody signs in with: the old number has answered its code,
-- the new one has not yet. (The photo on a profile needs no column — `users.avatar_key` has been there from the
-- start.)

CREATE TABLE profile_mobile_changes (
  user_id TEXT PRIMARY KEY REFERENCES users(id) ON DELETE CASCADE,
  old_mobile TEXT NOT NULL,
  -- When the code sent to the number they sign in with today was answered.
  old_verified_at TEXT,
  -- The number they want to move to, once a code has been sent to it.
  pending_new_mobile TEXT,
  created_at TEXT NOT NULL,
  updated_at TEXT NOT NULL
);

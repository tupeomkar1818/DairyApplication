-- Signing in with a PIN instead of a code by SMS.
--
-- The first time somebody signs in they use their own mobile number as the password, and set a four-digit PIN
-- there and then; after that the PIN is the password. The PIN is never stored as it is — only its hash, salted
-- with the same pepper the sessions use.

ALTER TABLE users ADD COLUMN pin_hash TEXT;
ALTER TABLE users ADD COLUMN pin_set_at TEXT;
-- Wrong tries since the last right one, and until when the account is closed to further tries.
ALTER TABLE users ADD COLUMN pin_attempts INTEGER NOT NULL DEFAULT 0;
ALTER TABLE users ADD COLUMN pin_locked_until TEXT;

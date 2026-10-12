-- A push goes to one phone, and that phone is set to one language: the token carries which, so the evening
-- reminder reaches a Marathi phone in Marathi.

ALTER TABLE push_tokens ADD COLUMN language TEXT;

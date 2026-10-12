-- Announcements, chat and notifications carry a few fields the apps added after the first schema: who sent an
-- announcement and the day it is about, and when a notification was last touched. As everywhere else, columns stay
-- for what the server queries by and the rest rides in `details_json`.

ALTER TABLE announcements ADD COLUMN details_json TEXT NOT NULL DEFAULT '{}';

ALTER TABLE notifications ADD COLUMN updated_at TEXT;
ALTER TABLE notifications ADD COLUMN details_json TEXT NOT NULL DEFAULT '{}';

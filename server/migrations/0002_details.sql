-- The apps carry more fields per record than the server ever filters or sorts on (tax, stock alerts, preferred
-- payment mode, notes…). Those ride along in `details_json` and come back exactly as they were sent, so adding a
-- field to a screen does not need a migration. Columns stay for what the server queries by.

ALTER TABLE products ADD COLUMN price INTEGER NOT NULL DEFAULT 0;
ALTER TABLE products ADD COLUMN discount_price INTEGER;
ALTER TABLE products ADD COLUMN details_json TEXT NOT NULL DEFAULT '{}';

ALTER TABLE customers ADD COLUMN details_json TEXT NOT NULL DEFAULT '{}';

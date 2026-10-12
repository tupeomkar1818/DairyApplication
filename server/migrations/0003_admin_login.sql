-- The dairy's own login. Customers and delivery boys get theirs the first time they sign in, from the record the
-- admin created; the admin's has to be here from the start, or nobody could add anything.
--
-- The number is the one on the app's Contact us and on the website. Change it with:
--   wrangler d1 execute amrale-dairy --remote --command "update users set mobile = '<number>' where role = 'admin'"

INSERT INTO users (id, mobile, role, display_name, status, created_at, updated_at)
VALUES ('user_admin', '8208682688', 'admin', 'Amrale Dairy', 'Active', '2026-10-11T00:00:00.000Z', '2026-10-11T00:00:00.000Z');

-- Documentation only: the application's least-privilege MySQL user.
-- Run once as root. Replace the example password and put the real one in .env (DB_PASSWORD).
-- The user cannot INSERT, UPDATE or DELETE: every write goes through a stored procedure,
-- which runs with its DEFINER's privileges.

CREATE USER 'sinpe_app'@'localhost' IDENTIFIED BY 'change-me-example-password';
GRANT SELECT, EXECUTE ON sinpe_movil.* TO 'sinpe_app'@'localhost';

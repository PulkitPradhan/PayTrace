-- ============================================================================
-- PayTrace: Master Setup Script (Phases 1-3)
-- Executes schema, functions, triggers, procedures, indexes, and seed data.
-- ============================================================================

CREATE DATABASE IF NOT EXISTS `paytrace_db`
  DEFAULT CHARACTER SET utf8mb4
  COLLATE utf8mb4_unicode_ci;

USE `paytrace_db`;

SELECT 'Step 1/7: Loading schema...' AS progress;
SOURCE database/schema.sql;

SELECT 'Step 2/7: Loading stored functions...' AS progress;
SOURCE database/functions.sql;

SELECT 'Step 3/7: Loading triggers...' AS progress;
SOURCE database/triggers.sql;

SELECT 'Step 4/7: Loading stored procedures...' AS progress;
SOURCE database/procedures.sql;

SELECT 'Step 5/7: Installing performance indexes...' AS progress;
SOURCE database/indexes.sql;

SELECT 'Step 6/7: Loading seed dataset and executing procedural payroll calculation...' AS progress;
SOURCE database/seed.sql;

SELECT 'Step 7/7: Provisioning least-privilege database roles and views...' AS progress;
SOURCE database/security.sql;

SELECT 'Master database setup completed successfully.' AS status;

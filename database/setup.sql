-- ============================================================================
-- PayTrace: Master Setup Script (Phase 2)
-- Executes complete schema, functions, triggers, procedures, and seed data.
-- ============================================================================

CREATE DATABASE IF NOT EXISTS `paytrace_db`
  DEFAULT CHARACTER SET utf8mb4
  COLLATE utf8mb4_unicode_ci;

USE `paytrace_db`;

SELECT 'Step 1/5: Loading schema...' AS progress;
SOURCE database/schema.sql;

SELECT 'Step 2/5: Loading stored functions...' AS progress;
SOURCE database/functions.sql;

SELECT 'Step 3/5: Loading triggers...' AS progress;
SOURCE database/triggers.sql;

SELECT 'Step 4/5: Loading stored procedures...' AS progress;
SOURCE database/procedures.sql;

SELECT 'Step 5/5: Loading seed dataset and executing procedural payroll calculation...' AS progress;
SOURCE database/seed.sql;

SELECT 'Master database setup completed successfully.' AS status;

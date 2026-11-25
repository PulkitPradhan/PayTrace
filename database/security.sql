-- ============================================================================
-- PayTrace: Least-Privilege Database Security, Views & Roles (Phase 4)
-- Database Engine: MariaDB 13.0.2
-- Purpose:
--   1. Separates admin/DDL initialization privileges (root) from runtime
--      application credentials (paytrace_app).
--   2. Provisions restricted SQL views omitting sensitive fields (password_hash).
--   3. Demonstrates SQL roles, least-privilege GRANTs, and explicit REVOKE.
-- ============================================================================

USE `paytrace_db`;

-- ----------------------------------------------------------------------------
-- 1. Restricted Database Views (Non-sensitive projections)
-- ----------------------------------------------------------------------------
CREATE OR REPLACE VIEW `vw_employee_self_profile` AS
SELECT
    e.`employee_id`,
    e.`employee_code`,
    e.`first_name`,
    e.`last_name`,
    e.`email`,
    e.`phone`,
    d.`department_name`,
    e.`designation`,
    e.`role`,
    e.`hire_date`,
    e.`status`
FROM `employees` e
JOIN `departments` d ON e.`department_id` = d.`department_id`;

CREATE OR REPLACE VIEW `vw_employee_attendance_summary` AS
SELECT
    a.`attendance_id`,
    a.`employee_id`,
    e.`employee_code`,
    a.`work_date`,
    a.`status`,
    a.`check_in_time`,
    a.`check_out_time`,
    a.`is_late`,
    a.`late_minutes`,
    a.`remarks`
FROM `attendance` a
JOIN `employees` e ON a.`employee_id` = e.`employee_id`;

CREATE OR REPLACE VIEW `vw_employee_payslip_summary` AS
SELECT
    p.`payroll_id`,
    p.`employee_id`,
    e.`employee_code`,
    pp.`period_id`,
    pp.`period_name`,
    pp.`start_date`,
    pp.`end_date`,
    pp.`total_working_days`,
    p.`present_days`,
    p.`approved_paid_leave_days`,
    p.`unpaid_leave_days`,
    p.`late_days`,
    p.`gross_earnings`,
    p.`total_deductions`,
    p.`net_salary`,
    p.`payment_status`,
    p.`payment_date`,
    p.`processed_at`
FROM `payrolls` p
JOIN `employees` e ON p.`employee_id` = e.`employee_id`
JOIN `payroll_periods` pp ON p.`period_id` = pp.`period_id`;

-- ----------------------------------------------------------------------------
-- 2. Database Roles & Least-Privilege Runtime Account
-- ----------------------------------------------------------------------------
CREATE ROLE IF NOT EXISTS `paytrace_app_role`;
CREATE ROLE IF NOT EXISTS `paytrace_readonly_role`;

-- Application runtime role: strictly DML (SELECT/INSERT/UPDATE) + EXECUTE on paytrace_db only.
-- No DROP, ALTER, CREATE, DELETE, TRUNCATE, or global privileges.
GRANT SELECT ON `paytrace_db`.`departments` TO `paytrace_app_role`;
GRANT SELECT ON `paytrace_db`.`payroll_periods` TO `paytrace_app_role`;
GRANT SELECT, INSERT, UPDATE ON `paytrace_db`.`employees` TO `paytrace_app_role`;
GRANT SELECT, INSERT, UPDATE ON `paytrace_db`.`salary_structures` TO `paytrace_app_role`;
GRANT SELECT, INSERT, UPDATE ON `paytrace_db`.`attendance` TO `paytrace_app_role`;
GRANT SELECT, INSERT, UPDATE ON `paytrace_db`.`leaves` TO `paytrace_app_role`;
GRANT SELECT, INSERT, UPDATE ON `paytrace_db`.`payrolls` TO `paytrace_app_role`;
GRANT SELECT, INSERT ON `paytrace_db`.`payroll_items` TO `paytrace_app_role`;
GRANT SELECT, INSERT ON `paytrace_db`.`audit_logs` TO `paytrace_app_role`;

GRANT SELECT ON `paytrace_db`.`vw_employee_self_profile` TO `paytrace_app_role`;
GRANT SELECT ON `paytrace_db`.`vw_employee_attendance_summary` TO `paytrace_app_role`;
GRANT SELECT ON `paytrace_db`.`vw_employee_payslip_summary` TO `paytrace_app_role`;

GRANT EXECUTE ON PROCEDURE `paytrace_db`.`sp_calculate_payroll` TO `paytrace_app_role`;
GRANT EXECUTE ON PROCEDURE `paytrace_db`.`sp_process_bulk_payroll` TO `paytrace_app_role`;
GRANT EXECUTE ON PROCEDURE `paytrace_db`.`sp_demonstrate_transaction_rollback` TO `paytrace_app_role`;
GRANT EXECUTE ON FUNCTION `paytrace_db`.`fn_calculate_daily_rate` TO `paytrace_app_role`;
GRANT EXECUTE ON FUNCTION `paytrace_db`.`fn_calculate_monthly_tds` TO `paytrace_app_role`;
GRANT EXECUTE ON FUNCTION `paytrace_db`.`fn_count_working_days` TO `paytrace_app_role`;

-- Read-only reporting/audit role: restricted views only, no password_hash or write access
GRANT SELECT ON `paytrace_db`.`vw_employee_self_profile` TO `paytrace_readonly_role`;
GRANT SELECT ON `paytrace_db`.`vw_employee_attendance_summary` TO `paytrace_readonly_role`;
GRANT SELECT ON `paytrace_db`.`vw_employee_payslip_summary` TO `paytrace_readonly_role`;
GRANT SELECT, UPDATE ON `paytrace_db`.`payroll_periods` TO `paytrace_readonly_role`;
-- Demonstrate explicit REVOKE of write privilege
REVOKE UPDATE ON `paytrace_db`.`payroll_periods` FROM `paytrace_readonly_role`;

-- Provision application runtime user and read-only audit user
CREATE USER IF NOT EXISTS 'paytrace_app'@'127.0.0.1' IDENTIFIED BY 'PayTrace_App_2026!';
CREATE USER IF NOT EXISTS 'paytrace_app'@'localhost' IDENTIFIED BY 'PayTrace_App_2026!';
GRANT `paytrace_app_role` TO 'paytrace_app'@'127.0.0.1';
GRANT `paytrace_app_role` TO 'paytrace_app'@'localhost';
SET DEFAULT ROLE `paytrace_app_role` FOR 'paytrace_app'@'127.0.0.1';
SET DEFAULT ROLE `paytrace_app_role` FOR 'paytrace_app'@'localhost';

CREATE USER IF NOT EXISTS 'paytrace_reader'@'127.0.0.1' IDENTIFIED BY 'PayTrace_Read_2026!';
CREATE USER IF NOT EXISTS 'paytrace_reader'@'localhost' IDENTIFIED BY 'PayTrace_Read_2026!';
GRANT `paytrace_readonly_role` TO 'paytrace_reader'@'127.0.0.1';
GRANT `paytrace_readonly_role` TO 'paytrace_reader'@'localhost';
SET DEFAULT ROLE `paytrace_readonly_role` FOR 'paytrace_reader'@'127.0.0.1';
SET DEFAULT ROLE `paytrace_readonly_role` FOR 'paytrace_reader'@'localhost';

FLUSH PRIVILEGES;

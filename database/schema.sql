-- ============================================================================
-- PayTrace: Relational Database Schema (Phase 1)
-- Database Engine: MariaDB / MySQL (InnoDB Engine)
-- Target: Academic Capstone Project - Payroll & Attendance Management System
-- ============================================================================

-- Ensure consistent charset and collation
SET NAMES utf8mb4;
SET foreign_key_checks = 0;

-- ----------------------------------------------------------------------------
-- 1. Entity: departments
-- Purpose: Normalized store of organizational departments.
-- ----------------------------------------------------------------------------
DROP TABLE IF EXISTS `departments`;
CREATE TABLE `departments` (
    `department_id` INT AUTO_INCREMENT PRIMARY KEY,
    `department_name` VARCHAR(50) NOT NULL,
    `description` VARCHAR(255) NULL,
    `created_at` TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT `uq_department_name` UNIQUE (`department_name`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- ----------------------------------------------------------------------------
-- 2. Entity: employees
-- Purpose: Master employee record with organizational, role, and auth credentials.
-- ----------------------------------------------------------------------------
DROP TABLE IF EXISTS `employees`;
CREATE TABLE `employees` (
    `employee_id` INT AUTO_INCREMENT PRIMARY KEY,
    `employee_code` VARCHAR(20) NOT NULL,
    `first_name` VARCHAR(50) NOT NULL,
    `last_name` VARCHAR(50) NOT NULL,
    `email` VARCHAR(100) NOT NULL,
    `phone` VARCHAR(20) NULL,
    `department_id` INT NOT NULL,
    `designation` VARCHAR(50) NOT NULL,
    `role` ENUM('HR_ADMIN', 'EMPLOYEE') NOT NULL DEFAULT 'EMPLOYEE',
    `password_hash` VARCHAR(255) NOT NULL,
    `hire_date` DATE NOT NULL,
    `status` ENUM('ACTIVE', 'INACTIVE', 'TERMINATED') NOT NULL DEFAULT 'ACTIVE',
    `created_at` TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
    `updated_at` TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
    CONSTRAINT `uq_employee_code` UNIQUE (`employee_code`),
    CONSTRAINT `uq_employee_email` UNIQUE (`email`),
    CONSTRAINT `fk_employees_department` FOREIGN KEY (`department_id`) 
        REFERENCES `departments` (`department_id`) ON DELETE RESTRICT ON UPDATE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- ----------------------------------------------------------------------------
-- 3. Entity: salary_structures
-- Purpose: Effective-dated salary component configuration per employee.
-- ----------------------------------------------------------------------------
DROP TABLE IF EXISTS `salary_structures`;
CREATE TABLE `salary_structures` (
    `salary_id` INT AUTO_INCREMENT PRIMARY KEY,
    `employee_id` INT NOT NULL,
    `basic_salary` DECIMAL(10,2) NOT NULL,
    `hra` DECIMAL(10,2) NOT NULL DEFAULT 0.00,
    `special_allowance` DECIMAL(10,2) NOT NULL DEFAULT 0.00,
    `provident_fund` DECIMAL(10,2) NOT NULL DEFAULT 0.00,
    `professional_tax` DECIMAL(10,2) NOT NULL DEFAULT 0.00,
    `effective_date` DATE NOT NULL,
    `is_active` BOOLEAN NOT NULL DEFAULT TRUE,
    `created_at` TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
    `updated_at` TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
    CONSTRAINT `fk_salary_employee` FOREIGN KEY (`employee_id`) 
        REFERENCES `employees` (`employee_id`) ON DELETE CASCADE ON UPDATE CASCADE,
    CONSTRAINT `chk_salary_basic` CHECK (`basic_salary` >= 0.00),
    CONSTRAINT `chk_salary_hra` CHECK (`hra` >= 0.00),
    CONSTRAINT `chk_salary_special` CHECK (`special_allowance` >= 0.00),
    CONSTRAINT `chk_salary_pf` CHECK (`provident_fund` >= 0.00),
    CONSTRAINT `chk_salary_pt` CHECK (`professional_tax` >= 0.00)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- ----------------------------------------------------------------------------
-- 4. Entity: attendance
-- Purpose: Daily attendance log per employee with time tracking and late flags.
-- ----------------------------------------------------------------------------
DROP TABLE IF EXISTS `attendance`;
CREATE TABLE `attendance` (
    `attendance_id` INT AUTO_INCREMENT PRIMARY KEY,
    `employee_id` INT NOT NULL,
    `work_date` DATE NOT NULL,
    `status` ENUM('PRESENT', 'ABSENT', 'HALF_DAY', 'ON_LEAVE') NOT NULL,
    `check_in_time` TIME NULL,
    `check_out_time` TIME NULL,
    `is_late` BOOLEAN NOT NULL DEFAULT FALSE,
    `late_minutes` INT NOT NULL DEFAULT 0,
    `remarks` VARCHAR(255) NULL,
    `created_at` TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
    `updated_at` TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
    CONSTRAINT `uq_emp_work_date` UNIQUE (`employee_id`, `work_date`),
    CONSTRAINT `fk_attendance_employee` FOREIGN KEY (`employee_id`) 
        REFERENCES `employees` (`employee_id`) ON DELETE CASCADE ON UPDATE CASCADE,
    CONSTRAINT `chk_attendance_late_min` CHECK (`late_minutes` >= 0)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- ----------------------------------------------------------------------------
-- 5. Entity: leaves
-- Purpose: Leave requests, approvals, and day count tracking per employee.
-- ----------------------------------------------------------------------------
DROP TABLE IF EXISTS `leaves`;
CREATE TABLE `leaves` (
    `leave_id` INT AUTO_INCREMENT PRIMARY KEY,
    `employee_id` INT NOT NULL,
    `leave_type` ENUM('CASUAL', 'SICK', 'PAID', 'UNPAID') NOT NULL,
    `start_date` DATE NOT NULL,
    `end_date` DATE NOT NULL,
    `total_days` DECIMAL(4,1) NOT NULL,
    `reason` VARCHAR(255) NOT NULL,
    `status` ENUM('PENDING', 'APPROVED', 'REJECTED', 'CANCELLED') NOT NULL DEFAULT 'PENDING',
    `applied_on` TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
    `actioned_by` INT NULL,
    `actioned_on` TIMESTAMP NULL,
    `admin_remarks` VARCHAR(255) NULL,
    CONSTRAINT `fk_leaves_employee` FOREIGN KEY (`employee_id`) 
        REFERENCES `employees` (`employee_id`) ON DELETE CASCADE ON UPDATE CASCADE,
    CONSTRAINT `fk_leaves_actioned_by` FOREIGN KEY (`actioned_by`) 
        REFERENCES `employees` (`employee_id`) ON DELETE SET NULL ON UPDATE CASCADE,
    CONSTRAINT `chk_leave_dates` CHECK (`start_date` <= `end_date`),
    CONSTRAINT `chk_leave_total_days` CHECK (`total_days` > 0.0)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- ----------------------------------------------------------------------------
-- 6. Entity: payroll_periods
-- Purpose: Designated monthly payroll cycles and calendar working days.
-- ----------------------------------------------------------------------------
DROP TABLE IF EXISTS `payroll_periods`;
CREATE TABLE `payroll_periods` (
    `period_id` INT AUTO_INCREMENT PRIMARY KEY,
    `period_name` VARCHAR(30) NOT NULL,
    `start_date` DATE NOT NULL,
    `end_date` DATE NOT NULL,
    `total_working_days` INT NOT NULL,
    `status` ENUM('OPEN', 'PROCESSING', 'FINALIZED', 'CLOSED') NOT NULL DEFAULT 'OPEN',
    `created_at` TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT `uq_period_name` UNIQUE (`period_name`),
    CONSTRAINT `chk_period_dates` CHECK (`start_date` <= `end_date`),
    CONSTRAINT `chk_period_working_days` CHECK (`total_working_days` > 0)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- ----------------------------------------------------------------------------
-- 7. Entity: payrolls
-- Purpose: Finalized payroll summary and audit snapshot per employee per period.
-- ----------------------------------------------------------------------------
DROP TABLE IF EXISTS `payrolls`;
CREATE TABLE `payrolls` (
    `payroll_id` INT AUTO_INCREMENT PRIMARY KEY,
    `employee_id` INT NOT NULL,
    `period_id` INT NOT NULL,
    `salary_id` INT NOT NULL,
    `present_days` DECIMAL(4,1) NOT NULL DEFAULT 0.0,
    `approved_paid_leave_days` DECIMAL(4,1) NOT NULL DEFAULT 0.0,
    `unpaid_leave_days` DECIMAL(4,1) NOT NULL DEFAULT 0.0,
    `late_days` INT NOT NULL DEFAULT 0,
    `gross_earnings` DECIMAL(10,2) NOT NULL,
    `total_deductions` DECIMAL(10,2) NOT NULL,
    `net_salary` DECIMAL(10,2) NOT NULL,
    `payment_status` ENUM('CALCULATED', 'PROCESSED', 'PAID') NOT NULL DEFAULT 'CALCULATED',
    `processed_by` INT NOT NULL,
    `processed_at` TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
    `payment_date` DATE NULL,
    `remarks` VARCHAR(255) NULL,
    CONSTRAINT `uq_emp_payroll_period` UNIQUE (`employee_id`, `period_id`),
    CONSTRAINT `fk_payrolls_employee` FOREIGN KEY (`employee_id`) 
        REFERENCES `employees` (`employee_id`) ON DELETE RESTRICT ON UPDATE CASCADE,
    CONSTRAINT `fk_payrolls_period` FOREIGN KEY (`period_id`) 
        REFERENCES `payroll_periods` (`period_id`) ON DELETE RESTRICT ON UPDATE CASCADE,
    CONSTRAINT `fk_payrolls_salary` FOREIGN KEY (`salary_id`) 
        REFERENCES `salary_structures` (`salary_id`) ON DELETE RESTRICT ON UPDATE CASCADE,
    CONSTRAINT `fk_payrolls_processed_by` FOREIGN KEY (`processed_by`) 
        REFERENCES `employees` (`employee_id`) ON DELETE RESTRICT ON UPDATE CASCADE,
    CONSTRAINT `chk_payroll_gross` CHECK (`gross_earnings` >= 0.00),
    CONSTRAINT `chk_payroll_deductions` CHECK (`total_deductions` >= 0.00),
    CONSTRAINT `chk_payroll_net` CHECK (`net_salary` >= 0.00),
    CONSTRAINT `chk_payroll_present_days` CHECK (`present_days` >= 0.0),
    CONSTRAINT `chk_payroll_unpaid_days` CHECK (`unpaid_leave_days` >= 0.0),
    CONSTRAINT `chk_payroll_late_days` CHECK (`late_days` >= 0)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- ----------------------------------------------------------------------------
-- 8. Entity: payroll_items
-- Purpose: Itemized line-item breakdown of earnings and deductions per payroll.
-- ----------------------------------------------------------------------------
DROP TABLE IF EXISTS `payroll_items`;
CREATE TABLE `payroll_items` (
    `item_id` INT AUTO_INCREMENT PRIMARY KEY,
    `payroll_id` INT NOT NULL,
    `item_type` ENUM('EARNING', 'DEDUCTION') NOT NULL,
    `item_name` VARCHAR(50) NOT NULL,
    `amount` DECIMAL(10,2) NOT NULL,
    `description` VARCHAR(255) NULL,
    `created_at` TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT `fk_payroll_items_payroll` FOREIGN KEY (`payroll_id`) 
        REFERENCES `payrolls` (`payroll_id`) ON DELETE CASCADE ON UPDATE CASCADE,
    CONSTRAINT `chk_payroll_item_amount` CHECK (`amount` >= 0.00)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- ----------------------------------------------------------------------------
-- 9. Entity: audit_logs
-- Purpose: Immutable security audit log tracking critical mutations.
-- ----------------------------------------------------------------------------
DROP TABLE IF EXISTS `audit_logs`;
CREATE TABLE `audit_logs` (
    `log_id` INT AUTO_INCREMENT PRIMARY KEY,
    `table_name` VARCHAR(50) NOT NULL,
    `record_id` INT NOT NULL,
    `action` ENUM('INSERT', 'UPDATE', 'DELETE') NOT NULL,
    `actor_employee_id` INT NULL,
    `old_values` LONGTEXT NULL,
    `new_values` LONGTEXT NULL,
    `ip_address` VARCHAR(45) NULL,
    `created_at` TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT `fk_audit_actor` FOREIGN KEY (`actor_employee_id`) 
        REFERENCES `employees` (`employee_id`) ON DELETE SET NULL ON UPDATE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

SET foreign_key_checks = 1;

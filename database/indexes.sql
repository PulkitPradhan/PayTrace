-- ============================================================================
-- PayTrace: Performance Optimization Indexes (Phase 3)
-- Database Engine: MariaDB / MySQL
-- ============================================================================

-- ----------------------------------------------------------------------------
-- 1. Index: idx_attendance_late_lookup
-- Target Table: attendance
-- Columns: (is_late, work_date, late_minutes)
-- Rationale:
--   Optimizes Report 3 (Late-Marks Report). Reverses join order so that
--   attendance becomes the driving range table filtering directly on
--   is_late = TRUE and date interval, eliminating the temporary table.
-- ----------------------------------------------------------------------------
CREATE INDEX IF NOT EXISTS `idx_attendance_late_lookup` 
ON `attendance` (`is_late`, `work_date`, `late_minutes`);

-- ----------------------------------------------------------------------------
-- 2. Index: idx_attendance_period_summary
-- Target Table: attendance
-- Columns: (work_date, status)
-- Rationale:
--   Optimizes Report 1 (Monthly Attendance Summary). Accelerates range scans
--   over work_date between start_date and end_date while accessing status.
-- ----------------------------------------------------------------------------
CREATE INDEX IF NOT EXISTS `idx_attendance_period_summary` 
ON `attendance` (`work_date`, `status`);

-- ----------------------------------------------------------------------------
-- 3. Index: idx_payrolls_period_employee
-- Target Table: payrolls
-- Columns: (period_id, employee_id)
-- Rationale:
--   Accelerates period-level payroll queries and reporting. The unique key
--   uq_emp_payroll_period has employee_id as leading column; this index
--   allows efficient queries filtering strictly on period_id.
-- ----------------------------------------------------------------------------
CREATE INDEX IF NOT EXISTS `idx_payrolls_period_employee` 
ON `payrolls` (`period_id`, `employee_id`);

-- ----------------------------------------------------------------------------
-- 4. Index: idx_leaves_emp_status_dates
-- Target Table: leaves
-- Columns: (employee_id, status, start_date, end_date)
-- Rationale:
--   Accelerates leave overlap verification triggers and pro-rata leave queries
--   during monthly payroll execution.
-- ----------------------------------------------------------------------------
CREATE INDEX IF NOT EXISTS `idx_leaves_emp_status_dates` 
ON `leaves` (`employee_id`, `status`, `start_date`, `end_date`);

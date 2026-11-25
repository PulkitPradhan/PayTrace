-- ============================================================================
-- PayTrace: Performance Optimization Indexes (Phase 3)
-- Database Engine: MariaDB / MySQL
-- ============================================================================

-- ----------------------------------------------------------------------------
-- 1. Index: idx_attendance_late_lookup
-- Target Table: attendance
-- Columns: (is_late, work_date)
-- Rationale:
--   Optimizes Report 3 (Late-Marks Report). Drives the query via an index
--   range scan on is_late = TRUE and work_date BETWEEN start_date AND end_date,
--   eliminating intermediate temporary-table materialization. (Note: filesort
--   remains for ORDER BY late_minutes DESC, work_date ASC over the filtered rows
--   because work_date is a range predicate.)
-- ----------------------------------------------------------------------------
CREATE INDEX IF NOT EXISTS `idx_attendance_late_lookup`
ON `attendance` (`is_late`, `work_date`);

-- ----------------------------------------------------------------------------
-- 2. Index: idx_attendance_period_summary
-- Target Table: attendance
-- Columns: (work_date, employee_id, status, is_late)
-- Rationale:
--   Covers period-wide attendance date-range filters and aggregations
--   (Report 1 and GET /api/attendance?periodId=...) without scanning full rows
--   when driving by work_date range.
-- ----------------------------------------------------------------------------
CREATE INDEX IF NOT EXISTS `idx_attendance_period_summary`
ON `attendance` (`work_date`, `employee_id`, `status`, `is_late`);

-- ----------------------------------------------------------------------------
-- 3. Index: idx_leaves_emp_status_dates
-- Target Table: leaves
-- Columns: (employee_id, status, start_date, end_date)
-- Rationale:
--   Accelerates leave overlap verification triggers and period-bounded leave
--   aggregation during sp_calculate_payroll.
-- ----------------------------------------------------------------------------
CREATE INDEX IF NOT EXISTS `idx_leaves_emp_status_dates`
ON `leaves` (`employee_id`, `status`, `start_date`, `end_date`);

-- ----------------------------------------------------------------------------
-- 4. Index: idx_salary_emp_effective
-- Target Table: salary_structures
-- Columns: (employee_id, effective_date)
-- Rationale:
--   Accelerates effective-dated salary lookups (effective_date <= period_end
--   ORDER BY effective_date DESC LIMIT 1) in sp_calculate_payroll.
-- ----------------------------------------------------------------------------
CREATE INDEX IF NOT EXISTS `idx_salary_emp_effective`
ON `salary_structures` (`employee_id`, `effective_date`);

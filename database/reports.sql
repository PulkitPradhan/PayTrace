-- ============================================================================
-- PayTrace: Mandatory & Analytical Reports (Phase 3)
-- Database Engine: MariaDB / MySQL
-- ============================================================================

-- ----------------------------------------------------------------------------
-- REPORT 1: Monthly Attendance Summary
-- Parameter: :period_id (e.g. 2 for July 2026)
-- Purpose:
--   Aggregates employee attendance metrics across a designated payroll period.
--   - Counts PRESENT = 1.0, HALF_DAY = 0.5 toward days_present.
--   - Counts ABSENT = 1.0, HALF_DAY = 0.5 toward days_absent.
--   - Preserves historical records for employees who were active during or
--     have attendance entries in the period, even if later marked inactive.
--   - attendance_percentage = ROUND((days_present / total_working_days) * 100, 1).
-- ----------------------------------------------------------------------------
SET @report_period_id = 2;

SELECT
    e.employee_id,
    e.employee_code,
    CONCAT(e.first_name, ' ', e.last_name) AS full_name,
    d.department_name,
    e.designation,
    pp.period_name,
    pp.total_working_days,
    COALESCE(SUM(CASE WHEN a.status = 'PRESENT' THEN 1.0 WHEN a.status = 'HALF_DAY' THEN 0.5 ELSE 0.0 END), 0.0) AS days_present,
    COALESCE(SUM(CASE WHEN a.status = 'ABSENT' THEN 1.0 WHEN a.status = 'HALF_DAY' THEN 0.5 ELSE 0.0 END), 0.0) AS days_absent,
    COALESCE(SUM(CASE WHEN a.status = 'HALF_DAY' THEN 1 ELSE 0 END), 0) AS half_days,
    COALESCE(SUM(CASE WHEN a.status = 'ON_LEAVE' THEN 1.0 ELSE 0.0 END), 0.0) AS days_on_leave,
    COALESCE(SUM(CASE WHEN a.is_late = TRUE AND a.status IN ('PRESENT', 'HALF_DAY') AND a.check_in_time IS NOT NULL THEN 1 ELSE 0 END), 0) AS late_marks,
    ROUND(
        COALESCE(SUM(CASE WHEN a.status = 'PRESENT' THEN 1.0 WHEN a.status = 'HALF_DAY' THEN 0.5 ELSE 0.0 END), 0.0)
        / NULLIF(pp.total_working_days, 0) * 100,
        1
    ) AS attendance_percentage
FROM employees e
JOIN departments d ON e.department_id = d.department_id
JOIN payroll_periods pp ON pp.period_id = @report_period_id
LEFT JOIN attendance a ON e.employee_id = a.employee_id
                      AND a.work_date BETWEEN pp.start_date AND pp.end_date
WHERE e.hire_date <= pp.end_date
  AND (
      e.status = 'ACTIVE'
      OR EXISTS (
          SELECT 1
          FROM attendance ax
          WHERE ax.employee_id = e.employee_id
            AND ax.work_date BETWEEN pp.start_date AND pp.end_date
      )
  )
GROUP BY
    e.employee_id, e.employee_code, e.first_name, e.last_name,
    d.department_name, e.designation, pp.period_name, pp.total_working_days
ORDER BY e.employee_id ASC;

-- ----------------------------------------------------------------------------
-- REPORT 2: Itemized Salary Slip per Employee
-- Parameters: :employee_id (e.g. 4), :period_id (e.g. 2)
-- Purpose:
--   Retrieves the immutable finalized payroll record and normalized line-item
--   components. Historical snapshot values are preserved without dynamic
--   recalculation.
-- ----------------------------------------------------------------------------
SET @slip_employee_id = 4;
SET @slip_period_id = 2;

-- Query 2A: Slip Header and Master Snapshot
SELECT
    p.payroll_id,
    p.employee_id,
    e.employee_code,
    CONCAT(e.first_name, ' ', e.last_name) AS full_name,
    e.email,
    d.department_name,
    e.designation,
    pp.period_id,
    pp.period_name,
    pp.start_date,
    pp.end_date,
    pp.total_working_days,
    p.present_days,
    p.approved_paid_leave_days,
    p.unpaid_leave_days,
    p.late_days,
    p.gross_earnings,
    p.total_deductions,
    p.net_salary,
    p.payment_status,
    p.payment_date,
    p.processed_at,
    p.remarks
FROM payrolls p
JOIN employees e ON p.employee_id = e.employee_id
JOIN departments d ON e.department_id = d.department_id
JOIN payroll_periods pp ON p.period_id = pp.period_id
WHERE p.employee_id = @slip_employee_id
  AND p.period_id = @slip_period_id;

-- Query 2B: Itemized Line-Item Breakdown
SELECT
    pi.item_id,
    pi.item_type,
    pi.item_name,
    pi.amount,
    pi.description
FROM payroll_items pi
JOIN payrolls p ON pi.payroll_id = p.payroll_id
WHERE p.employee_id = @slip_employee_id
  AND p.period_id = @slip_period_id
ORDER BY pi.item_type DESC, pi.item_id ASC;

-- ----------------------------------------------------------------------------
-- REPORT 3: Late-Marks Report
-- Parameter: :period_id (e.g. 2 for July 2026)
-- Purpose:
--   Identifies employees with tardy arrivals (> 09:15:00) within the period,
--   excluding invalid NULL check-ins and non-working statuses.
-- ----------------------------------------------------------------------------
SET @late_period_id = 2;

SELECT
    e.employee_id,
    e.employee_code,
    CONCAT(e.first_name, ' ', e.last_name) AS full_name,
    d.department_name,
    e.designation,
    a.work_date,
    a.check_in_time,
    a.late_minutes,
    a.remarks
FROM attendance a
JOIN employees e ON a.employee_id = e.employee_id
JOIN departments d ON e.department_id = d.department_id
JOIN payroll_periods pp ON pp.period_id = @late_period_id
WHERE a.work_date BETWEEN pp.start_date AND pp.end_date
  AND a.is_late = TRUE
  AND a.check_in_time IS NOT NULL
  AND a.status IN ('PRESENT', 'HALF_DAY')
ORDER BY a.late_minutes DESC, a.work_date ASC, a.attendance_id ASC;

-- ----------------------------------------------------------------------------
-- REPORT 4: Departmental Payroll Summary
-- Parameter: :period_id (e.g. 2 for July 2026)
-- Purpose:
--   Organizational aggregation of payroll expenses per department.
-- ----------------------------------------------------------------------------
SELECT
    d.department_name,
    COUNT(p.payroll_id) AS employee_count,
    SUM(p.gross_earnings) AS total_gross_earnings,
    SUM(p.total_deductions) AS total_deductions,
    SUM(p.net_salary) AS total_net_disbursed,
    ROUND(AVG(p.net_salary), 2) AS average_net_salary
FROM payrolls p
JOIN employees e ON p.employee_id = e.employee_id
JOIN departments d ON e.department_id = d.department_id
WHERE p.period_id = @report_period_id
GROUP BY d.department_id, d.department_name
ORDER BY total_net_disbursed DESC;

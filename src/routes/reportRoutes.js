const express = require('express');
const pool = require('../config/db');
const { authenticateToken, requireRole } = require('../middleware/auth');

const router = express.Router();
router.use(authenticateToken);
router.use(requireRole('HR_ADMIN'));

function parsePositiveInt(val) {
  if (val === undefined) return 2;
  if (typeof val !== 'string' || !/^\d+$/.test(val.trim())) return null;
  const n = Number(val.trim());
  return Number.isSafeInteger(n) && n > 0 ? n : null;
}

async function ensurePeriodExists(periodId) {
  const [rows] = await pool.query('SELECT period_id FROM payroll_periods WHERE period_id = ?', [periodId]);
  return rows.length > 0;
}

// GET /api/reports/attendance-summary?periodId=2
router.get('/attendance-summary', async (req, res) => {
  const periodId = parsePositiveInt(req.query.periodId);
  if (!periodId) {
    return res.status(400).json({ success: false, error: 'Invalid periodId parameter.' });
  }

  try {
    if (!(await ensurePeriodExists(periodId))) {
      return res.status(404).json({ success: false, error: 'Payroll period not found.' });
    }

    const [rows] = await pool.query(
      `SELECT
        e.employee_id, e.employee_code,
        CONCAT(e.first_name, ' ', e.last_name) AS full_name,
        d.department_name, e.designation, pp.period_name, pp.total_working_days,
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
       JOIN payroll_periods pp ON pp.period_id = ?
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
       GROUP BY e.employee_id, e.employee_code, e.first_name, e.last_name, d.department_name, e.designation, pp.period_name, pp.total_working_days
       ORDER BY e.employee_id ASC`,
      [periodId]
    );

    res.json({ success: true, period_id: periodId, count: rows.length, summary: rows });
  } catch (err) {
    console.error('Attendance summary report error:', err);
    res.status(500).json({ success: false, error: 'Failed to generate attendance summary.' });
  }
});

// GET /api/reports/late-marks?periodId=2
router.get('/late-marks', async (req, res) => {
  const periodId = parsePositiveInt(req.query.periodId);
  if (!periodId) {
    return res.status(400).json({ success: false, error: 'Invalid periodId parameter.' });
  }

  try {
    if (!(await ensurePeriodExists(periodId))) {
      return res.status(404).json({ success: false, error: 'Payroll period not found.' });
    }

    const [rows] = await pool.query(
      `SELECT
        e.employee_id, e.employee_code,
        CONCAT(e.first_name, ' ', e.last_name) AS full_name,
        d.department_name, e.designation,
        a.work_date, a.check_in_time, a.late_minutes, a.remarks
       FROM attendance a
       JOIN employees e ON a.employee_id = e.employee_id
       JOIN departments d ON e.department_id = d.department_id
       JOIN payroll_periods pp ON pp.period_id = ?
       WHERE a.work_date BETWEEN pp.start_date AND pp.end_date
         AND a.is_late = TRUE
         AND a.check_in_time IS NOT NULL
         AND a.status IN ('PRESENT', 'HALF_DAY')
       ORDER BY a.late_minutes DESC, a.work_date ASC, a.attendance_id ASC`,
      [periodId]
    );

    res.json({ success: true, period_id: periodId, count: rows.length, late_marks: rows });
  } catch (err) {
    console.error('Late marks report error:', err);
    res.status(500).json({ success: false, error: 'Failed to generate late marks report.' });
  }
});

// GET /api/reports/departmental?periodId=2
router.get('/departmental', async (req, res) => {
  const periodId = parsePositiveInt(req.query.periodId);
  if (!periodId) {
    return res.status(400).json({ success: false, error: 'Invalid periodId parameter.' });
  }

  try {
    if (!(await ensurePeriodExists(periodId))) {
      return res.status(404).json({ success: false, error: 'Payroll period not found.' });
    }

    const [rows] = await pool.query(
      `SELECT
        d.department_name,
        COUNT(p.payroll_id) AS employee_count,
        SUM(p.gross_earnings) AS total_gross_earnings,
        SUM(p.total_deductions) AS total_deductions,
        SUM(p.net_salary) AS total_net_disbursed,
        ROUND(AVG(p.net_salary), 2) AS average_net_salary
       FROM payrolls p
       JOIN employees e ON p.employee_id = e.employee_id
       JOIN departments d ON e.department_id = d.department_id
       WHERE p.period_id = ?
       GROUP BY d.department_id, d.department_name
       ORDER BY total_net_disbursed DESC`,
      [periodId]
    );

    res.json({ success: true, period_id: periodId, departments: rows });
  } catch (err) {
    console.error('Departmental report error:', err);
    res.status(500).json({ success: false, error: 'Failed to generate departmental report.' });
  }
});

module.exports = router;

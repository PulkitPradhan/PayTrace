const express = require('express');
const pool = require('../config/db');
const { authenticateToken, requireRole, enforceSelfOrAdmin } = require('../middleware/auth');

const router = express.Router();
router.use(authenticateToken);

// GET /api/attendance (HR_ADMIN sees all or filters; Employee forced to own ID)
router.get('/', async (req, res) => {
  let { employeeId, periodId, startDate, endDate } = req.query;

  // Enforce self-access for employees; reject attempts to query other employees
  if (req.user.role !== 'HR_ADMIN') {
    if (employeeId && parseInt(employeeId, 10) !== req.user.employee_id) {
      return res.status(403).json({
        success: false,
        error: 'Access denied: Employees can access only their own authorized records.'
      });
    }
    employeeId = req.user.employee_id;
  }

  try {
    let query = `
      SELECT 
        a.attendance_id, a.employee_id, e.employee_code,
        CONCAT(e.first_name, ' ', e.last_name) AS full_name,
        d.department_name, a.work_date, a.status,
        a.check_in_time, a.check_out_time, a.is_late, a.late_minutes, a.remarks
      FROM attendance a
      JOIN employees e ON a.employee_id = e.employee_id
      JOIN departments d ON e.department_id = d.department_id
      WHERE 1=1
    `;
    const params = [];

    if (employeeId) {
      query += ' AND a.employee_id = ?';
      params.push(employeeId);
    }

    if (periodId) {
      query += ' AND a.work_date BETWEEN (SELECT start_date FROM payroll_periods WHERE period_id = ?) AND (SELECT end_date FROM payroll_periods WHERE period_id = ?)';
      params.push(periodId, periodId);
    } else if (startDate && endDate) {
      query += ' AND a.work_date BETWEEN ? AND ?';
      params.push(startDate, endDate);
    }

    query += ' ORDER BY a.work_date DESC, a.check_in_time DESC LIMIT 500';

    const [rows] = await pool.query(query, params);
    res.json({ success: true, count: rows.length, attendance: rows });
  } catch (err) {
    console.error('Attendance list error:', err);
    res.status(500).json({ success: false, error: 'Database query failed.' });
  }
});

// POST /api/attendance/clock-in (Self-service check in)
router.post('/clock-in', async (req, res) => {
  const employeeId = req.user.employee_id;
  const now = new Date();
  const workDate = now.toISOString().split('T')[0];
  const timeString = now.toTimeString().split(' ')[0];

  try {
    const [resInsert] = await pool.query(
      `INSERT INTO attendance (employee_id, work_date, status, check_in_time, remarks)
       VALUES (?, ?, 'PRESENT', ?, 'Self-service web clock-in')
       ON DUPLICATE KEY UPDATE check_out_time = VALUES(check_in_time), remarks = CONCAT(remarks, ' | Clock-out recorded')`,
      [employeeId, workDate, timeString]
    );

    // Retrieve the calculated row
    const [row] = await pool.query(
      'SELECT attendance_id, work_date, status, check_in_time, check_out_time, is_late, late_minutes FROM attendance WHERE employee_id = ? AND work_date = ?',
      [employeeId, workDate]
    );

    res.json({
      success: true,
      message: 'Attendance record registered successfully.',
      record: row[0]
    });
  } catch (err) {
    console.error('Clock in error:', err);
    if (err.message.includes('approved leave')) {
      return res.status(400).json({ success: false, error: 'Cannot clock in: You are scheduled on approved leave today.' });
    }
    res.status(500).json({ success: false, error: err.message || 'Clock-in failed.' });
  }
});

module.exports = router;

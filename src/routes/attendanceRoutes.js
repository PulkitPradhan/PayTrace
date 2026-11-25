const express = require('express');
const pool = require('../config/db');
const { authenticateToken, verifyCsrf, requireRole, parsePositiveInt } = require('../middleware/auth');
const { isValidDateString, isValidTimeString } = require('../utils/validators');

const router = express.Router();
router.use(authenticateToken);
router.use(verifyCsrf);

// GET /api/attendance (HR_ADMIN sees all or filters; Employee forced to own ID)
router.get('/', async (req, res) => {
  let { employeeId, periodId, startDate, endDate } = req.query;

  if (employeeId !== undefined && employeeId !== '') {
    const parsedEmp = parsePositiveInt(employeeId);
    if (!parsedEmp) {
      return res.status(400).json({ success: false, error: 'Invalid employeeId filter.' });
    }
    if (req.user.role !== 'HR_ADMIN' && parsedEmp !== req.user.employee_id) {
      return res.status(403).json({
        success: false,
        error: 'Access denied: Employees can access only their own authorized records.'
      });
    }
    employeeId = parsedEmp;
  } else if (req.user.role !== 'HR_ADMIN') {
    employeeId = req.user.employee_id;
  } else {
    employeeId = null;
  }

  let parsedPeriodId = null;
  if (periodId !== undefined && periodId !== '') {
    parsedPeriodId = parsePositiveInt(periodId);
    if (!parsedPeriodId) {
      return res.status(400).json({ success: false, error: 'Invalid periodId filter.' });
    }
  }

  if ((startDate && !isValidDateString(startDate)) || (endDate && !isValidDateString(endDate))) {
    return res.status(400).json({ success: false, error: 'Invalid startDate or endDate format (YYYY-MM-DD).' });
  }
  if (startDate && endDate && startDate > endDate) {
    return res.status(400).json({ success: false, error: 'startDate cannot be after endDate.' });
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

    if (parsedPeriodId) {
      query += ' AND a.work_date BETWEEN (SELECT start_date FROM payroll_periods WHERE period_id = ?) AND (SELECT end_date FROM payroll_periods WHERE period_id = ?)';
      params.push(parsedPeriodId, parsedPeriodId);
    } else {
      if (startDate) {
        query += ' AND a.work_date >= ?';
        params.push(startDate);
      }
      if (endDate) {
        query += ' AND a.work_date <= ?';
        params.push(endDate);
      }
    }

    query += ' ORDER BY a.work_date DESC, a.employee_id ASC LIMIT 1000';

    const [rows] = await pool.query(query, params);
    res.json({ success: true, count: rows.length, attendance: rows });
  } catch (err) {
    console.error('Attendance list error:', err);
    res.status(500).json({ success: false, error: 'Database query failed.' });
  }
});

// POST /api/attendance (HR_ADMIN only: Create attendance entry via triggers)
router.post('/', requireRole('HR_ADMIN'), async (req, res) => {
  const { employee_id, work_date, status, check_in_time = null, check_out_time = null, remarks = null } = req.body || {};

  const empId = parsePositiveInt(employee_id);
  if (!empId) {
    return res.status(400).json({ success: false, error: 'Valid employee_id is required.' });
  }
  if (!isValidDateString(work_date)) {
    return res.status(400).json({ success: false, error: 'Valid work_date (YYYY-MM-DD) is required.' });
  }
  if (!['PRESENT', 'ABSENT', 'HALF_DAY', 'ON_LEAVE'].includes(status)) {
    return res.status(400).json({ success: false, error: 'Status must be PRESENT, ABSENT, HALF_DAY, or ON_LEAVE.' });
  }

  const cleanIn = check_in_time ? String(check_in_time).trim() : null;
  const cleanOut = check_out_time ? String(check_out_time).trim() : null;
  if ((cleanIn && !isValidTimeString(cleanIn)) || (cleanOut && !isValidTimeString(cleanOut))) {
    return res.status(400).json({ success: false, error: 'Invalid time format (HH:MM or HH:MM:SS).' });
  }

  try {
    const [empRows] = await pool.query('SELECT employee_id FROM employees WHERE employee_id = ?', [empId]);
    if (empRows.length === 0) {
      return res.status(404).json({ success: false, error: 'Employee not found.' });
    }

    const [ins] = await pool.query(
      `INSERT INTO attendance (employee_id, work_date, status, check_in_time, check_out_time, remarks)
       VALUES (?, ?, ?, ?, ?, ?)`,
      [empId, work_date.trim(), status, cleanIn, cleanOut, typeof remarks === 'string' && remarks.trim() ? remarks.trim() : null]
    );

    const [[record]] = await pool.query(
      'SELECT attendance_id, employee_id, work_date, status, check_in_time, check_out_time, is_late, late_minutes, remarks FROM attendance WHERE attendance_id = ?',
      [ins.insertId]
    );

    res.status(201).json({
      success: true,
      message: 'Attendance entry recorded successfully.',
      record
    });
  } catch (err) {
    console.error('Create attendance error:', err);
    if (err.code === 'ER_DUP_ENTRY') {
      return res.status(409).json({ success: false, error: 'Attendance already exists for this employee on that date.' });
    }
    if (err.sqlState === '45000') {
      return res.status(400).json({ success: false, error: err.sqlMessage || err.message });
    }
    res.status(500).json({ success: false, error: 'Failed to record attendance.' });
  }
});

// PUT /api/attendance/:attendanceId (HR_ADMIN only: Correct attendance entry via triggers)
router.put('/:attendanceId', requireRole('HR_ADMIN'), async (req, res) => {
  const attendanceId = parsePositiveInt(req.params.attendanceId);
  if (!attendanceId) {
    return res.status(400).json({ success: false, error: 'Invalid attendanceId.' });
  }

  const { status, check_in_time = null, check_out_time = null, remarks = null } = req.body || {};
  if (!['PRESENT', 'ABSENT', 'HALF_DAY', 'ON_LEAVE'].includes(status)) {
    return res.status(400).json({ success: false, error: 'Status must be PRESENT, ABSENT, HALF_DAY, or ON_LEAVE.' });
  }

  const cleanIn = check_in_time ? String(check_in_time).trim() : null;
  const cleanOut = check_out_time ? String(check_out_time).trim() : null;
  if ((cleanIn && !isValidTimeString(cleanIn)) || (cleanOut && !isValidTimeString(cleanOut))) {
    return res.status(400).json({ success: false, error: 'Invalid time format (HH:MM or HH:MM:SS).' });
  }

  try {
    const [resUpd] = await pool.query(
      `UPDATE attendance
       SET status = ?, check_in_time = ?, check_out_time = ?, remarks = ?
       WHERE attendance_id = ?`,
      [status, cleanIn, cleanOut, typeof remarks === 'string' && remarks.trim() ? remarks.trim() : null, attendanceId]
    );

    if (resUpd.affectedRows === 0) {
      return res.status(404).json({ success: false, error: 'Attendance record not found.' });
    }

    const [[record]] = await pool.query(
      'SELECT attendance_id, employee_id, work_date, status, check_in_time, check_out_time, is_late, late_minutes, remarks FROM attendance WHERE attendance_id = ?',
      [attendanceId]
    );

    res.json({
      success: true,
      message: 'Attendance entry updated successfully.',
      record
    });
  } catch (err) {
    console.error('Update attendance error:', err);
    if (err.sqlState === '45000') {
      return res.status(400).json({ success: false, error: err.sqlMessage || err.message });
    }
    res.status(500).json({ success: false, error: 'Failed to update attendance record.' });
  }
});

// Explicitly block legacy self-service clock-in to enforce read-only Employee rubric
router.post('/clock-in', requireRole('HR_ADMIN'), (req, res) => {
  return res.status(400).json({
    success: false,
    error: 'Use POST /api/attendance with employee_id, work_date, and status to record attendance.'
  });
});

module.exports = router;

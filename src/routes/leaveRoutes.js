const express = require('express');
const pool = require('../config/db');
const { authenticateToken, verifyCsrf, requireRole, parsePositiveInt } = require('../middleware/auth');
const { isValidDateString, countWorkingDays } = require('../utils/validators');

const router = express.Router();
router.use(authenticateToken);
router.use(verifyCsrf);

// GET /api/leaves (HR_ADMIN sees all or filters; Employee sees only their own)
router.get('/', async (req, res) => {
  let { employeeId, status } = req.query;

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

  if (status !== undefined && status !== '') {
    if (typeof status !== 'string' || !['PENDING', 'APPROVED', 'REJECTED', 'CANCELLED'].includes(status)) {
      return res.status(400).json({ success: false, error: 'Invalid leave status filter.' });
    }
  }

  try {
    let query = `
      SELECT
        l.leave_id, l.employee_id, e.employee_code,
        CONCAT(e.first_name, ' ', e.last_name) AS full_name,
        d.department_name, l.leave_type, l.start_date, l.end_date,
        l.total_days, l.reason, l.status, l.applied_on,
        CONCAT(a.first_name, ' ', a.last_name) AS actioned_by_name,
        l.actioned_on, l.admin_remarks
      FROM leaves l
      JOIN employees e ON l.employee_id = e.employee_id
      JOIN departments d ON e.department_id = d.department_id
      LEFT JOIN employees a ON l.actioned_by = a.employee_id
      WHERE 1=1
    `;
    const params = [];

    if (employeeId) {
      query += ' AND l.employee_id = ?';
      params.push(employeeId);
    }

    if (status) {
      query += ' AND l.status = ?';
      params.push(status);
    }

    query += ' ORDER BY l.applied_on DESC, l.leave_id DESC LIMIT 200';

    const [rows] = await pool.query(query, params);
    res.json({ success: true, count: rows.length, leaves: rows });
  } catch (err) {
    console.error('List leaves error:', err);
    res.status(500).json({ success: false, error: 'Database query failed.' });
  }
});

// POST /api/leaves (HR_ADMIN only: Record leave request with trusted working-day duration)
router.post('/', requireRole('HR_ADMIN'), async (req, res) => {
  const { employee_id, leave_type, start_date, end_date, total_days, reason, status = 'PENDING' } = req.body || {};

  const targetEmpId = parsePositiveInt(employee_id);
  if (!targetEmpId) {
    return res.status(400).json({ success: false, error: 'Valid employee_id is required.' });
  }

  if (!['CASUAL', 'SICK', 'PAID', 'UNPAID'].includes(leave_type)) {
    return res.status(400).json({ success: false, error: 'leave_type must be CASUAL, SICK, PAID, or UNPAID.' });
  }

  if (!isValidDateString(start_date) || !isValidDateString(end_date)) {
    return res.status(400).json({ success: false, error: 'Valid start_date and end_date (YYYY-MM-DD) are required.' });
  }

  if (start_date > end_date) {
    return res.status(400).json({ success: false, error: 'Invalid dates: start_date cannot be after end_date.' });
  }

  if (typeof reason !== 'string' || !reason.trim()) {
    return res.status(400).json({ success: false, error: 'Reason is required.' });
  }

  if (!['PENDING', 'APPROVED'].includes(status)) {
    return res.status(400).json({ success: false, error: 'Initial leave status must be PENDING or APPROVED.' });
  }

  const computedDays = countWorkingDays(start_date.trim(), end_date.trim());
  if (computedDays <= 0) {
    return res.status(400).json({ success: false, error: 'Selected date range contains zero Mon-Fri working days.' });
  }

  if (total_days !== undefined && total_days !== null && Number(total_days) !== computedDays) {
    return res.status(400).json({
      success: false,
      error: `Invalid leave duration: working days in range is ${computedDays}, received ${total_days}.`
    });
  }

  try {
    const [empRows] = await pool.query('SELECT employee_id FROM employees WHERE employee_id = ?', [targetEmpId]);
    if (empRows.length === 0) {
      return res.status(404).json({ success: false, error: 'Employee not found.' });
    }

    const actionedBy = status === 'APPROVED' ? req.user.employee_id : null;
    const actionedOn = status === 'APPROVED' ? new Date() : null;
    const adminRemarks = status === 'APPROVED' ? 'Recorded and approved by HR Admin' : null;

    const [result] = await pool.query(
      `INSERT INTO leaves (employee_id, leave_type, start_date, end_date, total_days, reason, status, actioned_by, actioned_on, admin_remarks)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
      [targetEmpId, leave_type, start_date.trim(), end_date.trim(), computedDays, reason.trim(), status, actionedBy, actionedOn, adminRemarks]
    );

    res.status(201).json({
      success: true,
      message: 'Leave record created successfully.',
      leave_id: result.insertId,
      total_days: computedDays
    });
  } catch (err) {
    console.error('Create leave error:', err);
    if (err.sqlState === '45000' && err.message && (err.message.includes('Conflicting leave') || err.message.includes('Conflicting attendance'))) {
      return res.status(409).json({ success: false, error: err.sqlMessage || err.message });
    }
    if (err.sqlState === '45000' || err.errno === 4025) {
      return res.status(400).json({ success: false, error: err.sqlMessage || err.message });
    }
    res.status(500).json({ success: false, error: 'Failed to create leave record due to an internal server error.' });
  }
});

// PUT /api/leaves/:leaveId/status (HR_ADMIN only: Approve, Reject, or Cancel)
router.put('/:leaveId/status', requireRole('HR_ADMIN'), async (req, res) => {
  const leaveId = parsePositiveInt(req.params.leaveId);
  if (!leaveId) {
    return res.status(400).json({ success: false, error: 'Invalid leaveId.' });
  }

  const { status, admin_remarks } = req.body || {};
  if (!['APPROVED', 'REJECTED', 'CANCELLED'].includes(status)) {
    return res.status(400).json({ success: false, error: 'Invalid leave status.' });
  }

  try {
    const [existing] = await pool.query('SELECT leave_id, status FROM leaves WHERE leave_id = ?', [leaveId]);
    if (existing.length === 0) {
      return res.status(404).json({ success: false, error: 'Leave request not found.' });
    }

    await pool.query(
      `UPDATE leaves
       SET status = ?, actioned_by = ?, actioned_on = NOW(), admin_remarks = ?
       WHERE leave_id = ?`,
      [status, req.user.employee_id, typeof admin_remarks === 'string' && admin_remarks.trim() ? admin_remarks.trim() : null, leaveId]
    );

    res.json({
      success: true,
      message: `Leave request ${status.toLowerCase()} successfully.`
    });
  } catch (err) {
    console.error('Update leave status error:', err);
    if (err.sqlState === '45000' && err.message && (err.message.includes('Conflicting leave') || err.message.includes('Conflicting attendance'))) {
      return res.status(409).json({
        success: false,
        error: err.sqlMessage || 'Cannot approve leave: Conflicting approved leave or attendance record exists.'
      });
    }
    if (err.sqlState === '45000') {
      return res.status(400).json({ success: false, error: err.sqlMessage || err.message });
    }
    res.status(500).json({ success: false, error: 'Failed to update leave status due to an internal server error.' });
  }
});

module.exports = router;

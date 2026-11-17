const express = require('express');
const pool = require('../config/db');
const { authenticateToken, requireRole } = require('../middleware/auth');

const router = express.Router();
router.use(authenticateToken);

// GET /api/leaves (HR_ADMIN sees all; Employee sees only their own)
router.get('/', async (req, res) => {
  let { employeeId, status } = req.query;

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

    query += ' ORDER BY l.applied_on DESC LIMIT 200';

    const [rows] = await pool.query(query, params);
    res.json({ success: true, count: rows.length, leaves: rows });
  } catch (err) {
    console.error('List leaves error:', err);
    res.status(500).json({ success: false, error: 'Database query failed.' });
  }
});

// POST /api/leaves (Submit leave application)
router.post('/', async (req, res) => {
  const employeeId = req.user.employee_id;
  const { leave_type, start_date, end_date, total_days, reason } = req.body;

  if (!leave_type || !start_date || !end_date || !total_days || !reason) {
    return res.status(400).json({ success: false, error: 'Missing mandatory leave fields.' });
  }

  try {
    const [result] = await pool.query(
      `INSERT INTO leaves (employee_id, leave_type, start_date, end_date, total_days, reason, status)
       VALUES (?, ?, ?, ?, ?, ?, 'PENDING')`,
      [employeeId, leave_type, start_date, end_date, total_days, reason.trim()]
    );

    res.status(201).json({
      success: true,
      message: 'Leave application submitted successfully.',
      leave_id: result.insertId
    });
  } catch (err) {
    console.error('Apply leave error:', err);
    if (err.message && (err.message.includes('chk_leave_dates') || err.message.includes('start_date cannot be after end_date'))) {
      return res.status(400).json({ success: false, error: 'Invalid dates: start date cannot be after end date.' });
    }
    res.status(500).json({ success: false, error: 'Failed to submit leave request due to an internal server error.' });
  }
});

// PUT /api/leaves/:leaveId/status (HR_ADMIN only: Approve or Reject)
router.put('/:leaveId/status', requireRole('HR_ADMIN'), async (req, res) => {
  const leaveId = parseInt(req.params.leaveId, 10);
  const { status, admin_remarks } = req.body;

  if (!['APPROVED', 'REJECTED', 'CANCELLED'].includes(status)) {
    return res.status(400).json({ success: false, error: 'Invalid leave status.' });
  }

  try {
    await pool.query(
      `UPDATE leaves 
       SET status = ?, actioned_by = ?, actioned_on = NOW(), admin_remarks = ?
       WHERE leave_id = ?`,
      [status, req.user.employee_id, admin_remarks ? admin_remarks.trim() : null, leaveId]
    );

    res.json({
      success: true,
      message: `Leave request ${status.toLowerCase()} successfully.`
    });
  } catch (err) {
    console.error('Update leave status error:', err);
    if (err.message && err.message.includes('Conflicting leave: overlapping approved leave')) {
      return res.status(409).json({
        success: false,
        error: 'Cannot approve leave: Overlapping approved leave already exists for this employee.'
      });
    }
    res.status(500).json({ success: false, error: 'Failed to update leave status due to an internal server error.' });
  }
});

module.exports = router;

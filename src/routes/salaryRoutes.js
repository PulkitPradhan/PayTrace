const express = require('express');
const pool = require('../config/db');
const { authenticateToken, verifyCsrf, requireRole, enforceSelfOrAdmin, parsePositiveInt } = require('../middleware/auth');
const { isValidDateString, parseNonNegativeMoney } = require('../utils/validators');

const router = express.Router();
router.use(authenticateToken);
router.use(verifyCsrf);

// GET /api/salary/:employeeId (HR_ADMIN or Self)
router.get('/:employeeId', enforceSelfOrAdmin('employeeId'), async (req, res) => {
  const employeeId = parsePositiveInt(req.params.employeeId);
  if (!employeeId) {
    return res.status(400).json({ success: false, error: 'Invalid employeeId.' });
  }

  try {
    const [empRows] = await pool.query('SELECT employee_id FROM employees WHERE employee_id = ?', [employeeId]);
    if (empRows.length === 0) {
      return res.status(404).json({ success: false, error: 'Employee not found.' });
    }

    const [rows] = await pool.query(
      `SELECT salary_id, employee_id, basic_salary, hra, special_allowance,
              provident_fund, professional_tax, effective_date, is_active, created_at, updated_at
       FROM salary_structures
       WHERE employee_id = ?
       ORDER BY effective_date DESC, salary_id DESC`,
      [employeeId]
    );

    res.json({ success: true, count: rows.length, history: rows });
  } catch (err) {
    console.error('Get salary history error:', err);
    res.status(500).json({ success: false, error: 'Database query failed.' });
  }
});

// POST /api/salary/:employeeId (HR_ADMIN only: Revise compensation structure atomically)
router.post('/:employeeId', requireRole('HR_ADMIN'), async (req, res) => {
  const employeeId = parsePositiveInt(req.params.employeeId);
  if (!employeeId) {
    return res.status(400).json({ success: false, error: 'Invalid employeeId.' });
  }

  const {
    basic_salary, hra = 0, special_allowance = 0,
    provident_fund = 0, professional_tax = 0, effective_date
  } = req.body || {};

  if (!isValidDateString(effective_date)) {
    return res.status(400).json({ success: false, error: 'Valid effective_date (YYYY-MM-DD) is required.' });
  }

  const basicNum = parseNonNegativeMoney(basic_salary);
  const hraNum = parseNonNegativeMoney(hra);
  const specNum = parseNonNegativeMoney(special_allowance);
  const pfNum = parseNonNegativeMoney(provident_fund);
  const ptNum = parseNonNegativeMoney(professional_tax);

  if ([basicNum, hraNum, specNum, pfNum, ptNum].some(v => v === null)) {
    return res.status(400).json({ success: false, error: 'All salary and statutory deduction components must be non-negative numbers.' });
  }

  const conn = await pool.getConnection();
  try {
    await conn.beginTransaction();

    const [empRows] = await conn.query('SELECT employee_id FROM employees WHERE employee_id = ?', [employeeId]);
    if (empRows.length === 0) {
      await conn.rollback();
      return res.status(404).json({ success: false, error: 'Employee not found.' });
    }

    await conn.query('SET @app_actor_id = ?', [req.user.employee_id]);

    // 1. Deactivate currently active prior structures
    await conn.query(
      'UPDATE salary_structures SET is_active = FALSE WHERE employee_id = ? AND is_active = TRUE',
      [employeeId]
    );

    // 2. Insert new active structure
    const [ins] = await conn.query(
      `INSERT INTO salary_structures (
        employee_id, basic_salary, hra, special_allowance, provident_fund, professional_tax, effective_date, is_active
      ) VALUES (?, ?, ?, ?, ?, ?, ?, TRUE)`,
      [employeeId, basicNum, hraNum, specNum, pfNum, ptNum, effective_date.trim()]
    );

    await conn.commit();
    res.status(201).json({
      success: true,
      message: 'Salary structure revised successfully.',
      salary_id: ins.insertId
    });
  } catch (err) {
    try { await conn.rollback(); } catch (_) {}
    console.error('Revise salary structure error:', err);
    if (err.errno === 4025) {
      return res.status(400).json({ success: false, error: 'Salary values cannot be negative.' });
    }
    res.status(500).json({ success: false, error: 'Failed to revise salary structure due to an internal server error.' });
  } finally {
    conn.release();
  }
});

module.exports = router;

const express = require('express');
const pool = require('../config/db');
const { authenticateToken, requireRole, enforceSelfOrAdmin } = require('../middleware/auth');

const router = express.Router();
router.use(authenticateToken);

// GET /api/salary/:employeeId (HR_ADMIN or Self)
router.get('/:employeeId', enforceSelfOrAdmin('employeeId'), async (req, res) => {
  const employeeId = parseInt(req.params.employeeId, 10);

  try {
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
    res.status(500).json({ success: false, error: 'Database query failed.' });
  }
});

// POST /api/salary/:employeeId (HR_ADMIN only: Revise compensation structure)
router.post('/:employeeId', requireRole('HR_ADMIN'), async (req, res) => {
  const employeeId = parseInt(req.params.employeeId, 10);
  const { basic_salary, hra = 0, special_allowance = 0, provident_fund = 0, professional_tax = 0, effective_date } = req.body;

  if (basic_salary === undefined || !effective_date) {
    return res.status(400).json({ success: false, error: 'basic_salary and effective_date are required.' });
  }

  const conn = await pool.getConnection();
  try {
    await conn.beginTransaction();

    // 1. Deactivate prior structures
    await conn.query(
      'UPDATE salary_structures SET is_active = FALSE WHERE employee_id = ?',
      [employeeId]
    );

    // 2. Insert new active structure
    const [ins] = await conn.query(
      `INSERT INTO salary_structures (
        employee_id, basic_salary, hra, special_allowance, provident_fund, professional_tax, effective_date, is_active
      ) VALUES (?, ?, ?, ?, ?, ?, ?, TRUE)`,
      [employeeId, basic_salary, hra, special_allowance, provident_fund, professional_tax, effective_date]
    );

    await conn.commit();
    res.json({
      success: true,
      message: 'Salary structure revised successfully.',
      salary_id: ins.insertId
    });
  } catch (err) {
    await conn.rollback();
    console.error('Revise salary structure error:', err);
    if (err.message && err.message.includes('chk_salary_basic')) {
      return res.status(400).json({ success: false, error: 'Salary values cannot be negative.' });
    }
    res.status(500).json({ success: false, error: 'Failed to revise salary structure due to an internal server error.' });
  } finally {
    conn.release();
  }
});

module.exports = router;

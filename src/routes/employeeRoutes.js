const express = require('express');
const bcrypt = require('bcryptjs');
const pool = require('../config/db');
const { authenticateToken, requireRole, enforceSelfOrAdmin } = require('../middleware/auth');

const router = express.Router();
router.use(authenticateToken);

// GET /api/employees (HR_ADMIN only)
router.get('/', requireRole('HR_ADMIN'), async (req, res) => {
  try {
    const [rows] = await pool.query(`
      SELECT 
        e.employee_id, e.employee_code, e.first_name, e.last_name, e.email, e.phone,
        d.department_id, d.department_name, e.designation, e.role, e.hire_date, e.status,
        s.basic_salary, (s.basic_salary + s.hra + s.special_allowance) AS gross_salary
      FROM employees e
      JOIN departments d ON e.department_id = d.department_id
      LEFT JOIN salary_structures s ON e.employee_id = s.employee_id AND s.is_active = TRUE
      ORDER BY e.employee_id ASC
    `);

    res.json({ success: true, count: rows.length, employees: rows });
  } catch (err) {
    console.error('List employees error:', err);
    res.status(500).json({ success: false, error: 'Database query failed.' });
  }
});

// GET /api/employees/:employeeId (HR_ADMIN or Self)
router.get('/:employeeId', enforceSelfOrAdmin('employeeId'), async (req, res) => {
  const targetId = parseInt(req.params.employeeId, 10);

  try {
    const [rows] = await pool.query(
      `SELECT 
        e.employee_id, e.employee_code, e.first_name, e.last_name, e.email, e.phone,
        d.department_name, e.designation, e.role, e.hire_date, e.status,
        s.basic_salary, s.hra, s.special_allowance, s.provident_fund, s.professional_tax,
        (s.basic_salary + s.hra + s.special_allowance) AS gross_monthly
       FROM employees e
       JOIN departments d ON e.department_id = d.department_id
       LEFT JOIN salary_structures s ON e.employee_id = s.employee_id AND s.is_active = TRUE
       WHERE e.employee_id = ?`,
      [targetId]
    );

    if (rows.length === 0) {
      return res.status(404).json({ success: false, error: 'Employee not found.' });
    }

    res.json({ success: true, employee: rows[0] });
  } catch (err) {
    console.error('Get employee error:', err);
    res.status(500).json({ success: false, error: 'Database query failed.' });
  }
});

// POST /api/employees (HR_ADMIN only)
router.post('/', requireRole('HR_ADMIN'), async (req, res) => {
  const {
    employee_code, first_name, last_name, email, phone,
    department_id, designation, role, password, hire_date,
    basic_salary, hra = 0, special_allowance = 0, provident_fund = 0, professional_tax = 0
  } = req.body;

  if (!employee_code || !first_name || !last_name || !email || !department_id || !designation || !hire_date || basic_salary === undefined) {
    return res.status(400).json({ success: false, error: 'Missing mandatory employee fields.' });
  }

  const conn = await pool.getConnection();
  try {
    await conn.beginTransaction();

    const passwordHash = await bcrypt.hash(password || 'Employee123!', 10);

    const [empRes] = await conn.query(
      `INSERT INTO employees (
        employee_code, first_name, last_name, email, phone,
        department_id, designation, role, password_hash, hire_date, status
      ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, 'ACTIVE')`,
      [
        employee_code.trim().toUpperCase(),
        first_name.trim(),
        last_name.trim(),
        email.trim().toLowerCase(),
        phone ? phone.trim() : null,
        department_id,
        designation.trim(),
        role || 'EMPLOYEE',
        passwordHash,
        hire_date
      ]
    );

    const newEmpId = empRes.insertId;

    // Create initial salary structure
    await conn.query(
      `INSERT INTO salary_structures (
        employee_id, basic_salary, hra, special_allowance, provident_fund, professional_tax, effective_date, is_active
      ) VALUES (?, ?, ?, ?, ?, ?, ?, TRUE)`,
      [newEmpId, basic_salary, hra, special_allowance, provident_fund, professional_tax, hire_date]
    );

    await conn.commit();
    res.status(201).json({
      success: true,
      message: 'Employee created successfully.',
      employee_id: newEmpId,
      employee_code
    });
  } catch (err) {
    await conn.rollback();
    console.error('Create employee error:', err);
    if (err.code === 'ER_DUP_ENTRY') {
      return res.status(409).json({ success: false, error: 'Employee code or email already exists.' });
    }
    res.status(500).json({ success: false, error: 'Failed to create employee due to an internal server error.' });
  } finally {
    conn.release();
  }
});

module.exports = router;

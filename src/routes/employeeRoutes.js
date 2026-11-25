const express = require('express');
const bcrypt = require('bcryptjs');
const pool = require('../config/db');
const { authenticateToken, verifyCsrf, requireRole, enforceSelfOrAdmin, parsePositiveInt } = require('../middleware/auth');
const { isValidDateString, parseNonNegativeMoney } = require('../utils/validators');

const router = express.Router();
router.use(authenticateToken);
router.use(verifyCsrf);

// GET /api/employees/departments (HR_ADMIN only: list departments for forms/filters)
router.get('/departments', requireRole('HR_ADMIN'), async (req, res) => {
  try {
    const [rows] = await pool.query('SELECT department_id, department_name, description FROM departments ORDER BY department_id ASC');
    res.json({ success: true, departments: rows });
  } catch (err) {
    console.error('List departments error:', err);
    res.status(500).json({ success: false, error: 'Database query failed.' });
  }
});

// GET /api/employees (HR_ADMIN only, supports search/departmentId/status filters)
router.get('/', requireRole('HR_ADMIN'), async (req, res) => {
  const { search, departmentId, status } = req.query;

  try {
    let query = `
      SELECT
        e.employee_id, e.employee_code, e.first_name, e.last_name, e.email, e.phone,
        d.department_id, d.department_name, e.designation, e.role, e.hire_date, e.status,
        s.salary_id, s.basic_salary, s.hra, s.special_allowance, s.provident_fund, s.professional_tax,
        (s.basic_salary + s.hra + s.special_allowance) AS gross_salary
      FROM employees e
      JOIN departments d ON e.department_id = d.department_id
      LEFT JOIN salary_structures s ON s.salary_id = (
        SELECT s2.salary_id
        FROM salary_structures s2
        WHERE s2.employee_id = e.employee_id AND s2.is_active = TRUE
        ORDER BY s2.effective_date DESC, s2.salary_id DESC
        LIMIT 1
      )
      WHERE 1=1
    `;
    const params = [];

    if (search !== undefined) {
      if (typeof search !== 'string') {
        return res.status(400).json({ success: false, error: 'Invalid search parameter.' });
      }
      const term = `%${search.trim()}%`;
      if (term !== '%%') {
        query += ' AND (e.employee_code LIKE ? OR e.first_name LIKE ? OR e.last_name LIKE ? OR e.email LIKE ? OR e.designation LIKE ?)';
        params.push(term, term, term, term, term);
      }
    }

    if (departmentId !== undefined && departmentId !== '') {
      const deptInt = parsePositiveInt(departmentId);
      if (!deptInt) {
        return res.status(400).json({ success: false, error: 'Invalid departmentId filter.' });
      }
      query += ' AND e.department_id = ?';
      params.push(deptInt);
    }

    if (status !== undefined && status !== '') {
      if (typeof status !== 'string' || !['ACTIVE', 'INACTIVE', 'TERMINATED'].includes(status)) {
        return res.status(400).json({ success: false, error: 'Invalid status filter.' });
      }
      query += ' AND e.status = ?';
      params.push(status);
    }

    query += ' ORDER BY e.employee_id ASC';

    const [rows] = await pool.query(query, params);
    res.json({ success: true, count: rows.length, employees: rows });
  } catch (err) {
    console.error('List employees error:', err);
    res.status(500).json({ success: false, error: 'Database query failed.' });
  }
});

// GET /api/employees/:employeeId (HR_ADMIN or Self)
router.get('/:employeeId', enforceSelfOrAdmin('employeeId'), async (req, res) => {
  const targetId = parsePositiveInt(req.params.employeeId);
  if (!targetId) {
    return res.status(400).json({ success: false, error: 'Invalid employeeId.' });
  }

  try {
    const [rows] = await pool.query(
      `SELECT
        e.employee_id, e.employee_code, e.first_name, e.last_name, e.email, e.phone,
        e.department_id, d.department_name, e.designation, e.role, e.hire_date, e.status,
        s.salary_id, s.basic_salary, s.hra, s.special_allowance, s.provident_fund, s.professional_tax,
        s.effective_date,
        (s.basic_salary + s.hra + s.special_allowance) AS gross_monthly
       FROM employees e
       JOIN departments d ON e.department_id = d.department_id
       LEFT JOIN salary_structures s ON s.salary_id = (
         SELECT s2.salary_id
         FROM salary_structures s2
         WHERE s2.employee_id = e.employee_id AND s2.is_active = TRUE
         ORDER BY s2.effective_date DESC, s2.salary_id DESC
         LIMIT 1
       )
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
    department_id, designation, role = 'EMPLOYEE', password, hire_date,
    basic_salary, hra = 0, special_allowance = 0, provident_fund = 0, professional_tax = 0
  } = req.body || {};

  if (
    typeof employee_code !== 'string' || !employee_code.trim() ||
    typeof first_name !== 'string' || !first_name.trim() ||
    typeof last_name !== 'string' || !last_name.trim() ||
    typeof email !== 'string' || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email.trim()) ||
    typeof designation !== 'string' || !designation.trim() ||
    !isValidDateString(hire_date)
  ) {
    return res.status(400).json({ success: false, error: 'Missing or invalid mandatory employee fields.' });
  }

  const deptId = parsePositiveInt(department_id);
  if (!deptId) {
    return res.status(400).json({ success: false, error: 'Valid department_id is required.' });
  }

  if (!['HR_ADMIN', 'EMPLOYEE'].includes(role)) {
    return res.status(400).json({ success: false, error: 'Role must be HR_ADMIN or EMPLOYEE.' });
  }

  if (typeof password !== 'string' || password.length < 8) {
    return res.status(400).json({ success: false, error: 'Password must be at least 8 characters.' });
  }

  const basicNum = parseNonNegativeMoney(basic_salary);
  const hraNum = parseNonNegativeMoney(hra);
  const specNum = parseNonNegativeMoney(special_allowance);
  const pfNum = parseNonNegativeMoney(provident_fund);
  const ptNum = parseNonNegativeMoney(professional_tax);
  if ([basicNum, hraNum, specNum, pfNum, ptNum].some(v => v === null)) {
    return res.status(400).json({ success: false, error: 'Salary components must be non-negative numbers.' });
  }

  const conn = await pool.getConnection();
  try {
    await conn.beginTransaction();
    await conn.query('SET @app_actor_id = ?', [req.user.employee_id]);

    const passwordHash = await bcrypt.hash(password, 10);

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
        typeof phone === 'string' && phone.trim() ? phone.trim() : null,
        deptId,
        designation.trim(),
        role,
        passwordHash,
        hire_date.trim()
      ]
    );

    const newEmpId = empRes.insertId;

    await conn.query(
      `INSERT INTO salary_structures (
        employee_id, basic_salary, hra, special_allowance, provident_fund, professional_tax, effective_date, is_active
      ) VALUES (?, ?, ?, ?, ?, ?, ?, TRUE)`,
      [newEmpId, basicNum, hraNum, specNum, pfNum, ptNum, hire_date.trim()]
    );

    await conn.commit();
    res.status(201).json({
      success: true,
      message: 'Employee created successfully.',
      employee_id: newEmpId,
      employee_code: employee_code.trim().toUpperCase()
    });
  } catch (err) {
    try { await conn.rollback(); } catch (_) {}
    console.error('Create employee error:', err);
    if (err.code === 'ER_DUP_ENTRY') {
      return res.status(409).json({ success: false, error: 'Employee code or email already exists.' });
    }
    if (err.code === 'ER_NO_REFERENCED_ROW_2' || err.errno === 1452) {
      return res.status(400).json({ success: false, error: 'Specified department does not exist.' });
    }
    if (err.errno === 4025) {
      return res.status(400).json({ success: false, error: 'Salary values cannot be negative.' });
    }
    res.status(500).json({ success: false, error: 'Failed to create employee due to an internal server error.' });
  } finally {
    conn.release();
  }
});

// PUT /api/employees/:employeeId (HR_ADMIN only: Update employee profile/status)
router.put('/:employeeId', requireRole('HR_ADMIN'), async (req, res) => {
  const targetId = parsePositiveInt(req.params.employeeId);
  if (!targetId) {
    return res.status(400).json({ success: false, error: 'Invalid employeeId.' });
  }

  const {
    first_name, last_name, email, phone,
    department_id, designation, role, status
  } = req.body || {};

  if (
    typeof first_name !== 'string' || !first_name.trim() ||
    typeof last_name !== 'string' || !last_name.trim() ||
    typeof email !== 'string' || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email.trim()) ||
    typeof designation !== 'string' || !designation.trim()
  ) {
    return res.status(400).json({ success: false, error: 'Valid first_name, last_name, email, and designation are required.' });
  }

  const deptId = parsePositiveInt(department_id);
  if (!deptId) {
    return res.status(400).json({ success: false, error: 'Valid department_id is required.' });
  }

  if (!['HR_ADMIN', 'EMPLOYEE'].includes(role)) {
    return res.status(400).json({ success: false, error: 'Role must be HR_ADMIN or EMPLOYEE.' });
  }

  if (!['ACTIVE', 'INACTIVE', 'TERMINATED'].includes(status)) {
    return res.status(400).json({ success: false, error: 'Status must be ACTIVE, INACTIVE, or TERMINATED.' });
  }

  if (targetId === req.user.employee_id && (role !== 'HR_ADMIN' || status !== 'ACTIVE')) {
    return res.status(400).json({ success: false, error: 'Cannot deactivate or demote your own active HR_ADMIN account.' });
  }

  try {
    const [result] = await pool.query(
      `UPDATE employees
       SET first_name = ?, last_name = ?, email = ?, phone = ?,
           department_id = ?, designation = ?, role = ?, status = ?
       WHERE employee_id = ?`,
      [
        first_name.trim(),
        last_name.trim(),
        email.trim().toLowerCase(),
        typeof phone === 'string' && phone.trim() ? phone.trim() : null,
        deptId,
        designation.trim(),
        role,
        status,
        targetId
      ]
    );

    if (result.affectedRows === 0) {
      return res.status(404).json({ success: false, error: 'Employee not found.' });
    }

    res.json({ success: true, message: 'Employee updated successfully.' });
  } catch (err) {
    console.error('Update employee error:', err);
    if (err.code === 'ER_DUP_ENTRY') {
      return res.status(409).json({ success: false, error: 'Email address already belongs to another employee.' });
    }
    if (err.code === 'ER_NO_REFERENCED_ROW_2' || err.errno === 1452) {
      return res.status(400).json({ success: false, error: 'Specified department does not exist.' });
    }
    res.status(500).json({ success: false, error: 'Failed to update employee due to an internal server error.' });
  }
});

module.exports = router;

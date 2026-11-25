const crypto = require('crypto');
const express = require('express');
const bcrypt = require('bcryptjs');
const jwt = require('jsonwebtoken');
const pool = require('../config/db');
const { authenticateToken, getJwtSecret } = require('../middleware/auth');

const router = express.Router();

// POST /api/auth/login
router.post('/login', async (req, res) => {
  const { email, password } = req.body || {};

  if (typeof email !== 'string' || typeof password !== 'string' || !email.trim() || !password) {
    return res.status(400).json({ success: false, error: 'Valid email and password strings are required.' });
  }

  try {
    const [rows] = await pool.query(
      `SELECT e.employee_id, e.employee_code, e.first_name, e.last_name, e.email, e.role, e.status, e.password_hash, d.department_name, e.designation
       FROM employees e
       JOIN departments d ON e.department_id = d.department_id
       WHERE e.email = ?`,
      [email.trim().toLowerCase()]
    );

    if (rows.length === 0) {
      return res.status(401).json({ success: false, error: 'Invalid email or password.' });
    }

    const employee = rows[0];

    if (employee.status !== 'ACTIVE') {
      return res.status(403).json({ success: false, error: 'Account is deactivated. Contact HR.' });
    }

    const isMatch = await bcrypt.compare(password, employee.password_hash);
    if (!isMatch) {
      return res.status(401).json({ success: false, error: 'Invalid email or password.' });
    }

    const token = jwt.sign(
      {
        employee_id: employee.employee_id,
        employee_code: employee.employee_code,
        role: employee.role,
        email: employee.email
      },
      getJwtSecret(),
      { algorithm: 'HS256', expiresIn: '8h' }
    );

    const csrfToken = crypto.randomBytes(24).toString('hex');
    const isProd = process.env.NODE_ENV === 'production';

    res.cookie('token', token, {
      httpOnly: true,
      secure: isProd,
      sameSite: 'lax',
      path: '/',
      maxAge: 8 * 60 * 60 * 1000
    });

    res.cookie('csrf_token', csrfToken, {
      httpOnly: false,
      secure: isProd,
      sameSite: 'lax',
      path: '/',
      maxAge: 8 * 60 * 60 * 1000
    });

    res.json({
      success: true,
      user: {
        employee_id: employee.employee_id,
        employee_code: employee.employee_code,
        first_name: employee.first_name,
        last_name: employee.last_name,
        email: employee.email,
        role: employee.role,
        department: employee.department_name,
        designation: employee.designation
      }
    });
  } catch (err) {
    console.error('Login error:', err);
    res.status(500).json({ success: false, error: 'Server authentication failure.' });
  }
});

// POST /api/auth/logout
router.post('/logout', (req, res) => {
  res.clearCookie('token', { path: '/' });
  res.clearCookie('csrf_token', { path: '/' });
  res.json({ success: true, message: 'Logged out successfully.' });
});

// GET /api/auth/me
router.get('/me', async (req, res) => {
  let token = null;
  if (req.cookies && typeof req.cookies.token === 'string' && req.cookies.token.length > 0) {
    token = req.cookies.token;
  } else if (req.headers.authorization && req.headers.authorization.startsWith('Bearer ')) {
    token = req.headers.authorization.split(' ')[1];
  }

  if (!token) {
    return res.status(401).json({ success: false, error: 'Not authenticated.' });
  }

  try {
    const decoded = jwt.verify(token, getJwtSecret(), { algorithms: ['HS256'] });
    const [rows] = await pool.query(
      `SELECT e.employee_id, e.employee_code, e.first_name, e.last_name, e.email, e.role, e.status, d.department_name, e.designation
       FROM employees e
       JOIN departments d ON e.department_id = d.department_id
       WHERE e.employee_id = ?`,
      [decoded.employee_id]
    );

    if (rows.length === 0 || rows[0].status !== 'ACTIVE') {
      return res.status(401).json({ success: false, error: 'User no longer active.' });
    }

    res.json({ success: true, user: rows[0] });
  } catch (err) {
    res.status(401).json({ success: false, error: 'Invalid session token.' });
  }
});

// GET /api/auth/dashboard (Role-scoped personal summary for authenticated employee)
router.get('/dashboard', authenticateToken, async (req, res) => {
  const empId = req.user.employee_id;
  try {
    const [[profile]] = await pool.query(
      `SELECT e.employee_id, e.employee_code, e.first_name, e.last_name, d.department_name, e.designation,
              s.basic_salary, s.hra, s.special_allowance,
              (COALESCE(s.basic_salary, 0) + COALESCE(s.hra, 0) + COALESCE(s.special_allowance, 0)) AS gross_salary
       FROM employees e
       JOIN departments d ON e.department_id = d.department_id
       LEFT JOIN salary_structures s ON e.employee_id = s.employee_id AND s.is_active = TRUE
       WHERE e.employee_id = ?
       ORDER BY s.effective_date DESC, s.salary_id DESC
       LIMIT 1`,
      [empId]
    );

    const [[attStats]] = await pool.query(
      `SELECT
        COALESCE(SUM(CASE WHEN status = 'PRESENT' THEN 1.0 WHEN status = 'HALF_DAY' THEN 0.5 ELSE 0.0 END), 0.0) AS total_present_days,
        COALESCE(SUM(CASE WHEN is_late = TRUE AND status IN ('PRESENT', 'HALF_DAY') THEN 1 ELSE 0 END), 0) AS total_late_marks
       FROM attendance
       WHERE employee_id = ?`,
      [empId]
    );

    const [[leaveStats]] = await pool.query(
      `SELECT
        COALESCE(SUM(CASE WHEN status = 'APPROVED' THEN total_days ELSE 0.0 END), 0.0) AS approved_leave_days,
        COALESCE(SUM(CASE WHEN status = 'PENDING' THEN 1 ELSE 0 END), 0) AS pending_leave_requests
       FROM leaves
       WHERE employee_id = ?`,
      [empId]
    );

    const [latestPayroll] = await pool.query(
      `SELECT p.payroll_id, pp.period_name, p.gross_earnings, p.total_deductions, p.net_salary, p.payment_status
       FROM payrolls p
       JOIN payroll_periods pp ON p.period_id = pp.period_id
       WHERE p.employee_id = ?
       ORDER BY pp.start_date DESC
       LIMIT 1`,
      [empId]
    );

    res.json({
      success: true,
      summary: {
        profile,
        total_present_days: attStats.total_present_days,
        total_late_marks: attStats.total_late_marks,
        approved_leave_days: leaveStats.approved_leave_days,
        pending_leave_requests: leaveStats.pending_leave_requests,
        latest_payroll: latestPayroll[0] || null
      }
    });
  } catch (err) {
    console.error('Personal dashboard error:', err);
    res.status(500).json({ success: false, error: 'Failed to fetch dashboard summary.' });
  }
});

module.exports = router;

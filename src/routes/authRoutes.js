const express = require('express');
const bcrypt = require('bcryptjs');
const jwt = require('jsonwebtoken');
const pool = require('../config/db');
const { getJwtSecret } = require('../middleware/auth');

const router = express.Router();

// POST /api/auth/login
router.post('/login', async (req, res) => {
  const { email, password } = req.body;

  if (!email || !password) {
    return res.status(400).json({ success: false, error: 'Email and password are required.' });
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
      { expiresIn: '8h' }
    );

    res.cookie('token', token, {
      httpOnly: true,
      secure: process.env.NODE_ENV === 'production',
      sameSite: 'lax',
      maxAge: 8 * 60 * 60 * 1000
    });

    res.json({
      success: true,
      token,
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
  res.clearCookie('token');
  res.json({ success: true, message: 'Logged out successfully.' });
});

// GET /api/auth/me
router.get('/me', async (req, res) => {
  let token = null;
  if (req.headers.authorization && req.headers.authorization.startsWith('Bearer ')) {
    token = req.headers.authorization.split(' ')[1];
  } else if (req.cookies && req.cookies.token) {
    token = req.cookies.token;
  }

  if (!token) {
    return res.status(401).json({ success: false, error: 'Not authenticated.' });
  }

  try {
    const decoded = jwt.verify(token, getJwtSecret());
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

module.exports = router;

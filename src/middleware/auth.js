const jwt = require('jsonwebtoken');
const pool = require('../config/db');

const JWT_SECRET = process.env.JWT_SECRET || 'supersecret_paytrace_academic_jwt_key_2026_secure';

async function authenticateToken(req, res, next) {
  let token = null;

  if (req.headers.authorization && req.headers.authorization.startsWith('Bearer ')) {
    token = req.headers.authorization.split(' ')[1];
  } else if (req.cookies && req.cookies.token) {
    token = req.cookies.token;
  }

  if (!token) {
    return res.status(401).json({
      success: false,
      error: 'Authentication required. No token provided.'
    });
  }

  try {
    const decoded = jwt.verify(token, JWT_SECRET);
    
    // Verify user is still active in database
    const [rows] = await pool.query(
      'SELECT employee_id, employee_code, email, role, status FROM employees WHERE employee_id = ?',
      [decoded.employee_id]
    );

    if (rows.length === 0 || rows[0].status !== 'ACTIVE') {
      return res.status(401).json({
        success: false,
        error: 'Invalid session or employee account is inactive.'
      });
    }

    req.user = rows[0];
    next();
  } catch (err) {
    return res.status(401).json({
      success: false,
      error: 'Invalid or expired authentication token.'
    });
  }
}

function requireRole(...allowedRoles) {
  return (req, res, next) => {
    if (!req.user) {
      return res.status(401).json({ success: false, error: 'Unauthenticated.' });
    }

    if (!allowedRoles.includes(req.user.role)) {
      return res.status(403).json({
        success: false,
        error: `Forbidden: This action requires role [${allowedRoles.join(', ')}]. Your role is ${req.user.role}.`
      });
    }

    next();
  };
}

function enforceSelfOrAdmin(paramKey = 'employeeId') {
  return (req, res, next) => {
    if (!req.user) {
      return res.status(401).json({ success: false, error: 'Unauthenticated.' });
    }

    const targetEmployeeId = parseInt(req.params[paramKey] || req.query[paramKey] || req.body[paramKey], 10);

    if (req.user.role === 'HR_ADMIN') {
      return next();
    }

    if (req.user.employee_id === targetEmployeeId) {
      return next();
    }

    return res.status(403).json({
      success: false,
      error: 'Access denied: Employees can access only their own authorized records.'
    });
  };
}

module.exports = {
  authenticateToken,
  requireRole,
  enforceSelfOrAdmin,
  JWT_SECRET
};

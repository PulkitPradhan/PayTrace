const jwt = require('jsonwebtoken');
const pool = require('../config/db');

const INSECURE_DEFAULTS = [
  'supersecret_paytrace_academic_jwt_key_2026_secure',
  'your_jwt_secret_change_in_production',
  'your_secure_random_jwt_secret_key_here',
  'secret',
  'jwt_secret',
  'changeme',
  'password',
  '12345678'
];

function validateJwtSecret(secret, env = process.env.NODE_ENV) {
  if (!secret || typeof secret !== 'string' || secret.trim().length === 0) {
    throw new Error('FATAL SECURITY ERROR: JWT_SECRET environment variable is not defined or is empty.');
  }
  const trimmed = secret.trim();
  if (env === 'production') {
    if (trimmed.length < 32) {
      throw new Error('FATAL SECURITY ERROR: JWT_SECRET must be at least 32 characters in production.');
    }
    if (INSECURE_DEFAULTS.includes(trimmed)) {
      throw new Error('FATAL SECURITY ERROR: Known insecure/default JWT_SECRET cannot be used in production.');
    }
  }
  return trimmed;
}

function getJwtSecret() {
  return validateJwtSecret(process.env.JWT_SECRET);
}

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
    const secret = getJwtSecret();
    const decoded = jwt.verify(token, secret);
    
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
  validateJwtSecret,
  getJwtSecret,
  INSECURE_DEFAULTS,
  get JWT_SECRET() {
    return getJwtSecret();
  }
};

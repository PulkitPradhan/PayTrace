const crypto = require('crypto');
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

function validateJwtSecret(secret) {
  if (!secret || typeof secret !== 'string' || secret.trim().length === 0) {
    throw new Error('FATAL SECURITY ERROR: JWT_SECRET environment variable is not defined or is empty.');
  }
  const trimmed = secret.trim();
  if (trimmed.length < 32) {
    throw new Error('FATAL SECURITY ERROR: JWT_SECRET must be at least 32 characters in all environments.');
  }
  if (INSECURE_DEFAULTS.includes(trimmed)) {
    throw new Error('FATAL SECURITY ERROR: Known insecure/default JWT_SECRET cannot be used.');
  }
  return trimmed;
}

function getJwtSecret() {
  return validateJwtSecret(process.env.JWT_SECRET);
}

function parsePositiveInt(val) {
  if (val === undefined || val === null) return null;
  if (typeof val === 'number') {
    return Number.isSafeInteger(val) && val > 0 ? val : null;
  }
  if (typeof val !== 'string') return null;
  const trimmed = val.trim();
  if (!/^\d+$/.test(trimmed)) return null;
  const parsed = Number(trimmed);
  return Number.isSafeInteger(parsed) && parsed > 0 ? parsed : null;
}

async function authenticateToken(req, res, next) {
  let token = null;
  let authSource = null;

  if (req.cookies && typeof req.cookies.token === 'string' && req.cookies.token.length > 0) {
    token = req.cookies.token;
    authSource = 'cookie';
  } else if (req.headers.authorization && req.headers.authorization.startsWith('Bearer ')) {
    token = req.headers.authorization.split(' ')[1];
    authSource = 'bearer';
  }

  if (!token) {
    return res.status(401).json({
      success: false,
      error: 'Authentication required. No token provided.'
    });
  }

  try {
    const secret = getJwtSecret();
    const decoded = jwt.verify(token, secret, { algorithms: ['HS256'] });

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
    req.authSource = authSource;
    next();
  } catch (err) {
    return res.status(401).json({
      success: false,
      error: 'Invalid or expired authentication token.'
    });
  }
}

function verifyCsrf(req, res, next) {
  const safeMethods = ['GET', 'HEAD', 'OPTIONS'];
  if (safeMethods.includes(req.method)) {
    return next();
  }

  // Enforce double-submit CSRF validation whenever cookie authentication is used
  if (req.authSource === 'cookie') {
    const cookieCsrf = req.cookies && typeof req.cookies.csrf_token === 'string' ? req.cookies.csrf_token : '';
    const headerCsrf = typeof req.headers['x-csrf-token'] === 'string' ? req.headers['x-csrf-token'] : '';

    if (!cookieCsrf || !headerCsrf || cookieCsrf.length !== headerCsrf.length) {
      return res.status(403).json({
        success: false,
        error: 'CSRF verification failed: Missing or invalid X-CSRF-Token.'
      });
    }

    const a = Buffer.from(cookieCsrf, 'utf8');
    const b = Buffer.from(headerCsrf, 'utf8');
    if (!crypto.timingSafeEqual(a, b)) {
      return res.status(403).json({
        success: false,
        error: 'CSRF verification failed: Token mismatch.'
      });
    }
  }

  next();
}

function requireRole(...allowedRoles) {
  return (req, res, next) => {
    if (!req.user) {
      return res.status(401).json({ success: false, error: 'Unauthenticated.' });
    }

    if (!allowedRoles.includes(req.user.role)) {
      return res.status(403).json({
        success: false,
        error: 'Forbidden: You do not have permission to perform this action.'
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

    const raw =
      (req.params && req.params[paramKey] !== undefined ? req.params[paramKey] : undefined) ??
      (req.query && req.query[paramKey] !== undefined ? req.query[paramKey] : undefined) ??
      (req.body && req.body[paramKey] !== undefined ? req.body[paramKey] : undefined);

    const targetEmployeeId = parsePositiveInt(raw);
    if (!targetEmployeeId) {
      return res.status(400).json({
        success: false,
        error: `Invalid ${paramKey} identifier.`
      });
    }

    if (req.user.role === 'HR_ADMIN' || req.user.employee_id === targetEmployeeId) {
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
  verifyCsrf,
  requireRole,
  enforceSelfOrAdmin,
  validateJwtSecret,
  getJwtSecret,
  parsePositiveInt,
  INSECURE_DEFAULTS,
  get JWT_SECRET() {
    return getJwtSecret();
  }
};

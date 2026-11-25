const express = require('express');
const pool = require('../config/db');
const { authenticateToken, verifyCsrf, requireRole, parsePositiveInt } = require('../middleware/auth');

const router = express.Router();
router.use(authenticateToken);
router.use(verifyCsrf);

// GET /api/payroll/periods
router.get('/periods', async (req, res) => {
  try {
    const [rows] = await pool.query('SELECT * FROM payroll_periods ORDER BY start_date DESC');
    res.json({ success: true, periods: rows });
  } catch (err) {
    res.status(500).json({ success: false, error: 'Failed to fetch payroll periods.' });
  }
});

// GET /api/payroll (HR_ADMIN sees all or filters; Employee sees only their own)
router.get('/', async (req, res) => {
  let { employeeId, periodId } = req.query;

  if (employeeId !== undefined && employeeId !== '') {
    const parsedEmp = parsePositiveInt(employeeId);
    if (!parsedEmp) {
      return res.status(400).json({ success: false, error: 'Invalid employeeId filter.' });
    }
    if (req.user.role !== 'HR_ADMIN' && parsedEmp !== req.user.employee_id) {
      return res.status(403).json({
        success: false,
        error: 'Access denied: Employees can access only their own authorized records.'
      });
    }
    employeeId = parsedEmp;
  } else if (req.user.role !== 'HR_ADMIN') {
    employeeId = req.user.employee_id;
  } else {
    employeeId = null;
  }

  let parsedPeriodId = null;
  if (periodId !== undefined && periodId !== '') {
    parsedPeriodId = parsePositiveInt(periodId);
    if (!parsedPeriodId) {
      return res.status(400).json({ success: false, error: 'Invalid periodId filter.' });
    }
  }

  try {
    let query = `
      SELECT
        p.payroll_id, p.employee_id, e.employee_code,
        CONCAT(e.first_name, ' ', e.last_name) AS full_name,
        d.department_name, e.designation,
        pp.period_id, pp.period_name, pp.start_date, pp.end_date, pp.total_working_days,
        p.present_days, p.approved_paid_leave_days, p.unpaid_leave_days, p.late_days,
        p.gross_earnings, p.total_deductions, p.net_salary,
        p.payment_status, p.processed_at, p.payment_date
      FROM payrolls p
      JOIN employees e ON p.employee_id = e.employee_id
      JOIN departments d ON e.department_id = d.department_id
      JOIN payroll_periods pp ON p.period_id = pp.period_id
      WHERE 1=1
    `;
    const params = [];

    if (employeeId) {
      query += ' AND p.employee_id = ?';
      params.push(employeeId);
    }

    if (parsedPeriodId) {
      query += ' AND p.period_id = ?';
      params.push(parsedPeriodId);
    }

    query += ' ORDER BY pp.start_date DESC, p.payroll_id DESC';

    const [rows] = await pool.query(query, params);
    res.json({ success: true, count: rows.length, payrolls: rows });
  } catch (err) {
    console.error('List payrolls error:', err);
    res.status(500).json({ success: false, error: 'Database query failed.' });
  }
});

// GET /api/payroll/slip/:payrollId (Detailed Itemized Salary Slip)
router.get('/slip/:payrollId', async (req, res) => {
  const payrollId = parsePositiveInt(req.params.payrollId);
  if (!payrollId) {
    return res.status(400).json({ success: false, error: 'Invalid payrollId parameter.' });
  }

  try {
    const [headers] = await pool.query(
      `SELECT
        p.payroll_id, p.employee_id, e.employee_code,
        CONCAT(e.first_name, ' ', e.last_name) AS full_name,
        e.email, d.department_name, e.designation,
        pp.period_id, pp.period_name, pp.start_date, pp.end_date, pp.total_working_days,
        p.present_days, p.approved_paid_leave_days, p.unpaid_leave_days, p.late_days,
        p.gross_earnings, p.total_deductions, p.net_salary,
        p.payment_status, p.processed_at, p.payment_date, p.remarks
       FROM payrolls p
       JOIN employees e ON p.employee_id = e.employee_id
       JOIN departments d ON e.department_id = d.department_id
       JOIN payroll_periods pp ON p.period_id = pp.period_id
       WHERE p.payroll_id = ?`,
      [payrollId]
    );

    if (headers.length === 0) {
      return res.status(404).json({ success: false, error: 'Salary slip not found.' });
    }

    const slip = headers[0];

    if (req.user.role !== 'HR_ADMIN' && slip.employee_id !== req.user.employee_id) {
      return res.status(403).json({
        success: false,
        error: 'Access denied: You are not authorized to view other employees\' salary slips.'
      });
    }

    const [items] = await pool.query(
      `SELECT item_id, item_type, item_name, amount, description
       FROM payroll_items
       WHERE payroll_id = ?
       ORDER BY item_type DESC, item_id ASC`,
      [payrollId]
    );

    const earnings = items.filter(i => i.item_type === 'EARNING');
    const deductions = items.filter(i => i.item_type === 'DEDUCTION');

    res.json({
      success: true,
      slip: {
        ...slip,
        earnings,
        deductions,
        item_count: items.length
      }
    });
  } catch (err) {
    console.error('Fetch slip error:', err);
    res.status(500).json({ success: false, error: 'Database query failed.' });
  }
});

// POST /api/payroll/process (HR_ADMIN only: Procedural bulk or single calculation)
router.post('/process', requireRole('HR_ADMIN'), async (req, res) => {
  const { periodId, employeeId } = req.body || {};

  const parsedPeriodId = parsePositiveInt(periodId);
  if (!parsedPeriodId) {
    return res.status(400).json({ success: false, error: 'Valid positive integer periodId is required.' });
  }

  let parsedEmpId = null;
  if (employeeId !== undefined && employeeId !== null && employeeId !== '') {
    parsedEmpId = parsePositiveInt(employeeId);
    if (!parsedEmpId) {
      return res.status(400).json({ success: false, error: 'Invalid employeeId.' });
    }
  }

  const conn = await pool.getConnection();
  try {
    const [pRows] = await conn.query('SELECT period_id FROM payroll_periods WHERE period_id = ?', [parsedPeriodId]);
    if (pRows.length === 0) {
      return res.status(404).json({ success: false, error: 'Specified payroll period does not exist.' });
    }

    if (parsedEmpId) {
      await conn.query('CALL sp_calculate_payroll(?, ?, ?, @pid, @net, @code, @msg)', [parsedEmpId, parsedPeriodId, req.user.employee_id]);
      const [[out]] = await conn.query('SELECT @pid AS payroll_id, @net AS net_salary, @code AS status_code, @msg AS status_message');

      if (out.status_code === 200) {
        return res.json({
          success: true,
          message: out.status_message,
          payroll_id: out.payroll_id,
          net_salary: out.net_salary
        });
      }
      const httpCode = [403, 404, 409, 422].includes(out.status_code) ? out.status_code : 500;
      return res.status(httpCode).json({
        success: false,
        error: out.status_message
      });
    } else {
      await conn.query('CALL sp_process_bulk_payroll(?, ?, @processed, @errors)', [parsedPeriodId, req.user.employee_id]);
      const [[out]] = await conn.query('SELECT @processed AS processed_count, @errors AS error_count');

      return res.json({
        success: true,
        message: `Bulk payroll cycle completed: ${out.processed_count} calculated, ${out.error_count} skipped (already processed or ineligible).`,
        processed_count: out.processed_count,
        error_count: out.error_count
      });
    }
  } catch (err) {
    console.error('Process payroll error:', err);
    res.status(500).json({ success: false, error: 'Payroll processing failed due to an internal server error.' });
  } finally {
    conn.release();
  }
});

// POST /api/payroll/test-rollback (HR_ADMIN only: Demonstrate ROLLBACK on constraint failure)
router.post('/test-rollback', requireRole('HR_ADMIN'), async (req, res) => {
  const conn = await pool.getConnection();
  try {
    await conn.query('CALL sp_demonstrate_transaction_rollback(1, 1, ?, @res, @msg)', [req.user.employee_id]);
    const [[out]] = await conn.query('SELECT @res AS status, @msg AS message');

    res.json({
      success: true,
      demonstration: 'Multi-Step Transaction Rollback Test',
      status: out.status,
      message: out.message
    });
  } catch (err) {
    console.error('Test rollback error:', err);
    res.status(500).json({ success: false, error: 'Transaction rollback test failed due to an internal server error.' });
  } finally {
    conn.release();
  }
});

module.exports = router;

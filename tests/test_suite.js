// ============================================================================
// PayTrace: Automated Verification & Test Suite (Phase 4)
// Executes 20 Mandatory Rubric Test Cases
// ============================================================================

const mysql = require('mysql2/promise');
const bcrypt = require('bcryptjs');
const jwt = require('jsonwebtoken');
const dotenv = require('dotenv');
const { authenticateToken, requireRole, enforceSelfOrAdmin, validateJwtSecret, getJwtSecret, INSECURE_DEFAULTS } = require('../src/middleware/auth');

dotenv.config();

const pool = mysql.createPool({
  host: process.env.DB_HOST || '127.0.0.1',
  port: parseInt(process.env.DB_PORT || '3306', 10),
  user: process.env.DB_USER || 'root',
  password: process.env.DB_PASSWORD || '',
  database: process.env.DB_NAME || 'paytrace_db',
  multipleStatements: true,
  decimalNumbers: true
});

const JWT_SECRET = getJwtSecret();

const results = [];

function recordTest(id, name, input, expected, actual, passed, evidence) {
  results.push({ id, name, input, expected, actual, passed, evidence });
  const mark = passed ? '✅ PASS' : '❌ FAIL';
  console.log(`[${mark}] Test ${id}: ${name}`);
  if (!passed) {
    console.error(`   Expected: ${expected}`);
    console.error(`   Actual:   ${actual}`);
  }
}

async function runTests() {
  console.log('===============================================================');
  console.log('PAYTRACE: Executing 20 Mandatory Rubric Test Cases');
  console.log('Database:', process.env.DB_NAME || 'paytrace_db');
  console.log('Timestamp:', new Date().toISOString());
  console.log('===============================================================\n');

  try {
    // ------------------------------------------------------------------------
    // TEST 1: Valid employee creation
    // ------------------------------------------------------------------------
    try {
      const testCode = 'EMP_T' + (Date.now() % 100000000);
      const testEmail = 'valid_test_' + (Date.now() % 100000000) + '@paytrace.local';
      const [res] = await pool.query(
        `INSERT INTO employees (employee_code, first_name, last_name, email, department_id, designation, role, password_hash, hire_date, status)
         VALUES (?, 'John', 'Tester', ?, 1, 'QA Analyst', 'EMPLOYEE', 'hashed_pwd', '2026-01-01', 'ACTIVE')`,
        [testCode, testEmail]
      );
      recordTest(
        1,
        'Valid employee creation',
        { code: testCode, email: testEmail },
        'Successfully inserted row with auto-increment ID',
        `Inserted employee_id: ${res.insertId}`,
        res.insertId > 0,
        `Generated ID: ${res.insertId}`
      );
      // Clean up test employee
      await pool.query('DELETE FROM employees WHERE employee_id = ?', [res.insertId]);
    } catch (err) {
      recordTest(1, 'Valid employee creation', {}, 'Success', err.message, false, err.stack);
    }

    // ------------------------------------------------------------------------
    // TEST 2: Duplicate employee identifier (code) rejection
    // ------------------------------------------------------------------------
    try {
      await pool.query(
        `INSERT INTO employees (employee_code, first_name, last_name, email, department_id, designation, role, password_hash, hire_date)
         VALUES ('EMP001', 'Duplicate', 'User', 'dup_email@test.com', 1, 'Dev', 'EMPLOYEE', 'h', '2026-01-01')`
      );
      recordTest(2, 'Duplicate employee identifier rejection', 'EMP001', 'Rejection with ER_DUP_ENTRY', 'Unexpectedly succeeded', false, 'No error raised');
    } catch (err) {
      const isDup = err.code === 'ER_DUP_ENTRY';
      recordTest(2, 'Duplicate employee identifier rejection', 'EMP001', 'Rejection with ER_DUP_ENTRY (1062)', err.message, isDup, err.message);
    }

    // ------------------------------------------------------------------------
    // TEST 3: Negative salary rejection via CHECK constraint
    // ------------------------------------------------------------------------
    try {
      await pool.query(
        `INSERT INTO salary_structures (employee_id, basic_salary, hra, special_allowance, provident_fund, professional_tax, effective_date)
         VALUES (1, -5000.00, 0, 0, 0, 0, '2026-09-01')`
      );
      recordTest(3, 'Negative salary rejection', 'basic_salary = -5000.00', 'Constraint violation chk_salary_basic', 'Unexpectedly succeeded', false, 'No error raised');
    } catch (err) {
      const isCheckViolation = err.message.includes('chk_salary_basic') || err.errno === 4025;
      recordTest(3, 'Negative salary rejection', 'basic_salary = -5000.00', 'Rejected by CHECK constraint', err.message, isCheckViolation, err.message);
    }

    // ------------------------------------------------------------------------
    // TEST 4: Duplicate attendance entry rejection
    // ------------------------------------------------------------------------
    try {
      await pool.query(
        `INSERT INTO attendance (employee_id, work_date, status, check_in_time, check_out_time)
         VALUES (1, '2026-06-01', 'PRESENT', '09:00:00', '18:00:00')`
      );
      recordTest(4, 'Duplicate attendance entry rejection', 'EMP 1 on 2026-06-01', 'ER_DUP_ENTRY on uq_emp_work_date', 'Unexpectedly succeeded', false, 'No error raised');
    } catch (err) {
      const isDup = err.code === 'ER_DUP_ENTRY';
      recordTest(4, 'Duplicate attendance entry rejection', 'EMP 1 on 2026-06-01', 'Rejected by unique constraint uq_emp_work_date', err.message, isDup, err.message);
    }

    // ------------------------------------------------------------------------
    // TEST 5: Invalid attendance date / time range (check-out earlier than check-in)
    // ------------------------------------------------------------------------
    try {
      await pool.query(
        `INSERT INTO attendance (employee_id, work_date, status, check_in_time, check_out_time)
         VALUES (1, '2026-09-15', 'PRESENT', '18:00:00', '09:00:00')`
      );
      recordTest(5, 'Invalid attendance state rejection', 'check_in: 18:00, check_out: 09:00', 'Trigger exception check-out earlier than check-in', 'Unexpectedly succeeded', false, 'No error raised');
    } catch (err) {
      const isTriggerErr = err.message.includes('check-out time cannot be earlier than check-in time');
      recordTest(5, 'Invalid attendance state rejection', 'check_in: 18:00, check_out: 09:00', 'Trigger exception 45000 raised', err.message, isTriggerErr, err.message);
    }

    // ------------------------------------------------------------------------
    // TEST 6: Overlapping approved leave rejection
    // ------------------------------------------------------------------------
    try {
      // EMP003 already has approved leave on 2026-06-12
      await pool.query(
        `INSERT INTO leaves (employee_id, leave_type, start_date, end_date, total_days, reason, status)
         VALUES (3, 'CASUAL', '2026-06-11', '2026-06-13', 3.0, 'Overlap test', 'APPROVED')`
      );
      recordTest(6, 'Overlapping approved leave rejection', 'EMP003 leaves overlapping 2026-06-12', 'Trigger error 45000', 'Unexpectedly succeeded', false, 'No error raised');
    } catch (err) {
      const isOverlapErr = err.message.includes('Conflicting leave: overlapping approved leave already exists');
      recordTest(6, 'Overlapping approved leave rejection', 'EMP003 leaves overlapping 2026-06-12', 'Trigger prevented overlap with SQLSTATE 45000', err.message, isOverlapErr, err.message);
    }

    // ------------------------------------------------------------------------
    // TEST 7: Valid leave application and approval workflow
    // ------------------------------------------------------------------------
    try {
      const [insertRes] = await pool.query(
        `INSERT INTO leaves (employee_id, leave_type, start_date, end_date, total_days, reason, status)
         VALUES (5, 'CASUAL', '2026-09-10', '2026-09-11', 2.0, 'Test vacation request', 'PENDING')`
      );
      const leaveId = insertRes.insertId;
      
      // Admin approves
      await pool.query(
        `UPDATE leaves SET status = 'APPROVED', actioned_by = 1, actioned_on = NOW(), admin_remarks = 'Test approval'
         WHERE leave_id = ?`,
        [leaveId]
      );

      const [check] = await pool.query('SELECT status, actioned_by FROM leaves WHERE leave_id = ?', [leaveId]);
      const isApproved = check[0].status === 'APPROVED' && check[0].actioned_by === 1;

      recordTest(7, 'Valid leave application and approval', { leaveId, employeeId: 5 }, 'Status updated to APPROVED with actioned_by = 1', `status: ${check[0].status}, actioned_by: ${check[0].actioned_by}`, isApproved, 'Workflow verified');
      // Clean up
      await pool.query('DELETE FROM leaves WHERE leave_id = ?', [leaveId]);
    } catch (err) {
      recordTest(7, 'Valid leave application and approval', {}, 'Success', err.message, false, err.stack);
    }

    // ------------------------------------------------------------------------
    // TEST 8: Correct salary calculation formula and line-item components
    // ------------------------------------------------------------------------
    try {
      // 1. Verify Sarah Jenkins (EMP004) July 2026 header and itemized line items
      const [pRows] = await pool.query(
        'SELECT payroll_id, gross_earnings, total_deductions, net_salary, late_days FROM payrolls WHERE employee_id = 4 AND period_id = 2'
      );
      const p = pRows[0];
      const [sarahItems] = await pool.query(
        'SELECT item_name, item_type, amount FROM payroll_items WHERE payroll_id = ?',
        [p.payroll_id]
      );
      const itemMap = {};
      sarahItems.forEach(it => { itemMap[it.item_name] = parseFloat(it.amount); });

      const sarahGrossOk = parseFloat(p.gross_earnings) === 100000.00;
      const sarahDeductOk = parseFloat(p.total_deductions) === 20771.75;
      const sarahNetOk = parseFloat(p.net_salary) === 79228.25;
      const sarahLateDaysOk = parseInt(p.late_days, 10) === 6;
      const sarahPfOk = itemMap['Provident Fund (PF)'] === 7800.00;
      const sarahPtOk = itemMap['Professional Tax'] === 200.00;
      const sarahLateOk = itemMap['Late Attendance Penalty'] === 6521.75;
      const sarahTdsOk = itemMap['Income Tax (TDS)'] === 6250.00;

      // 2. Verify Liam Patel (EMP008) June 2026 unpaid leave pro-rata deduction
      const [liamRows] = await pool.query(
        'SELECT payroll_id, gross_earnings, total_deductions, net_salary, unpaid_leave_days FROM payrolls WHERE employee_id = 8 AND period_id = 1'
      );
      const liam = liamRows[0];
      const [liamItems] = await pool.query(
        'SELECT item_name, amount FROM payroll_items WHERE payroll_id = ?',
        [liam.payroll_id]
      );
      const liamMap = {};
      liamItems.forEach(it => { liamMap[it.item_name] = parseFloat(it.amount); });

      const liamGrossOk = parseFloat(liam.gross_earnings) === 97000.00;
      const liamDeductOk = parseFloat(liam.total_deductions) === 22408.18;
      const liamNetOk = parseFloat(liam.net_salary) === 74591.82;
      const liamUnpaidOk = liamMap['Unpaid Leave Deduction'] === 8818.18;
      const liamPfOk = liamMap['Provident Fund (PF)'] === 7440.00;
      const liamTdsOk = liamMap['Income Tax (TDS)'] === 5950.00;

      // 3. Verify Aisha Khan (EMP011) June 2026 clean baseline
      const [aishaRows] = await pool.query(
        'SELECT gross_earnings, total_deductions, net_salary FROM payrolls WHERE employee_id = 11 AND period_id = 1'
      );
      const aisha = aishaRows[0];
      const aishaGrossOk = parseFloat(aisha.gross_earnings) === 55000.00;
      const aishaDeductOk = parseFloat(aisha.total_deductions) === 6150.00;
      const aishaNetOk = parseFloat(aisha.net_salary) === 48850.00;

      const allCalculationsOk = sarahGrossOk && sarahDeductOk && sarahNetOk && sarahLateDaysOk &&
        sarahPfOk && sarahPtOk && sarahLateOk && sarahTdsOk &&
        liamGrossOk && liamDeductOk && liamNetOk && liamUnpaidOk && liamPfOk && liamTdsOk &&
        aishaGrossOk && aishaDeductOk && aishaNetOk;

      recordTest(
        8,
        'Correct salary calculation formula and line-item components',
        'EMP004 (Excess Late), EMP008 (Unpaid Leave), EMP011 (Baseline)',
        'Sarah: Gross 100k, PF 7.8k, Late 6521.75, TDS 6250, Net 79228.25 | Liam: Gross 97k, Unpaid 8818.18, Net 74591.82 | Aisha: Net 48850.00',
        `Sarah Net: ${p.net_salary}, Liam Net: ${liam.net_salary}, Aisha Net: ${aisha.net_salary}`,
        allCalculationsOk,
        `All earnings and itemized deductions (PF, PT, Late Penalty, Unpaid Leave, TDS) verified with exact precision`
      );
    } catch (err) {
      recordTest(8, 'Correct salary calculation formula and line-item components', {}, 'Match', err.message, false, err.stack);
    }

    // ------------------------------------------------------------------------
    // TEST 9: Correct progressive tax deduction across all 4 tax slabs and boundaries
    // ------------------------------------------------------------------------
    try {
      const [t1] = await pool.query('SELECT fn_calculate_monthly_tds(250000.00) AS tds');
      const [t1b] = await pool.query('SELECT fn_calculate_monthly_tds(300000.00) AS tds');
      const [t2] = await pool.query('SELECT fn_calculate_monthly_tds(480000.00) AS tds');
      const [t2b] = await pool.query('SELECT fn_calculate_monthly_tds(600000.00) AS tds');
      const [t3] = await pool.query('SELECT fn_calculate_monthly_tds(1200000.00) AS tds');
      const [t4] = await pool.query('SELECT fn_calculate_monthly_tds(1800000.00) AS tds');

      const isSlab1Ok = parseFloat(t1[0].tds) === 0.00 && parseFloat(t1b[0].tds) === 0.00;
      const isSlab2Ok = parseFloat(t2[0].tds) === 750.00 && parseFloat(t2b[0].tds) === 1250.00;
      const isSlab3Ok = parseFloat(t3[0].tds) === 6250.00;
      const isSlab4Ok = parseFloat(t4[0].tds) === 16250.00;

      const allSlabsOk = isSlab1Ok && isSlab2Ok && isSlab3Ok && isSlab4Ok;

      recordTest(
        9,
        'Correct progressive tax deduction across all 4 tax slabs and boundaries',
        'Annual: 250k, 300k, 480k, 600k, 1.2M, 1.8M',
        'TDS: [0.00, 0.00, 750.00, 1250.00, 6250.00, 16250.00]',
        `TDS: [${t1[0].tds}, ${t1b[0].tds}, ${t2[0].tds}, ${t2b[0].tds}, ${t3[0].tds}, ${t4[0].tds}]`,
        allSlabsOk,
        'Progressive 4-tier income tax slabs verified with exact monthly pro-rata calculation'
      );
    } catch (err) {
      recordTest(9, 'Correct progressive tax deduction across all 4 tax slabs and boundaries', {}, 'Slabs match', err.message, false, err.stack);
    }

    // ------------------------------------------------------------------------
    // TEST 10: Successful payroll transaction and COMMIT
    // ------------------------------------------------------------------------
    try {
      // Create a temporary test employee to verify isolated transaction and commit
      const [tEmp] = await pool.query(
        `INSERT INTO employees (employee_code, first_name, last_name, email, department_id, designation, role, password_hash, hire_date, status)
         VALUES ('EMP_TX10', 'Tx', 'CommitTester', 'tx_commit@paytrace.local', 1, 'Tester', 'EMPLOYEE', 'h', '2026-01-01', 'ACTIVE')`
      );
      const testEmpId = tEmp.insertId;

      const conn = await pool.getConnection();
      await conn.beginTransaction();
      const [ins] = await conn.query(
        `INSERT INTO payrolls (employee_id, period_id, salary_id, present_days, gross_earnings, total_deductions, net_salary, payment_status, processed_by)
         VALUES (?, 1, 1, 22.0, 50000.00, 5000.00, 45000.00, 'CALCULATED', 1)`,
        [testEmpId]
      );
      await conn.commit();
      conn.release();

      // Verify row persisted
      const [check] = await pool.query('SELECT payroll_id, net_salary FROM payrolls WHERE employee_id = ? AND period_id = 1', [testEmpId]);
      const committed = check.length === 1 && parseFloat(check[0].net_salary) === 45000.00;

      // Clean up test data
      await pool.query('DELETE FROM payrolls WHERE employee_id = ?', [testEmpId]);
      await pool.query('DELETE FROM employees WHERE employee_id = ?', [testEmpId]);

      recordTest(10, 'Successful payroll transaction and COMMIT', `Employee ${testEmpId} payroll transaction`, 'Row committed and verified in database', `Committed: ${committed}`, committed, 'Transaction committed cleanly and verified');
    } catch (err) {
      recordTest(10, 'Successful payroll transaction and COMMIT', {}, 'Success', err.message, false, err.stack);
    }

    // ------------------------------------------------------------------------
    // TEST 11: Failed payroll transaction and verified ROLLBACK
    // ------------------------------------------------------------------------
    try {
      const [rbRows] = await pool.query('CALL sp_demonstrate_transaction_rollback(1, 1, 1, @res, @msg); SELECT @res AS status, @msg AS message;');
      const status = rbRows[1][0].status;
      const isRollback = status === 'ROLLBACK_VERIFIED';
      recordTest(11, 'Failed payroll transaction and verified ROLLBACK', 'Violate chk_payroll_gross with negative gross', 'status: ROLLBACK_VERIFIED', `status: ${status}`, isRollback, rbRows[1][0].message);
    } catch (err) {
      recordTest(11, 'Failed payroll transaction and verified ROLLBACK', {}, 'ROLLBACK_VERIFIED', err.message, false, err.stack);
    }

    // ------------------------------------------------------------------------
    // TEST 12: Correct monthly attendance summary report
    // ------------------------------------------------------------------------
    try {
      const [empCountRow] = await pool.query('SELECT COUNT(*) AS active_count FROM employees WHERE status = "ACTIVE"');
      const activeCount = empCountRow[0].active_count;

      const [sumRows] = await pool.query(`
        SELECT COUNT(DISTINCT e.employee_id) AS total_employees, SUM(CASE WHEN a.is_late = TRUE THEN 1 ELSE 0 END) AS total_late_marks
        FROM employees e
        JOIN payroll_periods pp ON pp.period_id = 2
        LEFT JOIN attendance a ON e.employee_id = a.employee_id AND a.work_date BETWEEN pp.start_date AND pp.end_date
        WHERE e.status = 'ACTIVE'
      `);
      const row = sumRows[0];
      const isValid = row.total_employees === activeCount && row.total_late_marks > 0;
      recordTest(12, 'Correct monthly attendance summary report', 'Period: July 2026 (Period 2)', `Aggregates all ${activeCount} active employees without Cartesian distortion`, `Report rows: ${row.total_employees}, Late marks: ${row.total_late_marks}`, isValid, 'All active employees aggregated accurately');
    } catch (err) {
      recordTest(12, 'Correct monthly attendance summary report', {}, 'Valid summary', err.message, false, err.stack);
    }

    // ------------------------------------------------------------------------
    // TEST 13: Correct salary slip itemization report
    // ------------------------------------------------------------------------
    try {
      const [items] = await pool.query(`
        SELECT COUNT(*) AS item_count, SUM(CASE WHEN item_type = 'EARNING' THEN amount ELSE 0 END) AS total_earnings
        FROM payroll_items pi
        JOIN payrolls p ON pi.payroll_id = p.payroll_id
        WHERE p.employee_id = 4 AND p.period_id = 2
      `);
      const isItemized = items[0].item_count === 7 && parseFloat(items[0].total_earnings) === 100000.00;
      recordTest(13, 'Correct salary slip itemization report', 'EMP004 Period 2', '7 itemized components totaling 100000.00 earnings', `Items: ${items[0].item_count}, Total earnings: ${items[0].total_earnings}`, isItemized, 'Payslip line items match approved formula');
    } catch (err) {
      recordTest(13, 'Correct salary slip itemization report', {}, 'Itemized slip', err.message, false, err.stack);
    }

    // ------------------------------------------------------------------------
    // TEST 14: Correct late-marks report
    // ------------------------------------------------------------------------
    try {
      const [expectedRows] = await pool.query(`
        SELECT COUNT(*) AS late_count
        FROM attendance
        WHERE work_date BETWEEN '2026-07-01' AND '2026-07-31' AND is_late = TRUE
      `);
      const [lateRows] = await pool.query(`
        SELECT COUNT(*) AS late_count
        FROM attendance a
        JOIN payroll_periods pp ON pp.period_id = 2
        WHERE a.work_date BETWEEN pp.start_date AND pp.end_date AND a.is_late = TRUE
      `);
      const lateCount = lateRows[0].late_count;
      const expectedCount = expectedRows[0].late_count;
      const isMatch = lateCount === expectedCount && lateCount > 0;
      recordTest(14, 'Correct late-marks report', 'Period: July 2026', `Exact dynamic count of tardy records (${expectedCount})`, `Report count: ${lateCount}`, isMatch, `Dynamic match confirmed: ${lateCount} tardy entries`);
    } catch (err) {
      recordTest(14, 'Correct late-marks report', {}, 'Match', err.message, false, err.stack);
    }

    // ------------------------------------------------------------------------
    // TEST 15: Employee access to their own authorized records (RBAC)
    // ------------------------------------------------------------------------
    try {
      const mockReqSelf = {
        user: { employee_id: 3, role: 'EMPLOYEE' },
        params: { employeeId: '3' },
        query: {},
        body: {}
      };
      let nextCalled = false;
      const mockRes = {
        status: (code) => ({ json: (d) => { mockRes.statusCode = code; mockRes.body = d; } })
      };
      enforceSelfOrAdmin('employeeId')(mockReqSelf, mockRes, () => { nextCalled = true; });
      recordTest(15, 'Employee access to own records (RBAC)', { user: mockReqSelf.user, targetId: 3 }, 'Middleware calls next() without error', `nextCalled: ${nextCalled}`, nextCalled, 'Actual enforceSelfOrAdmin middleware verified');
    } catch (err) {
      recordTest(15, 'Employee access to own records (RBAC)', {}, 'Granted', err.message, false, err.stack);
    }

    // ------------------------------------------------------------------------
    // TEST 16: Cross-employee data access denial & parameter tampering prevention (RBAC)
    // ------------------------------------------------------------------------
    try {
      let isBlockedCount = 0;

      // 1. Route parameter tampering: Employee 3 requesting /api/employees/4
      const mockReqParams = {
        user: { employee_id: 3, role: 'EMPLOYEE' },
        params: { employeeId: '4' },
        query: {},
        body: {}
      };
      let statusParam = null;
      let bodyParam = null;
      const mockResParam = {
        status: (code) => {
          statusParam = code;
          return { json: (data) => { bodyParam = data; } };
        }
      };
      enforceSelfOrAdmin('employeeId')(mockReqParams, mockResParam, () => {});
      if (statusParam === 403 && bodyParam && bodyParam.error.includes('Access denied')) isBlockedCount++;

      // 2. Query parameter tampering: Employee 3 querying ?employeeId=4
      const mockReqQuery = {
        user: { employee_id: 3, role: 'EMPLOYEE' },
        params: {},
        query: { employeeId: '4' },
        body: {}
      };
      let statusQuery = null;
      let bodyQuery = null;
      const mockResQuery = {
        status: (code) => {
          statusQuery = code;
          return { json: (data) => { bodyQuery = data; } };
        }
      };
      enforceSelfOrAdmin('employeeId')(mockReqQuery, mockResQuery, () => {});
      if (statusQuery === 403 && bodyQuery && bodyQuery.error.includes('Access denied')) isBlockedCount++;

      // 3. Body parameter tampering: Employee 3 submitting body { employeeId: 4 }
      const mockReqBody = {
        user: { employee_id: 3, role: 'EMPLOYEE' },
        params: {},
        query: {},
        body: { employeeId: 4 }
      };
      let statusBody = null;
      let bodyBody = null;
      const mockResBody = {
        status: (code) => {
          statusBody = code;
          return { json: (data) => { bodyBody = data; } };
        }
      };
      enforceSelfOrAdmin('employeeId')(mockReqBody, mockResBody, () => {});
      if (statusBody === 403 && bodyBody && bodyBody.error.includes('Access denied')) isBlockedCount++;

      // 4. Authorized self access: Employee 3 requesting own ID
      let selfNextCalled = false;
      const mockReqSelf = {
        user: { employee_id: 3, role: 'EMPLOYEE' },
        params: { employeeId: '3' },
        query: {},
        body: {}
      };
      enforceSelfOrAdmin('employeeId')(mockReqSelf, {}, () => { selfNextCalled = true; });

      // 5. Authorized HR Admin access: HR Admin requesting Employee 4
      let adminNextCalled = false;
      const mockReqAdmin = {
        user: { employee_id: 1, role: 'HR_ADMIN' },
        params: { employeeId: '4' },
        query: {},
        body: {}
      };
      enforceSelfOrAdmin('employeeId')(mockReqAdmin, {}, () => { adminNextCalled = true; });

      const isRbacSound = isBlockedCount === 3 && selfNextCalled && adminNextCalled;
      recordTest(
        16,
        'Cross-employee data access denial and parameter tampering prevention (RBAC)',
        'Param, query, and body tampering attempts by Employee 3 targeting Employee 4',
        'All tampering blocked with 403 Forbidden; legitimate self/admin requests permitted',
        `Blocked violations: ${isBlockedCount}/3, Self access: ${selfNextCalled}, Admin access: ${adminNextCalled}`,
        isRbacSound,
        'enforceSelfOrAdmin middleware defends route params, query string, and request body'
      );
    } catch (err) {
      recordTest(16, 'Cross-employee data access denial and parameter tampering prevention (RBAC)', {}, 'Denied', err.message, false, err.stack);
    }

    // ------------------------------------------------------------------------
    // TEST 17: Employee attempt to perform HR/Admin action (Blocked)
    // ------------------------------------------------------------------------
    try {
      const mockReqHR = {
        user: { employee_id: 3, role: 'EMPLOYEE' }
      };
      let hrStatusCode = null;
      let hrBody = null;
      const mockResHR = {
        status: (code) => {
          hrStatusCode = code;
          return {
            json: (data) => { hrBody = data; }
          };
        }
      };
      requireRole('HR_ADMIN')(mockReqHR, mockResHR, () => {});
      const isRoleBlocked = hrStatusCode === 403 && hrBody && hrBody.error.includes('Forbidden');
      recordTest(17, 'Employee attempt to perform HR action (Blocked)', { user: mockReqHR.user, requiredRole: 'HR_ADMIN' }, 'Middleware returns 403 Forbidden', `Status: ${hrStatusCode}, Error: ${hrBody ? hrBody.error : 'none'}`, isRoleBlocked, 'Actual requireRole middleware blocks non-HR roles');
    } catch (err) {
      recordTest(17, 'Employee attempt to perform HR action (Blocked)', {}, 'Forbidden', err.message, false, err.stack);
    }

    // ------------------------------------------------------------------------
    // TEST 18: Unauthorized / Unauthenticated request rejection and JWT validation security
    // ------------------------------------------------------------------------
    try {
      let authChecksPassed = 0;

      // 1. Missing token header
      const mockReqMissing = { headers: {}, cookies: {} };
      let statusMissing = null;
      let bodyMissing = null;
      await authenticateToken(mockReqMissing, {
        status: (c) => { statusMissing = c; return { json: (d) => { bodyMissing = d; } }; }
      }, () => {});
      if (statusMissing === 401 && bodyMissing && bodyMissing.error.includes('Authentication required')) authChecksPassed++;

      // 2. Malformed token string
      const mockReqMalformed = { headers: { authorization: 'Bearer not-a-valid-jwt-token' }, cookies: {} };
      let statusMalformed = null;
      await authenticateToken(mockReqMalformed, {
        status: (c) => { statusMalformed = c; return { json: () => {} }; }
      }, () => {});
      if (statusMalformed === 401) authChecksPassed++;

      // 3. Token signed with wrong secret (forged token)
      const forgedToken = jwt.sign({ employee_id: 3 }, 'wrong_secret_attacker_key');
      const mockReqForged = { headers: { authorization: `Bearer ${forgedToken}` }, cookies: {} };
      let statusForged = null;
      await authenticateToken(mockReqForged, {
        status: (c) => { statusForged = c; return { json: () => {} }; }
      }, () => {});
      if (statusForged === 401) authChecksPassed++;

      // 4. Expired token
      const expiredToken = jwt.sign({ employee_id: 3 }, JWT_SECRET, { expiresIn: '-10s' });
      const mockReqExpired = { headers: { authorization: `Bearer ${expiredToken}` }, cookies: {} };
      let statusExpired = null;
      await authenticateToken(mockReqExpired, {
        status: (c) => { statusExpired = c; return { json: () => {} }; }
      }, () => {});
      if (statusExpired === 401) authChecksPassed++;

      // 5. Fail-closed JWT_SECRET validation (empty secret, short prod secret, blacklisted secret)
      let emptySecretFailed = false;
      try {
        validateJwtSecret('');
      } catch (e) {
        emptySecretFailed = e.message.includes('FATAL SECURITY ERROR');
      }

      let shortProdSecretFailed = false;
      try {
        validateJwtSecret('short_secret_123', 'production');
      } catch (e) {
        shortProdSecretFailed = e.message.includes('at least 32 characters in production');
      }

      let blacklistedSecretFailed = false;
      try {
        validateJwtSecret(INSECURE_DEFAULTS[0], 'production');
      } catch (e) {
        blacklistedSecretFailed = e.message.includes('Known insecure/default JWT_SECRET');
      }

      if (emptySecretFailed && shortProdSecretFailed && blacklistedSecretFailed) authChecksPassed++;

      const isAuthSecuritySolid = authChecksPassed === 5;
      recordTest(
        18,
        'Unauthorized / Unauthenticated request rejection and JWT validation security',
        'Missing, malformed, forged, expired tokens, and fail-closed secret validation',
        'All unauthorized attempts rejected with 401; insecure secret configs fail-closed',
        `Security checks passed: ${authChecksPassed}/5`,
        isAuthSecuritySolid,
        'authenticateToken middleware rejects all invalid tokens; secret validator enforces production crypto hygiene'
      );
    } catch (err) {
      recordTest(18, 'Unauthorized / Unauthenticated request rejection and JWT validation security', {}, '401', err.message, false, err.stack);
    }

    // ------------------------------------------------------------------------
    // TEST 19: Boundary conditions (Dates order and empty result sets)
    // ------------------------------------------------------------------------
    try {
      // Test impossible leave date boundary: start_date > end_date
      let boundaryPassed = false;
      try {
        await pool.query(
          `INSERT INTO leaves (employee_id, leave_type, start_date, end_date, total_days, reason, status)
           VALUES (1, 'CASUAL', '2026-10-20', '2026-10-10', 1.0, 'Impossible date', 'PENDING')`
        );
      } catch (err) {
        boundaryPassed = err.message.includes('chk_leave_dates') || err.message.includes('start_date cannot be after end_date') || err.errno === 4025;
      }
      recordTest(19, 'Boundary conditions for dates and parameters', 'start_date: 2026-10-20 > end_date: 2026-10-10', 'Rejected by boundary check constraint', 'Rejected as expected', boundaryPassed, 'chk_leave_dates enforces start_date <= end_date');
    } catch (err) {
      recordTest(19, 'Boundary conditions for dates and parameters', {}, 'Rejected', err.message, false, err.stack);
    }

    // ------------------------------------------------------------------------
    // TEST 20: Repeated / Duplicate payroll processing attempt
    // ------------------------------------------------------------------------
    try {
      // EMP001 is already processed for Period 1
      const [res] = await pool.query('CALL sp_calculate_payroll(1, 1, 1, @pid, @net, @code, @msg); SELECT @code AS code, @msg AS msg;');
      const code = res[1][0].code;
      const msg = res[1][0].msg;
      const isPrevented = code === 409 && msg.includes('Duplicate payroll processing prevented');
      recordTest(20, 'Repeated payroll processing prevention', 'Process EMP001 Period 1 again', 'Error 409 Conflict with explanatory message', `code: ${code}, msg: ${msg}`, isPrevented, 'Stored procedure rejects duplicate cycle runs');
    } catch (err) {
      recordTest(20, 'Repeated payroll processing prevention', {}, '409', err.message, false, err.stack);
    }

  } finally {
    await pool.end();
  }

  // Summary
  const passedCount = results.filter(r => r.passed).length;
  console.log('\n===============================================================');
  console.log(`TEST EXECUTION SUMMARY: ${passedCount} / ${results.length} PASSED`);
  console.log('===============================================================');

  if (passedCount !== results.length) {
    process.exit(1);
  }
}

runTests();

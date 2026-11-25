// ============================================================================
// PayTrace: Automated Regression, Security & HTTP Integration Test Suite
// Covers:
//   - Section 1 (SQL): Database schema constraints, triggers, functions,
//     procedures, roles, transactions, and Phase 3 reports.
//   - Section 2 (UNIT): Auth & RBAC middleware unit checks.
//   - Section 3 (HTTP): Live Express API integration tests against MariaDB.
// ============================================================================

const fs = require('fs');
const path = require('path');
const http = require('http');
const mysql = require('mysql2/promise');
const jwt = require('jsonwebtoken');
const dotenv = require('dotenv');

dotenv.config();

const {
  authenticateToken,
  requireRole,
  enforceSelfOrAdmin,
  validateJwtSecret,
  getJwtSecret,
  INSECURE_DEFAULTS
} = require('../src/middleware/auth');
const app = require('../src/app');
const appPool = require('../src/config/db');

const DB_HOST = process.env.DB_HOST || '127.0.0.1';
const DB_PORT = parseInt(process.env.DB_PORT || '3306', 10);
const DB_NAME = process.env.DB_NAME || 'paytrace_db';
const DB_ADMIN_USER = process.env.DB_ADMIN_USER || 'root';
const DB_ADMIN_PASSWORD = process.env.DB_ADMIN_PASSWORD !== undefined ? process.env.DB_ADMIN_PASSWORD : '';

const adminPool = mysql.createPool({
  host: DB_HOST,
  port: DB_PORT,
  user: DB_ADMIN_USER,
  password: DB_ADMIN_PASSWORD,
  database: DB_NAME,
  multipleStatements: true,
  decimalNumbers: true,
  dateStrings: ['DATE']
});

const JWT_SECRET = getJwtSecret();
const results = [];

function recordTest(id, phase, type, name, input, expected, actual, passed, evidence) {
  results.push({ id, phase, type, name, input, expected, actual, passed: Boolean(passed), evidence });
  const mark = passed ? 'PASS' : 'FAIL';
  console.log(`[${mark}] ${id} (${type} | ${phase}): ${name}`);
  if (!passed) {
    console.error(`   Expected: ${expected}`);
    console.error(`   Actual:   ${actual}`);
  }
}

function extractCookies(setCookieHeaders) {
  const jar = {};
  for (const h of setCookieHeaders || []) {
    const first = h.split(';')[0];
    const eq = first.indexOf('=');
    if (eq > 0) jar[first.slice(0, eq).trim()] = first.slice(eq + 1).trim();
  }
  return jar;
}

async function apiReq(baseUrl, reqPath, method = 'GET', jar = null, body = null, includeCsrf = true) {
  const headers = {};
  if (jar && Object.keys(jar).length > 0) {
    headers['Cookie'] = Object.entries(jar).map(([k, v]) => `${k}=${v}`).join('; ');
    if (includeCsrf && jar.csrf_token) {
      headers['X-CSRF-Token'] = jar.csrf_token;
    }
  }
  if (body !== null) headers['Content-Type'] = 'application/json';
  const res = await fetch(`${baseUrl}${reqPath}`, {
    method,
    headers,
    body: body !== null ? JSON.stringify(body) : undefined
  });
  const text = await res.text();
  let json = null;
  try { json = JSON.parse(text); } catch (_) { json = text; }
  const setCookies = typeof res.headers.getSetCookie === 'function' ? res.headers.getSetCookie() : [];
  return { status: res.status, body: json, jar: extractCookies(setCookies), headers: Object.fromEntries(res.headers.entries()) };
}

async function runTests() {
  console.log('===============================================================');
  console.log('PAYTRACE: Executing SQL, Unit & HTTP Integration Test Suite');
  console.log(`Database: ${DB_NAME} @ ${DB_HOST}:${DB_PORT}`);
  console.log(`Timestamp: ${new Date().toISOString()}`);
  console.log('===============================================================\n');

  let server = null;
  let baseUrl = '';
  const createdEmpIds = [];

  try {
    // ========================================================================
    // SECTION 1: DATABASE & PROCEDURAL TESTS (SQL INTEGRATION)
    // ========================================================================

    // SQL-01: Valid employee creation
    try {
      const code = 'EMP_T' + (Date.now() % 10000000);
      const email = `valid_${Date.now()}@paytrace.local`;
      const [res] = await adminPool.query(
        `INSERT INTO employees (employee_code, first_name, last_name, email, department_id, designation, role, password_hash, hire_date, status)
         VALUES (?, 'John', 'Tester', ?, 1, 'QA Analyst', 'EMPLOYEE', 'hashed_pwd', '2026-01-01', 'ACTIVE')`,
        [code, email]
      );
      await adminPool.query('DELETE FROM employees WHERE employee_id = ?', [res.insertId]);
      recordTest('SQL-01', 'Phase 1/2', 'SQL', 'Valid employee creation', { code }, 'Insert succeeds', `Inserted id=${res.insertId}`, res.insertId > 0, `ID ${res.insertId}`);
    } catch (err) {
      recordTest('SQL-01', 'Phase 1/2', 'SQL', 'Valid employee creation', {}, 'Success', err.message, false, err.stack);
    }

    // SQL-02: Duplicate employee code rejection
    try {
      await adminPool.query(
        `INSERT INTO employees (employee_code, first_name, last_name, email, department_id, designation, role, password_hash, hire_date)
         VALUES ('EMP001', 'Dup', 'Code', 'dup_code@paytrace.local', 1, 'Dev', 'EMPLOYEE', 'h', '2026-01-01')`
      );
      recordTest('SQL-02', 'Phase 1/2', 'SQL', 'Duplicate employee code rejection', 'EMP001', 'ER_DUP_ENTRY', 'Succeeded', false, 'No error');
    } catch (err) {
      recordTest('SQL-02', 'Phase 1/2', 'SQL', 'Duplicate employee code rejection', 'EMP001', 'ER_DUP_ENTRY', err.code, err.code === 'ER_DUP_ENTRY', err.message);
    }

    // SQL-03: Duplicate email rejection
    try {
      await adminPool.query(
        `INSERT INTO employees (employee_code, first_name, last_name, email, department_id, designation, role, password_hash, hire_date)
         VALUES ('EMP_DUPEMAIL', 'Dup', 'Email', 'alice.morgan@paytrace.local', 1, 'Dev', 'EMPLOYEE', 'h', '2026-01-01')`
      );
      recordTest('SQL-03', 'Phase 1/2', 'SQL', 'Duplicate employee email rejection', 'alice.morgan@paytrace.local', 'ER_DUP_ENTRY', 'Succeeded', false, 'No error');
    } catch (err) {
      recordTest('SQL-03', 'Phase 1/2', 'SQL', 'Duplicate employee email rejection', 'alice.morgan@paytrace.local', 'ER_DUP_ENTRY', err.code, err.code === 'ER_DUP_ENTRY', err.message);
    }

    // SQL-04: Invalid foreign key rejection
    try {
      await adminPool.query(
        `INSERT INTO employees (employee_code, first_name, last_name, email, department_id, designation, role, password_hash, hire_date)
         VALUES ('EMP_BADFK', 'Bad', 'FK', 'badfk@paytrace.local', 9999, 'Dev', 'EMPLOYEE', 'h', '2026-01-01')`
      );
      recordTest('SQL-04', 'Phase 1/2', 'SQL', 'Invalid foreign key rejection', 'department_id=9999', 'FK constraint error', 'Succeeded', false, 'No error');
    } catch (err) {
      recordTest('SQL-04', 'Phase 1/2', 'SQL', 'Invalid foreign key rejection', 'department_id=9999', 'ER_NO_REFERENCED_ROW_2', err.code, err.code === 'ER_NO_REFERENCED_ROW_2', err.message);
    }

    // SQL-05: Negative salary rejection
    try {
      await adminPool.query(
        `INSERT INTO salary_structures (employee_id, basic_salary, effective_date) VALUES (1, -5000.00, '2026-09-01')`
      );
      recordTest('SQL-05', 'Phase 1/2', 'SQL', 'Negative salary rejection', 'basic_salary=-5000', 'CHECK failure', 'Succeeded', false, 'No error');
    } catch (err) {
      const ok = err.message.includes('chk_salary_basic') || err.errno === 4025;
      recordTest('SQL-05', 'Phase 1/2', 'SQL', 'Negative salary rejection', 'basic_salary=-5000', 'chk_salary_basic violation', err.message, ok, err.message);
    }

    // SQL-06: Zero salary boundary
    try {
      const [zEmp] = await adminPool.query(
        `INSERT INTO employees (employee_code, first_name, last_name, email, department_id, designation, role, password_hash, hire_date, status)
         VALUES ('EMP_ZSAL', 'Zero', 'Sal', 'zerosal@paytrace.local', 1, 'Intern', 'EMPLOYEE', 'h', '2026-01-01', 'ACTIVE')`
      );
      createdEmpIds.push(zEmp.insertId);
      await adminPool.query(
        `INSERT INTO salary_structures (employee_id, basic_salary, hra, special_allowance, provident_fund, professional_tax, effective_date, is_active)
         VALUES (?, 0.00, 0.00, 0.00, 0.00, 0.00, '2026-01-01', TRUE)`,
        [zEmp.insertId]
      );
      await adminPool.query('CALL sp_calculate_payroll(?, 1, 1, @zp, @zn, @zc, @zm)', [zEmp.insertId]);
      const [[zOut]] = await adminPool.query('SELECT @zp AS pid, @zn AS net, @zc AS code');
      recordTest('SQL-06', 'Phase 2', 'SQL', 'Zero salary boundary payroll calculation', { employeeId: zEmp.insertId }, 'code=200, net=0.00', zOut, zOut.code === 200 && zOut.net === 0, JSON.stringify(zOut));
    } catch (err) {
      recordTest('SQL-06', 'Phase 2', 'SQL', 'Zero salary boundary payroll calculation', {}, 'net=0.00', err.message, false, err.stack);
    }

    // SQL-07: Valid attendance, duplicate attendance & invalid time sequence
    try {
      const [ins] = await adminPool.query(
        `INSERT INTO attendance (employee_id, work_date, status, check_in_time, check_out_time)
         VALUES (1, '2026-09-14', 'PRESENT', '09:00:00', '18:00:00')`
      );
      await adminPool.query('DELETE FROM attendance WHERE attendance_id = ?', [ins.insertId]);

      let dupRejected = false;
      try {
        await adminPool.query(`INSERT INTO attendance (employee_id, work_date, status, check_in_time) VALUES (1, '2026-06-01', 'PRESENT', '09:00:00')`);
      } catch (e) { dupRejected = e.code === 'ER_DUP_ENTRY'; }

      let badTimeRejected = false;
      try {
        await adminPool.query(`INSERT INTO attendance (employee_id, work_date, status, check_in_time, check_out_time) VALUES (1, '2026-09-15', 'PRESENT', '18:00:00', '09:00:00')`);
      } catch (e) { badTimeRejected = e.message.includes('check-out time cannot be earlier'); }

      recordTest('SQL-07', 'Phase 2', 'SQL', 'Valid attendance, duplicate guard & invalid time rejection', 'valid + dup + 18:00<09:00', 'All 3 behave per rule', { dupRejected, badTimeRejected }, ins.insertId > 0 && dupRejected && badTimeRejected, 'uq_emp_work_date + trigger');
    } catch (err) {
      recordTest('SQL-07', 'Phase 2', 'SQL', 'Valid attendance, duplicate guard & invalid time rejection', {}, 'Success', err.message, false, err.stack);
    }

    // SQL-08: Exact late-arrival threshold (09:15:00 vs 09:15:01) & stale late-mark reset
    try {
      await adminPool.query(
        `INSERT INTO attendance (employee_id, work_date, status, check_in_time, check_out_time) VALUES
         (1, '2026-09-16', 'PRESENT', '09:15:00', '18:00:00'),
         (1, '2026-09-17', 'PRESENT', '09:15:01', '18:00:00')`
      );
      await adminPool.query(
        `UPDATE attendance SET status = 'ABSENT', check_in_time = NULL, check_out_time = NULL WHERE employee_id = 1 AND work_date = '2026-09-17'`
      );
      const [rows] = await adminPool.query(
        `SELECT work_date, is_late, late_minutes FROM attendance WHERE employee_id = 1 AND work_date IN ('2026-09-16', '2026-09-17') ORDER BY work_date`
      );
      // Also check 09:15:01 on insert before update
      const [ins2] = await adminPool.query(
        `INSERT INTO attendance (employee_id, work_date, status, check_in_time, check_out_time) VALUES (1, '2026-09-18', 'PRESENT', '09:15:01', '18:00:00')`
      );
      const [[lateRow]] = await adminPool.query('SELECT is_late, late_minutes FROM attendance WHERE attendance_id = ?', [ins2.insertId]);
      await adminPool.query("DELETE FROM attendance WHERE employee_id = 1 AND work_date IN ('2026-09-16', '2026-09-17', '2026-09-18')");

      const ok = rows[0].is_late === 0 && rows[0].late_minutes === 0 &&
                 lateRow.is_late === 1 && lateRow.late_minutes === 15 &&
                 rows[1].is_late === 0 && rows[1].late_minutes === 0;
      recordTest('SQL-08', 'Phase 2/3', 'SQL', 'Exact 09:15:00 threshold & stale late-mark reset', '09:15:00, 09:15:01, update->ABSENT', '09:15:00->0, 09:15:01->1(15m), reset->0', { onTime: rows[0], late: lateRow, reset: rows[1] }, ok, 'trg_attendance_before_insert/update');
    } catch (err) {
      recordTest('SQL-08', 'Phase 2/3', 'SQL', 'Exact 09:15:00 threshold & stale late-mark reset', {}, 'Pass', err.message, false, err.stack);
    }

    // SQL-09: Leave range, duration, overlap INSERT & overlap UPDATE
    try {
      // Valid leave + approval
      const [lvIns] = await adminPool.query(
        `INSERT INTO leaves (employee_id, leave_type, start_date, end_date, total_days, reason, status)
         VALUES (5, 'CASUAL', '2026-09-10', '2026-09-11', 2.0, 'Valid test', 'PENDING')`
      );
      await adminPool.query(`UPDATE leaves SET status = 'APPROVED', actioned_by = 1, actioned_on = NOW() WHERE leave_id = ?`, [lvIns.insertId]);
      await adminPool.query('DELETE FROM leaves WHERE leave_id = ?', [lvIns.insertId]);

      // Invalid date range
      let badRange = false;
      try {
        await adminPool.query(`INSERT INTO leaves (employee_id, leave_type, start_date, end_date, total_days, reason) VALUES (1, 'CASUAL', '2026-10-20', '2026-10-10', 1.0, 'Bad')`);
      } catch (e) { badRange = e.message.includes('start_date cannot be after end_date'); }

      // Invalid duration (tampered 0.1 for 5 working days)
      let badDur = false;
      try {
        await adminPool.query(`INSERT INTO leaves (employee_id, leave_type, start_date, end_date, total_days, reason) VALUES (1, 'UNPAID', '2026-10-05', '2026-10-09', 0.1, 'Tamper')`);
      } catch (e) { badDur = e.message.includes('Invalid leave duration'); }

      // Overlap on INSERT (EMP003 has approved leave on 2026-06-12; 2026-06-11..2026-06-15 is 3 Mon-Fri working days)
      let overlapIns = false;
      try {
        await adminPool.query(`INSERT INTO leaves (employee_id, leave_type, start_date, end_date, total_days, reason, status) VALUES (3, 'CASUAL', '2026-06-11', '2026-06-15', 3.0, 'Overlap insert', 'APPROVED')`);
      } catch (e) { overlapIns = e.message.includes('Conflicting leave'); }

      // Overlap on UPDATE
      const [pendLv] = await adminPool.query(
        `INSERT INTO leaves (employee_id, leave_type, start_date, end_date, total_days, reason, status) VALUES (3, 'SICK', '2026-06-12', '2026-06-12', 1.0, 'Overlap update', 'PENDING')`
      );
      let overlapUpd = false;
      try {
        await adminPool.query(`UPDATE leaves SET status = 'APPROVED', actioned_by = 1 WHERE leave_id = ?`, [pendLv.insertId]);
      } catch (e) { overlapUpd = e.message.includes('Conflicting leave'); }
      await adminPool.query('DELETE FROM leaves WHERE leave_id = ?', [pendLv.insertId]);

      const ok = lvIns.insertId > 0 && badRange && badDur && overlapIns && overlapUpd;
      recordTest('SQL-09', 'Phase 2', 'SQL', 'Leave validation: valid, bad range, bad duration, overlap INSERT & UPDATE', '5 cases', 'All 5 enforced', { badRange, badDur, overlapIns, overlapUpd }, ok, 'trg_leaves_before_insert/update');
    } catch (err) {
      recordTest('SQL-09', 'Phase 2', 'SQL', 'Leave validation', {}, 'Pass', err.message, false, err.stack);
    }

    // SQL-10: Cross-month leave allocation, half-day deduction, historical salary selection, excessive deduction cap & duplicate prevention
    try {
      const [regEmp] = await adminPool.query(
        `INSERT INTO employees (employee_code, first_name, last_name, email, department_id, designation, role, password_hash, hire_date, status)
         VALUES ('EMP_REG10', 'Reg', 'Ten', 'reg10@paytrace.local', 1, 'Dev', 'EMPLOYEE', 'h', '2026-01-01', 'ACTIVE')`
      );
      const rId = regEmp.insertId;
      createdEmpIds.push(rId);

      // Historical salary ($50k effective Jan 1, inactive) vs newer ($90k effective Sep 1, active)
      await adminPool.query(
        `INSERT INTO salary_structures (employee_id, basic_salary, hra, special_allowance, provident_fund, professional_tax, effective_date, is_active) VALUES
         (?, 50000.00, 0.00, 0.00, 0.00, 0.00, '2026-01-01', FALSE),
         (?, 90000.00, 0.00, 0.00, 0.00, 0.00, '2026-09-01', TRUE)`,
        [rId, rId]
      );
      // Cross-month UNPAID leave: 2026-07-30 (Thu) to 2026-08-04 (Tue) = 4 working days (2 in July, 2 in Aug)
      await adminPool.query(
        `INSERT INTO leaves (employee_id, leave_type, start_date, end_date, total_days, reason, status, actioned_by)
         VALUES (?, 'UNPAID', '2026-07-30', '2026-08-04', 4.0, 'Cross month', 'APPROVED', 1)`,
        [rId]
      );
      // Half-day in July (2026-07-06) -> +0.5 unpaid in July (total July unpaid = 2.5 days)
      await adminPool.query(
        `INSERT INTO attendance (employee_id, work_date, status, check_in_time, check_out_time) VALUES (?, '2026-07-06', 'HALF_DAY', '09:00:00', '13:00:00')`,
        [rId]
      );

      await adminPool.query('CALL sp_calculate_payroll(?, 2, 1, @rp1, @rn1, @rc1, @rm1)', [rId]);
      await adminPool.query('CALL sp_calculate_payroll(?, 3, 1, @rp2, @rn2, @rc2, @rm2)', [rId]);
      // Duplicate call check
      await adminPool.query('CALL sp_calculate_payroll(?, 2, 1, @dp, @dn, @dc, @dm)', [rId]);
      const [[dupRes]] = await adminPool.query('SELECT @dc AS code');
      const [pRows] = await adminPool.query(
        'SELECT period_id, present_days, unpaid_leave_days, gross_earnings, total_deductions, net_salary FROM payrolls WHERE employee_id = ? ORDER BY period_id',
        [rId]
      );

      // Excessive deduction cap test on another temp emp
      const [capEmp] = await adminPool.query(
        `INSERT INTO employees (employee_code, first_name, last_name, email, department_id, designation, role, password_hash, hire_date, status)
         VALUES ('EMP_CAP', 'Cap', 'Test', 'cap@paytrace.local', 1, 'Dev', 'EMPLOYEE', 'h', '2026-01-01', 'ACTIVE')`
      );
      createdEmpIds.push(capEmp.insertId);
      await adminPool.query(
        `INSERT INTO salary_structures (employee_id, basic_salary, provident_fund, professional_tax, effective_date, is_active) VALUES (?, 10000.00, 1200.00, 200.00, '2026-01-01', TRUE)`,
        [capEmp.insertId]
      );
      await adminPool.query(
        `INSERT INTO leaves (employee_id, leave_type, start_date, end_date, total_days, reason, status, actioned_by)
         VALUES (?, 'UNPAID', '2026-07-01', '2026-07-31', 23.0, 'Full month', 'APPROVED', 1)`,
        [capEmp.insertId]
      );
      await adminPool.query('CALL sp_calculate_payroll(?, 2, 1, @cp, @cn, @cc, @cm)', [capEmp.insertId]);
      const [[capRow]] = await adminPool.query('SELECT gross_earnings, total_deductions, net_salary FROM payrolls WHERE employee_id = ? AND period_id = 2', [capEmp.insertId]);

      const ok = pRows.length === 2 &&
        pRows[0].gross_earnings === 50000 && pRows[0].present_days === 0.5 && pRows[0].unpaid_leave_days === 2.5 &&
        pRows[1].gross_earnings === 50000 && pRows[1].unpaid_leave_days === 2.0 &&
        dupRes.code === 409 &&
        capRow.gross_earnings === 10000 && capRow.total_deductions === 10000 && capRow.net_salary === 0;
      recordTest('SQL-10', 'Phase 2', 'SQL', 'Cross-month leave, half-day, effective salary, duplicate 409 & deduction cap', 'Reg10 + Cap', 'Prorated, historical $50k, 409 dup, capped $10k', { pRows, dupRes, capRow }, ok, 'sp_calculate_payroll');
    } catch (err) {
      recordTest('SQL-10', 'Phase 2', 'SQL', 'Cross-month leave, half-day, effective salary & cap', {}, 'Pass', err.message, false, err.stack);
    }

    // SQL-11: Baseline sample data & tax slab boundaries
    try {
      const [[emp4]] = await adminPool.query('SELECT gross_earnings, total_deductions, net_salary, late_days FROM payrolls WHERE employee_id = 4 AND period_id = 2');
      const [[emp8]] = await adminPool.query('SELECT gross_earnings, total_deductions, net_salary FROM payrolls WHERE employee_id = 8 AND period_id = 1');
      const [[emp11]] = await adminPool.query('SELECT gross_earnings, total_deductions, net_salary FROM payrolls WHERE employee_id = 11 AND period_id = 1');
      const [[slabs]] = await adminPool.query(`SELECT
        fn_calculate_monthly_tds(300000) AS t300,
        fn_calculate_monthly_tds(600000) AS t600,
        fn_calculate_monthly_tds(1200000) AS t1200,
        fn_calculate_monthly_tds(1800000) AS t1800`);
      const ok = emp4.net_salary === 79228.25 && emp4.late_days === 6 &&
                 emp8.net_salary === 74591.82 && emp11.net_salary === 48850.00 &&
                 slabs.t300 === 0 && slabs.t600 === 1250 && slabs.t1200 === 6250 && slabs.t1800 === 16250;
      recordTest('SQL-11', 'Phase 2', 'SQL', 'Baseline salary calculations & progressive TDS slabs', 'EMP004/008/011 + 4 slabs', 'Exact match', { emp4, emp8, emp11, slabs }, ok, 'Verified against seed & fn_calculate_monthly_tds');
    } catch (err) {
      recordTest('SQL-11', 'Phase 2', 'SQL', 'Baseline salary calculations & TDS', {}, 'Match', err.message, false, err.stack);
    }

    // SQL-12: Transaction COMMIT and Multi-Step ROLLBACK
    try {
      const conn = await adminPool.getConnection();
      await conn.beginTransaction();
      await conn.query("INSERT INTO departments (department_name) VALUES ('__COMMIT_PROBE__')");
      await conn.commit();
      conn.release();
      const [[committed]] = await adminPool.query("SELECT COUNT(*) AS cnt FROM departments WHERE department_name = '__COMMIT_PROBE__'");
      await adminPool.query("DELETE FROM departments WHERE department_name = '__COMMIT_PROBE__'");

      await adminPool.query('CALL sp_demonstrate_transaction_rollback(1, 1, 1, @rs, @rm)');
      const [[rb]] = await adminPool.query('SELECT @rs AS status');
      const [[probe]] = await adminPool.query("SELECT COUNT(*) AS cnt FROM departments WHERE department_name = '__ROLLBACK_PROBE_DEPT__'");
      recordTest('SQL-12', 'Phase 4', 'SQL', 'Transaction COMMIT & Multi-Step ROLLBACK', 'Commit + sp_demonstrate_transaction_rollback', 'Committed=1, Rollback=ROLLBACK_VERIFIED & probe=0', { committed: committed.cnt, rb: rb.status, probe: probe.cnt }, committed.cnt === 1 && rb.status === 'ROLLBACK_VERIFIED' && probe.cnt === 0, 'ACID verified');
    } catch (err) {
      recordTest('SQL-12', 'Phase 4', 'SQL', 'Transaction COMMIT & ROLLBACK', {}, 'Pass', err.message, false, err.stack);
    }

    // SQL-13: Phase 3 indexes installed & report SQL execution
    try {
      const [idxRows] = await adminPool.query(
        `SELECT INDEX_NAME FROM information_schema.STATISTICS WHERE TABLE_SCHEMA = ? AND INDEX_NAME LIKE 'idx_%' GROUP BY INDEX_NAME`,
        [DB_NAME]
      );
      const reportSql = fs.readFileSync(path.join(__dirname, '../database/reports.sql'), 'utf8');
      await adminPool.query(reportSql);
      recordTest('SQL-13', 'Phase 3', 'SQL', 'Phase 3 indexes installed & database/reports.sql executes cleanly', '4 indexes + reports.sql', '4 idx_* indexes + exit 0', { indexes: idxRows.map(r => r.INDEX_NAME) }, idxRows.length === 4, 'information_schema.STATISTICS');
    } catch (err) {
      recordTest('SQL-13', 'Phase 3', 'SQL', 'Phase 3 indexes & reports.sql', {}, 'Pass', err.message, false, err.stack);
    }

    // SQL-14: Least-privilege database roles verification
    try {
      const appTestConn = await mysql.createConnection({
        host: DB_HOST, port: DB_PORT,
        user: process.env.DB_USER || 'paytrace_app',
        password: process.env.DB_PASSWORD !== undefined ? process.env.DB_PASSWORD : 'PayTrace_App_2026!',
        database: DB_NAME
      });
      let deleteBlocked = false;
      try { await appTestConn.query('DELETE FROM employees WHERE employee_id = 999999'); } catch (e) { deleteBlocked = e.errno === 1142; }
      await appTestConn.end();

      const readerConn = await mysql.createConnection({
        host: DB_HOST, port: DB_PORT,
        user: 'paytrace_reader', password: 'PayTrace_Read_2026!', database: DB_NAME
      });
      const [vw] = await readerConn.query('SELECT COUNT(*) AS cnt FROM vw_employee_self_profile');
      let rawEmpBlocked = false;
      try { await readerConn.query('SELECT * FROM employees LIMIT 1'); } catch (e) { rawEmpBlocked = e.errno === 1142; }
      await readerConn.end();

      recordTest('SQL-14', 'Phase 4', 'SQL', 'Least-privilege DB accounts (paytrace_app & paytrace_reader)', 'DELETE on app + raw table on reader', 'Both denied (1142); view readable', { deleteBlocked, rawEmpBlocked, viewCount: vw[0].cnt }, deleteBlocked && rawEmpBlocked && vw[0].cnt >= 12, 'database/security.sql');
    } catch (err) {
      recordTest('SQL-14', 'Phase 4', 'SQL', 'Least-privilege DB accounts', {}, 'Pass', err.message, false, err.stack);
    }

    // Clean up temporary SQL employees before HTTP tests so baseline is clean (12 employees)
    for (const id of createdEmpIds) {
      await adminPool.query('DELETE FROM payrolls WHERE employee_id = ?', [id]);
      await adminPool.query('DELETE FROM leaves WHERE employee_id = ?', [id]);
      await adminPool.query('DELETE FROM attendance WHERE employee_id = ?', [id]);
      await adminPool.query('DELETE FROM employees WHERE employee_id = ?', [id]);
    }
    createdEmpIds.length = 0;

    // ========================================================================
    // SECTION 2: SECURITY MIDDLEWARE UNIT TESTS
    // ========================================================================

    // UNIT-01: enforceSelfOrAdmin self vs cross-employee vs admin
    try {
      let selfOk = false;
      enforceSelfOrAdmin('employeeId')({ user: { employee_id: 3, role: 'EMPLOYEE' }, params: { employeeId: '3' }, query: {}, body: {} }, {}, () => { selfOk = true; });
      let crossStatus = null;
      enforceSelfOrAdmin('employeeId')({ user: { employee_id: 3, role: 'EMPLOYEE' }, params: { employeeId: '4' }, query: {}, body: {} }, { status: c => { crossStatus = c; return { json: () => {} }; } }, () => {});
      let adminOk = false;
      enforceSelfOrAdmin('employeeId')({ user: { employee_id: 1, role: 'HR_ADMIN' }, params: { employeeId: '4' }, query: {}, body: {} }, {}, () => { adminOk = true; });
      recordTest('UNIT-01', 'Phase 4', 'UNIT', 'enforceSelfOrAdmin self, cross-employee & admin', 'params.employeeId', 'self=true, cross=403, admin=true', { selfOk, crossStatus, adminOk }, selfOk && crossStatus === 403 && adminOk, 'auth.js');
    } catch (err) {
      recordTest('UNIT-01', 'Phase 4', 'UNIT', 'enforceSelfOrAdmin', {}, 'Pass', err.message, false, err.stack);
    }

    // UNIT-02: requireRole & validateJwtSecret fail-closed checks
    try {
      let roleStatus = null;
      requireRole('HR_ADMIN')({ user: { employee_id: 3, role: 'EMPLOYEE' } }, { status: c => { roleStatus = c; return { json: () => {} }; } }, () => {});
      let emptyThrows = false;
      let shortThrows = false;
      let blackThrows = false;
      try { validateJwtSecret(''); } catch (_) { emptyThrows = true; }
      try { validateJwtSecret('too_short'); } catch (_) { shortThrows = true; }
      try { validateJwtSecret(INSECURE_DEFAULTS[0]); } catch (_) { blackThrows = true; }
      recordTest('UNIT-02', 'Phase 4', 'UNIT', 'requireRole & fail-closed validateJwtSecret', 'EMPLOYEE + weak secrets', '403 + all weak secrets throw', { roleStatus, emptyThrows, shortThrows, blackThrows }, roleStatus === 403 && emptyThrows && shortThrows && blackThrows, 'auth.js');
    } catch (err) {
      recordTest('UNIT-02', 'Phase 4', 'UNIT', 'requireRole & validateJwtSecret', {}, 'Pass', err.message, false, err.stack);
    }

    // ========================================================================
    // SECTION 3: LIVE EXPRESS HTTP INTEGRATION TESTS
    // ========================================================================
    server = http.createServer(app);
    await new Promise(resolve => server.listen(0, '127.0.0.1', resolve));
    const addr = server.address();
    baseUrl = `http://127.0.0.1:${addr.port}`;

    // HTTP-01: HR & Employee login, invalid credentials, inactive account, missing/forged/expired JWT
    const hrLogin = await apiReq(baseUrl, '/api/auth/login', 'POST', null, { email: 'alice.morgan@paytrace.local', password: 'Admin123!' });
    const empLogin = await apiReq(baseUrl, '/api/auth/login', 'POST', null, { email: 'david.miller@paytrace.local', password: 'Employee123!' });
    const badCreds = await apiReq(baseUrl, '/api/auth/login', 'POST', null, { email: 'alice.morgan@paytrace.local', password: 'WrongPassword!' });
    const noJwt = await apiReq(baseUrl, '/api/employees', 'GET');
    const forgedJwt = jwt.sign({ employee_id: 1 }, 'wrong_secret_key_for_test_1234567890');
    const forgedRes = await fetch(`${baseUrl}/api/employees`, { headers: { Authorization: `Bearer ${forgedJwt}` } });
    const expiredJwt = jwt.sign({ employee_id: 1 }, JWT_SECRET, { expiresIn: '-10s' });
    const expiredRes = await fetch(`${baseUrl}/api/employees`, { headers: { Authorization: `Bearer ${expiredJwt}` } });

    // Inactive account login & token rejection
    await adminPool.query("UPDATE employees SET status = 'INACTIVE' WHERE employee_id = 12");
    const inactiveLogin = await apiReq(baseUrl, '/api/auth/login', 'POST', null, { email: 'marcus.vance@paytrace.local', password: 'Employee123!' });
    const inactiveJwt = jwt.sign({ employee_id: 12 }, JWT_SECRET, { expiresIn: '1h' });
    const inactiveAccess = await fetch(`${baseUrl}/api/auth/me`, { headers: { Authorization: `Bearer ${inactiveJwt}` } });
    await adminPool.query("UPDATE employees SET status = 'ACTIVE' WHERE employee_id = 12");

    const http01Ok = hrLogin.status === 200 && !hrLogin.body.token && Boolean(hrLogin.jar.token) &&
      empLogin.status === 200 && badCreds.status === 401 && noJwt.status === 401 &&
      forgedRes.status === 401 && expiredRes.status === 401 &&
      inactiveLogin.status === 403 && inactiveAccess.status === 401;
    recordTest('HTTP-01', 'Phase 4/5', 'HTTP', 'Auth flows: login, bad creds, missing/forged/expired JWT & inactive user', 'authRoutes', '200/401/403 exact', {
      hr: hrLogin.status, emp: empLogin.status, bad: badCreds.status, noJwt: noJwt.status,
      forged: forgedRes.status, expired: expiredRes.status, inactiveLogin: inactiveLogin.status, inactiveAccess: inactiveAccess.status
    }, http01Ok, 'Live Express /api/auth/*');

    // HTTP-02: Employee read-only enforcement (all writes blocked 403) & CSRF check
    const writeAttempts = [
      await apiReq(baseUrl, '/api/employees', 'POST', empLogin.jar, { employee_code: 'HACK' }),
      await apiReq(baseUrl, '/api/employees/3', 'PUT', empLogin.jar, { first_name: 'Hack' }),
      await apiReq(baseUrl, '/api/attendance', 'POST', empLogin.jar, { employee_id: 3, work_date: '2026-09-01', status: 'PRESENT' }),
      await apiReq(baseUrl, '/api/attendance/clock-in', 'POST', empLogin.jar, {}),
      await apiReq(baseUrl, '/api/leaves', 'POST', empLogin.jar, { employee_id: 3, leave_type: 'CASUAL', start_date: '2026-09-01', end_date: '2026-09-01', reason: 'x' }),
      await apiReq(baseUrl, '/api/leaves/10/status', 'PUT', empLogin.jar, { status: 'APPROVED' }),
      await apiReq(baseUrl, '/api/salary/3', 'POST', empLogin.jar, { basic_salary: 999999, effective_date: '2026-09-01' }),
      await apiReq(baseUrl, '/api/payroll/process', 'POST', empLogin.jar, { periodId: 1 }),
      await apiReq(baseUrl, '/api/reports/attendance-summary?periodId=2', 'GET', empLogin.jar),
      await apiReq(baseUrl, '/api/audit-logs', 'GET', empLogin.jar)
    ];
    const noCsrf = await apiReq(baseUrl, '/api/employees', 'POST', hrLogin.jar, { employee_code: 'X' }, false);
    recordTest('HTTP-02', 'Phase 4', 'HTTP', 'Employee business-write denial, admin route denial & CSRF guard', '10 emp attempts + missing CSRF', 'All 403', { statuses: writeAttempts.map(r => r.status), noCsrf: noCsrf.status }, writeAttempts.every(r => r.status === 403) && noCsrf.status === 403, 'Live Express RBAC');

    // HTTP-03: Horizontal isolation & authorized self-access
    const crossReads = [
      await apiReq(baseUrl, '/api/employees/4', 'GET', empLogin.jar),
      await apiReq(baseUrl, '/api/attendance?employeeId=4', 'GET', empLogin.jar),
      await apiReq(baseUrl, '/api/leaves?employeeId=4', 'GET', empLogin.jar),
      await apiReq(baseUrl, '/api/payroll?employeeId=4', 'GET', empLogin.jar),
      await apiReq(baseUrl, '/api/payroll/slip/16', 'GET', empLogin.jar),
      await apiReq(baseUrl, '/api/salary/4', 'GET', empLogin.jar)
    ];
    const selfPay = await apiReq(baseUrl, '/api/payroll', 'GET', empLogin.jar);
    const selfSlipId = selfPay.body.payrolls[0].payroll_id;
    const selfReads = [
      await apiReq(baseUrl, '/api/employees/3', 'GET', empLogin.jar),
      await apiReq(baseUrl, '/api/attendance', 'GET', empLogin.jar),
      await apiReq(baseUrl, '/api/leaves', 'GET', empLogin.jar),
      await apiReq(baseUrl, `/api/payroll/slip/${selfSlipId}`, 'GET', empLogin.jar),
      await apiReq(baseUrl, '/api/salary/3', 'GET', empLogin.jar)
    ];
    recordTest('HTTP-03', 'Phase 4', 'HTTP', 'Cross-employee denial (403) & authorized self-access (200)', 'EMP003 -> EMP004 vs self', '6x403, 5x200', { cross: crossReads.map(r => r.status), self: selfReads.map(r => r.status) }, crossReads.every(r => r.status === 403) && selfReads.every(r => r.status === 200), 'Live Express horizontal RBAC');

    // HTTP-04: Input validation & negative salary transaction rollback via HTTP
    const badInputs = [
      await apiReq(baseUrl, '/api/employees/me', 'GET', hrLogin.jar),
      await apiReq(baseUrl, '/api/reports/attendance-summary?periodId=abc', 'GET', hrLogin.jar),
      await apiReq(baseUrl, '/api/reports/attendance-summary?periodId=999', 'GET', hrLogin.jar),
      await apiReq(baseUrl, '/api/payroll/slip/abc', 'GET', hrLogin.jar),
      await apiReq(baseUrl, '/api/leaves/999999/status', 'PUT', hrLogin.jar, { status: 'APPROVED' }),
      await apiReq(baseUrl, '/api/payroll/process', 'POST', hrLogin.jar, { periodId: 999 }),
      await apiReq(baseUrl, '/api/leaves', 'POST', hrLogin.jar, { employee_id: 3, leave_type: 'UNPAID', start_date: '2026-09-07', end_date: '2026-09-11', total_days: 0.1, reason: 'tamper' }),
      await apiReq(baseUrl, '/api/employees', 'POST', hrLogin.jar, { employee_code: 'EMP_HNEG', first_name: 'Neg', last_name: 'Test', email: 'hneg@paytrace.local', department_id: 1, designation: 'QA', role: 'EMPLOYEE', password: 'Password123!', hire_date: '2026-06-01', basic_salary: -100 })
    ];
    const [[negCheck]] = await adminPool.query("SELECT COUNT(*) AS cnt FROM employees WHERE employee_code = 'EMP_HNEG'");
    const expectedStatuses = [400, 400, 404, 400, 404, 404, 400, 400];
    const actualStatuses = badInputs.map(r => r.status);
    recordTest('HTTP-04', 'Phase 4', 'HTTP', 'Invalid params, leave tampering & negative salary rollback', '8 invalid requests', expectedStatuses.join(','), actualStatuses.join(','), JSON.stringify(actualStatuses) === JSON.stringify(expectedStatuses) && negCheck.cnt === 0, 'No 500s or residual rows');

    // HTTP-05: Full HR lifecycle & report responses via HTTP
    const createH = await apiReq(baseUrl, '/api/employees', 'POST', hrLogin.jar, {
      employee_code: 'EMP_HTTP', first_name: 'Http', last_name: 'User', email: 'http.user@paytrace.local',
      department_id: 1, designation: 'QA', role: 'EMPLOYEE', password: 'HttpUser123!', hire_date: '2026-06-01',
      basic_salary: 60000, hra: 24000, special_allowance: 6000, provident_fund: 7200, professional_tax: 200
    });
    const hId = createH.body.employee_id;
    if (hId) createdEmpIds.push(hId);

    const updH = await apiReq(baseUrl, `/api/employees/${hId}`, 'PUT', hrLogin.jar, {
      first_name: 'HttpUpd', last_name: 'User', email: 'http.user@paytrace.local', phone: '+1-555-0188',
      department_id: 1, designation: 'Senior QA', role: 'EMPLOYEE', status: 'ACTIVE'
    });
    const procSingle = await apiReq(baseUrl, '/api/payroll/process', 'POST', hrLogin.jar, { periodId: 3, employeeId: hId });
    const procBulk = await apiReq(baseUrl, '/api/payroll/process', 'POST', hrLogin.jar, { periodId: 3 });
    const rep1 = await apiReq(baseUrl, '/api/reports/attendance-summary?periodId=2', 'GET', hrLogin.jar);
    const rep2 = await apiReq(baseUrl, '/api/payroll/slip/16', 'GET', hrLogin.jar);
    const rep3 = await apiReq(baseUrl, '/api/reports/late-marks?periodId=2', 'GET', hrLogin.jar);
    const rbHttp = await apiReq(baseUrl, '/api/payroll/test-rollback', 'POST', hrLogin.jar, {});

    const http05Ok = createH.status === 201 && updH.status === 200 && procSingle.status === 200 &&
      procBulk.status === 200 && rep1.status === 200 && rep1.body.summary.length >= 12 &&
      rep2.status === 200 && rep2.body.slip.net_salary === 79228.25 &&
      rep3.status === 200 && rep3.body.late_marks.length === 19 &&
      rbHttp.status === 200 && rbHttp.body.status === 'ROLLBACK_VERIFIED';
    recordTest('HTTP-05', 'Phase 5', 'HTTP', 'HR create/update, single & bulk payroll, 3 reports & rollback', 'EMP_HTTP lifecycle', 'All 201/200 & accurate report counts', {
      create: createH.status, upd: updH.status, single: procSingle.status, bulk: procBulk.status,
      rep1Count: rep1.body?.summary?.length, rep2Net: rep2.body?.slip?.net_salary, rep3Count: rep3.body?.late_marks?.length, rb: rbHttp.body?.status
    }, http05Ok, 'Live Express end-to-end integration');

  } finally {
    for (const id of createdEmpIds) {
      await adminPool.query('DELETE FROM payrolls WHERE employee_id = ?', [id]);
      await adminPool.query('DELETE FROM leaves WHERE employee_id = ?', [id]);
      await adminPool.query('DELETE FROM attendance WHERE employee_id = ?', [id]);
      await adminPool.query('DELETE FROM employees WHERE employee_id = ?', [id]);
    }
    if (server) await new Promise(r => server.close(r));
    await adminPool.end();
    await appPool.end();
  }

  const passedCount = results.filter(r => r.passed).length;
  console.log('\n===============================================================');
  console.log(`TEST EXECUTION SUMMARY: ${passedCount} / ${results.length} PASSED`);
  console.log('===============================================================');
  if (passedCount !== results.length) process.exit(1);
}

runTests().catch(err => {
  console.error('Fatal test suite failure:', err);
  process.exit(1);
});

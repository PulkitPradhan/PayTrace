// ============================================================================
// PayTrace: Browser End-to-End Test Suite (Chromium CDP)
// Verifies full-stack UI flows, RBAC, XSS safety, and date integrity.
// ============================================================================

const http = require('http');
const { spawn } = require('child_process');
const mysql = require('mysql2/promise');
const dotenv = require('dotenv');

dotenv.config();

const app = require('../src/app');
const appPool = require('../src/config/db');
const { getJwtSecret } = require('../src/middleware/auth');

getJwtSecret();

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
  database: DB_NAME
});

async function waitForCdp(port) {
  for (let i = 0; i < 40; i++) {
    try {
      const info = await new Promise((resolve, reject) => {
        http.get(`http://127.0.0.1:${port}/json/version`, (res) => {
          let d = '';
          res.on('data', c => d += c);
          res.on('end', () => resolve(JSON.parse(d)));
        }).on('error', reject);
      });
      if (info.webSocketDebuggerUrl) return info.webSocketDebuggerUrl;
    } catch (_) {}
    await new Promise(r => setTimeout(r, 200));
  }
  throw new Error('Chromium CDP failed to start');
}

async function runBrowserE2E() {
  let server = null;
  let chrome = null;
  let ws = null;
  const createdEmpIds = [];

  try {
    server = http.createServer(app);
    await new Promise(resolve => server.listen(0, '127.0.0.1', resolve));
    const baseUrl = `http://127.0.0.1:${server.address().port}`;

    const cdpPort = 9238;
    chrome = spawn('chromium', [
      '--headless=new',
      '--disable-gpu',
      '--no-sandbox',
      `--remote-debugging-port=${cdpPort}`,
      '--window-size=1440,900',
      'about:blank'
    ]);

    const wsUrl = await waitForCdp(cdpPort);
    ws = new WebSocket(wsUrl);
    await new Promise(r => ws.addEventListener('open', r, { once: true }));

    let msgId = 1;
    const pageErrors = [];
    const consoleErrors = [];

    const call = (method, params = {}, sessionId) => new Promise((resolve, reject) => {
      const id = msgId++;
      const handler = (evt) => {
        const m = JSON.parse(evt.data);
        if (m.id === id) {
          ws.removeEventListener('message', handler);
          if (m.error) reject(new Error(m.error.message));
          else resolve(m.result);
        }
      };
      ws.addEventListener('message', handler);
      ws.send(JSON.stringify({ id, method, params, sessionId }));
    });

    const target = await call('Target.createTarget', { url: 'about:blank' });
    const { sessionId } = await call('Target.attachToTarget', { targetId: target.targetId, flatten: true });
    await call('Page.enable', {}, sessionId);
    await call('Runtime.enable', {}, sessionId);
    await call('Emulation.setDeviceMetricsOverride', { width: 1440, height: 900, deviceScaleFactor: 1, mobile: false }, sessionId);
    await call('Page.navigate', { url: baseUrl }, sessionId);

    ws.addEventListener('message', (evt) => {
      const m = JSON.parse(evt.data);
      if (m.method === 'Runtime.exceptionThrown') {
        pageErrors.push(m.params.exceptionDetails?.text || 'Uncaught exception');
      } else if (m.method === 'Runtime.consoleAPICalled' && m.params.type === 'error') {
        const msg = (m.params.args || []).map(a => a.value || a.description || '').join(' ');
        if (!msg.includes('403 (Forbidden)')) consoleErrors.push(msg);
      }
    });

    const evalJs = async (expr) => {
      const res = await call('Runtime.evaluate', { expression: expr, awaitPromise: true, returnByValue: true }, sessionId);
      if (res.exceptionDetails) {
        throw new Error(res.exceptionDetails.exception?.description || res.exceptionDetails.text);
      }
      return res.result?.value;
    };

    const waitUntil = async (expr, timeoutMs = 6000) => {
      const t0 = Date.now();
      while (Date.now() - t0 < timeoutMs) {
        if (await evalJs(expr)) return true;
        await new Promise(r => setTimeout(r, 120));
      }
      throw new Error(`Timeout waiting for condition: ${expr}`);
    };

    let passed = 0;
    let total = 0;
    const assert = (name, cond, detail) => {
      total++;
      if (cond) passed++;
      else process.exitCode = 1;
      console.log(`[${cond ? 'PASS' : 'FAIL'}] E2E-${String(total).padStart(2, '0')}: ${name}${detail ? ' -> ' + JSON.stringify(detail) : ''}`);
    };

    await waitUntil("Boolean(document.getElementById('login-form'))");

    // 1. HR Admin login & dynamic dashboard
    await evalJs("quickLogin('alice.morgan@paytrace.local', 'Admin123!')");
    await waitUntil("document.getElementById('app-container').style.display === 'flex' && document.getElementById('metric-emp-count').textContent !== '—'");
    const hrDashOk = await evalJs("document.getElementById('metric-emp-count').textContent === '12' && document.getElementById('dash-payroll-body').innerText.includes('2026-08-01 to 2026-08-31')");
    assert('HR login, dynamic KPIs, and accurate calendar dates', hrDashOk);

    // 2. Employee create & edit
    await evalJs("switchTab('tab-employees')");
    await waitUntil("document.getElementById('employees-table-body').children.length === 12");
    await evalJs(`
      openAddEmployeeModal();
      document.getElementById('new-code').value = 'EMP_E2E';
      document.getElementById('new-dept').value = '1';
      document.getElementById('new-first').value = 'E2E';
      document.getElementById('new-last').value = 'Tester';
      document.getElementById('new-email').value = 'e2e.tester@paytrace.local';
      document.getElementById('new-desig').value = 'QA Analyst';
      document.getElementById('new-role').value = 'EMPLOYEE';
      document.getElementById('new-hire').value = '2026-06-01';
      document.getElementById('new-password').value = 'E2eSecret123!';
      document.getElementById('new-basic').value = '60000';
      document.getElementById('new-hra').value = '24000';
      document.getElementById('new-spec').value = '6000';
      document.getElementById('new-pf').value = '7200';
      document.getElementById('new-pt').value = '200';
      document.querySelector('#add-employee-modal form').requestSubmit();
    `);
    await waitUntil("document.getElementById('employees-table-body').innerText.includes('EMP_E2E')");
    const empId = await evalJs("cachedEmployees.find(e => e.employee_code === 'EMP_E2E').employee_id");
    createdEmpIds.push(empId);

    await evalJs(`openEditEmployeeModal(${empId})`);
    await waitUntil("document.getElementById('edit-employee-modal').classList.contains('active')");
    await evalJs("document.getElementById('edit-desig').value = 'Lead QA'; document.querySelector('#edit-employee-modal form').requestSubmit();");
    await waitUntil("document.getElementById('employees-table-body').innerText.includes('Lead QA')");
    assert('HR employee create & edit workflow', true);

    // 3. Salary revision
    await evalJs(`openSalaryModal(${empId})`);
    await waitUntil("document.getElementById('salary-modal').classList.contains('active')");
    await evalJs("document.getElementById('sal-effective').value = '2026-09-01'; document.getElementById('sal-basic').value = '75000'; document.querySelector('#salary-modal form').requestSubmit();");
    await waitUntil("document.getElementById('salary-history-body').children.length === 2");
    await evalJs("closeModal('salary-modal')");
    assert('HR salary revision & history modal', true);

    // 4. Attendance create & edit
    await evalJs("switchTab('tab-attendance')");
    await waitUntil("document.getElementById('attendance-table-body').children.length > 0");
    await evalJs(`
      openAttendanceModal();
      document.getElementById('att-emp-id').value = String(${empId});
      document.getElementById('att-work-date').value = '2026-08-03';
      document.getElementById('att-status').value = 'PRESENT';
      document.getElementById('att-check-in').value = '09:30:00';
      document.getElementById('att-check-out').value = '18:00:00';
      document.getElementById('att-remarks').value = 'E2E late mark';
      document.querySelector('#attendance-modal form').requestSubmit();
    `);
    await waitUntil("document.getElementById('attendance-table-body').innerText.includes('E2E late mark')");
    assert('HR attendance management workflow', true);

    // 5. Leave creation with XSS payload & approval
    await evalJs("switchTab('tab-leaves')");
    await waitUntil("document.getElementById('leaves-table-body').children.length > 0");
    await evalJs(`
      openApplyLeaveModal();
      document.getElementById('leave-emp-id').value = String(${empId});
      document.getElementById('leave-type').value = 'CASUAL';
      document.getElementById('leave-init-status').value = 'APPROVED';
      document.getElementById('leave-start').value = '2026-08-10';
      document.getElementById('leave-end').value = '2026-08-11';
      calcLeaveDays();
      document.getElementById('leave-reason').value = '<img src=x onerror="window.__e2eXss=true">LeaveNote';
      document.querySelector('#apply-leave-modal form').requestSubmit();
    `);
    await waitUntil("document.getElementById('leaves-table-body').innerText.includes('<img src=x')");
    const xssFired = await evalJs("Boolean(window.__e2eXss)");
    assert('HR leave workflow & safe XSS text rendering', !xssFired);

    // 6. Payroll generation & slip modal
    await evalJs("switchTab('tab-payroll-admin')");
    await evalJs(`openRunPayrollModal(); document.getElementById('run-period-id').value='3'; document.getElementById('run-employee-id').value=String(${empId}); submitRunPayroll();`);
    await waitUntil("document.getElementById('payroll-admin-table-body').innerText.includes('EMP_E2E')");
    assert('HR single-employee payroll processing via UI', true);

    // 7. Mandatory reports
    await evalJs("switchTab('tab-reports')");
    await waitUntil("document.getElementById('rep-attendance-body').children.length >= 12");
    await evalJs("switchReport('rep-late', document.querySelector('[data-report=\"rep-late\"]'))");
    await waitUntil("document.getElementById('rep-late-body').innerText.includes('2026-07-06')");
    await evalJs("switchReport('rep-dept', document.querySelector('[data-report=\"rep-dept\"]'))");
    await waitUntil("document.getElementById('rep-dept-body').children.length === 5");
    assert('HR mandatory reports & exact July 2026 dates', true);

    // 8. Logout & Employee read-only portal + access denial check
    await evalJs("handleLogout()");
    await waitUntil("document.getElementById('auth-screen').style.display === 'flex'");
    await evalJs("quickLogin('david.miller@paytrace.local', 'Employee123!')");
    await waitUntil("document.getElementById('app-container').style.display === 'flex' && document.getElementById('emp-metric-gross').textContent !== '—'");

    const empUiOk = await evalJs(`
      document.getElementById('hr-metrics-grid').style.display === 'none' &&
      document.getElementById('emp-metrics-grid').style.display === 'grid' &&
      document.getElementById('hr-nav-group').style.display === 'none' &&
      document.getElementById('attendance-hr-actions').style.display === 'none' &&
      document.getElementById('leaves-hr-actions').style.display === 'none'
    `);
    assert('Employee read-only dashboard & hidden admin controls', empUiOk);

    // Employee payslip modal + 403 access denial verification from browser session
    await evalJs("switchTab('tab-payslips')");
    await waitUntil("document.getElementById('my-payslips-body').children.length === 3");
    await evalJs("document.querySelector('#my-payslips-body button').click()");
    await waitUntil("document.getElementById('slip-modal').classList.contains('active') && document.getElementById('slip-emp-code').textContent === 'EMP003'");
    const forbiddenResp = await evalJs(`(async () => { const r = await apiFetch('/api/payroll/slip/16'); return r.status; })()`);
    assert('Employee views own slip & receives 403 on EMP004 slip', forbiddenResp === 403, { forbiddenResp });

    await evalJs("handleLogout()");
    await waitUntil("document.getElementById('auth-screen').style.display === 'flex'");
    assert('Logout clears session & returns to login screen', true);
    assert('Zero uncaught browser page/console errors', pageErrors.length === 0 && consoleErrors.length === 0, { pageErrors, consoleErrors });

    console.log(`\nBROWSER E2E SUMMARY: ${passed} / ${total} PASSED`);
  } finally {
    for (const id of createdEmpIds) {
      await adminPool.query('DELETE FROM payrolls WHERE employee_id = ?', [id]);
      await adminPool.query('DELETE FROM leaves WHERE employee_id = ?', [id]);
      await adminPool.query('DELETE FROM attendance WHERE employee_id = ?', [id]);
      await adminPool.query('DELETE FROM employees WHERE employee_id = ?', [id]);
    }
    if (ws) ws.close();
    if (chrome) chrome.kill();
    if (server) await new Promise(r => server.close(r));
    await adminPool.end();
    await appPool.end();
  }
}

runBrowserE2E().catch(err => {
  console.error('Fatal Browser E2E Error:', err);
  process.exit(1);
});

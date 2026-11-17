// ============================================================================
// PayTrace — Frontend Application Controller (Phase 5)
// ============================================================================

let currentUser = null;
let currentToken = null;

// Currency Formatter
const formatMoney = (val) => '$' + parseFloat(val || 0).toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 });

// Toast Notifications
function showToast(message, type = 'success') {
  const container = document.getElementById('toast-container');
  const toast = document.createElement('div');
  toast.className = `toast toast-${type}`;
  toast.textContent = message;
  container.appendChild(toast);
  setTimeout(() => toast.remove(), 4000);
}

// Modal Helpers
function openModal(id) {
  const el = document.getElementById(id);
  if (el) el.classList.add('active');
}

function closeModal(id) {
  const el = document.getElementById(id);
  if (el) el.classList.remove('active');
}

// ============================================================================
// Authentication & Session
// ============================================================================

async function quickLogin(email, password) {
  document.getElementById('login-email').value = email;
  document.getElementById('login-password').value = password;
  await performLogin(email, password);
}

async function handleLogin(e) {
  e.preventDefault();
  const email = document.getElementById('login-email').value;
  const password = document.getElementById('login-password').value;
  await performLogin(email, password);
}

async function performLogin(email, password) {
  try {
    const res = await fetch('/api/auth/login', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ email, password })
    });

    const data = await res.json();
    if (!data.success) {
      showToast(data.error || 'Login failed', 'error');
      return;
    }

    currentUser = data.user;
    currentToken = data.token;
    localStorage.setItem('paytrace_token', data.token);

    showToast(`Signed in as ${currentUser.first_name} ${currentUser.last_name} (${currentUser.role})`, 'success');
    renderAuthenticatedUI();
  } catch (err) {
    showToast('Failed to connect to PayTrace server.', 'error');
  }
}

async function handleLogout() {
  await fetch('/api/auth/logout', { method: 'POST' });
  localStorage.removeItem('paytrace_token');
  currentUser = null;
  currentToken = null;
  document.getElementById('app-container').style.display = 'none';
  document.getElementById('auth-screen').style.display = 'flex';
  showToast('Logged out successfully.', 'info');
}

async function checkSession() {
  const token = localStorage.getItem('paytrace_token');
  if (!token) return;

  try {
    const res = await fetch('/api/auth/me', {
      headers: { 'Authorization': `Bearer ${token}` }
    });
    const data = await res.json();
    if (data.success) {
      currentUser = data.user;
      currentToken = token;
      renderAuthenticatedUI();
    }
  } catch (err) {
    localStorage.removeItem('paytrace_token');
  }
}

// ============================================================================
// UI Navigation & Role-Based Rendering
// ============================================================================

function renderAuthenticatedUI() {
  document.getElementById('auth-screen').style.display = 'none';
  document.getElementById('app-container').style.display = 'flex';

  const isHR = currentUser.role === 'HR_ADMIN';
  const fullName = `${currentUser.first_name} ${currentUser.last_name}`;
  const initials = `${currentUser.first_name[0]}${currentUser.last_name[0]}`;

  document.getElementById('nav-user-name').textContent = fullName;
  document.getElementById('nav-user-role').textContent = currentUser.role;
  document.getElementById('nav-avatar').textContent = initials;
  document.getElementById('dash-greeting').textContent = `Welcome back, ${currentUser.first_name}!`;

  // Toggle HR Admin specific elements
  document.getElementById('hr-nav-group').style.display = isHR ? 'block' : 'none';
  document.getElementById('dash-actions').style.display = isHR ? 'flex' : 'none';
  document.getElementById('emp-clock-in-card').style.display = isHR ? 'none' : 'flex';

  if (!isHR) {
    document.getElementById('dash-subtitle').textContent = `Department: ${currentUser.department_name} • Staff Self-Service Portal`;
    document.getElementById('attendance-title').textContent = 'My Daily Attendance';
  } else {
    document.getElementById('dash-subtitle').textContent = 'Here is the current operational and payroll status across the firm.';
    document.getElementById('attendance-title').textContent = 'Daily Attendance Logs';
  }

  switchTab('tab-dashboard');
}

function switchTab(tabId) {
  document.querySelectorAll('.tab-pane').forEach(el => el.classList.remove('active'));
  document.querySelectorAll('.sidebar-nav .nav-item').forEach(el => el.classList.remove('active'));

  const targetPane = document.getElementById(tabId);
  const targetBtn = document.querySelector(`[data-tab="${tabId}"]`);

  if (targetPane) targetPane.classList.add('active');
  if (targetBtn) targetBtn.classList.add('active');

  // Trigger data loader
  if (tabId === 'tab-dashboard') loadDashboard();
  else if (tabId === 'tab-employees') loadEmployees();
  else if (tabId === 'tab-payroll-admin') loadPayrollAdminTable();
  else if (tabId === 'tab-reports') loadAttendanceSummaryReport();
  else if (tabId === 'tab-audit') loadAuditLogs();
  else if (tabId === 'tab-attendance') loadAttendanceTable();
  else if (tabId === 'tab-leaves') loadLeavesTable();
  else if (tabId === 'tab-payslips') loadMyPayslips();
}

// API Helper with Token Injection
async function apiFetch(endpoint, options = {}) {
  options.headers = options.headers || {};
  if (currentToken) {
    options.headers['Authorization'] = `Bearer ${currentToken}`;
  }
  const res = await fetch(endpoint, options);
  return res.json();
}

// ============================================================================
// Tab Loaders
// ============================================================================

async function loadDashboard() {
  const periodsData = await apiFetch('/api/payroll/periods');
  if (periodsData.success) {
    const tbody = document.getElementById('dash-payroll-body');
    tbody.innerHTML = periodsData.periods.map(p => `
      <tr>
        <td><strong>${p.period_name}</strong></td>
        <td>${p.start_date} to ${p.end_date}</td>
        <td>${p.total_working_days} Days</td>
        <td><span class="badge ${p.status === 'FINALIZED' ? 'badge-success' : 'badge-neutral'}">${p.status}</span></td>
        <td>
          <button class="btn btn-outline btn-sm" onclick="viewPeriodPayroll(${p.period_id})">View Cycle</button>
        </td>
      </tr>
    `).join('');
  }
}

async function loadEmployees() {
  const data = await apiFetch('/api/employees');
  if (!data.success) return;

  const tbody = document.getElementById('employees-table-body');
  tbody.innerHTML = data.employees.map(e => `
    <tr>
      <td><code>${e.employee_code}</code></td>
      <td><strong>${e.first_name} ${e.last_name}</strong></td>
      <td>${e.department_name}</td>
      <td>${e.designation}</td>
      <td><span class="badge ${e.role === 'HR_ADMIN' ? 'badge-info' : 'badge-neutral'}">${e.role}</span></td>
      <td>${formatMoney(e.basic_salary)}</td>
      <td><span class="badge badge-success">${e.status}</span></td>
      <td>
        <button class="btn btn-outline btn-sm" onclick="showToast('Profile: ' + '${e.email}', 'info')">View</button>
      </td>
    </tr>
  `).join('');
}

async function loadPayrollAdminTable() {
  const periodId = document.getElementById('payroll-period-select').value;
  const data = await apiFetch(`/api/payroll?periodId=${periodId}`);
  if (!data.success) return;

  const tbody = document.getElementById('payroll-admin-table-body');
  tbody.innerHTML = data.payrolls.map(p => `
    <tr>
      <td>
        <strong>${p.full_name}</strong><br>
        <span class="text-muted" style="font-size:0.75rem">${p.employee_code}</span>
      </td>
      <td>${p.department_name}</td>
      <td>${p.present_days} / ${p.late_days} / ${p.unpaid_leave_days}</td>
      <td><strong>${formatMoney(p.gross_earnings)}</strong></td>
      <td class="text-danger">${formatMoney(p.total_deductions)}</td>
      <td><strong class="text-success">${formatMoney(p.net_salary)}</strong></td>
      <td><span class="badge badge-success">${p.payment_status}</span></td>
      <td>
        <button class="btn btn-outline btn-sm" onclick="openSlipModal(${p.payroll_id})">View Slip</button>
      </td>
    </tr>
  `).join('');
}

async function loadAttendanceTable() {
  const data = await apiFetch('/api/attendance');
  if (!data.success) return;

  const tbody = document.getElementById('attendance-table-body');
  tbody.innerHTML = data.attendance.map(a => `
    <tr>
      <td><strong>${a.work_date}</strong></td>
      <td>${a.full_name} (${a.employee_code})</td>
      <td>
        <span class="badge ${a.status === 'PRESENT' ? 'badge-success' : (a.status === 'ON_LEAVE' ? 'badge-info' : 'badge-danger')}">
          ${a.status}
        </span>
      </td>
      <td>${a.check_in_time || '—'}</td>
      <td>${a.check_out_time || '—'}</td>
      <td>
        ${a.is_late ? `<span class="badge badge-warning">LATE (${a.late_minutes}m)</span>` : '<span class="badge badge-success">ON TIME</span>'}
      </td>
      <td class="text-muted">${a.remarks || '—'}</td>
    </tr>
  `).join('');
}

async function loadLeavesTable() {
  const data = await apiFetch('/api/leaves');
  if (!data.success) return;

  const isHR = currentUser.role === 'HR_ADMIN';
  const tbody = document.getElementById('leaves-table-body');

  tbody.innerHTML = data.leaves.map(l => `
    <tr>
      <td><strong>${l.full_name}</strong></td>
      <td><span class="badge badge-neutral">${l.leave_type}</span></td>
      <td>${l.start_date} to ${l.end_date}</td>
      <td>${l.total_days} Days</td>
      <td>${l.reason}</td>
      <td>
        <span class="badge ${l.status === 'APPROVED' ? 'badge-success' : (l.status === 'PENDING' ? 'badge-warning' : 'badge-danger')}">
          ${l.status}
        </span>
      </td>
      <td>${l.actioned_by_name || 'Pending'}</td>
      <td>
        ${isHR && l.status === 'PENDING' ? `
          <button class="btn btn-success btn-sm" onclick="updateLeaveStatus(${l.leave_id}, 'APPROVED')">Approve</button>
          <button class="btn btn-danger btn-sm" onclick="updateLeaveStatus(${l.leave_id}, 'REJECTED')">Reject</button>
        ` : '—'}
      </td>
    </tr>
  `).join('');
}

async function loadMyPayslips() {
  const data = await apiFetch('/api/payroll');
  if (!data.success) return;

  const tbody = document.getElementById('my-payslips-body');
  tbody.innerHTML = data.payrolls.map(p => `
    <tr>
      <td><strong>${p.period_name}</strong></td>
      <td>${p.start_date} to ${p.end_date}</td>
      <td>${p.present_days} / ${p.total_working_days}</td>
      <td>${formatMoney(p.gross_earnings)}</td>
      <td class="text-danger">${formatMoney(p.total_deductions)}</td>
      <td><strong class="text-success">${formatMoney(p.net_salary)}</strong></td>
      <td><span class="badge badge-success">${p.payment_status}</span></td>
      <td>
        <button class="btn btn-primary btn-sm" onclick="openSlipModal(${p.payroll_id})">Itemized Slip</button>
      </td>
    </tr>
  `).join('');
}

async function loadAuditLogs() {
  const data = await apiFetch('/api/audit-logs');
  if (!data.success) return;

  const tbody = document.getElementById('audit-table-body');
  tbody.innerHTML = data.logs.map(log => `
    <tr>
      <td>#${log.log_id}</td>
      <td>${new Date(log.created_at).toLocaleString()}</td>
      <td><code>${log.table_name}</code></td>
      <td>${log.record_id}</td>
      <td><span class="badge ${log.action === 'INSERT' ? 'badge-success' : 'badge-info'}">${log.action}</span></td>
      <td>${log.actor_name || 'System / Batch'}</td>
      <td>
        <pre style="font-size:0.75rem; max-width:320px; overflow-x:auto;">${log.new_values ? JSON.stringify(JSON.parse(log.new_values), null, 2) : '—'}</pre>
      </td>
    </tr>
  `).join('');
}

// ============================================================================
// Reports Loader (Phase 3)
// ============================================================================

function switchReport(viewId) {
  document.querySelectorAll('.report-view').forEach(el => {
    el.style.display = 'none';
    el.classList.remove('active');
  });
  document.querySelectorAll('.subtab-btn').forEach(btn => btn.classList.remove('active'));

  const target = document.getElementById(viewId);
  if (target) {
    target.style.display = 'block';
    target.classList.add('active');
  }

  const activeBtn = event.target;
  if (activeBtn) activeBtn.classList.add('active');

  refreshCurrentReport();
}

function refreshCurrentReport() {
  const periodId = document.getElementById('report-period-select').value;
  const activeView = document.querySelector('.report-view.active') || document.getElementById('rep-attendance');

  if (activeView.id === 'rep-attendance') loadAttendanceSummaryReport(periodId);
  else if (activeView.id === 'rep-late') loadLateMarksReport(periodId);
  else if (activeView.id === 'rep-dept') loadDepartmentalReport(periodId);
}

async function loadAttendanceSummaryReport(periodId = 2) {
  const data = await apiFetch(`/api/reports/attendance-summary?periodId=${periodId}`);
  if (!data.success) return;

  const tbody = document.getElementById('rep-attendance-body');
  tbody.innerHTML = data.summary.map(s => `
    <tr>
      <td><code>${s.employee_code}</code></td>
      <td><strong>${s.full_name}</strong></td>
      <td>${s.department_name}</td>
      <td>${s.total_working_days}</td>
      <td>${s.days_present}</td>
      <td>${s.days_absent}</td>
      <td>${s.days_on_leave}</td>
      <td>${s.late_marks > 3 ? `<span class="badge badge-warning">${s.late_marks}</span>` : s.late_marks}</td>
      <td><strong>${s.attendance_percentage}%</strong></td>
    </tr>
  `).join('');
}

async function loadLateMarksReport(periodId = 2) {
  const data = await apiFetch(`/api/reports/late-marks?periodId=${periodId}`);
  if (!data.success) return;

  const tbody = document.getElementById('rep-late-body');
  tbody.innerHTML = data.late_marks.map(l => `
    <tr>
      <td><strong>${l.full_name}</strong> (${l.employee_code})</td>
      <td>${l.department_name}</td>
      <td>${l.work_date}</td>
      <td><code>${l.check_in_time}</code></td>
      <td><span class="badge badge-warning">${l.late_minutes} min</span></td>
      <td>${l.remarks || '—'}</td>
    </tr>
  `).join('');
}

async function loadDepartmentalReport(periodId = 2) {
  const data = await apiFetch(`/api/reports/departmental?periodId=${periodId}`);
  if (!data.success) return;

  const tbody = document.getElementById('rep-dept-body');
  tbody.innerHTML = data.departments.map(d => `
    <tr>
      <td><strong>${d.department_name}</strong></td>
      <td>${d.employee_count}</td>
      <td>${formatMoney(d.total_gross_earnings)}</td>
      <td class="text-danger">${formatMoney(d.total_deductions)}</td>
      <td><strong class="text-success">${formatMoney(d.total_net_disbursed)}</strong></td>
      <td>${formatMoney(d.average_net_salary)}</td>
    </tr>
  `).join('');
}

// ============================================================================
// Modals & Action Workflows
// ============================================================================

async function openSlipModal(payrollId) {
  const data = await apiFetch(`/api/payroll/slip/${payrollId}`);
  if (!data.success) {
    showToast(data.error || 'Failed to fetch payslip.', 'error');
    return;
  }

  const s = data.slip;
  document.getElementById('slip-period-badge').textContent = s.period_name;
  document.getElementById('slip-emp-name').textContent = s.full_name;
  document.getElementById('slip-emp-code').textContent = s.employee_code;
  document.getElementById('slip-emp-dept').textContent = s.department_name;
  document.getElementById('slip-emp-desig').textContent = s.designation;
  document.getElementById('slip-working-days').textContent = s.total_working_days;
  document.getElementById('slip-present-days').textContent = s.present_days;
  document.getElementById('slip-leave-days').textContent = `${s.approved_paid_leave_days} / ${s.unpaid_leave_days}`;
  document.getElementById('slip-late-days').textContent = s.late_days;

  // Earnings
  const eBody = document.getElementById('slip-earnings-body');
  eBody.innerHTML = s.earnings.map(i => `
    <tr><td>${i.item_name}</td><td class="text-right">${formatMoney(i.amount)}</td></tr>
  `).join('');
  document.getElementById('slip-total-gross').textContent = formatMoney(s.gross_earnings);

  // Deductions
  const dBody = document.getElementById('slip-deductions-body');
  dBody.innerHTML = s.deductions.map(i => `
    <tr>
      <td>${i.item_name}<br><small class="text-muted">${i.description || ''}</small></td>
      <td class="text-right text-danger">${formatMoney(i.amount)}</td>
    </tr>
  `).join('');
  document.getElementById('slip-total-deductions').textContent = formatMoney(s.total_deductions);

  // Net Pay
  document.getElementById('slip-net-amount').textContent = formatMoney(s.net_salary);

  openModal('slip-modal');
}

function openRunPayrollModal() {
  openModal('run-payroll-modal');
}

async function submitRunPayroll() {
  const periodId = document.getElementById('run-period-id').value;
  const employeeId = document.getElementById('run-employee-id').value;

  try {
    const data = await apiFetch('/api/payroll/process', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ periodId, employeeId: employeeId || null })
    });

    if (data.success) {
      showToast(data.message, 'success');
      closeModal('run-payroll-modal');
      loadPayrollAdminTable();
    } else {
      showToast(data.error || 'Payroll calculation failed.', 'error');
    }
  } catch (err) {
    showToast('Network error processing payroll.', 'error');
  }
}

function openTestRollbackModal() {
  document.getElementById('rollback-result-box').style.display = 'none';
  openModal('test-rollback-modal');
}

async function executeRollbackTest() {
  const box = document.getElementById('rollback-result-box');
  box.style.display = 'block';
  box.innerHTML = 'Executing transaction safety check...';

  const data = await apiFetch('/api/payroll/test-rollback', { method: 'POST' });
  if (data.success) {
    box.innerHTML = `
      <strong style="color:var(--success)">✅ TRANSACTION ROLLBACK VERIFIED</strong>
      <p style="margin-top:4px"><strong>Procedure Output:</strong> ${data.message}</p>
      <p style="font-size:0.8rem; color:var(--text-muted)">Negative salary input was caught by MariaDB SQLEXCEPTION handler and safely rolled back. Zero rows persisted.</p>
    `;
    showToast('Rollback demonstration completed successfully.', 'success');
  } else {
    box.innerHTML = `<span style="color:var(--danger)">❌ Test Error: ${data.error}</span>`;
  }
}

async function handleClockIn() {
  const data = await apiFetch('/api/attendance/clock-in', { method: 'POST' });
  if (data.success) {
    showToast(data.message, 'success');
    loadAttendanceTable();
  } else {
    showToast(data.error || 'Clock-in failed.', 'error');
  }
}

function openApplyLeaveModal() {
  openModal('apply-leave-modal');
}

function calcLeaveDays() {
  const s = document.getElementById('leave-start').value;
  const e = document.getElementById('leave-end').value;
  if (s && e) {
    const diff = (new Date(e) - new Date(s)) / (1000 * 60 * 60 * 24) + 1;
    if (diff > 0) document.getElementById('leave-days').value = diff;
  }
}

async function submitApplyLeave(e) {
  e.preventDefault();
  const leave_type = document.getElementById('leave-type').value;
  const start_date = document.getElementById('leave-start').value;
  const end_date = document.getElementById('leave-end').value;
  const total_days = parseFloat(document.getElementById('leave-days').value);
  const reason = document.getElementById('leave-reason').value;

  const data = await apiFetch('/api/leaves', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ leave_type, start_date, end_date, total_days, reason })
  });

  if (data.success) {
    showToast('Leave request submitted successfully.', 'success');
    closeModal('apply-leave-modal');
    loadLeavesTable();
  } else {
    showToast(data.error || 'Failed to submit leave.', 'error');
  }
}

async function updateLeaveStatus(leaveId, status) {
  const data = await apiFetch(`/api/leaves/${leaveId}/status`, {
    method: 'PUT',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ status, admin_remarks: `Actioned by HR Admin` })
  });

  if (data.success) {
    showToast(data.message, 'success');
    loadLeavesTable();
  } else {
    showToast(data.error || 'Failed to update leave.', 'error');
  }
}

function openAddEmployeeModal() {
  openModal('add-employee-modal');
}

async function submitAddEmployee(e) {
  e.preventDefault();
  const payload = {
    employee_code: document.getElementById('new-code').value,
    department_id: parseInt(document.getElementById('new-dept').value, 10),
    first_name: document.getElementById('new-first').value,
    last_name: document.getElementById('new-last').value,
    email: document.getElementById('new-email').value,
    designation: document.getElementById('new-desig').value,
    role: document.getElementById('new-role').value,
    hire_date: document.getElementById('new-hire').value,
    basic_salary: parseFloat(document.getElementById('new-basic').value),
    hra: parseFloat(document.getElementById('new-hra').value),
    special_allowance: parseFloat(document.getElementById('new-spec').value),
    provident_fund: parseFloat(document.getElementById('new-pf').value)
  };

  const data = await apiFetch('/api/employees', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(payload)
  });

  if (data.success) {
    showToast('Employee created successfully.', 'success');
    closeModal('add-employee-modal');
    loadEmployees();
  } else {
    showToast(data.error || 'Failed to create employee.', 'error');
  }
}

// Startup Session Check
window.addEventListener('DOMContentLoaded', checkSession);

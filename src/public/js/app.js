// ============================================================================
// PayTrace — Frontend Application Controller (Phase 5)
// ============================================================================

let currentUser = null;
let cachedPeriods = [];
let cachedEmployees = [];
let cachedDepartments = [];
let cachedAttendanceRows = [];

function escapeHtml(value) {
  if (value === null || value === undefined) return '';
  return String(value)
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#39;');
}

const formatMoney = (val) => '$' + parseFloat(val || 0).toLocaleString('en-US', {
  minimumFractionDigits: 2,
  maximumFractionDigits: 2
});

const formatDate = (val) => {
  if (!val) return '—';
  if (typeof val === 'string' && /^\d{4}-\d{2}-\d{2}/.test(val)) return val.slice(0, 10);
  const d = new Date(val);
  if (isNaN(d.getTime())) return escapeHtml(val);
  const y = d.getFullYear();
  const m = String(d.getMonth() + 1).padStart(2, '0');
  const day = String(d.getDate()).padStart(2, '0');
  return `${y}-${m}-${day}`;
};

function getCookie(name) {
  const match = document.cookie.match(new RegExp('(?:^|; )' + name.replace(/[.*+?^${}()|[\]\\]/g, '\\$&') + '=([^;]*)'));
  return match ? decodeURIComponent(match[1]) : '';
}

function showToast(message, type = 'success') {
  const container = document.getElementById('toast-container');
  const toast = document.createElement('div');
  toast.className = `toast toast-${type}`;
  toast.textContent = message;
  container.appendChild(toast);
  setTimeout(() => toast.remove(), 4000);
}

function openModal(id) {
  const el = document.getElementById(id);
  if (el) el.classList.add('active');
}

function closeModal(id) {
  const el = document.getElementById(id);
  if (el) el.classList.remove('active');
}

// ============================================================================
// Authentication & Session (HttpOnly Cookie + Double-Submit CSRF)
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
      credentials: 'same-origin',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ email, password })
    });

    const data = await res.json();
    if (!data.success) {
      showToast(data.error || 'Login failed', 'error');
      return;
    }

    currentUser = data.user;
    showToast(`Signed in as ${currentUser.first_name} ${currentUser.last_name} (${currentUser.role})`, 'success');
    await renderAuthenticatedUI();
  } catch (err) {
    showToast('Failed to connect to PayTrace server.', 'error');
  }
}

async function handleLogout() {
  try {
    await fetch('/api/auth/logout', { method: 'POST', credentials: 'same-origin' });
  } finally {
    resetToAuthScreen();
    showToast('Logged out successfully.', 'info');
  }
}

function resetToAuthScreen() {
  currentUser = null;
  cachedEmployees = [];
  cachedDepartments = [];
  cachedAttendanceRows = [];
  ['dash-payroll-body', 'employees-table-body', 'payroll-admin-table-body', 'rep-attendance-body', 'rep-late-body', 'rep-dept-body', 'audit-table-body', 'attendance-table-body', 'leaves-table-body', 'my-payslips-body'].forEach(id => {
    const el = document.getElementById(id);
    if (el) el.innerHTML = '';
  });
  document.getElementById('app-container').style.display = 'none';
  document.getElementById('auth-screen').style.display = 'flex';
}

async function checkSession() {
  try {
    const res = await fetch('/api/auth/me', { credentials: 'same-origin' });
    if (!res.ok) return;
    const data = await res.json();
    if (data.success) {
      currentUser = data.user;
      await renderAuthenticatedUI();
    }
  } catch (_) {
    // No active session
  }
}

async function apiFetch(endpoint, options = {}) {
  const opts = { ...options, credentials: 'same-origin', headers: { ...(options.headers || {}) } };
  const method = (opts.method || 'GET').toUpperCase();
  if (!['GET', 'HEAD', 'OPTIONS'].includes(method)) {
    const csrf = getCookie('csrf_token');
    if (csrf) opts.headers['X-CSRF-Token'] = csrf;
  }

  const res = await fetch(endpoint, opts);
  let data;
  try {
    data = await res.json();
  } catch (_) {
    data = { success: false, error: `Unexpected server response (${res.status})` };
  }

  if (res.status === 401 && currentUser) {
    resetToAuthScreen();
    showToast('Session expired. Please sign in again.', 'error');
  }
  return { status: res.status, ...data };
}

// ============================================================================
// UI Initialization & Role-Based Rendering
// ============================================================================

async function renderAuthenticatedUI() {
  document.getElementById('auth-screen').style.display = 'none';
  document.getElementById('app-container').style.display = 'flex';

  const isHR = currentUser.role === 'HR_ADMIN';
  const fullName = `${currentUser.first_name} ${currentUser.last_name}`;
  const initials = `${currentUser.first_name[0] || ''}${currentUser.last_name[0] || ''}`.toUpperCase();

  document.getElementById('nav-user-name').textContent = fullName;
  document.getElementById('nav-user-role').textContent = currentUser.role;
  document.getElementById('nav-avatar').textContent = initials;
  document.getElementById('dash-greeting').textContent = `Welcome back, ${currentUser.first_name}!`;

  document.getElementById('hr-nav-group').style.display = isHR ? 'block' : 'none';
  document.getElementById('dash-actions').style.display = isHR ? 'flex' : 'none';
  document.getElementById('hr-metrics-grid').style.display = isHR ? 'grid' : 'none';
  document.getElementById('emp-metrics-grid').style.display = isHR ? 'none' : 'grid';

  document.getElementById('attendance-hr-actions').style.display = isHR ? 'flex' : 'none';
  document.getElementById('attendance-filter-bar').style.display = isHR ? 'flex' : 'none';
  document.getElementById('att-actions-col').style.display = isHR ? 'table-cell' : 'none';
  document.getElementById('leaves-hr-actions').style.display = isHR ? 'flex' : 'none';
  document.getElementById('leaves-actions-col').style.display = isHR ? 'table-cell' : 'none';

  if (isHR) {
    document.getElementById('dash-subtitle').textContent = 'Live organizational metrics, payroll cycles, and compliance controls.';
    document.getElementById('attendance-title').textContent = 'Daily Attendance Logs';
    document.getElementById('attendance-subtitle').textContent = 'Review, record, and correct employee attendance with trigger validation.';
    document.getElementById('leaves-subtitle').textContent = 'Record employee leave requests and enforce overlap-free approvals.';
    document.getElementById('dash-table-title').textContent = 'Payroll Accounting Cycles';
  } else {
    document.getElementById('dash-subtitle').textContent = `Department: ${currentUser.department || currentUser.department_name || 'Staff'} • Read-Only Employee Portal`;
    document.getElementById('attendance-title').textContent = 'My Daily Attendance';
    document.getElementById('attendance-subtitle').textContent = 'Read-only personal attendance log and punctuality history.';
    document.getElementById('leaves-subtitle').textContent = 'Read-only personal leave history and approval status.';
    document.getElementById('dash-table-title').textContent = 'Organization Payroll Calendar';
  }

  checkHealthStatus();
  await loadReferenceData(isHR);
  switchTab('tab-dashboard');
}

async function checkHealthStatus() {
  const el = document.getElementById('db-status-text');
  try {
    const res = await fetch('/api/health');
    const data = await res.json();
    el.textContent = data.status === 'ONLINE' ? 'Backend & DB Online' : 'Status Unknown';
  } catch (_) {
    el.textContent = 'Server Offline';
  }
}

async function loadReferenceData(isHR) {
  const pData = await apiFetch('/api/payroll/periods');
  if (pData.success) {
    cachedPeriods = pData.periods;
    populatePeriodSelects();
  }

  if (isHR) {
    const [dData, eData] = await Promise.all([
      apiFetch('/api/employees/departments'),
      apiFetch('/api/employees')
    ]);
    if (dData.success) {
      cachedDepartments = dData.departments;
      populateDepartmentSelects();
    }
    if (eData.success) {
      cachedEmployees = eData.employees;
      populateEmployeeSelects();
    }
  }
}

function populatePeriodSelects() {
  const selectIds = ['payroll-period-select', 'report-period-select', 'run-period-id'];
  for (const id of selectIds) {
    const sel = document.getElementById(id);
    if (!sel) continue;
    const prev = sel.value;
    sel.innerHTML = cachedPeriods.map((p, idx) =>
      `<option value="${Number(p.period_id)}" ${idx === 1 || prev === String(p.period_id) ? 'selected' : ''}>${escapeHtml(p.period_name)} (${escapeHtml(p.status)})</option>`
    ).join('');
    if (prev && cachedPeriods.some(p => String(p.period_id) === prev)) sel.value = prev;
  }

  const attPer = document.getElementById('att-period-filter');
  if (attPer) {
    attPer.innerHTML = `<option value="">All Periods</option>` + cachedPeriods.map(p =>
      `<option value="${Number(p.period_id)}">${escapeHtml(p.period_name)}</option>`
    ).join('');
  }
}

function populateDepartmentSelects() {
  const opts = cachedDepartments.map(d =>
    `<option value="${Number(d.department_id)}">${escapeHtml(d.department_name)}</option>`
  ).join('');
  const filterSel = document.getElementById('emp-dept-filter');
  if (filterSel) filterSel.innerHTML = `<option value="">All Departments</option>${opts}`;
  const newSel = document.getElementById('new-dept');
  if (newSel) newSel.innerHTML = opts;
  const editSel = document.getElementById('edit-dept');
  if (editSel) editSel.innerHTML = opts;
}

function populateEmployeeSelects() {
  const activeEmps = cachedEmployees.filter(e => e.status === 'ACTIVE');
  const allOpts = cachedEmployees.map(e =>
    `<option value="${Number(e.employee_id)}">${escapeHtml(e.employee_code)} — ${escapeHtml(e.first_name)} ${escapeHtml(e.last_name)}</option>`
  ).join('');
  const activeOpts = activeEmps.map(e =>
    `<option value="${Number(e.employee_id)}">${escapeHtml(e.employee_code)} — ${escapeHtml(e.first_name)} ${escapeHtml(e.last_name)}</option>`
  ).join('');

  const runEmp = document.getElementById('run-employee-id');
  if (runEmp) runEmp.innerHTML = `<option value="">All Active Employees (Bulk Process)</option>${activeOpts}`;

  const attFilter = document.getElementById('att-emp-filter');
  if (attFilter) attFilter.innerHTML = `<option value="">All Employees</option>${allOpts}`;

  const attEmp = document.getElementById('att-emp-id');
  if (attEmp) attEmp.innerHTML = activeOpts;

  const leaveEmp = document.getElementById('leave-emp-id');
  if (leaveEmp) leaveEmp.innerHTML = activeOpts;
}

function switchTab(tabId) {
  document.querySelectorAll('.tab-pane').forEach(el => el.classList.remove('active'));
  document.querySelectorAll('.sidebar-nav .nav-item').forEach(el => el.classList.remove('active'));

  const targetPane = document.getElementById(tabId);
  const targetBtn = document.querySelector(`[data-tab="${tabId}"]`);
  if (targetPane) targetPane.classList.add('active');
  if (targetBtn) targetBtn.classList.add('active');

  if (tabId === 'tab-dashboard') loadDashboard();
  else if (tabId === 'tab-employees') loadEmployees();
  else if (tabId === 'tab-payroll-admin') loadPayrollAdminTable();
  else if (tabId === 'tab-reports') refreshCurrentReport();
  else if (tabId === 'tab-audit') loadAuditLogs();
  else if (tabId === 'tab-attendance') loadAttendanceTable();
  else if (tabId === 'tab-leaves') loadLeavesTable();
  else if (tabId === 'tab-payslips') loadMyPayslips();
}

// ============================================================================
// Dashboard & Navigation
// ============================================================================

async function loadDashboard() {
  const isHR = currentUser.role === 'HR_ADMIN';

  if (isHR) {
    const dashData = await apiFetch('/api/reports/dashboard-summary');
    if (dashData.success) {
      const s = dashData.summary;
      document.getElementById('metric-emp-count').textContent = s.active_employees;
      document.getElementById('metric-dept-desc').textContent = `Across ${s.department_count} departments`;
      document.getElementById('metric-gross-outflow').textContent = formatMoney(s.monthly_gross_liability);
      document.getElementById('metric-pending-leaves').textContent = s.pending_leaves;
      document.getElementById('metric-late-label').textContent = `Late Arrivals (${s.latest_period_name})`;
      document.getElementById('metric-late-count').textContent = s.late_arrivals_latest;
    } else {
      showToast(dashData.error || 'Failed to load HR dashboard metrics.', 'error');
    }
  } else {
    const empDash = await apiFetch('/api/auth/dashboard');
    if (empDash.success) {
      const s = empDash.summary;
      document.getElementById('emp-metric-gross').textContent = formatMoney(s.profile?.gross_salary || 0);
      document.getElementById('emp-metric-desig').textContent = s.profile?.designation || 'Active Compensation';
      document.getElementById('emp-metric-present').textContent = s.total_present_days;
      document.getElementById('emp-metric-late').textContent = `${s.total_late_marks} total late mark(s)`;
      document.getElementById('emp-metric-leaves').textContent = s.approved_leave_days;
      document.getElementById('emp-metric-pending-leaves').textContent = `${s.pending_leave_requests} pending request(s)`;
      if (s.latest_payroll) {
        document.getElementById('emp-metric-net').textContent = formatMoney(s.latest_payroll.net_salary);
        document.getElementById('emp-metric-period').textContent = `${s.latest_payroll.period_name} (${s.latest_payroll.payment_status})`;
      } else {
        document.getElementById('emp-metric-net').textContent = '—';
        document.getElementById('emp-metric-period').textContent = 'No finalized slip yet';
      }
    } else {
      showToast(empDash.error || 'Failed to load personal summary.', 'error');
    }
  }

  const periodsData = await apiFetch('/api/payroll/periods');
  if (periodsData.success) {
    cachedPeriods = periodsData.periods;
    const tbody = document.getElementById('dash-payroll-body');
    tbody.innerHTML = periodsData.periods.map(p => `
      <tr>
        <td><strong>${escapeHtml(p.period_name)}</strong></td>
        <td>${formatDate(p.start_date)} to ${formatDate(p.end_date)}</td>
        <td>${Number(p.total_working_days)} Days</td>
        <td><span class="badge ${p.status === 'FINALIZED' ? 'badge-success' : 'badge-neutral'}">${escapeHtml(p.status)}</span></td>
        <td>
          <button class="btn btn-outline btn-sm" onclick="viewPeriodPayroll(${Number(p.period_id)})">
            ${isHR ? 'View Cycle' : 'My Slips'}
          </button>
        </td>
      </tr>
    `).join('');
  }
}

function viewPeriodPayroll(periodId) {
  if (currentUser && currentUser.role === 'HR_ADMIN') {
    const sel = document.getElementById('payroll-period-select');
    if (sel) sel.value = String(periodId);
    switchTab('tab-payroll-admin');
  } else {
    switchTab('tab-payslips');
  }
}

// ============================================================================
// Employees & Salary Revisions (HR Admin)
// ============================================================================

async function loadEmployees() {
  const search = document.getElementById('emp-search')?.value || '';
  const departmentId = document.getElementById('emp-dept-filter')?.value || '';
  const status = document.getElementById('emp-status-filter')?.value || '';

  const qs = new URLSearchParams();
  if (search.trim()) qs.set('search', search.trim());
  if (departmentId) qs.set('departmentId', departmentId);
  if (status) qs.set('status', status);

  const data = await apiFetch(`/api/employees${qs.toString() ? '?' + qs.toString() : ''}`);
  if (!data.success) {
    showToast(data.error || 'Failed to load employees.', 'error');
    return;
  }

  if (!search.trim() && !departmentId && !status) {
    cachedEmployees = data.employees;
    populateEmployeeSelects();
  }

  const tbody = document.getElementById('employees-table-body');
  if (data.employees.length === 0) {
    tbody.innerHTML = '<tr><td colspan="8" class="text-muted" style="text-align:center;">No employees match the current filters.</td></tr>';
    return;
  }

  tbody.innerHTML = data.employees.map(e => `
    <tr>
      <td><code>${escapeHtml(e.employee_code)}</code></td>
      <td><strong>${escapeHtml(e.first_name)} ${escapeHtml(e.last_name)}</strong><br><span class="text-muted" style="font-size:0.75rem">${escapeHtml(e.email)}</span></td>
      <td>${escapeHtml(e.department_name)}</td>
      <td>${escapeHtml(e.designation)}</td>
      <td><span class="badge ${e.role === 'HR_ADMIN' ? 'badge-info' : 'badge-neutral'}">${escapeHtml(e.role)}</span></td>
      <td>${formatMoney(e.gross_salary)}</td>
      <td><span class="badge ${e.status === 'ACTIVE' ? 'badge-success' : 'badge-danger'}">${escapeHtml(e.status)}</span></td>
      <td style="white-space:nowrap;">
        <button class="btn btn-outline btn-sm" onclick="openEditEmployeeModal(${Number(e.employee_id)})">Edit / View</button>
        <button class="btn btn-outline btn-sm" onclick="openSalaryModal(${Number(e.employee_id)})">Salary</button>
      </td>
    </tr>
  `).join('');
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
    phone: document.getElementById('new-phone').value,
    designation: document.getElementById('new-desig').value,
    role: document.getElementById('new-role').value,
    hire_date: document.getElementById('new-hire').value,
    password: document.getElementById('new-password').value,
    basic_salary: parseFloat(document.getElementById('new-basic').value),
    hra: parseFloat(document.getElementById('new-hra').value || 0),
    special_allowance: parseFloat(document.getElementById('new-spec').value || 0),
    provident_fund: parseFloat(document.getElementById('new-pf').value || 0),
    professional_tax: parseFloat(document.getElementById('new-pt').value || 0)
  };

  const data = await apiFetch('/api/employees', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(payload)
  });

  if (data.success) {
    showToast('Employee created successfully.', 'success');
    closeModal('add-employee-modal');
    e.target.reset();
    await loadEmployees();
  } else {
    showToast(data.error || 'Failed to create employee.', 'error');
  }
}

async function openEditEmployeeModal(employeeId) {
  const data = await apiFetch(`/api/employees/${employeeId}`);
  if (!data.success) {
    showToast(data.error || 'Failed to load employee details.', 'error');
    return;
  }
  const emp = data.employee;
  document.getElementById('edit-emp-title').textContent = `Edit Employee: ${emp.first_name} ${emp.last_name} (${emp.employee_code})`;
  document.getElementById('edit-emp-id').value = emp.employee_id;
  document.getElementById('edit-code').value = emp.employee_code;
  document.getElementById('edit-hire').value = formatDate(emp.hire_date);
  document.getElementById('edit-first').value = emp.first_name;
  document.getElementById('edit-last').value = emp.last_name;
  document.getElementById('edit-email').value = emp.email;
  document.getElementById('edit-phone').value = emp.phone || '';
  document.getElementById('edit-dept').value = emp.department_id;
  document.getElementById('edit-desig').value = emp.designation;
  document.getElementById('edit-role').value = emp.role;
  document.getElementById('edit-status').value = emp.status;
  openModal('edit-employee-modal');
}

async function submitEditEmployee(e) {
  e.preventDefault();
  const id = document.getElementById('edit-emp-id').value;
  const payload = {
    first_name: document.getElementById('edit-first').value,
    last_name: document.getElementById('edit-last').value,
    email: document.getElementById('edit-email').value,
    phone: document.getElementById('edit-phone').value,
    department_id: parseInt(document.getElementById('edit-dept').value, 10),
    designation: document.getElementById('edit-desig').value,
    role: document.getElementById('edit-role').value,
    status: document.getElementById('edit-status').value
  };

  const data = await apiFetch(`/api/employees/${id}`, {
    method: 'PUT',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(payload)
  });

  if (data.success) {
    showToast('Employee updated successfully.', 'success');
    closeModal('edit-employee-modal');
    await loadEmployees();
  } else {
    showToast(data.error || 'Failed to update employee.', 'error');
  }
}

async function openSalaryModal(employeeId) {
  const [empRes, salRes] = await Promise.all([
    apiFetch(`/api/employees/${employeeId}`),
    apiFetch(`/api/salary/${employeeId}`)
  ]);
  if (!empRes.success || !salRes.success) {
    showToast(salRes.error || empRes.error || 'Failed to fetch salary history.', 'error');
    return;
  }

  const emp = empRes.employee;
  document.getElementById('salary-modal-title').textContent = `Salary Structures — ${emp.first_name} ${emp.last_name} (${emp.employee_code})`;
  document.getElementById('sal-emp-id').value = employeeId;

  const latest = salRes.history[0];
  document.getElementById('sal-effective').value = new Date().toISOString().slice(0, 10);
  if (latest) {
    document.getElementById('sal-basic').value = latest.basic_salary;
    document.getElementById('sal-hra').value = latest.hra;
    document.getElementById('sal-spec').value = latest.special_allowance;
    document.getElementById('sal-pf').value = latest.provident_fund;
    document.getElementById('sal-pt').value = latest.professional_tax;
  }

  const tbody = document.getElementById('salary-history-body');
  tbody.innerHTML = salRes.history.map(s => `
    <tr>
      <td>#${Number(s.salary_id)}</td>
      <td>${formatDate(s.effective_date)}</td>
      <td>${formatMoney(s.basic_salary)}</td>
      <td>${formatMoney(s.hra)}</td>
      <td>${formatMoney(s.special_allowance)}</td>
      <td>${formatMoney(s.provident_fund)} / ${formatMoney(s.professional_tax)}</td>
      <td><span class="badge ${s.is_active ? 'badge-success' : 'badge-neutral'}">${s.is_active ? 'ACTIVE' : 'HISTORICAL'}</span></td>
    </tr>
  `).join('');

  openModal('salary-modal');
}

async function submitSalaryRevision(e) {
  e.preventDefault();
  const employeeId = document.getElementById('sal-emp-id').value;
  const payload = {
    effective_date: document.getElementById('sal-effective').value,
    basic_salary: parseFloat(document.getElementById('sal-basic').value),
    hra: parseFloat(document.getElementById('sal-hra').value || 0),
    special_allowance: parseFloat(document.getElementById('sal-spec').value || 0),
    provident_fund: parseFloat(document.getElementById('sal-pf').value || 0),
    professional_tax: parseFloat(document.getElementById('sal-pt').value || 0)
  };

  const data = await apiFetch(`/api/salary/${employeeId}`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(payload)
  });

  if (data.success) {
    showToast('Salary structure revised successfully.', 'success');
    await openSalaryModal(employeeId);
    await loadEmployees();
  } else {
    showToast(data.error || 'Failed to revise salary structure.', 'error');
  }
}

// ============================================================================
// Attendance Management (HR Create/Edit; Employee Read-Only)
// ============================================================================

function resetAttendanceFilters() {
  document.getElementById('att-emp-filter').value = '';
  document.getElementById('att-period-filter').value = '';
  document.getElementById('att-start-filter').value = '';
  document.getElementById('att-end-filter').value = '';
  loadAttendanceTable();
}

async function loadAttendanceTable() {
  const isHR = currentUser.role === 'HR_ADMIN';
  const qs = new URLSearchParams();
  if (isHR) {
    const empId = document.getElementById('att-emp-filter')?.value;
    const periodId = document.getElementById('att-period-filter')?.value;
    const startDate = document.getElementById('att-start-filter')?.value;
    const endDate = document.getElementById('att-end-filter')?.value;
    if (empId) qs.set('employeeId', empId);
    if (periodId) qs.set('periodId', periodId);
    else {
      if (startDate) qs.set('startDate', startDate);
      if (endDate) qs.set('endDate', endDate);
    }
  }

  const data = await apiFetch(`/api/attendance${qs.toString() ? '?' + qs.toString() : ''}`);
  if (!data.success) {
    showToast(data.error || 'Failed to load attendance records.', 'error');
    return;
  }

  cachedAttendanceRows = data.attendance;
  const tbody = document.getElementById('attendance-table-body');
  if (data.attendance.length === 0) {
    tbody.innerHTML = `<tr><td colspan="${isHR ? 8 : 7}" class="text-muted" style="text-align:center;">No attendance records found.</td></tr>`;
    return;
  }

  tbody.innerHTML = data.attendance.map(a => `
    <tr>
      <td><strong>${formatDate(a.work_date)}</strong></td>
      <td>${escapeHtml(a.full_name)} (${escapeHtml(a.employee_code)})</td>
      <td>
        <span class="badge ${a.status === 'PRESENT' ? 'badge-success' : (a.status === 'ON_LEAVE' ? 'badge-info' : (a.status === 'HALF_DAY' ? 'badge-warning' : 'badge-danger'))}">
          ${escapeHtml(a.status)}
        </span>
      </td>
      <td>${escapeHtml(a.check_in_time || '—')}</td>
      <td>${escapeHtml(a.check_out_time || '—')}</td>
      <td>
        ${a.is_late ? `<span class="badge badge-warning">LATE (${Number(a.late_minutes)}m)</span>` : '<span class="badge badge-success">ON TIME</span>'}
      </td>
      <td class="text-muted">${escapeHtml(a.remarks || '—')}</td>
      ${isHR ? `<td><button class="btn btn-outline btn-sm" onclick="openAttendanceModal(${Number(a.attendance_id)})">Edit</button></td>` : ''}
    </tr>
  `).join('');
}

function toggleAttendanceTimes() {
  const status = document.getElementById('att-status').value;
  const nonWorking = status === 'ABSENT' || status === 'ON_LEAVE';
  document.getElementById('att-times-row').style.display = nonWorking ? 'none' : 'grid';
  if (nonWorking) {
    document.getElementById('att-check-in').value = '';
    document.getElementById('att-check-out').value = '';
  }
}

function openAttendanceModal(attendanceId = null) {
  const empSel = document.getElementById('att-emp-id');
  const dateInput = document.getElementById('att-work-date');

  if (attendanceId) {
    const rec = cachedAttendanceRows.find(r => Number(r.attendance_id) === Number(attendanceId));
    if (!rec) return;
    document.getElementById('att-modal-title').textContent = `Edit Attendance (#${rec.attendance_id})`;
    document.getElementById('att-edit-id').value = rec.attendance_id;
    empSel.value = rec.employee_id;
    empSel.disabled = true;
    dateInput.value = formatDate(rec.work_date);
    dateInput.readOnly = true;
    document.getElementById('att-status').value = rec.status;
    document.getElementById('att-check-in').value = rec.check_in_time || '';
    document.getElementById('att-check-out').value = rec.check_out_time || '';
    document.getElementById('att-remarks').value = rec.remarks || '';
  } else {
    document.getElementById('att-modal-title').textContent = 'Record Attendance Entry';
    document.getElementById('att-edit-id').value = '';
    empSel.disabled = false;
    dateInput.readOnly = false;
    dateInput.value = new Date().toISOString().slice(0, 10);
    document.getElementById('att-status').value = 'PRESENT';
    document.getElementById('att-check-in').value = '09:00:00';
    document.getElementById('att-check-out').value = '18:00:00';
    document.getElementById('att-remarks').value = '';
  }
  toggleAttendanceTimes();
  openModal('attendance-modal');
}

async function submitAttendance(e) {
  e.preventDefault();
  const editId = document.getElementById('att-edit-id').value;
  const status = document.getElementById('att-status').value;
  const isNonWorking = status === 'ABSENT' || status === 'ON_LEAVE';
  const checkIn = isNonWorking ? null : (document.getElementById('att-check-in').value || null);
  const checkOut = isNonWorking ? null : (document.getElementById('att-check-out').value || null);
  const remarks = document.getElementById('att-remarks').value;

  let data;
  if (editId) {
    data = await apiFetch(`/api/attendance/${editId}`, {
      method: 'PUT',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ status, check_in_time: checkIn, check_out_time: checkOut, remarks })
    });
  } else {
    data = await apiFetch('/api/attendance', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        employee_id: parseInt(document.getElementById('att-emp-id').value, 10),
        work_date: document.getElementById('att-work-date').value,
        status,
        check_in_time: checkIn,
        check_out_time: checkOut,
        remarks
      })
    });
  }

  if (data.success) {
    showToast(data.message, 'success');
    closeModal('attendance-modal');
    await loadAttendanceTable();
  } else {
    showToast(data.error || 'Failed to save attendance record.', 'error');
  }
}

// ============================================================================
// Leave Management (HR Creates/Approves; Employee Read-Only)
// ============================================================================

async function loadLeavesTable() {
  const data = await apiFetch('/api/leaves');
  if (!data.success) {
    showToast(data.error || 'Failed to load leave records.', 'error');
    return;
  }

  const isHR = currentUser.role === 'HR_ADMIN';
  const tbody = document.getElementById('leaves-table-body');
  if (data.leaves.length === 0) {
    tbody.innerHTML = `<tr><td colspan="${isHR ? 8 : 7}" class="text-muted" style="text-align:center;">No leave records found.</td></tr>`;
    return;
  }

  const leaves = [...data.leaves].sort((a, b) => (b.status === 'PENDING' ? 1 : 0) - (a.status === 'PENDING' ? 1 : 0));

  tbody.innerHTML = leaves.map(l => `
    <tr>
      <td><strong>${escapeHtml(l.full_name)}</strong><br><span class="text-muted" style="font-size:0.75rem">${escapeHtml(l.employee_code)}</span></td>
      <td><span class="badge badge-neutral">${escapeHtml(l.leave_type)}</span></td>
      <td>${formatDate(l.start_date)} to ${formatDate(l.end_date)}</td>
      <td>${Number(l.total_days)} Day(s)</td>
      <td>${escapeHtml(l.reason)}</td>
      <td>
        <span class="badge ${l.status === 'APPROVED' ? 'badge-success' : (l.status === 'PENDING' ? 'badge-warning' : 'badge-danger')}">
          ${escapeHtml(l.status)}
        </span>
      </td>
      <td>${escapeHtml(l.actioned_by_name || 'Pending')}</td>
      ${isHR ? `
        <td style="white-space:nowrap;">
          ${l.status === 'PENDING' ? `
            <button class="btn btn-success btn-sm" onclick="updateLeaveStatus(${Number(l.leave_id)}, 'APPROVED')">Approve</button>
            <button class="btn btn-danger btn-sm" onclick="updateLeaveStatus(${Number(l.leave_id)}, 'REJECTED')">Reject</button>
          ` : (l.status === 'APPROVED' ? `
            <button class="btn btn-outline btn-sm" onclick="updateLeaveStatus(${Number(l.leave_id)}, 'CANCELLED')">Cancel</button>
          ` : '—')}
        </td>
      ` : ''}
    </tr>
  `).join('');
}

function openApplyLeaveModal() {
  document.getElementById('leave-days').value = 0;
  openModal('apply-leave-modal');
}

function calcLeaveDays() {
  const s = document.getElementById('leave-start').value;
  const e = document.getElementById('leave-end').value;
  if (!s || !e || s > e) {
    document.getElementById('leave-days').value = 0;
    return;
  }
  const [sy, sm, sd] = s.split('-').map(Number);
  const [ey, em, ed] = e.split('-').map(Number);
  const curr = new Date(Date.UTC(sy, sm - 1, sd));
  const end = new Date(Date.UTC(ey, em - 1, ed));
  let count = 0;
  while (curr <= end) {
    const dow = curr.getUTCDay();
    if (dow !== 0 && dow !== 6) count++;
    curr.setUTCDate(curr.getUTCDate() + 1);
  }
  document.getElementById('leave-days').value = count;
}

async function submitApplyLeave(e) {
  e.preventDefault();
  const employee_id = parseInt(document.getElementById('leave-emp-id').value, 10);
  const leave_type = document.getElementById('leave-type').value;
  const status = document.getElementById('leave-init-status').value;
  const start_date = document.getElementById('leave-start').value;
  const end_date = document.getElementById('leave-end').value;
  const reason = document.getElementById('leave-reason').value;

  const data = await apiFetch('/api/leaves', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ employee_id, leave_type, status, start_date, end_date, reason })
  });

  if (data.success) {
    showToast(`Leave record saved (${data.total_days} working day(s)).`, 'success');
    closeModal('apply-leave-modal');
    e.target.reset();
    await loadLeavesTable();
  } else {
    showToast(data.error || 'Failed to save leave record.', 'error');
  }
}

async function updateLeaveStatus(leaveId, status) {
  const data = await apiFetch(`/api/leaves/${leaveId}/status`, {
    method: 'PUT',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ status, admin_remarks: `Actioned as ${status} by HR Admin` })
  });

  if (data.success) {
    showToast(data.message, 'success');
    await loadLeavesTable();
  } else {
    showToast(data.error || 'Failed to update leave.', 'error');
  }
}

// ============================================================================
// Payroll, Payslips & Audit Logs
// ============================================================================

async function loadPayrollAdminTable() {
  const periodId = document.getElementById('payroll-period-select')?.value || 2;
  const data = await apiFetch(`/api/payroll?periodId=${encodeURIComponent(periodId)}`);
  if (!data.success) {
    showToast(data.error || 'Failed to load payroll records.', 'error');
    return;
  }

  const tbody = document.getElementById('payroll-admin-table-body');
  if (data.payrolls.length === 0) {
    tbody.innerHTML = '<tr><td colspan="8" class="text-muted" style="text-align:center;">No payroll records calculated for this period yet.</td></tr>';
    return;
  }

  tbody.innerHTML = data.payrolls.map(p => `
    <tr>
      <td>
        <strong>${escapeHtml(p.full_name)}</strong><br>
        <span class="text-muted" style="font-size:0.75rem">${escapeHtml(p.employee_code)}</span>
      </td>
      <td>${escapeHtml(p.department_name)}</td>
      <td>${Number(p.present_days)} / ${Number(p.late_days)} / ${Number(p.unpaid_leave_days)}</td>
      <td><strong>${formatMoney(p.gross_earnings)}</strong></td>
      <td class="text-danger">${formatMoney(p.total_deductions)}</td>
      <td><strong class="text-success">${formatMoney(p.net_salary)}</strong></td>
      <td><span class="badge badge-success">${escapeHtml(p.payment_status)}</span></td>
      <td>
        <button class="btn btn-outline btn-sm" onclick="openSlipModal(${Number(p.payroll_id)})">View Slip</button>
      </td>
    </tr>
  `).join('');
}

async function loadMyPayslips() {
  const data = await apiFetch('/api/payroll');
  if (!data.success) {
    showToast(data.error || 'Failed to load salary slips.', 'error');
    return;
  }

  const tbody = document.getElementById('my-payslips-body');
  if (data.payrolls.length === 0) {
    tbody.innerHTML = '<tr><td colspan="8" class="text-muted" style="text-align:center;">No finalized salary slips found.</td></tr>';
    return;
  }

  tbody.innerHTML = data.payrolls.map(p => `
    <tr>
      <td><strong>${escapeHtml(p.period_name)}</strong></td>
      <td>${formatDate(p.start_date)} to ${formatDate(p.end_date)}</td>
      <td>${Number(p.present_days)} / ${Number(p.total_working_days)}</td>
      <td>${formatMoney(p.gross_earnings)}</td>
      <td class="text-danger">${formatMoney(p.total_deductions)}</td>
      <td><strong class="text-success">${formatMoney(p.net_salary)}</strong></td>
      <td><span class="badge badge-success">${escapeHtml(p.payment_status)}</span></td>
      <td>
        <button class="btn btn-primary btn-sm" onclick="openSlipModal(${Number(p.payroll_id)})">Itemized Slip</button>
      </td>
    </tr>
  `).join('');
}

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

  const eBody = document.getElementById('slip-earnings-body');
  eBody.innerHTML = s.earnings.map(i => `
    <tr><td>${escapeHtml(i.item_name)}</td><td class="text-right">${formatMoney(i.amount)}</td></tr>
  `).join('');
  document.getElementById('slip-total-gross').textContent = formatMoney(s.gross_earnings);

  const dBody = document.getElementById('slip-deductions-body');
  dBody.innerHTML = s.deductions.map(i => `
    <tr>
      <td>${escapeHtml(i.item_name)}<br><small class="text-muted">${escapeHtml(i.description || '')}</small></td>
      <td class="text-right text-danger">${formatMoney(i.amount)}</td>
    </tr>
  `).join('');
  document.getElementById('slip-total-deductions').textContent = formatMoney(s.total_deductions);

  document.getElementById('slip-net-amount').textContent = formatMoney(s.net_salary);
  document.getElementById('slip-disbursal-note').textContent = `Status: ${s.payment_status}${s.remarks ? ' • ' + s.remarks : ''}`;

  openModal('slip-modal');
}

function openRunPayrollModal() {
  populatePeriodSelects();
  populateEmployeeSelects();
  openModal('run-payroll-modal');
}

async function submitRunPayroll() {
  const periodId = document.getElementById('run-period-id').value;
  const employeeId = document.getElementById('run-employee-id').value;

  const data = await apiFetch('/api/payroll/process', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ periodId: parseInt(periodId, 10), employeeId: employeeId ? parseInt(employeeId, 10) : null })
  });

  if (data.success) {
    showToast(data.message, 'success');
    closeModal('run-payroll-modal');
    const adminSel = document.getElementById('payroll-period-select');
    if (adminSel) adminSel.value = periodId;
    await loadPayrollAdminTable();
  } else {
    showToast(data.error || 'Payroll calculation failed.', 'error');
  }
}

function openTestRollbackModal() {
  document.getElementById('rollback-result-box').style.display = 'none';
  openModal('test-rollback-modal');
}

async function executeRollbackTest() {
  const box = document.getElementById('rollback-result-box');
  box.style.display = 'block';
  box.textContent = 'Executing multi-step transaction safety check...';

  const data = await apiFetch('/api/payroll/test-rollback', { method: 'POST' });
  if (data.success) {
    box.innerHTML = `
      <strong style="color:var(--success)">✅ ${escapeHtml(data.status)}</strong>
      <p style="margin-top:4px"><strong>Procedure Output:</strong> ${escapeHtml(data.message)}</p>
    `;
    showToast('Rollback demonstration completed successfully.', 'success');
  } else {
    box.innerHTML = `<span style="color:var(--danger)">❌ Test Error: ${escapeHtml(data.error)}</span>`;
    showToast(data.error || 'Rollback test failed.', 'error');
  }
}

async function loadAuditLogs() {
  const data = await apiFetch('/api/audit-logs');
  if (!data.success) {
    showToast(data.error || 'Failed to load audit logs.', 'error');
    return;
  }

  const tbody = document.getElementById('audit-table-body');
  tbody.innerHTML = data.logs.map(log => {
    let formattedJson = '—';
    if (log.new_values) {
      try {
        formattedJson = escapeHtml(JSON.stringify(JSON.parse(log.new_values), null, 2));
      } catch (_) {
        formattedJson = escapeHtml(log.new_values);
      }
    }
    return `
      <tr>
        <td>#${Number(log.log_id)}</td>
        <td>${escapeHtml(new Date(log.created_at).toLocaleString())}</td>
        <td><code>${escapeHtml(log.table_name)}</code></td>
        <td>${Number(log.record_id)}</td>
        <td><span class="badge ${log.action === 'INSERT' ? 'badge-success' : 'badge-info'}">${escapeHtml(log.action)}</span></td>
        <td>${escapeHtml(log.actor_name || 'System / Batch')}</td>
        <td><pre style="font-size:0.75rem; max-width:320px; overflow-x:auto;">${formattedJson}</pre></td>
      </tr>
    `;
  }).join('');
}

// ============================================================================
// Reports Loader (Phase 3)
// ============================================================================

function switchReport(viewId, btnEl) {
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

  if (btnEl) btnEl.classList.add('active');
  refreshCurrentReport();
}

function refreshCurrentReport() {
  const periodId = document.getElementById('report-period-select')?.value || 2;
  const activeView = document.querySelector('.report-view.active') || document.getElementById('rep-attendance');

  if (activeView.id === 'rep-attendance') loadAttendanceSummaryReport(periodId);
  else if (activeView.id === 'rep-late') loadLateMarksReport(periodId);
  else if (activeView.id === 'rep-dept') loadDepartmentalReport(periodId);
}

async function loadAttendanceSummaryReport(periodId = 2) {
  const data = await apiFetch(`/api/reports/attendance-summary?periodId=${encodeURIComponent(periodId)}`);
  if (!data.success) {
    showToast(data.error || 'Failed to load attendance summary.', 'error');
    return;
  }

  const tbody = document.getElementById('rep-attendance-body');
  tbody.innerHTML = data.summary.map(s => `
    <tr>
      <td><code>${escapeHtml(s.employee_code)}</code></td>
      <td><strong>${escapeHtml(s.full_name)}</strong></td>
      <td>${escapeHtml(s.department_name)}</td>
      <td>${Number(s.total_working_days)}</td>
      <td>${Number(s.days_present)}</td>
      <td>${Number(s.days_absent)}</td>
      <td>${Number(s.days_on_leave)}</td>
      <td>${s.late_marks > 3 ? `<span class="badge badge-warning">${Number(s.late_marks)}</span>` : Number(s.late_marks)}</td>
      <td><strong>${Number(s.attendance_percentage)}%</strong></td>
    </tr>
  `).join('');
}

async function loadLateMarksReport(periodId = 2) {
  const data = await apiFetch(`/api/reports/late-marks?periodId=${encodeURIComponent(periodId)}`);
  if (!data.success) {
    showToast(data.error || 'Failed to load late-marks report.', 'error');
    return;
  }

  const tbody = document.getElementById('rep-late-body');
  if (data.late_marks.length === 0) {
    tbody.innerHTML = '<tr><td colspan="6" class="text-muted" style="text-align:center;">No late marks recorded in this period.</td></tr>';
    return;
  }

  tbody.innerHTML = data.late_marks.map(l => `
    <tr>
      <td><strong>${escapeHtml(l.full_name)}</strong> (${escapeHtml(l.employee_code)})</td>
      <td>${escapeHtml(l.department_name)}</td>
      <td>${formatDate(l.work_date)}</td>
      <td><code>${escapeHtml(l.check_in_time)}</code></td>
      <td><span class="badge badge-warning">${Number(l.late_minutes)} min</span></td>
      <td>${escapeHtml(l.remarks || '—')}</td>
    </tr>
  `).join('');
}

async function loadDepartmentalReport(periodId = 2) {
  const data = await apiFetch(`/api/reports/departmental?periodId=${encodeURIComponent(periodId)}`);
  if (!data.success) {
    showToast(data.error || 'Failed to load departmental report.', 'error');
    return;
  }

  const tbody = document.getElementById('rep-dept-body');
  if (data.departments.length === 0) {
    tbody.innerHTML = '<tr><td colspan="6" class="text-muted" style="text-align:center;">No departmental payroll records for this period.</td></tr>';
    return;
  }

  tbody.innerHTML = data.departments.map(d => `
    <tr>
      <td><strong>${escapeHtml(d.department_name)}</strong></td>
      <td>${Number(d.employee_count)}</td>
      <td>${formatMoney(d.total_gross_earnings)}</td>
      <td class="text-danger">${formatMoney(d.total_deductions)}</td>
      <td><strong class="text-success">${formatMoney(d.total_net_disbursed)}</strong></td>
      <td>${formatMoney(d.average_net_salary)}</td>
    </tr>
  `).join('');
}

window.addEventListener('DOMContentLoaded', checkSession);

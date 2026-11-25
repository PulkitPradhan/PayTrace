const fs = require('fs');
const bcrypt = require('bcryptjs');

const makeHash = (pwd) => bcrypt.hashSync(pwd, 10);

const departments = [
  { id: 1, name: 'Engineering', desc: 'Software development, infrastructure, and QA' },
  { id: 2, name: 'Human Resources', desc: 'People operations, payroll, and compliance' },
  { id: 3, name: 'Finance & Accounting', desc: 'Financial planning, audit, and taxation' },
  { id: 4, name: 'Marketing & Sales', desc: 'Client acquisition, branding, and content' },
  { id: 5, name: 'Operations & Support', desc: 'Customer service, logistics, and facilities' }
];

const employees = [
  { id: 1, code: 'EMP001', first: 'Alice', last: 'Morgan', email: 'alice.morgan@paytrace.local', phone: '+1-555-0101', dept: 2, desig: 'HR Director', role: 'HR_ADMIN', hash: makeHash('Admin123!'), hire: '2024-01-15', basic: 95000, hra: 38000, spec: 17000, pf: 11400, pt: 200 },
  { id: 2, code: 'EMP002', first: 'Robert', last: 'Chen', email: 'robert.chen@paytrace.local', phone: '+1-555-0102', dept: 1, desig: 'Engineering Manager', role: 'HR_ADMIN', hash: makeHash('Admin123!'), hire: '2024-02-01', basic: 110000, hra: 44000, spec: 26000, pf: 13200, pt: 200 },
  { id: 3, code: 'EMP003', first: 'David', last: 'Miller', email: 'david.miller@paytrace.local', phone: '+1-555-0103', dept: 1, desig: 'Senior Backend Engineer', role: 'EMPLOYEE', hash: makeHash('Employee123!'), hire: '2024-03-10', basic: 85000, hra: 34000, spec: 16000, pf: 10200, pt: 200 },
  { id: 4, code: 'EMP004', first: 'Sarah', last: 'Jenkins', email: 'sarah.jenkins@paytrace.local', phone: '+1-555-0104', dept: 1, desig: 'Frontend Engineer', role: 'EMPLOYEE', hash: makeHash('Employee123!'), hire: '2024-04-15', basic: 65000, hra: 26000, spec: 9000, pf: 7800, pt: 200 },
  { id: 5, code: 'EMP005', first: 'Elena', last: 'Rostova', email: 'elena.rostova@paytrace.local', phone: '+1-555-0105', dept: 1, desig: 'DevOps Specialist', role: 'EMPLOYEE', hash: makeHash('Employee123!'), hire: '2024-05-01', basic: 75000, hra: 30000, spec: 15000, pf: 9000, pt: 200 },
  { id: 6, code: 'EMP006', first: 'James', last: 'Wilson', email: 'james.wilson@paytrace.local', phone: '+1-555-0106', dept: 3, desig: 'Senior Financial Analyst', role: 'EMPLOYEE', hash: makeHash('Employee123!'), hire: '2024-02-15', basic: 70000, hra: 28000, spec: 12000, pf: 8400, pt: 200 },
  { id: 7, code: 'EMP007', first: 'Maria', last: 'Garcia', email: 'maria.garcia@paytrace.local', phone: '+1-555-0107', dept: 3, desig: 'Accountant', role: 'EMPLOYEE', hash: makeHash('Employee123!'), hire: '2024-06-01', basic: 48000, hra: 19200, spec: 7800, pf: 5760, pt: 200 },
  { id: 8, code: 'EMP008', first: 'Liam', last: 'Patel', email: 'liam.patel@paytrace.local', phone: '+1-555-0108', dept: 4, desig: 'Marketing Lead', role: 'EMPLOYEE', hash: makeHash('Employee123!'), hire: '2024-03-01', basic: 62000, hra: 24800, spec: 10200, pf: 7440, pt: 200 },
  { id: 9, code: 'EMP009', first: 'Chloe', last: 'Dubois', email: 'chloe.dubois@paytrace.local', phone: '+1-555-0109', dept: 4, desig: 'Content Specialist', role: 'EMPLOYEE', hash: makeHash('Employee123!'), hire: '2024-06-15', basic: 42000, hra: 16800, spec: 6200, pf: 5040, pt: 200 },
  { id: 10, code: 'EMP010', first: 'Kevin', last: 'O\'\'Connor', email: 'kevin.oconnor@paytrace.local', phone: '+1-555-0110', dept: 5, desig: 'Operations Manager', role: 'EMPLOYEE', hash: makeHash('Employee123!'), hire: '2024-01-20', basic: 58000, hra: 23200, spec: 8800, pf: 6960, pt: 200 },
  { id: 11, code: 'EMP011', first: 'Aisha', last: 'Khan', email: 'aisha.khan@paytrace.local', phone: '+1-555-0111', dept: 5, desig: 'Support Specialist', role: 'EMPLOYEE', hash: makeHash('Employee123!'), hire: '2024-05-10', basic: 35000, hra: 14000, spec: 6000, pf: 4200, pt: 200 },
  { id: 12, code: 'EMP012', first: 'Marcus', last: 'Vance', email: 'marcus.vance@paytrace.local', phone: '+1-555-0112', dept: 1, desig: 'QA Automation Engineer', role: 'EMPLOYEE', hash: makeHash('Employee123!'), hire: '2024-04-01', basic: 55000, hra: 22000, spec: 8000, pf: 6600, pt: 200 }
];

const periods = [
  { id: 1, name: 'June 2026', start: '2026-06-01', end: '2026-06-30', days: 22, status: 'CLOSED' },
  { id: 2, name: 'July 2026', start: '2026-07-01', end: '2026-07-31', days: 23, status: 'CLOSED' },
  { id: 3, name: 'August 2026', start: '2026-08-01', end: '2026-08-31', days: 21, status: 'FINALIZED' }
];

const leaves = [
  // Approved leaves
  { id: 1, emp: 3, type: 'CASUAL', start: '2026-06-12', end: '2026-06-12', days: 1.0, reason: 'Personal family event', status: 'APPROVED', actionBy: 1, actionDate: '2026-06-10 10:00:00', remarks: 'Approved' },
  { id: 2, emp: 4, type: 'SICK', start: '2026-06-22', end: '2026-06-23', days: 2.0, reason: 'Viral infection with medical cert', status: 'APPROVED', actionBy: 1, actionDate: '2026-06-21 14:30:00', remarks: 'Medical certificate verified' },
  { id: 3, emp: 8, type: 'UNPAID', start: '2026-06-18', end: '2026-06-19', days: 2.0, reason: 'Relocation personal matters', status: 'APPROVED', actionBy: 1, actionDate: '2026-06-16 09:15:00', remarks: 'Unpaid leave granted per policy' },
  { id: 4, emp: 5, type: 'CASUAL', start: '2026-07-10', end: '2026-07-10', days: 1.0, reason: 'Home maintenance', status: 'APPROVED', actionBy: 2, actionDate: '2026-07-08 11:20:00', remarks: 'Approved by Engineering Manager' },
  { id: 5, emp: 7, type: 'SICK', start: '2026-07-27', end: '2026-07-28', days: 2.0, reason: 'Severe migraine', status: 'APPROVED', actionBy: 1, actionDate: '2026-07-26 18:00:00', remarks: 'Approved' },
  { id: 6, emp: 11, type: 'UNPAID', start: '2026-07-15', end: '2026-07-16', days: 2.0, reason: 'Academic exam preparation', status: 'APPROVED', actionBy: 1, actionDate: '2026-07-12 16:40:00', remarks: 'Approved without pay' },
  { id: 7, emp: 3, type: 'PAID', start: '2026-08-14', end: '2026-08-14', days: 1.0, reason: 'Annual personal day', status: 'APPROVED', actionBy: 2, actionDate: '2026-08-10 09:00:00', remarks: 'Approved' },
  { id: 8, emp: 10, type: 'CASUAL', start: '2026-08-20', end: '2026-08-21', days: 2.0, reason: 'Out-of-town wedding', status: 'APPROVED', actionBy: 1, actionDate: '2026-08-18 15:10:00', remarks: 'Approved' },
  // Rejected & Pending leaves
  { id: 9, emp: 4, type: 'CASUAL', start: '2026-07-03', end: '2026-07-03', days: 1.0, reason: 'Long weekend request', status: 'REJECTED', actionBy: 1, actionDate: '2026-07-01 11:00:00', remarks: 'Rejected due to critical release freeze' },
  { id: 10, emp: 9, type: 'SICK', start: '2026-08-28', end: '2026-08-28', days: 1.0, reason: 'Dental appointment', status: 'PENDING', actionBy: null, actionDate: null, remarks: null }
];

let sql = `-- ============================================================================
-- PayTrace: Seed Data (Phase 2)
-- Realistic dataset: 5 Departments, 12 Employees, 3 Months (June, July, August 2026)
-- Full attendance tracking, diverse salaries, approved/rejected leaves, and processed payrolls.
-- ============================================================================

SET NAMES utf8mb4;
SET foreign_key_checks = 0;

TRUNCATE TABLE \`payroll_items\`;
TRUNCATE TABLE \`payrolls\`;
TRUNCATE TABLE \`attendance\`;
TRUNCATE TABLE \`leaves\`;
TRUNCATE TABLE \`salary_structures\`;
TRUNCATE TABLE \`employees\`;
TRUNCATE TABLE \`departments\`;
TRUNCATE TABLE \`payroll_periods\`;
TRUNCATE TABLE \`audit_logs\`;

SET foreign_key_checks = 1;

-- ----------------------------------------------------------------------------
-- 1. Seed Departments
-- ----------------------------------------------------------------------------
INSERT INTO \`departments\` (\`department_id\`, \`department_name\`, \`description\`) VALUES
`;

sql += departments.map(d => `(${d.id}, '${d.name}', '${d.desc}')`).join(',\n') + ';\n\n';

// 2. Seed Employees
sql += `-- ----------------------------------------------------------------------------
-- 2. Seed Employees
-- ----------------------------------------------------------------------------
INSERT INTO \`employees\` (
  \`employee_id\`, \`employee_code\`, \`first_name\`, \`last_name\`, \`email\`, \`phone\`,
  \`department_id\`, \`designation\`, \`role\`, \`password_hash\`, \`hire_date\`, \`status\`
) VALUES
`;

sql += employees.map(e => `(${e.id}, '${e.code}', '${e.first}', '${e.last}', '${e.email}', '${e.phone}', ${e.dept}, '${e.desig}', '${e.role}', '${e.hash}', '${e.hire}', 'ACTIVE')`).join(',\n') + ';\n\n';

// 3. Seed Salary Structures
sql += `-- ----------------------------------------------------------------------------
-- 3. Seed Salary Structures (Active baseline configurations)
-- ----------------------------------------------------------------------------
INSERT INTO \`salary_structures\` (
  \`salary_id\`, \`employee_id\`, \`basic_salary\`, \`hra\`, \`special_allowance\`,
  \`provident_fund\`, \`professional_tax\`, \`effective_date\`, \`is_active\`
) VALUES
`;

sql += employees.map(e => `(${e.id}, ${e.id}, ${e.basic.toFixed(2)}, ${e.hra.toFixed(2)}, ${e.spec.toFixed(2)}, ${e.pf.toFixed(2)}, ${e.pt.toFixed(2)}, '${e.hire}', TRUE)`).join(',\n') + ';\n\n';

// 4. Seed Payroll Periods
sql += `-- ----------------------------------------------------------------------------
-- 4. Seed Payroll Periods (June 2026, July 2026, August 2026)
-- ----------------------------------------------------------------------------
INSERT INTO \`payroll_periods\` (\`period_id\`, \`period_name\`, \`start_date\`, \`end_date\`, \`total_working_days\`, \`status\`) VALUES
`;

sql += periods.map(p => `(${p.id}, '${p.name}', '${p.start}', '${p.end}', ${p.days}, '${p.status}')`).join(',\n') + ';\n\n';

// 5. Seed Leaves
sql += `-- ----------------------------------------------------------------------------
-- 5. Seed Leaves (Approved, Rejected, and Pending)
-- ----------------------------------------------------------------------------
INSERT INTO \`leaves\` (
  \`leave_id\`, \`employee_id\`, \`leave_type\`, \`start_date\`, \`end_date\`, \`total_days\`,
  \`reason\`, \`status\`, \`actioned_by\`, \`actioned_on\`, \`admin_remarks\`
) VALUES
`;

sql += leaves.map(l => `(${l.id}, ${l.emp}, '${l.type}', '${l.start}', '${l.end}', ${l.days.toFixed(1)}, '${l.reason}', '${l.status}', ${l.actionBy ? l.actionBy : 'NULL'}, ${l.actionDate ? `'${l.actionDate}'` : 'NULL'}, ${l.remarks ? `'${l.remarks}'` : 'NULL'})`).join(',\n') + ';\n\n';

// 6. Generate Daily Attendance
sql += `-- ----------------------------------------------------------------------------
-- 6. Seed Daily Attendance (June, July, August 2026 weekdays)
-- Includes normal on-time arrivals, late marks (>09:15), approved leaves, and occasional absences
-- ----------------------------------------------------------------------------
INSERT INTO \`attendance\` (
  \`employee_id\`, \`work_date\`, \`status\`, \`check_in_time\`, \`check_out_time\`, \`is_late\`, \`late_minutes\`, \`remarks\`
) VALUES
`;

const attendanceRows = [];

function isWeekend(dateStr) {
  const d = new Date(dateStr + 'T00:00:00');
  const day = d.getDay();
  return day === 0 || day === 6; // Sunday or Saturday
}

function getApprovedLeave(empId, dateStr) {
  return leaves.find(l => l.emp === empId && l.status === 'APPROVED' && dateStr >= l.start && dateStr <= l.end);
}

// Helper to iterate dates in period
function generateAttendanceForPeriod(period) {
  const start = new Date(period.start + 'T00:00:00');
  const end = new Date(period.end + 'T00:00:00');
  
  for (let d = new Date(start); d <= end; d.setDate(d.getDate() + 1)) {
    const yyyy = d.getFullYear();
    const mm = String(d.getMonth() + 1).padStart(2, '0');
    const dd = String(d.getDate()).padStart(2, '0');
    const dateStr = `${yyyy}-${mm}-${dd}`;

    if (isWeekend(dateStr)) continue; // skip weekends

    for (const emp of employees) {
      const leave = getApprovedLeave(emp.id, dateStr);
      if (leave) {
        attendanceRows.push(`(${emp.id}, '${dateStr}', 'ON_LEAVE', NULL, NULL, FALSE, 0, 'Approved ${leave.type} Leave')`);
        continue;
      }

      // Check for specific scenario absences / late marks to ensure variety
      // Emp 4 (Sarah) has frequent late marks in July to test late threshold penalty (>3 late marks)
      // Emp 8 (Liam) has 4 late marks in August
      let isLate = false;
      let lateMinutes = 0;
      let checkIn = '08:55:00';
      let checkOut = '18:05:00';
      let status = 'PRESENT';
      let remarks = 'Punctual';

      // Seed deterministic late marks
      if (emp.id === 4 && period.id === 2 && ['2026-07-06', '2026-07-13', '2026-07-20', '2026-07-24', '2026-07-29'].includes(dateStr)) {
        isLate = true;
        lateMinutes = 35;
        checkIn = '09:35:00';
        remarks = 'Traffic congestion';
      } else if (emp.id === 8 && period.id === 3 && ['2026-08-04', '2026-08-11', '2026-08-18', '2026-08-25'].includes(dateStr)) {
        isLate = true;
        lateMinutes = 40;
        checkIn = '09:40:00';
        remarks = 'Commute delay';
      } else if (emp.id === 11 && period.id === 1 && ['2026-06-08', '2026-06-15'].includes(dateStr)) {
        isLate = true;
        lateMinutes = 20;
        checkIn = '09:20:00';
        remarks = 'Public transport delay';
      } else if (emp.id === 7 && dateStr === '2026-06-25') {
        // Direct unexcused absence
        status = 'ABSENT';
        checkIn = 'NULL';
        checkOut = 'NULL';
        remarks = 'Unexcused absence';
      } else {
        // Normal distribution: slight check-in variation
        const dayNum = d.getDate();
        if ((emp.id + dayNum) % 19 === 0) {
          isLate = true;
          lateMinutes = 25;
          checkIn = '09:25:00';
          remarks = 'Slight delay';
        } else {
          isLate = false;
          lateMinutes = 0;
          checkIn = (emp.id % 2 === 0) ? '08:50:00' : '09:05:00';
        }
      }

      if (status === 'ABSENT') {
        attendanceRows.push(`(${emp.id}, '${dateStr}', 'ABSENT', NULL, NULL, FALSE, 0, '${remarks}')`);
      } else {
        attendanceRows.push(`(${emp.id}, '${dateStr}', '${status}', '${checkIn}', '${checkOut}', ${isLate ? 'TRUE' : 'FALSE'}, ${lateMinutes}, '${remarks}')`);
      }
    }
  }
}

periods.forEach(generateAttendanceForPeriod);

sql += attendanceRows.join(',\n') + ';\n\n';

// 7. Execute bulk payroll for June, July, August 2026
sql += `-- ----------------------------------------------------------------------------
-- 7. Execute Procedural Payroll Processing for Periods 1, 2, and 3
-- ----------------------------------------------------------------------------
CALL sp_process_bulk_payroll(1, 1, @p1_processed, @p1_errors);
CALL sp_process_bulk_payroll(2, 1, @p2_processed, @p2_errors);
CALL sp_process_bulk_payroll(3, 1, @p3_processed, @p3_errors);

SELECT 'Seed execution completed successfully' AS status,
       @p1_processed AS june_processed,
       @p2_processed AS july_processed,
       @p3_processed AS august_processed;
`;

fs.writeFileSync('/home/erebusstride/PayTrace/database/seed.sql', sql);
console.log(`Generated database/seed.sql with ${attendanceRows.length} attendance rows.`);

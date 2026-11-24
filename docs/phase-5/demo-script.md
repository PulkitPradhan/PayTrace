# PayTrace — Academic Evaluation & Demonstration Script (Phase 5)

**Author:** Pulkit Pradhan  
**Roll Number:** 2501730036  

## 1. Overview for Evaluator / Professor

This script provides a structured, verifiable demonstration sequence designed to prove compliance with all five phases of the PayTrace Capstone Specification (100 Marks total).

---

## 2. Step-by-Step Demonstration Sequence

### Step 1: Relational Database Schema & Integrity (Phase 1 — 20 Marks)
1. **Show Tables:** Open terminal or MariaDB client and execute:
   ```sql
   USE paytrace_db;
   SHOW TABLES;
   ```
   *Verification:* Exactly 9 normalized tables created in InnoDB engine (`departments`, `employees`, `salary_structures`, `attendance`, `leaves`, `payroll_periods`, `payrolls`, `payroll_items`, `audit_logs`).
2. **Show Constraints:** Point to foreign keys, check constraints (`chk_salary_basic >= 0`, `chk_leave_dates`), and unique keys (`uq_emp_work_date`, `uq_emp_payroll_period`).
3. **Show Documentation & Diagram:** Present `docs/phase-1/schema-design.md`, `docs/phase-1/normalization.md` proving 3NF / BCNF, and the exported visual diagram:
   - Visual Diagram: [docs/assets/diagrams/er-diagram.svg](../assets/diagrams/er-diagram.svg) (High-DPI PNG: [er-diagram.png](../assets/diagrams/er-diagram.png)).

---

### Step 2: Procedural Implementation & Data Seeding (Phase 2 — 20 Marks)
1. **Show Stored Programs:**
   ```sql
   SHOW FUNCTION STATUS WHERE Db = 'paytrace_db';
   SHOW PROCEDURE STATUS WHERE Db = 'paytrace_db';
   SHOW TRIGGERS;
   ```
   *Verification:* Stored functions `fn_calculate_daily_rate`, `fn_calculate_monthly_tds`; stored procedures `sp_calculate_payroll`, `sp_process_bulk_payroll`, `sp_demonstrate_transaction_rollback`; and validation triggers.
   - Lifecycle Diagram: [docs/assets/diagrams/payroll-transaction-workflow.svg](../assets/diagrams/payroll-transaction-workflow.svg)
2. **Show Sample Dataset:**
   ```sql
   SELECT 'Employees' AS entity, COUNT(*) AS count FROM employees
   UNION ALL SELECT 'Periods', COUNT(*) FROM payroll_periods
   UNION ALL SELECT 'Attendance Days', COUNT(*) FROM attendance
   UNION ALL SELECT 'Finalized Payrolls', COUNT(*) FROM payrolls;
   ```
   *Verification:* 12 employees (exceeds minimum of 10) across 3 distinct months (June, July, August 2026), 792 daily attendance records, and 36 finalized payrolls.

---

### Step 3: Mandatory Reports & Query Optimization (Phase 3 — 20 Marks)
1. **Report 1 (Monthly Attendance Summary):**
   Navigate to **Reports & Analytics** -> **Monthly Attendance Summary** (or execute `database/reports.sql`). Show 12 active employees aggregated cleanly without Cartesian row duplication.
   - Live Capture: [docs/assets/screenshots/09-monthly-attendance-report.png](../assets/screenshots/09-monthly-attendance-report.png)
2. **Report 2 (Itemized Salary Slip):**
   Open Sarah Jenkins (`EMP004`), July 2026. Explain the exact mathematical breakdown:
   - Base monthly earnings: $100,000.00
   - July working days: 23 days ($\text{Daily Rate} = \$4,347.83$)
   - Sarah had 6 late marks (3 beyond grace threshold). Penalty $= 3 \times (0.5 \times \$4,347.83) = \$6,521.75$
   - Total Deductions $= \text{PF } (\$7,800) + \text{PT } (\$200) + \text{Late Penalty } (\$6,521.75) + \text{TDS } (\$6,250) = \$20,771.75$
   - Net Salary $= \$100,000.00 - \$20,771.75 = \$79,228.25$.
   - Live Capture: [docs/assets/screenshots/08-itemized-salary-slip.png](../assets/screenshots/08-itemized-salary-slip.png)
3. **Report 3 (Late-Marks Report):**
   Show late arrivals ordered by tardiness.
   - Live Capture: [docs/assets/screenshots/10-late-marks-report.png](../assets/screenshots/10-late-marks-report.png)
4. **Query Optimization Evidence:**
   Show `docs/phase-3/query-optimization.md`. Highlight before-and-after `EXPLAIN FORMAT=JSON`:
   - Before: Table scan on `departments`, filesort with `temporary_table`.
   - After index `idx_attendance_late_lookup`: `attendance` becomes driving range table, `temporary_table` is **ELIMINATED**, and downstream joins use single-row `eq_ref` primary key seeks.

---

### Step 4: Security, RBAC & Transaction Safety (Phase 4 — 20 Marks)
1. **Run Automated Test Suite:**
   In terminal, run:
   ```bash
   npm test
   ```
   *Verification:* All 20 / 20 mandatory test cases pass with green output.
2. **Live RBAC Cross-Employee Denial:**
   Login as David Miller (`david.miller@paytrace.local`). Attempt to fetch Sarah Jenkins' slip (`/api/payroll/itemized/16`).
   *Verification:* Response is immediately blocked with `403 Forbidden` (`Access denied: You are not authorized to view other employees' salary slips.`).
   - Live Capture: [docs/assets/screenshots/11-access-denied-behavior.png](../assets/screenshots/11-access-denied-behavior.png)
3. **Live Transaction Rollback:**
   From the HR Admin dashboard, click **"🧪 Test Rollback"** -> **"Run Rollback Demo"**.
   *Verification:* Live output returns `ROLLBACK_VERIFIED`, proving `sp_demonstrate_transaction_rollback` caught the constraint violation and safely rolled back.

---

### Step 5: Full-Stack Integration & Presentation (Phase 5 — 20 Marks)
1. Open web application at `http://localhost:3000`.
   - Architecture Diagram: [docs/assets/diagrams/system-architecture.svg](../assets/diagrams/system-architecture.svg)
2. Demonstrate HR Admin portal: browse employee directory, review and approve leave requests, inspect audit trail with JSON snapshots.
   - Captures: [02-hr-dashboard.png](../assets/screenshots/02-hr-dashboard.png), [04-employee-roster.png](../assets/screenshots/04-employee-roster.png), [07-payroll-processing.png](../assets/screenshots/07-payroll-processing.png).
3. Switch user to Employee portal: demonstrate personal dashboard, self-service clock-in, leave application, and printable itemized salary slip modal.
   - Captures: [01-login.png](../assets/screenshots/01-login.png), [03-employee-dashboard.png](../assets/screenshots/03-employee-dashboard.png), [05-attendance-management.png](../assets/screenshots/05-attendance-management.png), [06-leave-workflow.png](../assets/screenshots/06-leave-workflow.png).
4. Show that UI connects directly to live Express backend and MariaDB database without hardcoded values.

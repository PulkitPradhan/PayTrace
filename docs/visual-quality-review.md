# PayTrace — Visual Asset Quality & Technical Accuracy Review Report

**Author:** Pulkit Pradhan  
**Roll Number:** 2501730036  
**Project:** PayTrace — Payroll & Attendance Management System (Academic Capstone)  
**Target Repository:** `/home/erebusstride/PayTrace`  
**Overall Status:** **100% PASS (17 / 17 Visual Assets Verified)**

---

## Executive Summary

All technical diagrams (`docs/assets/diagrams/`) and live application screenshots (`docs/assets/screenshots/`) were regenerated and inspected after final code remediation:

1. **Relational & Procedural Integrity:** All 3 Graphviz diagrams (`er-diagram.*`, `system-architecture.*`, `payroll-transaction-workflow.*`) match `database/schema.sql`, `database/security.sql`, `database/procedures.sql`, `src/middleware/auth.js`, and all Express route modules.
2. **UI & Data Authenticity:** All **14** 1440×900 8-bit PNG screenshots were captured over Chromium CDP from the running application backed by MariaDB `13.0.2` (`12` employees, June=22d / July=23d / August=21d working days, August 2026 KPIs, Sarah Jenkins' July 2026 `$79,228.25` slip, salary revision history, rollback modal, and `@app_actor_id`-attributed audit trail).
3. **Zero Static/Placeholder Leakage:** Employee read-only isolation (`03-employee-dashboard.png`), live RBAC `403` defense (`11-access-denied-behavior.png`), and clean ISO period dates are visually confirmed.

---

## Section 1: Technical Diagram Review (3 Sets)

| Diagram Set | Formats | PNG Resolution | Key Technical Fidelity Checks | Status |
| :--- | :--- | :---: | :--- | :---: |
| **`er-diagram.*`** | `.dot`, `.mermaid`, `.svg`, `.png` | `4996 × 3657` | All 9 normalized tables, PK/FK/UK/CHECK notations, and `CASCADE`/`RESTRICT`/`SET NULL` cardinalities match `database/schema.sql` | **PASS** |
| **`system-architecture.*`** | `.dot`, `.mermaid`, `.svg`, `.png` | `7803 × 4619` | Reflects fail-closed `JWT_SECRET`, HttpOnly cookie + CSRF pipeline, read-only `EMPLOYEE` routes, 3 views, `paytrace_app` & `paytrace_reader` DB accounts | **PASS** |
| **`payroll-transaction-workflow.*`** | `.dot`, `.mermaid`, `.svg`, `.png` | `5171 × 9593` | Reflects `HR_ADMIN` validation, `START TRANSACTION` snapshot placement, `effective_date <= period_end`, cross-month leave proration, `HALF_DAY` 0.5 deduction, deduction cap, and `COMMIT`/`ROLLBACK` | **PASS** |

---

## Section 2: Application Screenshot Review (14 Files @ `1440 × 900` PNG)

| Filename | View / Scenario | Verified Live Elements | Status |
| :--- | :--- | :--- | :---: |
| `01-login.png` | Authentication & Role Portal | Split card login with HR & Employee demo fill buttons | **PASS** |
| `02-hr-dashboard.png` | HR Executive Dashboard | `12` Active Employees, `$1,262,000.00` Gross Liability, `1` Pending Leave, `15` August Late Arrivals, exact cycle dates (`21`/`23`/`22` Days) | **PASS** |
| `03-employee-dashboard.png` | Employee Self-Service (Read-Only) | David Miller (`EMP003`); admin links & write controls hidden; personal salary, attendance, leaves & cycles only | **PASS** |
| `04-employee-roster.png` | Employee Roster & Management | All 12 seeded employees across 5 departments with Edit & Salary actions | **PASS** |
| `05-attendance-management.png` | HR Attendance Log & Filters | Daily attendance list with check-in/out times, punctuality tags, and `+ Record Attendance` / `Edit` buttons | **PASS** |
| `06-leave-workflow.png` | HR Leave Approvals & Recording | Leave log showing `+ Record Leave`, `Approve`/`Reject` on `PENDING`, and `Cancel` on `APPROVED` | **PASS** |
| `07-payroll-processing.png` | Payroll Processing View | July 2026 computed cycle for 12 employees with work-day/late breakdowns | **PASS** |
| `08-itemized-salary-slip.png` | Itemized Salary Slip (`EMP004`) | Sarah Jenkins July 2026: `$100,000.00` Gross, `$20,771.75` Deductions (`$6,521.75` Late Penalty), `$79,228.25` Net | **PASS** |
| `09-monthly-attendance-report.png` | Report 1: Attendance Summary | All 12 employees for July 2026 (`23` working days, accurate attendance percentages) | **PASS** |
| `10-late-marks-report.png` | Report 3: Late-Marks Report | `19` July 2026 tardy records sorted cleanly with exact `>09:15:00` delay minutes | **PASS** |
| `11-access-denied-behavior.png` | Live RBAC `403` Toast Banner | `EMP003` receiving server `403 Forbidden` toast on unauthorized `EMP004` slip ID | **PASS** |
| `12-salary-management.png` | HR Salary Revision & History Modal | Effective-dated salary structure history & new revision form inside modal | **PASS** |
| `13-rollback-demo.png` | Multi-Step Rollback Proof Modal | `ROLLBACK_VERIFIED` modal output confirming 2-step atomic rollback | **PASS** |
| `14-audit-trail.png` | Immutable Security Audit Trail | `audit_logs` showing JSON snapshots attributed to `Alice Morgan` via `@app_actor_id` | **PASS** |

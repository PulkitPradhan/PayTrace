# PayTrace — Capstone Viva & Technical Defense Guide (Phase 5)

**Author:** Pulkit Pradhan  
**Roll Number:** 2501730036  

This guide prepares the presenter for examiner questioning across all five capstone phases, grounded directly in verified PayTrace code, SQL behavior, and runtime evidence.

---

## Core Project Metrics Quick-Reference

- **Schema:** 9 normalized InnoDB tables (`database/schema.sql`), frozen SHA-256 preserved across all phases.
- **Dataset:** 5 departments, 12 employees, 12 salary structures, 3 payroll periods (`June 2026 = 22d`, `July 2026 = 23d`, `August 2026 = 21d`), 792 attendance records, 10 leaves, 36 payrolls, 221 itemized payroll lines, 48 initial audit log rows.
- **Landmark Payslip (`EMP004` Sarah Jenkins, July 2026, `payroll_id = 16`):** Gross `$100,000.00`, Deductions `$20,771.75` (PF `$7,800.00` + PT `$200.00` + Late Penalty `$6,521.75` + TDS `$6,250.00`), Net `$79,228.25`.
- **Automated Verification (`npm run test:all`):** `21 / 21` SQL/Unit/HTTP + `11 / 11` Chromium Browser E2E (`0` errors).

---

## 18 Anticipated Viva Questions & Evidence-Backed Answers

### Phase 1 — Data Modeling & Normalization
1. **Why are both `salary_structures` and `payrolls` (plus `payroll_items`) needed instead of storing current salary on `employees`?**  
   Storing salary on `employees` violates historical integrity: revising an employee's pay would corrupt past payslips. Separating `salary_structures` (effective-dated agreements) and `payrolls` + `payroll_items` (immutable monthly disbursements referencing `salary_id` and copying exact line-item amounts) preserves full point-in-time auditability.
2. **Walk through how PayTrace satisfies 1NF, 2NF, and 3NF.**  
   All columns store atomic values (no repeating allowance lists — components reside as rows in `payroll_items`, 1NF). Every table uses a single-column `AUTO_INCREMENT` surrogate PK so partial functional dependencies cannot occur (2NF). Non-key transitive dependencies (e.g., `department_name` belonging to `department_id`, `period_name` belonging to `period_id`) are isolated into dedicated parent tables (3NF).
3. **Why does `payrolls` store `gross_earnings`, `total_deductions`, and `net_salary` if `payroll_items` holds individual lines?**  
   This is an intentional, documented denormalization/snapshot pattern for financial period reporting consistency, enforcing non-negative column bounds (`>= 0.00`) in DDL while `sp_calculate_payroll` enforces `net_salary = gross_earnings - total_deductions` without drift from future edits.
4. **How does the schema prevent duplicate attendance or duplicate monthly pay runs?**  
   Composite unique keys `uq_emp_work_date (employee_id, work_date)` on `attendance` and `uq_emp_payroll_period (employee_id, period_id)` on `payrolls` enforce uniqueness in InnoDB regardless of application concurrency.

### Phase 2 — Procedural Implementation & Seed Data
5. **How is the working-day count calculated across June, July, and August 2026, and why was August corrected to 21?**  
   PayTrace follows a uniform Monday–Friday calendar implemented in `fn_count_working_days(start_date, end_date)`. In 2026, June has 22 weekdays, July has 23 weekdays, and August has 21 weekdays (August 1–2 and August 29–30 are weekends; August 31 is Monday). `generate_seed.js` previously had 22 for August and was fixed to 21 so `sp_calculate_payroll` and `attendance` align identically.
6. **What happens if a leave spans a month boundary (e.g., July 30 – August 3, 2026)?**  
   `sp_calculate_payroll` intersects every overlapping approved leave with `[v_period_start, v_period_end]` using `fn_count_working_days(GREATEST(l.start_date, v_period_start), LEAST(l.end_date, v_period_end))`. Thus July 30–31 (2 weekdays) count only in July, and August 3 (1 weekday) counts only in August.
7. **Walk through Sarah Jenkins (`EMP004`) July 2026 math.**  
   Monthly Gross = `$100,000.00` over `23` working days $\implies$ `v_daily_rate = fn_calculate_daily_rate(100000.00, 23) = ROUND(100000 / 23, 2) = $4,347.83`. She had 6 late marks; PayTrace allows 3 without penalty, leaving `3` penalty late marks $\times 0.5$ day: `ROUND((6 - 3) * 0.5 * 4347.83, 2) = ROUND(6521.745, 2) = $6,521.75`, plus PF `$7,800.00`, PT `$200.00`, and annual-projected progressive TDS `$6,250.00` = `$20,771.75` deductions $\implies$ `$79,228.25` net.
8. **How do attendance and leave triggers enforce business integrity even for direct SQL callers?**  
   - `trg_attendance_before_insert` / `update` reject `check_out_time < check_in_time`, disallow timestamps when status is `ABSENT` or `ON_LEAVE`, compute punctuality cleanly with strict `> '09:15:00'` (so `09:15:00` is NOT late), and clear stale `is_late`/`late_minutes` when status transitions away from worked states.
   - `trg_leaves_before_insert` / `update` validate `total_days = fn_count_working_days(start_date, end_date)` against client tampering, block overlapping `APPROVED` leaves (including status transitions on `UPDATE`), and block approved leaves over conflicting non-`ON_LEAVE` attendance rows.
9. **What prevents negative net salary if deductions exceed gross earnings?**  
   In `sp_calculate_payroll`, deductions are added sequentially using `v_remaining` and `LEAST(..., v_remaining)` (starting from `v_gross_earnings`) before inserting `payroll_items` and `payrolls`, guaranteeing `net_salary >= 0.00` and exact reconciliation between header and line items.

### Phase 3 — Reporting & Query Optimization
10. **Why were there two attendance/report SQL paths earlier, and how are they aligned now?**  
    Previously `database/reports.sql` and `src/routes/reportRoutes.js` diverged on `HALF_DAY` counts and inactive employee historical visibility. Now both apply identical formulas (`HALF_DAY = 0.5` present and `0.5` absent, worked attendance percentage `ROUND(((present + 0.5*half_day) / total_working_days) * 100, 1)`, and `check_in_time IS NOT NULL AND status IN ('PRESENT', 'HALF_DAY')` for late marks).
11. **What EXPLAIN improvement did Phase 3 indexing achieve?**  
    Adding `idx_attendance_late_lookup (is_late, work_date)` replaced an inefficient `type: ref` nested scan on `uq_emp_work_date` (`Using temporary; Using filesort`) with a direct `type: range` scan (`Using index condition; Using where; Using filesort`, eliminating `temporary_table`). Across 792 rows, optimizer cost dropped `93.5%` (`1.1228 -> 0.0732`); scaled to 50,000 rows, optimizer cost dropped `99.3%` (`75.355 -> 0.532`) and client median execution time improved `11.9x` (`10.38 ms -> 0.87 ms`).

### Phase 4 — Security, RBAC & Transaction Verification
12. **How are employees restricted to read-only access in PayTrace?**  
    All mutating business routes (`POST/PUT /api/employees`, `/api/salary/:id`, `POST/PUT /api/attendance`, `/api/attendance/clock-in`, `POST/PUT /api/leaves`, `/api/payroll/process`, `/api/payroll/test-rollback`) run `requireRole('HR_ADMIN')`, returning `403 Forbidden` to any `EMPLOYEE` token. `GET` endpoints use `enforceSelfOrAdmin` or route-level `req.user.role` scoping, and the frontend hides all HR navigation and write controls for employees.
13. **Why did you switch from `localStorage` tokens to cookies + CSRF?**  
    Storing JWTs in `localStorage` exposes credentials to any XSS gadget. Issuing the JWT in an `HttpOnly; SameSite=Lax` cookie prevents JavaScript exfiltration, while pairing every cookie-authenticated write with `verifyCsrf` (`X-CSRF-Token` checked via `crypto.timingSafeEqual`) mitigates CSRF.
14. **Explain how database least-privilege (`database/security.sql`) protects the database.**  
    Express runs as `paytrace_app` (via `paytrace_app_role`), which holds only DML (`SELECT`/`INSERT`/`UPDATE`) and `EXECUTE` privileges inside `paytrace_db` — no `DELETE`, `DROP`, `ALTER`, or `CREATE`. A separate `paytrace_reader` account holds read-only `SELECT` exclusively on non-sensitive `vw_employee_*` views that omit `password_hash`.
15. **How does `sp_demonstrate_transaction_rollback` prove ACID atomicity?**  
    It executes a multi-step `START TRANSACTION` inserting a synthetic department (`__ROLLBACK_PROBE_DEPT__`) and then attempting an invalid negative `payrolls` row (`gross_earnings = -50000.00`, `net_salary = 0.00`). MariaDB raises `SQLEXCEPTION` on `chk_payroll_gross`, the `DECLARE EXIT HANDLER FOR SQLEXCEPTION` invokes `ROLLBACK;`, and both steps are atomically undone — leaving zero synthetic department or payroll rows in the database.

### Phase 5 — Integration, Verification & Presentation
16. **How do you verify client-side and API behavior automatically without brittle mocks?**  
    `npm test` executes 21 live MariaDB SQL checks, middleware unit checks, and real HTTP API security/calculation tests (`tests/test_suite.js`), followed by `npm run test:e2e` launching headless Chromium over Chrome DevTools Protocol against the running Express UI to drive both HR and Employee flows (`11 / 11` passing).
17. **How is audit attribution handled inside database triggers?**  
    Because MariaDB triggers execute inside the SQL engine without Express HTTP context, API transactions execute `SET @app_actor_id = ?` on the same pooled connection (or pass `p_processed_by` into `sp_calculate_payroll`), letting triggers (`trg_salary_after_insert`, `trg_salary_after_update`, `trg_payrolls_after_insert`) capture the real initiating HR user in `audit_logs`.
18. **Why is this an academic capstone rather than production-ready payroll software?**  
    It uses a fixed Mon–Fri corporate calendar without country-specific tax filings, regional holidays, distributed queue workers for thousands of concurrent bulk payroll runs, or multi-factor login; those next steps are documented transparently in `docs/phase-5/limitations-and-future-work.md` and `real-world-use-cases.md`.

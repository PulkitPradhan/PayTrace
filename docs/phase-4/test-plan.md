# PayTrace — Comprehensive Test Plan (Phase 4 & Phase 5)

**Author:** Pulkit Pradhan  
**Roll Number:** 2501730036  

## 1. Overview & Scope

The PayTrace automated verification framework validates schema constraints, procedural calculations, triggers, report SQL optimization, least-privilege database roles, HTTP API RBAC/validation, and end-to-end Chromium browser workflows using two runnable npm suites:

1. **SQL, Unit & HTTP Integration Suite ([`tests/test_suite.js`](../../tests/test_suite.js)):** 21 automated test cases (`SQL-01`–`SQL-14`, `UNIT-01`–`UNIT-02`, `HTTP-01`–`HTTP-05`) executed via `npm test`.
2. **Real Browser End-to-End Suite ([`tests/browser_e2e.test.js`](../../tests/browser_e2e.test.js)):** 11 Chromium CDP UI tests (`E2E-01`–`E2E-11`) executed via `npm run test:e2e`.

Both suites run sequentially via `npm run test:all` and restore any synthetic test mutations cleanly afterward so the 12-employee / 3-month seeded dataset remains intact.

---

## 2. Test Execution Environment

- **Runtime:** Node.js (`v26.13.0` verified)
- **Database Engine:** MariaDB `13.0.2` (InnoDB engine, `STRICT_TRANS_TABLES,ONLY_FULL_GROUP_BY`)
- **Browser Engine (E2E):** Headless Chromium over Chrome DevTools Protocol (`/usr/bin/chromium`)
- **HTTP Target:** Live Express app instance (`src/app.js`) bound ephemerally on `127.0.0.1` backed by `paytrace_app` DB connections

---

## 3. Test Case Catalog

### 3.1 SQL, Procedural, Index & DB Role Tests (`tests/test_suite.js`)

| Test ID | Phase | Objective | Input / Scenario | Expected Outcome |
| :--- | :---: | :--- | :--- | :--- |
| **SQL-01** | 1 / 2 | Valid employee creation | Unique employee code, active department, unique email | Row inserted with auto-increment `employee_id` |
| **SQL-02** | 1 / 2 | Duplicate employee code rejection | Insert duplicate `EMP001` | Rejected with `ER_DUP_ENTRY` |
| **SQL-03** | 1 / 2 | Duplicate employee email rejection | Insert duplicate `alice.morgan@paytrace.local` | Rejected with `ER_DUP_ENTRY` |
| **SQL-04** | 1 / 2 | Invalid foreign key rejection | Insert employee with `department_id = 9999` | Rejected with `ER_NO_REFERENCED_ROW_2` |
| **SQL-05** | 1 / 2 | Negative salary rejection | Insert `salary_structures` with `basic_salary = -5000` | Rejected by `chk_salary_basic` constraint |
| **SQL-06** | 2 | Zero salary boundary payroll calculation | Process payroll for zero-salary employee | Returns code `200` and `net_salary = 0.00` |
| **SQL-07** | 2 | Valid attendance, duplicate guard & invalid time | Valid entry, duplicate `(employee_id, work_date)`, `18:00 < 09:00` | Valid succeeds; dup hits `uq_emp_work_date`; reversed time triggers `SQLSTATE 45000` |
| **SQL-08** | 2 / 3 | Exact `09:15:00` threshold & stale late-mark reset | Check-ins at `09:15:00` and `09:15:01`; update status to `ABSENT` | `09:15:00 -> is_late=0`; `09:15:01 -> is_late=1, 15m`; `ABSENT` clears late flags |
| **SQL-09** | 2 | Leave validation (range, duration, overlap INSERT & UPDATE) | `end < start`, mismatched Mon–Fri `total_days`, overlapping approved leave on insert & update | Invalid range/duration and both overlap vectors rejected |
| **SQL-10** | 2 | Cross-month leave, half-day, effective salary, dup `409` & deduction cap | Cross-month leave `2026-07-30..2026-08-04`, `HALF_DAY`, historical `$50k` salary lookup, rerun, excessive deductions | Correct August 2-day proration, `$50k` historical selection, `409` duplicate block, capped net `>= 0` |
| **SQL-11** | 2 | Baseline salary calculations & progressive TDS slabs | Sarah Jenkins (`EMP004`) July 2026, Aisha Khan (`EMP011`) June 2026, TDS slabs at `$300k`/`$600k`/`$1.2M` | Exact net (`$79,228.25`, `$48,850.00`) & TDS (`$0.00`, `$1,250.00`, `$6,250.00`) |
| **SQL-12** | 4 | Transaction `COMMIT` & Multi-Step `ROLLBACK` | Valid batch commit check + `CALL sp_demonstrate_transaction_rollback()` | Valid commit persists; multi-step probe (`__ROLLBACK_PROBE_DEPT__` + negative payroll) leaves zero residual rows |
| **SQL-13** | 3 | Phase 3 indexes installed & `database/reports.sql` execution | Verify all 4 composite indexes in `INFORMATION_SCHEMA` + execute all 4 report queries | Indexes active; 12 July summary rows, 19 late marks, 7 slip items |
| **SQL-14** | 4 | Least-privilege DB accounts (`paytrace_app` & `paytrace_reader`) | Attempt `DELETE` as `paytrace_app`; attempt raw `SELECT` on `employees` vs `vw_employee_self_profile` as `paytrace_reader` | Both prohibited operations denied with `ERROR 1142`; view readable |

### 3.2 Middleware Unit Tests (`tests/test_suite.js`)

| Test ID | Phase | Objective | Input / Scenario | Expected Outcome |
| :--- | :---: | :--- | :--- | :--- |
| **UNIT-01** | 4 | `enforceSelfOrAdmin` authorization | `params.employeeId` matched to self, peer ID, and `HR_ADMIN` | Self calls `next()`; peer returns `403`; `HR_ADMIN` calls `next()` |
| **UNIT-02** | 4 | `requireRole` & fail-closed `validateJwtSecret` | `EMPLOYEE` hitting `HR_ADMIN` guard; empty, short, and blacklisted secrets | `requireRole` returns `403`; weak secrets always throw Error |

### 3.3 HTTP Integration & Security Tests (`tests/test_suite.js`)

| Test ID | Phase | Objective | Input / Scenario | Expected Outcome |
| :--- | :---: | :--- | :--- | :--- |
| **HTTP-01** | 4 / 5 | Auth flows (`login`, bad creds, missing/forged/expired JWT, inactive user) | Valid HR/EMP logins + negative auth vectors against Express HTTP server | `200` on valid cookies; `401` on invalid/missing JWT; `403` on `INACTIVE` account |
| **HTTP-02** | 4 | Employee business-write denial, admin route denial & CSRF guard | 10 `EMPLOYEE` write/admin route calls + valid `HR_ADMIN` `POST` missing `X-CSRF-Token` | All 11 calls return `403 Forbidden` |
| **HTTP-03** | 4 | Cross-employee denial (`403`) & authorized self-access (`200`) | `EMP003` requesting `EMP004` profile/attendance/leaves/payrolls/slip/salary vs own endpoints | 6 peer reads return `403`; self profile, attendance, leaves, payrolls, slip, salary return `200` |
| **HTTP-04** | 4 | Invalid params, leave tampering & negative salary rollback via HTTP | Malformed IDs, nonexistent IDs, tampered `total_days`, negative `basic_salary` | Returns exact `400`/`404`/`400` status codes with zero `500`s and zero residual salary rows |
| **HTTP-05** | 5 | HR create/update, single & bulk payroll, 3 reports & rollback | Create/update `EMP_HTTP`, run payroll + duplicate conflict, fetch 3 Phase 3 reports + rollback test | All workflows return `201`/`200`/`409` with exact Period 2 counts |

### 3.4 Headless Chromium Browser E2E Tests (`tests/browser_e2e.test.js`)

| Test ID | Objective | Expected Outcome |
| :--- | :--- | :--- |
| **E2E-01** | HR login, dynamic KPIs, and accurate calendar dates | Logs in via UI button, displays dynamic DB KPIs & accurate `2026-06`/`07`/`08` dates |
| **E2E-02** | HR employee create & edit workflow | Creates and edits test employee via UI modals and refreshes roster |
| **E2E-03** | HR salary revision & history modal | Revises employee salary and inspects effective-dated history modal |
| **E2E-04** | HR attendance management workflow | Records attendance through UI modal and verifies rendered row |
| **E2E-05** | HR leave workflow & safe XSS text rendering | Submits leave with `<img src=x onerror="window.__e2eXss=true">LeaveNote` payload and verifies DOM text escaping without execution |
| **E2E-06** | HR single-employee payroll processing via UI | Opens Run Payroll modal, selects period/employee, computes payroll cleanly |
| **E2E-07** | HR mandatory reports & exact July 2026 dates | Switches across Report 1, 2/departmental, and 3 and verifies July 2026 row totals |
| **E2E-08** | Employee read-only dashboard & hidden admin controls | Logs in as `EMP003`; admin nav groups, write buttons, and KPIs remain hidden |
| **E2E-09** | Employee views own slip & receives `403` on `EMP004` slip | Opens own slip (`200`) and confirms peer slip ID returns HTTP `403` |
| **E2E-10** | Logout clears session & returns to login screen | Clicking logout calls `/api/auth/logout` and clears UI state |
| **E2E-11** | Zero uncaught browser page/console errors | `pageErrors.length === 0 && consoleErrors.length === 0` |

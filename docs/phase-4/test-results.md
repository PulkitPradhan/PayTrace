# PayTrace — Test Results & Verification Evidence (Phase 4 & Phase 5)

**Author:** Pulkit Pradhan  
**Roll Number:** 2501730036  

## 1. Executive Summary

- **SQL / Unit / HTTP Suite (`npm test`):** **21 / 21 PASSED** (`100%`)
- **Browser End-to-End Suite (`npm run test:e2e`):** **11 / 11 PASSED** (`100%`)
- **Combined Run (`npm run test:all`):** **32 / 32 PASSED** (`0` failures, `0` uncaught browser/console errors)
- **Verification Timestamp:** `2026-11-25T04:36:21Z`
- **Database Engine:** MariaDB `13.0.2` (InnoDB, `paytrace_db`)
- **Browser Engine:** Chromium Headless via Chrome DevTools Protocol (`/usr/bin/chromium`)

---

## 2. Detailed Test Execution Matrix

### 2.1 SQL, Unit & HTTP Test Suite (`tests/test_suite.js` — 21 / 21 Passed)

| Test ID | Layer | Objective | Tested Scenario / Assertion | Result | Verifiable Evidence |
| :--- | :---: | :--- | :--- | :---: | :--- |
| **SQL-01** | SQL | Valid employee creation | Insert unique code/email into Dept 1 | **PASS** | Auto-increment `employee_id` returned |
| **SQL-02** | SQL | Duplicate employee code rejection | Re-insert `EMP001` | **PASS** | `ER_DUP_ENTRY` on `uq_employee_code` |
| **SQL-03** | SQL | Duplicate employee email rejection | Re-insert `alice.morgan@paytrace.local` | **PASS** | `ER_DUP_ENTRY` on `uq_employee_email` |
| **SQL-04** | SQL | Invalid foreign key rejection | Insert employee with `department_id = 9999` | **PASS** | `ER_NO_REFERENCED_ROW_2` |
| **SQL-05** | SQL | Negative salary rejection | Insert `basic_salary = -5000` | **PASS** | `chk_salary_basic` CHECK violation |
| **SQL-06** | SQL | Zero salary boundary payroll calculation | Call `sp_calculate_payroll` with `$0` salary | **PASS** | Returned `code = 200`, `net = 0.00` |
| **SQL-07** | SQL | Valid attendance, dup guard & invalid time | Valid insert, duplicate `(emp, date)`, `18:00 < 09:00` | **PASS** | Duplicate rejected; `trg_attendance_before_insert` raised `45000` |
| **SQL-08** | SQL | Exact `09:15:00` threshold & stale late reset | Check-in `09:15:00` vs `09:15:01`; update to `ABSENT` | **PASS** | `09:15:00->is_late=0`, `09:15:01->is_late=1 (15m)`, `ABSENT->is_late=0` |
| **SQL-09** | SQL | Leave range, duration, overlap INSERT & UPDATE | 5 leave constraint & trigger test vectors | **PASS** | All invalid/overlapping INSERT & UPDATE attempts aborted |
| **SQL-10** | SQL | Cross-month leave, half-day, effective salary, dup `409` & cap | Reg 10 + deduction cap scenario | **PASS** | Prorated 2d in Aug, historical `$50k`, dup `409`, capped net `>= 0` |
| **SQL-11** | SQL | Baseline salary calculations & TDS slabs | `EMP004` Jul (`$79,228.25`), `EMP011` Jun (`$48,850.00`), TDS | **PASS** | `$300k` -> `$0.00`; `$600k` -> `$1,250.00`; `$1.2M` -> `$6,250.00` monthly TDS |
| **SQL-12** | SQL | Transaction `COMMIT` & Multi-Step `ROLLBACK` | Valid batch commit + `sp_demonstrate_transaction_rollback` | **PASS** | `ROLLBACK_VERIFIED`; zero `__ROLLBACK_PROBE_DEPT__` or negative payroll persisted |
| **SQL-13** | SQL | Phase 3 indexes & `reports.sql` execution | Verify 4 Phase 3 indexes & execute all 4 report queries | **PASS** | 12 July summary rows, 19 late marks, 7 slip line items |
| **SQL-14** | SQL | Least-privilege DB accounts | `paytrace_app` `DELETE` & `paytrace_reader` raw `employees` | **PASS** | Both denied (`ERROR 1142`); `vw_employee_self_profile` readable (`12` rows) |
| **UNIT-01** | UNIT | `enforceSelfOrAdmin` guard | Self, cross-employee, and `HR_ADMIN` middleware calls | **PASS** | Self=`next()`, Cross=`403`, Admin=`next()` |
| **UNIT-02** | UNIT | `requireRole` & `validateJwtSecret` | `EMPLOYEE` role rejection + empty/short/blacklisted secret | **PASS** | `403` returned; all weak JWT secrets threw startup errors |
| **HTTP-01** | HTTP | Auth flows (`login`, bad creds, JWT checks, inactive user) | Live `/api/auth/*` and protected route checks | **PASS** | Exact `200`/`401`/`403` status progression |
| **HTTP-02** | HTTP | Employee business-write denial, admin routes & CSRF guard | 10 employee write/admin requests + missing `X-CSRF-Token` | **PASS** | All 11 requests blocked with `403 Forbidden` |
| **HTTP-03** | HTTP | Horizontal isolation (`403`) & self-access (`200`) | `EMP003` -> `EMP004` (6 endpoints) vs `EMP003` self (5 endpoints) | **PASS** | All 6 peer requests `403`; all 5 self reads `200` |
| **HTTP-04** | HTTP | Input validation, leave tampering & negative salary rollback | 8 malformed/tampered/negative HTTP requests | **PASS** | All returned `400`/`404` cleanly; zero residual DB rows |
| **HTTP-05** | HTTP | HR create/update, single/bulk payroll, 3 reports & rollback | End-to-end HR API lifecycle & report verification | **PASS** | Exact `201`/`200`/`409` responses & accurate Period 2 aggregates |

### 2.2 Browser E2E Test Suite (`tests/browser_e2e.test.js` — 11 / 11 Passed)

| Test ID | Browser Scenario | Verified DOM & API Behavior | Status |
| :--- | :--- | :--- | :---: |
| **E2E-01** | HR login, dynamic KPIs & accurate calendar dates | Login sets session cookies; KPIs load from DB; `2026-06`/`07`/`08` dates exact | **PASS** |
| **E2E-02** | HR employee create & edit workflow | Modal create + edit updates roster cleanly | **PASS** |
| **E2E-03** | HR salary revision & history modal | Salary revision updates history table inside modal | **PASS** |
| **E2E-04** | HR attendance management workflow | Attendance record modal creates row and updates log table | **PASS** |
| **E2E-05** | HR leave workflow & safe XSS text rendering | `<img src=x onerror=...>` payload escaped safely in DOM without execution | **PASS** |
| **E2E-06** | HR single-employee payroll processing via UI | Run Payroll modal processes period cleanly via live API | **PASS** |
| **E2E-07** | HR mandatory reports & exact July 2026 dates | Attendance summary, departmental breakdown & late-marks report verified | **PASS** |
| **E2E-08** | Employee read-only dashboard & hidden admin controls | Employee nav hides HR modules & write buttons completely | **PASS** |
| **E2E-09** | Employee views own slip & gets `403` on `EMP004` slip | Own slip `200 OK`; cross-employee `/api/payroll/slip/16` returns `403` | **PASS** |
| **E2E-10** | Logout clears session & returns to login screen | `/api/auth/logout` clears cookies and resets UI tables | **PASS** |
| **E2E-11** | Zero uncaught browser page/console errors | `pageErrors: []`, `consoleErrors: []` across full session | **PASS** |

---

## 3. Observed Execution Transcript (`DB_PORT=3307 npm run test:all`)

```text
> paytrace@1.0.0 test:all
> npm test && npm run test:e2e

===============================================================
PAYTRACE: Executing SQL, Unit & HTTP Integration Test Suite
Database: paytrace_db @ 127.0.0.1:3307
Timestamp: 2026-11-25T04:36:21.481Z
===============================================================

[PASS] SQL-01 (SQL | Phase 1/2): Valid employee creation
[PASS] SQL-02 (SQL | Phase 1/2): Duplicate employee code rejection
[PASS] SQL-03 (SQL | Phase 1/2): Duplicate employee email rejection
[PASS] SQL-04 (SQL | Phase 1/2): Invalid foreign key rejection
[PASS] SQL-05 (SQL | Phase 1/2): Negative salary rejection
[PASS] SQL-06 (SQL | Phase 2): Zero salary boundary payroll calculation
[PASS] SQL-07 (SQL | Phase 2): Valid attendance, duplicate guard & invalid time rejection
[PASS] SQL-08 (SQL | Phase 2/3): Exact 09:15:00 threshold & stale late-mark reset
[PASS] SQL-09 (SQL | Phase 2): Leave validation: valid, bad range, bad duration, overlap INSERT & UPDATE
[PASS] SQL-10 (SQL | Phase 2): Cross-month leave, half-day, effective salary, duplicate 409 & deduction cap
[PASS] SQL-11 (SQL | Phase 2): Baseline salary calculations & progressive TDS slabs
[PASS] SQL-12 (SQL | Phase 4): Transaction COMMIT & Multi-Step ROLLBACK
[PASS] SQL-13 (SQL | Phase 3): Phase 3 indexes installed & database/reports.sql executes cleanly
[PASS] SQL-14 (SQL | Phase 4): Least-privilege DB accounts (paytrace_app & paytrace_reader)
[PASS] UNIT-01 (UNIT | Phase 4): enforceSelfOrAdmin self, cross-employee & admin
[PASS] UNIT-02 (UNIT | Phase 4): requireRole & fail-closed validateJwtSecret
[PASS] HTTP-01 (HTTP | Phase 4/5): Auth flows: login, bad creds, missing/forged/expired JWT & inactive user
[PASS] HTTP-02 (HTTP | Phase 4): Employee business-write denial, admin route denial & CSRF guard
[PASS] HTTP-03 (HTTP | Phase 4): Cross-employee denial (403) & authorized self-access (200)
[PASS] HTTP-04 (HTTP | Phase 4): Invalid params, leave tampering & negative salary rollback
[PASS] HTTP-05 (HTTP | Phase 5): HR create/update, single & bulk payroll, 3 reports & rollback

===============================================================
TEST EXECUTION SUMMARY: 21 / 21 PASSED
===============================================================

[PASS] E2E-01: HR login, dynamic KPIs, and accurate calendar dates
[PASS] E2E-02: HR employee create & edit workflow
[PASS] E2E-03: HR salary revision & history modal
[PASS] E2E-04: HR attendance management workflow
[PASS] E2E-05: HR leave workflow & safe XSS text rendering
[PASS] E2E-06: HR single-employee payroll processing via UI
[PASS] E2E-07: HR mandatory reports & exact July 2026 dates
[PASS] E2E-08: Employee read-only dashboard & hidden admin controls
[PASS] E2E-09: Employee views own slip & receives 403 on EMP004 slip -> {"forbiddenResp":403}
[PASS] E2E-10: Logout clears session & returns to login screen
[PASS] E2E-11: Zero uncaught browser page/console errors -> {"pageErrors":[],"consoleErrors":[]}

BROWSER E2E SUMMARY: 11 / 11 PASSED
```

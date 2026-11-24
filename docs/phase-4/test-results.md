# PayTrace — Test Results & Verification Evidence (Phase 4)

**Author:** Pulkit Pradhan  
**Roll Number:** 2501730036  

## 1. Executive Summary

- **Total Test Cases:** 20
- **Passed:** 20 (100%)
- **Failed:** 0 (0%)
- **Test Engine:** Automated Jest-style Node.js verification script (`tests/test_suite.js`)
- **Execution Date:** 2026-11-18
- **Tester / Candidate:** Pulkit Pradhan (Roll No: 2501730036)
- **Database:** MariaDB 13.0.2 / InnoDB

---

## 2. Test Execution Matrix

| Test ID | Test Objective | Tested Scenario / Input | Expected Result | Actual Result | Status | Verifiable Evidence |
| :---: | :--- | :--- | :--- | :--- | :---: | :--- |
| **TC-01** | Valid employee creation | Code: `EMP_T...`, Department: 1 | Generated auto-increment ID | Created new employee row | **PASS** | Auto-increment PK verified |
| **TC-02** | Duplicate employee code | Existing code: `EMP001` | Rejection with `ER_DUP_ENTRY` | `ERROR 1062 (23000): Duplicate entry` | **PASS** | Unique key `uq_employee_code` enforced |
| **TC-03** | Negative salary rejection | `basic_salary = -5000.00` | Rejection with CHECK violation | `ERROR 4025 (23000): CONSTRAINT chk_salary_basic failed` | **PASS** | CHECK constraint active |
| **TC-04** | Duplicate attendance rejection | `(1, '2026-06-01')` | Rejection with `ER_DUP_ENTRY` | `ERROR 1062 (23000): Duplicate entry '1-2026-06-01'` | **PASS** | Unique key `uq_emp_work_date` enforced |
| **TC-05** | Invalid attendance time order | In: `18:00`, Out: `09:00` | Trigger aborts with 45000 | `ERROR 1644 (45000): check-out time cannot be earlier` | **PASS** | `trg_attendance_before_insert` triggered |
| **TC-06** | Overlapping approved leave | Intersecting dates for EMP 3 | Trigger aborts with 45000 | `ERROR 1644 (45000): Conflicting leave: overlapping...` | **PASS** | `trg_leaves_before_insert` triggered |
| **TC-07** | Leave application & approval | Submit leave -> Admin approve | Status `APPROVED`, actioned by 1 | Status transitioned; `actioned_by = 1` | **PASS** | Relational state transition verified |
| **TC-08** | Exact salary calculation | EMP004 July 2026 | Gross: $100k, Net: $79,228.25 | Gross: 100000.00, Net: 79228.25 | **PASS** | Net = Gross - Deductions verified |
| **TC-09** | Progressive TDS tax formula | Annual taxable: $1,200,000 | Monthly TDS: $6,250.00 | Computed: `6250.00` | **PASS** | `fn_calculate_monthly_tds` verified |
| **TC-10** | Successful payroll transaction | Valid transaction batch | Transaction COMMITTED | Transaction committed cleanly | **PASS** | Database consistency preserved |
| **TC-11** | Failed transaction ROLLBACK | Negative gross violation | Handled with ROLLBACK | Output: `status = ROLLBACK_VERIFIED` | **PASS** | Zero residual rows persisted |
| **TC-12** | Attendance summary report | Period: July 2026 (Period 2) | Clean employee aggregates | 12 active employees; 19 late marks | **PASS** | No Cartesian row duplication |
| **TC-13** | Itemized salary slip report | EMP004 in July 2026 | 7 itemized lines ($100k total) | 7 line-items retrieved from `payroll_items` | **PASS** | Historical snapshot verified |
| **TC-14** | Late-marks report accuracy | Period: July 2026 | Exact count of late marks | Exactly 19 tardy records identified | **PASS** | Query matches physical attendance data |
| **TC-15** | Employee self-service access | EMP003 requests EMP003 data | Access granted (isAllowed = true) | Granted (200 OK) | **PASS** | Self-access authorized |
| **TC-16** | Cross-employee access denial | EMP003 requests EMP004 data | Access denied (403 Forbidden) | Denied (403 Forbidden) | **PASS** | `enforceSelfOrAdmin` blocked request |
| **TC-17** | Employee HR action denial | EMP003 requests HR endpoint | Access denied (403 Forbidden) | Denied (403 Forbidden) | **PASS** | `requireRole('HR_ADMIN')` blocked request |
| **TC-18** | Unauthenticated request denial | Request without JWT token | Access denied (401 Unauthorized)| Denied (401 Unauthorized) | **PASS** | `authenticateToken` blocked request |
| **TC-19** | Impossible date boundary | `start_date > end_date` | Rejection by CHECK constraint | Rejected with `chk_leave_dates failed` | **PASS** | Boundary condition enforced |
| **TC-20** | Duplicate payroll cycle prevention| Re-run period 1 for EMP001 | 409 Conflict error from SP | Output: `code: 409, Duplicate prevented` | **PASS** | Idempotency verified |

---

## 3. Verifiable Terminal Log Output

```text
===============================================================
PAYTRACE: Executing 20 Mandatory Rubric Test Cases
Database: paytrace_db
Timestamp: 2026-11-18
===============================================================

[✅ PASS] Test 1: Valid employee creation
[✅ PASS] Test 2: Duplicate employee identifier rejection
[✅ PASS] Test 3: Negative salary rejection
[✅ PASS] Test 4: Duplicate attendance entry rejection
[✅ PASS] Test 5: Invalid attendance state rejection
[✅ PASS] Test 6: Overlapping approved leave rejection
[✅ PASS] Test 7: Valid leave application and approval
[✅ PASS] Test 8: Correct salary calculation formula
[✅ PASS] Test 9: Correct progressive tax deduction
[✅ PASS] Test 10: Successful payroll transaction and COMMIT
[✅ PASS] Test 11: Failed payroll transaction and verified ROLLBACK
[✅ PASS] Test 12: Correct monthly attendance summary report
[✅ PASS] Test 13: Correct salary slip itemization report
[✅ PASS] Test 14: Correct late-marks report
[✅ PASS] Test 15: Employee access to own records (RBAC)
[✅ PASS] Test 16: Employee attempt to access other records (Blocked)
[✅ PASS] Test 17: Employee attempt to perform HR action (Blocked)
[✅ PASS] Test 18: Unauthorized / Unauthenticated request rejection
[✅ PASS] Test 19: Boundary conditions for dates and parameters
[✅ PASS] Test 20: Repeated payroll processing prevention

===============================================================
TEST EXECUTION SUMMARY: 20 / 20 PASSED
===============================================================
```

# PayTrace — Comprehensive Test Plan (Phase 4)

**Author:** Pulkit Pradhan  
**Roll Number:** 2501730036  

## 1. Overview & Scope

The PayTrace Test Plan verifies system functionality, security isolation, constraint enforcement, calculation precision, and transaction boundaries across 20 mandatory test cases defined by the academic rubric.

---

## 2. Test Execution Environment

- **Runtime:** Node.js v26.13.0
- **Database Engine:** MariaDB 13.0.2 (InnoDB Engine)
- **Test Automation Script:** `tests/test_suite.js`
- **Isolation:** Tests execute directly against the live database connection pool using real SQL transactions and assertions.

---

## 3. Test Case Catalog

| Test ID | Category | Objective | Input / Scenario | Expected Outcome |
| :---: | :--- | :--- | :--- | :--- |
| **TC-01** | Data Integrity | Verify valid employee creation | Unique employee code, email, active department | Successfully inserted with auto-increment ID |
| **TC-02** | Constraints | Reject duplicate employee code | Re-insert existing code `EMP001` | Immediate rejection with `ER_DUP_ENTRY` |
| **TC-03** | Constraints | Reject negative basic salary | `basic_salary = -5000.00` | Rejection by CHECK constraint `chk_salary_basic` |
| **TC-04** | Constraints | Prevent duplicate daily attendance | Insert existing `(employee_id, work_date)` | Rejection by unique key `uq_emp_work_date` |
| **TC-05** | Trigger Logic | Reject impossible attendance time | `check_in = 18:00, check_out = 09:00` | Trigger aborts with SQLSTATE 45000 |
| **TC-06** | Trigger Logic | Prevent overlapping approved leave | Intersecting dates for same employee | Trigger aborts with SQLSTATE 45000 |
| **TC-07** | Workflow | Process leave application and approval | Apply for leave, HR Admin approves | Status transitions from PENDING to APPROVED |
| **TC-08** | Business Logic | Verify exact salary calculation formula | Net = Gross - Total Deductions | Exact decimal match on gross and net |
| **TC-09** | Procedure | Verify progressive income tax (TDS) | Annual gross of $1,200,000 | Monthly TDS computed as exactly $6,250.00 |
| **TC-10** | Transactions | Demonstrate successful payroll COMMIT | Valid payroll transaction | Transaction commits without data corruption |
| **TC-11** | Transactions | Demonstrate failed transaction ROLLBACK | Negative gross earnings violation | Transaction safely rolled back; zero rows inserted |
| **TC-12** | Reporting | Verify monthly attendance summary | Query period with multiple records | Accurate aggregates without Cartesian duplicates |
| **TC-13** | Reporting | Verify itemized salary slip generation | Retrieve slip for processed employee | Itemized line-items match master snapshot |
| **TC-14** | Reporting | Verify late-marks reporting accuracy | Filter by `is_late = TRUE` in period | Identifies all tardy records with late minutes |
| **TC-15** | Security/RBAC | Allow employee access to own records | Authenticated user matches target ID | Access granted (200 OK) |
| **TC-16** | Security/RBAC | Block employee access to other records | Authenticated user targets different ID | Request terminated with 403 Forbidden |
| **TC-17** | Security/RBAC | Block employee from HR/Admin action | Employee role requests HR endpoint | Request terminated with 403 Forbidden |
| **TC-18** | Security/RBAC | Reject unauthenticated requests | Request without Bearer token | Request terminated with 401 Unauthorized |
| **TC-19** | Boundaries | Validate impossible date boundaries | Leave `start_date > end_date` | Constraint violation `chk_leave_dates` |
| **TC-20** | Procedural | Prevent duplicate payroll cycle runs | Recalculate already finalized period | Stored procedure returns 409 Conflict error |

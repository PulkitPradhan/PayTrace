# PayTrace — Procedural Implementation Specification (Phase 2)

## 1. Overview

Phase 2 implements the approved Phase 1 relational schema through procedural database programming. All business rules—salary computation, statutory deductions, progressive TDS, leave conflict detection, attendance validation, transaction boundaries, and audit logging—are enforced inside the database engine.

---

## 2. Stored Functions

### 2.1 `fn_calculate_daily_rate`
- **File:** `database/functions.sql`
- **Signature:** `(p_monthly_gross DECIMAL(10,2), p_working_days INT) RETURNS DECIMAL(10,2)`
- **Behavior:** Computes pro-rata daily salary rate ($Gross / Days$) rounded to 2 decimal places. Returns `0.00` if working days is zero or negative.

### 2.2 `fn_calculate_monthly_tds`
- **File:** `database/functions.sql`
- **Signature:** `(p_annual_gross DECIMAL(10,2)) RETURNS DECIMAL(10,2)`
- **Behavior:** Implements the progressive academic tax bracket formula:
  - $\le \$300,000 \implies \$0$
  - $\$300,001 \text{ to } \$600,000 \implies 5\% \times (AG - 300,000)$
  - $\$600,001 \text{ to } \$1,200,000 \implies \$15,000 + 10\% \times (AG - 600,000)$
  - $> \$1,200,000 \implies \$75,000 + 20\% \times (AG - 1,200,000)$
  - Monthly TDS $= \text{ROUND}(\text{Annual Tax} / 12, 2)$.

---

## 3. Database Triggers & Integrity Enforcers

| Trigger Name | Event & Table | Business Rule & Validation Logic |
| :--- | :--- | :--- |
| `trg_attendance_before_insert` | `BEFORE INSERT ON attendance` | 1. Rejects record if check-out is earlier than check-in.<br>2. Verifies employee is not on approved leave on that date.<br>3. Calculates `is_late = TRUE` and `late_minutes` via `TIMEDIFF` if check-in > 09:15:00. |
| `trg_attendance_before_update` | `BEFORE UPDATE ON attendance` | Maintains the same validation rules for updates. |
| `trg_leaves_before_insert` | `BEFORE INSERT ON leaves` | 1. Enforces `start_date <= end_date` and `total_days > 0`.<br>2. When status is `APPROVED`, executes temporal intersection query to prevent overlapping approved leaves for the same employee. |
| `trg_leaves_before_update` | `BEFORE UPDATE ON leaves` | Enforces overlap prevention when a leave request is updated to `APPROVED`. |
| `trg_salary_after_update` | `AFTER UPDATE ON salary_structures` | Automatically captures old vs new compensation packages and appends a JSON entry to `audit_logs`. |
| `trg_payrolls_after_insert` | `AFTER INSERT ON payrolls` | Records finalized transaction state and processing actor into `audit_logs`. |

---

## 4. Stored Procedures & Transaction Management

### Procedural Lifecycle Diagram

![Payroll Calculation & Transaction Lifecycle](../assets/diagrams/payroll-transaction-workflow.svg)

*High-resolution downloads:* [[Vector SVG Format]](../assets/diagrams/payroll-transaction-workflow.svg) • [[High-DPI PNG Format (3397 × 6372 px)]](../assets/diagrams/payroll-transaction-workflow.png) • [[Graphviz DOT Source]](../assets/diagrams/payroll-transaction-workflow.dot) • [[Mermaid Source]](../assets/diagrams/payroll-transaction-workflow.mermaid)

---

### 4.1 `sp_calculate_payroll`
- **Signature:** `(IN p_employee_id, IN p_period_id, IN p_processed_by, OUT p_payroll_id, OUT p_net_salary, OUT p_status_code, OUT p_status_message)`
- **Execution Flow:**
  1. Validates employee active status and period validity.
  2. Enforces non-duplication check: rejects attempt if payroll already exists for `(employee_id, period_id)`.
  3. Retrieves active `salary_structures` configuration.
  4. Aggregates monthly attendance: days present, late arrivals, unpaid leave days, unexcused absences.
  5. Computes gross earnings, daily rate, unpaid leave deduction, late arrival penalty (>3 late marks), and monthly TDS.
  6. Opens transaction (`START TRANSACTION`), inserts parent snapshot into `payrolls`, inserts itemized earnings and deductions into `payroll_items`, and commits (`COMMIT`).
  7. On error, `DECLARE EXIT HANDLER FOR SQLEXCEPTION` triggers `ROLLBACK`.

### 4.2 `sp_process_bulk_payroll`
- **Signature:** `(IN p_period_id, IN p_processed_by, OUT p_processed_count, OUT p_error_count)`
- **Execution Flow:** Uses an explicit database cursor over all active employees, calling `sp_calculate_payroll` per employee in dependency-safe order.

### 4.3 `sp_demonstrate_transaction_rollback`
- **Signature:** `(IN p_employee_id, IN p_period_id, IN p_processed_by, OUT p_result_status, OUT p_message)`
- **Execution Flow:** Demonstrates transaction safety. Inserts an invalid record violating `chk_payroll_gross`, catches the exception via `SQLEXCEPTION` handler, executes `ROLLBACK`, and outputs `status = 'ROLLBACK_VERIFIED'`.

---

## 5. Verifiable Execution Evidence

- **Syntax & Compilation:** Executed against MariaDB 13.0.2 with zero errors.
- **Trigger Overlap Prevention:**
  ```text
  ERROR 1644 (45000): Conflicting leave: overlapping approved leave already exists for this employee
  ```
- **Duplicate Attendance Prevention:**
  ```text
  ERROR 1062 (23000): Duplicate entry '1-2026-06-01' for key 'uq_emp_work_date'
  ```
- **Negative Salary Rejection:**
  ```text
  ERROR 4025 (23000): CONSTRAINT `chk_salary_basic` failed for `paytrace_db`.`salary_structures`
  ```
- **Transaction Rollback:**
  ```text
  +-------------------+-----------------------------------------------------------+
  | status            | message                                                   |
  +-------------------+-----------------------------------------------------------+
  | ROLLBACK_VERIFIED | Transaction safely rolled back after constraint violation |
  +-------------------+-----------------------------------------------------------+
  ```

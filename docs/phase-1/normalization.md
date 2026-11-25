# PayTrace — Normalization Analysis (Phase 1)

**Author:** Pulkit Pradhan  
**Roll Number:** 2501730036  

## 1. Introduction

Normalization systematically eliminates data redundancy and insertion, update, and deletion anomalies through functional dependency (FD) analysis.

The PayTrace relational schema satisfies **Third Normal Form (3NF)** across its core entity model while explicitly documenting intentional derived-data and historical snapshot storage in `attendance` and `payrolls` for query performance and immutable financial auditing.

---

## 2. Functional Dependencies (FDs) Analysis

Let $X \rightarrow Y$ denote that attribute set $X$ uniquely determines attribute set $Y$.

### 2.1 Entity: `departments`
- **Primary Key:** `{department_id}`
- **Candidate Key:** `{department_name}` (`UNIQUE`)
- **Functional Dependencies:**
  - $FD_1: \{\text{department\_id}\} \rightarrow \{\text{department\_name}, \text{description}, \text{created\_at}\}$
  - $FD_2: \{\text{department\_name}\} \rightarrow \{\text{department\_id}, \text{description}, \text{created\_at}\}$
- **Normal Form:** 3NF / BCNF (all determinants are superkeys).

### 2.2 Entity: `employees`
- **Primary Key:** `{employee_id}`
- **Candidate Keys:** `{employee_code}` (`UNIQUE`), `{email}` (`UNIQUE`)
- **Functional Dependencies:**
  - $FD_1: \{\text{employee\_id}\} \rightarrow \{\text{employee\_code}, \text{first\_name}, \text{last\_name}, \text{email}, \text{phone}, \text{department\_id}, \text{designation}, \text{role}, \text{password\_hash}, \text{hire\_date}, \text{status}, \text{created\_at}, \text{updated\_at}\}$
  - $FD_2: \{\text{employee\_code}\} \rightarrow \{\text{all attributes}\}$
  - $FD_3: \{\text{email}\} \rightarrow \{\text{all attributes}\}$
- **Normal Form:** 3NF / BCNF (`department_name` is separated into `departments`, eliminating `employee_id -> department_id -> department_name`).

### 2.3 Entity: `salary_structures`
- **Primary Key:** `{salary_id}`
- **Logical Business Key:** `{employee_id, effective_date}` *(Note: `schema.sql` uses surrogate PK `salary_id` without a `UNIQUE (employee_id, effective_date)` constraint so multiple revisions on the same date remain representable; `sp_calculate_payroll` breaks ties deterministically via `ORDER BY effective_date DESC, salary_id DESC LIMIT 1`.)*
- **Functional Dependencies:**
  - $FD_1: \{\text{salary\_id}\} \rightarrow \{\text{employee\_id}, \text{basic\_salary}, \text{hra}, \text{special\_allowance}, \text{provident\_fund}, \text{professional\_tax}, \text{effective\_date}, \text{is\_active}, \text{created\_at}, \text{updated\_at}\}$
- **Normal Form:** 3NF / BCNF.

### 2.4 Entity: `attendance`
- **Primary Key:** `{attendance_id}`
- **Candidate Key:** `{employee_id, work_date}` (`UNIQUE`)
- **Functional Dependencies:**
  - $FD_1: \{\text{attendance\_id}\} \rightarrow \{\text{employee\_id}, \text{work\_date}, \text{status}, \text{check\_in\_time}, \text{check\_out\_time}, \text{is\_late}, \text{late\_minutes}, \text{remarks}, \text{created\_at}, \text{updated\_at}\}$
  - $FD_2: \{\text{employee\_id}, \text{work\_date}\} \rightarrow \{\text{all attributes}\}$
  - *Derived Dependency (Intentional Materialization):* Under the organization's shift rule (`09:00:00` start, `09:15:00` grace), `{status, check_in_time}` determines `{is_late, late_minutes}`. These two derived columns are intentionally materialized and trigger-maintained (`trg_attendance_before_insert/update`) so composite index `idx_attendance_late_lookup(is_late, work_date)` can execute range scans without runtime `TIMEDIFF` expressions.
- **Normal Form:** 3NF for operational key attributes, with explicitly justified derived columns `{is_late, late_minutes}`.

### 2.5 Entity: `leaves`
- **Primary Key:** `{leave_id}`
- **Functional Dependencies:**
  - $FD_1: \{\text{leave\_id}\} \rightarrow \{\text{employee\_id}, \text{leave\_type}, \text{start\_date}, \text{end\_date}, \text{total\_days}, \text{reason}, \text{status}, \text{applied\_on}, \text{actioned\_by}, \text{actioned\_on}, \text{admin\_remarks}\}$
- **Normal Form:** 3NF / BCNF (`total_days` equals Mon–Fri working days in `[start_date, end_date]`, explicitly validated by `trg_leaves_before_insert/update`).

### 2.6 Entity: `payroll_periods`
- **Primary Key:** `{period_id}`
- **Candidate Key:** `{period_name}` (`UNIQUE`)
- **Functional Dependencies:**
  - $FD_1: \{\text{period\_id}\} \rightarrow \{\text{period\_name}, \text{start\_date}, \text{end\_date}, \text{total\_working\_days}, \text{status}, \text{created\_at}\}$
  - $FD_2: \{\text{period\_name}\} \rightarrow \{\text{all attributes}\}$
- **Normal Form:** 3NF / BCNF.

### 2.7 Entity: `payrolls`
- **Primary Key:** `{payroll_id}`
- **Candidate Key:** `{employee_id, period_id}` (`UNIQUE`)
- **Functional Dependencies:**
  - $FD_1: \{\text{payroll\_id}\} \rightarrow \{\text{employee\_id}, \text{period\_id}, \text{salary\_id}, \text{present\_days}, \text{approved\_paid\_leave\_days}, \text{unpaid\_leave\_days}, \text{late\_days}, \text{gross\_earnings}, \text{total\_deductions}, \text{net\_salary}, \text{payment\_status}, \text{processed\_by}, \text{processed\_at}, \text{payment\_date}, \text{remarks}\}$
  - $FD_2: \{\text{employee\_id}, \text{period\_id}\} \rightarrow \{\text{all attributes}\}$
  - *Intentional Historical Snapshot Denormalization:* `gross_earnings`, `total_deductions`, `net_salary` (`gross_earnings - total_deductions`), and period day counts (`present_days`, `approved_paid_leave_days`, `unpaid_leave_days`, `late_days`) are derived/snapshot values frozen at payroll execution time. Storing them prevents historical payslip distortion if attendance records are later archived or salary rules change, and matches the normalized line-item ledger in `payroll_items`.
- **Normal Form:** 3NF for entity keys, with explicitly justified financial snapshot columns.

### 2.8 Entity: `payroll_items`
- **Primary Key:** `{item_id}`
- **Functional Dependencies:**
  - $FD_1: \{\text{item\_id}\} \rightarrow \{\text{payroll\_id}, \text{item\_type}, \text{item\_name}, \text{amount}, \text{description}, \text{created\_at}\}$
- **Normal Form:** 3NF / BCNF.

### 2.9 Entity: `audit_logs`
- **Primary Key:** `{log_id}`
- **Functional Dependencies:**
  - $FD_1: \{\text{log\_id}\} \rightarrow \{\text{table\_name}, \text{record\_id}, \text{action}, \text{actor\_employee\_id}, \text{old\_values}, \text{new\_values}, \text{ip\_address}, \text{created\_at}\}$
- **Normal Form:** 3NF / BCNF (JSON payload strings are stored in `old_values`/`new_values` for flexible before/after diff capture across tables).

---

## 3. Step-by-Step Normalization Breakdown

### 3.1 First Normal Form (1NF)
- **Atomic attributes:** `first_name` and `last_name` are separate; dates and times are split (`work_date`, `check_in_time`, `check_out_time`).
- **No repeating groups:** Leave entries (`leaves`) and payslip earning/deduction lines (`payroll_items`) are stored as separate child relations rather than comma-separated lists.
- **Unique row identity:** Every relation defines an explicit `AUTO_INCREMENT` primary key.

### 3.2 Second Normal Form (2NF)
- Every table is in 1NF and has no partial dependencies on composite candidate keys:
  - In `attendance`, `{employee_id, work_date}` jointly determine `status`, `check_in_time`, `check_out_time`, and `remarks`.
  - In `payrolls`, `{employee_id, period_id}` jointly determine the period's attendance aggregates and disbursement snapshot.

### 3.3 Third Normal Form (3NF)
- Non-prime transitive dependencies on master attributes are removed:
  - `departments` eliminates `employee_id -> department_id -> department_name`.
  - `salary_structures` isolates effective-dated compensation from `employees` and `payrolls`.
  - `payroll_items` normalizes itemized earnings and deductions out of `payrolls`.
  - Controlled derived columns (`attendance.{is_late, late_minutes}` and `payrolls` financial/day snapshots) are explicitly justified for indexability and immutable financial auditing.

---

## 4. Elimination of Data Anomalies

| Anomaly Type | Unnormalized Risk | How PayTrace Architecture Prevents It |
| :--- | :--- | :--- |
| **Insertion Anomaly** | Cannot create a department before hiring an employee into it. | `departments` is an independent relation. |
| **Update Anomaly** | Changing an employee's designation or department requires editing historical attendance rows. | Employee attributes live solely in `employees` (`departments` FK). |
| **Deletion Anomaly** | Deleting an attendance entry risks losing salary or department data. | `attendance`, `leaves`, and `salary_structures` are independent child relations; `payrolls` uses `ON DELETE RESTRICT` on `employee_id`, `period_id`, and `salary_id`. |
| **Historical Distortion** | A salary revision retroactively mutates past salary slips. | `salary_structures` preserves effective-dated history; `payrolls` and `payroll_items` freeze historical amounts. |

# PayTrace — Schema Design Specification & Data Dictionary (Phase 1)

**Author:** Pulkit Pradhan  
**Roll Number:** 2501730036  

## 1. System Overview & Core Philosophy

**PayTrace** is a transparent, auditable, and transaction-safe Payroll & Attendance Management System built for an enterprise environment. It addresses three critical challenges in organizational management:
1. **Explainable and Auditable Payroll:** Eliminates "black-box" salary numbers by generating deterministic, itemized breakdowns of earnings, allowances, statutory deductions, attendance penalties, and net pay.
2. **Attendance & Leave Integrity:** Enforces temporal and logical constraints at both database and application layers, strictly prohibiting duplicate daily attendance records and overlapping approved leaves.
3. **Historical Snapshot Preservation:** Separates current operational profiles from finalized payroll records, guaranteeing that retroactive raises or staff changes never distort past financial statements.

---

## 2. Complete Data Dictionary

### Table 1: `departments`
*Purpose:* Stores organizational units / departments.

| Column Name | Data Type | Nullable | Key / Constraint | Default | Description |
| :--- | :--- | :--- | :--- | :--- | :--- |
| `department_id` | INT | NO | PRIMARY KEY, AUTO_INCREMENT | - | Unique department identifier |
| `department_name` | VARCHAR(50) | NO | UNIQUE (`uq_department_name`) | - | Department title (e.g., 'Engineering') |
| `description` | VARCHAR(255) | YES | - | NULL | Functional scope of department |
| `created_at` | TIMESTAMP | NO | - | CURRENT_TIMESTAMP | Record creation timestamp |

---

### Table 2: `employees`
*Purpose:* Master entity for employee profiles, organizational placement, and credentials.

| Column Name | Data Type | Nullable | Key / Constraint | Default | Description |
| :--- | :--- | :--- | :--- | :--- | :--- |
| `employee_id` | INT | NO | PRIMARY KEY, AUTO_INCREMENT | - | Unique internal surrogate identifier |
| `employee_code` | VARCHAR(20) | NO | UNIQUE (`uq_employee_code`) | - | Human-readable ID (e.g., 'EMP001') |
| `first_name` | VARCHAR(50) | NO | - | - | Employee first name |
| `last_name` | VARCHAR(50) | NO | - | - | Employee surname |
| `email` | VARCHAR(100) | NO | UNIQUE (`uq_employee_email`) | - | Work email used for login |
| `phone` | VARCHAR(20) | YES | - | NULL | Contact phone number |
| `department_id` | INT | NO | FK -> `departments(department_id)` | - | Department assignment (RESTRICT) |
| `designation` | VARCHAR(50) | NO | - | - | Job title (e.g., 'Lead Developer') |
| `role` | ENUM | NO | 'HR_ADMIN', 'EMPLOYEE' | 'EMPLOYEE' | Role-based authorization tier |
| `password_hash` | VARCHAR(255) | NO | - | - | Bcrypt hashed credential |
| `hire_date` | DATE | NO | - | - | Official date of joining |
| `status` | ENUM | NO | 'ACTIVE', 'INACTIVE', 'TERMINATED' | 'ACTIVE' | Employment lifecycle status |
| `created_at` | TIMESTAMP | NO | - | CURRENT_TIMESTAMP | Account creation timestamp |
| `updated_at` | TIMESTAMP | NO | - | CURRENT_TIMESTAMP (ON UPDATE) | Last update timestamp |

---

### Table 3: `salary_structures`
*Purpose:* Configured compensation package and revisions per employee.

| Column Name | Data Type | Nullable | Key / Constraint | Default | Description |
| :--- | :--- | :--- | :--- | :--- | :--- |
| `salary_id` | INT | NO | PRIMARY KEY, AUTO_INCREMENT | - | Unique salary revision identifier |
| `employee_id` | INT | NO | FK -> `employees(employee_id)` | - | Target employee (CASCADE) |
| `basic_salary` | DECIMAL(10,2) | NO | CHECK (`basic_salary` >= 0) | - | Base monthly salary component |
| `hra` | DECIMAL(10,2) | NO | CHECK (`hra` >= 0) | 0.00 | House Rent Allowance |
| `special_allowance`| DECIMAL(10,2)| NO | CHECK (`special_allowance` >= 0)| 0.00 | Monthly discretionary allowance |
| `provident_fund` | DECIMAL(10,2) | NO | CHECK (`provident_fund` >= 0) | 0.00 | Standard retirement deduction |
| `professional_tax`| DECIMAL(10,2)| NO | CHECK (`professional_tax` >= 0)| 0.00 | State-mandated professional tax |
| `effective_date` | DATE | NO | - | - | Date from which package applies |
| `is_active` | BOOLEAN | NO | - | TRUE | Whether this revision is active |
| `created_at` | TIMESTAMP | NO | - | CURRENT_TIMESTAMP | Record creation timestamp |
| `updated_at` | TIMESTAMP | NO | - | CURRENT_TIMESTAMP (ON UPDATE) | Last update timestamp |

---

### Table 4: `attendance`
*Purpose:* Granular daily time-tracking and punctuality records.

| Column Name | Data Type | Nullable | Key / Constraint | Default | Description |
| :--- | :--- | :--- | :--- | :--- | :--- |
| `attendance_id` | INT | NO | PRIMARY KEY, AUTO_INCREMENT | - | Unique attendance record identifier |
| `employee_id` | INT | NO | FK -> `employees(employee_id)` | - | Employee identifier (CASCADE) |
| `work_date` | DATE | NO | UNIQUE (`employee_id`, `work_date`) | - | Calendar work date |
| `status` | ENUM | NO | 'PRESENT', 'ABSENT', 'HALF_DAY', 'ON_LEAVE' | - | Day attendance outcome |
| `check_in_time` | TIME | YES | - | NULL | Clock-in time |
| `check_out_time` | TIME | YES | - | NULL | Clock-out time |
| `is_late` | BOOLEAN | NO | - | FALSE | Flagged if check-in > 09:15:00 |
| `late_minutes` | INT | NO | CHECK (`late_minutes` >= 0) | 0 | Minutes past shift start (09:00:00) |
| `remarks` | VARCHAR(255) | YES | - | NULL | Context or supervisor note |
| `created_at` | TIMESTAMP | NO | - | CURRENT_TIMESTAMP | Record timestamp |
| `updated_at` | TIMESTAMP | NO | - | CURRENT_TIMESTAMP (ON UPDATE) | Last update timestamp |

---

### Table 5: `leaves`
*Purpose:* Employee leave requests, justification, and approval workflow.

| Column Name | Data Type | Nullable | Key / Constraint | Default | Description |
| :--- | :--- | :--- | :--- | :--- | :--- |
| `leave_id` | INT | NO | PRIMARY KEY, AUTO_INCREMENT | - | Unique leave request identifier |
| `employee_id` | INT | NO | FK -> `employees(employee_id)` | - | Applicant employee (CASCADE) |
| `leave_type` | ENUM | NO | 'CASUAL', 'SICK', 'PAID', 'UNPAID' | - | Classification of leave |
| `start_date` | DATE | NO | CHECK (`start_date` <= `end_date`) | - | First day of requested leave |
| `end_date` | DATE | NO | - | - | Final day of requested leave |
| `total_days` | DECIMAL(4,1) | NO | CHECK (`total_days` > 0) | - | Inclusive working days requested |
| `reason` | VARCHAR(255) | NO | - | - | Applicant's explanation |
| `status` | ENUM | NO | 'PENDING', 'APPROVED', 'REJECTED', 'CANCELLED' | 'PENDING' | Workflow approval status |
| `applied_on` | TIMESTAMP | NO | - | CURRENT_TIMESTAMP | Submission timestamp |
| `actioned_by` | INT | YES | FK -> `employees(employee_id)` | NULL | HR Admin approver (SET NULL) |
| `actioned_on` | TIMESTAMP | YES | - | NULL | Approval or rejection timestamp |
| `admin_remarks` | VARCHAR(255) | YES | - | NULL | Admin feedback / decision reason |

---

### Table 6: `payroll_periods`
*Purpose:* Predefined monthly payroll accounting windows.

| Column Name | Data Type | Nullable | Key / Constraint | Default | Description |
| :--- | :--- | :--- | :--- | :--- | :--- |
| `period_id` | INT | NO | PRIMARY KEY, AUTO_INCREMENT | - | Unique period identifier |
| `period_name` | VARCHAR(30) | NO | UNIQUE (`uq_period_name`) | - | Cycle label (e.g., 'August 2026') |
| `start_date` | DATE | NO | CHECK (`start_date` <= `end_date`) | - | First calendar date of month |
| `end_date` | DATE | NO | - | - | Last calendar date of month |
| `total_working_days`| INT | NO | CHECK (`total_working_days` > 0) | - | Mon–Fri working days (e.g., 22, 23, 21) |
| `status` | ENUM | NO | 'OPEN', 'PROCESSING', 'FINALIZED', 'CLOSED' | 'OPEN' | Accounting cycle status |
| `created_at` | TIMESTAMP | NO | - | CURRENT_TIMESTAMP | Period initialization timestamp |

---

### Table 7: `payrolls`
*Purpose:* Immutable processed payroll master record per employee per cycle.

| Column Name | Data Type | Nullable | Key / Constraint | Default | Description |
| :--- | :--- | :--- | :--- | :--- | :--- |
| `payroll_id` | INT | NO | PRIMARY KEY, AUTO_INCREMENT | - | Unique payroll transaction record |
| `employee_id` | INT | NO | FK -> `employees(employee_id)` | - | Employee paid (RESTRICT) |
| `period_id` | INT | NO | FK -> `payroll_periods(period_id)` | - | Accounting cycle (RESTRICT) |
| `salary_id` | INT | NO | FK -> `salary_structures(salary_id)` | - | Salary snapshot used (RESTRICT) |
| `present_days` | DECIMAL(4,1) | NO | CHECK (`present_days` >= 0) | 0.0 | Days logged as PRESENT (+0.5 per HALF_DAY) |
| `approved_paid_leave_days` | DECIMAL(4,1) | NO | - | 0.0 | Approved paid leave days |
| `unpaid_leave_days` | DECIMAL(4,1) | NO | CHECK (`unpaid_leave_days` >= 0) | 0.0 | Days of unpaid leave / absence |
| `late_days` | INT | NO | CHECK (`late_days` >= 0) | 0 | Count of late attendance days |
| `gross_earnings`| DECIMAL(10,2)| NO | CHECK (`gross_earnings` >= 0) | - | Total earnings snapshot |
| `total_deductions`| DECIMAL(10,2)| NO | CHECK (`total_deductions` >= 0)| - | Total deductions snapshot |
| `net_salary` | DECIMAL(10,2) | NO | CHECK (`net_salary` >= 0) | - | Net disbursed amount |
| `payment_status`| ENUM | NO | 'CALCULATED', 'PROCESSED', 'PAID'| 'CALCULATED' | Disbursement workflow status |
| `processed_by` | INT | NO | FK -> `employees(employee_id)` | - | Admin who processed (RESTRICT) |
| `processed_at` | TIMESTAMP | NO | - | CURRENT_TIMESTAMP | Processing timestamp |
| `payment_date` | DATE | YES | - | NULL | Disbursal date |
| `remarks` | VARCHAR(255) | YES | - | NULL | Audit comments / adjustments |
| - | - | - | UNIQUE (`employee_id`, `period_id`) | - | Strictly one payroll per period |

---

### Table 8: `payroll_items`
*Purpose:* Itemized line-item breakdown of all earnings and deductions comprising a payroll slip.

| Column Name | Data Type | Nullable | Key / Constraint | Default | Description |
| :--- | :--- | :--- | :--- | :--- | :--- |
| `item_id` | INT | NO | PRIMARY KEY, AUTO_INCREMENT | - | Unique line-item identifier |
| `payroll_id` | INT | NO | FK -> `payrolls(payroll_id)` | - | Parent payroll record (CASCADE) |
| `item_type` | ENUM | NO | 'EARNING', 'DEDUCTION' | - | Classification of line-item |
| `item_name` | VARCHAR(50) | NO | - | - | Descriptor (e.g. 'Basic Pay', 'HRA', 'TDS') |
| `amount` | DECIMAL(10,2) | NO | CHECK (`amount` >= 0.00) | - | Monies allocated to this line |
| `description` | VARCHAR(255) | YES | - | NULL | Explanatory note or formula basis |
| `created_at` | TIMESTAMP | NO | - | CURRENT_TIMESTAMP | Item creation timestamp |

---

### Table 9: `audit_logs`
*Purpose:* Immutable security and compliance log recording sensitive state changes.

| Column Name | Data Type | Nullable | Key / Constraint | Default | Description |
| :--- | :--- | :--- | :--- | :--- | :--- |
| `log_id` | INT | NO | PRIMARY KEY, AUTO_INCREMENT | - | Unique log entry sequence |
| `table_name` | VARCHAR(50) | NO | - | - | Target table mutated |
| `record_id` | INT | NO | - | - | Primary key of mutated entity |
| `action` | ENUM | NO | 'INSERT', 'UPDATE', 'DELETE' | - | DML operation performed |
| `actor_employee_id` | INT | YES | FK -> `employees(employee_id)` | NULL | Authenticated user (SET NULL) |
| `old_values` | LONGTEXT | YES | JSON formatted string | NULL | State prior to modification |
| `new_values` | LONGTEXT | YES | JSON formatted string | NULL | State after modification |
| `ip_address` | VARCHAR(45) | YES | - | NULL | Client IP for audit origin |
| `created_at` | TIMESTAMP | NO | - | CURRENT_TIMESTAMP | Exact event timestamp |

---

## 3. Authoritative Salary & Deduction Calculation Model

To guarantee 100% explainable, reproducible, and verifiable results, the salary engine uses exact decimal mathematics (`DECIMAL(10,2)`) and never uses floating-point arithmetic.

### 3.1 Base Monthly Earnings
- **Basic Pay ($B$):** Configured in active `salary_structures`.
- **House Rent Allowance ($H$):** Configured in active `salary_structures`.
- **Special Allowance ($S$):** Configured in active `salary_structures`.
$$\text{Gross Standard Earnings} = B + H + S$$

### 3.2 Daily Rate Calculation
$$\text{Daily Rate} = \text{ROUND}\left(\frac{\text{Gross Standard Earnings}}{\text{total\_working\_days}}, 2\right)$$
Where `total_working_days` is retrieved from `payroll_periods` (e.g., 22, 23, or 21 days).

### 3.3 Deductions Policy
1. **Statutory Deductions:**
   - **Provident Fund (PF):** Stored in `salary_structures.provident_fund`.
   - **Professional Tax (PT):** Stored in `salary_structures.professional_tax`.
2. **Unpaid Leave Deduction ($U_{ded}$):**
   $$U_{ded} = \text{ROUND}(\text{unpaid\_leave\_days} \times \text{Daily Rate}, 2)$$
3. **Late Attendance Penalty ($L_{ded}$):**
   - *Grace Threshold:* Employees are allowed up to 3 late arrivals per month without financial deduction.
   - *Penalty:* Every late mark from the 4th onwards incurs a half-day salary penalty:
   $$L_{ded} = \text{ROUND}(\max(0, \text{late\_days} - 3) \times 0.5 \times \text{Daily Rate}, 2)$$
4. **Income Tax (TDS) Calculation:**
   - Academic progressive slab model based on annualized gross ($AG = \text{Gross Standard Earnings} \times 12$):
     - Tier 1: $AG \le \$300,000 \implies \text{Tax} = \$0$
     - Tier 2: $\$300,001 \text{ to } \$600,000 \implies 5\% \times (AG - 300,000)$
     - Tier 3: $\$600,001 \text{ to } \$1,200,000 \implies \$15,000 + 10\% \times (AG - 600,000)$
     - Tier 4: $> \$1,200,000 \implies \$75,000 + 20\% \times (AG - 1,200,000)$
   $$\text{Monthly TDS} = \text{ROUND}(\frac{\text{Annual Tax}}{12}, 2)$$

### 3.4 Summary Totals & Net Pay
$$\text{Total Deductions} = \text{PF} + \text{PT} + U_{ded} + L_{ded} + \text{Monthly TDS}$$
$$\text{Net Salary} = \text{Gross Standard Earnings} - \text{Total Deductions}$$
*Constraint:* $\text{Net Salary} \ge 0.00$.

---

## 4. Conflict Resolution & Temporal Integrity

1. **Duplicate Attendance Prevention:**
   - Enforced by unique index `UNIQUE KEY uq_emp_work_date (employee_id, work_date)`.
   - Any attempt to clock in twice for the same work date fails with an immediate constraint violation error.
2. **Overlapping Approved Leave Prevention:**
   - Enforced via database triggers (`BEFORE INSERT` and `BEFORE UPDATE` on `leaves`) and application validation.
   - A leave request cannot be approved if another approved leave exists for the same employee where:
     $$(\text{existing.start\_date} \le \text{new.end\_date}) \text{ AND } (\text{existing.end\_date} \ge \text{new.start\_date})$$
3. **Duplicate Payroll Processing Prevention:**
   - Enforced by unique index `UNIQUE KEY uq_emp_payroll_period (employee_id, period_id)`.
   - Prevents an employee from receiving duplicate disbursements in the same accounting cycle.
4. **Immutable Payroll Snapshot:**
   - Finalized records in `payrolls` and itemized entries in `payroll_items` preserve the historical rates and exact amounts disassociated from subsequent salary structure edits.

---

## 5. Schema Approval Checklist

| Category | Rubric Requirement | Schema Implementation Status | Verification Evidence |
| :--- | :--- | :--- | :--- |
| **Entities** | At minimum: Employee, Attendance, Leave, Salary, Payroll | 9 Normalized Entities: `departments`, `employees`, `salary_structures`, `attendance`, `leaves`, `payroll_periods`, `payrolls`, `payroll_items`, `audit_logs` | Present in `database/schema.sql` |
| **Keys** | Primary Keys, Foreign Keys, Unique Keys, Candidate Keys | AUTO_INCREMENT PKs on all tables; explicit FKs with referential actions; UKs on codes, emails, names, composite keys | Verified on MariaDB 13.0.2 |
| **Integrity** | Check constraints, sensible defaults, nullability | CHECK constraints on monetary non-negativity, dates order (`start <= end`), positive working days | Verified on MariaDB 13.0.2 |
| **Normalization** | At least 3NF | Proven in `docs/phase-1/normalization.md`; core master/transactional entities satisfy 3NF with documented snapshot denormalization in `payrolls` | Formal FD proofs documented |
| **Payroll Model** | Distinguish master, config, attendance, and results | `employees` (master) $\ne$ `salary_structures` (config) $\ne$ `attendance` (log) $\ne$ `payrolls`/`payroll_items` (results) | Clear entity separation |
| **Duplicate Guard** | Prevent duplicate attendance and duplicate payroll | `UNIQUE(employee_id, work_date)` and `UNIQUE(employee_id, period_id)` | DB constraints defined |
| **Leave Overlap** | Prevent overlapping approved leaves | Trigger & procedure logic designed over `(start_date, end_date)` intervals | Specified in business rules |
| **Auditability** | Complete audit history without overwriting | Dedicated `audit_logs` table storing JSON before/after snapshots and actor ID | Defined in schema and triggers |
| **Engine** | Standard SQL compatible with MariaDB/MySQL | Written in standard MariaDB/MySQL InnoDB DDL | Verified on MariaDB 13.0.2 (note: prior instructor sign-off is unverified in repository history) |

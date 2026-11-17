# PayTrace — Entity Relationship Diagram (Phase 1)

## Overview

The PayTrace relational database model consists of 9 normalized entities designed for transparency, strict data integrity, auditability, and role-based access control.

```mermaid
erDiagram
    DEPARTMENTS ||--o{ EMPLOYEES : "employs"
    EMPLOYEES ||--o{ SALARY_STRUCTURES : "has"
    EMPLOYEES ||--o{ ATTENDANCE : "logs"
    EMPLOYEES ||--o{ LEAVES : "requests"
    EMPLOYEES ||--o{ LEAVES : "approves / actions"
    EMPLOYEES ||--o{ PAYROLLS : "receives"
    EMPLOYEES ||--o{ PAYROLLS : "processes"
    EMPLOYEES ||--o{ AUDIT_LOGS : "triggers"
    PAYROLL_PERIODS ||--o{ PAYROLLS : "contains"
    SALARY_STRUCTURES ||--o{ PAYROLLS : "referenced_in"
    PAYROLLS ||--|{ PAYROLL_ITEMS : "breaks_down_into"

    DEPARTMENTS {
        int department_id PK
        varchar department_name UK
        varchar description
        timestamp created_at
    }

    EMPLOYEES {
        int employee_id PK
        varchar employee_code UK
        varchar first_name
        varchar last_name
        varchar email UK
        varchar phone
        int department_id FK
        varchar designation
        enum role
        varchar password_hash
        date hire_date
        enum status
        timestamp created_at
        timestamp updated_at
    }

    SALARY_STRUCTURES {
        int salary_id PK
        int employee_id FK
        decimal basic_salary
        decimal hra
        decimal special_allowance
        decimal provident_fund
        decimal professional_tax
        date effective_date
        boolean is_active
        timestamp created_at
        timestamp updated_at
    }

    ATTENDANCE {
        int attendance_id PK
        int employee_id FK
        date work_date
        enum status
        time check_in_time
        time check_out_time
        boolean is_late
        int late_minutes
        varchar remarks
        timestamp created_at
        timestamp updated_at
    }

    LEAVES {
        int leave_id PK
        int employee_id FK
        enum leave_type
        date start_date
        date end_date
        decimal total_days
        varchar reason
        enum status
        timestamp applied_on
        int actioned_by FK
        timestamp actioned_on
        varchar admin_remarks
    }

    PAYROLL_PERIODS {
        int period_id PK
        varchar period_name UK
        date start_date
        date end_date
        int total_working_days
        enum status
        timestamp created_at
    }

    PAYROLLS {
        int payroll_id PK
        int employee_id FK
        int period_id FK
        int salary_id FK
        decimal present_days
        decimal approved_paid_leave_days
        decimal unpaid_leave_days
        int late_days
        decimal gross_earnings
        decimal total_deductions
        decimal net_salary
        enum payment_status
        int processed_by FK
        timestamp processed_at
        date payment_date
        varchar remarks
    }

    PAYROLL_ITEMS {
        int item_id PK
        int payroll_id FK
        enum item_type
        varchar item_name
        decimal amount
        varchar description
        timestamp created_at
    }

    AUDIT_LOGS {
        int log_id PK
        varchar table_name
        int record_id
        enum action
        int actor_employee_id FK
        longtext old_values
        longtext new_values
        varchar ip_address
        timestamp created_at
    }
```

## Relationships & Cardinalities

1. **`DEPARTMENTS` to `EMPLOYEES` (1 : M)**
   - One department has zero, one, or many employees.
   - Each employee must belong to exactly one department (`department_id` NOT NULL).
   - Referential action: `ON DELETE RESTRICT` prevents accidental deletion of departments with active staff.

2. **`EMPLOYEES` to `SALARY_STRUCTURES` (1 : M)**
   - One employee has one or more salary structures over time (effective-dated revision history).
   - Only one record has `is_active = TRUE` for current calculations.
   - Referential action: `ON DELETE CASCADE`.

3. **`EMPLOYEES` to `ATTENDANCE` (1 : M)**
   - One employee has zero, one, or many daily attendance logs.
   - Natural uniqueness enforced on composite key `(employee_id, work_date)`.
   - Referential action: `ON DELETE CASCADE`.

4. **`EMPLOYEES` to `LEAVES` (1 : M)**
   - As Applicant: One employee submits zero, one, or many leave requests.
   - As Approver (`actioned_by`): HR/Admin employee reviews requests (`ON DELETE SET NULL`).
   - Overlap prevention enforced via trigger and application logic.

5. **`PAYROLL_PERIODS` to `PAYROLLS` (1 : M)**
   - One payroll period contains zero, one, or many processed employee payroll records.
   - Uniqueness enforced on `(employee_id, period_id)` so an employee is paid exactly once per period.
   - Referential action: `ON DELETE RESTRICT`.

6. **`PAYROLLS` to `PAYROLL_ITEMS` (1 : M)**
   - One finalized payroll record breaks down into multiple itemized earnings and deductions line items.
   - Ensures fully explainable payslip reporting.
   - Referential action: `ON DELETE CASCADE`.

7. **`EMPLOYEES` to `AUDIT_LOGS` (1 : M)**
   - Critical updates (salary revisions, payroll processing, attendance adjustments) log the actor who made the change.
   - Referential action: `ON DELETE SET NULL` ensures audit trails persist even if an employee record is deactivated or removed.

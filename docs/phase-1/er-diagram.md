# PayTrace — Entity Relationship Diagram (Phase 1)

**Author:** Pulkit Pradhan  
**Roll Number:** 2501730036  

## Overview

The PayTrace relational database model consists of 9 normalized entities designed for transparency, strict data integrity, auditability, and role-based access control.

### Visual ER Diagram Deliverable

![PayTrace Relational ER Diagram](../assets/diagrams/er-diagram.svg)

*High-resolution downloads:* [[Vector SVG Format]](../assets/diagrams/er-diagram.svg) • [[High-DPI PNG Format]](../assets/diagrams/er-diagram.png) • [[Graphviz DOT Source]](../assets/diagrams/er-diagram.dot) • [[Mermaid Source]](../assets/diagrams/er-diagram.mermaid)

---

### Mermaid Specification

```mermaid
erDiagram
    DEPARTMENTS ||--o{ EMPLOYEES : "employs"
    EMPLOYEES ||--o{ SALARY_STRUCTURES : "has"
    EMPLOYEES ||--o{ ATTENDANCE : "logs"
    EMPLOYEES ||--o{ LEAVES : "requests"
    EMPLOYEES |o--o{ LEAVES : "approves / actions"
    EMPLOYEES ||--o{ PAYROLLS : "receives"
    EMPLOYEES ||--o{ PAYROLLS : "processes"
    EMPLOYEES |o--o{ AUDIT_LOGS : "triggers"
    PAYROLL_PERIODS ||--o{ PAYROLLS : "contains"
    SALARY_STRUCTURES ||--o{ PAYROLLS : "referenced_in"
    PAYROLLS ||--o{ PAYROLL_ITEMS : "breaks_down_into"

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
        int employee_id FK,UK
        date work_date UK
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
        int employee_id FK,UK
        int period_id FK,UK
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

1. **`DEPARTMENTS` to `EMPLOYEES` (1 : 0..N)**
   - One department employs zero, one, or many employees; each employee belongs to exactly one department (`department_id NOT NULL`).
   - Referential action: `ON DELETE RESTRICT`, `ON UPDATE CASCADE`.
2. **`EMPLOYEES` to `SALARY_STRUCTURES` (1 : 0..N)**
   - One employee has zero, one, or many effective-dated salary configurations over time.
   - Referential action: `ON DELETE CASCADE`, `ON UPDATE CASCADE`.
3. **`EMPLOYEES` to `ATTENDANCE` (1 : 0..N)**
   - One employee has zero, one, or many daily attendance logs; uniqueness enforced via `UNIQUE (employee_id, work_date)`.
   - Referential action: `ON DELETE CASCADE`, `ON UPDATE CASCADE`.
4. **`EMPLOYEES` to `LEAVES` — Applicant (1 : 0..N)**
   - One employee has zero, one, or many leave records (`employee_id NOT NULL`).
   - Referential action: `ON DELETE CASCADE`, `ON UPDATE CASCADE`.
5. **`EMPLOYEES` to `LEAVES` — Approver (0..1 : 0..N)**
   - Nullable `actioned_by` references the HR/Admin employee who actioned the request (`NULL` while `PENDING`).
   - Referential action: `ON DELETE SET NULL`, `ON UPDATE CASCADE`.
6. **`EMPLOYEES` to `PAYROLLS` — Recipient & Processor (1 : 0..N)**
   - Both `employee_id` (recipient) and `processed_by` (HR/Admin actor) are `NOT NULL` references to `employees`.
   - Referential action: `ON DELETE RESTRICT`, `ON UPDATE CASCADE`.
7. **`PAYROLL_PERIODS` to `PAYROLLS` (1 : 0..N)**
   - One payroll period contains zero, one, or many employee payroll records; uniqueness enforced via `UNIQUE (employee_id, period_id)`.
   - Referential action: `ON DELETE RESTRICT`, `ON UPDATE CASCADE`.
8. **`SALARY_STRUCTURES` to `PAYROLLS` (1 : 0..N)**
   - Each payroll record references the effective `salary_id` (`NOT NULL`) used for that cycle.
   - Referential action: `ON DELETE RESTRICT`, `ON UPDATE CASCADE`.
9. **`PAYROLLS` to `PAYROLL_ITEMS` (1 : 0..N)**
   - Each payroll header links to itemized earnings and deductions in `payroll_items`.
   - Referential action: `ON DELETE CASCADE`, `ON UPDATE CASCADE`.
10. **`EMPLOYEES` to `AUDIT_LOGS` (0..1 : 0..N)**
    - Nullable `actor_employee_id` records the executing employee when available (`NULL` for system/direct SQL actions).
    - Referential action: `ON DELETE SET NULL`, `ON UPDATE CASCADE`.

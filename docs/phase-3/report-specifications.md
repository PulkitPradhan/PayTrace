# PayTrace — Report Specifications & Sample Outputs (Phase 3)

## 1. Overview

Phase 3 implements the mandatory operational and financial reporting queries for PayTrace. All reports execute against the normalized Phase 1 schema and Phase 2 seed dataset without fabricated data or Cartesian inflation.

---

## 2. Mandatory Reports

### Report 1: Monthly Attendance Summary
- **Target Audience:** HR / Payroll Administrators
- **Objective:** Provides an employee-level aggregation of work days, punctuality, and leave outcomes within an accounting period.
- **SQL Query:** Available in `database/reports.sql`.
- **Key Columns:**
  - `employee_id`, `employee_code`, `full_name`, `department_name`, `designation`
  - `total_working_days`: Standard working days from `payroll_periods` (e.g., 23 in July 2026).
  - `days_present`: Count of `status = 'PRESENT'` (+ 0.5 for `HALF_DAY`).
  - `days_absent`: Count of `status = 'ABSENT'`.
  - `days_on_leave`: Count of `status = 'ON_LEAVE'`.
  - `late_marks`: Count of records where `is_late = TRUE`.
  - `attendance_percentage`: $\frac{\text{days\_present} + \text{days\_on\_leave}}{\text{total\_working\_days}} \times 100\%$.

#### Representative Output (Period: July 2026)
```text
+-------------+---------------+----------------+----------------------+--------------------+--------------+-------------+---------------+------------+-----------------------+
| employee_id | employee_code | full_name      | department_name      | total_working_days | days_present | days_absent | days_on_leave | late_marks | attendance_percentage |
+-------------+---------------+----------------+----------------------+--------------------+--------------+-------------+---------------+------------+-----------------------+
|           1 | EMP001        | Alice Morgan   | Human Resources      |                 23 |         23.0 |         0.0 |           0.0 |          0 |                 100.0 |
|           2 | EMP002        | Robert Chen    | Engineering          |                 23 |         23.0 |         0.0 |           0.0 |          1 |                 100.0 |
|           3 | EMP003        | David Miller   | Engineering          |                 23 |         23.0 |         0.0 |           0.0 |          1 |                 100.0 |
|           4 | EMP004        | Sarah Jenkins  | Engineering          |                 23 |         23.0 |         0.0 |           0.0 |          6 |                 100.0 |
|           5 | EMP005        | Elena Rostova  | Engineering          |                 23 |         22.0 |         0.0 |           1.0 |          1 |                 100.0 |
|           6 | EMP006        | James Wilson   | Finance & Accounting |                 23 |         23.0 |         0.0 |           0.0 |          1 |                 100.0 |
|           7 | EMP007        | Maria Garcia   | Finance & Accounting |                 23 |         21.0 |         0.0 |           2.0 |          1 |                 100.0 |
|           8 | EMP008        | Liam Patel     | Marketing & Sales    |                 23 |         23.0 |         0.0 |           0.0 |          1 |                 100.0 |
|           9 | EMP009        | Chloe Dubois   | Marketing & Sales    |                 23 |         23.0 |         0.0 |           0.0 |          2 |                 100.0 |
|          10 | EMP010        | Kevin O'Connor | Operations & Support |                 23 |         23.0 |         0.0 |           0.0 |          2 |                 100.0 |
|          11 | EMP011        | Aisha Khan     | Operations & Support |                 23 |         21.0 |         0.0 |           2.0 |          2 |                 100.0 |
|          12 | EMP012        | Marcus Vance   | Engineering          |                 23 |         23.0 |         0.0 |           0.0 |          1 |                 100.0 |
+-------------+---------------+----------------+----------------------+--------------------+--------------+-------------+---------------+------------+-----------------------+
```

---

### Report 2: Itemized Salary Slip per Employee
- **Target Audience:** Employee & HR Auditor
- **Objective:** Produces an auditable, explainable payslip displaying frozen historical totals from `payrolls` and normalized line items from `payroll_items`.
- **Target Case:** `EMP004` (Sarah Jenkins), July 2026. Demonstrates attendance penalty calculations for tardiness exceeding grace threshold.

#### Header & Master Snapshot
```text
+------------+---------------+---------------+------------------------------+-----------------+-------------------+-------------+------------+------------+--------------------+--------------+--------------------------+-------------------+-----------+----------------+------------------+------------+----------------+--------------+
| payroll_id | employee_code | full_name     | email                        | department_name | designation       | period_name | start_date | end_date   | total_working_days | present_days | approved_paid_leave_days | unpaid_leave_days | late_days | gross_earnings | total_deductions | net_salary | payment_status | payment_date |
+------------+---------------+---------------+------------------------------+-----------------+-------------------+-------------+------------+------------+--------------------+--------------+--------------------------+-------------------+-----------+----------------+------------------+------------+----------------+--------------+
|         16 | EMP004        | Sarah Jenkins | sarah.jenkins@paytrace.local | Engineering     | Frontend Engineer | July 2026   | 2026-07-01 | 2026-07-31 |                 23 |         23.0 |                      0.0 |               0.0 |         6 |      100000.00 |         20771.75 |   79228.25 | CALCULATED     | 2026-07-31   |
+------------+---------------+---------------+------------------------------+-----------------+-------------------+-------------+------------+------------+--------------------+--------------+--------------------------+-------------------+-----------+----------------+------------------+------------+----------------+--------------+
```

#### Itemized Line-Item Breakdown
```text
+-----------+----------------------------+----------+--------------------------------------------------------+
| item_type | item_name                  | amount   | description                                            |
+-----------+----------------------------+----------+--------------------------------------------------------+
| DEDUCTION | Provident Fund (PF)        |  7800.00 | Retirement contribution                                |
| DEDUCTION | Professional Tax           |   200.00 | Mandatory professional tax                             |
| DEDUCTION | Late Attendance Penalty    |  6521.75 | Penalty for 3 late mark(s) beyond grace threshold of 3 |
| DEDUCTION | Income Tax (TDS)           |  6250.00 | Monthly TDS on projected annual taxable gross          |
| EARNING   | Basic Salary               | 65000.00 | Base monthly compensation                              |
| EARNING   | House Rent Allowance (HRA) | 26000.00 | Housing allowance                                      |
| EARNING   | Special Allowance          |  9000.00 | Supplementary allowance                                |
+-----------+----------------------------+----------+--------------------------------------------------------+
```

---

### Report 3: Late-Marks Report
- **Target Audience:** Line Managers & HR
- **Objective:** Lists all instances of late arrival (> 09:15:00) during a payroll cycle, sorted by severity of lateness.

#### Representative Output (Period: July 2026)
```text
+-------------+---------------+----------------+----------------------+--------------------------+------------+---------------+--------------+--------------------+
| employee_id | employee_code | full_name      | department_name      | designation              | work_date  | check_in_time | late_minutes | remarks            |
+-------------+---------------+----------------+----------------------+--------------------------+------------+---------------+--------------+--------------------+
|           4 | EMP004        | Sarah Jenkins  | Engineering          | Frontend Engineer        | 2026-07-06 | 09:35:00      |           35 | Traffic congestion |
|           4 | EMP004        | Sarah Jenkins  | Engineering          | Frontend Engineer        | 2026-07-13 | 09:35:00      |           35 | Traffic congestion |
|           4 | EMP004        | Sarah Jenkins  | Engineering          | Frontend Engineer        | 2026-07-20 | 09:35:00      |           35 | Traffic congestion |
|           4 | EMP004        | Sarah Jenkins  | Engineering          | Frontend Engineer        | 2026-07-24 | 09:35:00      |           35 | Traffic congestion |
|           4 | EMP004        | Sarah Jenkins  | Engineering          | Frontend Engineer        | 2026-07-29 | 09:35:00      |           35 | Traffic congestion |
|          12 | EMP012        | Marcus Vance   | Engineering          | QA Automation Engineer   | 2026-07-07 | 09:25:00      |           25 | Slight delay       |
|          11 | EMP011        | Aisha Khan     | Operations & Support | Support Specialist       | 2026-07-08 | 09:25:00      |           25 | Slight delay       |
|          10 | EMP010        | Kevin O'Connor | Operations & Support | Operations Manager       | 2026-07-09 | 09:25:00      |           25 | Slight delay       |
|           9 | EMP009        | Chloe Dubois   | Marketing & Sales    | Content Specialist       | 2026-07-10 | 09:25:00      |           25 | Slight delay       |
|           6 | EMP006        | James Wilson   | Finance & Accounting | Senior Financial Analyst | 2026-07-13 | 09:25:00      |           25 | Slight delay       |
|           5 | EMP005        | Elena Rostova  | Engineering          | DevOps Specialist        | 2026-07-14 | 09:25:00      |           25 | Slight delay       |
|           4 | EMP004        | Sarah Jenkins  | Engineering          | Frontend Engineer        | 2026-07-15 | 09:25:00      |           25 | Slight delay       |
|           3 | EMP003        | David Miller   | Engineering          | Senior Backend Engineer  | 2026-07-16 | 09:25:00      |           25 | Slight delay       |
|           2 | EMP002        | Robert Chen    | Engineering          | Engineering Manager      | 2026-07-17 | 09:25:00      |           25 | Slight delay       |
|          11 | EMP011        | Aisha Khan     | Operations & Support | Support Specialist       | 2026-07-27 | 09:25:00      |           25 | Slight delay       |
|          10 | EMP010        | Kevin O'Connor | Operations & Support | Operations Manager       | 2026-07-28 | 09:25:00      |           25 | Slight delay       |
|           9 | EMP009        | Chloe Dubois   | Marketing & Sales    | Content Specialist       | 2026-07-29 | 09:25:00      |           25 | Slight delay       |
|           8 | EMP008        | Liam Patel     | Marketing & Sales    | Marketing Lead           | 2026-07-30 | 09:25:00      |           25 | Slight delay       |
|           7 | EMP007        | Maria Garcia   | Finance & Accounting | Accountant               | 2026-07-31 | 09:25:00      |           25 | Slight delay       |
+-------------+---------------+----------------+----------------------+--------------------------+------------+---------------+--------------+--------------------+
```

---

### Report 4: Departmental Payroll Summary
- **Target Audience:** Executive Leadership & Finance Director
- **Objective:** Aggregates gross liabilities, total statutory/tardy deductions, and net disbursed funds broken down by organizational unit.

#### Representative Output (Period: July 2026)
```text
+----------------------+----------------+----------------------+------------------+---------------------+--------------------+
| department_name      | employee_count | total_gross_earnings | total_deductions | total_net_disbursed | average_net_salary |
+----------------------+----------------+----------------------+------------------+---------------------+--------------------+
| Engineering          |              5 |            620000.00 |        111071.75 |           508928.25 |          101785.65 |
| Finance & Accounting |              2 |            185000.00 |         26560.00 |           158440.00 |           79220.00 |
| Marketing & Sales    |              2 |            162000.00 |         21580.00 |           140420.00 |           70210.00 |
| Human Resources      |              1 |            150000.00 |         27850.00 |           122150.00 |          122150.00 |
| Operations & Support |              2 |            145000.00 |         23342.60 |           121657.40 |           60828.70 |
+----------------------+----------------+----------------------+------------------+---------------------+--------------------+
```

# PayTrace — Report Specifications & Sample Outputs (Phase 3)

**Author:** Pulkit Pradhan  
**Roll Number:** 2501730036  

## 1. Overview

Phase 3 implements the mandatory reporting queries in `database/reports.sql` and exposes them to authorized HR/Admin users through `src/routes/reportRoutes.js` and `src/routes/payrollRoutes.js`.

---

## 2. Mandatory Reports

### Report 1: Monthly Attendance Summary
- **SQL & API:** `database/reports.sql` (Report 1) / `GET /api/reports/attendance-summary?periodId=2`
- **Column Semantics:**
  - `days_present`: `PRESENT = 1.0`, `HALF_DAY = 0.5`.
  - `days_absent`: `ABSENT = 1.0`, `HALF_DAY = 0.5`.
  - `half_days`: Count of `HALF_DAY` entries.
  - `days_on_leave`: Count of `ON_LEAVE` entries.
  - `late_marks`: Count of working entries (`PRESENT`/`HALF_DAY`) with `check_in_time IS NOT NULL` and `is_late = TRUE`.
  - `attendance_percentage`: Worked attendance percentage = `ROUND((days_present / NULLIF(total_working_days, 0)) * 100, 1)`.
  - Historical completeness: Includes `ACTIVE` staff hired on or before `pp.end_date` plus any `INACTIVE`/`TERMINATED` staff with attendance rows in the period.

#### Verified Output (Period 2: July 2026, 23 Working Days)
```text
+-------------+---------------+----------------+----------------------+-------------------------+-------------+--------------------+--------------+-------------+-----------+---------------+------------+-----------------------+
| employee_id | employee_code | full_name      | department_name      | designation             | period_name | total_working_days | days_present | days_absent | half_days | days_on_leave | late_marks | attendance_percentage |
+-------------+---------------+----------------+----------------------+-------------------------+-------------+--------------------+--------------+-------------+-----------+---------------+------------+-----------------------+
|           1 | EMP001        | Alice Morgan   | Human Resources      | HR Director             | July 2026   |                 23 |         23.0 |         0.0 |         0 |           0.0 |          0 |                 100.0 |
|           2 | EMP002        | Robert Chen    | Engineering          | Engineering Manager     | July 2026   |                 23 |         23.0 |         0.0 |         0 |           0.0 |          1 |                 100.0 |
|           3 | EMP003        | David Miller   | Engineering          | Senior Backend Engineer | July 2026   |                 23 |         23.0 |         0.0 |         0 |           0.0 |          1 |                 100.0 |
|           4 | EMP004        | Sarah Jenkins  | Engineering          | Frontend Engineer       | July 2026   |                 23 |         23.0 |         0.0 |         0 |           0.0 |          6 |                 100.0 |
|           5 | EMP005        | Elena Rostova  | Engineering          | DevOps Specialist       | July 2026   |                 23 |         22.0 |         0.0 |         0 |           1.0 |          1 |                  95.7 |
|           6 | EMP006        | James Wilson   | Finance & Accounting | Senior Financial Analyst| July 2026   |                 23 |         23.0 |         0.0 |         0 |           0.0 |          1 |                 100.0 |
|           7 | EMP007        | Maria Garcia   | Finance & Accounting | Accountant              | July 2026   |                 23 |         21.0 |         0.0 |         0 |           2.0 |          1 |                  91.3 |
|           8 | EMP008        | Liam Patel     | Marketing & Sales    | Marketing Lead          | July 2026   |                 23 |         23.0 |         0.0 |         0 |           0.0 |          1 |                 100.0 |
|           9 | EMP009        | Chloe Dubois   | Marketing & Sales    | Content Specialist      | July 2026   |                 23 |         23.0 |         0.0 |         0 |           0.0 |          2 |                 100.0 |
|          10 | EMP010        | Kevin O'Connor | Operations & Support | Operations Manager      | July 2026   |                 23 |         23.0 |         0.0 |         0 |           0.0 |          2 |                 100.0 |
|          11 | EMP011        | Aisha Khan     | Operations & Support | Support Specialist      | July 2026   |                 23 |         21.0 |         0.0 |         0 |           2.0 |          2 |                  91.3 |
|          12 | EMP012        | Marcus Vance   | Engineering          | QA Automation Engineer  | July 2026   |                 23 |         23.0 |         0.0 |         0 |           0.0 |          1 |                 100.0 |
+-------------+---------------+----------------+----------------------+-------------------------+-------------+--------------------+--------------+-------------+-----------+---------------+------------+-----------------------+
```

---

### Report 2: Itemized Salary Slip per Employee
- **SQL & API:** `database/reports.sql` (Query 2A/2B by `employee_id, period_id`) / `GET /api/payroll/slip/:payrollId`
- **Target Case:** `EMP004` (Sarah Jenkins), July 2026 (`payroll_id = 16`).

#### Verified Header & Master Snapshot
```text
+------------+-------------+---------------+---------------+------------------------------+-----------------+-------------------+-----------+-------------+------------+------------+--------------------+--------------+--------------------------+-------------------+-----------+----------------+------------------+------------+----------------+--------------+------------------------------------------------+
| payroll_id | employee_id | employee_code | full_name     | email                        | department_name | designation       | period_id | period_name | start_date | end_date   | total_working_days | present_days | approved_paid_leave_days | unpaid_leave_days | late_days | gross_earnings | total_deductions | net_salary | payment_status | payment_date | remarks                                        |
+------------+-------------+---------------+---------------+------------------------------+-----------------+-------------------+-----------+-------------+------------+------------+--------------------+--------------+--------------------------+-------------------+-----------+----------------+------------------+------------+----------------+--------------+------------------------------------------------+
|         16 |           4 | EMP004        | Sarah Jenkins | sarah.jenkins@paytrace.local | Engineering     | Frontend Engineer |         2 | July 2026   | 2026-07-01 | 2026-07-31 |                 23 |         23.0 |                      0.0 |               0.0 |         6 |      100000.00 |         20771.75 |   79228.25 | CALCULATED     | NULL         | Monthly payroll calculated via sp_calculate_payroll |
+------------+-------------+---------------+---------------+------------------------------+-----------------+-------------------+-----------+-------------+------------+------------+--------------------+--------------+--------------------------+-------------------+-----------+----------------+------------------+------------+----------------+--------------+------------------------------------------------+
```

#### Verified Line-Item Breakdown
```text
+---------+-----------+----------------------------+----------+--------------------------------------------------------+
| item_id | item_type | item_name                  | amount   | description                                            |
+---------+-----------+----------------------------+----------+--------------------------------------------------------+
|      96 | DEDUCTION | Provident Fund (PF)        |  7800.00 | Retirement contribution                                |
|      97 | DEDUCTION | Professional Tax           |   200.00 | Mandatory professional tax                             |
|      98 | DEDUCTION | Late Attendance Penalty    |  6521.75 | Penalty for 3 late mark(s) beyond grace threshold of 3 |
|      99 | DEDUCTION | Income Tax (TDS)           |  6250.00 | Monthly TDS on projected annual gross                  |
|      93 | EARNING   | Basic Salary               | 65000.00 | Base monthly compensation                              |
|      94 | EARNING   | House Rent Allowance (HRA) | 26000.00 | Housing allowance                                      |
|      95 | EARNING   | Special Allowance          |  9000.00 | Supplementary allowance                                |
+---------+-----------+----------------------------+----------+--------------------------------------------------------+
```

---

### Report 3: Late-Marks Report
- **SQL & API:** `database/reports.sql` (Report 3) / `GET /api/reports/late-marks?periodId=2`
- **Definition:** Arrival `check_in_time > '09:15:00'` on working statuses (`PRESENT`, `HALF_DAY`) with non-null `check_in_time`. Arrival at exactly `09:15:00` is on time (`is_late = FALSE`). `late_minutes` is measured from `09:00:00`.

#### Verified Output (Period 2: July 2026, 19 Late Entries)
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
- **SQL & API:** `database/reports.sql` (Report 4) / `GET /api/reports/departmental?periodId=2`

#### Verified Output (Period 2: July 2026)
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

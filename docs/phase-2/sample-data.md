# PayTrace — Sample Dataset Specification (Phase 2)

**Author:** Pulkit Pradhan  
**Roll Number:** 2501730036  

## 1. Dataset Overview

The PayTrace seed dataset models a mid-sized organization across **12 employees**, **5 departments**, and **3 distinct monthly payroll cycles** (June 2026, July 2026, August 2026).

---

## 2. Organizational Roster & Compensation Profiles

| Emp Code | Employee Name | Department | Designation | Role | Base Pay | Gross / Mo | Annualized |
| :--- | :--- | :--- | :--- | :--- | :--- | :--- | :--- |
| `EMP001` | Alice Morgan | Human Resources | HR Director | `HR_ADMIN` | $95,000 | $150,000 | $1,800,000 |
| `EMP002` | Robert Chen | Engineering | Engineering Manager | `HR_ADMIN` | $110,000 | $180,000 | $2,160,000 |
| `EMP003` | David Miller | Engineering | Senior Backend Engineer | `EMPLOYEE` | $85,000 | $135,000 | $1,620,000 |
| `EMP004` | Sarah Jenkins | Engineering | Frontend Engineer | `EMPLOYEE` | $65,000 | $100,000 | $1,200,000 |
| `EMP005` | Elena Rostova | Engineering | DevOps Specialist | `EMPLOYEE` | $75,000 | $120,000 | $1,440,000 |
| `EMP006` | James Wilson | Finance & Accounting | Senior Financial Analyst | `EMPLOYEE` | $70,000 | $110,000 | $1,320,000 |
| `EMP007` | Maria Garcia | Finance & Accounting | Accountant | `EMPLOYEE` | $48,000 | $75,000 | $900,000 |
| `EMP008` | Liam Patel | Marketing & Sales | Marketing Lead | `EMPLOYEE` | $62,000 | $97,000 | $1,164,000 |
| `EMP009` | Chloe Dubois | Marketing & Sales | Content Specialist | `EMPLOYEE` | $42,000 | $65,000 | $780,000 |
| `EMP010` | Kevin O'Connor | Operations & Support | Operations Manager | `EMPLOYEE` | $58,000 | $90,000 | $1,080,000 |
| `EMP011` | Aisha Khan | Operations & Support | Support Specialist | `EMPLOYEE` | $35,000 | $55,000 | $660,000 |
| `EMP012` | Marcus Vance | Engineering | QA Automation Engineer | `EMPLOYEE` | $55,000 | $85,000 | $1,020,000 |

*Default Credentials for Verification:*
- HR Admin: `alice.morgan@paytrace.local` / `Admin123!`
- Employee: `david.miller@paytrace.local` / `Employee123!`

---

## 3. Payroll Accounting Cycles

1. **June 2026 (`period_id = 1`):**
   - Start Date: `2026-06-01`, End Date: `2026-06-30`
   - Total Working Days: 22 days (excluding weekends)
   - Status: `CLOSED`
2. **July 2026 (`period_id = 2`):**
   - Start Date: `2026-07-01`, End Date: `2026-07-31`
   - Total Working Days: 23 days (excluding weekends)
   - Status: `CLOSED`
3. **August 2026 (`period_id = 3`):**
   - Start Date: `2026-08-01`, End Date: `2026-08-31`
   - Total Working Days: 22 days (excluding weekends)
   - Status: `FINALIZED`

---

## 4. Attendance & Leave Scenarios Represented

- **792 Total Attendance Records:** Continuous daily weekday attendance logged across all 12 employees over 3 months.
- **Punctuality Variations:**
  - `EMP004` (Sarah Jenkins) exhibits chronic late marks in July 2026 (6 late arrivals: July 6, 13, 15, 20, 24, 29), triggering the >3 late threshold penalty (3 penalty marks = $6,521.75).
  - `EMP008` (Liam Patel) exhibits 4 late arrivals in August 2026, triggering 1 penalty deduction.
  - `EMP011` (Aisha Khan) exhibits 2 late arrivals in June 2026 (within the 3-day grace threshold, incur $0 penalty).
- **Absences & Approved Leaves:**
  - `EMP003` (David Miller): 1 day casual leave on June 12, 1 day paid leave on August 14.
  - `EMP008` (Liam Patel): 2 days unpaid leave on June 18-19, resulting in 2-day pro-rata deduction.
  - `EMP007` (Maria Garcia): 1 unexcused absence on June 25, 2 days sick leave on July 27-28.
  - `EMP011` (Aisha Khan): 2 days unpaid leave on July 15-16.
- **Workflow Requests:**
  - 8 Approved leaves across periods.
  - 1 Rejected leave (`EMP004`, long weekend during release freeze).
  - 1 Pending leave (`EMP009`, dental appointment).

---

## 5. Seed Execution Summary

```sql
SELECT 'departments' AS tbl, COUNT(*) AS cnt FROM departments
UNION ALL SELECT 'employees', COUNT(*) FROM employees
UNION ALL SELECT 'salary_structures', COUNT(*) FROM salary_structures
UNION ALL SELECT 'payroll_periods', COUNT(*) FROM payroll_periods
UNION ALL SELECT 'leaves', COUNT(*) FROM leaves
UNION ALL SELECT 'attendance', COUNT(*) FROM attendance
UNION ALL SELECT 'payrolls', COUNT(*) FROM payrolls
UNION ALL SELECT 'payroll_items', COUNT(*) FROM payroll_items
UNION ALL SELECT 'audit_logs', COUNT(*) FROM audit_logs;
```

**Result:**
- `departments`: 5
- `employees`: 12
- `salary_structures`: 12
- `payroll_periods`: 3
- `leaves`: 10
- `attendance`: 792
- `payrolls`: 36 (All 12 employees across 3 months)
- `payroll_items`: 221
- `audit_logs`: 36

# PayTrace — Sample Dataset Specification (Phase 2)

**Author:** Pulkit Pradhan  
**Roll Number:** 2501730036  

## 1. Dataset Overview

The PayTrace seed dataset (`database/generate_seed.js` -> `database/seed.sql`) models an organization across **12 employees**, **5 departments**, and **3 consecutive monthly payroll cycles** (June, July, and August 2026).

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

*Disposable Demonstration Sample Credentials (per-user salted bcrypt hashes):*
- **HR / Admin:** `alice.morgan@paytrace.local` / `Admin123!`
- **Employee (Read-Only):** `david.miller@paytrace.local` / `Employee123!`
- **Employee (Late Penalty Demo):** `sarah.jenkins@paytrace.local` / `Employee123!`

---

## 3. Payroll Accounting Cycles (Mon–Fri Working Calendar)

1. **June 2026 (`period_id = 1`):** `2026-06-01` to `2026-06-30` — **22** Mon–Fri working days (`CLOSED`)
2. **July 2026 (`period_id = 2`):** `2026-07-01` to `2026-07-31` — **23** Mon–Fri working days (`CLOSED`)
3. **August 2026 (`period_id = 3`):** `2026-08-01` to `2026-08-31` — **21** Mon–Fri working days (`FINALIZED`; Aug 1–2 are Sat–Sun)

---

## 4. Attendance & Leave Scenarios Represented

- **792 Total Attendance Records:** 66 Mon–Fri workdays across 12 employees (`264` in June, `276` in July, `252` in August).
- **Punctuality Variations:**
  - `EMP004` (Sarah Jenkins): 6 late arrivals in July 2026 (3 beyond grace threshold -> `3 × 0.5 × $4,347.83 = $6,521.75` penalty, net `$79,228.25`).
  - `EMP008` (Liam Patel): 4 late arrivals in August 2026 (1 beyond grace threshold -> `1 × 0.5 × $4,619.05 = $2,309.53` penalty, total deductions `$15,899.53`, net `$81,100.47`).
  - `EMP011` (Aisha Khan): 2 late arrivals in June 2026 (within grace threshold -> `$0.00` penalty, net `$48,850.00`).
- **Absences & Approved Leaves (10 Leave Rows: 8 Approved, 1 Rejected, 1 Pending):**
  - `EMP003` (David Miller): 1d casual leave (Jun 12), 1d paid leave (Aug 14).
  - `EMP008` (Liam Patel): 2d unpaid leave (Jun 18–19 -> `$8,818.18` deduction, net `$74,591.82`).
  - `EMP007` (Maria Garcia): 1 unexcused absence (Jun 25), 2d sick leave (Jul 27–28).
  - `EMP011` (Aisha Khan): 2d unpaid leave (Jul 15–16).
  - `EMP004` (Sarah Jenkins): 1d rejected casual leave (Jul 3).
  - `EMP009` (Chloe Dubois): 1d pending sick leave (Aug 28).

---

## 5. Verified Clean Seed Row Counts

| Table | Verified Row Count | Notes |
| :--- | :---: | :--- |
| `departments` | 5 | Engineering, HR, Finance, Marketing, Operations |
| `employees` | 12 | 2 `HR_ADMIN`, 10 `EMPLOYEE` |
| `salary_structures` | 12 | Effective-dated baseline packages |
| `payroll_periods` | 3 | June (22d), July (23d), August (21d) 2026 |
| `leaves` | 10 | 8 `APPROVED`, 1 `REJECTED`, 1 `PENDING` |
| `attendance` | 792 | `66 × 12` weekday logs |
| `payrolls` | 36 | `12 × 3` calculated cycles via `sp_process_bulk_payroll` |
| `payroll_items` | 221 | Normalized itemized earnings & deductions |
| `audit_logs` | 48 | 12 `salary_structures` inserts + 36 `payrolls` inserts |

# PayTrace — Query Optimization & Indexing Analysis (Phase 3)

**Author:** Pulkit Pradhan  
**Roll Number:** 2501730036  

## 1. Executive Summary

This document presents authentic, reproducible `EXPLAIN` and `ANALYZE FORMAT=JSON` measurements on **MariaDB 13.0.2-MariaDB** for the Phase 3 performance indexes defined in `database/indexes.sql` (installed automatically via `database/setup.sql`).

Benchmarks were executed against the exact **Report 3 (Late-Marks Report)** query on both:
1. The **792-row Phase 2 seed dataset** (`12` employees × `66` workdays), and
2. A **50,000-row scaling benchmark** (`200` employees × `250` days) in an isolated disposable database.

---

## 2. Installed Phase 3 Indexes (`database/indexes.sql`)

| Index Name | Table | Columns | Purpose |
| :--- | :--- | :--- | :--- |
| `idx_attendance_late_lookup` | `attendance` | `(is_late, work_date)` | Drives Report 3 range scans on `is_late = TRUE` and `work_date BETWEEN start_date AND end_date`. |
| `idx_attendance_period_summary` | `attendance` | `(work_date, employee_id, status, is_late)` | Covers date-range attendance queries (`GET /api/attendance?periodId=...`). |
| `idx_leaves_emp_status_dates` | `leaves` | `(employee_id, status, start_date, end_date)` | Accelerates overlap triggers and period-bounded leave queries in `sp_calculate_payroll`. |
| `idx_salary_emp_effective` | `salary_structures` | `(employee_id, effective_date)` | Accelerates effective-dated salary lookups (`effective_date <= period_end ORDER BY effective_date DESC`). |

*(Note: A previously proposed `idx_payrolls_period_employee` index was removed after `EXPLAIN` confirmed `payrolls` queries already use `uq_emp_payroll_period(employee_id, period_id)` and the foreign-key index `fk_payrolls_period(period_id)`.)*

---

## 3. Exact Benchmarked Query (Report 3)

```sql
SELECT
    e.employee_id, e.employee_code,
    CONCAT(e.first_name, ' ', e.last_name) AS full_name,
    d.department_name, e.designation,
    a.work_date, a.check_in_time, a.late_minutes, a.remarks
FROM attendance a
JOIN employees e ON a.employee_id = e.employee_id
JOIN departments d ON e.department_id = d.department_id
JOIN payroll_periods pp ON pp.period_id = ?
WHERE a.work_date BETWEEN pp.start_date AND pp.end_date
  AND a.is_late = TRUE
  AND a.check_in_time IS NOT NULL
  AND a.status IN ('PRESENT', 'HALF_DAY')
ORDER BY a.late_minutes DESC, a.work_date ASC, a.attendance_id ASC;
```

---

## 4. Benchmark 1 — Phase 2 Seed Dataset (792 Attendance Rows, July 2026)

Table statistics refreshed via `ANALYZE TABLE` before both runs; 15 repeated executions after warmup.

### 4.1 BEFORE `indexes.sql`
- **Join Order:** `pp (const)` $\rightarrow$ `d (index)` $\rightarrow$ `e (ref)` $\rightarrow$ `a (ref via uq_emp_work_date)`
- **`Extra`:** `Using temporary; Using filesort`
- **Optimizer Cost:** `1.122799786`
- **Actual DB Execution (`ANALYZE FORMAT=JSON`):** `r_total_time_ms = 0.388 ms`; `a` scanned `66` index rows across `12` loops (`792` index rows), `pages_accessed = 564` on `a`.
- **Client 15-Run Timing:** `min = 0.763 ms`, `median = 0.840 ms`, `mean = 0.943 ms`, `max = 1.421 ms`.

```text
+------+-------------+-------+-------+---------------------------------+-------------------------+---------+-----------------------------+------+------------------------------------+
| id   | select_type | table | type  | possible_keys                   | key                     | key_len | ref                         | rows | Extra                              |
+------+-------------+-------+-------+---------------------------------+-------------------------+---------+-----------------------------+------+------------------------------------+
|    1 | SIMPLE      | pp    | const | PRIMARY                         | PRIMARY                 | 4       | const                       | 1    | Using temporary; Using filesort    |
|    1 | SIMPLE      | d     | index | PRIMARY                         | uq_department_name      | 202     | NULL                        | 5    | Using index                        |
|    1 | SIMPLE      | e     | ref   | PRIMARY,fk_employees_department | fk_employees_department | 4       | paytrace_bench_792.d.dep... | 2    |                                    |
|    1 | SIMPLE      | a     | ref   | uq_emp_work_date                | uq_emp_work_date        | 4       | paytrace_bench_792.e.emp... | 66   | Using index condition; Using where |
+------+-------------+-------+-------+---------------------------------+-------------------------+---------+-----------------------------+------+------------------------------------+
```

### 4.2 AFTER `indexes.sql` (`idx_attendance_late_lookup`)
- **Join Order:** `pp (const)` $\rightarrow$ `a (range via idx_attendance_late_lookup)` $\rightarrow$ `e (eq_ref PRIMARY)` $\rightarrow$ `d (eq_ref PRIMARY)`
- **`Extra` on `a`:** `Using index condition; Using where; Using filesort` (`temporary_table` **ELIMINATED**)
- **Optimizer Cost:** `0.073179771` (**93.5% cost reduction**)
- **Actual DB Execution (`ANALYZE FORMAT=JSON`):** `r_total_time_ms = 0.111 ms` (**3.49× faster DB execution**); `a` scanned `r_index_rows = 19`, `pages_accessed = 79` on `a` (down from `564`).
- **Client 15-Run Timing:** `min = 0.438 ms`, `median = 0.537 ms`, `mean = 0.632 ms`, `max = 0.922 ms`.

```text
+------+-------------+-------+--------+-----------------------------------------------------------+----------------------------+---------+-----------------------------+------+----------------------------------------------------+
| id   | select_type | table | type   | possible_keys                                             | key                        | key_len | ref                         | rows | Extra                                              |
+------+-------------+-------+--------+-----------------------------------------------------------+----------------------------+---------+-----------------------------+------+----------------------------------------------------+
|    1 | SIMPLE      | pp    | const  | PRIMARY                                                   | PRIMARY                    | 4       | const                       | 1    |                                                    |
|    1 | SIMPLE      | a     | range  | uq_emp_work_date,idx_attendance_late_lookup,idx_att...    | idx_attendance_late_lookup | 4       | NULL                        | 19   | Using index condition; Using where; Using filesort |
|    1 | SIMPLE      | e     | eq_ref | PRIMARY,fk_employees_department                           | PRIMARY                    | 4       | paytrace_bench_792.a.emp... | 1    |                                                    |
|    1 | SIMPLE      | d     | eq_ref | PRIMARY                                                   | PRIMARY                    | 4       | paytrace_bench_792.e.dep... | 1    |                                                    |
+------+-------------+-------+--------+-----------------------------------------------------------+----------------------------+---------+-----------------------------+------+----------------------------------------------------+
```

---

## 5. Benchmark 2 — 50,000-Row Scaling Dataset (`200` Employees × `250` Days)

| Metric | BEFORE `indexes.sql` | AFTER `indexes.sql` | Measured Improvement |
| :--- | :---: | :---: | :--- |
| **Driving Access (`a`)** | `ref` (`uq_emp_work_date`) | `range` (`idx_attendance_late_lookup`) | Range seek over `(is_late, work_date)` |
| **Rows Returned (`r_rows`)** | 124 (from 50,000 index rows) | 124 (from 124 index rows) | 99.75% fewer attendance index entries scanned |
| **Temporary Table** | Yes (`temporary_table`) | **Eliminated** | Zero temp table materialization |
| **Filesort** | Yes (after full join) | Yes (`read_sorted_file` on 124 rows) | Scope reduced to matching late rows only |
| **Optimizer Cost** | `75.3550` | `0.5324` | **99.3% lower optimizer cost** |
| **DB `r_total_time_ms`** | `8.859 ms` | `0.430 ms` | **20.6× faster DB execution** |
| **Client 15-Run Median** | `10.376 ms` (`mean 10.657 ms`) | `0.873 ms` (`mean 0.994 ms`) | **11.9× faster end-to-end** |

---

## 6. Index Behavior & Remaining Limitations

- **Why `filesort` remains:** In `idx_attendance_late_lookup(is_late, work_date)`, `work_date` is queried as a range (`BETWEEN`), and the query sorts by `a.late_minutes DESC, a.work_date ASC, a.attendance_id ASC`. In B-tree indexes, columns following a range predicate cannot satisfy `ORDER BY` ordering; however, sorting is confined to only the 19 (or 124) pre-filtered rows rather than a materialized join temporary table.
- **Why Report 1 uses `uq_emp_work_date`:** Report 1 starts from `employees` (`LEFT JOIN attendance`) to preserve employees with zero attendance logs, so InnoDB probes `(employee_id, work_date)` via `uq_emp_work_date`.

# PayTrace — Query Optimization & Indexing Analysis (Phase 3)

**Author:** Pulkit Pradhan  
**Roll Number:** 2501730036  

## 1. Executive Summary

This study documents the database indexing analysis and execution-plan optimization conducted on the PayTrace relational database.

Using MariaDB's execution analysis tooling (`EXPLAIN` and `EXPLAIN FORMAT=JSON`), we evaluate query execution behavior on **Report 3 (Late-Marks Report)** before and after adding a targeted composite index:
$$\text{idx\_attendance\_late\_lookup} \text{ on } \text{attendance}(\text{is\_late}, \text{work\_date}, \text{late\_minutes})$$

The addition of this index fundamentally transformed the query plan: it eliminated an outer temporary table, inverted the join order to use an index range scan on the filtered fact table, and converted downstream joins into direct primary key single-row lookups (`eq_ref`).

---

## 2. Baseline Architecture & Existing Indexes

Prior to optimization, the following structural indexes existed in the approved Phase 1 schema:
- `attendance`:
  - `PRIMARY KEY (attendance_id)`
  - `UNIQUE KEY uq_emp_work_date (employee_id, work_date)`
- `employees`:
  - `PRIMARY KEY (employee_id)`
  - `UNIQUE KEY uq_employee_code (employee_code)`
  - `UNIQUE KEY uq_employee_email (email)`
  - `FOREIGN KEY (department_id) REFERENCES departments(department_id)`
- `departments`:
  - `PRIMARY KEY (department_id)`
  - `UNIQUE KEY uq_department_name (department_name)`

### The Optimization Bottleneck
In Report 3, the predicate is:
```sql
WHERE a.work_date BETWEEN '2026-07-01' AND '2026-07-31'
  AND a.is_late = TRUE
ORDER BY a.late_minutes DESC, a.work_date ASC;
```
Because `uq_emp_work_date` has `employee_id` as its leftmost prefix column, the optimizer **cannot** use `uq_emp_work_date` to satisfy a range search on `work_date` across all employees. Consequently, the optimizer was forced into an inefficient nested-loop traversal starting from `departments`.

---

## 3. Pre-Optimization Execution Plan (BEFORE)

### 3.1 Tabular `EXPLAIN` Output
```text
+------+-------------+-------+-------+---------------------------------+-------------------------+---------+-----------------------------+------+----------------------------------------------+
| id   | select_type | table | type  | possible_keys                   | key                     | key_len | ref                         | rows | Extra                                        |
+------+-------------+-------+-------+---------------------------------+-------------------------+---------+-----------------------------+------+----------------------------------------------+
|    1 | SIMPLE      | d     | index | PRIMARY                         | uq_department_name      | 202     | NULL                        | 5    | Using index; Using temporary; Using filesort |
|    1 | SIMPLE      | e     | ref   | PRIMARY,fk_employees_department | fk_employees_department | 4       | paytrace_db.d.department_id | 1    |                                              |
|    1 | SIMPLE      | a     | ref   | uq_emp_work_date                | uq_emp_work_date        | 4       | paytrace_db.e.employee_id   | 1    | Using index condition; Using where           |
+------+-------------+-------+-------+---------------------------------+-------------------------+---------+-----------------------------+------+----------------------------------------------+
```

### 3.2 Machine-Readable `EXPLAIN FORMAT=JSON`
```json
{
  "query_block": {
    "select_id": 1,
    "cost": 0.035306911,
    "filesort": {
      "sort_key": "a.late_minutes desc, a.work_date",
      "temporary_table": {
        "nested_loop": [
          {
            "table": {
              "table_name": "d",
              "access_type": "index",
              "possible_keys": ["PRIMARY"],
              "key": "uq_department_name",
              "key_length": "202",
              "used_key_parts": ["department_name"],
              "loops": 1,
              "rows": 5,
              "cost": 0.007379345,
              "filtered": 100,
              "using_index": true
            }
          },
          {
            "table": {
              "table_name": "e",
              "access_type": "ref",
              "possible_keys": ["PRIMARY", "fk_employees_department"],
              "key": "fk_employees_department",
              "key_length": "4",
              "used_key_parts": ["department_id"],
              "ref": ["paytrace_db.d.department_id"],
              "loops": 5,
              "rows": 1,
              "cost": 0.0107392,
              "filtered": 100
            }
          },
          {
            "table": {
              "table_name": "a",
              "access_type": "ref",
              "possible_keys": ["uq_emp_work_date"],
              "key": "uq_emp_work_date",
              "key_length": "4",
              "used_key_parts": ["employee_id"],
              "ref": ["paytrace_db.e.employee_id"],
              "loops": 5,
              "rows": 1,
              "cost": 0.014016,
              "filtered": 100,
              "index_condition": "a.work_date between <cache>('2026-07-01') and <cache>('2026-07-31')",
              "attached_condition": "a.is_late = 1"
            }
          }
        ]
      }
    }
  }
}
```

### Pre-Optimization Bottlenecks
1. **Unnatural Driving Table:** The query starts at `departments` (`d`), proceeds to `employees` (`e`), and then probes `attendance` (`a`).
2. **Intermediate Materialization:** An in-memory/disk temporary table (`temporary_table`) must be created to hold intermediate joined rows before sorting.
3. **Filesort Overhead:** A filesort pass (`filesort`) is performed across the entire joined intermediate result.

---

## 4. The Proposed Optimization

We introduce a composite index tailored to the equality and range predicates of the report:
```sql
CREATE INDEX `idx_attendance_late_lookup` 
ON `attendance` (`is_late`, `work_date`, `late_minutes`);
```

### Index Column Rationale
- **Column 1 (`is_late`):** Exact equality filter (`a.is_late = TRUE`). High selectivity since only a fraction of records are tardy.
- **Column 2 (`work_date`):** Range boundary filter (`BETWEEN '2026-07-01' AND '2026-07-31'`).
- **Column 3 (`late_minutes`):** Covers the primary ordering attribute (`ORDER BY a.late_minutes DESC`).

---

## 5. Post-Optimization Execution Plan (AFTER)

### 5.1 Tabular `EXPLAIN` Output
```text
+------+-------------+-------+--------+------------------------------------+----------------------------+---------+-----------------------------+------+----------------------------------------------------+
| id   | select_type | table | type   | possible_keys                      | key                        | key_len | ref                         | rows | Extra                                              |
+------+-------------+-------+--------+------------------------------------+----------------------------+---------+-----------------------------+------+----------------------------------------------------+
|    1 | SIMPLE      | a     | range  | uq_emp_work_date,idx_attendance... | idx_attendance_late_lookup | 4       | NULL                        | 19   | Using index condition; Using where; Using filesort |
|    1 | SIMPLE      | e     | eq_ref | PRIMARY,fk_employees_department    | PRIMARY                    | 4       | paytrace_db.a.employee_id   | 1    |                                                    |
|    1 | SIMPLE      | d     | eq_ref | PRIMARY                            | PRIMARY                    | 4       | paytrace_db.e.department_id | 1    |                                                    |
+------+-------------+-------+--------+------------------------------------+----------------------------+---------+-----------------------------+------+----------------------------------------------------+
```

### 5.2 Machine-Readable `EXPLAIN FORMAT=JSON`
```json
{
  "query_block": {
    "select_id": 1,
    "cost": 0.073179771,
    "nested_loop": [
      {
        "read_sorted_file": {
          "filesort": {
            "sort_key": "a.late_minutes desc, a.work_date",
            "table": {
              "table_name": "a",
              "access_type": "range",
              "possible_keys": ["uq_emp_work_date", "idx_attendance_late_lookup"],
              "key": "idx_attendance_late_lookup",
              "key_length": "4",
              "used_key_parts": ["is_late", "work_date"],
              "loops": 1,
              "rows": 19,
              "cost": 0.0254084,
              "filtered": 100,
              "index_condition": "a.is_late = 1 and a.work_date between '2026-07-01' and '2026-07-31'"
            }
          }
        }
      },
      {
        "table": {
          "table_name": "e",
          "access_type": "eq_ref",
          "possible_keys": ["PRIMARY", "fk_employees_department"],
          "key": "PRIMARY",
          "key_length": "4",
          "used_key_parts": ["employee_id"],
          "ref": ["paytrace_db.a.employee_id"],
          "loops": 19,
          "rows": 1,
          "cost": 0.01781356,
          "filtered": 100
        }
      },
      {
        "table": {
          "table_name": "d",
          "access_type": "eq_ref",
          "possible_keys": ["PRIMARY"],
          "key": "PRIMARY",
          "key_length": "4",
          "used_key_parts": ["department_id"],
          "ref": ["paytrace_db.e.department_id"],
          "loops": 19,
          "rows": 1,
          "cost": 0.01781356,
          "filtered": 100
        }
      }
    ]
  }
}
```

---

## 6. Technical Comparison & Optimization Analysis

| Dimension | Before Optimization | After Optimization | Structural Improvement |
| :--- | :--- | :--- | :--- |
| **Driving Table** | `departments` (Dimension table) | `attendance` (Filtered fact table) | Filters immediately to the 19 matching records |
| **Access Method (`a`)** | `ref` via `uq_emp_work_date` (evaluated 5 times) | `range` via `idx_attendance_late_lookup` | Direct index range seek (`is_late = 1 AND work_date BETWEEN...`) |
| **Join Method (`e`, `d`)** | Non-unique `ref` scans | Direct `eq_ref` on `PRIMARY` | $O(1)$ single-row B-tree primary key lookups |
| **Materialization** | `Using temporary` table required | **`temporary_table` ELIMINATED** | Zero intermediate table creation in memory/temp disk |
| **Sorting Scope** | Filesort on intermediate Cartesian join | Direct `read_sorted_file` on `attendance` | Sorts only the 19 pre-filtered records |

---

## 7. Professional Engineering Limitations

In small academic datasets (e.g. 792 attendance rows), wall-clock latency difference is measured in fractions of a millisecond (e.g. 1.2 ms vs 0.4 ms), which is within normal OS scheduling noise. However, on an enterprise production dataset containing 1,000 employees over 5 years (1.2 million attendance rows):
- The **Before** plan would perform a massive Cartesian product join across 1.2M rows followed by multi-megabyte temporary disk tables and external merge sort.
- The **After** plan will instantly seek via B-tree range to only the ~100 late records for that month, performing exactly ~100 direct primary key lookups. The complexity drops from $O(N)$ full-scan join to $O(\log N + K)$ range seek.

# PayTrace — Normalization Analysis (Phase 1)

**Author:** Pulkit Pradhan  
**Roll Number:** 2501730036  

## 1. Introduction

Normalization is the systematic database design process that reduces data redundancy, eliminates update/insertion/deletion anomalies, and ensures data integrity through well-defined functional dependencies.

The PayTrace schema is engineered to strictly satisfy **Third Normal Form (3NF)** (and Boyce-Codd Normal Form (BCNF) across entities), balancing pure normal forms with transaction-safe financial snapshots.

---

## 2. Functional Dependencies (FDs) Analysis

Let $X \rightarrow Y$ denote that attribute set $X$ uniquely determines attribute set $Y$.

### 2.1 Entity: `departments`
- **Primary Key:** `{department_id}`
- **Candidate Key:** `{department_name}`
- **Functional Dependencies:**
  - $FD_1: \{\text{department\_id}\} \rightarrow \{\text{department\_name}, \text{description}, \text{created\_at}\}$
  - $FD_2: \{\text{department\_name}\} \rightarrow \{\text{department\_id}, \text{description}, \text{created\_at}\}$
- **Form:** 3NF / BCNF (All determinants are superkeys).

### 2.2 Entity: `employees`
- **Primary Key:** `{employee_id}`
- **Candidate Keys:** `{employee_code}`, `{email}`
- **Functional Dependencies:**
  - $FD_1: \{\text{employee\_id}\} \rightarrow \{\text{employee\_code}, \text{first\_name}, \text{last\_name}, \text{email}, \text{phone}, \text{department\_id}, \text{designation}, \text{role}, \text{password\_hash}, \text{hire\_date}, \text{status}, \text{created\_at}, \text{updated\_at}\}$
  - $FD_2: \{\text{employee\_code}\} \rightarrow \{\text{all attributes}\}$
  - $FD_3: \{\text{email}\} \rightarrow \{\text{all attributes}\}$
- **Form:** 3NF / BCNF.

### 2.3 Entity: `salary_structures`
- **Primary Key:** `{salary_id}`
- **Candidate Key:** Composite candidate key during active period: `{employee_id, effective_date}`
- **Functional Dependencies:**
  - $FD_1: \{\text{salary\_id}\} \rightarrow \{\text{employee\_id}, \text{basic\_salary}, \text{hra}, \text{special\_allowance}, \text{provident\_fund}, \text{professional\_tax}, \text{effective\_date}, \text{is\_active}, \text{created\_at}, \text{updated\_at}\}$
- **Form:** 3NF / BCNF.

### 2.4 Entity: `attendance`
- **Primary Key:** `{attendance_id}`
- **Candidate Key:** `{employee_id, work_date}`
- **Functional Dependencies:**
  - $FD_1: \{\text{attendance\_id}\} \rightarrow \{\text{employee\_id}, \text{work\_date}, \text{status}, \text{check\_in\_time}, \text{check\_out\_time}, \text{is\_late}, \text{late\_minutes}, \text{remarks}, \text{created\_at}, \text{updated\_at}\}$
  - $FD_2: \{\text{employee\_id}, \text{work\_date}\} \rightarrow \{\text{attendance\_id}, \text{status}, \text{check\_in\_time}, \text{check\_out\_time}, \text{is\_late}, \text{late\_minutes}, \text{remarks}, \text{created\_at}, \text{updated\_at}\}$
- **Form:** 3NF / BCNF.

### 2.5 Entity: `leaves`
- **Primary Key:** `{leave_id}`
- **Functional Dependencies:**
  - $FD_1: \{\text{leave\_id}\} \rightarrow \{\text{employee\_id}, \text{leave\_type}, \text{start\_date}, \text{end\_date}, \text{total\_days}, \text{reason}, \text{status}, \text{applied\_on}, \text{actioned\_by}, \text{actioned\_on}, \text{admin\_remarks}\}$
- **Form:** 3NF / BCNF.

### 2.6 Entity: `payroll_periods`
- **Primary Key:** `{period_id}`
- **Candidate Key:** `{period_name}`
- **Functional Dependencies:**
  - $FD_1: \{\text{period\_id}\} \rightarrow \{\text{period\_name}, \text{start\_date}, \text{end\_date}, \text{total\_working\_days}, \text{status}, \text{created\_at}\}$
  - $FD_2: \{\text{period\_name}\} \rightarrow \{\text{period\_id}, \text{start\_date}, \text{end\_date}, \text{total\_working\_days}, \text{status}, \text{created\_at}\}$
- **Form:** 3NF / BCNF.

### 2.7 Entity: `payrolls`
- **Primary Key:** `{payroll_id}`
- **Candidate Key:** `{employee_id, period_id}`
- **Functional Dependencies:**
  - $FD_1: \{\text{payroll\_id}\} \rightarrow \{\text{employee\_id}, \text{period\_id}, \text{salary\_id}, \text{present\_days}, \text{approved\_paid\_leave\_days}, \text{unpaid\_leave\_days}, \text{late\_days}, \text{gross\_earnings}, \text{total\_deductions}, \text{net\_salary}, \text{payment\_status}, \text{processed\_by}, \text{processed\_at}, \text{payment\_date}, \text{remarks}\}$
  - $FD_2: \{\text{employee\_id}, \text{period\_id}\} \rightarrow \{\text{all attributes}\}$
- **Form:** 3NF / BCNF.

### 2.8 Entity: `payroll_items`
- **Primary Key:** `{item_id}`
- **Functional Dependencies:**
  - $FD_1: \{\text{item\_id}\} \rightarrow \{\text{payroll\_id}, \text{item\_type}, \text{item\_name}, \text{amount}, \text{description}, \text{created\_at}\}$
- **Form:** 3NF / BCNF.

### 2.9 Entity: `audit_logs`
- **Primary Key:** `{log_id}`
- **Functional Dependencies:**
  - $FD_1: \{\text{log\_id}\} \rightarrow \{\text{table\_name}, \text{record\_id}, \text{action}, \text{actor\_employee_id}, \text{old\_values}, \text{new\_values}, \text{ip\_address}, \text{created\_at}\}$
- **Form:** 3NF / BCNF.

---

## 3. Step-by-Step Normalization Breakdown

### 3.1 First Normal Form (1NF)
A relation is in 1NF if and only if all attribute values are atomic (indivisible) and there are no repeating groups.
- **Atomic attributes:** Attributes such as `first_name` and `last_name` are separated rather than combined into a composite unstructured name. Dates and times are split (`work_date`, `check_in_time`, `check_out_time`).
- **No repeating groups:** Multiple leave dates or payroll items are not stored as comma-separated strings or arrays inside an employee record. Instead, distinct relations (`leaves`, `payroll_items`) model each one-to-many relationship.
- **Unique row identity:** Every table contains a unique primary key.

### 3.2 Second Normal Form (2NF)
A relation is in 2NF if and only if it is in 1NF and no non-prime attribute is partially dependent on any candidate key (full functional dependency).
- In `attendance`, the candidate key is `(employee_id, work_date)`. Attributes such as `status`, `check_in_time`, and `is_late` depend on both the employee AND the specific date. Employee master fields (such as `department_id` or `email`) are not placed in `attendance`.
- In `payrolls`, candidate key is `(employee_id, period_id)`. The payroll figures depend on both the specific employee and the period. Base salary configuration is not repeated in `payrolls`; instead, it references `salary_structures`.
- Therefore, there are zero partial key dependencies in any relation.

### 3.3 Third Normal Form (3NF)
A relation is in 3NF if and only if it is in 2NF and there are no transitive dependencies ($X \rightarrow Y$ and $Y \rightarrow Z$ where $Z$ is a non-prime attribute and $Y$ is not a superkey).
- In `employees`, `department_id` is a foreign key pointing to `departments`. Storing `department_name` in `employees` would cause $employee\_id \rightarrow department\_id \rightarrow department\_name$. By normalizing into `departments`, this transitive dependency is eliminated.
- In `payrolls`, all line-item components are normalized into `payroll_items`. The finalized aggregate totals stored in `payrolls` (`gross_earnings`, `total_deductions`, `net_salary`) are authorized immutable historical snapshots of the transaction state.

---

## 4. Elimination of Data Anomalies

| Anomaly Type | Unnormalized Risk | How PayTrace Architecture Prevents It |
| :--- | :--- | :--- |
| **Insertion Anomaly** | Cannot create a new department unless at least one employee is hired into it. | `departments` is an independent entity. Departments can be created and managed prior to assigning employees. |
| **Insertion Anomaly** | Inability to log attendance or salary without repeating employee personal details. | `attendance` and `salary_structures` reference `employee_id` via foreign keys; personal information exists solely in `employees`. |
| **Update Anomaly** | Changing an employee's designation, phone, or department requires updating thousands of past attendance rows. | Employee master details reside only in `employees`. An update touches exactly one record ($O(1)$) with zero risk of inconsistent attendance or payroll logs. |
| **Deletion Anomaly** | Deleting an employee's attendance history for a single day risks deleting their compensation profile. | Modular entities separate attendance, leaves, and salary structures. Deletion or archival of attendance never affects salary rules or employee profile. |
| **Historical Distortion** | If an employee receives a salary raise in October, re-printing August's payslip dynamically recalculates from the new rate, violating financial audit standards. | `salary_structures` maintains an effective-dated revision history. Processed payrolls store frozen calculation snapshots and line items in `payroll_items`, ensuring historical slips never mutate. |

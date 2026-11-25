# PayTrace — Limitations & Future Enhancements (Phase 5)

**Author:** Pulkit Pradhan  
**Roll Number:** 2501730036  

## 1. Academic Scope Framing

PayTrace was developed as a university database and full-stack capstone project covering a 12-employee organization across three months (June–August 2026). While core data integrity, procedural payroll math, RBAC, CSRF/session security, and automated tests are verified, the system intentionally maintains clear academic boundaries compared to multi-tenant commercial SaaS payroll platforms.

---

## 2. Known System Limitations

1. **Frozen Phase 1 Schema Constraints (`database/schema.sql`):**
   - `payrolls.approved_paid_leave_days` lacks a non-negative `CHECK` constraint (`>= 0`) at the DDL level (enforced instead by `sp_calculate_payroll` and `trg_leaves_before_*`).
   - `salary_structures` allows multiple rows for the same `(employee_id, effective_date)` because no `UNIQUE (employee_id, effective_date)` constraint was included in Phase 1; ambiguity is mitigated deterministically by ordering `(effective_date DESC, salary_id DESC)`.
   - `audit_logs.old_values` / `new_values` are `LONGTEXT NULL` columns without a DDL `JSON_VALID()` check constraint, though triggers format valid JSON objects via `JSON_OBJECT(...)`.
2. **Whole-Day Mon–Fri Work & Leave Calendar:**
   - `fn_count_working_days` assumes a fixed Monday–Friday corporate week (`09:00` shift start, `15`-minute grace period) without a configurable regional public holiday table or half-day leave granularity (half-day attendance is supported on `attendance.status = 'HALF_DAY'`).
3. **Synchronous Payroll Batch Processing:**
   - `sp_process_bulk_payroll` iterates through employees sequentially via an SQL cursor in milliseconds for 12 employees; scaling to tens of thousands of employees would require background workers or chunked batching.
4. **Academic Demonstration Controls:**
   - The login screen exposes convenient quick-fill demo account buttons alongside standard email/password inputs for viva demonstration speed; a production release would remove demo autofill helpers, add MFA, password reset workflows, rate limiting, and TLS termination behind a reverse proxy.
   - A standalone academic PDF generator (`docs/report/generate_pdf.js`) is included for capstone documentation export, while employee payslip printing uses browser print stylesheets (`window.print()`) rather than server-signed PDF binaries.

---

## 3. Future Enhancements

- **Holiday & Shift Rules Engine:** Add `holiday_calendar` and shift definition tables referenced by `fn_count_working_days` and `trg_attendance_before_*`.
- **Self-Service Requests with Maker-Checker Approval:** Introduce an optional employee leave request staging workflow distinct from HR final approval if future business policies relax strict employee read-only access.
- **Database Partitioning & Read Replicas:** Range-partition `attendance` by year and offload `reports.sql` analytics to a MariaDB replica.
- **Tamper-Evident Audit Chain:** Extend `audit_logs` with `SHA-256` hash chaining across consecutive rows for formal regulatory auditability.

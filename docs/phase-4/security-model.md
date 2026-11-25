# PayTrace — Security & RBAC Architecture (Phase 4)

**Author:** Pulkit Pradhan  
**Roll Number:** 2501730036  

## 1. Overview & Defense-in-Depth Layers

PayTrace enforces defense-in-depth across three coordinated layers:

1. **Database Least-Privilege Layer ([`database/security.sql`](../../database/security.sql)):** Separates administrative schema provisioning (`root`) from the Express runtime account (`paytrace_app` via `paytrace_app_role`) and provides an audit/view-only account (`paytrace_reader` via `paytrace_readonly_role`).
2. **Transport & Session Layer ([`src/app.js`](../../src/app.js), [`src/middleware/auth.js`](../../src/middleware/auth.js)):** Fails closed at startup if `JWT_SECRET` is missing, shorter than 32 characters, or present on the weak-secret blacklist; pins JWT signing and verification to `HS256`; issues HttpOnly session cookies (`token`) paired with double-submit `csrf_token` cookies validated via `crypto.timingSafeEqual`; sets HTTP security headers (`X-Content-Type-Options`, `X-Frame-Options`, `Referrer-Policy`); and enforces CORS origin allowlists (`403` on disallowed cross-origin calls, while always permitting same-origin `Host` requests).
3. **Application RBAC & Horizontal Isolation Layer ([`src/routes/`](../../src/routes/)):** Enforces strict separation between `HR_ADMIN` and strictly read-only `EMPLOYEE` accounts across every API endpoint.

---

## 2. Database Views, Roles & Privileges (`database/security.sql`)

### 2.1 Non-Sensitive SQL Views
Three SQL views omit `password_hash` and restrict consumers to non-sensitive projections:
- `vw_employee_self_profile` (`employees` joined with `departments`, excluding `password_hash`)
- `vw_employee_attendance_summary` (`attendance` joined with `employees.employee_code`)
- `vw_employee_payslip_summary` (`payrolls` joined with `employees.employee_code` and `payroll_periods`)

### 2.2 Least-Privilege Database Accounts

| Database User | Assigned Role | Granted Privileges | Explicitly Denied / Revoked |
| :--- | :--- | :--- | :--- |
| `paytrace_app`@`'127.0.0.1'` / `'localhost'` | `paytrace_app_role` | `SELECT` on `departments`, `payroll_periods`, and the 3 `vw_employee_*` views; `SELECT, INSERT, UPDATE` on `employees`, `salary_structures`, `attendance`, `leaves`, `payrolls`; `SELECT, INSERT` on `payroll_items`, `audit_logs`; `EXECUTE` on all 3 SPs and 3 functions | No `DROP`, `ALTER`, `CREATE`, `DELETE`, `TRUNCATE`, or global grants (`DELETE` verified blocked with `ERROR 1142`) |
| `paytrace_reader`@`'127.0.0.1'` / `'localhost'` | `paytrace_readonly_role` | `SELECT` only on `vw_employee_self_profile`, `vw_employee_attendance_summary`, `vw_employee_payslip_summary` | Raw `employees` table (protecting `password_hash`) and all write/DDL operations revoked |

---

## 3. Authentication, JWT & CSRF Architecture

1. **Password Storage:** Every seeded and newly created user has a per-user salted `bcrypt` hash (`bcryptjs`, cost factor 10) stored in `employees.password_hash`.
2. **Fail-Closed Secret Validation (`validateJwtSecret`):** Startup aborts immediately unless `JWT_SECRET` is configured cleanly with length $\ge 32$ and is not a weak/placeholder value in all environments (including test/development).
3. **Cookie-Based Session + CSRF Protection:**
   - `POST /api/auth/login` verifies credentials, checks `status === 'ACTIVE'` (`403` for inactive users), signs an `HS256` JWT (8h expiry), sets `token` as an `HttpOnly; SameSite=Lax` cookie, and sets `csrf_token` (`SameSite=Lax`) without returning the raw JWT in the JSON body.
   - `POST /api/auth/logout` clears both cookies (`token`, `csrf_token`).
   - `authenticateToken` accepts either the `token` cookie or `Authorization: Bearer <token>` and re-verifies in MariaDB that the user still exists and has `status = 'ACTIVE'`.
   - `verifyCsrf` requires state-changing cookie-authenticated requests (`POST`, `PUT`, `PATCH`, `DELETE`) to present a matching `X-CSRF-Token` header verified via `crypto.timingSafeEqual`, returning `403` on mismatch/absence.

---

## 4. Application RBAC & Endpoint Authorization Matrix

### 4.1 Middleware Primitives
- `authenticateToken`: Rejects missing/forged/expired tokens (`401`) and deactivated accounts (`403`).
- `verifyCsrf`: Protects all cookie-authenticated mutating routes (`403` on missing/mismatched `X-CSRF-Token`).
- `requireRole('HR_ADMIN')`: Blocks `EMPLOYEE` accounts with `403 Forbidden`.
- `enforceSelfOrAdmin('employeeId')`: Validates numeric `employeeId`, lets `HR_ADMIN` proceed, and requires `EMPLOYEE` callers to match `req.user.employee_id === targetId` (`403 Forbidden` otherwise).

### 4.2 Role Permission Matrix (Academic Compliance: Employee Read-Only)

| Resource / Endpoint | Method | `HR_ADMIN` | `EMPLOYEE` | Protection Mechanism |
| :--- | :---: | :---: | :---: | :--- |
| `/api/auth/login`, `/api/auth/logout` | `POST` | Public | Public | Password hash + active status + cookies |
| `/api/auth/me` | `GET` | Own session | Own session | `token` cookie / Bearer check |
| `/api/auth/dashboard` | `GET` | Scoped own summary | Scoped own summary (`EMPLOYEE` home KPIs) | `authenticateToken` |
| `/api/employees/departments`, `/api/employees` | `GET` | Allowed | **403 Blocked** | `requireRole('HR_ADMIN')` |
| `/api/employees/:employeeId` | `GET` | Allowed (any) | **Own ID only** (`403` others) | `enforceSelfOrAdmin('employeeId')` |
| `/api/employees`, `/api/employees/:employeeId` | `POST`, `PUT` | Allowed | **403 Blocked** | `verifyCsrf` + `requireRole('HR_ADMIN')` |
| `/api/salary/:employeeId` | `GET` | Allowed (any) | **Own ID only** (`403` others) | `enforceSelfOrAdmin('employeeId')` |
| `/api/salary/:employeeId` | `POST` | Allowed | **403 Blocked** | `verifyCsrf` + `requireRole('HR_ADMIN')` |
| `/api/attendance` | `GET` | Allowed (all/filtered) | **Filtered to own rows** (`403` if targeting other ID) | Route-level `req.user.role` scoping |
| `/api/attendance`, `/api/attendance/:attendanceId`, `/api/attendance/clock-in` | `POST`, `PUT` | Allowed (`clock-in` deprecated `400` or HR gated) | **403 Blocked** | `verifyCsrf` + `requireRole('HR_ADMIN')` |
| `/api/leaves` | `GET` | Allowed (all/filtered) | **Filtered to own rows** (`403` if targeting other ID) | Route-level `req.user.role` scoping |
| `/api/leaves`, `/api/leaves/:leaveId/status` | `POST`, `PUT` | Allowed (submit + approve/reject/cancel) | **403 Blocked** | `verifyCsrf` + `requireRole('HR_ADMIN')` |
| `/api/payroll/periods` | `GET` | Allowed | Allowed | `authenticateToken` |
| `/api/payroll` | `GET` | Allowed (all/filtered) | **Filtered to own rows** (`403` if targeting other ID) | Route-level `req.user.role` scoping |
| `/api/payroll/slip/:payrollId` | `GET` | Allowed (any slip) | **Own slip only** (`403` peer slip) | SQL owner check against `req.user.employee_id` |
| `/api/payroll/process`, `/api/payroll/test-rollback` | `POST` | Allowed | **403 Blocked** | `verifyCsrf` + `requireRole('HR_ADMIN')` |
| `/api/reports/*` (`dashboard-summary`, `attendance-summary`, `late-marks`, `departmental`) | `GET` | Allowed | **403 Blocked** | `requireRole('HR_ADMIN')` |
| `/api/audit-logs` | `GET` | Allowed | **403 Blocked** | `requireRole('HR_ADMIN')` |

---

## 5. Transaction Safety & Audit Logging

- **Explicit Transaction Boundaries:** Multi-step employee creation + initial salary insertion (`POST /api/employees`), salary structure rotation (`POST /api/salary/:employeeId`), single/bulk payroll computation (`sp_calculate_payroll` / `sp_process_bulk_payroll`), and rollback verification (`sp_demonstrate_transaction_rollback`) run inside explicit InnoDB `START TRANSACTION` / `COMMIT` / `ROLLBACK` blocks.
- **Session Actor Attribution:** Express transaction helpers set `SET @app_actor_id = ?` before salary/employee DML and invoke `sp_calculate_payroll(..., actor_id)` so database triggers (`trg_salary_after_insert`, `trg_salary_after_update`, `trg_payrolls_after_insert`) record accurate actor attribution in `audit_logs`.
- **SQL Injection Prevention:** `multipleStatements` is disabled (`false`) in `src/config/db.js`, and every query across all route modules uses parameterized `?` bindings (`dateStrings: ['DATE']` avoids JS UTC date shifts).

# PayTrace — Security & Access Control Model (Phase 4)

**Author:** Pulkit Pradhan  
**Roll Number:** 2501730036  

## 1. Overview & Security Philosophy

The PayTrace platform is designed with defense-in-depth, enforcing role-based access control (RBAC), data isolation, transaction safety, and auditability at both the database and application layers.

The architecture ensures that sensitive payroll records, salary structures, and attendance summaries cannot be accessed or manipulated without strict server-side authorization.

---

## 2. Role-Based Access Control (RBAC) Matrix

| Resource / Action | Endpoint / Operation | HR / Admin | Employee | Enforcement Mechanism |
| :--- | :--- | :---: | :---: | :--- |
| **Authenticate / Login** | `POST /api/auth/login` | Allow | Allow | `authService` + Bcrypt verification |
| **View Own Profile** | `GET /api/employees/me` | Allow | Allow | Resolved from verified JWT (`req.user.employee_id`) |
| **List All Employees** | `GET /api/employees` | Allow | Deny (403) | `requireRole('HR_ADMIN')` |
| **Create New Employee** | `POST /api/employees` | Allow | Deny (403) | `requireRole('HR_ADMIN')` |
| **View Salary Structure** | `GET /api/salary/:employeeId` | Allow | Self-Only (403 if other) | `enforceSelfOrAdmin('employeeId')` |
| **Update Salary Structure** | `PUT /api/salary/:employeeId` | Allow | Deny (403) | `requireRole('HR_ADMIN')` + DB trigger audit |
| **Log Own Attendance** | `POST /api/attendance/check-in` | Allow | Self-Only | Resolved from verified JWT |
| **View Attendance Logs** | `GET /api/attendance/:employeeId` | Allow | Self-Only (403 if other) | `enforceSelfOrAdmin('employeeId')` |
| **Submit Leave Request** | `POST /api/leaves` | Allow | Self-Only | Resolved from verified JWT |
| **Review / Action Leave** | `PUT /api/leaves/:leaveId/status` | Allow | Deny (403) | `requireRole('HR_ADMIN')` |
| **Execute Payroll Cycle** | `POST /api/payroll/calculate` | Allow | Deny (403) | `requireRole('HR_ADMIN')` + DB Stored Procedure |
| **View Any Salary Slip** | `GET /api/payroll/slip/:id` | Allow | Self-Only (403 if other) | `enforceSelfOrAdmin` + Ownership validation |
| **Generate Reports** | `GET /api/reports/*` | Allow | Deny (403) | `requireRole('HR_ADMIN')` |
| **View Audit Trail** | `GET /api/audit-logs` | Allow | Deny (403) | `requireRole('HR_ADMIN')` |

---

## 3. Server-Side Identity Resolution & Anti-Tampering

1. **Token-Based Authentication:**
   - Identity is verified via JSON Web Tokens (JWT) signed with a secure server-side secret (`JWT_SECRET`).
   - Every request is validated by `authenticateToken` middleware.
2. **Prevention of Insecure Direct Object References (IDOR):**
   - The application **never trusts** client-provided employee IDs in headers, query parameters, or request bodies.
   - For all self-service operations (viewing attendance, viewing payslips, applying for leave), the target `employee_id` is derived directly from the decoded JWT session (`req.user.employee_id`).
   - If an employee manually alters a URL parameter (e.g. `/api/payroll/slip?employeeId=2`), the `enforceSelfOrAdmin` middleware intercepts the request and terminates it with `403 Forbidden`.
3. **Password Security:**
   - Passwords are encrypted using standard `bcrypt` hashing with 10 salt rounds. Plaintext passwords are never persisted or output in logs.

---

## 4. Transaction Integrity & Audit Logging

1. **ACID Transaction Safeguards:**
   - Payroll generation is wrapped in database transactions (`START TRANSACTION` / `COMMIT`).
   - If an error or constraint violation occurs (such as negative salary or invalid calculation), an `EXIT HANDLER FOR SQLEXCEPTION` automatically executes `ROLLBACK`, guaranteeing zero partial or orphaned rows.
2. **Audit Trail Persistence:**
   - Sensitive modifications (salary adjustments, payroll disbursements) automatically trigger database audit entries in `audit_logs`.
   - Each audit entry records the table name, record ID, DML action (`INSERT`/`UPDATE`), authenticated actor, old values (JSON), and new values (JSON).

---

## 5. Security Limitations & Production Considerations

1. **Single-Node In-Memory Token Revocation:** In this single-student deployment, JWT tokens remain valid until expiration. In a multi-server enterprise environment, a shared Redis cache or database blocklist should be introduced for immediate token invalidation on password change or termination.
2. **Rate Limiting:** API endpoints currently rely on standard web server protections. In production, an express-rate-limit middleware should be configured on the login route to defend against automated brute-force attacks.
3. **Row-Level Security (RLS):** MariaDB enforces access control at the table and view levels, while tenant-level and employee-level data isolation is enforced through server-side middleware and stored procedures.

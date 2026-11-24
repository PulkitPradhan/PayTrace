# PayTrace — Engineering Limitations & Future Roadmap (Phase 5)

**Author:** Pulkit Pradhan  
**Roll Number:** 2501730036  

## 1. Scope & Academic Disclosure

PayTrace was built as an individual academic capstone project to demonstrate mastery of relational database design, stored SQL programming, transaction safety, query optimization, security, and full-stack integration within an achievable student scope.

In accordance with strict engineering ethics, this document openly discloses the technical boundaries, simplifications, and limitations of the current implementation.

---

## 2. Identified Limitations

### 2.1 Shift Scheduling & Attendance Modeling
- **Current Model:** Evaluates attendance against a standard organization-wide shift starting at 09:00:00 with a 15-minute grace threshold (09:15:00).
- **Limitation:** Does not support complex rotational shift work, variable flex-time agreements, split shifts, or overnight night-shifts spanning across midnight calendar boundaries.

### 2.2 Taxation & Statutory Compliance
- **Current Model:** Implements a transparent, explainable progressive academic bracket for Income Tax (TDS), flat Professional Tax, and fixed Provident Fund contributions.
- **Limitation:** Does not model jurisdiction-specific statutory complexities, such as local municipal tax variations, pre-tax voluntary insurance deductions, or complex tax exemptions under diverse legal codes.

### 2.3 Concurrent Session Revocation
- **Current Model:** Relies on stateless JWT tokens signed with a server secret (`JWT_SECRET`) with an 8-hour expiration window.
- **Limitation:** Immediate token revocation upon user termination or permission downgrade requires querying the database on each request. A production deployment would introduce an in-memory distributed cache (e.g. Redis) for sub-millisecond session invalidation.

### 2.4 Browser-Level Reporting vs Automated PDF Generation
- **Current Model:** The web interface renders responsive printable HTML salary slips utilizing CSS print media stylesheets.
- **Limitation:** Direct server-side PDF stream compilation (e.g. using headless Chromium / Puppeteer) is omitted to minimize third-party runtime binary dependencies.

---

## 3. Future Roadmap

1. **Shift Management Engine:** Introduce `shift_schedules` and `employee_shifts` entities to allow departments to configure custom shift windows and flexible lunch break intervals.
2. **Direct Bank Interface (NACH / ACH):** Generate ISO 20022 compliant automated clearing house transaction files for batch salary disbursement.
3. **Biometric Hardware Integration:** Provide RESTful IoT webhooks to synchronize check-in events directly from physical fingerprint and RFID card turnstiles.
4. **Enhanced Self-Service Expense Claims:** Allow employees to submit reimbursement requests with receipt attachments that automatically integrate into the monthly payroll itemization.

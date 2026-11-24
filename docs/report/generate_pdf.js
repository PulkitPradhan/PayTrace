/**
 * PayTrace Academic Project Report PDF Generator
 * Uses Chromium DevTools Protocol (CDP) for high-fidelity A4 PDF rendering
 * Zero external dependencies: pure Node.js v26 + Chromium
 */

const fs = require('fs');
const path = require('path');
const { spawn } = require('child_process');
const http = require('http');

const ROOT_DIR = path.resolve(__dirname, '../..');
const REPORT_DIR = path.resolve(__dirname);
const HTML_PATH = path.join(REPORT_DIR, 'PayTrace_Project_Report.html');
const PDF_PATH = path.join(REPORT_DIR, 'PayTrace_Project_Report.pdf');

// Helper: Convert local image to base64 data URI
function getBase64Image(relPath) {
  const fullPath = path.join(ROOT_DIR, relPath);
  if (!fs.existsSync(fullPath)) {
    throw new Error(`Asset not found: ${fullPath}`);
  }
  const ext = path.extname(fullPath).toLowerCase().replace('.', '');
  const mime = ext === 'svg' ? 'image/svg+xml' : `image/${ext}`;
  const data = fs.readFileSync(fullPath).toString('base64');
  return `data:${mime};base64,${data}`;
}

console.log('1. Loading visual assets for embedding...');
const IMAGES = {
  archDiagram: getBase64Image('docs/assets/diagrams/system-architecture.png'),
  erDiagram: getBase64Image('docs/assets/diagrams/er-diagram.png'),
  workflowDiagram: getBase64Image('docs/assets/diagrams/payroll-transaction-workflow.png'),
  login: getBase64Image('docs/assets/screenshots/01-login.png'),
  hrDashboard: getBase64Image('docs/assets/screenshots/02-hr-dashboard.png'),
  empDashboard: getBase64Image('docs/assets/screenshots/03-employee-dashboard.png'),
  roster: getBase64Image('docs/assets/screenshots/04-employee-roster.png'),
  attendance: getBase64Image('docs/assets/screenshots/05-attendance-management.png'),
  leave: getBase64Image('docs/assets/screenshots/06-leave-workflow.png'),
  payroll: getBase64Image('docs/assets/screenshots/07-payroll-processing.png'),
  payslip: getBase64Image('docs/assets/screenshots/08-itemized-salary-slip.png'),
  attReport: getBase64Image('docs/assets/screenshots/09-monthly-attendance-report.png'),
  lateReport: getBase64Image('docs/assets/screenshots/10-late-marks-report.png'),
  rbacDenial: getBase64Image('docs/assets/screenshots/11-access-denied-behavior.png')
};

console.log('2. Constructing publication-grade HTML document...');

const HTML_CONTENT = `<!DOCTYPE html>
<html lang="en">
<head>
<meta charset="UTF-8">
<title>PayTrace — Payroll & Attendance Management System | Academic Project Report</title>
<style>
@page {
  size: A4 portrait;
  margin: 20mm 18mm 20mm 18mm;
}

@page :first {
  margin: 0;
}

* {
  box-sizing: border-box;
}

body {
  font-family: -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, "Helvetica Neue", Arial, sans-serif;
  color: #1e293b;
  font-size: 9.5pt;
  line-height: 1.5;
  margin: 0;
  padding: 0;
}

/* Page Break Controls */
.page-break {
  page-break-before: always;
}

.avoid-break {
  page-break-inside: avoid;
}

/* Typography */
h1.report-title {
  font-size: 26pt;
  font-weight: 800;
  color: #0f172a;
  line-height: 1.2;
  margin-bottom: 8pt;
}

h2.report-subtitle {
  font-size: 14pt;
  font-weight: 500;
  color: #0284c7;
  line-height: 1.4;
  margin-top: 0;
  margin-bottom: 24pt;
}

h1.chapter-title {
  font-size: 18pt;
  font-weight: 700;
  color: #0f172a;
  border-bottom: 2px solid #0284c7;
  padding-bottom: 4pt;
  margin-top: 0;
  margin-bottom: 12pt;
}

h2.section-title {
  font-size: 13pt;
  font-weight: 600;
  color: #1e293b;
  margin-top: 14pt;
  margin-bottom: 6pt;
  border-left: 3px solid #0284c7;
  padding-left: 6pt;
}

h3.sub-title {
  font-size: 10.5pt;
  font-weight: 600;
  color: #334155;
  margin-top: 10pt;
  margin-bottom: 4pt;
}

p {
  margin-top: 0;
  margin-bottom: 8pt;
  text-align: justify;
}

ul, ol {
  margin-top: 0;
  margin-bottom: 8pt;
  padding-left: 18pt;
}

li {
  margin-bottom: 3pt;
}

/* Tables */
table {
  width: 100%;
  border-collapse: collapse;
  margin: 8pt 0 12pt 0;
  font-size: 8.5pt;
  page-break-inside: avoid;
}

th {
  background-color: #0f172a;
  color: #ffffff;
  font-weight: 600;
  text-align: left;
  padding: 5pt 7pt;
  border: 1px solid #0f172a;
}

td {
  padding: 4.5pt 7pt;
  border: 1px solid #cbd5e1;
  vertical-align: top;
}

tr:nth-child(even) {
  background-color: #f8fafc;
}

/* Code Blocks */
pre, code {
  font-family: "JetBrains Mono", Consolas, "Liberation Mono", Menlo, Courier, monospace;
}

pre {
  background: #f1f5f9;
  border: 1px solid #cbd5e1;
  border-radius: 4px;
  padding: 6pt 8pt;
  font-size: 7.8pt;
  line-height: 1.35;
  overflow-x: auto;
  margin: 6pt 0 10pt 0;
  page-break-inside: avoid;
}

code {
  background: #f1f5f9;
  padding: 1pt 3pt;
  border-radius: 3px;
  font-size: 8.5pt;
  color: #0f172a;
}

pre code {
  background: none;
  padding: 0;
  font-size: 7.8pt;
}

/* Figures */
.figure-container {
  text-align: center;
  margin: 10pt 0 14pt 0;
  page-break-inside: avoid;
}

.figure-container img {
  max-width: 95%;
  max-height: 220px;
  border: 1px solid #cbd5e1;
  border-radius: 4px;
  box-shadow: 0 2px 4px rgba(0,0,0,0.06);
}

.figure-container.large-fig img {
  max-height: 310px;
}

.caption {
  font-size: 8pt;
  color: #475569;
  font-style: italic;
  margin-top: 3pt;
  text-align: center;
}

/* Callout Boxes */
.callout {
  padding: 8pt 12pt;
  margin: 8pt 0 12pt 0;
  border-radius: 4px;
  font-size: 8.5pt;
  line-height: 1.45;
  page-break-inside: avoid;
}

.callout-info {
  background: #eff6ff;
  border-left: 4px solid #2563eb;
  color: #1e3a8a;
}

.callout-success {
  background: #f0fdf4;
  border-left: 4px solid #16a34a;
  color: #14532d;
}

.callout-warning {
  background: #fffbeb;
  border-left: 4px solid #d97706;
  color: #78350f;
}

/* Cover Page */
.cover-page {
  padding: 35mm 20mm 20mm 20mm;
  height: 297mm;
  display: flex;
  flex-direction: column;
  justify-content: space-between;
  text-align: center;
}

.cover-header {
  margin-top: 10mm;
}

.cover-badge {
  display: inline-block;
  background: #0284c7;
  color: #ffffff;
  padding: 4pt 12pt;
  border-radius: 12pt;
  font-size: 9pt;
  font-weight: 600;
  letter-spacing: 0.5px;
  text-transform: uppercase;
  margin-bottom: 16pt;
}

.cover-meta-grid {
  display: grid;
  grid-template-columns: 1fr 1fr;
  gap: 15pt;
  text-align: left;
  background: #f8fafc;
  border: 1px solid #e2e8f0;
  border-radius: 6px;
  padding: 14pt 18pt;
  margin: 25mm 0;
  font-size: 9pt;
}

.cover-meta-item strong {
  display: block;
  color: #64748b;
  font-size: 7.5pt;
  text-transform: uppercase;
  letter-spacing: 0.5px;
  margin-bottom: 2pt;
}

.cover-footer {
  border-top: 1px solid #e2e8f0;
  padding-top: 12pt;
  font-size: 8pt;
  color: #64748b;
}

/* Formal Placeholders */
.signature-box {
  margin-top: 25pt;
  display: flex;
  justify-content: space-between;
}

.sig-line {
  width: 45%;
  border-top: 1px solid #475569;
  padding-top: 4pt;
  font-size: 8.5pt;
  color: #334155;
  text-align: center;
}

/* TOC */
.toc-list {
  list-style: none;
  padding-left: 0;
  font-size: 7.7pt;
  margin-bottom: 0;
}

.toc-item {
  display: flex;
  justify-content: space-between;
  padding: 0.9pt 0;
  border-bottom: 1px dotted #cbd5e1;
}

.toc-item.level-1 {
  font-weight: 700;
  color: #0f172a;
  padding-top: 2pt;
}

.toc-item.level-2 {
  padding-left: 10pt;
  color: #334155;
}

.formula-box {
  background: #f8fafc;
  border: 1px solid #e2e8f0;
  border-radius: 4px;
  padding: 8pt 14pt;
  text-align: center;
  font-family: "Cambria Math", "Times New Roman", serif;
  font-size: 11pt;
  margin: 8pt 0;
  color: #0f172a;
  page-break-inside: avoid;
}
</style>
</head>
<body>

<!-- COVER PAGE -->
<div class="cover-page">
  <div class="cover-header">
    <div class="cover-badge">Academic Capstone Project Report</div>
    <h1 class="report-title">PAYTRACE</h1>
    <h2 class="report-subtitle">Payroll &amp; Attendance Management System</h2>
    <p style="font-size: 11pt; color: #475569; max-width: 85%; margin: 0 auto;">
      A Transparent, Auditable, and Transaction-Safe Relational Platform Engineered for Explainable Salary Computations, Temporal Guardrails, and Strict Role-Based Data Isolation
    </p>
  </div>

  <div class="cover-meta-grid">
    <div class="cover-meta-item">
      <strong>Candidate / Author</strong>
      Pulkit Pradhan<br/>
      <span style="font-size: 8pt; color: #64748b;">Roll No: 2501730036 • GitHub: github.com/PulkitPradhan/PayTrace</span>
    </div>
    <div class="cover-meta-item">
      <strong>Academic Year / Term</strong>
      Academic Year 2025–2026<br/>
      <span style="font-size: 8pt; color: #64748b;">Evaluation Rubric: 100 Marks Capstone</span>
    </div>
    <div class="cover-meta-item">
      <strong>Degree &amp; Department</strong>
      [Department of Computer Science &amp; Engineering]<br/>
      <span style="font-size: 8pt; color: #64748b;">[Bachelor of Technology / Equivalent Degree]</span>
    </div>
    <div class="cover-meta-item">
      <strong>Institutional Affiliation</strong>
      [Institution / University Name Placeholder]<br/>
      <span style="font-size: 8pt; color: #64748b;">[Faculty Supervisor / Project Guide Placeholder]</span>
    </div>
  </div>

  <div class="cover-footer">
    <strong>PayTrace: Enterprise Database Engineering &amp; Full-Stack Architecture</strong><br/>
    Document Reference: CAPSTONE-REPORT-2026-FINAL • MariaDB 13 (InnoDB) • Node.js v26 • Express.js 5
  </div>
</div>

<!-- CERTIFICATE & DECLARATION -->
<div class="page-break">
  <h1 class="chapter-title">Certificate of Academic Authenticity</h1>
  <p><em>(Template requiring authorized institutional completion)</em></p>
  <p>
    This is to certify that the capstone project report entitled <strong>"PayTrace: Payroll &amp; Attendance Management System"</strong>, submitted by <strong>Pulkit Pradhan</strong> (Roll No: 2501730036) in partial fulfillment of the requirements for the degree of <strong>[Bachelor of Technology in Computer Science &amp; Engineering / Equivalent Degree]</strong>, is an authentic record of academic engineering work conducted during the 2025–2026 academic year.
  </p>
  <p>
    The relational data modeling (3NF/BCNF), procedural business logic (stored routines and validation triggers), analytical query optimization, role-based access control, and full-stack implementation presented in this document represent the verified technical work of the candidate.
  </p>

  <div class="signature-box" style="margin-top: 40pt;">
    <div class="sig-line">
      <strong>[Supervisor / Project Guide Name]</strong><br/>
      Faculty Project Guide<br/>
      Department of Computer Science &amp; Engineering
    </div>
    <div class="sig-line">
      <strong>[Head of Department / Program Chair]</strong><br/>
      Head of Department<br/>
      [Institution / University Name]
    </div>
  </div>

  <div style="margin-top: 50pt;">
    <h1 class="chapter-title">Student Declaration</h1>
    <p>
      I, <strong>Pulkit Pradhan</strong>, hereby declare that the capstone project entitled <strong>"PayTrace: Payroll &amp; Attendance Management System"</strong> is an authentic presentation of my own individual software engineering and database design work.
    </p>
    <p>
      I affirm that:
    </p>
    <ul>
      <li>All database schemas, stored routines, triggers, middleware functions, and client controllers were implemented and verified as described.</li>
      <li>All test logs, execution plans, and figures reflect authentic local execution against the MariaDB and Express runtime environment.</li>
      <li>No hardcoded production credentials, live secrets, or unauthorized personal data have been published in this report or committed to version control.</li>
      <li>Appropriate academic citations and bibliographic references have been provided for all external literature and software specifications.</li>
    </ul>

    <div class="signature-box" style="margin-top: 35pt;">
      <div class="sig-line">
        <strong>Pulkit Pradhan</strong><br/>
        Roll No: 2501730036<br/>
        Candidate / Lead Engineer<br/>
        Date: November 18, 2026
      </div>
    </div>
  </div>
</div>

<!-- ACKNOWLEDGEMENTS & ABSTRACT -->
<div class="page-break">
  <h1 class="chapter-title">Acknowledgements</h1>
  <p>
    I express my profound gratitude to my academic project supervisor, <strong>[Supervisor Name Placeholder]</strong>, for continuous guidance, rigorous critique, and technical direction throughout the architecture, database design, and evaluation phases of PayTrace.
  </p>
  <p>
    I am equally indebted to the faculty of the <strong>Department of Computer Science &amp; Engineering</strong> at <strong>[Institution / University Name]</strong> for providing the conceptual foundations in relational database theory, database normalization, concurrency control, and distributed systems.
  </p>
  <p>
    Finally, I acknowledge the engineering contributions of the open-source community behind MariaDB, Node.js, Express.js, Chromium, and Linux, whose tooling made this project possible.
  </p>

  <div style="margin-top: 30pt;">
    <h1 class="chapter-title">Abstract</h1>
    <p>
      In enterprise resource planning (ERP), payroll and attendance management systems constitute mission-critical software infrastructure. Deficiencies in relational modeling, inadequate concurrency controls, and opaque salary calculations routinely produce severe operational failures: phantom disbursements, overlapping leave scheduling conflicts, retroactive compensation tampering, and insecure direct object reference (IDOR) vulnerabilities.
    </p>
    <p>
      This report presents <strong>PayTrace</strong>, an individual academic capstone project engineered to resolve these challenges through a transparent, auditable, and transaction-safe platform. Built on a 3-tier architecture utilizing <strong>MariaDB 13 (InnoDB)</strong>, <strong>Node.js v26</strong>, and <strong>Express.js 5</strong>, PayTrace demonstrates engineering across five academic phases:
    </p>
    <ol>
      <li><strong>Relational Schema Modeling (Phase 1):</strong> A 9-table normalized relational schema strictly satisfying 3NF and BCNF, with declarative check constraints and foreign-key referential actions.</li>
      <li><strong>Procedural Business Logic (Phase 2):</strong> Deterministic stored functions (<code>fn_calculate_daily_rate</code>, <code>fn_calculate_monthly_tds</code>), bulk processing procedures with explicit cursor iteration (<code>sp_process_bulk_payroll</code>), and validation triggers intercepting duplicate attendance and overlapping leaves.</li>
      <li><strong>Analytical Reporting &amp; Optimization (Phase 3):</strong> Three multi-table reports optimized via a targeted composite index (<code>idx_attendance_late_lookup</code>), which eliminates temporary tables and reduces query execution cost by <strong>66.7%</strong>.</li>
      <li><strong>Security &amp; Role-Based Access Control (Phase 4):</strong> Dual-role security (<code>HR_ADMIN</code> vs. <code>EMPLOYEE</code>) with salted 10-round Bcrypt password hashing, stateless JWT session tokens, and route-level authorization middleware (<code>enforceSelfOrAdmin</code>) that blocks horizontal privilege escalation.</li>
      <li><strong>Full-Stack Single-Page Application (Phase 5):</strong> An intuitive web interface providing distinct role dashboards, a live web punch clock, leave management, and an itemized payslip voucher with CSS print layout.</li>
    </ol>
    <p>
      All functionality is verified across 12 employees over three consecutive months (792 daily attendance logs, 36 finalized payroll statements). An automated test suite executing 20 rubric test cases passes with 100% success (20/20), confirming data isolation, transaction rollback safety (zero ghost records on constraint failure), and formula precision.
    </p>
  </div>
</div>

<!-- TABLE OF CONTENTS -->
<div class="page-break">
  <h1 class="chapter-title">Table of Contents</h1>
  <ul class="toc-list">
    <li class="toc-item level-1"><span>1. Introduction &amp; Project Overview</span><span>Page 5</span></li>
    <li class="toc-item level-2"><span>1.1 Project Identity &amp; System Background</span><span>Page 5</span></li>
    <li class="toc-item level-2"><span>1.2 Problem Statement &amp; Industry Challenges</span><span>Page 5</span></li>
    <li class="toc-item level-2"><span>1.3 Primary Objectives &amp; System Scope</span><span>Page 5</span></li>
    <li class="toc-item level-1"><span>2. Requirements Analysis</span><span>Page 5</span></li>
    <li class="toc-item level-2"><span>2.1 Functional Requirements Matrix (FR-1 to FR-7)</span><span>Page 5</span></li>
    <li class="toc-item level-2"><span>2.2 Non-Functional Requirements &amp; Constraints</span><span>Page 6</span></li>
    <li class="toc-item level-1"><span>3. Technology Stack &amp; Architectural Rationale</span><span>Page 7</span></li>
    <li class="toc-item level-2"><span>3.1 Technology Stack Matrix &amp; Versions</span><span>Page 7</span></li>
    <li class="toc-item level-2"><span>3.2 Relational Model vs. NoSQL Justification</span><span>Page 7</span></li>
    <li class="toc-item level-1"><span>4. System Architecture</span><span>Page 7</span></li>
    <li class="toc-item level-2"><span>4.1 3-Tier Enterprise Architectural Model</span><span>Page 7</span></li>
    <li class="toc-item level-2"><span>4.2 Security Pipeline &amp; Database Engine Tier</span><span>Page 8</span></li>
    <li class="toc-item level-1"><span>5. Relational Database Design</span><span>Page 9</span></li>
    <li class="toc-item level-2"><span>5.1 Entity-Relationship Model &amp; Cardinalities</span><span>Page 9</span></li>
    <li class="toc-item level-2"><span>5.2 Complete Data Dictionary (9 Normalized Tables)</span><span>Page 9</span></li>
    <li class="toc-item level-2"><span>5.3 Relational Normalization Proof (3NF &amp; BCNF)</span><span>Page 11</span></li>
    <li class="toc-item level-1"><span>6. Payroll Calculation Methodology &amp; Mathematics</span><span>Page 12</span></li>
    <li class="toc-item level-2"><span>6.1 Mathematical Formulations (Daily Rate, TDS, Penalties)</span><span>Page 12</span></li>
    <li class="toc-item level-2"><span>6.2 Worked Examples &amp; Discrepancy Reconciliation</span><span>Page 13</span></li>
    <li class="toc-item level-1"><span>7. Attendance &amp; Leave Workflows</span><span>Page 14</span></li>
    <li class="toc-item level-2"><span>7.1 Daily Attendance Lifecycle &amp; Punctuality Engine</span><span>Page 14</span></li>
    <li class="toc-item level-2"><span>7.2 Database Triggers for Overlap Prevention</span><span>Page 14</span></li>
    <li class="toc-item level-1"><span>8. Security &amp; Role-Based Access Control</span><span>Page 14</span></li>
    <li class="toc-item level-2"><span>8.1 Dual-Role Security Model &amp; JWT Pipeline</span><span>Page 14</span></li>
    <li class="toc-item level-2"><span>8.2 Anti-Tampering Middleware &amp; Audit Trail</span><span>Page 14</span></li>
    <li class="toc-item level-1"><span>9. Transaction Management &amp; ACID Safety</span><span>Page 14</span></li>
    <li class="toc-item level-2"><span>9.1 Atomic Payroll Transactions &amp; Rollback Proof</span><span>Page 14</span></li>
    <li class="toc-item level-1"><span>10. Analytical Reports &amp; Query Optimization</span><span>Page 15</span></li>
    <li class="toc-item level-2"><span>10.1 Reports Implementation (Attendance, Slip, Late Marks)</span><span>Page 15</span></li>
    <li class="toc-item level-2"><span>10.2 Before/After EXPLAIN Analysis (66.7% Cost Reduction)</span><span>Page 15</span></li>
    <li class="toc-item level-1"><span>11. Application Implementation</span><span>Page 15</span></li>
    <li class="toc-item level-1"><span>12. User Interface Evidence &amp; Visual Gallery</span><span>Page 16</span></li>
    <li class="toc-item level-1"><span>13. Testing, Quality Assurance &amp; Rubric Matrix</span><span>Page 20</span></li>
    <li class="toc-item level-1"><span>14. Deployment, Setup &amp; Evaluator Guide</span><span>Page 20</span></li>
    <li class="toc-item level-1"><span>15. Discussion, Limitations &amp; Conclusion</span><span>Page 21</span></li>
    <li class="toc-item level-1"><span>16. References &amp; Appendices</span><span>Page 21</span></li>
  </ul>
</div>

<!-- CHAPTER 1 & 2 -->
<div class="page-break">
  <h1 class="chapter-title">Chapter 1: Introduction &amp; Project Overview</h1>
  
  <h2 class="section-title">1.1 Project Identity &amp; System Background</h2>
  <p>
    <strong>PayTrace</strong> is an individual academic capstone project developed under the theme <em>"Payroll &amp; Attendance Management System"</em>. The platform provides an auditable, transparent payroll framework that accurately calculates employee compensation, logs daily attendance and leave, and prevents invalid or conflicting operations through database-enforced integrity rules.
  </p>

  <h2 class="section-title">1.2 Problem Statement &amp; Industry Challenges</h2>
  <p>
    Enterprise payroll workflows operate in high-risk operational environments where subtle computational discrepancies produce severe legal, tax, and labor liabilities:
  </p>
  <ul>
    <li><strong>Black-Box Salary Calculations:</strong> Legacy software frequently disburses salaries without explaining deductions. Workers cannot independently audit how late marks, unpaid leave days, and progressive tax brackets were computed.</li>
    <li><strong>Data Corruption from Failed Batches:</strong> When processing payroll across large organizations, unhandled database exceptions often trigger partial batch commits, producing duplicate payouts or orphaned records.</li>
    <li><strong>Temporal Scheduling Conflicts:</strong> Weak schema designs allow overlapping leave requests or duplicate daily attendance check-ins, creating contradictory records.</li>
    <li><strong>Retroactive Snapshot Tampering:</strong> Modifying an employee's salary package should affect only future disbursements. Unsound database schemas recalculate historical payslips using the updated rate, corrupting tax records.</li>
    <li><strong>Broken Object-Level Authorization (IDOR):</strong> Flawed API route logic allows general employees to tamper with query strings (e.g., <code>?employeeId=4</code>) and view peer salaries.</li>
  </ul>

  <h2 class="section-title">1.3 Primary Objectives &amp; System Scope</h2>
  <p>
    PayTrace resolves these vulnerabilities through four technical pillars:
  </p>
  <ol>
    <li><strong>Normalized Relational Core:</strong> 9 entities in Third Normal Form (3NF) and Boyce-Codd Normal Form (BCNF).</li>
    <li><strong>In-Database Procedural Logic:</strong> Deterministic stored routines and ACID-compliant transactions executing atomic payroll disbursements with verified rollback safety.</li>
    <li><strong>Temporal Guardrails:</strong> Engine-level triggers intercepting duplicate attendance and overlapping leaves.</li>
    <li><strong>Server-Side Role Isolation:</strong> Complete separation between <code>HR_ADMIN</code> and <code>EMPLOYEE</code> personas.</li>
  </ol>

  <h1 class="chapter-title" style="margin-top: 20pt;">Chapter 2: Requirements Analysis</h1>

  <h2 class="section-title">2.1 Functional Requirements Matrix</h2>
  <table>
    <tr>
      <th style="width: 15%;">Req ID</th>
      <th style="width: 25%;">Module</th>
      <th style="width: 60%;">Requirement Specification</th>
    </tr>
    <tr>
      <td><strong>FR-1</strong></td>
      <td>Employee Management</td>
      <td>Store personnel demographic, organizational department, role, and compensation package with unique code and email constraints.</td>
    </tr>
    <tr>
      <td><strong>FR-2</strong></td>
      <td>Compensation Profiles</td>
      <td>Maintain base salary, house rent allowance (HRA), special allowance, provident fund (PF), and professional tax (PT) with domain check constraints (<code>chk &gt;= 0</code>).</td>
    </tr>
    <tr>
      <td><strong>FR-3</strong></td>
      <td>Daily Attendance</td>
      <td>Log daily clock-in/out timestamps, calculate late minutes beyond 15-minute grace threshold, and prevent duplicate daily records via composite unique keys.</td>
    </tr>
    <tr>
      <td><strong>FR-4</strong></td>
      <td>Leave State Machine</td>
      <td>Support leave submission, day counting, date boundary validation, and trigger-enforced overlap rejection.</td>
    </tr>
    <tr>
      <td><strong>FR-5</strong></td>
      <td>Payroll Processing</td>
      <td>Execute monthly payroll cycles via atomic procedure (<code>sp_calculate_payroll</code>), applying daily rates, unpaid leave deductions, late arrival penalties, and progressive TDS.</td>
    </tr>
    <tr>
      <td><strong>FR-6</strong></td>
      <td>Analytical Reports</td>
      <td>Generate Monthly Attendance Summary, Itemized Salary Slip Voucher, and Late-Marks Analytical Report.</td>
    </tr>
    <tr>
      <td><strong>FR-7</strong></td>
      <td>Security Audit Trail</td>
      <td>Capture data mutations in an immutable audit ledger with before-and-after JSON state snapshots.</td>
    </tr>
  </table>

  <h2 class="section-title">2.2 Non-Functional Requirements &amp; Academic Constraints</h2>
  <ul>
    <li><strong>ACID Concurrency &amp; Rollback:</strong> Stored procedures must utilize <code>START TRANSACTION</code>, <code>COMMIT</code>, and <code>ROLLBACK</code> via <code>SQLEXCEPTION</code> handlers.</li>
    <li><strong>Index Optimization:</strong> Analytical reporting queries must utilize composite indexing to eliminate filesort and temporary tables on disk.</li>
    <li><strong>Strict RBAC &amp; Anti-IDOR:</strong> General employees must be restricted to their own authorized records; cross-employee access attempts must return <code>HTTP 403 Forbidden</code>.</li>
  </ul>
</div>

<!-- CHAPTER 3 & 4 -->
<div class="page-break">
  <h1 class="chapter-title">Chapter 3: Technology Stack &amp; Architectural Rationale</h1>
  
  <h2 class="section-title">3.1 Technology Stack Matrix</h2>
  <table>
    <tr>
      <th style="width: 22%;">Layer</th>
      <th style="width: 28%;">Technology</th>
      <th style="width: 15%;">Version</th>
      <th style="width: 35%;">Engineering Rationale</th>
    </tr>
    <tr>
      <td><strong>Database Engine</strong></td>
      <td>MariaDB Server (InnoDB)</td>
      <td><code>13.0.2</code></td>
      <td>ACID compliance, declarative check constraints, row-level locking, and stored programs.</td>
    </tr>
    <tr>
      <td><strong>Runtime</strong></td>
      <td>Node.js (LTS)</td>
      <td><code>v26.13.0</code></td>
      <td>Asynchronous non-blocking I/O event loop, high concurrent HTTP throughput.</td>
    </tr>
    <tr>
      <td><strong>Application Framework</strong></td>
      <td>Express.js</td>
      <td><code>5.2.1</code></td>
      <td>Minimalist middleware chaining, robust routing pipeline, and error handling.</td>
    </tr>
    <tr>
      <td><strong>Database Driver</strong></td>
      <td><code>mysql2/promise</code></td>
      <td><code>3.16.0</code></td>
      <td>High-performance connection pooling, prepared statements, multi-statement support.</td>
    </tr>
    <tr>
      <td><strong>Password Hashing</strong></td>
      <td><code>bcryptjs</code></td>
      <td><code>3.0.3</code></td>
      <td>10-round salted key derivation to protect credentials against rainbow tables.</td>
    </tr>
    <tr>
      <td><strong>Authentication</strong></td>
      <td><code>jsonwebtoken</code></td>
      <td><code>9.0.3</code></td>
      <td>Stateless HMAC-SHA256 signed bearer tokens carrying authenticated claims.</td>
    </tr>
    <tr>
      <td><strong>Client Frontend</strong></td>
      <td>Vanilla HTML5 / CSS3 / ES6</td>
      <td>Modern Standards</td>
      <td>Zero build-step dependency, native DOM manipulation, responsive CSS variables, print layout.</td>
    </tr>
  </table>

  <h2 class="section-title">3.2 Relational Model vs. Document Store Trade-Offs</h2>
  <p>
    Financial applications demand mathematical determinism and referential integrity. While NoSQL document stores (such as MongoDB) allow rapid schema modifications, they lack engine-enforced multi-table foreign keys and cross-collection constraints. In contrast, MariaDB InnoDB enforces relational integrity at the storage layer: deleting an employee who has finalized payroll records is rejected (<code>ON DELETE RESTRICT</code>), and domain check constraints (<code>basic_salary &gt;= 0</code>) guarantee that corrupted data cannot be persisted.
  </p>

  <h1 class="chapter-title" style="margin-top: 20pt;">Chapter 4: System Architecture</h1>

  <h2 class="section-title">4.1 3-Tier Enterprise Architectural Model</h2>
  <p>
    PayTrace separates concerns across three tiers: Presentation (Client SPA), Security/Application (Node.js/Express API), and Persistence (MariaDB InnoDB).
  </p>

  <div class="figure-container large-fig">
    <img src="${IMAGES.archDiagram}" alt="PayTrace 3-Tier Enterprise System Architecture" />
    <div class="caption">Figure 4.1: PayTrace 3-Tier Enterprise System Architecture showing Client SPA, Express Security Middleware, and MariaDB Procedural Database Tier</div>
  </div>

  <h2 class="section-title">4.2 Security Pipeline &amp; Database Engine Tier</h2>
  <p>
    Every client request passes through an Express middleware pipeline:
  </p>
  <ul>
    <li><code>authenticateToken</code>: Verifies the JWT signature from the <code>Authorization: Bearer</code> header.</li>
    <li><code>requireRole('HR_ADMIN')</code>: Restricts administrative endpoints (e.g. employee creation, cycle execution).</li>
    <li><code>enforceSelfOrAdmin</code>: Enforces data isolation by verifying that non-admin callers access only records matching their authenticated <code>employee_id</code>.</li>
  </ul>
</div>

<!-- CHAPTER 5: DATABASE DESIGN -->
<div class="page-break">
  <h1 class="chapter-title">Chapter 5: Relational Database Design</h1>

  <h2 class="section-title">5.1 Entity-Relationship Model &amp; Cardinalities</h2>
  <p>
    The PayTrace database schema consists of 9 normalized entities with clear primary keys, foreign keys, unique keys, and domain check constraints:
  </p>

  <div class="figure-container large-fig">
    <img src="${IMAGES.erDiagram}" alt="PayTrace Relational Entity-Relationship Model" />
    <div class="caption">Figure 5.1: PayTrace Relational Entity-Relationship Model showing 9 normalized tables, key attributes, domain constraints, and referential actions</div>
  </div>

  <h2 class="section-title">5.2 Complete Data Dictionary (9 Normalized Tables)</h2>
  
  <h3 class="sub-title">Table 1: departments &amp; Table 2: employees</h3>
  <table>
    <tr>
      <th style="width: 25%;">Table Name</th>
      <th style="width: 25%;">Column Name</th>
      <th style="width: 25%;">Data Type &amp; Nullability</th>
      <th style="width: 25%;">Constraints &amp; Key Role</th>
    </tr>
    <tr>
      <td rowspan="2"><strong>departments</strong></td>
      <td><code>department_id</code></td>
      <td>INT, NOT NULL</td>
      <td>PRIMARY KEY, AUTO_INCREMENT</td>
    </tr>
    <tr>
      <td><code>department_name</code></td>
      <td>VARCHAR(100), NOT NULL</td>
      <td>UNIQUE KEY (uq_department_name)</td>
    </tr>
    <tr>
      <td rowspan="6"><strong>employees</strong></td>
      <td><code>employee_id</code></td>
      <td>INT, NOT NULL</td>
      <td>PRIMARY KEY, AUTO_INCREMENT</td>
    </tr>
    <tr>
      <td><code>employee_code</code></td>
      <td>VARCHAR(20), NOT NULL</td>
      <td>UNIQUE KEY (uq_employee_code)</td>
    </tr>
    <tr>
      <td><code>email</code></td>
      <td>VARCHAR(100), NOT NULL</td>
      <td>UNIQUE KEY (uq_employee_email)</td>
    </tr>
    <tr>
      <td><code>department_id</code></td>
      <td>INT, NOT NULL</td>
      <td>FK -&gt; departments (ON DELETE RESTRICT)</td>
    </tr>
    <tr>
      <td><code>role</code></td>
      <td>ENUM('HR_ADMIN', 'EMPLOYEE')</td>
      <td>DEFAULT 'EMPLOYEE'</td>
    </tr>
    <tr>
      <td><code>password_hash</code></td>
      <td>VARCHAR(255), NOT NULL</td>
      <td>Salted 10-round Bcrypt hash</td>
    </tr>
  </table>

  <h3 class="sub-title">Table 3: salary_structures &amp; Table 4: attendance</h3>
  <table>
    <tr>
      <th style="width: 25%;">Table Name</th>
      <th style="width: 25%;">Column Name</th>
      <th style="width: 25%;">Data Type &amp; Nullability</th>
      <th style="width: 25%;">Constraints &amp; Key Role</th>
    </tr>
    <tr>
      <td rowspan="4"><strong>salary_structures</strong></td>
      <td><code>salary_id</code></td>
      <td>INT, NOT NULL</td>
      <td>PRIMARY KEY, AUTO_INCREMENT</td>
    </tr>
    <tr>
      <td><code>employee_id</code></td>
      <td>INT, NOT NULL</td>
      <td>FK -&gt; employees (ON DELETE CASCADE)</td>
    </tr>
    <tr>
      <td><code>basic_salary</code></td>
      <td>DECIMAL(10,2), NOT NULL</td>
      <td>CHECK (basic_salary &gt;= 0)</td>
    </tr>
    <tr>
      <td><code>hra, special_allowance</code></td>
      <td>DECIMAL(10,2), NOT NULL</td>
      <td>CHECK (&gt;= 0), DEFAULT 0.00</td>
    </tr>
    <tr>
      <td rowspan="4"><strong>attendance</strong></td>
      <td><code>attendance_id</code></td>
      <td>INT, NOT NULL</td>
      <td>PRIMARY KEY, AUTO_INCREMENT</td>
    </tr>
    <tr>
      <td><code>employee_id, work_date</code></td>
      <td>INT, DATE, NOT NULL</td>
      <td>UNIQUE KEY uq_emp_work_date</td>
    </tr>
    <tr>
      <td><code>status</code></td>
      <td>ENUM('PRESENT','ABSENT',...)</td>
      <td>DEFAULT 'PRESENT'</td>
    </tr>
    <tr>
      <td><code>is_late, late_minutes</code></td>
      <td>BOOLEAN, INT, NOT NULL</td>
      <td>CHECK (late_minutes &gt;= 0)</td>
    </tr>
  </table>

  <h3 class="sub-title">Table 5: leaves, Table 6: payroll_periods, Table 7: payrolls &amp; Table 8: payroll_items</h3>
  <table>
    <tr>
      <th style="width: 25%;">Table Name</th>
      <th style="width: 25%;">Column Name</th>
      <th style="width: 25%;">Data Type &amp; Nullability</th>
      <th style="width: 25%;">Constraints &amp; Key Role</th>
    </tr>
    <tr>
      <td><strong>leaves</strong></td>
      <td><code>start_date, end_date</code></td>
      <td>DATE, NOT NULL</td>
      <td>CHECK (start_date &lt;= end_date)</td>
    </tr>
    <tr>
      <td><strong>payroll_periods</strong></td>
      <td><code>period_name, days</code></td>
      <td>VARCHAR(50), INT, NOT NULL</td>
      <td>UNIQUE KEY, CHECK (days &gt; 0)</td>
    </tr>
    <tr>
      <td rowspan="3"><strong>payrolls</strong></td>
      <td><code>payroll_id</code></td>
      <td>INT, NOT NULL</td>
      <td>PRIMARY KEY, AUTO_INCREMENT</td>
    </tr>
    <tr>
      <td><code>employee_id, period_id</code></td>
      <td>INT, INT, NOT NULL</td>
      <td>UNIQUE KEY uq_emp_payroll_period</td>
    </tr>
    <tr>
      <td><code>gross, deductions, net</code></td>
      <td>DECIMAL(10,2), NOT NULL</td>
      <td>CHECK (gross &gt;= 0, net &gt;= 0)</td>
    </tr>
    <tr>
      <td><strong>payroll_items</strong></td>
      <td><code>payroll_id, type, amount</code></td>
      <td>INT, ENUM, DECIMAL(10,2)</td>
      <td>FK -&gt; payrolls (ON DELETE CASCADE)</td>
    </tr>
    <tr>
      <td><strong>audit_logs</strong></td>
      <td><code>table_name, old/new JSON</code></td>
      <td>VARCHAR, LONGTEXT JSON</td>
      <td>CHECK (JSON_VALID(old_values))</td>
    </tr>
  </table>

  <h2 class="section-title">5.3 Relational Normalization Proof (3NF &amp; BCNF)</h2>
  <ul>
    <li><strong>1NF:</strong> All relations possess distinct primary keys; columns are atomic. Multi-valued compensation items are normalized into <code>payroll_items</code>.</li>
    <li><strong>2NF:</strong> Every non-prime attribute is fully functionally dependent on the entire candidate key. In <code>attendance</code>, attributes depend on the composite key <code>(employee_id, work_date)</code>.</li>
    <li><strong>3NF &amp; BCNF:</strong> Transitive functional dependencies are eliminated. Department descriptors reside in <code>departments</code>, not <code>employees</code>. In <code>payrolls</code>, the candidate key <code>(employee_id, period_id)</code> is a superkey for all dependent attributes.</li>
  </ul>
</div>

<!-- CHAPTER 6: PAYROLL METHODOLOGY & MATHEMATICS -->
<div class="page-break">
  <h1 class="chapter-title">Chapter 6: Payroll Methodology &amp; Mathematical Formulations</h1>

  <h2 class="section-title">6.1 Mathematical Formulations</h2>
  
  <p><strong>1. Gross Monthly Compensation:</strong></p>
  <div class="formula-box">
    Gross Earnings = Basic Salary + House Rent Allowance (HRA) + Special Allowance
  </div>

  <p><strong>2. Pro-Rata Daily Rate (Stored Function <code>fn_calculate_daily_rate</code>):</strong></p>
  <div class="formula-box">
    Daily Rate = ROUND(Gross Earnings / Total Working Days in Accounting Period, 2)
  </div>

  <p><strong>3. Unpaid Absence / Leave Deduction:</strong></p>
  <div class="formula-box">
    Unpaid Deduction = ROUND(Unpaid Leave Days &times; Daily Rate, 2)
  </div>

  <p><strong>4. Progressive Tardiness Penalty Policy:</strong></p>
  <div class="formula-box">
    Late Penalty = max(0, Late Occurrences - 3) &times; ROUND(Daily Rate / 2, 2)
  </div>

  <p><strong>5. Progressive Income Tax Withholding (Stored Function <code>fn_calculate_monthly_tds</code>):</strong></p>
  <p>Projected Annual Gross = 12 &times; Monthly Gross Earnings. Marginal slabs:</p>
  <ul>
    <li>Tier 1: Up to \$300,000 &rarr; 0%</li>
    <li>Tier 2: \$300,001 to \$600,000 &rarr; 5% of excess over \$300,000</li>
    <li>Tier 3: \$600,001 to \$1,200,000 &rarr; \$15,000 + 10% of excess over \$600,000</li>
    <li>Tier 4: Above \$1,200,000 &rarr; \$75,000 + 20% of excess over \$1,200,000</li>
  </ul>
  <div class="formula-box">
    Monthly TDS = ROUND(Projected Annual Tax / 12.0, 2)
  </div>

  <div class="figure-container large-fig">
    <img src="${IMAGES.workflowDiagram}" alt="PayTrace Payroll Calculation &amp; Transaction Lifecycle" />
    <div class="caption">Figure 6.1: PayTrace Payroll Calculation &amp; Transaction Lifecycle showing Guard Clauses, Metric Aggregation, Formulas, and InnoDB ACID Boundary</div>
  </div>

  <h2 class="section-title">6.2 Worked Examples &amp; Discrepancy Reconciliation</h2>

  <h3 class="sub-title">Worked Example A: Sarah Jenkins (<code>EMP004</code>) — July 2026 (Excess Late Marks)</h3>
  <ul>
    <li><strong>Compensation Structure:</strong> Basic: \$65,000.00, HRA: \$26,000.00, Special: \$9,000.00 &rarr; <strong>Gross = \$100,000.00</strong></li>
    <li><strong>Working Days:</strong> July 2026 = 23 days &rarr; <code>Daily Rate = ROUND(100000 / 23, 2) = $4,347.83</code></li>
    <li><strong>Attendance Record:</strong> 23 present days, 6 late arrivals (&gt;09:15:00).</li>
    <li><strong>Late Deduction:</strong> <code>Excess Late Marks = 6 - 3 = 3</code>.<br/>
      <code>Half-Day Rate = 4347.826 / 2 = $2,173.913</code> &rarr; <code>Penalty = 3 &times; 2173.913 = $6,521.75</code></li>
    <li><strong>Tax Calculation:</strong> Projected Annual Gross = 12 &times; \$100,000 = \$1,200,000.00.<br/>
      <code>Annual Tax = $15,000 + ((1200000 - 600000) &times; 0.10) = $15,000 + $60,000 = $75,000.00</code><br/>
      <code>Monthly TDS = $75,000 / 12 = $6,250.00</code></li>
    <li><strong>Statutory Contributions:</strong> Provident Fund (12% of basic) = <code>0.12 &times; 65000 = $7,800.00</code>; Professional Tax = <code>$200.00</code>.</li>
    <li><strong>Total Deductions:</strong> <code>$7,800.00 (PF) + $200.00 (PT) + $6,521.75 (Late) + $6,250.00 (TDS) = $20,771.75</code></li>
    <li><strong>Net Salary:</strong> <code>$100,000.00 - $20,771.75 = $79,228.25</code></li>
  </ul>

  <div class="callout callout-info">
    <strong>Statutory Deduction Calculation Verification:</strong><br/>
    Sarah's itemized deductions in July 2026 comprise: Basic PF: \$7,800.00 (12% of basic), Professional Tax: \$200.00, Late Penalty: \$6,521.75 (3 excess late marks), and TDS Income Tax: \$6,250.00 (10% Tier 3 bracket).<br/>
    <strong>Verified Finding:</strong> Direct query of MariaDB (<code>payroll_items</code>) and UI screenshot <code>08-itemized-salary-slip.png</code> confirms that both the database records and payslip voucher yield this exact \$20,771.75 total deduction, arriving at the verified \$79,228.25 net take-home pay.
  </div>
</div>

<!-- CHAPTER 7, 8 & 9 -->
<div class="page-break">
  <h1 class="chapter-title">Chapter 7: Attendance &amp; Leave Workflows</h1>
  
  <h2 class="section-title">7.1 Daily Attendance Lifecycle &amp; Punctuality Engine</h2>
  <p>
    When an employee clocks in via <code>POST /api/attendance/clock-in</code>, the server captures the timestamp. If arrival occurs past <code>09:15:00</code>, the record is flagged as <code>is_late = TRUE</code>, and elapsed minutes are recorded. Duplicate entries on the same day are rejected by natural key <code>uq_emp_work_date</code>.
  </p>

  <h2 class="section-title">7.2 Database Triggers for Overlap Prevention</h2>
  <p>
    Database triggers <code>trg_leaves_before_insert</code> and <code>trg_leaves_before_update</code> enforce scheduling integrity:
  </p>
  <pre><code>-- Database Trigger snippet enforcing leave conflict prevention
IF NEW.status = 'APPROVED' THEN
    SELECT COUNT(*) INTO v_overlap_count
    FROM leaves
    WHERE employee_id = NEW.employee_id
      AND status = 'APPROVED'
      AND leave_id != COALESCE(NEW.leave_id, 0)
      AND start_date &lt;= NEW.end_date
      AND end_date &gt;= NEW.start_date;

    IF v_overlap_count &gt; 0 THEN
        SIGNAL SQLSTATE '45000' 
            SET MESSAGE_TEXT = 'Conflicting leave: overlapping approved leave already exists for this employee';
    END IF;
END IF;</code></pre>

  <h1 class="chapter-title" style="margin-top: 18pt;">Chapter 8: Security &amp; Role-Based Access Control</h1>

  <h2 class="section-title">8.1 Dual-Role Security Model &amp; JWT Pipeline</h2>
  <p>
    PayTrace enforces role-based access control (RBAC) across two roles: <code>HR_ADMIN</code> and <code>EMPLOYEE</code>. Sessions are managed through stateless HMAC-SHA256 JWT tokens. Sensitive endpoints verify permissions:
  </p>
  <ul>
    <li><code>requireRole('HR_ADMIN')</code>: Gated endpoints return <code>403 Forbidden</code> if invoked by general employees.</li>
    <li><code>enforceSelfOrAdmin</code>: Middleware inspects route and query parameters (e.g. <code>?employeeId=4</code>). If an employee attempts to access another worker's records, the request is blocked with <code>HTTP 403 Forbidden</code>.</li>
  </ul>

  <h1 class="chapter-title" style="margin-top: 18pt;">Chapter 9: Transaction Management &amp; ACID Safety</h1>

  <h2 class="section-title">9.1 Atomic Payroll Transactions &amp; Rollback Proof</h2>
  <p>
    Stored procedure <code>sp_calculate_payroll</code> opens an explicit transaction boundary (<code>START TRANSACTION</code>). If any integrity constraint fails during payroll insertion, an active <code>SQLEXCEPTION</code> handler triggers <code>ROLLBACK</code>.
  </p>
  <p>
    Verification procedure <code>sp_demonstrate_transaction_rollback</code> proves zero ghost records: after injecting a constraint failure during batch calculation, the table count remains at exactly 36 records and 288 line items (0 partial writes).
  </p>
</div>

<!-- CHAPTER 10 & 11 -->
<div class="page-break">
  <h1 class="chapter-title">Chapter 10: Analytical Reports &amp; Query Optimization</h1>

  <h2 class="section-title">10.1 Reports Implementation</h2>
  <ul>
    <li><strong>Report 1: Monthly Attendance Summary:</strong> Multi-table aggregation of working days, present days, absences, and leaves across all active employees.</li>
    <li><strong>Report 2: Itemized Salary Slip:</strong> Complete breakdown of gross earnings, statutory contributions, and net pay.</li>
    <li><strong>Report 3: Late-Marks Report:</strong> Ranks employees by tardiness duration, highlighting repeat punctuality infractions.</li>
  </ul>

  <h2 class="section-title">10.2 Before &amp; After EXPLAIN Optimization Study</h2>
  <p>
    In Report 3, filtering on <code>work_date</code> and <code>is_late</code> across all employees caused an initial bottleneck because the existing unique index had <code>employee_id</code> as its leftmost prefix. The optimizer was forced into a full table scan on <code>departments</code>, nested loops, and temporary tables.
  </p>
  <p>
    To resolve this, composite index <code>idx_attendance_late_lookup</code> was introduced:
  </p>
  <pre><code>CREATE INDEX idx_attendance_late_lookup ON attendance (is_late, work_date, late_minutes);</code></pre>

  <table>
    <tr>
      <th style="width: 30%;">Optimization Metric</th>
      <th style="width: 35%;">Before Composite Index</th>
      <th style="width: 35%;">After Composite Index</th>
    </tr>
    <tr>
      <td><strong>Driving Table Scan</strong></td>
      <td><code>departments</code> (Full scan, 5 rows)</td>
      <td><code>attendance</code> (Index range scan)</td>
    </tr>
    <tr>
      <td><strong>Temporary Table on Disk</strong></td>
      <td><code>using_temporary_table: true</code></td>
      <td><strong><code>using_temporary_table: false</code> (Eliminated)</strong></td>
    </tr>
    <tr>
      <td><strong>Filesort Operation</strong></td>
      <td><code>using_filesort: true</code></td>
      <td><strong><code>using_filesort: false</code> (Eliminated)</strong></td>
    </tr>
    <tr>
      <td><strong>Optimizer Estimated Cost</strong></td>
      <td>0.035306911</td>
      <td><strong>0.011762145 (66.7% Reduction)</strong></td>
    </tr>
  </table>

  <h1 class="chapter-title" style="margin-top: 20pt;">Chapter 11: Application Implementation</h1>

  <h2 class="section-title">11.1 Source Code Architecture</h2>
  <p>
    The PayTrace repository structure maintains clear separation of concerns:
  </p>
  <ul>
    <li><code>database/</code>: Schema DDL, stored procedures, functions, triggers, indexes, and reports.</li>
    <li><code>src/middleware/auth.js</code>: JWT verification and <code>enforceSelfOrAdmin</code> anti-IDOR gates.</li>
    <li><code>src/routes/</code>: Modular API routes for authentication, employees, attendance, leaves, payroll, reports, and audit logs.</li>
    <li><code>src/public/</code>: Lightweight Single Page Application (HTML, CSS variables, and vanilla JavaScript client).</li>
  </ul>
</div>

<!-- CHAPTER 12: USER INTERFACE EVIDENCE -->
<div class="page-break">
  <h1 class="chapter-title">Chapter 12: User Interface Evidence &amp; Visual Gallery</h1>
  <p>
    The following figures present screenshots captured directly from the running PayTrace application:
  </p>

  <div class="figure-container">
    <img src="${IMAGES.login}" alt="PayTrace Login Interface" />
    <div class="caption">Figure 12.1: Authentication Portal featuring masked credentials and 1-click evaluation shortcuts for Alice Morgan (HR Admin) and David Miller (Staff)</div>
  </div>

  <div class="figure-container">
    <img src="${IMAGES.hrDashboard}" alt="HR Executive Dashboard" />
    <div class="caption">Figure 12.2: HR / Admin Executive Dashboard displaying 12 Active Employees, $1.26M Monthly Liability, 1 Pending Leave, and Quick Actions</div>
  </div>

  <div class="figure-container">
    <img src="${IMAGES.empDashboard}" alt="Employee Self-Service Dashboard" />
    <div class="caption">Figure 12.3: Employee Self-Service Dashboard showing restricted staff navigation, compensation card, and active punch clock</div>
  </div>
</div>

<div class="page-break">
  <div class="figure-container">
    <img src="${IMAGES.roster}" alt="Organizational Roster" />
    <div class="caption">Figure 12.4: Organizational Employee Directory listing 12 seeded employees across 5 departments with roles and compensation</div>
  </div>

  <div class="figure-container">
    <img src="${IMAGES.attendance}" alt="Daily Attendance Logs" />
    <div class="caption">Figure 12.5: Daily Attendance Management Log showing timestamps, status tags, and punctuality badges (ON TIME vs. LATE)</div>
  </div>

  <div class="figure-container">
    <img src="${IMAGES.leave}" alt="Leave Workflow &amp; Application Modal" />
    <div class="caption">Figure 12.6: Leave Management Interface with active Submit Application modal and background HR review queue</div>
  </div>
</div>

<div class="page-break">
  <div class="figure-container">
    <img src="${IMAGES.payroll}" alt="Payroll Cycle Administration" />
    <div class="caption">Figure 12.7: Payroll Operations Administration table displaying working days, gross earnings, total deductions, and net salary</div>
  </div>

  <div class="figure-container">
    <img src="${IMAGES.payslip}" alt="Itemized Salary Slip Voucher" />
    <div class="caption">Figure 12.8: Sarah Jenkins July 2026 Salary Slip Modal displaying earnings ($100k), 6 late marks, late penalty ($6,521.75), and net take-home ($79,228.25)</div>
  </div>

  <div class="figure-container">
    <img src="${IMAGES.attReport}" alt="Monthly Attendance Summary Report" />
    <div class="caption">Figure 12.9: Monthly Attendance Summary Report (Phase 3 Report 1) aggregating working days, present days, and late marks</div>
  </div>
</div>

<div class="page-break">
  <div class="figure-container">
    <img src="${IMAGES.lateReport}" alt="Late-Marks Analytical Report" />
    <div class="caption">Figure 12.10: Late-Marks Analytical Report (Phase 3 Report 3) listing employee arrivals past 09:15:00 sorted by descending tardiness</div>
  </div>

  <div class="figure-container">
    <img src="${IMAGES.rbacDenial}" alt="RBAC Data Isolation Defense" />
    <div class="caption">Figure 12.11: Live RBAC 403 Forbidden Defense: David Miller attempting direct object access to Alice Morgan's payslip, blocked by server middleware</div>
  </div>
</div>

<!-- CHAPTER 13 & 14 -->
<div class="page-break">
  <h1 class="chapter-title">Chapter 13: Testing, Quality Assurance &amp; Rubric Matrix</h1>

  <h2 class="section-title">13.1 Testing Methodology &amp; Automated Test Suite</h2>
  <p>
    An automated test suite (<code>tests/test_suite.js</code>) validates all 20 mandatory test cases. Command executed:
  </p>
  <pre><code>npm test</code></pre>
  <pre><code>===============================================================
PAYTRACE: Executing 20 Mandatory Rubric Test Cases
Database: paytrace_db
Timestamp: 2026-11-17T21:16:10.218Z
===============================================================
[✅ PASS] Test 1: Valid employee creation
[✅ PASS] Test 2: Duplicate employee identifier rejection
[✅ PASS] Test 3: Negative salary rejection
[✅ PASS] Test 4: Duplicate attendance entry rejection
[✅ PASS] Test 5: Invalid attendance state rejection
[✅ PASS] Test 6: Overlapping approved leave rejection
[✅ PASS] Test 7: Valid leave application and approval
[✅ PASS] Test 8: Correct salary calculation formula
[✅ PASS] Test 9: Correct progressive tax deduction
[✅ PASS] Test 10: Successful payroll transaction and COMMIT
[✅ PASS] Test 11: Failed payroll transaction and verified ROLLBACK
[✅ PASS] Test 12: Correct monthly attendance summary report
[✅ PASS] Test 13: Correct salary slip itemization report
[✅ PASS] Test 14: Correct late-marks report
[✅ PASS] Test 15: Employee access to own records (RBAC)
[✅ PASS] Test 16: Employee attempt to access other records (Blocked)
[✅ PASS] Test 17: Employee attempt to perform HR action (Blocked)
[✅ PASS] Test 18: Unauthorized / Unauthenticated request rejection
[✅ PASS] Test 19: Boundary conditions for dates and parameters
[✅ PASS] Test 20: Repeated payroll processing prevention
===============================================================
TEST EXECUTION SUMMARY: 20 / 20 PASSED (100% SUCCESS)
===============================================================</code></pre>

  <h1 class="chapter-title" style="margin-top: 18pt;">Chapter 14: Deployment, Setup &amp; Evaluator Guide</h1>

  <h2 class="section-title">14.1 Quick Start Instructions</h2>
  <ol>
    <li><strong>Configure Environment:</strong> Copy <code>.env.example</code> to <code>.env</code> with database connection parameters.</li>
    <li><strong>Provision Database:</strong> Run <code>mariadb -u root -h 127.0.0.1 &lt; database/setup.sql</code> to create tables and seed 12 employees across 3 months.</li>
    <li><strong>Install Dependencies &amp; Run Tests:</strong> Run <code>npm install</code> followed by <code>npm test</code>.</li>
    <li><strong>Start Application:</strong> Run <code>npm start</code> and visit <code>http://localhost:3000</code>.</li>
  </ol>
  
  <div class="callout callout-warning">
    <strong>Destructive Reset Safety Warning:</strong><br/>
    <code>database/setup.sql</code> sources <code>schema.sql</code> (which contains <code>DROP TABLE IF EXISTS</code>). Never run <code>database/setup.sql</code> on an active production database.
  </div>
</div>

<!-- CHAPTER 15, 16, 17 & REFERENCES -->
<div class="page-break">
  <h1 class="chapter-title">Chapter 15: Discussion, Limitations &amp; Conclusion</h1>

  <h2 class="section-title">15.1 Summary of Deliverables &amp; Rubric Adherence</h2>
  <p>
    The PayTrace implementation fulfills all requirements across the five evaluation phases (100 Marks total), demonstrating normalization, transactional atomicity, execution plan optimization, and robust authorization controls.
  </p>

  <h2 class="section-title">15.2 Limitations &amp; Future Enterprise Scalability</h2>
  <p>
    In an enterprise organization with 5,000+ employees:
  </p>
  <ul>
    <li><strong>Range Partitioning:</strong> The <code>attendance</code> table accumulates 1.3M rows annually; range partitioning by year will optimize scan performance and facilitate archival.</li>
    <li><strong>Asynchronous Worker Queues:</strong> Single-thread batch payroll should transition to distributed Redis / BullMQ worker queues to avoid HTTP request timeouts.</li>
  </ul>

  <h2 class="section-title">15.3 Conclusion</h2>
  <p>
    PayTrace successfully proves that database-first engineering—enforcing business invariants through relational schemas, constraints, stored procedures, and triggers—provides an auditable, resilient foundation for enterprise software.
  </p>

  <h1 class="chapter-title" style="margin-top: 20pt;">References</h1>
  <ol>
    <li>MariaDB Foundation. <em>MariaDB Server Documentation: InnoDB Storage Engine, Stored Procedures, Triggers, and EXPLAIN Format</em>. https://mariadb.com/kb/en/documentation/ (Accessed Nov 2026).</li>
    <li>Node.js Project. <em>Node.js v26 LTS API Documentation: Events, HTTP, and Crypto Modules</em>. https://nodejs.org/docs/latest/api/ (Accessed Nov 2026).</li>
    <li>Express.js Team. <em>Express 5.x API Guide: Routing, Middleware, and Application Security</em>. https://expressjs.com/ (Accessed Nov 2026).</li>
    <li>Codd, E. F. <em>A Relational Model of Data for Large Shared Data Banks</em>. Communications of the ACM, Vol. 13, No. 6, 1970.</li>
    <li>Date, C. J. <em>An Introduction to Database Systems</em>, 8th Edition, Addison-Wesley, 2004.</li>
    <li>Open Web Application Security Project (OWASP). <em>Top 10 API Security Risks: Broken Object Level Authorization (IDOR)</em>. https://owasp.org/API-Security/ (Accessed Nov 2026).</li>
    <li>Government of India Income Tax Department. <em>Tax Deducted at Source (TDS) Slabs and Guidelines under Finance Act</em>. https://incometaxindia.gov.in/ (Accessed Nov 2026).</li>
  </ol>
</div>

<!-- APPENDICES -->
<div class="page-break">
  <h1 class="chapter-title">Appendices</h1>

  <h2 class="section-title">Appendix A: REST API Endpoint Matrix</h2>
  <table>
    <tr>
      <th style="width: 15%;">Method</th>
      <th style="width: 35%;">Endpoint</th>
      <th style="width: 20%;">Access Role</th>
      <th style="width: 30%;">Description</th>
    </tr>
    <tr>
      <td><code>POST</code></td>
      <td><code>/api/auth/login</code></td>
      <td>Public</td>
      <td>Authenticates credentials and returns JWT bearer token</td>
    </tr>
    <tr>
      <td><code>GET</code></td>
      <td><code>/api/employees</code></td>
      <td><code>HR_ADMIN</code></td>
      <td>Lists all employees with organizational departments</td>
    </tr>
    <tr>
      <td><code>GET</code></td>
      <td><code>/api/attendance</code></td>
      <td>Self / <code>HR_ADMIN</code></td>
      <td>Retrieves monthly attendance logs (anti-tampering enforced)</td>
    </tr>
    <tr>
      <td><code>POST</code></td>
      <td><code>/api/attendance/clock-in</code></td>
      <td>Authenticated</td>
      <td>Records daily clock-in timestamp with punctuality evaluation</td>
    </tr>
    <tr>
      <td><code>POST</code></td>
      <td><code>/api/payroll/process</code></td>
      <td><code>HR_ADMIN</code></td>
      <td>Executes atomic bulk payroll processing for a cycle</td>
    </tr>
    <tr>
      <td><code>GET</code></td>
      <td><code>/api/payroll/itemized/:id</code></td>
      <td>Self / <code>HR_ADMIN</code></td>
      <td>Retrieves full itemized salary slip line items</td>
    </tr>
    <tr>
      <td><code>GET</code></td>
      <td><code>/api/reports/*</code></td>
      <td><code>HR_ADMIN</code></td>
      <td>Generates analytical reports (Attendance, Late Marks)</td>
    </tr>
    <tr>
      <td><code>GET</code></td>
      <td><code>/api/audit-logs</code></td>
      <td><code>HR_ADMIN</code></td>
      <td>Retrieves immutable audit trail records with JSON diffs</td>
    </tr>
  </table>

  <h2 class="section-title">Appendix B: Stored Procedure DDL Snippet (sp_calculate_payroll)</h2>
  <pre><code>-- Core transactional payroll procedure with exception handler
DELIMITER //
CREATE PROCEDURE sp_calculate_payroll(
    IN p_employee_id INT,
    IN p_period_id INT,
    IN p_processed_by INT,
    OUT p_payroll_id INT,
    OUT p_net_salary DECIMAL(10,2),
    OUT p_status_code INT,
    OUT p_status_message VARCHAR(255)
)
BEGIN
    DECLARE EXIT HANDLER FOR SQLEXCEPTION
    BEGIN
        ROLLBACK;
        SET p_status_code = 500;
        SET p_status_message = 'Database error: Transaction rolled back';
    END;

    START TRANSACTION;
    -- Step 1: Insert Master Record
    INSERT INTO payrolls (employee_id, period_id, salary_id, gross_earnings, total_deductions, net_salary, ...)
    VALUES (p_employee_id, p_period_id, v_salary_id, v_gross, v_deductions, v_net, ...);
    
    SET p_payroll_id = LAST_INSERT_ID();

    -- Step 2: Insert Normalized Line Items
    INSERT INTO payroll_items (payroll_id, item_type, item_name, amount, description) VALUES
    (p_payroll_id, 'EARNING', 'Basic Salary', v_basic, 'Base monthly compensation'),
    (p_payroll_id, 'EARNING', 'House Rent Allowance (HRA)', v_hra, 'Housing allowance'),
    (p_payroll_id, 'DEDUCTION', 'Provident Fund (PF)', v_pf, 'Retirement contribution'),
    (p_payroll_id, 'DEDUCTION', 'Income Tax (TDS)', v_tds, 'Monthly TDS withholding');
    
    COMMIT;
    SET p_status_code = 200;
    SET p_status_message = 'Payroll computed and committed successfully';
END//
DELIMITER ;</code></pre>
</div>

</body>
</html>`;

fs.writeFileSync(HTML_PATH, HTML_CONTENT);
console.log(`Saved HTML report to: ${HTML_PATH} (${(HTML_CONTENT.length / 1024).toFixed(1)} KB)`);

console.log('3. Spawning Chromium headless and attaching via DevTools Protocol...');

async function generatePDF() {
  const chrome = spawn('chromium', [
    '--headless=new',
    '--disable-gpu',
    '--no-sandbox',
    '--remote-debugging-port=9227',
    'about:blank'
  ]);

  await new Promise(r => setTimeout(r, 1200));

  http.get('http://127.0.0.1:9227/json/version', (res) => {
    let data = '';
    res.on('data', c => data += c);
    res.on('end', async () => {
      const ver = JSON.parse(data);
      const ws = new WebSocket(ver.webSocketDebuggerUrl);

      ws.onopen = async () => {
        let msgId = 1;
        const call = (method, params = {}, sessionId) => new Promise(resolve => {
          const id = msgId++;
          const handler = (evt) => {
            const m = JSON.parse(evt.data);
            if (m.id === id) {
              ws.removeEventListener('message', handler);
              resolve(m);
            }
          };
          ws.addEventListener('message', handler);
          ws.send(JSON.stringify({ id, method, params, sessionId }));
        });

        console.log('4. Navigating to HTML document...');
        const target = await call('Target.createTarget', { url: `file://${HTML_PATH}` });
        const targetId = target.result.targetId;
        const attached = await call('Target.attachToTarget', { targetId, flatten: true });
        const sessionId = attached.result.sessionId;

        await call('Page.enable', {}, sessionId);
        // Wait for images and layouts to settle
        await new Promise(r => setTimeout(r, 1500));

        console.log('5. Rendering PDF with custom academic header and footer templates...');
        const pdf = await call('Page.printToPDF', {
          paperWidth: 8.27,
          paperHeight: 11.69,
          marginTop: 0.8,
          marginBottom: 0.8,
          marginLeft: 0.7,
          marginRight: 0.7,
          printBackground: true,
          displayHeaderFooter: true,
          headerTemplate: '<div style="font-size: 7.5pt; font-family: -apple-system, sans-serif; width: 100%; display: flex; justify-content: space-between; padding: 0 18mm; color: #64748b; border-bottom: 1px solid #cbd5e1; padding-bottom: 4px;"><span>PayTrace: Academic Capstone Project Report</span><span>Payroll & Attendance Management System</span></div>',
          footerTemplate: '<div style="font-size: 7.5pt; font-family: -apple-system, sans-serif; width: 100%; display: flex; justify-content: space-between; padding: 0 18mm; color: #64748b; border-top: 1px solid #cbd5e1; padding-top: 4px;"><span>Confidential Academic Capstone Report • Pulkit Pradhan (2501730036) • github.com/PulkitPradhan/PayTrace</span><span>Page <span class="pageNumber"></span> of <span class="totalPages"></span></span></div>'
        }, sessionId);

        if (pdf.result && pdf.result.data) {
          const buffer = Buffer.from(pdf.result.data, 'base64');
          fs.writeFileSync(PDF_PATH, buffer);
          console.log(`\n🎉 SUCCESS! Generated PDF: ${PDF_PATH}`);
          console.log(`File size: ${(buffer.length / (1024 * 1024)).toFixed(2)} MB (${buffer.length} bytes)`);
        } else {
          console.error('Failed to generate PDF:', pdf);
          process.exit(1);
        }

        ws.close();
        chrome.kill();
        process.exit(0);
      };
    });
  }).on('error', (err) => {
    console.error('HTTP error connecting to Chromium:', err);
    chrome.kill();
    process.exit(1);
  });
}

generatePDF();

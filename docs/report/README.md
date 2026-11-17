# PayTrace — Academic Project Report

**Project Title:** PayTrace: Transparent, Auditable, and Transaction-Safe Payroll & Attendance Management Platform  
**Academic Theme:** Payroll & Attendance Management System  
**Author:** Pulkit Pradhan  
**Repository:** [https://github.com/PulkitPradhan/PayTrace](https://github.com/PulkitPradhan/PayTrace)  
**Academic Year:** 2025–2026  

---

## 1. Deliverables Inventory

This directory contains the complete academic project documentation for the PayTrace capstone project:

| File Name | Format | Description |
| :--- | :---: | :--- |
| **[`PayTrace_Project_Report.pdf`](PayTrace_Project_Report.pdf)** | **PDF (A4)** | **Primary Deliverable:** 23-page submission-ready academic report with dynamic running headers, running footers, page numbering, embedded vector diagrams, authentic application screenshots, and mathematical reconciliation. |
| **[`PayTrace_Project_Report.md`](PayTrace_Project_Report.md)** | **Markdown** | **Editable Source:** Complete structured markdown source covering all 24 project chapters, requirements, normalization proofs, mathematical calculations, and appendices. |
| **[`PayTrace_Project_Report.html`](PayTrace_Project_Report.html)** | **HTML5** | **Intermediate Web Source:** Standalone styled HTML document with base64-embedded assets and print media styling used by Chromium to produce the PDF. |
| **[`generate_pdf.js`](generate_pdf.js)** | **Node.js** | **Reproduction Script:** Automated zero-dependency generator that drives Chromium headless via the Chrome DevTools Protocol (CDP) to compile the PDF. |

---

## 2. Report Overview & Structure

The project report spans 23 pages formatted to standard ISO A4 portrait dimensions (`595.92 × 841.92 pts`), featuring:

1. **Cover Page & Formal Institutional Placeholders:** Project identity, author details, academic supervisor placeholder, and certificate/declaration templates.
2. **System Architecture & 3-Tier Model:** Detailed breakdown of the Vanilla SPA, Express 5 security pipeline (`authenticateToken`, `requireRole`, `enforceSelfOrAdmin`), and MariaDB InnoDB persistence layer, accompanied by Figure 4.1 ([`system-architecture.png`](../assets/diagrams/system-architecture.png)).
3. **Relational Database Design & 3NF/BCNF Proof:** Complete 9-table data dictionary, referential integrity rules, domain constraints, and Figure 5.1 ([`er-diagram.png`](../assets/diagrams/er-diagram.png)).
4. **Mathematical Methodology & Discrepancy Reconciliation:** Equations for pro-rata daily rates, progressive tax slabs (`fn_calculate_monthly_tds`), unpaid leave deductions, and tardiness penalties, accompanied by Figure 6.1 ([`payroll-transaction-workflow.png`](../assets/diagrams/payroll-transaction-workflow.png)) and worked examples for Sarah Jenkins (`EMP004`), Liam Patel (`EMP008`), and Aisha Khan (`EMP011`).
5. **Authentic UI Screenshot Gallery:** 11 real UI captures (Figures 12.1 through 12.11) demonstrating login, dashboards, roster, attendance tracking, leave approval, payroll execution, itemized payslip voucher, and live RBAC 403 Forbidden defense.
6. **Testing & Quality Assurance:** 20/20 passing test case matrix, transaction rollback proof (`sp_demonstrate_transaction_rollback`), and verified terminal output.
7. **Deployment & Safety Guide:** Step-by-step setup instructions distinguishing safe provisioning from destructive database resets.

---

## 3. How to Regenerate the PDF Report

The PDF is generated using pure Node.js and Chromium Headless via the Chrome DevTools Protocol (`Page.printToPDF`). No global dependencies or third-party PDF compilation binaries are required.

### Prerequisites:
- **Node.js:** v18.0.0 or higher (`v26.13.0` verified)
- **Chromium / Google Chrome:** Installed on system path (`/usr/bin/chromium` verified)

### Regeneration Command:
From the repository root directory (`/home/erebusstride/PayTrace`), execute:

```bash
node docs/report/generate_pdf.js
```

### Expected Output:
```text
1. Loading visual assets for embedding...
2. Constructing publication-grade HTML document...
Saved HTML report to: /home/erebusstride/PayTrace/docs/report/PayTrace_Project_Report.html (7405.3 KB)
3. Spawning Chromium headless and attaching via DevTools Protocol...
4. Navigating to HTML document...
5. Rendering PDF with custom academic header and footer templates...

🎉 SUCCESS! Generated PDF: /home/erebusstride/PayTrace/docs/report/PayTrace_Project_Report.pdf
File size: 4.92 MB (5162379 bytes)
```

---

## 4. Verification & Inspection Commands

To verify PDF metadata, page count, and text layer:

```bash
# Verify PDF metadata and page count (23 pages A4)
pdfinfo docs/report/PayTrace_Project_Report.pdf

# Verify text layer and heading extraction
pdftotext docs/report/PayTrace_Project_Report.pdf - | grep -E "^Chapter [0-9]+:|^Table of Contents|^Abstract"

# Render pages to PNG to inspect layout fidelity
mkdir -p /tmp/pdf_verify
pdftoppm -png -r 150 docs/report/PayTrace_Project_Report.pdf /tmp/pdf_verify/page
```

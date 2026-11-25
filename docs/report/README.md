# PayTrace — Academic Project Report

**Project Title:** PayTrace: Transparent, Auditable, and Transaction-Safe Payroll & Attendance Management Platform  
**Author:** Pulkit Pradhan (`2501730036`)  
**Repository:** [https://github.com/PulkitPradhan/PayTrace](https://github.com/PulkitPradhan/PayTrace)  
**Academic Year:** 2025–2026

---

## 1. Deliverables Inventory

| File Name | Format | Description |
| :--- | :---: | :--- |
| **[`PayTrace_Project_Report.pdf`](PayTrace_Project_Report.pdf)** | **PDF (A4)** | Primary printable capstone report with dynamic running headers/footers, embedded diagrams, all 14 live application screenshots, Phase 3 EXPLAIN/ANALYZE tables, and 32/32 verification results. |
| **[`PayTrace_Project_Report.md`](PayTrace_Project_Report.md)** | **Markdown** | Synchronized structured Markdown source. |
| **[`PayTrace_Project_Report.html`](PayTrace_Project_Report.html)** | **HTML5** | Standalone intermediate HTML with base64-embedded diagrams and screenshots used by Chromium CDP. |
| **[`generate_pdf.js`](generate_pdf.js)** | **Node.js** | Zero-dependency Chromium CDP compiler (`Page.printToPDF`). |

---

## 2. How to Regenerate the PDF Report

Prerequisites: Node.js `v18+` (`v26.13.0` verified) and `/usr/bin/chromium`.

```bash
node docs/report/generate_pdf.js
```

Note: Institutional fields (`Institution Name`, `Department / Degree`, `Supervisor Name`, `Submission Date`) retain explicit `[To be completed by student]` markers until finalized by the student for physical/university portal submission.

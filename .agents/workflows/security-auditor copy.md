---
name: security-auditor
description: >-
  Performs a comprehensive pre-launch application security audit. It runs dependency checks (npm audit), analyzes the codebase statically for OWASP Top 10 vulnerabilities, generates a detailed markdown report, and prompts the user before applying fixes.
---

# Security Auditor

## Overview
The `security-auditor` acts as a Senior Application Security Engineer to perform a deep, systematic security review of a codebase prior to deployment. It combining automated dependency checks with intelligent static analysis of core application logic. It reports vulnerabilities categorized by severity and explicitly waits for user approval before modifying code to fix them.

## Dependencies
None.

## Quick Start
To trigger this skill, the user can say:
- "Run a security audit on this project"
- "Act as a security auditor and check my backend"
- "Use the security-auditor skill"

## Workflow

### 1. Automated Dependency Scanning
- **Action:** Open a terminal in the root of the project (and specifically in `frontend/` or `backend/` if applicable).
- **Command:** Run `npm audit` (or `pip-audit`, etc., based on the project's language).
- **Goal:** Identify known CVEs in installed third-party libraries. If the command fails because no package manager is present, gracefully skip to step 2.

### 2. Comprehensive Static Code Analysis
Thoroughly read and analyze the codebase focusing on the OWASP Top 10 and modern web vulnerabilities. Key areas to check:
- **Authentication & Sessions:** Search for hardcoded secrets, weak JWT algorithms, missing expiration, missing HTTPOnly/Secure cookie flags, and improper session invalidation on logout.
- **Authorization & Access Control:** Look for Missing Object Level Access Control (IDOR), bypassable middleware, and privilege escalation vectors.
- **API Security:** Identify missing rate limiting, missing input validation (Joi/Zod), and Mass Assignment vulnerabilities (e.g., binding full `req.body` to a database update).
- **Data Protection & Cryptography:** Ensure passwords are hashed securely (e.g., bcrypt with adequate rounds) and sensitive PII isn't accidentally logged or returned in API responses.
- **Web Misconfigurations:** Check for overly permissive CORS policies (`*`), missing Content Security Policies (CSP), and missing standard security headers (e.g., Helmet.js).
- **Injection:** Check for SQL injection (raw queries), NoSQL injection, and Command injection.
- **File Uploads:** If applicable, verify uploads are restricted by MIME type, size, and stripped of executable extensions to prevent Stored XSS or RCE.

### 3. Report Generation
- **Action:** Create a markdown artifact named `security_audit_report.md`.
- **Format:** Group findings strictly by Severity (CRITICAL, HIGH, MEDIUM, LOW).
- For each finding, include:
  - **Vulnerability Name:** e.g., "Insecure CORS Policy"
  - **Location:** File path and specific line numbers.
  - **Risk:** Why it matters.
  - **Remediation:** Exact steps or code snippet required to fix it.

### 4. Interactive Remediation Prompt
- **Action:** Stop execution and ask the user for permission.
- **Prompt:** "I have completed the security audit and generated the report. Which of these issues (if any) would you like me to automatically fix for you now?"
- **Rule:** **DO NOT** make any code changes or fix any vulnerabilities until the user explicitly responds with their desired fixes.

## Common Mistakes
- **Fixing without asking:** The most common mistake is applying the fixes while doing the audit. The agent must strictly stop and wait for the user to read the report and grant permission.
- **Skipping areas:** Forgetting to check CORS, File Upload logic, or Rate Limiting. Ensure all areas in Step 2 are reviewed.
- **Writing superficial reports:** A good report highlights the *exact* file and line number. Avoid generic observations.

# Project Quotation – Abdullahi Aminci College Admissions Portal

## Overview

A full-stack admissions portal that digitizes student onboarding, application submissions, fee payments, and admin oversight. The solution uses React/TypeScript (Vite + Tailwind) for the frontend and CodeIgniter 3 (PHP) with JWT authentication, MySQL, and REST APIs for the backend.

## Objectives

- Streamline student onboarding with verified identity (email + NIN) and fee checkpoints.
- Provide a guided, multi-step application form with validation and document uploads.
- Enable secure online payment for application fees and surface receipt/status back to users.
- Equip administrators with dashboards, review workflows, and status controls.
- Deliver auditability, role-based access, and deployment-ready documentation.

## Functional Scope

- **Student Onboarding & Identity**: Registration (full name, email, phone, NIN, password); email verification codes; resend flow; NIN verification hook; enforced checkpoints before application editing/submission.
- **Authentication & Access**: JWT-based auth, session handling, password hashing, CORS configuration, role-based (student/admin) access guards.
- **Payments**: Application-fee payment integration with a supported gateway; status callbacks/webhooks handling; receipt reference capture; payment gating before submission.
- **Applications**: Multi-step form (personal, contact, academic, program choice, uploads), inline validation, draft/save-and-continue, submit, and status tracking.
- **Documents & Uploads**: O'Level/diploma transcripts and identity uploads with size/type validation and secure storage pathing.
- **Admin Console**: Dashboard KPIs, applicant search/filter, application detail view, status updates (pending/under-review/approved/rejected), notes, and notifications.
- **Content & News**: Public programs/news pages with CMS-ready hooks for future dynamic updates.
- **Notifications**: Toast/UI alerts; optional email notifications for key events (verification, submission, decision) if SMTP credentials are provided.
- **Security & Compliance**: Input validation, rate-limited verification codes, HTTPS-ready configuration, audit logging hooks, and environment-based secrets management.

## Technical Stack & Architecture

- **Frontend**: React 18 + TypeScript, Vite, TailwindCSS, Framer Motion (UI polish), form validation (react-hook-form + zod).
- **Backend**: CodeIgniter 3, PHP 8.x, REST controllers, JWT auth library, MySQL database.
- **Infrastructure**: Environment-driven configs (.env), CORS middleware/hook, migration-ready SQL schema, deployable to standard LAMP stack or containerized runtime.

## Deliverables

- **Codebase**: Frontend and backend source with environment configuration samples.
- **Database**: SQL schema plus seed data for test users, programs, and sample applications.
- **API Documentation**: Endpoint list, request/response shapes, auth flow, and error codes.
- **Deployment Guide**: Environment setup, build steps, database migration/import steps, and runtime configuration.
- **Admin & Student Guides**: Quick-start guides for using the portal (onboarding, submission, review flows).
- **Testing Artifacts**: Happy-path and guardrail test scenarios for onboarding, payments, and submission gates.

## Project Plan & Timeline (4 Weeks)

- **Week 1**: Discovery confirmation, UX/UI refinements, architecture sign-off, environment setup, DB schema finalization.
- **Week 2**: Implement auth/onboarding (email + NIN checkpoints), core application form structure, and validation.
- **Week 3**: Payment integration and status sync, document upload handling, admin dashboard/review tools.
- **Week 4**: QA and UAT support, hardening (guards, edge cases), deployment handover, and training sessions.

## Pricing

- **Fixed fee**: $18,500 covering design, development, QA, and UAT support.
- **Optional add-ons**: Payment gateway compliance review ($1,200); dedicated staging environment setup ($900); post-go-live hypercare (custom, on request).

## Assumptions & Dependencies

- Client provides payment gateway credentials and NIN verification API access (or chosen provider) before Week 2.
- SMTP or transactional email service credentials (e.g., SES/SendGrid) supplied for production email sends.
- Branding assets, content (programs, news), and legal copy delivered before Week 2.
- Two feedback cycles per major milestone; material scope changes may adjust schedule and cost.

## Out of Scope (can be quoted separately)

- Native mobile apps; offline-first capabilities.
- Custom BI dashboards beyond agreed KPIs; advanced analytics pipelines.
- Third-party LMS integration; SMS gateway integration.
- Complex document e-signature flows.

## Payment Terms

- 40% on kickoff, 40% on UAT start, 20% on production handover.

## Change Management

- Changes captured via a short change request (scope, effort, timeline impact) and approved before implementation.

## Support & Warranty

- 30-day warranty on delivered features post-handover (bug fixes for in-scope work).
- Optional extended support/hypercare can be added as an add-on.

## Acceptance & Next Steps

Please confirm approval of scope, timeline, and pricing to schedule kickoff. Upon acceptance, we will share the detailed project plan, access requirements, and environment checklists.

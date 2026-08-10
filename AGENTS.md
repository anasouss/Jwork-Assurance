# AGENTS.md

## Purpose

This file is the working contract for coding agents in this repository. Follow it before making changes. Prefer the existing implementation and domain model over assumptions from generic insurance or accounting systems.

## Active Applications

The maintained application is split into:

- `assurance-backend/`: Java 17, Spring Boot 3.3, Spring Data JPA, Spring Security, MySQL.
- `assurance-web/`: React 19, TypeScript, Vite, React Router, TanStack Query, shadcn/Radix UI, Tailwind CSS.

Treat these as reference or legacy projects unless the user explicitly asks to modify them:

- `Notaflow/`
- `skay_assurance/`

Never edit generated or local-only directories such as `target/`, `dist/`, `node_modules/`, `tmp/`, or IDE metadata.

## Source Of Truth

- Backend responses, validation, filtering, calculations, permissions, and persisted relationships are authoritative.
- The frontend presents backend state and gathers user input. Do not reproduce financial or eligibility rules in the frontend as an independent source of truth.
- Frontend convenience calculations may support immediate interaction, but saved and displayed authoritative totals must come from the backend.
- Use foreign keys and typed enums for stable domain relationships. Do not store labels or business entities as free text when a maintained reference entity exists.
- Preserve historical snapshots where accounting, contracts, claims, or issued documents require values not to change retroactively.

## Repository Workflow

1. Read the relevant controller, service, entity, DTO, frontend API module, types, and page before editing.
2. Search with `rg` or `rg --files` before introducing a new component, endpoint, formatter, enum, or helper.
3. Keep changes within the requested domain. Do not refactor unrelated files.
4. Assume the worktree may contain user changes. Never reset, revert, or overwrite changes you did not make.
5. Use `apply_patch` for manual edits.
6. Check `git diff` and `git diff --check` for the files changed.
7. Verify according to risk. Do not run a full backend or frontend build after every small copy, spacing, or styling change.

## Commands

Run commands from the relevant application directory.

### Backend

```bash
cd assurance-backend
mvn test
mvn -q -DskipTests package
mvn spring-boot:run
```

The backend defaults to port `8099`. Production configuration is environment-driven; see `src/main/resources/application.yml`.

### Frontend

```bash
cd assurance-web
npm install
npm run dev
npm run typecheck
npm run lint
npm run test:run
npm run build
```

Use `npm run check` when a broad frontend verification is justified. The frontend reads `VITE_API_URL`; see `.env.example`.

### Verification Policy

- Text, spacing, or narrowly scoped CSS change: inspect the diff; use a targeted visual check when layout is affected.
- Type or API contract change: run frontend typecheck or the narrow relevant tests.
- Backend service, repository, security, calculation, or persistence change: run focused tests, then broader tests if the change crosses module boundaries.
- Deployment blocker or explicit release verification: run the applicable production build once after the related edits are complete.
- PDF or printable document change: render representative output and inspect it visually; test multi-page and print-friendly behavior.

## Backend Conventions

### Layers

- Controllers expose `/api/v1/...`, validate access, read the current tenant, and return `ApiResponse<T>`.
- Services own business rules and transaction boundaries.
- Repositories own persistence queries and must remain agency-safe.
- Entities model persistence; request and response DTOs define API contracts. Do not expose entities directly.
- Use existing exception handling and domain exceptions instead of returning ad hoc error payloads.

### Agency Isolation

- The application is multi-agency. Agency scope comes from `TenantContext`, not from a client-supplied agency identifier.
- Every tenant-owned read, update, delete, uniqueness check, and aggregate must include the current `agenceId`.
- A valid entity ID from another agency must never become accessible because an endpoint only calls `findById`.
- Global reference data must be intentionally global; do not accidentally remove agency scoping from operational data.

### Security And Permissions

- Backend authorities use the `PERM_` prefix, for example `PERM_sinistre:view`.
- Frontend permission codes omit that prefix, for example `sinistre:view`.
- Enforce permissions on the backend with `@PreAuthorize`; hiding a frontend action is not authorization.
- Reuse the established `domain:action` naming style when adding permissions.
- New permissions require seeding or deployment SQL and appropriate role assignment; do not silently grant them in application logic.

### Persistence And Data Types

- Use `BigDecimal` for money, rates, taxes, commissions, provisions, and other financial values. Specify intentional precision and scale.
- Use `LocalDate` for business dates and `LocalDateTime` for timestamped events. Avoid timezone conversion for date-only insurance fields.
- Persist enums as strings with explicit column lengths.
- Prefer lazy relationships and explicit response mapping. Avoid relying on Open Session in View; it is disabled.
- Add indexes and tenant-aware unique constraints when introducing operational lookup keys.
- Do not compact multiple Java fields or methods onto one line. Follow the existing readable class layout.

### API Contracts

- Wrap normal JSON responses in `ApiResponse<T>`.
- Use the shared paged response and page metadata types for pageable endpoints.
- Keep request validation server-side with Jakarta Validation and explicit domain checks.
- Filtering should happen in repository specifications or queries, not by downloading broad datasets and filtering in React.
- Preserve backward compatibility when practical. When changing a DTO, update frontend API types and all callers in the same change.

## Frontend Conventions

### Structure And Data Fetching

- Routes are declared in `assurance-web/src/router.tsx` and use lazy page imports.
- Domain code belongs under `src/features/<domain>/`.
- Reusable application components belong under `src/components/shared/`; shadcn primitives belong under `src/components/ui/`.
- Use `apiFetch`, `apiFetchBlob`, `apiUpload`, and `buildQueryString` from `src/lib/api/base.ts`.
- Define stable TanStack Query key factories in domain API modules. Invalidate the narrow affected keys after mutations.
- API identifiers are normalized to strings in the browser to avoid JavaScript integer precision loss. Frontend IDs should therefore remain `string`, even when the backend uses `Long`.

### Forms And Interaction

- Reuse existing shadcn/Radix controls, shared date inputs, time picker, search components, dialogs, tables, badges, and empty/loading states.
- Use selects for maintained reference data; do not replace foreign-key selection with free text.
- Use a full page for long, multi-section workflows. Use a dialog for focused operations that can be understood and completed without losing context.
- Disable submission while a mutation is running and surface actionable backend error messages.
- Keep selected rows coherent: financial operations must not combine incompatible payers, agencies, companies, currencies, or workflow states.
- Do not hide missing data by inventing frontend defaults. Show `-` or a clear empty state where appropriate.

### Design And Language

- The operational UI is French. Keep labels concise, grammatically consistent, and domain-appropriate.
- Use Lucide icons through the existing icon conventions.
- Maintain dense, work-focused screens. Avoid marketing layouts, oversized headings, decorative gradients, nested cards, and excessive tabs.
- Use separate routes when dashboard actions lead to materially different workflows; do not route several distinct buttons to one ambiguous page.
- Keep labels separated from inputs and ensure responsive layouts do not overlap or truncate critical values.
- Tables should support scanning and comparison. Avoid fixed-height inner scrolling unless virtualization or a bounded picker genuinely requires it.
- Format Moroccan amounts with spaces as thousands separators and commas as decimals, for example `1 234,50`. Do not use `1.234,50`.
- Keep currency units out of every cell when the table or document already establishes the currency.
- Do not scale typography with viewport width. Use stable responsive grid constraints.

## Domain Invariants

### Production And Contracts

- Supported contract workflows include particulier/mono, convention, and flotte. Preserve their distinct data-entry and tariff behavior.
- Usage, convention, sous-classe, tariff grid, company, and customer category are linked reference data. Eligibility and filtering belong on the backend.
- Sous-classe behavior is parameterized. Motor characteristic, driver/permit requirements, assistance eligibility, and tariff selection must not be hardcoded solely from display labels.
- Manual guarantee entry and automatic tariff-grid calculation are different modes. Do not offer recalculation where the contract is intentionally manual.
- Contract creation and updates must keep client roles, vehicles, guarantees, movement, quittance, billable elements, and attestation consumption consistent in one transaction.

### Assistance

- Assistance is attached to a contract and normally to a vehicle, but it remains a separate billable element from the insurance movement.
- Store and expose the assistance contract/reference number, company, product, tariff, coverage dates, net amount, and TTC amount.
- Assistance may appear in contract summaries, client statements, invoices, receivables, and payment allocation.
- Aggregate displays may show insurance plus assistance totals, but accounting records must retain separate source lines and identities.
- Assistance visibility or eligibility that depends on convention/sous-classe must be backend-configurable and returned explicitly to the frontend.

### Quittances, Client Documents, And Receivables

- A quittance or billable element represents an amount owed. A client document groups selected client-facing lines; it is not a company-quittance assignment.
- Client statements and invoices are between the agency and a client or client group. They must not require `AffectationQuittanceCompagnie`.
- A document line may originate from an insurance billable element, assistance, or convention billing schedule. Preserve that source foreign key.
- Editing an issued document must follow explicit lifecycle rules; never silently rewrite an immutable accounting snapshot.
- Client payments support partial and multiple allocations. Payment instruments and allocation lines are separate concepts.

### Company Accounting And Treasury

- Company quittance assignment, company bordereaux, and company settlements are separate from client documents and client collection.
- A company bordereau groups eligible company entries for a defined company, basis, and period. An entry cannot belong to more than one active bordereau.
- Keep issuance-based and collection-based bordereau bases explicit.
- Client payment confirmation creates or updates treasury consequences according to payment mode. Cash, bank transfer/deposit, cheque, and bill/effect do not share the same lifecycle.
- Treasury accounts, payment instruments, treasury journal entries, settlements, and reconciliation must remain separate entities with traceable links.
- Never infer a payment merely because a statement or invoice was issued.

### Claims

- A claim is linked to the agency, client, contract, event, implicated coverage, and relevant parties.
- Coverage selection must come from the contract state effective on the loss date.
- Experts, garages, counterparties, payment modes, missions, provisions, and settlement operations should use maintained references or typed enums where available.
- Provisions are estimates; operations are actual financial events. Do not collapse them into one field.
- Claim status transitions must be validated on the backend and recorded in history.

### PDFs And Exports

- Backend-generated financial and contract PDFs are authoritative.
- Reuse existing PDF helpers, agency branding, storage layout, amount/date formatting, and signature options.
- Avoid duplicate header information, repeated currency suffixes, weak print contrast, and splitting related rows across pages.
- Fleet documents may include multiple annexes. Keep annex numbering and source movement/vehicle grouping deterministic.
- Excel exports must use the same filters and business reference date as the visible result set.

## Database Changes

This repository currently does not use Flyway or Liquibase. Hibernate `ddl-auto=update` is a development convenience and is not a complete production migration strategy.

When a schema or data migration is required:

- Create an explicit MySQL-compatible SQL script under `assurance-backend/sql/migrations/` unless the user specifies another deployment mechanism.
- Make scripts safe for the deployed MySQL version. Do not assume every `ALTER TABLE ... ADD COLUMN IF NOT EXISTS` form is supported.
- For conditional DDL, use `information_schema` checks and a temporary stored procedure when necessary.
- Avoid reserved words as aliases, for example use `u` rather than `usage`.
- Add columns and nullable foreign keys first, backfill and validate data second, then add constraints/indexes and tighten nullability.
- Preserve existing identifiers and references. Do not delete historical rows merely to make a migration pass.
- Include validation queries for orphaned rows, duplicate keys, invalid enum values, and expected row counts.
- State clearly whether the script is transactional; MySQL DDL can auto-commit.
- Keep the migration in the repository until deployment is confirmed. Remove it only when the user explicitly confirms it has been applied and requests removal.

## Storage

- Application files share the root configured by `APP_STORAGE_ROOT_DIR` and are organized by agency and document purpose through the storage layout service.
- Do not introduce a new independent root property for every asset type.
- A migration from legacy mounted directories must never prevent application startup merely because a mount point cannot be deleted. Copy/move safely and tolerate non-empty or busy legacy directories.
- Validate content type, file size, ownership, and agency scope for uploads. Current multipart defaults are 30 MB per file and 32 MB per request.

## Tests And Completion

- Add focused tests for calculations, tenant boundaries, status transitions, repositories, and shared frontend domain helpers.
- For a bug, prefer a regression test that fails before the fix when the affected layer has established test infrastructure.
- Before completion, verify changed API names, enum values, permission codes, query keys, route paths, and database column names across both applications.
- Report exactly what was changed, what was verified, whether a migration is needed, and any verification that was intentionally not run.

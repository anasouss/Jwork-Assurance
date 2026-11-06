# Business Activity Implementation

## Contract

Keep technical audit unchanged. Record explicit successful service/workflow actions in
the same transaction as domain changes. Never infer intent from table names, HTTP
timestamps, or a request-level group of Hibernate writes. Do not backfill ambiguous
historical audit operations.

Administration initially exposes Activity beside Technical Audit, for SUPER_ADMIN
and AGENCY_ADMIN with activity:view. All agency-mode queries use TenantContext.
No public event-write endpoint. No financial rules move to the browser.

Frontend-to-service action tracing is a completion requirement, not just a backend
mutation inventory. A shared endpoint can represent several commands; use validated
intent codes only as context, never as proof that particular fields changed or that
an operation succeeded. Trace multi-request buttons, previews and local-only saves.

One independently saved section is one action; full validation is one action, not
an event per child row. Distinguish first entry, real modification, and no-op saves.
Preserve readable references and only allowlisted relevant before/after values.
Agency/operator are foreign keys. Historical heterogeneous subject references are
typed identities plus immutable labels, intentionally surviving source deletion.

## Progress

Implementation and the selected verification are complete. This checklist is not
a claim of production deployment, production data migration, or browser end-to-end
testing. The final evidence and rollout requirements are recorded below.

- [x] Inspect existing audit, security, and contract section-save mechanisms.
- [x] Add typed event command, references, changes, immutable persistence, and recorder.
- [x] Add admin/permission-checked, agency-scoped server-side search API.
- [x] Add permission seed and additive MySQL deployment migration.
- [x] Add Administration activity page, filters, readable details, route and navigation.
- [x] Contract draft creation, section saves, vehicles/remorques/guarantees, final validation.
- [x] Contract active corrections, renewals, conversion, deletion, financial recalculation.
- [x] Amendment drafts, validation, rectification, removal, and their target context.
- [x] Assistance (standalone/linked), green cards, attachments, import/issuance; previews and ordinary exports excluded.
- [x] CRM clients/groups, commercial acquisition and payment conditions.
- [x] Statements/invoices, revisions/cancellation, convention billing, premium receipts.
- [x] Client payments, allocations, instruments, rejection follow-up and settlements.
- [x] Bank remittances/statements/reconciliation, cash sessions and treasury operations.
- [x] Company assignments/bordereaux/settlements and lifecycle transitions.
- [x] Claims dossiers/events/coverage/parties/missions/provisions/operations/documents.
- [x] Attestation deliveries/stock/cancellation/returns and related business references.
- [x] Companies/conventions/tariff grids/references and administration; auth/session actions excluded.
- [x] Tests: rollback/no-op/deduplication/first-save, agency/admin boundaries, API contract.
- [x] Coverage review against mutation controllers, frontend callsites and service entry points in the action matrix.
- [x] Batched focused verification and migration source review; no production packaging.

## Current Files

Backend foundation: activity/*, entity/BusinessActivity, repository/BusinessActivityRepository,
service/BusinessActivityService, controller/BusinessActivityController,
dto/response/BusinessActivityResponse. Recorder propagation is MANDATORY.
Migration: assurance-backend/sql/migrations/20261105_business_activity.sql.
Frontend: features/admin/business-activity.ts and pages/AdminActivityPage.tsx,
admin-access.ts, router.tsx and lib/authorization.ts. Operator filtering reuses
admin users query; activity search/filtering is server-side. Related links are only
shown for the current agency and permitted routes; deleted primary subjects are
not linked. No raw origin codes/request IDs/technical table trees are displayed.
ActivityValues formats allowlisted fields and computes before/after differences.
Unit tests cover diffs, precision, operator names, agency mismatch, no-op saves,
aggregate grouping/failure cleanup, client/doc snapshots, screen allowlist, amendment
context/payload comparison and frontend API context. Frontend typecheck passed and
25 focused frontend tests passed. After fixing Mockito inline Byte Buddy attachment
using the cached agent explicitly, all 22 activity mapper/recorder tests passed.
The 40-test focused run had two attachment test fixture errors (missing agency on
fake documents); those fixtures now include the mandatory agency. The final expanded
batch PASSED: 58 tests across activity values/recorder/access/contract/amendment/
invoice/client/document/surface, client service, attachments and premium receipts.
Command used: mvn -o -q -DargLine=-javaagent:/home/tensey/.m2/repository/net/bytebuddy/byte-buddy-agent/1.14.19/byte-buddy-agent-1.14.19.jar
-Dtest=ActivityValuesTest,BusinessActivityRecorderTest,BusinessActivityAccessTest,ContractActivityTest,AmendmentActivityTest,InvoiceActivityTest,ClientActivityTest,DocumentActivityTest,ActivitySurfaceTest,ClientServiceTest,PieceJointeServiceTest,QuittancePrimeSelectionServiceTest test.
No package/build. Frontend had 25 focused tests + typecheck passing; only the small
reference-cell addition followed those checks (same existing types, diff review).
No dev server, browser harness, live API mutation, or MySQL migration execution.
BusinessActivityRecorder.perform(work, summarize) provides an explicit aggregate
workflow scope: nested records contribute related identities, only the successful
outer summary persists. An unchanged root with no supporting changes is a no-op;
failure emits nothing and
always clears the thread-local scope. Supporting business changes are merged as
readable before/after fields, not just references; unchanged root snapshots cannot
discard real child changes. A null root summary retains successful supporting events.
Non-aggregate service methods can record
their own commands directly. Do not group by timestamps or Hibernate listeners.
ContractActivity now captures an explicit initial allowlist of contract/vehicle/
trailer/guarantee fields and business identities. ContratService is wired for create,
createDraft, updateDraft (existing validated section operation context), target
vehicle/trailer information/guarantees saves, and finalizeDraft. First vehicle/trailer
persistence is CREATED; existing target differences are UPDATED; no-op snapshots
emit nothing. Full operations use the explicit recorder scope. Coverage is still
INCOMPLETE: catalog FK label changes, some vehicle/trailer/person guarantee fields,
financial line detail, assistance, renewal-specific paths, deletion, amendments,
other modules, frontend intent gaps, and integration/transaction tests remain.
Do not claim complete contract coverage yet.

Further implemented in the current batch: catalog labels (company/convention/grid),
origin contract reference, readable status/modes, credit/trailer/person coverage and
quittance line values in ContractActivity. Renewal draft creation/finalization and
quote conversion have explicit aggregate boundaries. Amendment draft save/delete,
validation, rectification and latest-movement removal are instrumented. Amendment
save context is a typed query DTO, separate from persisted domain JSON: SAVE_DRAFT,
SAVE_TARGET with validated kind/index/section, PREPARE_VALIDATION. It cannot suppress
an event or claim successful validation. Actual payload is compared in full.
Rectification records one replacement operation, including old/new movement and
actual snapshot targets. Automatic previews and validated-target local preparation
remain unrecorded. More service-level/transaction regression tests still required.

CRM clients/groups/acquisition/payment-condition versions and PieceJointeService
document lifecycle are now wired. Client aggregate creation includes automatic
acquisition/group membership; sequential frontend document uploads remain separate
committed actions with retry semantics. Pure snapshot tests exclude paths, hashes,
row IDs, ordering-only phone changes and technical metadata. Secondary action and
coverage review remains open before marking a whole module complete.

Allowlisted X-Activity-Surface screen hints are captured at authenticated request
start and retained across refresh retries. Backend stores enum + localized label;
browser cannot claim SYSTEM/IMPORT. This is descriptive context only, not authority
over actor, tenant, changes, action outcome or event suppression. The additive SQL
also handles an earlier table lacking surface and repairs actor FK to SET NULL.
The migration has NOT been executed against MySQL.

Client accounting document issuance (including convention invoices and invoice
from statement/direct payment), replacement and cancellation are now wired.
InvoiceActivity retains immutable header/line amounts and actual source references
inside one document event. No individual line/schedule events are introduced.
Premium receipt issuance records successful new archives only; repeated selections
return the existing archive with no event. Archive deletion records receipt/payment
and date, never storage path/hash/technical selection JSON. Historical legacy
receipt identity is scoped to its payment (LEGACY:<paymentId>), not confused with
numbered archive IDs. Important: receipt selection A:<id> refers to the billable
element, NOT the assistance entity. API read/reopen paths remain unrecorded.
Payment workflows still need their own explicit root scope so automatically issued
invoices become supporting details of the payment action, not independent clicks.

Also wired: actual draft tariff recalculation (preview/no-op excluded) and draft/
devis deletion. Deletion captures the business snapshot before removal. Existing
technical audit remains unchanged. Review deletion under a broader explicit scope
when subordinate stock/assistance services gain their own activity events.

Next implementation priority after the frontend-flow review:
1. Review the expanded contract snapshot allowlist and catalog FK human labels; target-specific
   context must identify affected vehicles/remorques/guarantees, not just all records.
2. Review renewal/conversion/amendment instrumentation with service-level workflow tests
   and target identity/no-op rules; pure mapper/API context tests already pass.
   Do NOT mistake automatic preview for autosave.
3. Resolve/describe multi-request button semantics (pre-validation amendment draft
   save and assistance synchronization) without timestamp heuristics or trusting
   a caller flag to suppress genuine persisted changes.
4. Continue the remaining modules in the action matrix, then batched verification.

Payment action tracing is now in the matrix. Implemented in the current batch:
ReglementClientService.create/createDirectDeposit/savePayment, createInvoiceFromPayment,
cancel, changeInstrumentStatus/registerBankRejection, replacement and representation,
and the remittance/reconciliation instrument transition entry points. Payment
creation does NOT automatically call document creation in the inspected savePayment
path; invoicing an existing direct payment is a separate explicit user action.
That latter operation both creates an invoice and rewrites allocation targets, so
it now has one outer aggregate around both. Do not infer automatic invoice issuance
merely from a shared DocumentClientService helper.
PaymentActivity preserves readable instrument/collection/assignment/adjustment state,
not allocation row IDs or evidence paths. RejetBancaireSuiviService records one actual
rejection occurrence or explicit follow-up note, not propagated ancestor history rows.
BankRemittanceActivity + BordereauRemiseService distinguish provisional creation,
deposit, add/remove instrument, collection/rejection and draft deletion; the explicit
outer scope absorbs nested instrument operations. The frontend has no direct current
caller for settle/reject line APIs; they remain exposed backend actions.

Verification of the payment/remittance batch PASSED: 96 tests, no failures, errors
or skips. This includes actual Spring/JDBC transaction rollback and mandatory
transaction enforcement, replacement/rejection service cases and remittance grouping.
The clean test run repaired partial generated compiler output; do NOT use
-Dmaven.compiler.useIncrementalCompilation=false against partial artifacts.
No application package or dev server was started.

New tests: PaymentActivityTest (pending-vs-collected, source refs, row-order/ID no-op,
no evidence paths), actual Spring/JDBC transaction rollback + mandatory transaction,
service-level provisional-remittance grouping, replacement grouping/failure paths.
Existing service fixture constructors now use a real ActivityRecorderFixture with
isolated repository mocks; source/domain fields required by persistence are retained.

Next: remaining treasury implementation. Already read ReleveBancaireService full
import/save/validate paths and related entities/DTOs, TresorerieService account and
client/company ledger posting/reversal paths, SessionCaisseService open/close,
OperationTresorerieService transfer/adjustment/claim posting/cancellation,
TresorerieAccessService replaceAssignments. These are now instrumented, including
account configuration/status, explicit access replacement, automatic personal cash
account synchronization, client/company posting and reversals, transfers, cash-bank
deposit transfers, adjustments, claim treasury posting and operation cancellation,
cash session open/close and bank statement import/selection/validation.
TreasuryActivity and BankStatementActivity retain actual business state and typed
references. Debit/credit writes of one operation are not separate activities.
Bank reconciliation validation has an explicit outer aggregate around collection
and ledger posting. Company-payment/claim callers still need their outer scopes
in the remaining module work; until then supporting treasury records may appear
separately on those not-yet-instrumented flows. No whole-module completion claimed.
saveReconciliations clears EntityManager and recreates selection rows: snapshot
before clearing, compare canonical business selections after reload. Automatic match
suggestions/preview/raw parsing data are not events. The UI saves selections and then
validates in separate HTTP transactions; don't pretend the first rolled back if the
second fails. Sessions-caisse route redirects to accounts; only the API is present.
Use account/operation/movement/session domain snapshots and explicit aggregate scopes;
cash transfer's debit/credit writes are supporting details, not independent clicks.

Cross-agency aggregate isolation is now tightened: supporting commands owned by a
different agency are persisted separately and never merged into an agency-owned
root's labels/changes/references. A platform-mode regression test covers this;
selected-agency mismatch still rejects the entire transactional action.

Activity lists now use an explicit Criteria constructor projection excluding the
large changes JSON. GET /api/v1/business-activities/{id} loads details under the
same administrator/permission/agency checks; no foreign-agency ID fallback.
Frontend loads details on demand with loading/error/retry states. List/detail cache
keys are agency-scoped; open modal selection is also operator/agency-scoped.
Revisiting refetches history; pressing Search with unchanged filters refreshes.
Frontend typecheck PASSED and 21 focused frontend tests PASSED in this batch.
Treasury/detail backend focused tests PASSED: 102 tests, no failures/errors/skips.
Repository projection still needs an actual JPA query integration check; service
access tests alone do not prove generated SQL behavior or list performance.
Also inspected stock public entry points and cancellation number provenance: the
attestation number is read from the actual locked stock item / saved numeroAvant,
not inferred from technical audit text. Stock instrumentation is not implemented yet.

Remaining verification gaps: service-level contract/amendment/treasury orchestration
cases, live agency-scoped persistence
queries against MySQL, migration execution, frontend visual check under no-dev-server
constraint, and whole-module endpoint/action coverage. Unit tests do not close these.

Stock action tracing is complete for the inspected page/API/controller entry points:
commands and direct receptions share creer but have different server-validated
source; addLots is one reception even with several lots; separate delivery validation
is another action. Current code makes received attestations available when lots are
created, not only when delivery validation is clicked. Do not invent a delayed stock
availability transition in the history. Cancellation number comes from the locked
attestation. Threshold recomputation is supporting state, not another user action.
Stock recording is now wired in AttestationStockService and LivraisonAttestationService:
control setting, threshold upsert/update (new vs existing identity), cancellation,
consumption and both release overloads, order/direct reception, multi-lot receipt,
delivery validation. Released stock retains prior contract/movement/target references
before FKs are cleared. Threshold recalculation creates no standalone business event;
delivery snapshots retain quantities and ranges, not an event/reference per stock row.
Repeated unchanged delivery validation is omitted. Existing domain/audit writes and
stock timing are unchanged. StockActivityTest covers locked-number provenance,
invalid cancellation, released references and range-level aggregation. Delivery test
constructor updated. Verification PASSED: the combined stock/company-payment batch
ran 111 tests with no failures, errors or skips, including existing payment cases.

ReglementCompagnieService now has explicit aggregate scopes for create,
changeInstrumentStatus and cancel. CompanyPaymentActivity preserves header,
instrument, allocation and real pending/confirmed/compensation state. Confirmation,
rejection and cancellation absorb subordinate treasury effects into the company
operation; actual tier-company identity is TIERS_COMPAGNIE, not an insurance-company
ID, and company instruments have their own record type distinct from client ones.
CompanyPaymentActivityTest includes a service-level grouped bank posting and failure
case. Frontend creation/status actions and cancellation API traced; no current page
caller for cancelCompanyPayment was found. These tests passed in the 111-test batch.
Company bordereaux and assignments/rules were the next batch; their current
implementation status is recorded in the following section.

## Continued Company And Claims Implementation

Company bordereaux and assignments/rules are now wired (not yet compiled/tested):
- Bordereau create/update/validate/transmit/reconcile/cancel records one operation
  with actual totals and source references. Recreated line IDs/order do not count
  as changes; unchanged reconciliation is omitted. Removed sources' references are
  captured before line replacement and retained in the event.
- Assignment single/batch saves compare actual old/new rows by business content.
  Batch validation already restricts selection to one fleet contract; that contract
  is the aggregate subject and all source quittances remain references. First
  assignment differs from update; empty clear and unchanged save are no-ops.
- New activity reads include agency scope in the assignment repository query.
- Rule create/update/delete retains business rates, dates, import-column settings
  and company/branch references, never audit modifiers. Existing version/use rules
  and financial calculations are unchanged. Import preview remains read-only.

Claims are now wired through SinistreService, SinistreDossierService,
SinistreDocumentService and SinistreIntervenantService (not yet compiled/tested):
- Draft/direct declaration, general information, explicit status transitions/reasons
  and early deletion. Existing workflow/readiness checks and domain history remain.
- Single/bulk guarantee decisions, party addition/update/removal, provisions,
  mission creation/update, financial operation creation/cancellation, documents
  upload/review/delete, expert and garage configuration.
- Explicit recorder scopes group agency-treasury posting/reversal and automatic
  settlement-status effects under the actual claim operation. Direct-company
  operations remain distinct from agency treasury; estimates remain provisions.
- ClaimActivity compares snapshot parts by real internal IDs but emits human field
  labels. Removing one party cannot make every following party look edited merely
  because its display index shifted. Events/workflow hints/versions are excluded.
- Child operations use their actual child identity as subject, with SINISTRE and
  contract/client/coverage references retained. Deleting a party/document does not
  label the claim itself as deleted. Newly saved child identity is resolved from
  actual before/after references, not trusted request labels or timing heuristics.
- File snapshots keep sanitized original names and metadata, never storage keys.
  Existing rollback/after-commit file cleanup is preserved.
- Frontend action/API/controller tracing completed for declaration/list/detail/
  reference pages. One shared finance form chooses provision OR actual operation;
  it does not justify merging two separate HTTP saves. Number/coverage previews,
  downloads and read-only document requirements are not user activity writes.

The activity list now prioritizes related claim/payment/contract context and links
known company bordereaux through existing permission checks. Screen hints distinguish
company assignment, claim declaration, claim detail and claim settings. These enum
additions need no extra DDL beyond the existing VARCHAR-based activity migration.
Added deferred regression cases for assignment/bordereau row recreation and claim
party deletion; updated the existing claim service fixture to exercise the real
recorder. No Maven, npm test, typecheck, build, package or dev server run in this pass.
Only scoped diff review/checks so far; the earlier 111-test pass predates these edits.

Next: companies/references/tariffs and remaining cross-module
coverage review. Administration wiring is described below; final verification remains open.
Do not start another Maven run until remaining implementation is complete, per the
latest user feedback. Final verification and actual JPA projection query checks
remain required; current code is not a completed release claim.

Frontend action matrix is maintained in BUSINESS_ACTIVITY_ACTION_MATRIX.md.

## Continued Administration Implementation

AdministrationActivity and AdminService now record user/platform-administrator
creation, identity/role/agency/active-state updates, deactivation, role creation/
update/deletion and agency creation/settings/logo/signature changes. Snapshots are
an explicit allowlist, not entity serialization. Role permissions reflect the
actual resolved backend permissions, not only requested IDs. Passwords/hashes,
session tokens, device identifiers and generated storage paths/names are excluded.
Branding tracks presence and successful replacement, preserving separate HTTP
transactions and existing file cleanup. Repeated absent removal is a no-op.

User saves/deactivation use an explicit aggregate so automatic cash account/access
changes contribute to the user operation. Cross-agency transfer details are global
platform facts; underlying account effects stay in their own tenant history.
Platform-administrator operations and platform agency creation use recordPlatform,
which validates an actual global SUPER_ADMIN and requires ADMINISTRATION with no
agency ownership. It writes in the same transaction without merging into a selected
agency operation. It does NOT relax ordinary record() tenant checks, change session
context, or expose a public event-write API. Agency creation remains platform-only
regardless of whether that administrator currently selected an agency.

Latest user decision: auth/session activity is not needed in business history.
Login/logout/refresh, password changes/resets, standalone session revocations and
agency-context switches remain in the existing sessions/security/technical audit
mechanisms. Temporary AuthService hooks were removed; git diff confirms AuthService,
AuthServiceTest and RefreshSessionRepository are unchanged. User creation,
deactivation, role/permission changes and agency settings remain administrative
business actions. Password-only user-form saves emit no business event.

Frontend-to-service tracing includes AdminPanels user/platform-admin/role/agency/
asset saves, partial asset failure, profile/session/password and context switching.
Three security regressions were added to the existing recorder test file (global
recording with an agency selected, non-platform rejection and operational-scope
bypass rejection). NOT RUN: no Maven, compiler, npm test/typecheck, package or dev
server in this pass. Scoped tracked-file diff check passed; new mapper and recorder
code were reviewed manually. The earlier 111-test pass predates this and the claim/
company batch. This is not a release-ready or whole-goal completion claim.

## Continued Assistance And Green-Card Implementation

AssistanceAutomobileService and AssistanceVoyageService now have explicit aggregate
boundaries for draft section saves, creation, draft finalization, direct update and
renewal. Underlying pricing/eligibility/billing/lifecycle code is unchanged. First
draft creation is distinguished from later saved sections; unchanged updates/saves
are omitted. Finalization creates a new validated contract and removes the old draft
in the existing domain workflow; the single validation event keeps the old draft
reference and does not create a separate cleanup-deletion action.

AssistanceActivity captures explicit contract/client-role/vehicle/assistance/travel
pricing parts. It reads actual persisted child rows with contract AND agency scope,
because update replaces pricing/role rows without necessarily refreshing parent
collections. Comparisons align client roles by role+client and pricing by assistance+
insured identity, not recreated row IDs or display indexes. Historical snapshots
retain the actual backend amounts and typed billable/movement/vehicle/client/origin
assistance/contract references. No independent frontend financial rules added.

AssistanceContratService upsert/deactivate records real create/update/replacement/
deactivation. Nested contract/amendment calls contribute to their existing outer
action. Separate frontend draft assistance synchronization remains its own committed
request, so partial failure does not invent atomic success. Replacement retains the
previous assistance/movement/billable references before the source is deactivated.
AssistanceQuittanceService remains subordinate synchronization, not a user event.
ContractActivity now also retains assistance/product/company/billable references
for paths that clone or restore assistance directly rather than calling upsert.

CarteVerteService and GreenCardActivity record create/update/replacement/deactivation
with actual card/contract/movement/vehicle/client/billable identities and amounts.
Repeated inactive removal or unchanged business content emits no event. A technical
creation-date refresh during save is intentionally not treated as a business edit.
Backend permissions/tenant validation and existing accounting behavior unchanged.
Screen context recognizes the actual /contrats/:id/cartes-vertes route. New type/
surface enum values use the existing VARCHAR activity columns; no extra DDL.

Existing AssistanceVoyageServiceTest now uses the real recorder and capture helper
for first subscriber-save activity, verifies no financial writes, and contains
decimal/no-op and recreated-pricing-row regressions. Existing screen-context test
has the green-card route. NOT RUN: no Maven, compiler, tests, typecheck, package,
build, dev server or browser harness in this pass. Tracked scoped diff checks passed;
new helper files were manually reviewed. Final JPA/query/integration/service
coverage and migration execution remain unverified. Earlier 111-test results
predate these edits and do not prove this batch.

## Continued Reference Configuration Implementation

BanqueService explicit create/update now uses BankReferenceActivity with real bank
identity and agency-owned code/name/aliases/order/active changes. Canonical alias
order avoids false edits from collection order. Default-bank provisioning on list
and initializeDefaults remains unlogged, not an invented click per default bank.

ContactCompagnieService create/update/status now uses CompanyContactActivity with
actual contact/company/service/contact-method/principal/active details. Choosing a
new principal clears other principals through the existing bulk update, which also
clears EntityManager. A new agency+company+service query captures affected principal
identities as immutable references before that clear. Their loss of principal
status is a consequence in the root contact event, not one event per cleared row.
Status deactivation retains actual principal removal; repeat no-ops are omitted.

RegleFiscaleService create/update/deactivate uses FiscalRuleActivity, including
actual nature/calculation/scopes/guarantees/type/usage/date/priority/applicability/
regulatory reference. Before references survive scope changes; used-rule/version
and date restrictions remain unchanged. TarifUsageAjustementService.apply records
one scheduled adjustment/reset batch with actual selected tariff references and
line base/version values, dates and reason. It does not claim the stored initial
tariff was rewritten or the future version already applies to today's contracts.
Read-only tariff/promotion/fiscal resolution and history stay uninstrumented.

Fiscal rules and adjustment batches are global entities, not tenant-owned data.
BusinessActivityRecorder.recordGlobalReference is an explicit MANDATORY writer for
only REGLE_FISCALE/AJUSTEMENT_TARIF_USAGE in REFERENTIELS, requires the actual
matching management permission (or config:manage), and stores a null-agency event
even when the actor selected an agency. It cannot accept operational subjects or
an agency-owned command, does not mutate TenantContext, and does not relax record()
tenant guards. These global events remain platform-history only under current read
authorization. No public event-write API, new permission or schema change added.

Frontend/controller/service tracing completed for these four configurations. Added
global scope/permission/rejection cases to existing recorder tests and version/date/
base-preservation assertions to existing adjustment tests; adjusted fake saved batch
IDs. NOT RUN: no Maven, compiler, tests, typecheck, build/package, dev server or
browser harness. Scoped tracked-file diff checks passed; new mapper files reviewed
manually. Actual JPA query behavior and service/integration coverage remain open.

Next: the remaining ReferentielController catalogue mutations (grids, grid-usage
replacement, guarantee lines/person formulas, usages and other maintained references).
Company/convention/assistance-catalogue writes are now wired as described below.
The remaining controller mutations contain many
direct repository writes, some without a transaction; the new activity must share
the actual operation transaction without changing version or financial rules.
Global vs agency-owned grid/convention/intermediary-code facts need explicit scope,
not the actor's selected agency applied blindly. Then complete the full action
coverage audit, migration review and batched final verification. Whole-goal status
remains active/incomplete; prior 111-test results predate these implementations.

## Continued Company Catalogue Implementation

Seventeen ReferentielController mutation endpoints now enter the service-owned
CatalogueActivityService.perform transaction boundary before their existing logic:
insurance company create/update; assistance company create/update/deactivate;
assistance product create/update/deactivate/permanent deletion; product tariff and
promotion create/update/deactivate; convention create/update. Their existing
validation/application/response helpers remain in place without a broad domain
rewrite. Earlier controller transaction annotations remain compatible; previously
unbounded catalogue mutations now persist state and activity in one transaction.

CompanyCatalogueActivity keeps explicit immutable typed states for these entities.
Shared insurance/assistance company, product, tariff and promotion history is global.
Conventions and intermediary-code configuration are agency-owned. The global writer
allowlist now explicitly accepts those global company catalogue subject types in
COMPAGNIES with referentiel:manage/config:manage; existing fiscal/adjustment subjects
still require REFERENTIELS. Operational/private commands cannot use that path.
Ordinary tenant checks and global-history read restrictions are unchanged.

Agency intermediary-code create/update/removal is recorded from the actual agency-
company configuration ID/FKs inside saveCodeIntermediaire. It never enters a global
company snapshot. A mixed form may create two scope-correct facts in the same
transaction; a code-only change creates no false shared-company edit. Empty removal
and unchanged saves emit nothing. Automatic TiersCompagnie projection remains
subordinate provisioning, not another user action. Auth/session scope remains out.

Product snapshots include actual eligibility/company/category/usages and benefits.
Jsoup parses sanitized benefits to readable text, never HTML execution; an actual
formatting-only change is a presentation update without exposing internal markup.
Product permanent deletion preserves child tariff/promotion details/references in
one event before cascade removal; ordinary DELETE deactivation is not called product
deletion. Tariff/promotion overlap, date/age/type and HT/TTC rules are unchanged.
Convention snapshots include actual company/category/grid/usages/period/fraction-
nement and both previous/new references. Convention grid selection was tightened
to the existing findAccessibleById(agency,id) query, allowing shared/current-agency
grids but rejecting another agency's private grid; no data migration in this batch.

Actual frontend controls/API methods inspected: CompaniesPage, CompaniesConventions-
Page, AssistanceSettingsPage, AssistanceProductsSettingsPage, reference-admin and
assistance-product endpoints. Inline grid creation is a separate HTTP save and
still belongs to the next grid batch. Added isolation, formatting-only and no-op
regressions to the existing recorder test file. NOT RUN: no Maven/compile/tests/
typecheck/build/package/dev server/browser harness. Tracked diff checks passed;
new mapper/service source manually reviewed. Prior 111-test results do not cover
this batch. Final transaction/JPA/service/runtime verification remains required.

Remaining implementation after the grid batch below: guarantees/exclusion groups,
usages/trailer rates, basic maintained references/categories/stock groups and base
usage tariff mutations. Then finish cross-module mutation coverage, migration review
and batched final verification. Do not claim whole-goal completion yet.

## Continued Tariff Grid Implementation

Seven tariff-grid mutation entry points now use the catalogue service transaction:
grid create/update, individual line create/update, individual person-formula create/
update and whole-grid-usage configuration replacement. GridCatalogueActivity keeps
actual labels, criteria, rates/franchises/premiums/capital, person protection amounts,
accessories, ordering and active state with grid/company/guarantee/usage/category/
sous-classe references. Scope comes from the actual parent grid, not selected agency
alone. The explicit global writer accepts the three exact grid-related subject
types in COMPAGNIES for grille-tarifaire:manage/referentiel:manage/config:manage;
private-grid commands continue through ordinary tenant recording.

The matrix emits one SAVED root event, not one event per line/formula repository
write. Before/after snapshots align surviving identities first, then identical
recreated business rows with the same typed reference identities. Creation/removal
or real changed values remain visible; pure technical row replacement does not.
Both old/new child references survive. Universal/null-usage rows are captured since
they are visible to this matrix. The original exact-usage deactivation loop and
formulesPersonne=null preservation rule remain intact. Null-usage rows may still
become usage-specific through this existing workflow; a non-universal row belonging
to a different usage is rejected. Provided stale/foreign IDs now fail rather than
silently creating a row for an unknown identifier. No pricing calculation rewrite.

Scoped grid listing and grid/line/formula lookup now accept only shared/current-
agency data. New formula accessible lookup and repository-side option queries apply
agency, grid, usage, guarantee and active filters; formula GET no longer loads every
formula across agencies and filters in Java. Existing option ordering and universal
row semantics are retained. Reads remain activity-free. CompanyCatalogueActivity
also now detects a real reference-ID change when display values happen to match,
without treating reference ordering as a modification.

Actual frontend paths inspected: CompaniesPricingGridsPage, TariffGridSection,
CompaniesConventionsPage inline creation, GrilleTarifaireConfigurator submission,
pricing API and line/formula/matrix DTOs. Added recreated-row/actual-change and
identically labelled reference regressions to existing recorder tests. NOT RUN:
no Maven/compiler/test/typecheck/build/package/dev server/browser harness. Scoped
tracked diff checks passed; new mapper reviewed manually. JPA query behavior,
aggregate transaction/runtime coverage and final release verification remain open.

The remaining reference catalogue batch is implemented below. Full frontend/API/
service mutation coverage audit, migration review and batched final verification
remain open. Goal remains active/incomplete.

## Remaining Catalogue And Production Coverage Batch

ReferenceCatalogueActivity captures an explicit business allowlist for usages,
base usage tariffs, vehicle makes/body types/fuels/subclasses, client/transport
categories, stock usage groups, guarantees and guarantee-exclusion groups. All 24
corresponding mutation handlers now use the existing service-owned catalogue
transaction boundary. Actual first creation is CREATED; an existing save is UPDATED
only for real differences. Base-tariff DELETE is a soft deactivation, not a claim
that the historical tariff row was removed. Existing adjustment-history restrictions,
reference validation and pricing calculations are unchanged.

The trailer-rate button persists multiple usages in one request: one SAVED
configuration event lists only actually changed usage/rate pairs, retaining the
usage identities. Guarantee company-prorata join rows are summarized within the
guarantee save, not exposed as independent user actions. Snapshots retain old/new
typed reference identities and sorted set labels; reference-ID changes remain real
even when displayed labels match. Global reference writers require referentiel:manage
for these specific record types and cannot become owned by the selected agency.
No new permission or schema column is needed for these VARCHAR-backed types.

Frontend sources inspected: ProductionReferenceSettingsPages (including its simple/
code reference subcomponents), reference-admin API, TarifUsageSettingsPage/pricing
API and all corresponding request helpers/entities. No frontend business-event
write call or untrusted claim of successful persistence was introduced.

The mutation coverage audit additionally found and fixed two distinct production
paths: generic POST /contrats/{id}/mouvements, and validated-contract financial
history recalculation. The former uses one explicit workflow event with its newly
persisted movement, contract/client/vehicle/trailer/guarantee/receipt references,
authoritative amounts and any actual contract status transition. Specialized
amendment methods remain under their existing roots, preventing duplicate events.
No current frontend generic-movement caller was found; do not invent a button.
The recalculation dialog separately previews and applies. Only successful apply
records one RECALCULATED event, comparing immutable before/after movement, quittance,
billable-element, category and target-distribution values. Technical recreation of
line/target row identities is not a change; unchanged business content is omitted.
The existing financial eligibility checks, locks and replacement calculations remain
unchanged. Existing quittance and element identities are updated in place.
Target attribution is read through an agency-and-contract-scoped repository query
using actual vehicle/trailer foreign keys, not guessed from summary display indices.
Changes to the underlying target identities are detected even for identical labels.

Migration validation now includes all current surfaces (green cards, company
assignments, claim declaration/settings), plus module/action/subject-type enums.
The additive migration is still NOT EXECUTED and no historical audit backfill is
introduced. No Maven/compiler/test/typecheck/build/package/dev server/browser
harness run in this batch; no new test files. The existing movement test constructor
was updated for its recorder dependency. Scoped tracked diff checks passed; new
mapper code was reviewed directly. These are implementation/static checks, not a
completed runtime/integration or release-verification claim.
The read-only source consistency check passed: 49 catalogue mutation handlers =
48 transaction wrappers + the already instrumented tariff-adjustment service
delegate; all 29 surfaces, 10 modules, 25 actions and 81 subject types exactly match
the migration validation lists. AuthService/AuthServiceTest/RefreshSessionRepository
remain diff-empty. These checks do not substitute for JPA/query/transaction tests.

## Cross-Module Reference And Read-Side Review

ContractActivity now retains before/after business references rather than dropping
old selections on update. Changes also compare stable header, role, maintained
vehicle-reference, guarantee-selection and assistance-selection identities when
labels happen to match. Draft target/guarantee/assistance/billable row recreation is
explicitly excluded from identity-only modification detection: draft targets are
matched by their existing workflow position, not regenerated persistence IDs.
All six supported client roles are represented; empty roles do not create blank
detail rows. Actual principal-role changes remain business differences. References
are deduplicated by typed identity, with the current label retained. Amendment
validation/rectification/deletion reuse these comparisons and preserve old context
without copying unrelated historical movements into the operation.

CRM client updates capture immutable values, relationships and references before
mutation. Parent, city and category replacements are retained/detected even for
equal labels; phone row ordering/replacement remains ignored. Acquisition records
retain old/new origin and employee/client prescriber identities. Group settings
retain previous/current responsible clients and members; same-name responsible
client changes are not suppressed. No frontend/public API contract or financial
calculation was changed by these internal snapshot fixes.

Regressions were added to the existing ContractActivityTest/ClientActivityTest
files, not new test files. The existing BusinessActivityTransactionTest now also
sets up the actual Hibernate entity model with an isolated in-memory database,
exercising the real projection query through BusinessActivityService filters:
agency isolation, null agency/actor rows, literal search escaping, actor filtering,
pagination and SQL exclusion of changes_json. The original transaction rollback
and mandatory propagation checks remain. This is not a claim that the new checks
have passed yet.

The batched focused backend run covered 201 tests: 198 passed initially and three
BankRejectionServiceTest cases failed because the existing test fixture lacked its
RejetBancaireSuiviService dependency. Added that missing mock, then reran only this
class: all 11 tests passed. No production logic was changed to accommodate the
fixture. Together the selected 201 tests are verified against the current backend.
BusinessActivityTransactionTest's three checks passed, including the actual JPA
projection/filter/paging/SQL assertion. ContractActivityTest's six and
ClientActivityTest's three checks passed, including the latest relationship fixes.

Frontend npm run typecheck passed. The three focused frontend files passed all 25
tests (business activity queries, request surface context, amendment API context).
The operator filter now includes platform administrators only for actual platform-
admin viewers, using the existing protected API and its own scoped cache key;
ordinary agency administrators do not request that global list. Failed operator
loading has an explicit retry state. After typecheck only a CSS-class change was
made to preserve multiline before/after values. No production build/package,
dev server, browser harness or live application API mutation was run.

## Completion Evidence

| Requirement | Current evidence |
|---|---|
| Separate, admin-only history beside audit | AdminActivityPage route/nav and activity:view seed/migration; BusinessActivityService administrator/agency checks; access regressions passed |
| Action/workflow events, not entity-write grouping | Explicit service commands/perform scopes across the action matrix; recorder aggregation/no-op/failure tests passed |
| All maintained modules and reused APIs | Frontend/API/service matrix; 241 mutation mappings across 22 controllers reviewed, including deliberate read-like POST/auth exclusions; 49 catalogue mutations accounted for |
| Contract first entry, sections, validation and amendments | Contract/AmendmentActivity and service boundaries, typed draft context; mapper and service regressions passed |
| Historic source context and readable changes | Typed immutable references/allowlists, previous/current relationship retention, real foreign-key target attribution; contract/client/stock/accounting mapper checks passed |
| Transactions and agency isolation | MANDATORY recorder, explicit tenant/global/platform writers; rollback/access tests and actual scoped JPA query test passed |
| Filters, paging and detail | Server projection excludes changes_json; actual Hibernate filters/paging/literal search/null-reference tests passed; frontend queries/context tests and typecheck passed |
| Existing technical audit and sessions preserved | Separate activity model/table; audit collection logic unchanged; AuthService/AuthServiceTest/RefreshSessionRepository remain diff-empty |
| Deployment artefacts | Additive MySQL 8 script, role grants, FK/JSON/enum/count validations; enum/source consistency check passed; script not executed |
| Final checks | 201 selected backend tests verified, 25 frontend tests and frontend typecheck passed; scoped diff checks passed |

## Rollout And Limits

Apply assurance-backend/sql/migrations/20261105_business_activity.sql to the
application MySQL database before deploying this feature. It uses DDL that can
auto-commit and must be run with appropriate schema/routine privileges. It is
additive/idempotent for the supported prior version, grants activity:view to
existing SUPER_ADMIN/AGENCY_ADMIN roles and includes post-run validation queries.
It does not reconstruct business intent from old technical audit rows. New actions
are recorded after rollout; historical technical audit remains accessible.

Not performed: production migration/deployment, live browser/API smoke testing,
MySQL execution of the deployment script, full production packaging. The JPA query
test uses Hibernate with H2, not a production MySQL instance. Those limits do not
imply a production rollout or end-to-end workflow test claim.

Internal delivery review (1-5): accuracy 4 (selected checks pass; no live MySQL
execution), completeness 4 (matrix implemented; no browser E2E), clarity 4 (French
action-level details; long fleet contexts can remain lengthy), actionability 4
(migration supplied; deployment still operator-controlled), conciseness 4 (one
event per workflow; large legitimate changes can have many detail fields). Average
4.0. Highest-impact follow-ups are the deployment script/validation queries and a
post-deployment smoke check, not more incremental builds. This assessment concerns
the delivered code and stated limits, not a claim that every production scenario
was executed here.

## Constraints

Existing worktree includes unrelated frontend infrastructure/line-ending changes.
Do not revert those. User prohibits starting a dev server and incremental builds.
Run focused tests after coherent batches; do not run production packaging.
No subagents unless separately authorized.
Latest user feedback: do not run Maven incrementally while implementing. The
historical 102/111-test batches are finished; the final 201-test selection and the
single failing-class fixture rerun are now finished. No verification process is live.
Frontend typecheck and 25 focused tests passed. Scoped diff check passed with
core.whitespace=cr-at-eol; an unscoped check reports existing unrelated CRLF UI files.

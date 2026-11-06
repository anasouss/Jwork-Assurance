# Frontend / API / Service Activity Coverage

Status: implementation and source coverage review complete for the maintained
modules and actions inventoried below. Final selected verification passed. This
does not claim production deployment or live browser end-to-end execution.

## Verified Production Flows

| User action | Frontend path | API/service path | Required business meaning |
|---|---|---|---|
| Create contract/devis | ContratFormLayout.handleCreate -> useContratCreationForm createMutation | contract creation/finalization/renewal APIs -> ContratService | One successful aggregate event; retain created client/vehicle/guarantee/movement identities as context, not table-write events |
| Save subscriber/owner/contract/grid/guarantees/mono vehicle section | useContratCreationForm.handleSaveSection -> saveDraftMutation | updateContratDraft with existing allowlisted X-Audit-Operation -> ContratService.updateDraft | Actual saved differences with section context; payload is the WHOLE draft, so never claim only the selected section changed without comparing actual state |
| Synchronize linked assistance after section save | saveDraftMutation / saveTargetDraftMutation -> syncDraftVehiculeAssistance | separate assistance requests AFTER draft persistence | Explicit multi-request workflow; do not claim whole-button atomic success if assistance fails |
| Save fleet vehicle information | saveTargetDraftMutation, part=info | saveDraftVehicule -> ContratService.saveDraftVehicule | Vehicle added on first persistence; existing data changed only when actual values differ; include contract/target |
| Save vehicle guarantees | saveTargetDraftMutation, part=garanties | saveDraftVehiculeGaranties then assistance synchronization | Saved guarantees with vehicle and contract context; auxiliary synchronization is not another user click |
| Save trailer / its guarantees | saveTargetDraftMutation | separate remorque info/guarantees endpoints | Same first-save/no-op rules and explicit target context |
| Amendment automatic preview | AvenantContratPage useEffect, 350 ms | previewAvenant -> read-only application/service preview | NO business activity: preview, not draft autosave |
| Amendment preview button / target preview | previewMutation / targetPreviewMutation | same read-only preview endpoint | NO persisted activity |
| Save amendment draft | saveDraft -> draftMutation | saveAvenantDraft -> AvenantApplicationService.saveDraft -> AvenantDraftService.save | Explicit draft-save activity; distinguish first persistence and actual subsequent changes |
| Save amendment target info/guarantees | saveTargetDraft -> same draftMutation | SAME full-payload draft endpoint, typed query context SAVE_TARGET/kind/index/section | Context validated against the payload/current target count; actual full payload differences retained, not filtered by claimed section |
| Prepare target edits on validated amendment | saveTargetDraft with validatedMovementId | NO save API: toast + preview only | NO saved/modification event until final rectification succeeds |
| Validate new amendment | saveMutation | first saveAvenantDraft, then createAvenant | Preparatory save and final validation are one UI workflow but TWO transactions today; do not infer grouping from timestamps, suppress based solely on caller flags, or report validation before success |
| Validate amendment rectification | saveMutation with validatedMovementId | rectifyAvenant -> ContratService.rectifierAvenant | One successful rectification event with contract, actual movement and changed targets |
| Restart amendment draft | ContratsPage.restartDraftMutation | deleteAvenantDraft -> AvenantDraftService.delete | Draft deleted, not validated movement removed; nothing recorded when no draft exists |
| Delete latest amendment | ContratsPage.deleteMutation with MOUVEMENT | contractApi.deleteMouvement -> ContratService.deleteMouvement | Movement deletion and restored contract state are one action, preserving removed identity |
| Prepare renewal | ContratsPage.renewalMutation / usePreTermeActions.prepareMutation | createRenouvellementDraft -> ContratService | First draft creation only; returning existing draft is not another creation |
| Finalize renewal | usePreTermeActions.finalizeMutation / contract creation hook | finalizeRenouvellementDraft -> ContratService | One renewal validation, related source contract retained; already-finalized response is no-op |
| Convert fleet quote | ProspectionConversionDialog.convertMutation | convertProspection -> ContratService.convertirProspection | One quote-to-contract validation, with attestations/assistance/reference changes |

Sources inspected: ContratFormLayout.tsx, useContratCreationForm.ts,
api/contract-creation.ts, AvenantContratPage.tsx, api/avenants.ts,
ContratController, AvenantController, AvenantApplicationService, AvenantDraftService,
ContratsPage actions, usePreTermeActions, ProspectionConversionDialog.

## Verified CRM And Document Flows

| User action | Frontend/API | Service boundary and meaning |
|---|---|---|
| Create client | ClientCrmPage.ClientDialog createMutation -> clientApi.createClient | ClientService aggregate includes phones, acquisition and group membership as details of client creation |
| Upload files after client creation | Same dialog then per-file attachment upload, retry only remaining files | Independent committed upload/replacement events; a later upload failure must not pretend the client creation rolled back |
| Edit client | Client dialog update | ClientService compares allowlisted business state; recreated phone row IDs/order are not changes |
| Create/edit group | CreateClientGroupDialog / group edit API | GroupeClientService aggregate includes head/responsible/member synchronization, not one event per membership row |
| Assign/end membership | Group assignment dialog | Actual group/client relation changes; choosing independent without existing membership makes no API call/event |
| Acquisition edit | Client acquisition form -> updateAcquisition | Origin/referrer/date/notes saved, not technical modified-by fields |
| Commercial origin settings | CommercialOriginsSettingsPage | Explicit creation/update only; default-origin provisioning during option reads is not user activity |
| Payment condition version | Payment-condition form, optional justification upload | New condition version with readable payer, validity and evidence filename, never storage path |
| Contract/client document lifecycle | Upload/replace/archive/delete/reuse/unlink/assign owner APIs | PieceJointeService records actual action with contract/movement/client/vehicle references; reads and previews excluded |

## Accounting Document Flows Traced And Wired

| User action | Frontend/API | Required service meaning |
|---|---|---|
| Issue statement/invoice | RelevesFacturesPage issue -> createClientDocument | DocumentClientService creates one document with line details and source references, no child-row events |
| Invoice from statement | RelevesFacturesPage invoice dialog -> createInvoiceFromStatement | Include originating statement even though the new invoice does not use documentOrigine (reserved for replacement lifecycle) |
| Revise document | RelevesFacturesPage revise -> reviseClientDocument | One replacement event with old/new document, reason and changed content; immutable old snapshot preserved |
| Cancel document | RelevesFacturesPage cancel -> cancelClientDocument | Cancellation with reason and schedule consequences grouped; no independent schedule-row event |
| Open statement/invoice PDF / export search | clientDocumentPdf / exportClientDocumentSources | Read/export, not document issuance or payment |
| Issue premium receipt | PremiumReceiptDialog.openPdf without archive -> premiumReceiptPdf(issue=true, keys) | New archive only after successful rendering/storage; existing identical selection reuses archive without duplicate issuance |
| Reopen archived receipt | Same dialog with archive -> GET PDF | No issuance event |
| Delete premium receipt archive | deleteArchive -> deletePremiumReceipt | Readable receipt/payment/selection context, no hashes, paths or selection JSON |

DocumentClientService and FacturationConventionService now aggregate successful
issuance/revision; QuittancePrimeSelectionService records only a new issued archive
or actual archive removal. Existing archive retrieval and idempotent selection reuse
remain reads. Invoice/receipt mapper, deduplication and agency/security tests passed
in the 58-test backend batch. Payment roots below are now wired.

## Payment Flows Traced And Wired

| User action | Frontend/API | Service boundary and required meaning |
|---|---|---|
| Save client payment | NouveauReglementClientPage.savePayment -> createClientPayment | ReglementClientService.create -> savePayment: one aggregate includes instruments, allocations, settlement adjustments and immediate treasury posting where applicable |
| Save multi-client bank deposit | Same page chooses createMultiClientBankDeposit when multiClientDeposit + receipt | createDirectDeposit -> same savePayment, with depositor and evidence filename; do not call it a single-payer payment or store evidence path |
| Cancel recorded payment | ReglementsEnregistresPage.cancelPayment | cancel: repeated cancelled payment returns unchanged; first cancellation reverses treasury consequences and cancels allocations in one operation |
| Invoice an existing direct payment | ReglementsEnregistresPage.createInvoice, then GET PDF | createInvoiceFromPayment: invoice creation AND transfer from direct allocations to invoice allocations must share one explicit root; keep payment and invoice as context, do not log allocation row replacement as separate activity |
| Replace payment instrument | ReplacePaymentInstrumentDialog.replace | replaceInstrument: old/new instruments plus payment and reason, original may be pending or rejected; backend eligibility remains authoritative |
| Register bank rejection | BankRejectionDialog.register | registerBankRejection -> SAME changeInstrumentStatus implementation after validation; one rejection operation, supporting treasury/remittance/follow-up consequences grouped |
| Prepare rejected instrument for new remittance | ImpayesClientsPage.representInstrument | representInstrument: preparatory representation, not bank confirmation/collection |
| Add rejection follow-up | BankRejectionFollowUpDialog.save | RejetBancaireSuiviService movement API: explicit business status/date/reason with affected instrument/payment |
| Download payment evidence | ClientPaymentDetails.downloadReceipt | downloadReceipt is read-only, not payment creation |
| Cash/cheque/effect remittance from pending collection | EncaissementsEnAttentePage createRemittanceSlip / createCashRemittanceSlip | BordereauRemiseService root action; child payment instrument status changes must contribute details, not independent user-click events |

Important shared API finding: changePaymentInstrumentStatus is currently defined
in the frontend API module but no direct page caller was found. Bank rejection
uses its validated wrapper; remittance and reconciliation have other service entry
points into instrument processing. Do not assume every public method is a button.

Payment, replacement/representation, bank rejection/follow-up and provisional bank
remittance/deposit/line processing are now wired; the 96-test verification batch
passed. Real recorder scopes are used in service regression fixtures. A focused
Spring transaction test uses H2/JDBC persistence to check actual rollback after an
activity write and MANDATORY propagation, without loading the whole domain schema.

## Treasury Flows Traced And Wired

| User action | Frontend/API | Required meaning |
|---|---|---|
| Preview bank file | RapprochementBancairePage.previewMutation | ReleveBancaireService.preview: temporary parsing only, no business activity |
| Confirm bank import | importMutation -> importBankStatement | confirmImport: new saved statement + optional import profile; filename/count/totals/account, no file hash/path/raw JSON |
| Save matching selections | saveMutation -> saveBankReconciliations | saveReconciliations deletes/recreates technical selection rows and clears EntityManager; compare business selections, not row identities |
| Validate bank reconciliation | validateMutation first saves selections, then validateBankReconciliation | Two HTTP transactions; selection save may persist even if validation fails. Successful validation groups collection and treasury effects for all matched instruments |
| Create/edit/enable account | TresorerieComptesPage saveAccount/changeStatus | TresorerieService, before/after account configuration; initial balance remains backend-controlled |
| Change account access | TresorerieComptesPage saveAssignments | TresorerieAccessService.replaceAssignments: one access configuration save, not per-user join-row writes |
| Transfer/adjustment | OperationsTresoreriePage createOperation | OperationTresorerieService creates one operation with its debit/credit movements as details |
| Cancel treasury operation | Same page cancelOperation | One reversal action with original and reversal references; never delete the original accounting movement |
| Cash session open/close API | No frontend workflow found; router sessions-caisse redirects to accounts | SessionCaisseService records actual opening/closing values; do not invent a currently available UI action |

Internal ledger effects traced: TresorerieService record/reverse client and company
instrument movements; personal cash-account synchronization follows user changes.
They should contribute to authoritative outer workflows, not look like extra clicks.

Treasury instrumentation is implemented. The 102-test focused backend verification
passed; no end-to-end or whole-module coverage claim is implied by mapper tests.

## Stock Flows Traced And Wired

| User action | Frontend/API | Required meaning |
|---|---|---|
| Enable/disable stock control | AttestationStockDashboardPage updateSettings -> updateAttestationsStockSettings | One configuration change with actual previous/effective value; repeated identical save is a no-op |
| Create/edit minimum stock | saveSeuil chooses create/update endpoint | creerSeuil can update an existing active company/group threshold; action must depend on persisted identity, not HTTP POST alone |
| Cancel available attestation | cancelAttestation -> cancelAttestationStock | annuler reads actual locked number, status and reason; threshold recomputation is not another activity |
| Create order | AttestationWorkflowPage source=COMMANDE -> createLivraisonAttestation | creer: one order with requested group/quantity details; no receipt claimed before lots exist |
| Direct reception | Same page source=RECEPTION_DIRECTE -> SAME create endpoint | creer validates source/BL/ranges, creates available stock and validated delivery; one direct-reception event, not a creation event per attestation |
| Receive lots for order | addLot -> addLotsAttestation /reception | ajouterLots: one action with all actual ranges/quantities; /lots is a single-lot wrapper with no current page caller found |
| Validate delivery | validateLivraison -> validateLivraisonAttestation | valider is a separate action; stock was already made available at lot receipt, so do not claim first availability now |
| Consume/release number during contract workflow | No standalone stock button; contract/amendment services call consommerPourMouvement / liberer overloads | Supporting contract activity with actual stock number and original contract/movement/target references, including before state on release |
| Number validation/suggestions/dashboard/filters | GET number validation and search APIs | Reads only; no business activity |

Sources inspected: AttestationStockPage, api/attestation-stock, delivery/reception/
cancel/threshold dialogs, AttestationStockService, LivraisonAttestationService and
stock/delivery/lot entities. Important: stock availability begins in creerLot,
not at the separate valider call. Recording is now wired, including first-entry vs
upsert threshold handling, release's prior references and repeated validation no-op.
Stock tests passed in the 111-test batch; the full stock/contract interaction audit is
still open before marking the entire module complete.

## Company Accounting Trace In Progress

| User action | Frontend/API | Recording status |
|---|---|---|
| Save company payment | NouveauReglementCompagniePage create -> createCompanyPayment | ReglementCompagnieService.create now records one aggregate with allocation/instrument details; bank means remain pending, compensation uses actual confirmed state |
| Confirm/reject company instrument | BordereauCompagnieDetailPage changeInstrument -> changeCompanyPaymentInstrumentStatus | changeInstrumentStatus now groups actual treasury posting/reversal under one company instrument action |
| Cancel company payment API | cancelCompanyPayment defined, no current page caller found | cancel now records one aggregate with reversals, reasons and allocations; repeated cancelled payment is no-op |
| Create/edit company bordereau | BordereauCompagnieFormPage save -> createCompanyBordereau/updateCompanyBordereau | Wired; distinct backend lifecycle; compare business content and retain removed source references |
| Validate/transmit/reconcile/cancel company bordereau | BordereauCompagnieDetailPage separate mutations | Wired with actual before/after; unchanged reconciliation omitted |
| Assign company quittance | AffectationQuittanceDialog save -> saveAllocation | AffectationQuittanceService.save replaces rows; compare actual before/after content and source keys, distinguish first assignment |
| Assign fleet batch | BulkAffectationQuittanceDialog saveBatchAllocation | saveBatch changes several quittances in one transaction, one batch operation with per-quittance details, no separate allocation-row events |
| Clear assignment | AffectationQuittanceDialog clearAllocation | clear: retain original allocation content; absent assignment is no-op |
| Preview assignment import | AffectationQuittanceDialog / BulkAffectationQuittanceDialog preview import | Parsing only; later saveAllocation/saveBatchAllocation persists actual import source; no preview event |
| Create/edit/delete assignment rule | QuittanceRulesDialog -> createRule/updateRule/deleteRule | Version/use restrictions remain backend-owned; configuration activity with actual rule and company/branch context |

BordereauCompagnieDetailPage uses separate validate, transmit, reconcile and cancel
APIs. Instrument confirmation/rejection calls ReglementCompagnieService, which posts
or reverses treasury movements. Those transitions now have explicit company-payment
roots to absorb the newly instrumented treasury effects. ReglementCompagnieService
create builds instruments/allocations but does not automatically confirm every bank
instrument; retain actual pending/confirmed/compensation status. Company-bordereau
updates recreate line rows: compare business source identities and amounts, not IDs.
Already read service create/update/validate/transmit/reconcile/cancel and payment
create/changeInstrumentStatus/cancel, assignment save/saveBatch/clear and rule
create/update/delete, frontend/API callsites and payment creation. Assignment
controller/DTO/entity snapshots are now inspected and recording is wired for save,
batch/removal and rules. New mapper regressions are added but not run. No Maven.

## Claim Flows Traced And Wired

| User action | Frontend/API | Authoritative operation |
|---|---|---|
| Save draft or declare immediately | SinistreDeclarationPage create(declarer) -> SAME create endpoint | SinistreService.create validates coverage/date/guarantees; one final-state event, no event per coverage snapshot |
| Coverage/duplicate preview | Declaration page GET coverage/duplicates | No persisted activity |
| Edit information/manager/next action | SinistreDetailPage update -> update | Actual allowlisted before/after, no-op save omitted |
| Declare/transmit/close/cancel/reopen | Detail transition, list cancelClaim -> SAME transition endpoint | Existing readiness/workflow checks; actual status/reason, unchanged status is no-op |
| Delete early claim | List deleteClaim -> deleteEarlyClaim | One deletion snapshot, not per domain-history/party/coverage row |
| Save guarantee decisions | Detail guarantee -> updateGuarantees; single-guarantee API also exists | One coverage decision with affected guarantees and automatic settlement-status effects |
| Add/edit/remove party | Detail party/removeParty chooses distinct APIs | Actual party identity as subject; claim/contract retained; display-index shifts are not changes |
| Save provision | Detail finance form chooses addProvision | New estimate/version, not payment or treasury posting |
| Save payment/fees/recovery | SAME finance form chooses addOperation instead | Actual operation, direct-company vs agency-treasury circuit; treasury and settlement-status consequences grouped |
| Cancel financial operation | Detail cancelOperation -> cancelOperation | Original operation subject, reversal references retained; aggregate includes any treasury reversal |
| Create/edit expert mission | Detail mission -> saveMission POST/PUT | New vs existing persistence, actual expert/garage context |
| Upload document | Detail document -> uploadDocument | Actual document metadata/guarantee/mission/garage links, no storage key; rollback cleanup preserved |
| Review document | Detail reviewDocument -> review | Document validation/rejection, comment/date; not a claim status change |
| Delete document | Detail deleteDocument -> delete | Document subject, not claim deletion; validated-document prohibition and after-commit file cleanup preserved |
| Download document | Detail download -> GET download | Read only |
| Create/edit/enable expert or garage | SinistreReferentielsPage saveExpert/saveGarage | Actual catalogue fields/status, inactive filter is read-only |

Inspected claim controllers, Service/Dossier/Document/Intervenant mutations,
WorkflowService, ResponseMapper and detail DTO. SinistreEvenementService remains
domain history, not another business-action source. DocumentRequirementService is
read-only. ClaimActivity aligns nested snapshot parts by internal identities but
emits human labels, excluding event lists, readiness hints and row versions.
Implementation/regression additions are not yet compiled/run; the earlier 111-test
pass predates this batch. Final verification remains open.

## Administration Flows Traced And Wired

| User action | Frontend/API | Authoritative operation |
|---|---|---|
| Create/edit/deactivate user | AdminPanels UsersPanel -> createUser/updateUser/deactivateUser | One AdminService aggregate with actual identity, role, agency and active state; automatic personal/central cash access and account changes contribute details, not separate clicks |
| Create/edit/deactivate platform administrator | PlatformAdminsPage + PlatformAdminsPanel -> dedicated platform-admin endpoints | Global administrative activity, regardless of selected agency; no global administrator data exposed through an agency history |
| Create/edit/delete role | AdminPanels RolesPanel -> role APIs | Actual resolved permissions (including backend dependencies), code/name/description/system flag; no event per role-permission join row; unchanged save omitted |
| Transfer user/role between agencies | Platform-mode user/role edit -> SAME update endpoint | Old/new agency and role details are platform-only; automatic account effects retain their own agency scope rather than leaking across tenant history |
| Create/edit agency | AgenciesPanel -> createAgency/updateAgency | Agency creation by platform admin is always a platform fact; ordinary settings changes belong to the managed agency. Default commercial-origin provisioning is not a separate user action |
| Upload/replace/remove logo or signature | SAME agency form, separate requests AFTER agency save | Each successful asset request is retained independently; a later upload failure does not erase the already saved agency. Presence/replacement only, no generated filenames or storage keys |
| Password reset/change, session revocation, login/logout/refresh, agency-context switch | Admin session/password dialogs; ProfilePage; app-header; agency selector; AuthService | EXCLUDED from business activity per user decision: retain existing sessions/security/audit behavior; user creation/deactivation and role/agency changes remain business administration |

Read AdminController, AdminService, entities/DTOs, admin API, actual AdminPanels
mutations and partial-upload recovery. Also traced AuthController/AuthService,
ProfilePage, auth API/store and agency switching. AuthService and its tests remain
unchanged after removing the temporary hooks. No password/token/session fields are
present in AdministrationActivity. Session revocation caused by user deactivation
does not create an additional business-history entry. New recorder platform path
requires an actual global SUPER_ADMIN and an ADMINISTRATION/null-agency command;
ordinary recorder tenant checks are unchanged. Security regressions were added to
the existing recorder test file but have not been run. No Maven/build/typecheck.

## Assistance And Green-Card Flows Traced And Wired

| User action | Frontend/API | Authoritative operation |
|---|---|---|
| Price automobile/travel assistance | Creation-page quote queries -> POST tarification | Read-only pricing; no persisted activity despite using POST |
| Save assistance draft subscriber/owner/insured/vehicle section | Automobile/VoyageCreationPage draftSave -> typed section URL | One draft aggregate, actual section and client/vehicle details; first draft CREATED, later section SAVED; actual no-op omitted |
| Create standalone assistance | SAME pages save -> create when neither editing nor renewing nor draft | One contract/assistance/billable operation; newly created clients contribute details under the root |
| Finalize standalone assistance draft | SAME save -> finalizeDraft when draftMode | Existing implementation creates a NEW validated contract and deletes the old draft; one VALIDATED activity retains both identities, no independent draft-cleanup deletion |
| Modify standalone assistance | SAME save -> update when editing active record | One actual update; recreated role/pricing row IDs excluded, travel pricing aligned by insured identity; existing direct-modification/billing policy unchanged |
| Renew standalone assistance | SAME save -> renew when renewing | New contract/assistance with original contract/assistance references; source renewal status remains authoritative; no premature renewal from pricing preview |
| Save/remove linked assistance | ContratAssistancePage saveMutation/deleteMutation -> contract service APIs | Assistance subject plus contract/movement/vehicle/client/billable-element and assistance-company/product/tariff identities; actual create/update/replacement/deactivation, no invented collection |
| Synchronize draft vehicle assistance | useContratCreationForm.syncDraftVehiculeAssistance AFTER vehicle/guarantee save | A separate committed request today; successful section save must not be rolled back in history if assistance synchronization later fails. Repeated identical synchronization is a no-op |
| Assistance inside contract/avenant validation | ContratService calls SAME upsert/deactivate internally | Existing explicit outer recorder scope absorbs assistance effects into contract/amendment; no extra user-action row per billable/quittance child |
| Add/update/remove green card | ContratCartesVertesPage saveMutation/deleteMutation | Real CARTE_VERTE subject plus contract/movement/vehicle/element; replacement preserves old identity; absent/unchanged saves omitted |
| Open PDF/context/eligible vehicles/renewal preparation | GET context, creation-page state and queries | Reads only, not issuance, renewal or collection |

Inspected creation pages, linked-assistance/green-card pages, API modules and
ContratController permissions/endpoints; four mutation services and assistance
quittance synchronization. AssistanceQuittanceService is internal accounting
synchronization, not an independent user event source. Automatic insurance-contract
assistances retain independent billable identity even when grouped under one action.
Typed assistance company/product/tariff references do not reuse insurance-company
IDs. New snapshot queries include both contract and agency and load real replaced
children rather than relying on potentially stale parent collections. Regressions
added to existing assistance/service and screen-context test files; NOT RUN.

## Reference Configuration Flows Traced And Wired

| User action | Frontend/API | Authoritative operation |
|---|---|---|
| Create/edit/enable bank reference | BanksSettingsPage.saveBank -> comptaApi.createBank/updateBank -> BanqueController | BanqueService records agency-owned code/name/aliases/order/active state; aliases compared canonically, not collection-row identities |
| Automatically populate bank catalogue | BanqueService.list -> ensureDefaults/initializeDefaults | EXCLUDED provisioning, not a user creation event for every default bank |
| Create/edit company contact | CompanyContactsPage.save -> companyContactsApi.create/update | ContactCompagnieService root includes contact/company/service and contact fields; selecting a principal also reports displaced principals in the same event |
| Enable/disable company contact | CompanyContactsPage.updateStatus -> PATCH statut | Actual active/principal changes; repeated identical status is a no-op |
| Create/edit/deactivate fiscal rule | FiscalRulesSettingsPage -> fiscalRulesApi -> RegleFiscaleController | Global rule reference with actual scopes, date validity, calculation settings and regulatory reference; retained before/after guarantee/company/usage references; application/version protection unchanged |
| Create scheduled bulk tariff adjustment/reset | TarifUsageSettingsPage.bulk -> pricingApi.bulkUpdateUsageNetPremium -> ReferentielController -> TarifUsageAjustementService.apply | One global adjustment version with dates/reason/selected tariffs/base and version amounts. The base tariff is NOT immediately rewritten; do not claim current collection or an immediate premium edit |
| Resolve fiscal rules/tariffs or view adjustment history | Existing quote/financial resolution/read methods | No configuration activity from reads or calculation |

Inspected both controllers and frontend mutations, ContactCompagnieRepository's
principal-clearing bulk update (which clears EntityManager), BanqueService automatic
provisioning, RegleFiscaleService version checks and adjustment actual persistence.
Principal contact identities are captured before the bulk clear and do not depend
on detached entities afterwards. The new principal lookup includes agency, company
and service. Fiscal rules and adjustment batches have no agency owner in the model;
their events stay global rather than becoming owned by the selected agency.
recordGlobalReference accepts only these explicit global subject types in
REFERENTIELS, validates an actual actor's matching management/configuration
permission, and does not change ordinary tenant checks. Global events are visible
only in the platform history under existing access rules. Regression additions in
existing recorder/adjustment tests are NOT RUN; no Maven/build/typecheck this pass.

Company/convention/assistance-catalogue writes and intermediary codes are now wired
as described below. Still to implement: grid/line/formula/usage/guarantee and other
maintained-reference write paths, including whole-grid-usage replacement. Many of
those mutations currently live directly in the controller and not all have a
transaction boundary; preserve business rules while ensuring the domain write and
activity share one transaction. Read-only
TarifProduitAssistanceService, CodePromoAssistanceService and catalogue search do
not represent configuration-save endpoints.

## Company And Assistance Catalogue Flows Traced And Wired

| User action | Frontend/API | Authoritative operation |
|---|---|---|
| Create/edit insurance company | CompaniesPage.save -> referenceAdminApi.createInsuranceCompany/updateInsuranceCompany | Shared identity/contact/legal/prefix/order/active fields are global catalogue activity. Automatic accounting-tier projection is not another click |
| Save/remove agency intermediary code | SAME company form/API -> saveCodeIntermediaire | Separate agency-owned configuration fact, linked to company by actual FK; never include an agency's intermediary value in the global company event. Empty removal and unchanged code are no-ops |
| Create/edit/deactivate assistance company | AssistanceSettingsPage -> assistanceProductApi company methods | Global company state; DELETE here is soft deactivation, not deletion of the company |
| Create/edit/deactivate assistance product | AssistanceProductsSettingsPage -> product methods | Actual company/category/usage eligibility and benefits, labels/status; canonical usage set; formatting-only benefit changes remain visible without rendering raw HTML |
| Permanently delete unused assistance product | SAME page explicit permanent-delete confirmation | Existing contract-use prohibition remains; one product deletion includes cascaded tariff/promotion details and identities, not events for each child |
| Create/edit/deactivate product tariff | SAME page tariff dialog -> product rate methods | Actual dates/duration/age brackets/HT/TTC/status and product/company references; overlap and amount validation unchanged |
| Create/edit/deactivate promotion | SAME page promotion dialog -> promo methods | Actual code/reduction/dates/status and product/company references; existing voyage-only and overlap rules unchanged |
| Create/edit convention | CompaniesConventionsPage.saveConvention -> referenceAdminApi convention methods | Agency-owned convention, company/category/grid/usage identities and actual date/fractionnement/settings; old and new references retained |
| Create a grid from convention dialog | SAME page saveGrille -> pricingApi.createGrid | Separate HTTP request, now instrumented below; do not claim one atomic convention+grid action |

The 17 company/assistance-catalogue/convention mutation endpoints now enter
CatalogueActivityService.perform for a service transaction boundary before their
existing handler logic. Existing public transaction annotations remain compatible;
previously unbounded update/deactivation methods now also write domain/activity
atomically. CompanyCatalogueActivity uses explicit typed immutable states, keeps
agency-specific and global facts separate and retains before references. Global
writer allowlist now includes only the specific global company/product/rate/promo
types in COMPAGNIES, still with actual referentiel:manage/config:manage validation.
Agency convention/intermediary commands use unchanged ordinary tenant checks.
Convention grid selection now calls findAccessibleById(agenceId,id), accepting a
shared or current-agency grid but not another agency's private grid. Frontend/API/
controller helpers and amount/overlap/type/use restrictions were read. Scoped diff
checks passed; regression additions in existing recorder tests are NOT RUN.

## Tariff Grid Flows Traced And Wired

| User action | Frontend/API | Authoritative operation |
|---|---|---|
| Create/edit grid | CompaniesPricingGridsPage, TariffGridSection, CompaniesConventionsPage -> pricingApi.createGrid/updateGrid | One grid configuration event with real company and actual parent ownership; creation remains shared as before, private-grid updates require current-agency ownership |
| Save whole usage matrix | GrilleTarifaireConfigurator.saveConfiguration -> pricingApi.replaceUsageConfiguration | One SAVED event rooted in the grid with usage/guarantee/line/formula references; removed active rows are configuration removals, not a product/contract deletion |
| Omit person formulas in matrix request | SAME endpoint, formulesPersonne undefined | Preserve existing person formulas; do not describe them as removed |
| Individual line create/update | pricingApi.createGridLine/updateGridLine; maintained API paths | One line subject with grid/guarantee/usage/category context; these endpoints remain available but the inspected matrix uses the aggregate endpoint |
| Individual person formula create/update | pricingApi.createPersonGuaranteeFormula/updatePersonGuaranteeFormula | Actual protection amounts, premiums/accessories/order/active state and parent-grid scope |
| Open grid/line/formula options | Existing reference GETs | Server-side agency/company/usage/guarantee filtering; reads do not create configuration events |

GridCatalogueActivity aligns surviving rows by actual identity, then unchanged
recreated rows by typed reference identities AND business values. Row IDs/order
alone cannot create a false edit. Reference changes with identical labels still
emit a readable associated-reference update; this also closes the same gap in
CompanyCatalogueActivity. Source line/formula queries and snapshots include universal
(null-usage) rows visible in the matrix, preserving existing null-usage behavior.
The original exact-usage deactivation loops and omitted-formula behavior remain.
Provided stale/foreign IDs now fail rather than silently creating a replacement;
provided non-universal rows from another usage cannot be moved by this matrix.
Grid/line/formula reads and writes accept shared or current-agency parents only.
Repository option queries now enforce this scope and filter on the server rather
than loading every formula across agencies. New regressions in the existing
recorder test file are NOT RUN. No Maven/compiler/build/test invocation this pass.

## Remaining Reference Settings Traced And Wired

| User action | Frontend/API | Authoritative operation |
|---|---|---|
| Create/edit usage | ProductionReferenceSettingsPages.UsagesSettingsPage save -> referenceAdminApi createUsage/updateUsage | One global reference event with actual flags, stock group and trailer rate; unchanged save omitted |
| Save trailer rates | TarifUsageSettingsPage trailer-rate mutation -> updateUsageTrailerRates | One batch save listing changed usage/rate pairs, not one event per usage update |
| Create/edit/deactivate base usage tariff | TarifUsageSettingsPage save/delete -> pricingApi usage-rate calls | Actual base premium/criteria/fuel references; existing adjustment-history protection remains; DELETE means deactivation |
| Make/body type/fuel settings | Marques/Carrosseries/CarburantsSettingsPage through SimpleReferencePage/CodeReferencePage -> referenceAdminApi | One creation or actual update; automatic reference provisioning from contract input is not a separate settings click |
| Subclass settings | SousClassesSettingsPage save -> createSubclass/updateSubclass | Actual motor characteristic, permit/driver and assistance flags, not label-based inferred eligibility |
| Client category | CategoriesClientSettingsPage save -> createClientCategory/updateClientCategory | Code/label, allowed usage set and stock-group reference in one event |
| Transport category | CategoriesTransportSettingsPage save -> createCategoryTransport/updateCategoryTransport | Code/label/description/active state; actual create/update |
| Stock usage group | GroupesUsageAttestationSettingsPage save -> createAttestationUsageGroup/updateAttestationUsageGroup | Global group configuration with company restrictions/colour/stock visibility, not agency stock-threshold modification |
| Guarantee | GarantiesSettingsPage save -> createGuarantee/updateGuarantee | Actual selected modes/value sources/reference guarantee/flags and company prorata choices; supporting join rows remain details |
| Exclusion group | Same page saveGroupeExclusion -> createGuaranteeExclusionGroup/updateGuaranteeExclusionGroup | Separate settings action, not an inferred guarantee edit |

All 24 mutation handlers above now share the service-owned catalogue transaction
boundary and explicit ReferenceCatalogueActivity snapshots. Sorted set labels and
typed reference identity comparisons avoid ordering/technical-row noise. These
global events never inherit agency ownership from a selected context. New record
types are narrowly permitted for actual referentiel:manage writers. No frontend
event-write API, business-rule duplication or extra schema column introduced.

## Additional Production Coverage Gaps Fixed

| Action | Frontend/API | Recording |
|---|---|---|
| Generic movement creation | No current frontend caller found; POST /contrats/{id}/mouvements | MouvementContratService.creerMouvement explicit aggregate, actual validated movement and contract state; specialized movement helpers do not double-log |
| Financial history recalculation | FinancialHistoryRecalculationDialog preview/apply -> contractApi -> HistoriqueFinancierRecalculService | Preview emits nothing; successful apply compares actual movement/quittance/receivable/category/target values in one RECALCULATED event, with original identities retained |

No new test files or Maven/compiler/build/test invocation in this pass. Existing
movement fixture constructor updated for the recorder; final verification pending.
Financial target attribution now uses an agency-and-contract-scoped query of the
stored vehicle/trailer foreign keys; display indices are not used to invent links.
Read-only inventory check: 49 reference mutation handlers, 48 catalogue transaction
wrappers plus the existing adjustment-service delegate. Migration validation lists
match all 29 surfaces, 10 modules, 25 actions and 81 subject types. No auth changes.

## Final Coverage Review

Latest reference review: contract/amendment and CRM client/acquisition/group update
events retain old/new business references and recognize identity-only changes
under equal display labels. Technical draft target/guarantee/assistance and phone
row recreation still does not imply a user edit. Actual supported client roles and
principal selections are compared separately. Existing regression files expanded
and passed. The final selection covered 201 backend tests; its three missing-fixture
dependency errors were fixed and the affected 11-test class rerun successfully.
Frontend typecheck and all 25 focused frontend tests passed. Auth/session actions
remain deliberately excluded. The real JPA projection/filter/paging/null-reference
check passed, and SQL enum validation lists match the current source.

The source review covers contract detail/list actions, renewal/import/attachments,
assistance/green cards, CRM, accounting documents/payments/allocations, bank and
treasury actions, company accounting, claims, stock/deliveries, reference catalogues
and administration. The two last missing production entry points (generic movements
and financial-history recalculation) are wired above. Read-like POSTs, pricing/import
previews, ordinary PDF/export reads, provisioning during reads, and auth/session
actions are not presented as completed business mutations.

The tables record page/control, shared/separate API boundaries, first-entry/no-op
semantics and parent context. No live mutation/browser harness or production MySQL
migration was executed. Apply the migration and run its validations before rollout;
old technical audit is intentionally not backfilled into inferred business events.

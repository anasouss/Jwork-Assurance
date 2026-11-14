# Permissions Restructuring Audit

Status: implementation complete. Frontend type checking and 157 selected tests passed.
Backend verification was interrupted and was not repeated, per user instruction; it remains unverified.
The production SQL migration has not been executed.
The inventory and findings below are the BEFORE-change snapshot, not the current authority matrix.
Current capabilities are defined by PermissionCatalog.java; deployment instructions are in
assurance-backend/sql/migrations/README_permissions_v2.md.
Applications: assurance-backend and assurance-web only.
No agency/company partnership changes are included.

## Scope and Confidence

- 67 current seeded permission definitions.
- 122 router entries, including aliases, redirects, index routes and fallback routes.
- 94 unique referenced page/layout components.
- 422 HTTP controller mapping declarations; declarations with several paths are not counted as several endpoints.
- TypeScript AST inspection of router objects, permission string references and API property references.
- Inspection of backend method/class authorization, SecurityConfig, service authorization, dependency rules, role assignment and startup seeders.
- Cross-check with BUSINESS_ACTIVITY_ACTION_MATRIX.md for multi-request workflows and shared/internal service effects.
- Static analysis is an inventory, not proof of runtime access isolation. Imported component references do not mean every permission or API is exercised by every rendering.
- The inventory itself used no browser sessions, tests, builds, database queries or migrations.
- Implementation followed this audit. No production migration or deployed-role inventory has been executed locally.

## Main Findings

### High: Editing Contracts Also Grants Destructive and Amendment Actions

ContratController accepts contrat:update as an alternative to contrat:delete for deleting draft contracts and to avenant:delete for deleting a movement.
AvenantController also accepts contrat:update for amendment draft deletion, rectification and creation.
Consequently, clearing the dedicated delete or amendment checkbox does not reliably deny that action while contract editing is retained.

Sources:
- assurance-backend/src/main/java/com/assurance/controller/ContratController.java:728
- assurance-backend/src/main/java/com/assurance/controller/AvenantController.java:86
- assurance-backend/src/main/java/com/assurance/controller/AvenantController.java:127
- assurance-backend/src/main/java/com/assurance/controller/AvenantController.java:173

Target: each destructive action requires its own capability. Editing never implies deletion, cancellation, validation, amendment creation or financial correction.

### High: Quittance Permissions Combine Different Accounting Jobs

quittance:view/create/manage currently govern company-quittance assignment, client statements, client invoices, convention production, convention invoices, document revision/cancellation and permanent deletion.
The manage label describes quittance rules, but the same code can authorize permanent invoice deletion.
A staff member cannot be granted convention invoicing without also acquiring unrelated client-document or assignment capabilities through the same backend checks.

Sources:
- assurance-backend/src/main/java/com/assurance/controller/ComptaController.java:161
- assurance-backend/src/main/java/com/assurance/controller/ComptaController.java:375
- assurance-backend/src/main/java/com/assurance/controller/ComptaController.java:460
- assurance-backend/src/main/java/com/assurance/controller/ComptaController.java:507
- assurance-backend/src/main/java/com/assurance/controller/ComptaController.java:519
- assurance-backend/src/main/java/com/assurance/seeder/PermissionSeeder.java

Target: separate assignment, client statements/invoices, convention production and convention invoices. Shared document endpoints must authorize the actual requested type and persisted document origin.

### High: Treasury Read Permission Is Part of Write Authorization

TresorerieController uses tresorerie:view for opening/closing cash sessions, transfers, adjustments and operation cancellation.
These operations do have additional per-account checks in OperationTresorerieService and SessionCaisseService: this is NOT an unrestricted write endpoint.
However, the role editor's read-only description does not communicate the resulting operational authority when an account assignment is present.

Sources:
- assurance-backend/src/main/java/com/assurance/controller/TresorerieController.java:181
- assurance-backend/src/main/java/com/assurance/controller/TresorerieController.java:230
- assurance-backend/src/main/java/com/assurance/controller/TresorerieController.java:241
- assurance-backend/src/main/java/com/assurance/controller/TresorerieController.java:252
- assurance-backend/src/main/java/com/assurance/service/OperationTresorerieService.java
- assurance-backend/src/main/java/com/assurance/service/SessionCaisseService.java

Target: action permission AND agency ownership AND account access AND valid workflow state. Preserve account management/supervision levels rather than replacing them with role permissions.

### Medium: Some Read-Only Pages Still Display Write Controls

CompaniesPage always displays Ajouter compagnie. CompaniesConventionsPage exposes create/edit/configure controls without local permission predicates.
Backend SecurityConfig still protects writes, so this is a frontend authorization/ergonomics mismatch, not evidence that read users can successfully save.

Sources:
- assurance-web/src/features/production/pages/CompaniesPage.tsx:105
- assurance-web/src/features/production/pages/CompaniesConventionsPage.tsx:186
- assurance-backend/src/main/java/com/assurance/config/SecurityConfig.java:86

Target: route, menu, row actions, dialogs and backend agree on the same named action. Do not merely hide the module.

### Medium: Broad Manage Permissions Hide Distinct Responsibilities

client:manage combines client edits, groups and commercial origins.
reglement-client:manage combines cancellation, instrument replacement/representation, policy changes, archive removal and refund authority in service logic.
tresorerie:manage combines account configuration, assignments, remittance preparation/deposit and instrument confirmation/rejection.
sinistre:manage combines claim edits, transitions, deletion, parties, missions and document operations; sinistre:finance combines provisions and actual settlement operations.

Target: split rights by business action, retaining only actions supported by a real workflow. Do not add meaningless CRUD permissions to every record.

### Medium: Cross-Module Dependencies and Navigation Are Inconsistent

The role editor already groups by business module, but referentiel and pricing prefixes belong to multiple header modules.
Broad prefix route checks can admit a page whose API needs a different exact permission.
Payment creation depends on client-payment reads and treasury account options, but PermissionDependencies mostly adds only resource:view.
user:manage automatically adds role:view; that dependency must be reviewed separately from permission-definition administration.

Sources:
- assurance-web/src/lib/authorization.ts
- assurance-web/src/components/app-navigation.ts
- assurance-backend/src/main/java/com/assurance/security/PermissionDependencies.java

Target: explicit dependencies for page reads and narrowly scoped workflow lookups. Do not grant full CRM, treasury administration or shared-reference management merely to populate a select.

### Medium: Startup Seeders Can Regrant Removed Administrator Rights

DataSeeder invokes grantReferentielPermissionsToAdministrators on startup and restores operational permissions for matching system administrator roles.
An intentional restriction can be undone after restart.
PermissionSeeder upserts known permissions but does not retire obsolete codes automatically.

Sources:
- assurance-backend/src/main/java/com/assurance/seeder/DataSeeder.java:108
- assurance-backend/src/main/java/com/assurance/seeder/DataSeeder.java:382
- assurance-backend/src/main/java/com/assurance/seeder/DataSeeder.java:397
- assurance-backend/src/main/java/com/assurance/seeder/PermissionSeeder.java

Target: immutable platform-admin policy where intentional; agency role defaults are templates, not startup processes that silently restore grants. Use explicit versioned migration for changed permissions.

### Delegation Boundary Must Be Explicit

AdminService.resolvePermissions rejects platform-only permissions and validates agency ownership of roles, but does not limit ordinary role managers to a separately defined delegable permission set.
This may be intentional for agency administrators; it is too broad for a staff member whose job is only assigning existing roles.

Source: assurance-backend/src/main/java/com/assurance/service/AdminService.java:715.

Target: distinguish defining roles, changing role grants, assigning existing roles and managing users. Preserve non-delegable platform powers.

## Target Structure

Permission organization has three levels:

1. Header module: Production, Sinistre, Compagnies, CRM, Compta, Administration.
2. Business area/page: Contracts, Amendments, Convention invoices, Treasury accounts, etc.
3. Business action: Consulter, Créer, Modifier, Valider, Confirmer, Annuler, Supprimer, Exporter, Configurer, as applicable.

The header follows from accessible pages; a module is NOT an all-access permission.
Each capability has one owning module. Another workflow may reuse its lookup API without owning the management capability.
Keep domain:action codes and the backend PERM_ prefix convention. Module metadata and readable labels must not be inferred from translated words.
Examples below are proposed capabilities, not permissions already available.

| Module | Business area / current pages | Required action separation |
|---|---|---|
| Production | Dashboard, production register | View summaries/register; export where an export exists |
| Production | Quotes / prospection | View, create/save, update, convert to contract; remove only eligible drafts |
| Production | Mono, fleet, convention contracts | View/list/detail/PDF; create; update eligible drafts/contracts; finalize existing creation workflow; renew; delete eligible draft; exceptional historical financial recalculation |
| Production | Amendments | View, create, save/update draft, delete draft, rectify validated movement, delete eligible last movement |
| Production | Renewals / pre-term | View pending renewals, prepare draft, update draft, finalize renewal, export/print pre-term |
| Production | Assistance on contract | View, add, update, deactivate/cancel according to existing eligibility |
| Production | Green cards | View/PDF, create/update, deactivate according to lifecycle |
| Production | Contract attachments | View/download, upload/replace, remove/archive; reuse existing agency documents under explicit workflow checks |
| Production | Attestation orders, deliveries, stock | View, create order/delivery, receive lots, validate reception, cancel attestation, configure thresholds; stock consumption remains a contract/amendment consequence |
| Production | Technical settings | Separate view/update capabilities for usages, tariffs, brands, bodies, fuels, subclasses, transport/customer categories, guarantees, stock usage groups, document requirements and fiscal rules |
| Sinistre | Declaration / opening | View necessary coverage/lookup; create claim; upload opening documents in that same authorized workflow |
| Sinistre | Consultation, detail, register, statistics | View; exports where implemented |
| Sinistre | Claim administration | Update facts/coverages/parties; transition status; delete only eligible claims |
| Sinistre | Expertise missions | View, create, update/status actions that actually exist |
| Sinistre | Provisions | View and record/update estimate; do not equate provisions to actual payments |
| Sinistre | Financial operations | View, record operation, cancel/reverse operation; retain treasury/account checks |
| Sinistre | Claim documents | View/download, upload, classify/update status, remove |
| Sinistre | Providers and specialties | View, create, update, activate/deactivate experts, garages, specialties and company agreements |
| Compagnies | Insurance / assistance company catalogue | View; create/update/status operations separately. Shared-vs-agency scope remains an explicit policy; no partnership-model migration is included |
| Compagnies | Convention configuration | View, create, update/status; distinct from issuing or paying convention invoices |
| Compagnies | Pricing grids / formulas | View, create, update configuration, status; distinguish shared and agency-owned configuration |
| Compagnies | Company contacts | View, create, update, activate/deactivate; changing principal status is part of contact administration |
| Compagnies | Assistance products, rates, promotions | Separate product/rate/promotion view, create, update, deactivate and permanent removal where supported |
| CRM | Customers | View full CRM; create; update; separate group assignment and acquisition metadata updates |
| CRM | Groups | View, create, update, assign member, end membership; no invented unrestricted delete |
| CRM | Commercial origins | View, create, update/status |
| CRM | Client documents | View/download, upload/replace, remove/archive; authorize reuse by source ownership |
| Compta | Company quittance assignment | View, assign/update, remove assignment, import/preview, export; not client invoice issuance |
| Compta | Client statements and invoices | Separate view, issue, revise, cancel, permanent eligible deletion, PDF/export |
| Compta | Convention production | View and export |
| Compta | Convention invoices | View preparation, issue, cancel, permanent eligible deletion, PDF; keep convention identity and period/sign rules |
| Compta | Client / convention settlements | View, create incoming payment, pay outgoing ristourne, cancel; separate exceptional differences and payment policy settings |
| Compta | Premium receipt archives | View/PDF, issue archive, remove eligible archive; reopening an archive is not issuance |
| Compta | Payment instruments / bank rejections | View; confirm/reject; replace; represent; record rejection follow-up, each with existing bank/lifecycle eligibility |
| Compta | Bank remittances | View/PDF, create/update provisional, remove line, deposit, confirm/reject line, delete provisional |
| Compta | Treasury accounts and assignments | View available operational accounts; separately create/update/status, configure account access |
| Compta | Treasury operations / journal | View, transfer, exceptional adjustment, reverse operation; preserve per-account supervision and balance rules |
| Compta | Bank reconciliation | View; preview file; import; save matching; validate; reverse only if implemented |
| Compta | Cash sessions | View/open/close according to account access. Current sessions route redirects; do not advertise a complete separate UI that is not implemented |
| Compta | Company bordereaux | Keep existing useful separation: view, create/edit provisional, validate, transmit, reconcile, cancel |
| Compta | Company settlements | View, create, confirm, cancel; account and bordereau validation remains mandatory |
| Compta | Settings | Banks, payment policy, quittance assignment rules, and account configuration require their own configuration rights |
| Administration | Users | View, create, update, activate/deactivate, reset password, revoke sessions, assign eligible existing role |
| Administration | Roles and permissions | View roles; create/update/delete eligible custom role; separately edit grants and control delegation |
| Administration | Agency branding/details | View/update own agency within explicit field allowlist; platform agency administration remains separate |
| Administration | Audit and business activity | Separate audit read from business-activity read, and scope each returned reference according to resource access |
| Administration | Platform administrators/agencies | Platform-only capabilities and agency-context restrictions; never available through agency module select-all |
| Cross-cutting | Dashboard, own profile/help | Dashboard sections must respect allowed data domains. Own profile/session actions are authenticated self-service, not a module-wide user-management permission |

## Role Editor

- Use the exact six header module groups, in header order. No confusing shared seventh tab for ordinary agency roles.
- Within a module, show business-area rows, not implementation-table names.
- Use consistently named action columns or checkbox groups; hide impossible actions rather than showing an artificial delete everywhere.
- Show a concise description for exceptional actions: cancellation, permanent removal, payout, financial-history recalculation, permission delegation and global-reference changes.
- Display required read/lookup dependencies and automatically keep them coherent on the backend as well as the frontend.
- Module select-all should clearly enumerate what it grants; do not silently grant dangerous platform rights or obscure exceptional finance powers.
- Read-only users must not see active create/edit/delete controls that will merely fail with 403.
- Custom agency roles may combine several business areas. Existing single-role-per-user storage can represent combinations; multiple-role storage is optional, not a prerequisite.
- Example templates: Consultation seule, Production, CRM, Sinistres, Facturation conventions, Encaissements, Trésorerie, Comptabilité compagnie, Responsable agence. Templates do not override saved customizations after restart.
- Update old unaccented labels as part of the catalogue migration, not by changing codes every time wording changes.

## API And Workflow Rules

A button may call several APIs. Every request must be authorized; UI origin strings and hidden buttons are not security boundaries.
An API may serve several pages. Authorize by the actual business operation and the persisted resource, not only the URL or the broadest calling module.
Read-style POST preview endpoints are classified by side effects, not HTTP verb alone.
Do not require a separate capability for an automatic ledger child effect of an already-authorized successful financial operation.

### Shared Consumers Observed

| Shared API usage | Observed direct page consumers | Required treatment |
|---|---|---|
| referenceApi.list | 22 unique page components | Safe authenticated/scoped selector options may be reused; full catalogue configuration needs explicit resource rights |
| comptaApi.treasuryAccounts | 10 unique page components | Narrow active/account-access-filtered options for authorized payment/claim/company/banking workflows; do not grant all treasury administration |
| clientApi.getClientCrm | 7 unique page components | Full CRM payload is not a generic select option. Review each consumer; use a smaller workflow-specific response where broad customer/finance/activity detail is unnecessary |
| contractApi.getContrat | 4 unique page components directly, plus imported forms/hooks | Separate essential coverage/context data from full contract details; finance/payment views must not acquire unrelated editing powers |
| comptaApi.clientDocumentPdf | 4 unique page components | Determine client vs convention document from stored source/relationships, then require the corresponding read/PDF capability |
| comptaApi.companies | 4 unique page components | Read-only company choices do not imply company configuration access |
| comptaApi.remittanceSlipPdf | 4 unique page components | Reuse remittance read/PDF rights in payment-detail and rejection contexts without permitting remittance edits |

Consumer counts are static direct references, not measured runtime usage. Imported components/hooks add indirect consumers.

### Multi-Request Actions That Need End-to-End Checks

- Contract section save may update the draft then synchronize separate assistance.
- Amendment validation saves a draft then creates/rectifies the movement.
- Client creation may be followed by independent document uploads.
- Renewal preparation/finalization spans draft and contract workflows.
- Bank reconciliation validation first saves selections then validates them.
- Issuing an invoice from an existing direct payment also transfers allocations.
- Creating a claim may include opening documents and a first expertise mission.
- Incoming payment creation may immediately confirm cash/deposit and post treasury effects.
- Ristourne payment uses the same settlement machinery but requires an explicit outgoing-payment permission.
- Module navigation, route access and query enabling must accommodate these dependencies without accidentally granting another module's full access.

The existing business-activity matrix records these workflows; revalidate it against live code rather than assuming its historic verification claims apply to this new permission model.

## Migration and Rollout

1. Inventory deployed permission rows, custom role grants and agency assignments read-only. Source definitions alone are not the deployed access state.
2. Approve the page/action/endpoint matrix and whether existing cross-resource edit alternatives are intentional.
3. Add explicit capability metadata (module, business area, action, readable description, dependencies, platform/agency scope).
4. Upsert new codes and migrate role-permission links using a reviewed mapping; preserve user/agency identities and audit history.
5. Existing broad grants cannot be narrowed or expanded silently. Flag old edit/manage roles with destructive/financial authority for administrator review.
6. Update backend controller and service checks, including request-type and persisted-source checks on shared APIs.
7. Update frontend navigation, route guards, query enabling, buttons, menus, forms and validation dependencies in the same release.
8. Remove the startup behavior that regrants agency customizations unless the role is explicitly immutable by design.
9. Refresh/reload authorization and invalidate appropriate caches after role changes; do not rely on hiding controls until a token expires.
10. Run focused allow/deny tests for each domain, every exceptional finance/destructive action and the shared lookup workflows, plus two-agency ownership tests.
11. Test actual staff role templates in browser across all canonical routes, including direct URLs and direct API calls.
12. Retire obsolete codes only after migrated consumers and deployed roles are confirmed. No destructive blanket permission-table reset.

Permission migration will require explicit MySQL SQL under assurance-backend/sql/migrations/. This audit does not generate or execute that migration.
No new validation/approval stage should be invented just because a capability name is proposed; it must correspond to an existing or explicitly approved workflow.

## Appendix A: Current Seeded Permissions

These are current codes and labels, not the target catalogue.

| Code | Existing label | Existing resource group | Platform-only metadata |
|---|---|---|---|
| `contrat:view` | Consulter les contrats | `contrat` | No |
| `contrat:create` | Creer un contrat | `contrat` | No |
| `contrat:update` | Modifier un contrat | `contrat` | No |
| `contrat:delete` | Supprimer un contrat brouillon | `contrat` | No |
| `contrat:renew` | Renouveler un contrat | `contrat` | No |
| `contrat:recalculate-financial-history` | Recalculer l'historique financier | `contrat` | No |
| `avenant:view` | Consulter les avenants | `avenant` | No |
| `avenant:create` | Creer un avenant | `avenant` | No |
| `avenant:draft` | Gerer les brouillons d'avenant | `avenant` | No |
| `avenant:rectify` | Rectifier un avenant | `avenant` | No |
| `avenant:delete` | Supprimer le dernier avenant | `avenant` | No |
| `client:view` | Consulter les clients | `client` | No |
| `client:create` | Creer un client | `client` | No |
| `client:manage` | Gerer les clients et leurs groupes | `client` | No |
| `vehicule:view` | Rechercher les vehicules | `vehicule` | No |
| `garantie:view` | Consulter les garanties | `garantie` | No |
| `garantie:manage` | Gerer les garanties | `garantie` | Yes |
| `grille-tarifaire:view` | Consulter les grilles tarifaires | `grille-tarifaire` | No |
| `grille-tarifaire:manage` | Gerer les grilles tarifaires | `grille-tarifaire` | No |
| `quittance:view` | Consulter les quittances | `quittance` | No |
| `quittance:create` | Creer une quittance | `quittance` | No |
| `quittance:manage` | Gerer les regles de quittance | `quittance` | No |
| `reglement-client:view` | Consulter les règlements clients | `reglement-client` | No |
| `reglement-client:create` | Enregistrer un règlement client | `reglement-client` | No |
| `reglement-client:manage` | Annuler et corriger les règlements clients | `reglement-client` | No |
| `tresorerie:view` | Consulter la trésorerie | `tresorerie` | No |
| `tresorerie:manage` | Gérer les comptes et opérations de trésorerie | `tresorerie` | No |
| `bordereau-compagnie:view` | Consulter les bordereaux compagnies | `bordereau-compagnie` | No |
| `bordereau-compagnie:create` | Créer les bordereaux compagnies | `bordereau-compagnie` | No |
| `bordereau-compagnie:validate` | Valider les bordereaux compagnies | `bordereau-compagnie` | No |
| `bordereau-compagnie:transmit` | Transmettre les bordereaux compagnies | `bordereau-compagnie` | No |
| `bordereau-compagnie:reconcile` | Rapprocher les bordereaux compagnies | `bordereau-compagnie` | No |
| `bordereau-compagnie:cancel` | Annuler les bordereaux compagnies | `bordereau-compagnie` | No |
| `reglement-compagnie:view` | Consulter les règlements compagnies | `reglement-compagnie` | No |
| `reglement-compagnie:create` | Enregistrer les règlements compagnies | `reglement-compagnie` | No |
| `reglement-compagnie:manage` | Confirmer et annuler les règlements compagnies | `reglement-compagnie` | No |
| `regle-fiscale:view` | Consulter les règles fiscales | `regle-fiscale` | No |
| `regle-fiscale:manage` | Gérer les règles fiscales | `regle-fiscale` | No |
| `assistance:view` | Consulter les assistances | `assistance` | No |
| `assistance:manage` | Gerer les assistances | `assistance` | No |
| `carte-verte:view` | Consulter les cartes vertes | `carte-verte` | No |
| `carte-verte:manage` | Gerer les cartes vertes | `carte-verte` | No |
| `piece-jointe:view` | Consulter les pieces jointes | `piece-jointe` | No |
| `piece-jointe:manage` | Gerer les pieces jointes | `piece-jointe` | No |
| `attestation-stock:view` | Consulter le stock d'attestations | `attestation-stock` | No |
| `attestation-stock:manage` | Gerer le stock d'attestations | `attestation-stock` | No |
| `attestation-stock:cancel` | Annuler une attestation | `attestation-stock` | No |
| `agence:view` | Consulter les agences | `agence` | Yes |
| `agence:create` | Creer une agence | `agence` | Yes |
| `agence:manage-self` | Modifier les informations de son agence | `agence` | No |
| `user:view` | Consulter les utilisateurs | `admin` | No |
| `user:manage` | Gerer les utilisateurs | `admin` | No |
| `role:view` | Consulter les roles | `admin` | No |
| `role:manage` | Gerer les roles | `admin` | No |
| `audit:view` | Consulter l'historique d'audit | `admin` | No |
| `activity:view` | Consulter l'activite metier | `admin` | No |
| `config:view` | Consulter la configuration | `config` | Yes |
| `config:manage` | Gerer la configuration | `config` | Yes |
| `referentiel:view` | Consulter les referentiels | `referentiel` | No |
| `referentiel:manage` | Gerer les referentiels | `referentiel` | No |
| `contact-compagnie:view` | Consulter les contacts compagnie | `contact-compagnie` | No |
| `contact-compagnie:manage` | Gérer les contacts compagnie | `contact-compagnie` | No |
| `sinistre:view` | Consulter les sinistres | `sinistre` | No |
| `sinistre:create` | Déclarer un sinistre | `sinistre` | No |
| `sinistre:manage` | Gérer les dossiers sinistre | `sinistre` | No |
| `sinistre:finance` | Gérer les opérations financières des sinistres | `sinistre` | No |
| `sinistre:referentiel` | Gérer les experts et garages | `sinistre` | No |

## Appendix B: Route, Page and API Reference Inventory

Every declared router entry is listed, including redirects and aliases.
Direct permission literals are NOT necessarily complete access checks. Shared-component/helper literals are a transitive reference inventory, not proof they all execute.
The central route rules in assurance-web/src/lib/authorization.ts and navigation in app-navigation.ts must also be applied.
Pages without literals may rely on route checks, service APIs or imported components; their writes must not be treated as automatically safe.

| Route | Page / redirect | Direct permission references | Direct API references |
|---|---|---|---|
| `/login` | `assurance-web/src/pages/public/LoginPage.tsx` | - | - |
| `/` | `<Navigate to="/app" replace />` | - | - |
| `/app` | `assurance-web/src/layouts/AppLayout.tsx` | - | - |
| `/app/` (index) | `assurance-web/src/pages/app/AppIndexPage.tsx` | `contrat:view`, `quittance:view` | - |
| `/app/aide` | `assurance-web/src/features/help/pages/HelpPage.tsx` | - | - |
| `/app/platform` | `assurance-web/src/features/dashboard/pages/PlatformDashboardPage.tsx` | - | `authApi.agencyContextOptions`, `platformDashboardApi.get` |
| `/app/profile` | `assurance-web/src/pages/app/ProfilePage.tsx` | - | `authApi.changePassword`, `authApi.revokeOtherSessions`, `authApi.revokeSession`, `authApi.sessions` |
| `/app/production` | `assurance-web/src/features/production/pages/ProductionDashboardPage.tsx` | `client:view`, `contrat:create`, `contrat:view` | - |
| `/app/sinistre` | `assurance-web/src/features/sinistre/pages/SinistreDashboardPage.tsx` | `sinistre:create`, `sinistre:finance`, `sinistre:manage`, `sinistre:referentiel`, `sinistre:view` | - |
| `/app/sinistre/dossiers` | `assurance-web/src/features/sinistre/pages/SinistreListPage.tsx` | `sinistre:create`, `sinistre:manage` | `sinistreApi.deleteEarlyClaim`, `sinistreApi.exportRegister`, `sinistreApi.get`, `sinistreApi.list`, `sinistreApi.transition` |
| `/app/sinistre/registre` | `assurance-web/src/features/sinistre/pages/SinistreRegistrePage.tsx` | - | - |
| `/app/sinistre/statistiques` | `assurance-web/src/features/sinistre/pages/SinistreStatisticsPage.tsx` | - | `sinistreApi.statistics` |
| `/app/sinistre/declarer` | `assurance-web/src/features/sinistre/pages/SinistreDeclarationPage.tsx` | `sinistre:referentiel` | `referenceApi.list`, `sinistreApi.assistances`, `sinistreApi.coverage`, `sinistreApi.duplicates`, `sinistreApi.open`, `sinistreApi.saveExpert` |
| `/app/sinistre/dossiers/:sinistreId` | `assurance-web/src/features/sinistre/pages/SinistreDetailPage.tsx` | `sinistre:finance`, `sinistre:manage` | `sinistreApi.addOperation`, `sinistreApi.addParty`, `sinistreApi.addProvision`, `sinistreApi.cancelOperation`, `sinistreApi.deleteDocument`, `sinistreApi.deleteParty`, `sinistreApi.downloadDocument`, `sinistreApi.eligibleProviders`, `sinistreApi.get`, `sinistreApi.managers`, `sinistreApi.reviewDocument`, `sinistreApi.saveMission`, `sinistreApi.transition`, `sinistreApi.treasuryAccounts`, `sinistreApi.update`, `sinistreApi.updateGuarantees`, `sinistreApi.updateParty`, `sinistreApi.uploadDocument` |
| `/app/sinistre/referentiels` | `<Navigate to="/app/sinistre/prestataires" replace />` | - | - |
| `/app/sinistre/experts` | `<Navigate to="/app/sinistre/prestataires?type=EXPERT" replace />` | - | - |
| `/app/sinistre/garages` | `<Navigate to="/app/sinistre/prestataires?type=GARAGE" replace />` | - | - |
| `/app/sinistre/prestataires` | `assurance-web/src/features/sinistre/pages/SinistrePrestatairesPage.tsx` | `sinistre:referentiel` | `referenceApi.list`, `sinistreApi.providerOptions`, `sinistreApi.providers`, `sinistreApi.saveExpert`, `sinistreApi.saveGarage`, `sinistreApi.specialties` |
| `/app/sinistre/prestataires/specialites` | `assurance-web/src/features/sinistre/pages/SinistreSpecialitesPage.tsx` | `sinistre:referentiel` | `sinistreApi.providerOptions`, `sinistreApi.saveSpecialty`, `sinistreApi.specialties` |
| `/app/production/ajouter-dossier` | `assurance-web/src/features/production/pages/ContratCreationPage.tsx` | - | `contractCreationApi.createContratDraft`, `referenceApi.list`, `referenceApi.personGuaranteeFormulas`, `referenceApi.pricingLines` |
| `/app/production/ajouter-dossier/assistance-voyage` | `assurance-web/src/features/production/pages/AssistanceVoyageCreationPage.tsx` | - | `assistanceVoyageApi.create`, `assistanceVoyageApi.finalizeDraft`, `assistanceVoyageApi.quote`, `assistanceVoyageApi.renew`, `assistanceVoyageApi.saveDraftSection`, `assistanceVoyageApi.update`, `clientApi.listClients`, `clientApi.searchClient`, `contractApi.getContrat`, `referenceApi.list` |
| `/app/production/ajouter-dossier/assistance-automobile` | `assurance-web/src/features/production/pages/AssistanceAutomobileCreationPage.tsx` | - | `assistanceAutomobileApi.create`, `assistanceAutomobileApi.finalizeDraft`, `assistanceAutomobileApi.quote`, `assistanceAutomobileApi.renew`, `assistanceAutomobileApi.saveDraftSection`, `assistanceAutomobileApi.update`, `assistanceProductApi.listProductRates`, `clientApi.listClients`, `clientApi.listGroupesClients`, `contractApi.getContrat`, `referenceApi.list` |
| `/app/production/contrats/:contratId/assistance-voyage/modifier` | `assurance-web/src/features/production/pages/AssistanceVoyageCreationPage.tsx` | - | `assistanceVoyageApi.create`, `assistanceVoyageApi.finalizeDraft`, `assistanceVoyageApi.quote`, `assistanceVoyageApi.renew`, `assistanceVoyageApi.saveDraftSection`, `assistanceVoyageApi.update`, `clientApi.listClients`, `clientApi.searchClient`, `contractApi.getContrat`, `referenceApi.list` |
| `/app/production/contrats/:contratId/assistance-automobile/modifier` | `assurance-web/src/features/production/pages/AssistanceAutomobileCreationPage.tsx` | - | `assistanceAutomobileApi.create`, `assistanceAutomobileApi.finalizeDraft`, `assistanceAutomobileApi.quote`, `assistanceAutomobileApi.renew`, `assistanceAutomobileApi.saveDraftSection`, `assistanceAutomobileApi.update`, `assistanceProductApi.listProductRates`, `clientApi.listClients`, `clientApi.listGroupesClients`, `contractApi.getContrat`, `referenceApi.list` |
| `/app/production/prospection` | `assurance-web/src/features/production/pages/ProspectionPage.tsx` | `contrat:delete`, `contrat:update` | `contractApi.deleteContrat`, `contractApi.listProspections`, `referenceApi.list` |
| `/app/production/prospection/ajouter-devis` | `assurance-web/src/features/production/pages/ContratCreationPage.tsx` | - | `contractCreationApi.createContratDraft`, `referenceApi.list`, `referenceApi.personGuaranteeFormulas`, `referenceApi.pricingLines` |
| `/app/production/prospection/devis/flotte/:draftId` | `assurance-web/src/features/production/pages/FlotteContratCreationPage.tsx` | - | - |
| `/app/production/ajouter-dossier/particulier` | `assurance-web/src/features/production/pages/ParticulierContratCreationPage.tsx` | - | - |
| `/app/production/ajouter-dossier/particulier/:draftId` | `assurance-web/src/features/production/pages/ParticulierContratCreationPage.tsx` | - | - |
| `/app/production/ajouter-dossier/flotte` | `assurance-web/src/features/production/pages/FlotteContratCreationPage.tsx` | - | - |
| `/app/production/ajouter-dossier/flotte/:draftId` | `assurance-web/src/features/production/pages/FlotteContratCreationPage.tsx` | - | - |
| `/app/production/ajouter-dossier/convention` | `assurance-web/src/features/production/pages/ConventionContratCreationPage.tsx` | - | - |
| `/app/production/ajouter-dossier/convention/:draftId` | `assurance-web/src/features/production/pages/ConventionContratCreationPage.tsx` | - | - |
| `/app/production/renouvellements/particulier/:draftId` | `assurance-web/src/features/production/pages/ParticulierContratCreationPage.tsx` | - | - |
| `/app/production/renouvellements/convention/:draftId` | `assurance-web/src/features/production/pages/ConventionContratCreationPage.tsx` | - | - |
| `/app/production/renouvellements/flotte/:draftId` | `assurance-web/src/features/production/pages/FlotteContratCreationPage.tsx` | - | - |
| `/app/production/contrats` | `assurance-web/src/features/production/pages/ContratsPage.tsx` | `assistance:manage`, `avenant:create`, `avenant:delete`, `avenant:rectify`, `carte-verte:manage`, `contrat:create`, `contrat:delete`, `contrat:recalculate-financial-history`, `contrat:renew`, `contrat:update`, `contrat:view`, `piece-jointe:view` | `avenantApi.deleteAvenantDraft`, `contractApi.createRenouvellementDraft`, `contractApi.deleteContrat`, `contractApi.deleteMouvement`, `contractApi.listContrats`, `referenceApi.list` |
| `/app/production/registre` | `assurance-web/src/features/production/pages/ProductionRegisterPage.tsx` | - | `contractApi.exportProductionRegister`, `contractApi.searchProductionRegister`, `referenceApi.list` |
| `/app/production/contrats/:contratId` | `assurance-web/src/features/production/pages/ContratShowPage.tsx` | - | `contractApi.downloadDevisPdf`, `contractApi.downloadFlottePolicyPdf`, `contractApi.getContrat`, `referenceApi.list` |
| `/app/production/contrats/:contratId/pdf` | `assurance-web/src/features/production/pages/ContratPdfPage.tsx` | - | `contractApi.downloadDevisPdf`, `contractApi.downloadFlottePolicyPdf`, `contractApi.getContrat`, `referenceApi.list` |
| `/app/production/portefeuille-clients` | `<Navigate to="/app/production" replace />` | - | - |
| `/app/production/portefeuille-clients/:clientId` | `assurance-web/src/features/production/pages/ClientPortfolioPage.tsx` | `bordereau-compagnie:view`, `client:view`, `quittance:view`, `reglement-client:view`, `sinistre:finance`, `sinistre:manage`, `sinistre:view`, `tresorerie:view` | `clientApi.getClientCrm`, `comptaApi.clientDocumentPdf`, `comptaApi.clientReceivables`, `comptaApi.companyPortfolioSummary`, `comptaApi.searchClientDocuments`, `sinistreApi.list` |
| `/app/production/contrats/:contratId/avenants/:code` | `assurance-web/src/features/production/pages/AvenantContratPage.tsx` | - | `avenantApi.createAvenant`, `avenantApi.getAvenantContext`, `avenantApi.getAvenantDetail`, `avenantApi.getAvenantDraft`, `avenantApi.getAvenantRectification`, `avenantApi.previewAvenant`, `avenantApi.rectifyAvenant`, `avenantApi.saveAvenantDraft` |
| `/app/production/echeances` | `assurance-web/src/features/production/pages/EcheancesPage.tsx` | `contrat:renew`, `contrat:update` | `contractApi.exportEcheancesAssistance`, `contractApi.exportEcheancesAutomobile`, `contractApi.searchEcheancesAssistance`, `contractApi.searchEcheancesAutomobile`, `referenceApi.list` |
| `/app/production/contrats/:contratId/pieces-jointes` | `assurance-web/src/features/production/pages/ContratPiecesJointesPage.tsx` | `client:create`, `client:manage`, `contrat:update`, `piece-jointe:manage` | `attachmentApi.assignOwner`, `attachmentApi.deleteClient`, `attachmentApi.deletePieceJointe`, `attachmentApi.downloadPieceJointe`, `attachmentApi.getContratPiecesJointes`, `attachmentApi.replace`, `attachmentApi.reuse`, `attachmentApi.unlink`, `attachmentApi.uploadClient`, `attachmentApi.uploadPieceJointe` |
| `/app/production/contrats/:contratId/assistance` | `assurance-web/src/features/production/pages/ContratAssistancePage.tsx` | - | `contractServiceApi.deleteAssistance`, `contractServiceApi.getAssistanceContext`, `contractServiceApi.saveAssistance` |
| `/app/production/contrats/:contratId/cartes-vertes` | `assurance-web/src/features/production/pages/ContratCartesVertesPage.tsx` | - | `contractServiceApi.deleteCarteVerte`, `contractServiceApi.getCarteVerteContext`, `contractServiceApi.saveCarteVerte` |
| `/app/production/attestations-stock` | `assurance-web/src/features/production/pages/AttestationStockPage.tsx` | - | `attestationStockApi.addLotsAttestation`, `attestationStockApi.cancelAttestationStock`, `attestationStockApi.createLivraisonAttestation`, `attestationStockApi.createSeuilStockAttestation`, `attestationStockApi.dashboardAttestationsStock`, `attestationStockApi.listLivraisonsAttestation`, `attestationStockApi.searchAttestationsStock`, `attestationStockApi.updateAttestationsStockSettings`, `attestationStockApi.updateSeuilStockAttestation`, `attestationStockApi.validateLivraisonAttestation`, `referenceApi.list` |
| `/app/production/attestations-stock/commandes` | `assurance-web/src/features/production/pages/AttestationStockPage.tsx` | - | `attestationStockApi.addLotsAttestation`, `attestationStockApi.cancelAttestationStock`, `attestationStockApi.createLivraisonAttestation`, `attestationStockApi.createSeuilStockAttestation`, `attestationStockApi.dashboardAttestationsStock`, `attestationStockApi.listLivraisonsAttestation`, `attestationStockApi.searchAttestationsStock`, `attestationStockApi.updateAttestationsStockSettings`, `attestationStockApi.updateSeuilStockAttestation`, `attestationStockApi.validateLivraisonAttestation`, `referenceApi.list` |
| `/app/production/attestations-stock/receptions` | `assurance-web/src/features/production/pages/AttestationStockPage.tsx` | - | `attestationStockApi.addLotsAttestation`, `attestationStockApi.cancelAttestationStock`, `attestationStockApi.createLivraisonAttestation`, `attestationStockApi.createSeuilStockAttestation`, `attestationStockApi.dashboardAttestationsStock`, `attestationStockApi.listLivraisonsAttestation`, `attestationStockApi.searchAttestationsStock`, `attestationStockApi.updateAttestationsStockSettings`, `attestationStockApi.updateSeuilStockAttestation`, `attestationStockApi.validateLivraisonAttestation`, `referenceApi.list` |
| `/app/compta` | `assurance-web/src/features/compta/pages/ComptaDashboardPage.tsx` | `bordereau-compagnie:view`, `quittance:view`, `reglement-client:view`, `tresorerie:view` | - |
| `/app/compta/parametres` | `assurance-web/src/features/compta/pages/ComptaSettingsPage.tsx` | - | - |
| `/app/compta/parametres/banques` | `assurance-web/src/features/compta/pages/BanksSettingsPage.tsx` | `tresorerie:manage` | `comptaApi.banks`, `comptaApi.createBank`, `comptaApi.updateBank` |
| `/app/compta/parametres/reglements-clients` | `assurance-web/src/features/compta/pages/ClientPaymentSettingsPage.tsx` | `reglement-client:manage` | `comptaApi.clientPaymentPolicy`, `comptaApi.updateClientPaymentPolicy` |
| `/app/compta/quittances` | `assurance-web/src/features/compta/pages/QuittanceAffectationPage.tsx` | `config:manage`, `quittance:create`, `quittance:manage` | `comptaApi.availableQuittanceCompanies`, `comptaApi.exportQuittances`, `comptaApi.insuranceBranches`, `comptaApi.searchQuittances` |
| `/app/compta/releves-factures` | `assurance-web/src/features/compta/pages/RelevesFacturesPage.tsx` | `quittance:create`, `quittance:manage` | `clientApi.getClientCrm`, `comptaApi.cancelClientDocument`, `comptaApi.clientDocument`, `comptaApi.clientDocumentPdf`, `comptaApi.companies`, `comptaApi.createClientDocument`, `comptaApi.createInvoiceFromStatement`, `comptaApi.exportClientDocumentSources`, `comptaApi.insuranceBranches`, `comptaApi.proposeClientDocumentDueDate`, `comptaApi.reviseClientDocument`, `comptaApi.searchClientDocumentSources`, `comptaApi.searchClientDocuments` |
| `/app/compta/facturation-conventions` | `<Navigate to="/app/compta/conventions/factures" replace />` | - | - |
| `/app/compta/conventions` | `assurance-web/src/features/compta/pages/ConventionDepartmentPage.tsx` | - | - |
| `/app/compta/conventions/factures` | `assurance-web/src/features/compta/pages/FacturationConventionsPage.tsx` | `quittance:create`, `quittance:manage`, `quittance:view`, `reglement-client:view` | `comptaApi.companies`, `comptaApi.conventionBillingOptions`, `comptaApi.createConventionInvoice`, `comptaApi.prepareConventionInvoice`, `comptaApi.previewConventionInvoice`, `comptaApi.proposeConventionInvoiceDueDate` |
| `/app/compta/conventions/encaissements` | `assurance-web/src/features/compta/pages/ConventionCollectionsPage.tsx` | `quittance:create`, `quittance:manage`, `quittance:view`, `reglement-client:create`, `reglement-client:manage`, `reglement-client:view` | `comptaApi.cancelClientDocument`, `comptaApi.clientDocument`, `comptaApi.clientDocumentPdf`, `comptaApi.clientInvoiceReceivables`, `comptaApi.companies`, `comptaApi.conventionBillingOptions`, `comptaApi.deleteClientDocument` |
| `/app/compta/conventions/encaissements/nouveau` | `assurance-web/src/features/compta/pages/NouveauReglementClientPage.tsx` | `reglement-client:create`, `reglement-client:manage` | `comptaApi.banks`, `comptaApi.clientPaymentPolicy`, `comptaApi.createClientPayment`, `comptaApi.createMultiClientBankDeposit`, `comptaApi.selectedClientReceivables`, `comptaApi.treasuryAccounts` |
| `/app/compta/conventions/production` | `assurance-web/src/features/compta/pages/ConventionProductionPage.tsx` | `quittance:view` | `comptaApi.companies`, `comptaApi.conventionBillingOptions`, `comptaApi.conventionProduction`, `comptaApi.exportConventionProduction` |
| `/app/compta/reglements` | `assurance-web/src/features/compta/pages/ReglementsClientsPage.tsx` | `reglement-client:create`, `reglement-client:manage` | `clientApi.getClientCrm`, `comptaApi.clientDocument`, `comptaApi.clientInvoiceReceivables`, `comptaApi.clientReceivables`, `comptaApi.selectedClientReceivables`, `referenceApi.list` |
| `/app/compta/reglements/nouveau` | `assurance-web/src/features/compta/pages/NouveauReglementClientPage.tsx` | `reglement-client:create`, `reglement-client:manage` | `comptaApi.banks`, `comptaApi.clientPaymentPolicy`, `comptaApi.createClientPayment`, `comptaApi.createMultiClientBankDeposit`, `comptaApi.selectedClientReceivables`, `comptaApi.treasuryAccounts` |
| `/app/compta/reglements/versement-multi-clients` | `assurance-web/src/features/compta/pages/ReglementsClientsPage.tsx` | `reglement-client:create`, `reglement-client:manage` | `clientApi.getClientCrm`, `comptaApi.clientDocument`, `comptaApi.clientInvoiceReceivables`, `comptaApi.clientReceivables`, `comptaApi.selectedClientReceivables`, `referenceApi.list` |
| `/app/compta/reglements/historique` | `assurance-web/src/features/compta/pages/ReglementsEnregistresPage.tsx` | `quittance:create`, `quittance:manage`, `reglement-client:create`, `reglement-client:manage` | `clientApi.getClientCrm`, `comptaApi.cancelClientPayment`, `comptaApi.clientDocumentPdf`, `comptaApi.clientPaymentPdf`, `comptaApi.clientPayments`, `comptaApi.createInvoiceFromClientPayment`, `comptaApi.recordedPaymentInstruments` |
| `/app/compta/reglements/validation` | `<Navigate to="/app/compta/reglements" replace />` | - | - |
| `/app/compta/reglements/etat-encaissements` | `<Navigate to="/app/compta/reglements" replace />` | - | - |
| `/app/compta/reglements/:reglementId` | `assurance-web/src/features/compta/pages/ReglementClientDetailPage.tsx` | - | `comptaApi.clientPayment` |
| `/app/compta/bordereaux-compagnies` | `assurance-web/src/features/compta/pages/BordereauxCompagniesPage.tsx` | `bordereau-compagnie:create`, `reglement-compagnie:create` | `comptaApi.availableQuittanceCompanies`, `comptaApi.companyBordereaux` |
| `/app/compta/bordereaux-compagnies/nouveau` | `assurance-web/src/features/compta/pages/BordereauCompagnieFormPage.tsx` | - | `comptaApi.availableQuittanceCompanies`, `comptaApi.companyBordereau`, `comptaApi.companyBordereauSources`, `comptaApi.createCompanyBordereau`, `comptaApi.updateCompanyBordereau` |
| `/app/compta/bordereaux-compagnies/reglement` | `assurance-web/src/features/compta/pages/NouveauReglementCompagniePage.tsx` | - | `comptaApi.companyBordereau`, `comptaApi.createCompanyPayment`, `comptaApi.treasuryAccounts` |
| `/app/compta/bordereaux-compagnies/:bordereauId/modifier` | `assurance-web/src/features/compta/pages/BordereauCompagnieFormPage.tsx` | - | `comptaApi.availableQuittanceCompanies`, `comptaApi.companyBordereau`, `comptaApi.companyBordereauSources`, `comptaApi.createCompanyBordereau`, `comptaApi.updateCompanyBordereau` |
| `/app/compta/bordereaux-compagnies/:bordereauId` | `assurance-web/src/features/compta/pages/BordereauCompagnieDetailPage.tsx` | `bordereau-compagnie:cancel`, `bordereau-compagnie:create`, `bordereau-compagnie:reconcile`, `bordereau-compagnie:transmit`, `bordereau-compagnie:validate`, `reglement-compagnie:create`, `reglement-compagnie:manage` | `comptaApi.cancelCompanyBordereau`, `comptaApi.changeCompanyPaymentInstrumentStatus`, `comptaApi.companyBordereau`, `comptaApi.reconcileCompanyBordereau`, `comptaApi.transmitCompanyBordereau`, `comptaApi.treasuryAccounts`, `comptaApi.validateCompanyBordereau` |
| `/app/compta/tresorerie` | `<Navigate to="/app/compta/tresorerie/comptes" replace />` | - | - |
| `/app/compta/tresorerie/comptes` | `assurance-web/src/features/compta/pages/TresorerieComptesPage.tsx` | `tresorerie:manage` | `comptaApi.banks`, `comptaApi.changeTreasuryAccountStatus`, `comptaApi.createTreasuryAccount`, `comptaApi.saveTreasuryAccountAssignments`, `comptaApi.treasuryAccountAssignments`, `comptaApi.treasuryAccounts`, `comptaApi.treasuryAdministrationAccounts`, `comptaApi.treasuryUsers`, `comptaApi.updateTreasuryAccount` |
| `/app/compta/tresorerie/comptes/:accountId` | `assurance-web/src/features/compta/pages/TresorerieCompteDetailPage.tsx` | - | `comptaApi.treasuryAccounts`, `comptaApi.treasuryJournal`, `comptaApi.treasuryOperations` |
| `/app/compta/tresorerie/instruments` | `<Navigate to="/app/compta/tresorerie/encaissements-en-attente" replace />` | - | - |
| `/app/compta/tresorerie/encaissements-en-attente` | `assurance-web/src/features/compta/pages/EncaissementsEnAttentePage.tsx` | `client:view`, `reglement-client:manage`, `reglement-client:view`, `tresorerie:manage` | `clientApi.getClientCrm`, `comptaApi.createCashRemittance`, `comptaApi.createRemittanceSlip`, `comptaApi.eligibleCashRemittanceDays`, `comptaApi.paymentInstruments`, `comptaApi.remittanceSlipPdf`, `comptaApi.treasuryAccounts` |
| `/app/compta/tresorerie/impayes-clients` | `assurance-web/src/features/compta/pages/ImpayesClientsPage.tsx` | `client:view`, `reglement-client:manage`, `tresorerie:manage` | `clientApi.getClientCrm`, `comptaApi.bankRejections`, `comptaApi.exportBankRejections`, `comptaApi.representPaymentInstrument` |
| `/app/compta/tresorerie/bordereaux-remise` | `assurance-web/src/features/compta/pages/InstrumentsTresoreriePage.tsx` | `tresorerie:manage` | `comptaApi.deleteRemittanceSlipDraft`, `comptaApi.depositRemittanceSlip`, `comptaApi.remittanceSlipPdf`, `comptaApi.remittanceSlips` |
| `/app/compta/tresorerie/bordereaux-remise/nouveau` | `assurance-web/src/features/compta/pages/NouveauBordereauRemisePage.tsx` | `tresorerie:manage` | `comptaApi.createCashRemittance`, `comptaApi.createRemittanceSlip`, `comptaApi.eligibleCashRemittanceDays`, `comptaApi.remittanceSlipPdf`, `comptaApi.selectedEligibleRemittanceInstruments`, `comptaApi.treasuryAccounts` |
| `/app/compta/tresorerie/bordereaux-remise/:bordereauId` | `assurance-web/src/features/compta/pages/BordereauRemiseDetailPage.tsx` | `tresorerie:manage` | `comptaApi.deleteRemittanceSlipDraft`, `comptaApi.depositRemittanceSlip`, `comptaApi.remittanceSlip`, `comptaApi.remittanceSlipPdf`, `comptaApi.removeRemittanceSlipLine` |
| `/app/compta/tresorerie/journal` | `assurance-web/src/features/compta/pages/JournalTresoreriePage.tsx` | - | `comptaApi.treasuryAccounts`, `comptaApi.treasuryJournal` |
| `/app/compta/tresorerie/rapprochement-bancaire` | `assurance-web/src/features/compta/pages/RapprochementBancairePage.tsx` | `tresorerie:manage` | `comptaApi.bankStatementImport`, `comptaApi.bankStatementImports`, `comptaApi.bankStatementProfiles`, `comptaApi.importBankStatement`, `comptaApi.pendingPaymentInstruments`, `comptaApi.previewBankStatement`, `comptaApi.saveBankReconciliations`, `comptaApi.treasuryAccounts`, `comptaApi.validateBankReconciliation` |
| `/app/compta/tresorerie/operations` | `assurance-web/src/features/compta/pages/OperationsTresoreriePage.tsx` | - | `comptaApi.cancelTreasuryOperation`, `comptaApi.createTreasuryAdjustment`, `comptaApi.createTreasuryTransfer`, `comptaApi.treasuryAccounts`, `comptaApi.treasuryOperations` |
| `/app/compta/tresorerie/sessions-caisse` | `<Navigate to="/app/compta/tresorerie/comptes" replace />` | - | - |
| `/app/crm` | `assurance-web/src/features/crm/pages/ClientCrmPage.tsx` | `client:create`, `client:manage`, `sinistre:finance`, `sinistre:manage`, `sinistre:view` | `attachmentApi.uploadClient`, `clientApi.acquisitionOptions`, `clientApi.assignClientGroup`, `clientApi.createClient`, `clientApi.createPaymentCondition`, `clientApi.downloadPaymentConditionEvidence`, `clientApi.endClientGroup`, `clientApi.getClientCrm`, `clientApi.listClients`, `clientApi.listGroupesClients`, `clientApi.listPaymentConditions`, `clientApi.updateAcquisition`, `clientApi.updateClient`, `referenceApi.list` |
| `/app/crm/parametres` | `assurance-web/src/features/crm/pages/CrmSettingsPage.tsx` | - | - |
| `/app/crm/parametres/origines-commerciales` | `assurance-web/src/features/crm/pages/CommercialOriginsSettingsPage.tsx` | - | `clientApi.acquisitionOptions`, `clientApi.createOrigin`, `clientApi.updateOrigin` |
| `/app/companies` | `assurance-web/src/features/production/pages/CompaniesDashboardPage.tsx` | `contact-compagnie:manage`, `contact-compagnie:view`, `grille-tarifaire:manage`, `grille-tarifaire:view`, `referentiel:manage`, `referentiel:view` | - |
| `/app/companies/liste` | `assurance-web/src/features/production/pages/CompaniesPage.tsx` | `contact-compagnie:manage`, `contact-compagnie:view` | `referenceAdminApi.createInsuranceCompany`, `referenceAdminApi.updateInsuranceCompany`, `referenceApi.list` |
| `/app/companies/conventions` | `assurance-web/src/features/production/pages/CompaniesConventionsPage.tsx` | - | `pricingApi.createGrid`, `referenceAdminApi.createConvention`, `referenceAdminApi.updateConvention`, `referenceApi.list` |
| `/app/companies/grilles-tarifaires` | `assurance-web/src/features/production/pages/CompaniesPricingGridsPage.tsx` | `grille-tarifaire:manage`, `referentiel:manage` | `pricingApi.createGrid`, `pricingApi.updateGrid`, `referenceApi.list`, `referenceApi.pricingGridCatalogue` |
| `/app/companies/contacts` | `assurance-web/src/features/production/pages/CompanyContactsPage.tsx` | `contact-compagnie:manage` | `companyContactsApi.create`, `companyContactsApi.list`, `companyContactsApi.update`, `companyContactsApi.updateStatus`, `referenceApi.list` |
| `/app/companies/assistance` | `assurance-web/src/features/production/pages/AssistanceSettingsPage.tsx` | - | `assistanceProductApi.createCompany`, `assistanceProductApi.deleteCompany`, `assistanceProductApi.updateCompany`, `referenceApi.list` |
| `/app/companies/assistance/produits` | `assurance-web/src/features/production/pages/AssistanceProductsSettingsPage.tsx` | - | `assistanceProductApi.createProduct`, `assistanceProductApi.createProductRate`, `assistanceProductApi.createPromoCode`, `assistanceProductApi.deactivateProduct`, `assistanceProductApi.deleteProductPermanently`, `assistanceProductApi.deleteProductRate`, `assistanceProductApi.deletePromoCode`, `assistanceProductApi.listProductRates`, `assistanceProductApi.listPromoCodes`, `assistanceProductApi.updateProduct`, `assistanceProductApi.updateProductRate`, `assistanceProductApi.updatePromoCode`, `referenceApi.list` |
| `/app/admin` | `assurance-web/src/features/admin/pages/AdminLayout.tsx` | - | - |
| `/app/admin/` (index) | `assurance-web/src/features/admin/pages/AdminIndexPage.tsx` | - | - |
| `/app/admin/utilisateurs` | `assurance-web/src/features/admin/pages/AdminUsersPage.tsx` | - | `adminApi.agencies`, `adminApi.roles`, `adminApi.users` |
| `/app/admin/roles` | `assurance-web/src/features/admin/pages/AdminRolesPage.tsx` | - | `adminApi.agencies`, `adminApi.permissions`, `adminApi.roles` |
| `/app/admin/roles/:roleId` | `assurance-web/src/features/admin/pages/AdminRolesPage.tsx` | - | `adminApi.agencies`, `adminApi.permissions`, `adminApi.roles` |
| `/app/admin/audit` | `assurance-web/src/features/admin/pages/AdminAuditPage.tsx` | - | - |
| `/app/admin/activite` | `assurance-web/src/features/admin/pages/AdminActivityPage.tsx` | `contrat:view` | `adminApi.platformAdmins`, `adminApi.users` |
| `/app/admin/agence` | `assurance-web/src/features/admin/pages/AdminAgenciesPage.tsx` | - | `adminApi.agencies` |
| `/app/admin/agences` | `assurance-web/src/features/admin/pages/AdminAgenciesPage.tsx` | - | `adminApi.agencies` |
| `/app/admin/administrateurs-plateforme` | `assurance-web/src/features/admin/pages/PlatformAdminsPage.tsx` | - | `adminApi.platformAdmins` |
| `/app/production/parametres` | `assurance-web/src/features/production/pages/ProductionSettingsPage.tsx` | `config:manage`, `regle-fiscale:manage`, `regle-fiscale:view` | - |
| `/app/production/parametres/tarifs-usage` | `assurance-web/src/features/production/pages/TarifUsageSettingsPage.tsx` | - | `pricingApi.bulkUpdateUsageNetPremium`, `pricingApi.createUsageRate`, `pricingApi.deleteUsageRate`, `pricingApi.updateUsageRate`, `pricingApi.usageRateAdjustmentHistory`, `referenceAdminApi.updateUsageTrailerRates`, `referenceApi.list` |
| `/app/production/parametres/usages` | `assurance-web/src/features/production/pages/UsagesSettingsPage.tsx` | - | - |
| `/app/production/parametres/groupes-stock-attestations` | `assurance-web/src/features/production/pages/GroupesUsageAttestationSettingsPage.tsx` | - | - |
| `/app/production/parametres/categories-client` | `assurance-web/src/features/production/pages/CategoriesClientSettingsPage.tsx` | - | - |
| `/app/production/parametres/garanties` | `assurance-web/src/features/production/pages/GarantiesSettingsPage.tsx` | - | - |
| `/app/production/parametres/marques` | `assurance-web/src/features/production/pages/MarquesSettingsPage.tsx` | - | - |
| `/app/production/parametres/carrosseries` | `assurance-web/src/features/production/pages/CarrosseriesSettingsPage.tsx` | - | - |
| `/app/production/parametres/carburants` | `assurance-web/src/features/production/pages/CarburantsSettingsPage.tsx` | - | - |
| `/app/production/parametres/sous-classes` | `assurance-web/src/features/production/pages/SousClassesSettingsPage.tsx` | - | - |
| `/app/production/parametres/categories-transport` | `assurance-web/src/features/production/pages/CategoriesTransportSettingsPage.tsx` | - | - |
| `/app/production/parametres/pieces-jointes` | `assurance-web/src/features/production/pages/PiecesJointesSettingsPage.tsx` | - | `attachmentApi.savePolicy`, `attachmentSettingsApi.createType`, `attachmentSettingsApi.listMovementTypes`, `attachmentSettingsApi.listTypes`, `attachmentSettingsApi.updateType`, `referenceApi.list` |
| `/app/production/parametres/regles-fiscales` | `assurance-web/src/features/production/pages/FiscalRulesSettingsPage.tsx` | `config:manage`, `regle-fiscale:manage` | `fiscalRulesApi.create`, `fiscalRulesApi.deactivate`, `fiscalRulesApi.list`, `fiscalRulesApi.update` |
| `/app/*` | `assurance-web/src/pages/app/AppNotFound.tsx` | - | - |
| `/*` | `assurance-web/src/pages/NotFound.tsx` | - | - |

### Imported Feature Component and Hook References

These help catch nested action dialogs and multi-request workflows. They deliberately over-approximate usage; endpoint/service authorization remains authoritative.

| Page component | Permission references including feature imports | API references including feature imports |
|---|---|---|
| `assurance-web/src/pages/public/LoginPage.tsx` | - | - |
| `assurance-web/src/layouts/AppLayout.tsx` | - | - |
| `assurance-web/src/pages/app/AppIndexPage.tsx` | `attestation-stock:manage`, `attestation-stock:view`, `contrat:create`, `contrat:view`, `quittance:view`, `tresorerie:view` | `comptaApi.bankRejections`, `comptaApi.paymentInstruments`, `comptaApi.searchClientDocumentSources`, `dashboardApi.get` |
| `assurance-web/src/features/help/pages/HelpPage.tsx` | `agence:create`, `agence:manage-self`, `agence:view`, `assistance:manage`, `attestation-stock:manage`, `attestation-stock:view`, `audit:view`, `avenant:create`, `avenant:rectify`, `bordereau-compagnie:create`, `bordereau-compagnie:reconcile`, `bordereau-compagnie:transmit`, `bordereau-compagnie:validate`, `bordereau-compagnie:view`, `carte-verte:manage`, `client:create`, `client:manage`, `client:view`, `config:manage`, `config:view`, `contact-compagnie:manage`, `contact-compagnie:view`, `contrat:create`, `contrat:renew`, `contrat:update`, `contrat:view`, `grille-tarifaire:manage`, `grille-tarifaire:view`, `piece-jointe:view`, `quittance:create`, `quittance:manage`, `quittance:view`, `referentiel:manage`, `referentiel:view`, `regle-fiscale:manage`, `regle-fiscale:view`, `reglement-client:create`, `reglement-client:manage`, `reglement-client:view`, `reglement-compagnie:create`, `reglement-compagnie:manage`, `reglement-compagnie:view`, `role:manage`, `role:view`, `sinistre:create`, `sinistre:finance`, `sinistre:manage`, `sinistre:referentiel`, `sinistre:view`, `tresorerie:manage`, `tresorerie:view`, `user:manage`, `user:view` | - |
| `assurance-web/src/features/dashboard/pages/PlatformDashboardPage.tsx` | - | `authApi.agencyContextOptions`, `platformDashboardApi.get` |
| `assurance-web/src/pages/app/ProfilePage.tsx` | - | `authApi.changePassword`, `authApi.revokeOtherSessions`, `authApi.revokeSession`, `authApi.sessions` |
| `assurance-web/src/features/production/pages/ProductionDashboardPage.tsx` | `client:view`, `contrat:create`, `contrat:view` | `clientApi.listClients`, `clientApi.listGroupesClients` |
| `assurance-web/src/features/sinistre/pages/SinistreDashboardPage.tsx` | `sinistre:create`, `sinistre:finance`, `sinistre:manage`, `sinistre:referentiel`, `sinistre:view` | - |
| `assurance-web/src/features/sinistre/pages/SinistreListPage.tsx` | `sinistre:create`, `sinistre:manage` | `referenceApi.list`, `sinistreApi.changeStage`, `sinistreApi.coverage`, `sinistreApi.deleteEarlyClaim`, `sinistreApi.exportRegister`, `sinistreApi.get`, `sinistreApi.list`, `sinistreApi.lookupContracts`, `sinistreApi.transition` |
| `assurance-web/src/features/sinistre/pages/SinistreRegistrePage.tsx` | `sinistre:create`, `sinistre:manage` | `referenceApi.list`, `sinistreApi.changeStage`, `sinistreApi.coverage`, `sinistreApi.deleteEarlyClaim`, `sinistreApi.exportRegister`, `sinistreApi.get`, `sinistreApi.list`, `sinistreApi.lookupContracts`, `sinistreApi.transition` |
| `assurance-web/src/features/sinistre/pages/SinistreStatisticsPage.tsx` | - | `sinistreApi.statistics` |
| `assurance-web/src/features/sinistre/pages/SinistreDeclarationPage.tsx` | `sinistre:referentiel` | `referenceApi.list`, `sinistreApi.assistances`, `sinistreApi.coverage`, `sinistreApi.duplicates`, `sinistreApi.eligibleProviders`, `sinistreApi.lookupContracts`, `sinistreApi.open`, `sinistreApi.providerOptions`, `sinistreApi.saveExpert`, `sinistreApi.specialties` |
| `assurance-web/src/features/sinistre/pages/SinistreDetailPage.tsx` | `sinistre:finance`, `sinistre:manage` | `sinistreApi.addOperation`, `sinistreApi.addParty`, `sinistreApi.addProvision`, `sinistreApi.cancelOperation`, `sinistreApi.changeStage`, `sinistreApi.deleteDocument`, `sinistreApi.deleteParty`, `sinistreApi.downloadDocument`, `sinistreApi.eligibleProviders`, `sinistreApi.get`, `sinistreApi.managers`, `sinistreApi.reviewDocument`, `sinistreApi.saveMission`, `sinistreApi.transition`, `sinistreApi.treasuryAccounts`, `sinistreApi.update`, `sinistreApi.updateGuarantees`, `sinistreApi.updateParty`, `sinistreApi.uploadDocument` |
| `assurance-web/src/features/sinistre/pages/SinistrePrestatairesPage.tsx` | `sinistre:referentiel` | `referenceApi.list`, `sinistreApi.providerOptions`, `sinistreApi.providers`, `sinistreApi.saveExpert`, `sinistreApi.saveGarage`, `sinistreApi.specialties` |
| `assurance-web/src/features/sinistre/pages/SinistreSpecialitesPage.tsx` | `sinistre:referentiel` | `sinistreApi.providerOptions`, `sinistreApi.saveSpecialty`, `sinistreApi.specialties` |
| `assurance-web/src/features/production/pages/ContratCreationPage.tsx` | `client:create`, `client:manage`, `client:view`, `contrat:create`, `contrat:update` | `attestationStockApi.validateAttestationNumero`, `clientApi.acquisitionOptions`, `clientApi.createGroupeClient`, `clientApi.listClients`, `clientApi.listGroupesClients`, `clientApi.searchClient`, `clientApi.searchVehicule`, `contractCreationApi.applyDraftTariffRecalculation`, `contractCreationApi.createContrat`, `contractCreationApi.createContratDraft`, `contractCreationApi.finalizeContratDraft`, `contractCreationApi.getContratDraft`, `contractCreationApi.previewDraftTariffRecalculation`, `contractCreationApi.previewQuittance`, `contractCreationApi.saveDraftRemorque`, `contractCreationApi.saveDraftRemorqueGaranties`, `contractCreationApi.saveDraftVehicule`, `contractCreationApi.saveDraftVehiculeGaranties`, `contractCreationApi.updateContratDraft`, `contractServiceApi.deleteAssistance`, `contractServiceApi.getAssistanceContext`, `contractServiceApi.saveAssistance`, `referenceApi.list`, `referenceApi.personGuaranteeFormulas`, `referenceApi.pricingLines` |
| `assurance-web/src/features/production/pages/AssistanceVoyageCreationPage.tsx` | - | `assistanceVoyageApi.create`, `assistanceVoyageApi.finalizeDraft`, `assistanceVoyageApi.quote`, `assistanceVoyageApi.renew`, `assistanceVoyageApi.saveDraftSection`, `assistanceVoyageApi.update`, `clientApi.listClients`, `clientApi.searchClient`, `contractApi.getContrat`, `referenceApi.list` |
| `assurance-web/src/features/production/pages/AssistanceAutomobileCreationPage.tsx` | `client:create`, `client:manage`, `client:view`, `contrat:create`, `contrat:update` | `assistanceAutomobileApi.create`, `assistanceAutomobileApi.finalizeDraft`, `assistanceAutomobileApi.quote`, `assistanceAutomobileApi.renew`, `assistanceAutomobileApi.saveDraftSection`, `assistanceAutomobileApi.update`, `assistanceProductApi.listProductRates`, `attestationStockApi.validateAttestationNumero`, `clientApi.acquisitionOptions`, `clientApi.createGroupeClient`, `clientApi.listClients`, `clientApi.listGroupesClients`, `clientApi.searchClient`, `clientApi.searchVehicule`, `contractApi.getContrat`, `contractCreationApi.applyDraftTariffRecalculation`, `contractCreationApi.createContrat`, `contractCreationApi.finalizeContratDraft`, `contractCreationApi.getContratDraft`, `contractCreationApi.previewDraftTariffRecalculation`, `contractCreationApi.previewQuittance`, `contractCreationApi.saveDraftRemorque`, `contractCreationApi.saveDraftRemorqueGaranties`, `contractCreationApi.saveDraftVehicule`, `contractCreationApi.saveDraftVehiculeGaranties`, `contractCreationApi.updateContratDraft`, `contractServiceApi.deleteAssistance`, `contractServiceApi.getAssistanceContext`, `contractServiceApi.saveAssistance`, `referenceApi.list`, `referenceApi.personGuaranteeFormulas`, `referenceApi.pricingLines` |
| `assurance-web/src/features/production/pages/ProspectionPage.tsx` | `contrat:delete`, `contrat:update` | `attestationStockApi.validateAttestationNumero`, `contractApi.convertProspection`, `contractApi.deleteContrat`, `contractApi.downloadDevisPdf`, `contractApi.getContrat`, `contractApi.listProspections`, `contractServiceApi.getAssistanceContext`, `referenceApi.list` |
| `assurance-web/src/features/production/pages/FlotteContratCreationPage.tsx` | `client:create`, `client:manage`, `client:view`, `contrat:create`, `contrat:update` | `attestationStockApi.validateAttestationNumero`, `clientApi.acquisitionOptions`, `clientApi.createGroupeClient`, `clientApi.listClients`, `clientApi.listGroupesClients`, `clientApi.searchClient`, `clientApi.searchVehicule`, `contractCreationApi.applyDraftTariffRecalculation`, `contractCreationApi.createContrat`, `contractCreationApi.downloadVehicleImportTemplate`, `contractCreationApi.exportSubmittedVehicles`, `contractCreationApi.finalizeContratDraft`, `contractCreationApi.getContratDraft`, `contractCreationApi.previewDraftTariffRecalculation`, `contractCreationApi.previewQuittance`, `contractCreationApi.previewVehicleImport`, `contractCreationApi.saveDraftRemorque`, `contractCreationApi.saveDraftRemorqueGaranties`, `contractCreationApi.saveDraftVehicule`, `contractCreationApi.saveDraftVehiculeGaranties`, `contractCreationApi.updateContratDraft`, `contractServiceApi.deleteAssistance`, `contractServiceApi.getAssistanceContext`, `contractServiceApi.saveAssistance`, `pricingApi.createGrid`, `pricingApi.replaceUsageConfiguration`, `pricingApi.updateGrid`, `referenceApi.list`, `referenceApi.personGuaranteeFormulas`, `referenceApi.pricingLines` |
| `assurance-web/src/features/production/pages/ParticulierContratCreationPage.tsx` | `client:create`, `client:manage`, `client:view`, `contrat:create`, `contrat:update` | `attestationStockApi.validateAttestationNumero`, `clientApi.acquisitionOptions`, `clientApi.createGroupeClient`, `clientApi.listClients`, `clientApi.listGroupesClients`, `clientApi.searchClient`, `clientApi.searchVehicule`, `contractCreationApi.applyDraftTariffRecalculation`, `contractCreationApi.createContrat`, `contractCreationApi.downloadVehicleImportTemplate`, `contractCreationApi.exportSubmittedVehicles`, `contractCreationApi.finalizeContratDraft`, `contractCreationApi.getContratDraft`, `contractCreationApi.previewDraftTariffRecalculation`, `contractCreationApi.previewQuittance`, `contractCreationApi.previewVehicleImport`, `contractCreationApi.saveDraftRemorque`, `contractCreationApi.saveDraftRemorqueGaranties`, `contractCreationApi.saveDraftVehicule`, `contractCreationApi.saveDraftVehiculeGaranties`, `contractCreationApi.updateContratDraft`, `contractServiceApi.deleteAssistance`, `contractServiceApi.getAssistanceContext`, `contractServiceApi.saveAssistance`, `pricingApi.createGrid`, `pricingApi.replaceUsageConfiguration`, `pricingApi.updateGrid`, `referenceApi.list`, `referenceApi.personGuaranteeFormulas`, `referenceApi.pricingLines` |
| `assurance-web/src/features/production/pages/ConventionContratCreationPage.tsx` | `client:create`, `client:manage`, `client:view`, `contrat:create`, `contrat:update` | `attestationStockApi.validateAttestationNumero`, `clientApi.acquisitionOptions`, `clientApi.createGroupeClient`, `clientApi.listClients`, `clientApi.listGroupesClients`, `clientApi.searchClient`, `clientApi.searchVehicule`, `contractCreationApi.applyDraftTariffRecalculation`, `contractCreationApi.createContrat`, `contractCreationApi.downloadVehicleImportTemplate`, `contractCreationApi.exportSubmittedVehicles`, `contractCreationApi.finalizeContratDraft`, `contractCreationApi.getContratDraft`, `contractCreationApi.previewDraftTariffRecalculation`, `contractCreationApi.previewQuittance`, `contractCreationApi.previewVehicleImport`, `contractCreationApi.saveDraftRemorque`, `contractCreationApi.saveDraftRemorqueGaranties`, `contractCreationApi.saveDraftVehicule`, `contractCreationApi.saveDraftVehiculeGaranties`, `contractCreationApi.updateContratDraft`, `contractServiceApi.deleteAssistance`, `contractServiceApi.getAssistanceContext`, `contractServiceApi.saveAssistance`, `pricingApi.createGrid`, `pricingApi.replaceUsageConfiguration`, `pricingApi.updateGrid`, `referenceApi.list`, `referenceApi.personGuaranteeFormulas`, `referenceApi.pricingLines` |
| `assurance-web/src/features/production/pages/ContratsPage.tsx` | `assistance:manage`, `avenant:create`, `avenant:delete`, `avenant:rectify`, `carte-verte:manage`, `contrat:create`, `contrat:delete`, `contrat:recalculate-financial-history`, `contrat:renew`, `contrat:update`, `contrat:view`, `piece-jointe:view` | `avenantApi.deleteAvenantDraft`, `contractApi.applyFinancialHistoryRecalculation`, `contractApi.createRenouvellementDraft`, `contractApi.deleteContrat`, `contractApi.deleteMouvement`, `contractApi.listContrats`, `contractApi.previewFinancialHistoryRecalculation`, `referenceApi.list` |
| `assurance-web/src/features/production/pages/ProductionRegisterPage.tsx` | - | `contractApi.exportProductionRegister`, `contractApi.searchProductionRegister`, `referenceApi.list` |
| `assurance-web/src/features/production/pages/ContratShowPage.tsx` | - | `contractApi.downloadDevisPdf`, `contractApi.downloadFlottePolicyPdf`, `contractApi.getContrat`, `referenceApi.list` |
| `assurance-web/src/features/production/pages/ContratPdfPage.tsx` | - | `contractApi.downloadDevisPdf`, `contractApi.downloadFlottePolicyPdf`, `contractApi.getContrat`, `referenceApi.list` |
| `assurance-web/src/features/production/pages/ClientPortfolioPage.tsx` | `bordereau-compagnie:view`, `client:create`, `client:manage`, `client:view`, `quittance:view`, `reglement-client:view`, `sinistre:finance`, `sinistre:manage`, `sinistre:view`, `tresorerie:view` | `attachmentApi.clientDocuments`, `attachmentApi.clientTypes`, `attachmentApi.deleteClient`, `attachmentApi.downloadClient`, `attachmentApi.uploadClient`, `clientApi.getClientCrm`, `clientApi.listPaymentConditions`, `comptaApi.clientDocumentPdf`, `comptaApi.clientReceivables`, `comptaApi.companyPortfolioSummary`, `comptaApi.searchClientDocuments`, `sinistreApi.list` |
| `assurance-web/src/features/production/pages/AvenantContratPage.tsx` | `client:create`, `client:manage`, `client:view`, `contrat:create`, `contrat:update` | `attestationStockApi.validateAttestationNumero`, `avenantApi.createAvenant`, `avenantApi.getAvenantContext`, `avenantApi.getAvenantDetail`, `avenantApi.getAvenantDraft`, `avenantApi.getAvenantRectification`, `avenantApi.previewAvenant`, `avenantApi.rectifyAvenant`, `avenantApi.saveAvenantDraft`, `clientApi.acquisitionOptions`, `clientApi.createGroupeClient`, `clientApi.listClients`, `clientApi.listGroupesClients`, `clientApi.searchClient`, `clientApi.searchVehicule`, `contractCreationApi.applyDraftTariffRecalculation`, `contractCreationApi.createContrat`, `contractCreationApi.finalizeContratDraft`, `contractCreationApi.getContratDraft`, `contractCreationApi.previewDraftTariffRecalculation`, `contractCreationApi.previewQuittance`, `contractCreationApi.saveDraftRemorque`, `contractCreationApi.saveDraftRemorqueGaranties`, `contractCreationApi.saveDraftVehicule`, `contractCreationApi.saveDraftVehiculeGaranties`, `contractCreationApi.updateContratDraft`, `contractServiceApi.deleteAssistance`, `contractServiceApi.getAssistanceContext`, `contractServiceApi.saveAssistance`, `pricingApi.replaceUsageConfiguration`, `referenceApi.configuredGuarantees`, `referenceApi.list`, `referenceApi.personGuaranteeFormulas`, `referenceApi.pricingLines` |
| `assurance-web/src/features/production/pages/EcheancesPage.tsx` | `contrat:renew`, `contrat:update` | `contractApi.createRenouvellementDraft`, `contractApi.downloadPreTermePdf`, `contractApi.exportEcheancesAssistance`, `contractApi.exportEcheancesAutomobile`, `contractApi.finalizeRenouvellementDraft`, `contractApi.searchEcheancesAssistance`, `contractApi.searchEcheancesAutomobile`, `referenceApi.list` |
| `assurance-web/src/features/production/pages/ContratPiecesJointesPage.tsx` | `client:create`, `client:manage`, `contrat:update`, `piece-jointe:manage` | `attachmentApi.assignOwner`, `attachmentApi.clientDocuments`, `attachmentApi.clientTypes`, `attachmentApi.deleteClient`, `attachmentApi.deletePieceJointe`, `attachmentApi.downloadClient`, `attachmentApi.downloadPieceJointe`, `attachmentApi.getContratPiecesJointes`, `attachmentApi.replace`, `attachmentApi.reuse`, `attachmentApi.unlink`, `attachmentApi.uploadClient`, `attachmentApi.uploadPieceJointe` |
| `assurance-web/src/features/production/pages/ContratAssistancePage.tsx` | - | `contractServiceApi.deleteAssistance`, `contractServiceApi.getAssistanceContext`, `contractServiceApi.saveAssistance` |
| `assurance-web/src/features/production/pages/ContratCartesVertesPage.tsx` | - | `contractServiceApi.deleteCarteVerte`, `contractServiceApi.getCarteVerteContext`, `contractServiceApi.saveCarteVerte` |
| `assurance-web/src/features/production/pages/AttestationStockPage.tsx` | - | `attestationStockApi.addLotsAttestation`, `attestationStockApi.cancelAttestationStock`, `attestationStockApi.createLivraisonAttestation`, `attestationStockApi.createSeuilStockAttestation`, `attestationStockApi.dashboardAttestationsStock`, `attestationStockApi.listLivraisonsAttestation`, `attestationStockApi.searchAttestationsStock`, `attestationStockApi.updateAttestationsStockSettings`, `attestationStockApi.updateSeuilStockAttestation`, `attestationStockApi.validateLivraisonAttestation`, `referenceApi.list` |
| `assurance-web/src/features/compta/pages/ComptaDashboardPage.tsx` | `bordereau-compagnie:view`, `quittance:view`, `reglement-client:view`, `tresorerie:view` | - |
| `assurance-web/src/features/compta/pages/ComptaSettingsPage.tsx` | - | - |
| `assurance-web/src/features/compta/pages/BanksSettingsPage.tsx` | `tresorerie:manage` | `comptaApi.banks`, `comptaApi.createBank`, `comptaApi.updateBank` |
| `assurance-web/src/features/compta/pages/ClientPaymentSettingsPage.tsx` | `reglement-client:manage` | `comptaApi.clientPaymentPolicy`, `comptaApi.updateClientPaymentPolicy` |
| `assurance-web/src/features/compta/pages/QuittanceAffectationPage.tsx` | `config:manage`, `quittance:create`, `quittance:manage` | `comptaApi.allocation`, `comptaApi.availableQuittanceCompanies`, `comptaApi.clearAllocation`, `comptaApi.createRule`, `comptaApi.deleteRule`, `comptaApi.exportQuittances`, `comptaApi.insuranceBranches`, `comptaApi.previewBatchImport`, `comptaApi.previewImport`, `comptaApi.rules`, `comptaApi.saveAllocation`, `comptaApi.saveBatchAllocation`, `comptaApi.searchQuittances`, `comptaApi.updateRule` |
| `assurance-web/src/features/compta/pages/RelevesFacturesPage.tsx` | `quittance:create`, `quittance:manage` | `clientApi.getClientCrm`, `clientApi.listClients`, `clientApi.listGroupesClients`, `comptaApi.cancelClientDocument`, `comptaApi.clientDocument`, `comptaApi.clientDocumentPdf`, `comptaApi.companies`, `comptaApi.createClientDocument`, `comptaApi.createInvoiceFromStatement`, `comptaApi.exportClientDocumentSources`, `comptaApi.insuranceBranches`, `comptaApi.proposeClientDocumentDueDate`, `comptaApi.reviseClientDocument`, `comptaApi.searchClientDocumentSources`, `comptaApi.searchClientDocuments` |
| `assurance-web/src/features/compta/pages/ConventionDepartmentPage.tsx` | `quittance:view`, `reglement-client:view` | - |
| `assurance-web/src/features/compta/pages/FacturationConventionsPage.tsx` | `quittance:create`, `quittance:manage`, `quittance:view`, `reglement-client:view` | `comptaApi.companies`, `comptaApi.conventionBillingOptions`, `comptaApi.createConventionInvoice`, `comptaApi.prepareConventionInvoice`, `comptaApi.previewConventionInvoice`, `comptaApi.proposeConventionInvoiceDueDate` |
| `assurance-web/src/features/compta/pages/ConventionCollectionsPage.tsx` | `quittance:create`, `quittance:manage`, `quittance:view`, `reglement-client:create`, `reglement-client:manage`, `reglement-client:view`, `tresorerie:manage`, `tresorerie:view` | `comptaApi.cancelClientDocument`, `comptaApi.changePaymentInstrumentStatus`, `comptaApi.clientDocument`, `comptaApi.clientDocumentPdf`, `comptaApi.clientInvoiceReceivables`, `comptaApi.clientPayment`, `comptaApi.clientPaymentReceipt`, `comptaApi.companies`, `comptaApi.conventionBillingOptions`, `comptaApi.deleteClientDocument`, `comptaApi.remittanceSlipPdf` |
| `assurance-web/src/features/compta/pages/NouveauReglementClientPage.tsx` | `reglement-client:create`, `reglement-client:manage` | `comptaApi.banks`, `comptaApi.clientPaymentPolicy`, `comptaApi.createClientPayment`, `comptaApi.createMultiClientBankDeposit`, `comptaApi.selectedClientReceivables`, `comptaApi.treasuryAccounts` |
| `assurance-web/src/features/compta/pages/ConventionProductionPage.tsx` | `quittance:view`, `reglement-client:view` | `comptaApi.companies`, `comptaApi.conventionBillingOptions`, `comptaApi.conventionProduction`, `comptaApi.exportConventionProduction` |
| `assurance-web/src/features/compta/pages/ReglementsClientsPage.tsx` | `reglement-client:create`, `reglement-client:manage` | `clientApi.getClientCrm`, `clientApi.listClients`, `clientApi.listGroupesClients`, `comptaApi.clientDocument`, `comptaApi.clientInvoiceReceivables`, `comptaApi.clientPaymentJournalPdf`, `comptaApi.clientPaymentJournalUsers`, `comptaApi.clientReceivables`, `comptaApi.selectedClientReceivables`, `referenceApi.list` |
| `assurance-web/src/features/compta/pages/ReglementsEnregistresPage.tsx` | `quittance:create`, `quittance:manage`, `reglement-client:create`, `reglement-client:manage`, `tresorerie:manage`, `tresorerie:view` | `clientApi.getClientCrm`, `clientApi.listClients`, `clientApi.listGroupesClients`, `comptaApi.bankRejectionHistory`, `comptaApi.cancelClientPayment`, `comptaApi.changePaymentInstrumentStatus`, `comptaApi.clientDocumentPdf`, `comptaApi.clientPayment`, `comptaApi.clientPaymentJournalPdf`, `comptaApi.clientPaymentJournalUsers`, `comptaApi.clientPaymentPdf`, `comptaApi.clientPaymentReceipt`, `comptaApi.clientPayments`, `comptaApi.createInvoiceFromClientPayment`, `comptaApi.deletePremiumReceipt`, `comptaApi.premiumReceiptOptions`, `comptaApi.premiumReceiptPdf`, `comptaApi.recordedPaymentInstruments`, `comptaApi.remittanceSlip`, `comptaApi.remittanceSlipPdf`, `comptaApi.selectedPremiumReceiptPdf` |
| `assurance-web/src/features/compta/pages/ReglementClientDetailPage.tsx` | `tresorerie:manage`, `tresorerie:view` | `comptaApi.changePaymentInstrumentStatus`, `comptaApi.clientPayment`, `comptaApi.clientPaymentReceipt`, `comptaApi.remittanceSlipPdf` |
| `assurance-web/src/features/compta/pages/BordereauxCompagniesPage.tsx` | `bordereau-compagnie:create`, `reglement-compagnie:create` | `comptaApi.availableQuittanceCompanies`, `comptaApi.companyBordereaux` |
| `assurance-web/src/features/compta/pages/BordereauCompagnieFormPage.tsx` | - | `comptaApi.availableQuittanceCompanies`, `comptaApi.companyBordereau`, `comptaApi.companyBordereauSources`, `comptaApi.createCompanyBordereau`, `comptaApi.updateCompanyBordereau` |
| `assurance-web/src/features/compta/pages/NouveauReglementCompagniePage.tsx` | - | `comptaApi.companyBordereau`, `comptaApi.createCompanyPayment`, `comptaApi.treasuryAccounts` |
| `assurance-web/src/features/compta/pages/BordereauCompagnieDetailPage.tsx` | `bordereau-compagnie:cancel`, `bordereau-compagnie:create`, `bordereau-compagnie:reconcile`, `bordereau-compagnie:transmit`, `bordereau-compagnie:validate`, `reglement-compagnie:create`, `reglement-compagnie:manage` | `comptaApi.cancelCompanyBordereau`, `comptaApi.changeCompanyPaymentInstrumentStatus`, `comptaApi.companyBordereau`, `comptaApi.reconcileCompanyBordereau`, `comptaApi.transmitCompanyBordereau`, `comptaApi.treasuryAccounts`, `comptaApi.validateCompanyBordereau` |
| `assurance-web/src/features/compta/pages/TresorerieComptesPage.tsx` | `tresorerie:manage` | `comptaApi.banks`, `comptaApi.changeTreasuryAccountStatus`, `comptaApi.createTreasuryAccount`, `comptaApi.saveTreasuryAccountAssignments`, `comptaApi.treasuryAccountAssignments`, `comptaApi.treasuryAccounts`, `comptaApi.treasuryAdministrationAccounts`, `comptaApi.treasuryUsers`, `comptaApi.updateTreasuryAccount` |
| `assurance-web/src/features/compta/pages/TresorerieCompteDetailPage.tsx` | - | `comptaApi.treasuryAccounts`, `comptaApi.treasuryJournal`, `comptaApi.treasuryOperations` |
| `assurance-web/src/features/compta/pages/EncaissementsEnAttentePage.tsx` | `client:view`, `reglement-client:manage`, `reglement-client:view`, `tresorerie:manage`, `tresorerie:view` | `clientApi.getClientCrm`, `clientApi.listClients`, `clientApi.listGroupesClients`, `comptaApi.addInstrumentsToRemittanceSlip`, `comptaApi.banks`, `comptaApi.changePaymentInstrumentStatus`, `comptaApi.clientPayment`, `comptaApi.clientPaymentReceipt`, `comptaApi.createCashRemittance`, `comptaApi.createRemittanceSlip`, `comptaApi.eligibleCashRemittanceDays`, `comptaApi.paymentInstruments`, `comptaApi.remittanceSlipPdf`, `comptaApi.remittanceSlips`, `comptaApi.replacePaymentInstrument`, `comptaApi.treasuryAccounts` |
| `assurance-web/src/features/compta/pages/ImpayesClientsPage.tsx` | `client:view`, `reglement-client:manage`, `reglement-client:view`, `tresorerie:manage`, `tresorerie:view` | `clientApi.getClientCrm`, `clientApi.listClients`, `clientApi.listGroupesClients`, `comptaApi.addBankRejectionMovement`, `comptaApi.bankRejectionDetail`, `comptaApi.bankRejectionHistory`, `comptaApi.bankRejectionPayer`, `comptaApi.bankRejections`, `comptaApi.banks`, `comptaApi.changePaymentInstrumentStatus`, `comptaApi.clientPayment`, `comptaApi.clientPaymentReceipt`, `comptaApi.exportBankRejections`, `comptaApi.paymentInstruments`, `comptaApi.registerBankRejection`, `comptaApi.remittanceSlipPdf`, `comptaApi.replacePaymentInstrument`, `comptaApi.representPaymentInstrument`, `comptaApi.treasuryAccounts` |
| `assurance-web/src/features/compta/pages/InstrumentsTresoreriePage.tsx` | `tresorerie:manage` | `comptaApi.deleteRemittanceSlipDraft`, `comptaApi.depositRemittanceSlip`, `comptaApi.remittanceSlipPdf`, `comptaApi.remittanceSlips` |
| `assurance-web/src/features/compta/pages/NouveauBordereauRemisePage.tsx` | `tresorerie:manage` | `comptaApi.createCashRemittance`, `comptaApi.createRemittanceSlip`, `comptaApi.eligibleCashRemittanceDays`, `comptaApi.remittanceSlipPdf`, `comptaApi.selectedEligibleRemittanceInstruments`, `comptaApi.treasuryAccounts` |
| `assurance-web/src/features/compta/pages/BordereauRemiseDetailPage.tsx` | `tresorerie:manage` | `comptaApi.deleteRemittanceSlipDraft`, `comptaApi.depositRemittanceSlip`, `comptaApi.remittanceSlip`, `comptaApi.remittanceSlipPdf`, `comptaApi.removeRemittanceSlipLine` |
| `assurance-web/src/features/compta/pages/JournalTresoreriePage.tsx` | - | `comptaApi.treasuryAccounts`, `comptaApi.treasuryJournal` |
| `assurance-web/src/features/compta/pages/RapprochementBancairePage.tsx` | `tresorerie:manage` | `comptaApi.bankStatementImport`, `comptaApi.bankStatementImports`, `comptaApi.bankStatementProfiles`, `comptaApi.importBankStatement`, `comptaApi.pendingPaymentInstruments`, `comptaApi.previewBankStatement`, `comptaApi.saveBankReconciliations`, `comptaApi.treasuryAccounts`, `comptaApi.validateBankReconciliation` |
| `assurance-web/src/features/compta/pages/OperationsTresoreriePage.tsx` | - | `comptaApi.cancelTreasuryOperation`, `comptaApi.createTreasuryAdjustment`, `comptaApi.createTreasuryTransfer`, `comptaApi.treasuryAccounts`, `comptaApi.treasuryOperations` |
| `assurance-web/src/features/crm/pages/ClientCrmPage.tsx` | `client:create`, `client:manage`, `client:view`, `contrat:create`, `contrat:update`, `sinistre:finance`, `sinistre:manage`, `sinistre:view` | `attachmentApi.clientDocuments`, `attachmentApi.clientTypes`, `attachmentApi.deleteClient`, `attachmentApi.downloadClient`, `attachmentApi.uploadClient`, `attestationStockApi.validateAttestationNumero`, `clientApi.acquisitionOptions`, `clientApi.assignClientGroup`, `clientApi.createClient`, `clientApi.createGroupeClient`, `clientApi.createPaymentCondition`, `clientApi.downloadPaymentConditionEvidence`, `clientApi.endClientGroup`, `clientApi.getClientCrm`, `clientApi.listClients`, `clientApi.listGroupesClients`, `clientApi.listPaymentConditions`, `clientApi.searchClient`, `clientApi.searchVehicule`, `clientApi.updateAcquisition`, `clientApi.updateClient`, `contractCreationApi.applyDraftTariffRecalculation`, `contractCreationApi.createContrat`, `contractCreationApi.finalizeContratDraft`, `contractCreationApi.getContratDraft`, `contractCreationApi.previewDraftTariffRecalculation`, `contractCreationApi.previewQuittance`, `contractCreationApi.saveDraftRemorque`, `contractCreationApi.saveDraftRemorqueGaranties`, `contractCreationApi.saveDraftVehicule`, `contractCreationApi.saveDraftVehiculeGaranties`, `contractCreationApi.updateContratDraft`, `contractServiceApi.deleteAssistance`, `contractServiceApi.getAssistanceContext`, `contractServiceApi.saveAssistance`, `referenceApi.list`, `referenceApi.personGuaranteeFormulas`, `referenceApi.pricingLines` |
| `assurance-web/src/features/crm/pages/CrmSettingsPage.tsx` | - | - |
| `assurance-web/src/features/crm/pages/CommercialOriginsSettingsPage.tsx` | - | `clientApi.acquisitionOptions`, `clientApi.createOrigin`, `clientApi.updateOrigin` |
| `assurance-web/src/features/production/pages/CompaniesDashboardPage.tsx` | `contact-compagnie:manage`, `contact-compagnie:view`, `grille-tarifaire:manage`, `grille-tarifaire:view`, `referentiel:manage`, `referentiel:view` | - |
| `assurance-web/src/features/production/pages/CompaniesPage.tsx` | `contact-compagnie:manage`, `contact-compagnie:view` | `referenceAdminApi.createInsuranceCompany`, `referenceAdminApi.updateInsuranceCompany`, `referenceApi.list` |
| `assurance-web/src/features/production/pages/CompaniesConventionsPage.tsx` | - | `pricingApi.createGrid`, `pricingApi.replaceUsageConfiguration`, `referenceAdminApi.createConvention`, `referenceAdminApi.updateConvention`, `referenceApi.list`, `referenceApi.personGuaranteeFormulas`, `referenceApi.pricingLines` |
| `assurance-web/src/features/production/pages/CompaniesPricingGridsPage.tsx` | `grille-tarifaire:manage`, `referentiel:manage` | `pricingApi.createGrid`, `pricingApi.replaceUsageConfiguration`, `pricingApi.updateGrid`, `referenceApi.list`, `referenceApi.personGuaranteeFormulas`, `referenceApi.pricingGridCatalogue`, `referenceApi.pricingLines` |
| `assurance-web/src/features/production/pages/CompanyContactsPage.tsx` | `contact-compagnie:manage` | `companyContactsApi.create`, `companyContactsApi.list`, `companyContactsApi.update`, `companyContactsApi.updateStatus`, `referenceApi.list` |
| `assurance-web/src/features/production/pages/AssistanceSettingsPage.tsx` | - | `assistanceProductApi.createCompany`, `assistanceProductApi.deleteCompany`, `assistanceProductApi.updateCompany`, `referenceApi.list` |
| `assurance-web/src/features/production/pages/AssistanceProductsSettingsPage.tsx` | - | `assistanceProductApi.createProduct`, `assistanceProductApi.createProductRate`, `assistanceProductApi.createPromoCode`, `assistanceProductApi.deactivateProduct`, `assistanceProductApi.deleteProductPermanently`, `assistanceProductApi.deleteProductRate`, `assistanceProductApi.deletePromoCode`, `assistanceProductApi.listProductRates`, `assistanceProductApi.listPromoCodes`, `assistanceProductApi.updateProduct`, `assistanceProductApi.updateProductRate`, `assistanceProductApi.updatePromoCode`, `referenceApi.list` |
| `assurance-web/src/features/admin/pages/AdminLayout.tsx` | `activity:view`, `agence:create`, `agence:manage-self`, `agence:view`, `audit:view`, `config:manage`, `config:view`, `role:manage`, `role:view`, `user:manage`, `user:view` | - |
| `assurance-web/src/features/admin/pages/AdminIndexPage.tsx` | `activity:view`, `agence:create`, `agence:manage-self`, `agence:view`, `audit:view`, `config:manage`, `config:view`, `role:manage`, `role:view`, `user:manage`, `user:view` | - |
| `assurance-web/src/features/admin/pages/AdminUsersPage.tsx` | `activity:view`, `agence:create`, `agence:manage-self`, `agence:view`, `audit:view`, `config:manage`, `config:view`, `role:manage`, `role:view`, `user:manage`, `user:view` | `adminApi.agencies`, `adminApi.agencyLogo`, `adminApi.agencySignature`, `adminApi.auditOperations`, `adminApi.createAgency`, `adminApi.createPlatformAdmin`, `adminApi.createRole`, `adminApi.createUser`, `adminApi.deactivatePlatformAdmin`, `adminApi.deactivateUser`, `adminApi.deleteAgencyLogo`, `adminApi.deleteAgencySignature`, `adminApi.deleteRole`, `adminApi.platformAdminSessions`, `adminApi.resetPlatformAdminPassword`, `adminApi.resetUserPassword`, `adminApi.revokeAllPlatformAdminSessions`, `adminApi.revokeAllUserSessions`, `adminApi.revokePlatformAdminSession`, `adminApi.revokeUserSession`, `adminApi.roles`, `adminApi.updateAgency`, `adminApi.updatePlatformAdmin`, `adminApi.updateRole`, `adminApi.updateUser`, `adminApi.uploadAgencyLogo`, `adminApi.uploadAgencySignature`, `adminApi.userSessions`, `adminApi.users` |
| `assurance-web/src/features/admin/pages/AdminRolesPage.tsx` | `activity:view`, `agence:create`, `agence:manage-self`, `agence:view`, `audit:view`, `config:manage`, `config:view`, `role:manage`, `role:view`, `user:manage`, `user:view` | `adminApi.agencies`, `adminApi.agencyLogo`, `adminApi.agencySignature`, `adminApi.auditOperations`, `adminApi.createAgency`, `adminApi.createPlatformAdmin`, `adminApi.createRole`, `adminApi.createUser`, `adminApi.deactivatePlatformAdmin`, `adminApi.deactivateUser`, `adminApi.deleteAgencyLogo`, `adminApi.deleteAgencySignature`, `adminApi.deleteRole`, `adminApi.permissions`, `adminApi.platformAdminSessions`, `adminApi.resetPlatformAdminPassword`, `adminApi.resetUserPassword`, `adminApi.revokeAllPlatformAdminSessions`, `adminApi.revokeAllUserSessions`, `adminApi.revokePlatformAdminSession`, `adminApi.revokeUserSession`, `adminApi.roles`, `adminApi.updateAgency`, `adminApi.updatePlatformAdmin`, `adminApi.updateRole`, `adminApi.updateUser`, `adminApi.uploadAgencyLogo`, `adminApi.uploadAgencySignature`, `adminApi.userSessions` |
| `assurance-web/src/features/admin/pages/AdminAuditPage.tsx` | `activity:view`, `agence:create`, `agence:manage-self`, `agence:view`, `audit:view`, `config:manage`, `config:view`, `role:manage`, `role:view`, `user:manage`, `user:view` | `adminApi.agencyLogo`, `adminApi.agencySignature`, `adminApi.auditOperations`, `adminApi.createAgency`, `adminApi.createPlatformAdmin`, `adminApi.createRole`, `adminApi.createUser`, `adminApi.deactivatePlatformAdmin`, `adminApi.deactivateUser`, `adminApi.deleteAgencyLogo`, `adminApi.deleteAgencySignature`, `adminApi.deleteRole`, `adminApi.platformAdminSessions`, `adminApi.resetPlatformAdminPassword`, `adminApi.resetUserPassword`, `adminApi.revokeAllPlatformAdminSessions`, `adminApi.revokeAllUserSessions`, `adminApi.revokePlatformAdminSession`, `adminApi.revokeUserSession`, `adminApi.updateAgency`, `adminApi.updatePlatformAdmin`, `adminApi.updateRole`, `adminApi.updateUser`, `adminApi.uploadAgencyLogo`, `adminApi.uploadAgencySignature`, `adminApi.userSessions` |
| `assurance-web/src/features/admin/pages/AdminActivityPage.tsx` | `activity:view`, `agence:create`, `agence:manage-self`, `agence:view`, `audit:view`, `config:manage`, `config:view`, `contrat:view`, `role:manage`, `role:view`, `user:manage`, `user:view` | `adminApi.platformAdmins`, `adminApi.users` |
| `assurance-web/src/features/admin/pages/AdminAgenciesPage.tsx` | `activity:view`, `agence:create`, `agence:manage-self`, `agence:view`, `audit:view`, `config:manage`, `config:view`, `role:manage`, `role:view`, `user:manage`, `user:view` | `adminApi.agencies`, `adminApi.agencyLogo`, `adminApi.agencySignature`, `adminApi.auditOperations`, `adminApi.createAgency`, `adminApi.createPlatformAdmin`, `adminApi.createRole`, `adminApi.createUser`, `adminApi.deactivatePlatformAdmin`, `adminApi.deactivateUser`, `adminApi.deleteAgencyLogo`, `adminApi.deleteAgencySignature`, `adminApi.deleteRole`, `adminApi.platformAdminSessions`, `adminApi.resetPlatformAdminPassword`, `adminApi.resetUserPassword`, `adminApi.revokeAllPlatformAdminSessions`, `adminApi.revokeAllUserSessions`, `adminApi.revokePlatformAdminSession`, `adminApi.revokeUserSession`, `adminApi.updateAgency`, `adminApi.updatePlatformAdmin`, `adminApi.updateRole`, `adminApi.updateUser`, `adminApi.uploadAgencyLogo`, `adminApi.uploadAgencySignature`, `adminApi.userSessions` |
| `assurance-web/src/features/admin/pages/PlatformAdminsPage.tsx` | `activity:view`, `agence:create`, `agence:manage-self`, `agence:view`, `audit:view`, `config:manage`, `config:view`, `role:manage`, `role:view`, `user:manage`, `user:view` | `adminApi.agencyLogo`, `adminApi.agencySignature`, `adminApi.auditOperations`, `adminApi.createAgency`, `adminApi.createPlatformAdmin`, `adminApi.createRole`, `adminApi.createUser`, `adminApi.deactivatePlatformAdmin`, `adminApi.deactivateUser`, `adminApi.deleteAgencyLogo`, `adminApi.deleteAgencySignature`, `adminApi.deleteRole`, `adminApi.platformAdminSessions`, `adminApi.platformAdmins`, `adminApi.resetPlatformAdminPassword`, `adminApi.resetUserPassword`, `adminApi.revokeAllPlatformAdminSessions`, `adminApi.revokeAllUserSessions`, `adminApi.revokePlatformAdminSession`, `adminApi.revokeUserSession`, `adminApi.updateAgency`, `adminApi.updatePlatformAdmin`, `adminApi.updateRole`, `adminApi.updateUser`, `adminApi.uploadAgencyLogo`, `adminApi.uploadAgencySignature`, `adminApi.userSessions` |
| `assurance-web/src/features/production/pages/ProductionSettingsPage.tsx` | `config:manage`, `regle-fiscale:manage`, `regle-fiscale:view` | - |
| `assurance-web/src/features/production/pages/TarifUsageSettingsPage.tsx` | - | `pricingApi.bulkUpdateUsageNetPremium`, `pricingApi.createUsageRate`, `pricingApi.deleteUsageRate`, `pricingApi.updateUsageRate`, `pricingApi.usageRateAdjustmentHistory`, `referenceAdminApi.updateUsageTrailerRates`, `referenceApi.list` |
| `assurance-web/src/features/production/pages/UsagesSettingsPage.tsx` | - | `referenceAdminApi.createAttestationUsageGroup`, `referenceAdminApi.createBodyType`, `referenceAdminApi.createBrand`, `referenceAdminApi.createCategoryTransport`, `referenceAdminApi.createClientCategory`, `referenceAdminApi.createFuel`, `referenceAdminApi.createGuarantee`, `referenceAdminApi.createGuaranteeExclusionGroup`, `referenceAdminApi.createSubclass`, `referenceAdminApi.createUsage`, `referenceAdminApi.updateAttestationUsageGroup`, `referenceAdminApi.updateBodyType`, `referenceAdminApi.updateBrand`, `referenceAdminApi.updateCategoryTransport`, `referenceAdminApi.updateClientCategory`, `referenceAdminApi.updateFuel`, `referenceAdminApi.updateGuarantee`, `referenceAdminApi.updateGuaranteeExclusionGroup`, `referenceAdminApi.updateSubclass`, `referenceAdminApi.updateUsage`, `referenceApi.configuredGuarantees`, `referenceApi.list` |
| `assurance-web/src/features/production/pages/GroupesUsageAttestationSettingsPage.tsx` | - | - |
| `assurance-web/src/features/production/pages/CategoriesClientSettingsPage.tsx` | - | `referenceAdminApi.createAttestationUsageGroup`, `referenceAdminApi.createBodyType`, `referenceAdminApi.createBrand`, `referenceAdminApi.createCategoryTransport`, `referenceAdminApi.createClientCategory`, `referenceAdminApi.createFuel`, `referenceAdminApi.createGuarantee`, `referenceAdminApi.createGuaranteeExclusionGroup`, `referenceAdminApi.createSubclass`, `referenceAdminApi.createUsage`, `referenceAdminApi.updateAttestationUsageGroup`, `referenceAdminApi.updateBodyType`, `referenceAdminApi.updateBrand`, `referenceAdminApi.updateCategoryTransport`, `referenceAdminApi.updateClientCategory`, `referenceAdminApi.updateFuel`, `referenceAdminApi.updateGuarantee`, `referenceAdminApi.updateGuaranteeExclusionGroup`, `referenceAdminApi.updateSubclass`, `referenceAdminApi.updateUsage`, `referenceApi.configuredGuarantees`, `referenceApi.list` |
| `assurance-web/src/features/production/pages/GarantiesSettingsPage.tsx` | - | `referenceAdminApi.createAttestationUsageGroup`, `referenceAdminApi.createBodyType`, `referenceAdminApi.createBrand`, `referenceAdminApi.createCategoryTransport`, `referenceAdminApi.createClientCategory`, `referenceAdminApi.createFuel`, `referenceAdminApi.createGuarantee`, `referenceAdminApi.createGuaranteeExclusionGroup`, `referenceAdminApi.createSubclass`, `referenceAdminApi.createUsage`, `referenceAdminApi.updateAttestationUsageGroup`, `referenceAdminApi.updateBodyType`, `referenceAdminApi.updateBrand`, `referenceAdminApi.updateCategoryTransport`, `referenceAdminApi.updateClientCategory`, `referenceAdminApi.updateFuel`, `referenceAdminApi.updateGuarantee`, `referenceAdminApi.updateGuaranteeExclusionGroup`, `referenceAdminApi.updateSubclass`, `referenceAdminApi.updateUsage`, `referenceApi.configuredGuarantees`, `referenceApi.list` |
| `assurance-web/src/features/production/pages/MarquesSettingsPage.tsx` | - | `referenceAdminApi.createAttestationUsageGroup`, `referenceAdminApi.createBodyType`, `referenceAdminApi.createBrand`, `referenceAdminApi.createCategoryTransport`, `referenceAdminApi.createClientCategory`, `referenceAdminApi.createFuel`, `referenceAdminApi.createGuarantee`, `referenceAdminApi.createGuaranteeExclusionGroup`, `referenceAdminApi.createSubclass`, `referenceAdminApi.createUsage`, `referenceAdminApi.updateAttestationUsageGroup`, `referenceAdminApi.updateBodyType`, `referenceAdminApi.updateBrand`, `referenceAdminApi.updateCategoryTransport`, `referenceAdminApi.updateClientCategory`, `referenceAdminApi.updateFuel`, `referenceAdminApi.updateGuarantee`, `referenceAdminApi.updateGuaranteeExclusionGroup`, `referenceAdminApi.updateSubclass`, `referenceAdminApi.updateUsage`, `referenceApi.configuredGuarantees`, `referenceApi.list` |
| `assurance-web/src/features/production/pages/CarrosseriesSettingsPage.tsx` | - | `referenceAdminApi.createAttestationUsageGroup`, `referenceAdminApi.createBodyType`, `referenceAdminApi.createBrand`, `referenceAdminApi.createCategoryTransport`, `referenceAdminApi.createClientCategory`, `referenceAdminApi.createFuel`, `referenceAdminApi.createGuarantee`, `referenceAdminApi.createGuaranteeExclusionGroup`, `referenceAdminApi.createSubclass`, `referenceAdminApi.createUsage`, `referenceAdminApi.updateAttestationUsageGroup`, `referenceAdminApi.updateBodyType`, `referenceAdminApi.updateBrand`, `referenceAdminApi.updateCategoryTransport`, `referenceAdminApi.updateClientCategory`, `referenceAdminApi.updateFuel`, `referenceAdminApi.updateGuarantee`, `referenceAdminApi.updateGuaranteeExclusionGroup`, `referenceAdminApi.updateSubclass`, `referenceAdminApi.updateUsage`, `referenceApi.configuredGuarantees`, `referenceApi.list` |
| `assurance-web/src/features/production/pages/CarburantsSettingsPage.tsx` | - | `referenceAdminApi.createAttestationUsageGroup`, `referenceAdminApi.createBodyType`, `referenceAdminApi.createBrand`, `referenceAdminApi.createCategoryTransport`, `referenceAdminApi.createClientCategory`, `referenceAdminApi.createFuel`, `referenceAdminApi.createGuarantee`, `referenceAdminApi.createGuaranteeExclusionGroup`, `referenceAdminApi.createSubclass`, `referenceAdminApi.createUsage`, `referenceAdminApi.updateAttestationUsageGroup`, `referenceAdminApi.updateBodyType`, `referenceAdminApi.updateBrand`, `referenceAdminApi.updateCategoryTransport`, `referenceAdminApi.updateClientCategory`, `referenceAdminApi.updateFuel`, `referenceAdminApi.updateGuarantee`, `referenceAdminApi.updateGuaranteeExclusionGroup`, `referenceAdminApi.updateSubclass`, `referenceAdminApi.updateUsage`, `referenceApi.configuredGuarantees`, `referenceApi.list` |
| `assurance-web/src/features/production/pages/SousClassesSettingsPage.tsx` | - | `referenceAdminApi.createAttestationUsageGroup`, `referenceAdminApi.createBodyType`, `referenceAdminApi.createBrand`, `referenceAdminApi.createCategoryTransport`, `referenceAdminApi.createClientCategory`, `referenceAdminApi.createFuel`, `referenceAdminApi.createGuarantee`, `referenceAdminApi.createGuaranteeExclusionGroup`, `referenceAdminApi.createSubclass`, `referenceAdminApi.createUsage`, `referenceAdminApi.updateAttestationUsageGroup`, `referenceAdminApi.updateBodyType`, `referenceAdminApi.updateBrand`, `referenceAdminApi.updateCategoryTransport`, `referenceAdminApi.updateClientCategory`, `referenceAdminApi.updateFuel`, `referenceAdminApi.updateGuarantee`, `referenceAdminApi.updateGuaranteeExclusionGroup`, `referenceAdminApi.updateSubclass`, `referenceAdminApi.updateUsage`, `referenceApi.configuredGuarantees`, `referenceApi.list` |
| `assurance-web/src/features/production/pages/CategoriesTransportSettingsPage.tsx` | - | `referenceAdminApi.createAttestationUsageGroup`, `referenceAdminApi.createBodyType`, `referenceAdminApi.createBrand`, `referenceAdminApi.createCategoryTransport`, `referenceAdminApi.createClientCategory`, `referenceAdminApi.createFuel`, `referenceAdminApi.createGuarantee`, `referenceAdminApi.createGuaranteeExclusionGroup`, `referenceAdminApi.createSubclass`, `referenceAdminApi.createUsage`, `referenceAdminApi.updateAttestationUsageGroup`, `referenceAdminApi.updateBodyType`, `referenceAdminApi.updateBrand`, `referenceAdminApi.updateCategoryTransport`, `referenceAdminApi.updateClientCategory`, `referenceAdminApi.updateFuel`, `referenceAdminApi.updateGuarantee`, `referenceAdminApi.updateGuaranteeExclusionGroup`, `referenceAdminApi.updateSubclass`, `referenceAdminApi.updateUsage`, `referenceApi.configuredGuarantees`, `referenceApi.list` |
| `assurance-web/src/features/production/pages/PiecesJointesSettingsPage.tsx` | - | `attachmentApi.savePolicy`, `attachmentSettingsApi.createType`, `attachmentSettingsApi.listMovementTypes`, `attachmentSettingsApi.listTypes`, `attachmentSettingsApi.updateType`, `referenceApi.list` |
| `assurance-web/src/features/production/pages/FiscalRulesSettingsPage.tsx` | `config:manage`, `regle-fiscale:manage` | `fiscalRulesApi.create`, `fiscalRulesApi.deactivate`, `fiscalRulesApi.list`, `fiscalRulesApi.update`, `referenceApi.configuredGuarantees`, `referenceApi.list` |
| `assurance-web/src/pages/app/AppNotFound.tsx` | - | - |
| `assurance-web/src/pages/NotFound.tsx` | - | - |

## Appendix C: Backend Controller Mapping Inventory

The table records method/class @PreAuthorize where present. "SecurityConfig/service/self-service" means no method/class annotation was found, NOT an unprotected endpoint.
Referentiel writes have SecurityConfig authority checks; AdminService performs its own permission/agency checks; AuthService has authenticated self/platform operations.
Mapping arguments are preserved from source, including aliases and multipart metadata.
Service-level checks, account ACLs, tenant ownership and lifecycle constraints must be retained during endpoint changes.

| Controller method | Verb and class route | Method mapping arguments | Current method/class authorization | Source line |
|---|---|---|---|---|
| `AdminController.java.platformAdmins` | `GET /api/v1/admin` | `("/platform-admins")` | `hasAuthority('PERM_config:manage')` | 43 |
| `AdminController.java.createPlatformAdmin` | `POST /api/v1/admin` | `("/platform-admins")` | `hasAuthority('PERM_config:manage')` | 49 |
| `AdminController.java.updatePlatformAdmin` | `PUT /api/v1/admin` | `("/platform-admins/{id}")` | `hasAuthority('PERM_config:manage')` | 57 |
| `AdminController.java.deactivatePlatformAdmin` | `DELETE /api/v1/admin` | `("/platform-admins/{id}")` | `hasAuthority('PERM_config:manage')` | 66 |
| `AdminController.java.resetPlatformAdminPassword` | `PUT /api/v1/admin` | `("/platform-admins/{id}/password")` | `hasAuthority('PERM_config:manage')` | 73 |
| `AdminController.java.platformAdminSessions` | `GET /api/v1/admin` | `("/platform-admins/{id}/sessions")` | `hasAuthority('PERM_config:manage')` | 83 |
| `AdminController.java.revokePlatformAdminSession` | `DELETE /api/v1/admin` | `("/platform-admins/{id}/sessions/{sessionId}")` | `hasAuthority('PERM_config:manage')` | 89 |
| `AdminController.java.revokeAllPlatformAdminSessions` | `DELETE /api/v1/admin` | `("/platform-admins/{id}/sessions")` | `hasAuthority('PERM_config:manage')` | 99 |
| `AdminController.java.users` | `GET /api/v1/admin` | `("/users")` | SecurityConfig/service/self-service; inspect | 106 |
| `AdminController.java.createUser` | `POST /api/v1/admin` | `("/users")` | SecurityConfig/service/self-service; inspect | 111 |
| `AdminController.java.updateUser` | `PUT /api/v1/admin` | `("/users/{id}")` | SecurityConfig/service/self-service; inspect | 116 |
| `AdminController.java.deactivateUser` | `DELETE /api/v1/admin` | `("/users/{id}")` | SecurityConfig/service/self-service; inspect | 121 |
| `AdminController.java.resetUserPassword` | `PUT /api/v1/admin` | `("/users/{id}/password")` | SecurityConfig/service/self-service; inspect | 127 |
| `AdminController.java.userSessions` | `GET /api/v1/admin` | `("/users/{id}/sessions")` | SecurityConfig/service/self-service; inspect | 133 |
| `AdminController.java.revokeUserSession` | `DELETE /api/v1/admin` | `("/users/{id}/sessions/{sessionId}")` | SecurityConfig/service/self-service; inspect | 138 |
| `AdminController.java.revokeAllUserSessions` | `DELETE /api/v1/admin` | `("/users/{id}/sessions")` | SecurityConfig/service/self-service; inspect | 147 |
| `AdminController.java.roles` | `GET /api/v1/admin` | `("/roles")` | SecurityConfig/service/self-service; inspect | 153 |
| `AdminController.java.createRole` | `POST /api/v1/admin` | `("/roles")` | SecurityConfig/service/self-service; inspect | 158 |
| `AdminController.java.updateRole` | `PUT /api/v1/admin` | `("/roles/{id}")` | SecurityConfig/service/self-service; inspect | 163 |
| `AdminController.java.deleteRole` | `DELETE /api/v1/admin` | `("/roles/{id}")` | SecurityConfig/service/self-service; inspect | 168 |
| `AdminController.java.permissions` | `GET /api/v1/admin` | `("/permissions")` | SecurityConfig/service/self-service; inspect | 174 |
| `AdminController.java.agencies` | `GET /api/v1/admin` | `("/agencies")` | SecurityConfig/service/self-service; inspect | 179 |
| `AdminController.java.createAgency` | `POST /api/v1/admin` | `("/agencies")` | SecurityConfig/service/self-service; inspect | 184 |
| `AdminController.java.updateAgency` | `PUT /api/v1/admin` | `("/agencies/{id}")` | SecurityConfig/service/self-service; inspect | 189 |
| `AdminController.java.updateAgencyLogo` | `POST /api/v1/admin` | `(value = "/agencies/{id}/logo", consumes = MediaType.MULTIPART_FORM_DATA_VALUE)` | SecurityConfig/service/self-service; inspect | 194 |
| `AdminController.java.agencyLogo` | `GET /api/v1/admin` | `("/agencies/{id}/logo")` | SecurityConfig/service/self-service; inspect | 202 |
| `AdminController.java.deleteAgencyLogo` | `DELETE /api/v1/admin` | `("/agencies/{id}/logo")` | SecurityConfig/service/self-service; inspect | 214 |
| `AdminController.java.updateAgencySignature` | `POST /api/v1/admin` | `(value = "/agencies/{id}/signature", consumes = MediaType.MULTIPART_FORM_DATA_VALUE)` | SecurityConfig/service/self-service; inspect | 219 |
| `AdminController.java.agencySignature` | `GET /api/v1/admin` | `("/agencies/{id}/signature")` | SecurityConfig/service/self-service; inspect | 230 |
| `AdminController.java.deleteAgencySignature` | `DELETE /api/v1/admin` | `("/agencies/{id}/signature")` | SecurityConfig/service/self-service; inspect | 242 |
| `AttestationStockController.java.dashboard` | `GET /api/v1/attestations-stock` | `("/dashboard")` | `hasAnyAuthority('PERM_attestation-stock:view', 'PERM_attestation-stock:manage')` | 52 |
| `AttestationStockController.java.attestations` | `GET /api/v1/attestations-stock` | `("/attestations")` | `hasAnyAuthority('PERM_attestation-stock:view', 'PERM_attestation-stock:manage')` | 58 |
| `AttestationStockController.java.annulerAttestation` | `POST /api/v1/attestations-stock` | `("/attestations/{id}/annuler")` | `hasAnyAuthority('PERM_attestation-stock:cancel', 'PERM_attestation-stock:manage')` | 81 |
| `AttestationStockController.java.settings` | `GET /api/v1/attestations-stock` | `("/settings")` | `hasAnyAuthority('PERM_attestation-stock:view', 'PERM_attestation-stock:manage')` | 93 |
| `AttestationStockController.java.updateSettings` | `PUT /api/v1/attestations-stock` | `("/settings")` | `hasAuthority('PERM_attestation-stock:manage')` | 99 |
| `AttestationStockController.java.seuils` | `GET /api/v1/attestations-stock` | `("/seuils")` | `hasAnyAuthority('PERM_attestation-stock:view', 'PERM_attestation-stock:manage')` | 110 |
| `AttestationStockController.java.creerSeuil` | `POST /api/v1/attestations-stock` | `("/seuils")` | `hasAuthority('PERM_attestation-stock:manage')` | 118 |
| `AttestationStockController.java.modifierSeuil` | `PUT /api/v1/attestations-stock` | `("/seuils/{id}")` | `hasAuthority('PERM_attestation-stock:manage')` | 129 |
| `AttestationStockController.java.creerLivraison` | `POST /api/v1/attestations-stock` | `("/livraisons")` | `hasAuthority('PERM_attestation-stock:manage')` | 141 |
| `AttestationStockController.java.listerLivraisons` | `GET /api/v1/attestations-stock` | `("/livraisons")` | `hasAnyAuthority('PERM_attestation-stock:view', 'PERM_attestation-stock:manage')` | 152 |
| `AttestationStockController.java.ajouterLot` | `POST /api/v1/attestations-stock` | `("/livraisons/{id}/lots")` | `hasAuthority('PERM_attestation-stock:manage')` | 167 |
| `AttestationStockController.java.ajouterLots` | `POST /api/v1/attestations-stock` | `("/livraisons/{id}/reception")` | `hasAuthority('PERM_attestation-stock:manage')` | 179 |
| `AttestationStockController.java.valider` | `POST /api/v1/attestations-stock` | `("/livraisons/{id}/valider")` | `hasAuthority('PERM_attestation-stock:manage')` | 191 |
| `AttestationStockController.java.disponibles` | `GET /api/v1/attestations-stock` | `("/disponibles")` | `hasAnyAuthority('PERM_attestation-stock:view', 'PERM_contrat:create', 'PERM_contrat:update')` | 200 |
| `AttestationStockController.java.suggestions` | `GET /api/v1/attestations-stock` | `("/suggestions")` | `hasAnyAuthority('PERM_attestation-stock:view', 'PERM_contrat:create', 'PERM_contrat:update')` | 214 |
| `AttestationStockController.java.validation` | `GET /api/v1/attestations-stock` | `("/validation")` | `hasAnyAuthority('PERM_attestation-stock:view', 'PERM_contrat:create', 'PERM_contrat:update')` | 233 |
| `AuditEventController.java.search` | `GET /api/v1/audit-events` | `(root)` | `hasAuthority('PERM_audit:view')` | 28 |
| `AuditEventController.java.searchOperations` | `GET /api/v1/audit-events` | `("/operations")` | `hasAuthority('PERM_audit:view')` | 57 |
| `AuthController.java.login` | `POST /api/v1/auth` | `("/login")` | SecurityConfig/service/self-service; inspect | 46 |
| `AuthController.java.refresh` | `POST /api/v1/auth` | `("/refresh")` | SecurityConfig/service/self-service; inspect | 54 |
| `AuthController.java.logout` | `DELETE /api/v1/auth` | `("/logout")` | SecurityConfig/service/self-service; inspect | 62 |
| `AuthController.java.sessions` | `GET /api/v1/auth` | `("/sessions")` | SecurityConfig/service/self-service; inspect | 73 |
| `AuthController.java.agencyContextOptions` | `GET /api/v1/auth` | `("/agency-context/options")` | SecurityConfig/service/self-service; inspect | 83 |
| `AuthController.java.enterAgencyContext` | `POST /api/v1/auth` | `("/agency-context/{agenceId}")` | SecurityConfig/service/self-service; inspect | 90 |
| `AuthController.java.exitAgencyContext` | `DELETE /api/v1/auth` | `("/agency-context")` | SecurityConfig/service/self-service; inspect | 106 |
| `AuthController.java.revokeSession` | `DELETE /api/v1/auth` | `("/sessions/{sessionId}")` | SecurityConfig/service/self-service; inspect | 120 |
| `AuthController.java.revokeOtherSessions` | `DELETE /api/v1/auth` | `("/sessions/others")` | SecurityConfig/service/self-service; inspect | 126 |
| `AuthController.java.changePassword` | `POST /api/v1/auth` | `("/password")` | SecurityConfig/service/self-service; inspect | 135 |
| `AvenantController.java.context` | `GET /api/v1/contrats/{contratId}/avenants` | `({"", "/context"})` | `hasAnyAuthority('PERM_avenant:view', 'PERM_contrat:view')` | 37 |
| `AvenantController.java.availableTypes` | `GET /api/v1/contrats/{contratId}/avenants` | `("/types")` | `hasAnyAuthority('PERM_avenant:view', 'PERM_contrat:view')` | 45 |
| `AvenantController.java.detail` | `GET /api/v1/contrats/{contratId}/avenants` | `("/{mouvementId:\\d+}")` | `hasAnyAuthority('PERM_avenant:view', 'PERM_contrat:view')` | 55 |
| `AvenantController.java.draft` | `GET /api/v1/contrats/{contratId}/avenants` | `("/brouillon")` | `hasAnyAuthority('PERM_avenant:view', 'PERM_contrat:view')` | 66 |
| `AvenantController.java.draftByCode` | `GET /api/v1/contrats/{contratId}/avenants` | `("/{code}/brouillon")` | `hasAnyAuthority('PERM_avenant:view', 'PERM_contrat:view')` | 77 |
| `AvenantController.java.saveDraft` | `PUT /api/v1/contrats/{contratId}/avenants` | `({"/brouillon", "/{code}/brouillon"})` | `hasAnyAuthority('PERM_avenant:draft', 'PERM_contrat:update')` | 86 |
| `AvenantController.java.deleteDraft` | `DELETE /api/v1/contrats/{contratId}/avenants` | `({"/brouillon", "/{code}/brouillon"})` | `hasAnyAuthority('PERM_avenant:draft', 'PERM_contrat:update')` | 103 |
| `AvenantController.java.rectification` | `GET /api/v1/contrats/{contratId}/avenants` | `("/{mouvementId:\\d+}/rectification")` | `hasAnyAuthority('PERM_avenant:view', 'PERM_contrat:view')` | 116 |
| `AvenantController.java.rectify` | `PUT /api/v1/contrats/{contratId}/avenants` | `({"/{mouvementId:\\d+}/rectification", "/{mouvementId:\\d+}/{code}/rectification"})` | `hasAnyAuthority('PERM_avenant:rectify', 'PERM_contrat:update')` | 127 |
| `AvenantController.java.preview` | `POST /api/v1/contrats/{contratId}/avenants` | `("/{code}/preview")` | `hasAnyAuthority('PERM_avenant:create', 'PERM_avenant:rectify', 'PERM_contrat:update')` | 144 |
| `AvenantController.java.previewLegacy` | `POST /api/v1/contrats/{contratId}/avenants` | `("/previsualisation-quittance")` | `hasAnyAuthority('PERM_avenant:create', 'PERM_avenant:rectify', 'PERM_contrat:update')` | 159 |
| `AvenantController.java.create` | `POST /api/v1/contrats/{contratId}/avenants` | `("/{code}")` | `hasAnyAuthority('PERM_avenant:create', 'PERM_contrat:update')` | 173 |
| `AvenantController.java.createLegacy` | `POST /api/v1/contrats/{contratId}/avenants` | `(root)` | `hasAnyAuthority('PERM_avenant:create', 'PERM_contrat:update')` | 186 |
| `BanqueController.java.list` | `GET /api/v1/compta/banques` | `(root)` | `hasAnyAuthority('PERM_reglement-client:view', 'PERM_reglement-client:create', 'PERM_reglement-client:manage', 'PERM_tresorerie:view', 'PERM_tresorerie:manage')` | 30 |
| `BanqueController.java.create` | `POST /api/v1/compta/banques` | `(root)` | `hasAuthority('PERM_tresorerie:manage')` | 41 |
| `BanqueController.java.update` | `PUT /api/v1/compta/banques` | `("/{bankId}")` | `hasAuthority('PERM_tresorerie:manage')` | 52 |
| `BordereauCompagnieController.java.sources` | `GET /api/v1/compta/bordereaux-compagnies` | `("/sources")` | `hasAuthority('PERM_bordereau-compagnie:view')` | 46 |
| `BordereauCompagnieController.java.search` | `GET /api/v1/compta/bordereaux-compagnies` | `(root)` | `hasAuthority('PERM_bordereau-compagnie:view')` | 67 |
| `BordereauCompagnieController.java.portfolioSummary` | `GET /api/v1/compta/bordereaux-compagnies` | `("/portefeuille-client")` | `hasAuthority('PERM_bordereau-compagnie:view')` | 92 |
| `BordereauCompagnieController.java.detail` | `GET /api/v1/compta/bordereaux-compagnies` | `("/{id}")` | `hasAuthority('PERM_bordereau-compagnie:view')` | 107 |
| `BordereauCompagnieController.java.create` | `POST /api/v1/compta/bordereaux-compagnies` | `(root)` | `hasAuthority('PERM_bordereau-compagnie:create')` | 115 |
| `BordereauCompagnieController.java.update` | `PUT /api/v1/compta/bordereaux-compagnies` | `("/{id}")` | `hasAuthority('PERM_bordereau-compagnie:create')` | 126 |
| `BordereauCompagnieController.java.validate` | `POST /api/v1/compta/bordereaux-compagnies` | `("/{id}/validation")` | `hasAuthority('PERM_bordereau-compagnie:validate')` | 138 |
| `BordereauCompagnieController.java.transmit` | `POST /api/v1/compta/bordereaux-compagnies` | `("/{id}/transmission")` | `hasAuthority('PERM_bordereau-compagnie:transmit')` | 147 |
| `BordereauCompagnieController.java.reconcile` | `POST /api/v1/compta/bordereaux-compagnies` | `("/{id}/rapprochement")` | `hasAuthority('PERM_bordereau-compagnie:reconcile')` | 159 |
| `BordereauCompagnieController.java.cancel` | `POST /api/v1/compta/bordereaux-compagnies` | `("/{id}/annulation")` | `hasAuthority('PERM_bordereau-compagnie:cancel')` | 171 |
| `BordereauCompagnieController.java.createPayment` | `POST /api/v1/compta/bordereaux-compagnies` | `("/reglements")` | `hasAuthority('PERM_reglement-compagnie:create')` | 183 |
| `BordereauCompagnieController.java.payment` | `GET /api/v1/compta/bordereaux-compagnies` | `("/reglements/{id}")` | `hasAuthority('PERM_reglement-compagnie:view')` | 194 |
| `BordereauCompagnieController.java.changePaymentStatus` | `PUT /api/v1/compta/bordereaux-compagnies` | `("/instruments/{id}/statut")` | `hasAuthority('PERM_reglement-compagnie:manage')` | 202 |
| `BordereauCompagnieController.java.cancelPayment` | `POST /api/v1/compta/bordereaux-compagnies` | `("/reglements/{id}/annulation")` | `hasAuthority('PERM_reglement-compagnie:manage')` | 218 |
| `BordereauRemiseController.java.eligibleInstruments` | `GET /api/v1/compta/tresorerie/bordereaux-remise` | `("/instruments-eligibles")` | `hasAuthority('PERM_tresorerie:view')` | 45 |
| `BordereauRemiseController.java.selectedEligibleInstruments` | `POST /api/v1/compta/tresorerie/bordereaux-remise` | `("/instruments-eligibles/selection")` | `hasAuthority('PERM_tresorerie:view')` | 68 |
| `BordereauRemiseController.java.search` | `GET /api/v1/compta/tresorerie/bordereaux-remise` | `(root)` | `hasAuthority('PERM_tresorerie:view')` | 81 |
| `BordereauRemiseController.java.detail` | `GET /api/v1/compta/tresorerie/bordereaux-remise` | `("/{id}")` | `hasAuthority('PERM_tresorerie:view')` | 108 |
| `BordereauRemiseController.java.pdf` | `GET /api/v1/compta/tresorerie/bordereaux-remise` | `("/{id}/pdf")` | `hasAuthority('PERM_tresorerie:view')` | 117 |
| `BordereauRemiseController.java.create` | `POST /api/v1/compta/tresorerie/bordereaux-remise` | `(root)` | `hasAuthority('PERM_tresorerie:manage')` | 132 |
| `BordereauRemiseController.java.addInstruments` | `POST /api/v1/compta/tresorerie/bordereaux-remise` | `("/{id}/instruments")` | `hasAuthority('PERM_tresorerie:manage')` | 143 |
| `BordereauRemiseController.java.createCashDeposit` | `POST /api/v1/compta/tresorerie/bordereaux-remise` | `("/versements-especes")` | `hasAuthority('PERM_tresorerie:manage')` | 156 |
| `BordereauRemiseController.java.deposit` | `POST /api/v1/compta/tresorerie/bordereaux-remise` | `("/{id}/depot")` | `hasAuthority('PERM_tresorerie:manage')` | 167 |
| `BordereauRemiseController.java.settleLine` | `POST /api/v1/compta/tresorerie/bordereaux-remise` | `("/{bordereauId}/lignes/{lineId}/encaissement")` | `hasAuthority('PERM_tresorerie:manage')` | 180 |
| `BordereauRemiseController.java.rejectLine` | `POST /api/v1/compta/tresorerie/bordereaux-remise` | `("/{bordereauId}/lignes/{lineId}/rejet")` | `hasAuthority('PERM_tresorerie:manage')` | 195 |
| `BordereauRemiseController.java.deleteDraft` | `DELETE /api/v1/compta/tresorerie/bordereaux-remise` | `("/{id}")` | `hasAuthority('PERM_tresorerie:manage')` | 210 |
| `BordereauRemiseController.java.removeDraftLine` | `DELETE /api/v1/compta/tresorerie/bordereaux-remise` | `("/{bordereauId}/lignes/{lineId}")` | `hasAuthority('PERM_tresorerie:manage')` | 217 |
| `BordereauRemiseController.java.eligibleCashDays` | `GET /api/v1/compta/tresorerie/bordereaux-remise` | `("/journees-caisse-eligibles")` | `hasAuthority('PERM_tresorerie:view')` | 230 |
| `BusinessActivityController.java.detail` | `GET /api/v1/business-activities` | `("/{id}")` | `hasAuthority('PERM_activity:view')` | 27 |
| `BusinessActivityController.java.search` | `GET /api/v1/business-activities` | `(root)` | `hasAuthority('PERM_activity:view')` | 33 |
| `ClientController.java.acquisitionOptions` | `GET /api/v1/clients` | `("/acquisition/options")` | `hasAnyAuthority('PERM_client:view', 'PERM_client:create', 'PERM_contrat:create', 'PERM_contrat:update')` | 45 |
| `ClientController.java.listOrigins` | `GET /api/v1/clients` | `("/origines-commerciales")` | `hasAuthority('PERM_client:view')` | 53 |
| `ClientController.java.createOrigin` | `POST /api/v1/clients` | `("/origines-commerciales")` | `hasAuthority('PERM_client:manage')` | 61 |
| `ClientController.java.updateOrigin` | `PUT /api/v1/clients` | `("/origines-commerciales/{originId}")` | `hasAuthority('PERM_client:manage')` | 72 |
| `ClientController.java.updateAcquisition` | `PUT /api/v1/clients` | `("/{id}/acquisition")` | `hasAuthority('PERM_client:manage')` | 84 |
| `ClientController.java.list` | `GET /api/v1/clients` | `(root)` | `hasAnyAuthority('PERM_client:view', 'PERM_contrat:create', 'PERM_contrat:update')` | 101 |
| `ClientController.java.get` | `GET /api/v1/clients` | `("/{id}")` | `hasAuthority('PERM_client:view')` | 124 |
| `ClientController.java.search` | `GET /api/v1/clients` | `("/search")` | `hasAnyAuthority('PERM_client:view', 'PERM_contrat:create', 'PERM_contrat:update')` | 132 |
| `ClientController.java.create` | `POST /api/v1/clients` | `(root)` | `hasAuthority('PERM_client:create')` | 145 |
| `ClientController.java.update` | `PUT /api/v1/clients` | `("/{id}")` | `hasAuthority('PERM_client:manage')` | 154 |
| `ClientController.java.assignGroup` | `PUT /api/v1/clients` | `("/{id}/groupe")` | `hasAnyAuthority('PERM_client:manage', 'PERM_client:create')` | 166 |
| `ClientController.java.endGroupMembership` | `DELETE /api/v1/clients` | `("/{id}/groupes/{membershipId}")` | `hasAnyAuthority('PERM_client:manage', 'PERM_client:create')` | 178 |
| `ComptaController.java.elementsFacturables` | `GET /api/v1/compta` | `("/elements-facturables")` | `hasAuthority('PERM_quittance:view')` | 72 |
| `ComptaController.java.quittances` | `GET /api/v1/compta` | `("/quittances")` | `hasAuthority('PERM_quittance:view')` | 78 |
| `ComptaController.java.compagniesQuittancesDisponibles` | `GET /api/v1/compta` | `("/quittances/compagnies-disponibles")` | `hasAuthority('PERM_quittance:view')` | 105 |
| `ComptaController.java.exportQuittances` | `GET /api/v1/compta` | `("/quittances/export")` | `hasAuthority('PERM_quittance:view')` | 116 |
| `ComptaController.java.affectation` | `GET /api/v1/compta` | `("/quittances/{quittanceId}/affectation")` | `hasAuthority('PERM_quittance:view')` | 148 |
| `ComptaController.java.enregistrerAffectation` | `PUT /api/v1/compta` | `("/quittances/{quittanceId}/affectation")` | `hasAnyAuthority('PERM_quittance:create', 'PERM_quittance:manage')` | 161 |
| `ComptaController.java.enregistrerLotAffectation` | `PUT /api/v1/compta` | `("/quittances/affectations/lot")` | `hasAnyAuthority('PERM_quittance:create', 'PERM_quittance:manage')` | 178 |
| `ComptaController.java.supprimerAffectation` | `DELETE /api/v1/compta` | `("/quittances/{quittanceId}/affectation")` | `hasAnyAuthority('PERM_quittance:create', 'PERM_quittance:manage')` | 193 |
| `ComptaController.java.previsualiserImport` | `POST /api/v1/compta` | `("/quittances/{quittanceId}/imports/previsualisation")` | `hasAnyAuthority('PERM_quittance:create', 'PERM_quittance:manage')` | 200 |
| `ComptaController.java.previsualiserImportLot` | `POST /api/v1/compta` | `("/quittances/affectations/lot/imports/previsualisation")` | `hasAnyAuthority('PERM_quittance:create', 'PERM_quittance:manage')` | 215 |
| `ComptaController.java.reglesQuittances` | `GET /api/v1/compta` | `("/regles-quittances")` | `hasAuthority('PERM_quittance:view')` | 230 |
| `ComptaController.java.creerRegleQuittance` | `POST /api/v1/compta` | `("/regles-quittances")` | `hasAnyAuthority('PERM_quittance:manage', 'PERM_config:manage')` | 241 |
| `ComptaController.java.modifierRegleQuittance` | `PUT /api/v1/compta` | `("/regles-quittances/{ruleId}")` | `hasAnyAuthority('PERM_quittance:manage', 'PERM_config:manage')` | 252 |
| `ComptaController.java.supprimerRegleQuittance` | `DELETE /api/v1/compta` | `("/regles-quittances/{ruleId}")` | `hasAnyAuthority('PERM_quittance:manage', 'PERM_config:manage')` | 264 |
| `ComptaController.java.sourcesDocumentsClients` | `GET /api/v1/compta` | `("/documents-clients/sources")` | `hasAuthority('PERM_quittance:view')` | 271 |
| `ComptaController.java.exportSourcesDocumentsClients` | `GET /api/v1/compta` | `("/documents-clients/sources/export")` | `hasAuthority('PERM_quittance:view')` | 310 |
| `ComptaController.java.billingConventions` | `GET /api/v1/compta` | `("/facturation-conventions/conventions")` | `hasAuthority('PERM_quittance:view')` | 354 |
| `ComptaController.java.prepareConventionInvoice` | `GET /api/v1/compta` | `("/facturation-conventions/preparation")` | `hasAuthority('PERM_quittance:view')` | 362 |
| `ComptaController.java.previewConventionInvoice` | `POST /api/v1/compta` | `("/facturation-conventions/apercu")` | `hasAnyAuthority('PERM_quittance:create', 'PERM_quittance:manage')` | 375 |
| `ComptaController.java.echeancesConvention` | `GET /api/v1/compta` | `("/facturation-conventions/echeances")` | `hasAuthority('PERM_quittance:view')` | 383 |
| `ComptaController.java.creerFactureConvention` | `POST /api/v1/compta` | `("/facturation-conventions/factures")` | `hasAnyAuthority('PERM_quittance:create', 'PERM_quittance:manage')` | 402 |
| `ComptaController.java.proposerEcheanceConvention` | `POST /api/v1/compta` | `("/facturation-conventions/echeance-proposee")` | `hasAnyAuthority('PERM_quittance:create', 'PERM_quittance:manage')` | 413 |
| `ComptaController.java.documentsClients` | `GET /api/v1/compta` | `("/documents-clients")` | `hasAuthority('PERM_quittance:view')` | 423 |
| `ComptaController.java.creerDocumentClient` | `POST /api/v1/compta` | `("/documents-clients")` | `hasAnyAuthority('PERM_quittance:create', 'PERM_quittance:manage')` | 460 |
| `ComptaController.java.creerFactureDepuisReleve` | `POST /api/v1/compta` | `("/documents-clients/{documentId}/facture")` | `hasAnyAuthority('PERM_quittance:create', 'PERM_quittance:manage')` | 473 |
| `ComptaController.java.proposerEcheance` | `POST /api/v1/compta` | `("/documents-clients/echeance-proposee")` | `hasAnyAuthority('PERM_quittance:create', 'PERM_quittance:manage')` | 489 |
| `ComptaController.java.documentClient` | `GET /api/v1/compta` | `("/documents-clients/{documentId}")` | `hasAuthority('PERM_quittance:view')` | 499 |
| `ComptaController.java.annulerDocumentClient` | `POST /api/v1/compta` | `("/documents-clients/{documentId}/annulation")` | `hasAnyAuthority('PERM_quittance:create', 'PERM_quittance:manage')` | 507 |
| `ComptaController.java.supprimerDocumentClient` | `DELETE /api/v1/compta` | `("/documents-clients/{documentId}")` | `hasAuthority('PERM_quittance:manage')` | 519 |
| `ComptaController.java.modifierDocumentClient` | `POST /api/v1/compta` | `("/documents-clients/{documentId}/revision")` | `hasAnyAuthority('PERM_quittance:create', 'PERM_quittance:manage')` | 529 |
| `ComptaController.java.documentClientPdf` | `GET /api/v1/compta` | `("/documents-clients/{documentId}/pdf")` | `hasAuthority('PERM_quittance:view')` | 541 |
| `ConditionPaiementClientController.java.list` | `GET /api/v1/conditions-paiement-clients` | `(root)` | `hasAuthority('PERM_client:view')` | 34 |
| `ConditionPaiementClientController.java.create` | `POST /api/v1/conditions-paiement-clients` | `(consumes = MediaType.MULTIPART_FORM_DATA_VALUE)` | `hasAuthority('PERM_client:manage')` | 47 |
| `ConditionPaiementClientController.java.download` | `GET /api/v1/conditions-paiement-clients` | `("/{conditionId}/justificatif")` | `hasAuthority('PERM_client:view')` | 72 |
| `ContactCompagnieController.java.list` | `GET /api/v1/compagnies-assurance` | `("/contacts")` | `hasAnyAuthority('PERM_contact-compagnie:view', 'PERM_contact-compagnie:manage')` | 33 |
| `ContactCompagnieController.java.create` | `POST /api/v1/compagnies-assurance` | `("/{compagnieId}/contacts")` | `hasAuthority('PERM_contact-compagnie:manage')` | 50 |
| `ContactCompagnieController.java.update` | `PUT /api/v1/compagnies-assurance` | `("/{compagnieId}/contacts/{contactId}")` | `hasAuthority('PERM_contact-compagnie:manage')` | 61 |
| `ContactCompagnieController.java.updateStatus` | `PATCH /api/v1/compagnies-assurance` | `("/{compagnieId}/contacts/{contactId}/statut")` | `hasAuthority('PERM_contact-compagnie:manage')` | 73 |
| `ContratController.java.create` | `POST /api/v1/contrats` | `(root)` | `hasAuthority('PERM_contrat:create')` | 103 |
| `ContratController.java.createTravelAssistance` | `POST /api/v1/contrats` | `("/assistance-voyage")` | `hasAuthority('PERM_contrat:create')` | 113 |
| `ContratController.java.createTravelAssistanceDraftSection` | `POST /api/v1/contrats` | `("/assistance-voyage/brouillons/{section}")` | `hasAuthority('PERM_contrat:create')` | 124 |
| `ContratController.java.updateTravelAssistanceDraftSection` | `PUT /api/v1/contrats` | `("/drafts/{id}/assistance-voyage/{section}")` | `hasAnyAuthority('PERM_contrat:create', 'PERM_contrat:update')` | 137 |
| `ContratController.java.finalizeTravelAssistanceDraft` | `POST /api/v1/contrats` | `("/drafts/{id}/assistance-voyage/finaliser")` | `hasAnyAuthority('PERM_contrat:create', 'PERM_contrat:update')` | 151 |
| `ContratController.java.updateTravelAssistance` | `PUT /api/v1/contrats` | `("/{id}/assistance-voyage")` | `hasAuthority('PERM_contrat:update')` | 164 |
| `ContratController.java.renewTravelAssistance` | `POST /api/v1/contrats` | `("/{id}/assistance-voyage/renouvellements")` | `hasAnyAuthority('PERM_contrat:renew', 'PERM_contrat:update')` | 176 |
| `ContratController.java.quoteTravelAssistance` | `POST /api/v1/contrats` | `("/assistance-voyage/tarification")` | `hasAnyAuthority('PERM_contrat:create', 'PERM_contrat:update', 'PERM_contrat:renew')` | 188 |
| `ContratController.java.createAutomobileAssistance` | `POST /api/v1/contrats` | `("/assistance-automobile")` | `hasAuthority('PERM_contrat:create')` | 196 |
| `ContratController.java.createAutomobileAssistanceDraftSection` | `POST /api/v1/contrats` | `("/assistance-automobile/brouillons/{section}")` | `hasAuthority('PERM_contrat:create')` | 207 |
| `ContratController.java.updateAutomobileAssistanceDraftSection` | `PUT /api/v1/contrats` | `("/drafts/{id}/assistance-automobile/{section}")` | `hasAnyAuthority('PERM_contrat:create', 'PERM_contrat:update')` | 220 |
| `ContratController.java.finalizeAutomobileAssistanceDraft` | `POST /api/v1/contrats` | `("/drafts/{id}/assistance-automobile/finaliser")` | `hasAnyAuthority('PERM_contrat:create', 'PERM_contrat:update')` | 234 |
| `ContratController.java.updateAutomobileAssistance` | `PUT /api/v1/contrats` | `("/{id}/assistance-automobile")` | `hasAuthority('PERM_contrat:update')` | 247 |
| `ContratController.java.renewAutomobileAssistance` | `POST /api/v1/contrats` | `("/{id}/assistance-automobile/renouvellements")` | `hasAnyAuthority('PERM_contrat:renew', 'PERM_contrat:update')` | 259 |
| `ContratController.java.quoteAutomobileAssistance` | `POST /api/v1/contrats` | `("/assistance-automobile/tarification")` | `hasAnyAuthority('PERM_contrat:create', 'PERM_contrat:update', 'PERM_contrat:renew')` | 271 |
| `ContratController.java.createDraft` | `POST /api/v1/contrats` | `("/drafts")` | `hasAuthority('PERM_contrat:create')` | 279 |
| `ContratController.java.getDraft` | `GET /api/v1/contrats` | `("/drafts/{id}")` | `hasAnyAuthority('PERM_contrat:view', 'PERM_contrat:create', 'PERM_contrat:update')` | 289 |
| `ContratController.java.downloadVehicleImportTemplate` | `GET /api/v1/contrats` | `("/drafts/{id}/vehicules/import-modele")` | `hasAnyAuthority('PERM_contrat:create', 'PERM_contrat:update')` | 295 |
| `ContratController.java.exportSubmittedVehicles` | `GET /api/v1/contrats` | `("/drafts/{id}/vehicules/export")` | `hasAnyAuthority('PERM_contrat:view', 'PERM_contrat:create', 'PERM_contrat:update')` | 304 |
| `ContratController.java.previewVehicleImport` | `POST /api/v1/contrats` | `(value = "/drafts/{id}/vehicules/import-preview", consumes = MediaType.MULTIPART_FORM_DATA_VALUE)` | `hasAnyAuthority('PERM_contrat:create', 'PERM_contrat:update')` | 313 |
| `ContratController.java.updateDraft` | `PUT /api/v1/contrats` | `("/drafts/{id}")` | `hasAnyAuthority('PERM_contrat:create', 'PERM_contrat:update')` | 324 |
| `ContratController.java.saveDraftVehicule` | `PUT /api/v1/contrats` | `("/drafts/{id}/vehicules/{index}")` | `hasAnyAuthority('PERM_contrat:create', 'PERM_contrat:update')` | 335 |
| `ContratController.java.saveDraftVehiculeGaranties` | `PUT /api/v1/contrats` | `("/drafts/{id}/vehicules/{index}/garanties")` | `hasAnyAuthority('PERM_contrat:create', 'PERM_contrat:update')` | 346 |
| `ContratController.java.saveDraftRemorque` | `PUT /api/v1/contrats` | `("/drafts/{id}/remorques/{index}")` | `hasAnyAuthority('PERM_contrat:create', 'PERM_contrat:update')` | 357 |
| `ContratController.java.saveDraftRemorqueGaranties` | `PUT /api/v1/contrats` | `("/drafts/{id}/remorques/{index}/garanties")` | `hasAnyAuthority('PERM_contrat:create', 'PERM_contrat:update')` | 368 |
| `ContratController.java.previewDraftTariffRecalculation` | `GET /api/v1/contrats` | `("/drafts/{id}/recalcul-tarifs/preview")` | `hasAnyAuthority('PERM_contrat:create', 'PERM_contrat:update')` | 379 |
| `ContratController.java.applyDraftTariffRecalculation` | `POST /api/v1/contrats` | `("/drafts/{id}/recalcul-tarifs")` | `hasAnyAuthority('PERM_contrat:create', 'PERM_contrat:update')` | 389 |
| `ContratController.java.finalizeDraft` | `POST /api/v1/contrats` | `("/drafts/{id}/finaliser")` | `hasAnyAuthority('PERM_contrat:create', 'PERM_contrat:update')` | 399 |
| `ContratController.java.previsualiserQuittanceCreation` | `POST /api/v1/contrats` | `("/previsualisation-quittance")` | `hasAuthority('PERM_contrat:create')` | 406 |
| `ContratController.java.createRenouvellementDraft` | `POST /api/v1/contrats` | `("/{id}/renouvellements/brouillon")` | `hasAnyAuthority('PERM_contrat:renew', 'PERM_contrat:update')` | 414 |
| `ContratController.java.finalizeRenouvellementDraft` | `POST /api/v1/contrats` | `("/renouvellements/{draftId}/finaliser")` | `hasAnyAuthority('PERM_contrat:renew', 'PERM_contrat:update')` | 430 |
| `ContratController.java.list` | `GET /api/v1/contrats` | `(root)` | `hasAuthority('PERM_contrat:view')` | 446 |
| `ContratController.java.registreProduction` | `GET /api/v1/contrats` | `("/registre-production")` | `hasAuthority('PERM_contrat:view')` | 485 |
| `ContratController.java.exportRegistreProduction` | `GET /api/v1/contrats` | `("/registre-production/export")` | `hasAuthority('PERM_contrat:view')` | 515 |
| `ContratController.java.listProspections` | `GET /api/v1/contrats` | `("/prospections")` | `hasAuthority('PERM_contrat:view')` | 579 |
| `ContratController.java.echeancesAutomobile` | `GET /api/v1/contrats` | `("/echeances/automobile")` | `hasAuthority('PERM_contrat:view')` | 602 |
| `ContratController.java.exportEcheancesAutomobile` | `GET /api/v1/contrats` | `("/echeances/automobile/export")` | `hasAuthority('PERM_contrat:view')` | 625 |
| `ContratController.java.echeancesAssistance` | `GET /api/v1/contrats` | `("/echeances/assistance")` | `hasAuthority('PERM_contrat:view')` | 648 |
| `ContratController.java.exportEcheancesAssistance` | `GET /api/v1/contrats` | `("/echeances/assistance/export")` | `hasAuthority('PERM_contrat:view')` | 673 |
| `ContratController.java.get` | `GET /api/v1/contrats` | `("/{id}")` | `hasAuthority('PERM_contrat:view')` | 699 |
| `ContratController.java.previewRecalculFinancier` | `GET /api/v1/contrats` | `("/{id}/recalcul-financier/preview")` | `hasAuthority('PERM_contrat:recalculate-financial-history')` | 708 |
| `ContratController.java.appliquerRecalculFinancier` | `POST /api/v1/contrats` | `("/{id}/recalcul-financier")` | `hasAuthority('PERM_contrat:recalculate-financial-history')` | 716 |
| `ContratController.java.delete` | `DELETE /api/v1/contrats` | `("/{id}")` | `hasAnyAuthority('PERM_contrat:delete', 'PERM_contrat:update')` | 727 |
| `ContratController.java.deleteMouvement` | `DELETE /api/v1/contrats` | `("/{id}/mouvements/{mouvementId}")` | `hasAnyAuthority('PERM_avenant:delete', 'PERM_contrat:update')` | 734 |
| `ContratController.java.convertirProspection` | `POST /api/v1/contrats` | `("/{id}/convertir-prospection")` | `hasAuthority('PERM_contrat:update')` | 741 |
| `ContratController.java.devisPdf` | `POST /api/v1/contrats` | `("/{id}/devis-pdf")` | `hasAuthority('PERM_contrat:view')` | 750 |
| `ContratController.java.policeFlottePdf` | `GET /api/v1/contrats` | `("/{id}/police-flotte-pdf")` | `hasAuthority('PERM_contrat:view')` | 760 |
| `ContratController.java.preTermePdf` | `GET /api/v1/contrats` | `("/renouvellements/{draftId}/pre-terme-pdf")` | `hasAnyAuthority('PERM_contrat:view', 'PERM_contrat:renew', 'PERM_contrat:update')` | 773 |
| `ContratController.java.actions` | `GET /api/v1/contrats` | `("/{id}/actions")` | `hasAuthority('PERM_contrat:view')` | 786 |
| `ContratController.java.quittances` | `GET /api/v1/contrats` | `("/{id}/quittances")` | `hasAnyAuthority('PERM_quittance:view', 'PERM_contrat:view')` | 792 |
| `ContratController.java.previsualiserQuittance` | `POST /api/v1/contrats` | `("/{id}/mouvements/previsualisation-quittance")` | `hasAuthority('PERM_contrat:update')` | 798 |
| `ContratController.java.creerMouvement` | `POST /api/v1/contrats` | `("/{id}/mouvements")` | `hasAuthority('PERM_contrat:update')` | 807 |
| `ContratController.java.upsertAssistance` | `POST /api/v1/contrats` | `("/{id}/assistances")` | `hasAnyAuthority('PERM_assistance:manage', 'PERM_contrat:update')` | 816 |
| `ContratController.java.assistanceContext` | `GET /api/v1/contrats` | `("/{id}/assistances")` | `hasAnyAuthority('PERM_assistance:view', 'PERM_contrat:view')` | 825 |
| `ContratController.java.deleteAssistance` | `DELETE /api/v1/contrats` | `("/{id}/assistances/{assistanceId}")` | `hasAnyAuthority('PERM_assistance:manage', 'PERM_contrat:update')` | 835 |
| `ContratController.java.carteVerteContext` | `GET /api/v1/contrats` | `("/{id}/cartes-vertes")` | `hasAnyAuthority('PERM_carte-verte:view', 'PERM_contrat:view')` | 842 |
| `ContratController.java.upsertCarteVerte` | `POST /api/v1/contrats` | `("/{id}/cartes-vertes")` | `hasAnyAuthority('PERM_carte-verte:manage', 'PERM_contrat:update')` | 851 |
| `ContratController.java.deleteCarteVerte` | `DELETE /api/v1/contrats` | `("/{id}/cartes-vertes/{carteVerteId}")` | `hasAnyAuthority('PERM_carte-verte:manage', 'PERM_contrat:update')` | 860 |
| `ConventionProductionController.java.search` | `GET /api/v1/compta/conventions/production` | `(root)` | `hasAuthority('PERM_quittance:view')` | 26 |
| `ConventionProductionController.java.export` | `GET /api/v1/compta/conventions/production` | `("/export")` | `hasAuthority('PERM_quittance:view')` | 32 |
| `DashboardController.java.dashboard` | `GET /api/v1/dashboard` | `(root)` | `hasAnyAuthority('PERM_contrat:view', 'PERM_quittance:view')` | 26 |
| `GroupeClientController.java.list` | `GET /api/v1/groupes-clients` | `(root)` | `hasAnyAuthority('PERM_client:view', 'PERM_contrat:create', 'PERM_contrat:update', 'PERM_quittance:view')` | 29 |
| `GroupeClientController.java.get` | `GET /api/v1/groupes-clients` | `("/{id}")` | `hasAnyAuthority('PERM_client:view', 'PERM_contrat:create', 'PERM_contrat:update', 'PERM_quittance:view')` | 35 |
| `GroupeClientController.java.create` | `POST /api/v1/groupes-clients` | `(root)` | `hasAnyAuthority('PERM_client:manage', 'PERM_client:create')` | 41 |
| `GroupeClientController.java.update` | `PUT /api/v1/groupes-clients` | `("/{id}")` | `hasAnyAuthority('PERM_client:manage', 'PERM_client:create')` | 50 |
| `PieceJointeController.java.listTypes` | `GET ` | `("/api/v1/pieces-jointes/types")` | `hasAnyAuthority('PERM_piece-jointe:view', 'PERM_contrat:view')` | 38 |
| `PieceJointeController.java.createType` | `POST ` | `("/api/v1/pieces-jointes/types")` | `hasAnyAuthority('PERM_piece-jointe:manage', 'PERM_config:manage')` | 46 |
| `PieceJointeController.java.updateType` | `PUT ` | `("/api/v1/pieces-jointes/types/{id}")` | `hasAnyAuthority('PERM_piece-jointe:manage', 'PERM_config:manage')` | 52 |
| `PieceJointeController.java.deactivateType` | `DELETE ` | `("/api/v1/pieces-jointes/types/{id}")` | `hasAnyAuthority('PERM_piece-jointe:manage', 'PERM_config:manage')` | 61 |
| `PieceJointeController.java.listTypesMouvement` | `GET ` | `("/api/v1/pieces-jointes/types-mouvements")` | `hasAnyAuthority('PERM_piece-jointe:view', 'PERM_contrat:view')` | 68 |
| `PieceJointeController.java.listContratPieces` | `GET ` | `("/api/v1/contrats/{contratId}/pieces-jointes")` | `hasAnyAuthority('PERM_piece-jointe:view', 'PERM_contrat:view')` | 74 |
| `PieceJointeController.java.upload` | `POST ` | `(path = "/api/v1/contrats/{contratId}/pieces-jointes", consumes = MediaType.MULTIPART_FORM_DATA_VALUE)` | `hasAnyAuthority('PERM_piece-jointe:manage', 'PERM_contrat:update')` | 83 |
| `PieceJointeController.java.policy` | `PUT ` | `("/api/v1/pieces-jointes/natures/{natureId}/policy")` | `hasAnyAuthority('PERM_piece-jointe:manage', 'PERM_config:manage')` | 105 |
| `PieceJointeController.java.clientTypes` | `GET ` | `("/api/v1/clients/documents/types")` | `hasAnyAuthority('PERM_client:view', 'PERM_client:create', 'PERM_client:manage')` | 115 |
| `PieceJointeController.java.clientDocuments` | `GET ` | `("/api/v1/clients/{clientId}/pieces-jointes")` | `hasAuthority('PERM_client:view')` | 122 |
| `PieceJointeController.java.uploadClient` | `POST ` | `(path = "/api/v1/clients/{clientId}/pieces-jointes", consumes = MediaType.MULTIPART_FORM_DATA_VALUE)` | `hasAnyAuthority('PERM_client:manage', 'PERM_client:create')` | 128 |
| `PieceJointeController.java.deleteClient` | `DELETE ` | `("/api/v1/clients/{clientId}/pieces-jointes/{pieceId}")` | `hasAnyAuthority('PERM_client:manage', 'PERM_client:create')` | 138 |
| `PieceJointeController.java.downloadClient` | `GET ` | `("/api/v1/clients/{clientId}/pieces-jointes/{pieceId}/download")` | `hasAuthority('PERM_client:view')` | 145 |
| `PieceJointeController.java.reuse` | `POST ` | `("/api/v1/contrats/{contratId}/pieces-jointes/reuse")` | `hasAnyAuthority('PERM_piece-jointe:manage', 'PERM_contrat:update') and hasAuthority('PERM_client:view')` | 155 |
| `PieceJointeController.java.assignOwner` | `POST ` | `("/api/v1/contrats/{contratId}/pieces-jointes/{pieceId}/owner")` | `hasAnyAuthority('PERM_piece-jointe:manage', 'PERM_contrat:update')` | 164 |
| `PieceJointeController.java.unlink` | `DELETE ` | `("/api/v1/contrats/{contratId}/pieces-jointes/{pieceId}/usage")` | `hasAnyAuthority('PERM_piece-jointe:manage', 'PERM_contrat:update')` | 172 |
| `PieceJointeController.java.replace` | `POST ` | `(path = "/api/v1/contrats/{contratId}/pieces-jointes/{pieceId}/replace", consumes = MediaType.MULTIPART_FORM_DATA_VALUE)` | `hasAnyAuthority('PERM_piece-jointe:manage', 'PERM_contrat:update')` | 180 |
| `PieceJointeController.java.download` | `GET ` | `("/api/v1/contrats/{contratId}/pieces-jointes/{pieceId}/download")` | `hasAnyAuthority('PERM_piece-jointe:view', 'PERM_contrat:view')` | 189 |
| `PieceJointeController.java.delete` | `DELETE ` | `("/api/v1/contrats/{contratId}/pieces-jointes/{pieceId}")` | `hasAnyAuthority('PERM_piece-jointe:manage', 'PERM_contrat:update')` | 202 |
| `PlatformDashboardController.java.dashboard` | `GET /api/v1/platform/dashboard` | `(root)` | SecurityConfig/service/self-service; inspect | 25 |
| `PrestataireSinistreController.java.directory` | `GET /api/v1/sinistres/prestataires` | `(root)` | `hasAuthority('PERM_sinistre:referentiel')` | 27 |
| `PrestataireSinistreController.java.eligible` | `GET /api/v1/sinistres/prestataires` | `("/eligibles")` | `hasAnyAuthority('PERM_sinistre:view', 'PERM_sinistre:create', 'PERM_sinistre:manage', 'PERM_sinistre:finance', 'PERM_sinistre:referentiel')` | 41 |
| `PrestataireSinistreController.java.options` | `GET /api/v1/sinistres/prestataires` | `("/options")` | `hasAuthority('PERM_sinistre:referentiel')` | 56 |
| `PrestataireSinistreController.java.specialties` | `GET /api/v1/sinistres/prestataires` | `("/specialites")` | `hasAuthority('PERM_sinistre:referentiel')` | 62 |
| `PrestataireSinistreController.java.create` | `POST /api/v1/sinistres/prestataires` | `("/specialites")` | `hasAuthority('PERM_sinistre:referentiel')` | 68 |
| `PrestataireSinistreController.java.update` | `PUT /api/v1/sinistres/prestataires` | `("/specialites/{id}")` | `hasAuthority('PERM_sinistre:referentiel')` | 74 |
| `ReferentielController.java.branchesAssurance` | `GET /api/v1/referentiel` | `("/branches-assurance")` | SecurityConfig/service/self-service; inspect | 140 |
| `ReferentielController.java.pays` | `GET /api/v1/referentiel` | `("/pays")` | SecurityConfig/service/self-service; inspect | 148 |
| `ReferentielController.java.usages` | `GET /api/v1/referentiel` | `("/usages")` | SecurityConfig/service/self-service; inspect | 158 |
| `ReferentielController.java.createUsage` | `POST /api/v1/referentiel` | `("/usages")` | SecurityConfig/service/self-service; inspect | 181 |
| `ReferentielController.java.updateUsage` | `PUT /api/v1/referentiel` | `("/usages/{id}")` | SecurityConfig/service/self-service; inspect | 199 |
| `ReferentielController.java.updateUsageTauxExtensionRemorque` | `PUT /api/v1/referentiel` | `("/usages/taux-extension-remorque")` | SecurityConfig/service/self-service; inspect | 224 |
| `ReferentielController.java.marques` | `GET /api/v1/referentiel` | `("/marques")` | SecurityConfig/service/self-service; inspect | 255 |
| `ReferentielController.java.createMarque` | `POST /api/v1/referentiel` | `("/marques")` | SecurityConfig/service/self-service; inspect | 262 |
| `ReferentielController.java.updateMarque` | `PUT /api/v1/referentiel` | `("/marques/{id}")` | SecurityConfig/service/self-service; inspect | 280 |
| `ReferentielController.java.carrosseries` | `GET /api/v1/referentiel` | `("/carrosseries")` | SecurityConfig/service/self-service; inspect | 305 |
| `ReferentielController.java.createCarrosserie` | `POST /api/v1/referentiel` | `("/carrosseries")` | SecurityConfig/service/self-service; inspect | 312 |
| `ReferentielController.java.updateCarrosserie` | `PUT /api/v1/referentiel` | `("/carrosseries/{id}")` | SecurityConfig/service/self-service; inspect | 330 |
| `ReferentielController.java.carburants` | `GET /api/v1/referentiel` | `("/carburants")` | SecurityConfig/service/self-service; inspect | 355 |
| `ReferentielController.java.createCarburant` | `POST /api/v1/referentiel` | `("/carburants")` | SecurityConfig/service/self-service; inspect | 362 |
| `ReferentielController.java.updateCarburant` | `PUT /api/v1/referentiel` | `("/carburants/{id}")` | SecurityConfig/service/self-service; inspect | 381 |
| `ReferentielController.java.sousClasses` | `GET /api/v1/referentiel` | `("/sous-classes")` | SecurityConfig/service/self-service; inspect | 407 |
| `ReferentielController.java.createSousClasse` | `POST /api/v1/referentiel` | `("/sous-classes")` | SecurityConfig/service/self-service; inspect | 414 |
| `ReferentielController.java.updateSousClasse` | `PUT /api/v1/referentiel` | `("/sous-classes/{id}")` | SecurityConfig/service/self-service; inspect | 436 |
| `ReferentielController.java.compagniesAssurance` | `GET /api/v1/referentiel` | `("/compagnies-assurance")` | SecurityConfig/service/self-service; inspect | 465 |
| `ReferentielController.java.createCompagnieAssurance` | `POST /api/v1/referentiel` | `("/compagnies-assurance")` | SecurityConfig/service/self-service; inspect | 480 |
| `ReferentielController.java.updateCompagnieAssurance` | `PUT /api/v1/referentiel` | `("/compagnies-assurance/{id}")` | SecurityConfig/service/self-service; inspect | 504 |
| `ReferentielController.java.compagniesAssistance` | `GET /api/v1/referentiel` | `("/compagnies-assistance")` | SecurityConfig/service/self-service; inspect | 529 |
| `ReferentielController.java.createCompagnieAssistance` | `POST /api/v1/referentiel` | `("/compagnies-assistance")` | `hasAuthority('PERM_referentiel:manage')` | 544 |
| `ReferentielController.java.updateCompagnieAssistance` | `PUT /api/v1/referentiel` | `("/compagnies-assistance/{id}")` | `hasAuthority('PERM_referentiel:manage')` | 568 |
| `ReferentielController.java.deleteCompagnieAssistance` | `DELETE /api/v1/referentiel` | `("/compagnies-assistance/{id}")` | SecurityConfig/service/self-service; inspect | 592 |
| `ReferentielController.java.produitsAssistance` | `GET /api/v1/referentiel` | `("/produits-assistance")` | SecurityConfig/service/self-service; inspect | 608 |
| `ReferentielController.java.createProduitAssistance` | `POST /api/v1/referentiel` | `("/produits-assistance")` | SecurityConfig/service/self-service; inspect | 630 |
| `ReferentielController.java.updateProduitAssistance` | `PUT /api/v1/referentiel` | `("/produits-assistance/{id}")` | SecurityConfig/service/self-service; inspect | 650 |
| `ReferentielController.java.deleteProduitAssistance` | `DELETE /api/v1/referentiel` | `("/produits-assistance/{id}")` | SecurityConfig/service/self-service; inspect | 673 |
| `ReferentielController.java.deleteProduitAssistancePermanently` | `DELETE /api/v1/referentiel` | `("/produits-assistance/{id}/permanent")` | SecurityConfig/service/self-service; inspect | 689 |
| `ReferentielController.java.tarifsProduitAssistance` | `GET /api/v1/referentiel` | `("/produits-assistance/{id}/tarifs")` | SecurityConfig/service/self-service; inspect | 709 |
| `ReferentielController.java.createTarifProduitAssistance` | `POST /api/v1/referentiel` | `("/produits-assistance/{id}/tarifs")` | SecurityConfig/service/self-service; inspect | 721 |
| `ReferentielController.java.updateTarifProduitAssistance` | `PUT /api/v1/referentiel` | `("/produits-assistance/{produitId}/tarifs/{tarifId}")` | SecurityConfig/service/self-service; inspect | 744 |
| `ReferentielController.java.deleteTarifProduitAssistance` | `DELETE /api/v1/referentiel` | `("/produits-assistance/{produitId}/tarifs/{tarifId}")` | SecurityConfig/service/self-service; inspect | 774 |
| `ReferentielController.java.codesPromoAssistance` | `GET /api/v1/referentiel` | `("/produits-assistance/{id}/codes-promo")` | SecurityConfig/service/self-service; inspect | 797 |
| `ReferentielController.java.createCodePromoAssistance` | `POST /api/v1/referentiel` | `("/produits-assistance/{id}/codes-promo")` | SecurityConfig/service/self-service; inspect | 809 |
| `ReferentielController.java.updateCodePromoAssistance` | `PUT /api/v1/referentiel` | `("/produits-assistance/{produitId}/codes-promo/{promoId}")` | SecurityConfig/service/self-service; inspect | 832 |
| `ReferentielController.java.deleteCodePromoAssistance` | `DELETE /api/v1/referentiel` | `("/produits-assistance/{produitId}/codes-promo/{promoId}")` | SecurityConfig/service/self-service; inspect | 862 |
| `ReferentielController.java.grillesTarifaires` | `GET /api/v1/referentiel` | `("/grilles-tarifaires")` | SecurityConfig/service/self-service; inspect | 885 |
| `ReferentielController.java.catalogueGrillesTarifaires` | `GET /api/v1/referentiel` | `("/grilles-tarifaires/catalogue")` | SecurityConfig/service/self-service; inspect | 906 |
| `ReferentielController.java.tarifsUsage` | `GET /api/v1/referentiel` | `("/tarifs-usage")` | SecurityConfig/service/self-service; inspect | 925 |
| `ReferentielController.java.createTarifUsage` | `POST /api/v1/referentiel` | `("/tarifs-usage")` | SecurityConfig/service/self-service; inspect | 943 |
| `ReferentielController.java.updateTarifUsage` | `PUT /api/v1/referentiel` | `("/tarifs-usage/{id}")` | SecurityConfig/service/self-service; inspect | 957 |
| `ReferentielController.java.deleteTarifUsage` | `DELETE /api/v1/referentiel` | `("/tarifs-usage/{id}")` | SecurityConfig/service/self-service; inspect | 980 |
| `ReferentielController.java.bulkUpdatePrimeNette` | `POST /api/v1/referentiel` | `("/tarifs-usage/bulk-prime-nette")` | SecurityConfig/service/self-service; inspect | 996 |
| `ReferentielController.java.tarifUsageAdjustmentHistory` | `GET /api/v1/referentiel` | `("/tarifs-usage/ajustements")` | SecurityConfig/service/self-service; inspect | 1009 |
| `ReferentielController.java.conventions` | `GET /api/v1/referentiel` | `("/conventions")` | SecurityConfig/service/self-service; inspect | 1018 |
| `ReferentielController.java.createConvention` | `POST /api/v1/referentiel` | `("/conventions")` | SecurityConfig/service/self-service; inspect | 1032 |
| `ReferentielController.java.updateConvention` | `PUT /api/v1/referentiel` | `("/conventions/{id}")` | SecurityConfig/service/self-service; inspect | 1047 |
| `ReferentielController.java.createGrilleTarifaire` | `POST /api/v1/referentiel` | `("/grilles-tarifaires")` | SecurityConfig/service/self-service; inspect | 1068 |
| `ReferentielController.java.updateGrilleTarifaire` | `PUT /api/v1/referentiel` | `("/grilles-tarifaires/{id}")` | SecurityConfig/service/self-service; inspect | 1089 |
| `ReferentielController.java.garanties` | `GET /api/v1/referentiel` | `("/garanties")` | SecurityConfig/service/self-service; inspect | 1111 |
| `ReferentielController.java.garantiesParametrage` | `GET /api/v1/referentiel` | `("/garanties/parametrage")` | SecurityConfig/service/self-service; inspect | 1124 |
| `ReferentielController.java.groupesExclusionGaranties` | `GET /api/v1/referentiel` | `("/groupes-exclusion-garanties")` | SecurityConfig/service/self-service; inspect | 1132 |
| `ReferentielController.java.groupesExclusionGarantiesParametrage` | `GET /api/v1/referentiel` | `("/groupes-exclusion-garanties/parametrage")` | SecurityConfig/service/self-service; inspect | 1140 |
| `ReferentielController.java.createGroupeExclusionGarantie` | `POST /api/v1/referentiel` | `("/groupes-exclusion-garanties")` | SecurityConfig/service/self-service; inspect | 1147 |
| `ReferentielController.java.updateGroupeExclusionGarantie` | `PUT /api/v1/referentiel` | `("/groupes-exclusion-garanties/{id}")` | SecurityConfig/service/self-service; inspect | 1164 |
| `ReferentielController.java.createGarantie` | `POST /api/v1/referentiel` | `("/garanties")` | SecurityConfig/service/self-service; inspect | 1188 |
| `ReferentielController.java.updateGarantie` | `PUT /api/v1/referentiel` | `("/garanties/{id}")` | SecurityConfig/service/self-service; inspect | 1208 |
| `ReferentielController.java.lignesGrilleTarifaire` | `GET /api/v1/referentiel` | `("/lignes-grille-tarifaire")` | SecurityConfig/service/self-service; inspect | 1235 |
| `ReferentielController.java.formulesGarantiePersonne` | `GET /api/v1/referentiel` | `("/formules-garantie-personne")` | SecurityConfig/service/self-service; inspect | 1251 |
| `ReferentielController.java.createLigneGrilleTarifaire` | `POST /api/v1/referentiel` | `("/grilles-tarifaires/{grilleId}/lignes")` | SecurityConfig/service/self-service; inspect | 1273 |
| `ReferentielController.java.updateLigneGrilleTarifaire` | `PUT /api/v1/referentiel` | `("/lignes-grille-tarifaire/{id}")` | SecurityConfig/service/self-service; inspect | 1291 |
| `ReferentielController.java.replaceGrilleUsageConfiguration` | `POST /api/v1/referentiel` | `("/grilles-tarifaires/{grilleId}/usages/{usageId}/configuration")` | SecurityConfig/service/self-service; inspect | 1309 |
| `ReferentielController.java.createFormuleGarantiePersonne` | `POST /api/v1/referentiel` | `("/grilles-tarifaires/{grilleId}/formules-personne")` | SecurityConfig/service/self-service; inspect | 1392 |
| `ReferentielController.java.updateFormuleGarantiePersonne` | `PUT /api/v1/referentiel` | `("/formules-garantie-personne/{id}")` | SecurityConfig/service/self-service; inspect | 1410 |
| `ReferentielController.java.villes` | `GET /api/v1/referentiel` | `("/villes")` | SecurityConfig/service/self-service; inspect | 1440 |
| `ReferentielController.java.categoriesClient` | `GET /api/v1/referentiel` | `("/categories-client")` | SecurityConfig/service/self-service; inspect | 1449 |
| `ReferentielController.java.createCategorieClient` | `POST /api/v1/referentiel` | `("/categories-client")` | SecurityConfig/service/self-service; inspect | 1457 |
| `ReferentielController.java.updateCategorieClient` | `PUT /api/v1/referentiel` | `("/categories-client/{id}")` | SecurityConfig/service/self-service; inspect | 1476 |
| `ReferentielController.java.groupesUsageAttestation` | `GET /api/v1/referentiel` | `("/groupes-usage-attestation")` | SecurityConfig/service/self-service; inspect | 1500 |
| `ReferentielController.java.groupesUsageAttestationParametrage` | `GET /api/v1/referentiel` | `("/groupes-usage-attestation/parametrage")` | SecurityConfig/service/self-service; inspect | 1509 |
| `ReferentielController.java.createGroupeUsageAttestation` | `POST /api/v1/referentiel` | `("/groupes-usage-attestation")` | SecurityConfig/service/self-service; inspect | 1517 |
| `ReferentielController.java.updateGroupeUsageAttestation` | `PUT /api/v1/referentiel` | `("/groupes-usage-attestation/{id}")` | SecurityConfig/service/self-service; inspect | 1538 |
| `ReferentielController.java.categoriesTransport` | `GET /api/v1/referentiel` | `("/categories-transport")` | SecurityConfig/service/self-service; inspect | 1566 |
| `ReferentielController.java.createCategorieTransport` | `POST /api/v1/referentiel` | `("/categories-transport")` | SecurityConfig/service/self-service; inspect | 1574 |
| `ReferentielController.java.updateCategorieTransport` | `PUT /api/v1/referentiel` | `("/categories-transport/{id}")` | SecurityConfig/service/self-service; inspect | 1596 |
| `RegleFiscaleController.java.list` | `GET /api/v1/regles-fiscales` | `(root)` | `hasAnyAuthority('PERM_regle-fiscale:view', 'PERM_regle-fiscale:manage', 'PERM_config:manage')` | 29 |
| `RegleFiscaleController.java.create` | `POST /api/v1/regles-fiscales` | `(root)` | `hasAnyAuthority('PERM_regle-fiscale:manage', 'PERM_config:manage')` | 35 |
| `RegleFiscaleController.java.update` | `PUT /api/v1/regles-fiscales` | `("/{id}")` | `hasAnyAuthority('PERM_regle-fiscale:manage', 'PERM_config:manage')` | 41 |
| `RegleFiscaleController.java.deactivate` | `DELETE /api/v1/regles-fiscales` | `("/{id}")` | `hasAnyAuthority('PERM_regle-fiscale:manage', 'PERM_config:manage')` | 50 |
| `ReglementClientController.java.rejectionDetail` | `GET /api/v1/compta/reglements-clients` | `("/rejets-bancaires/{rejetId}")` | `hasAuthority('PERM_tresorerie:view')` | 65 |
| `ReglementClientController.java.rejectionHistory` | `GET /api/v1/compta/reglements-clients` | `("/instruments/{instrumentId}/suivi-rejet")` | `hasAuthority('PERM_tresorerie:view')` | 71 |
| `ReglementClientController.java.rejectionPayer` | `GET /api/v1/compta/reglements-clients` | `("/instruments/{instrumentId}/fiche-payeur-rejet")` | `hasAuthority('PERM_tresorerie:view') and hasAuthority('PERM_client:view')` | 77 |
| `ReglementClientController.java.addRejectionMovement` | `POST /api/v1/compta/reglements-clients` | `("/instruments/{instrumentId}/suivi-rejet")` | `hasAuthority('PERM_tresorerie:view') and hasAuthority('PERM_reglement-client:manage')` | 83 |
| `ReglementClientController.java.receivables` | `GET /api/v1/compta/reglements-clients` | `("/creances")` | `hasAuthority('PERM_reglement-client:view')` | 99 |
| `ReglementClientController.java.invoiceReceivables` | `GET /api/v1/compta/reglements-clients` | `("/creances/factures")` | `hasAuthority('PERM_reglement-client:view')` | 142 |
| `ReglementClientController.java.selectedReceivables` | `POST /api/v1/compta/reglements-clients` | `("/creances/selection")` | `hasAuthority('PERM_reglement-client:view')` | 195 |
| `ReglementClientController.java.paymentPolicy` | `GET /api/v1/compta/reglements-clients` | `("/politique")` | `hasAnyAuthority('PERM_reglement-client:view', 'PERM_reglement-client:manage')` | 206 |
| `ReglementClientController.java.updatePaymentPolicy` | `PUT /api/v1/compta/reglements-clients` | `("/politique")` | `hasAuthority('PERM_reglement-client:manage')` | 214 |
| `ReglementClientController.java.payments` | `GET /api/v1/compta/reglements-clients` | `(root)` | `hasAuthority('PERM_reglement-client:view')` | 225 |
| `ReglementClientController.java.recordedInstruments` | `GET /api/v1/compta/reglements-clients` | `("/recherche-moyens")` | `hasAuthority('PERM_reglement-client:view')` | 260 |
| `ReglementClientController.java.journalUsers` | `GET /api/v1/compta/reglements-clients` | `("/journal/utilisateurs")` | `hasAuthority('PERM_reglement-client:view')` | 280 |
| `ReglementClientController.java.paymentJournalPdf` | `GET /api/v1/compta/reglements-clients` | `("/journal/pdf")` | `hasAuthority('PERM_reglement-client:view')` | 288 |
| `ReglementClientController.java.payment` | `GET /api/v1/compta/reglements-clients` | `("/{paymentId}")` | `hasAuthority('PERM_reglement-client:view')` | 314 |
| `ReglementClientController.java.issuePremiumReceipt` | `POST /api/v1/compta/reglements-clients` | `("/{paymentId}/quittance-prime/pdf")` | `hasAnyAuthority('PERM_reglement-client:create', 'PERM_reglement-client:manage')` | 323 |
| `ReglementClientController.java.premiumReceiptOptions` | `GET /api/v1/compta/reglements-clients` | `("/{paymentId}/quittance-prime/options")` | `hasAuthority('PERM_reglement-client:view')` | 333 |
| `ReglementClientController.java.selectedPremiumReceipt` | `GET /api/v1/compta/reglements-clients` | `("/{paymentId}/quittance-prime/{receiptId}/pdf")` | `hasAuthority('PERM_reglement-client:view')` | 339 |
| `ReglementClientController.java.premiumReceipt` | `GET /api/v1/compta/reglements-clients` | `("/{paymentId}/quittance-prime/pdf")` | `hasAuthority('PERM_reglement-client:view')` | 345 |
| `ReglementClientController.java.deleteLegacyPremiumReceipt` | `DELETE /api/v1/compta/reglements-clients` | `("/{paymentId}/quittance-prime/pdf")` | `hasAuthority('PERM_reglement-client:manage')` | 351 |
| `ReglementClientController.java.deletePremiumReceipt` | `DELETE /api/v1/compta/reglements-clients` | `("/{paymentId}/quittance-prime/{receiptId}/pdf")` | `hasAuthority('PERM_reglement-client:manage')` | 358 |
| `ReglementClientController.java.paymentPdf` | `GET /api/v1/compta/reglements-clients` | `("/{paymentId}/pdf")` | `hasAuthority('PERM_reglement-client:view')` | 372 |
| `ReglementClientController.java.create` | `POST /api/v1/compta/reglements-clients` | `(root)` | `hasAnyAuthority('PERM_reglement-client:create', 'PERM_reglement-client:manage')` | 390 |
| `ReglementClientController.java.createDirectDeposit` | `POST /api/v1/compta/reglements-clients` | `(value = "/versements-bancaires", consumes = MediaType.MULTIPART_FORM_DATA_VALUE)` | `hasAnyAuthority('PERM_reglement-client:create', 'PERM_reglement-client:manage')` | 402 |
| `ReglementClientController.java.downloadDirectDepositReceipt` | `GET /api/v1/compta/reglements-clients` | `("/{paymentId}/bordereau")` | `hasAuthority('PERM_reglement-client:view')` | 416 |
| `ReglementClientController.java.createInvoice` | `POST /api/v1/compta/reglements-clients` | `("/{paymentId}/facture")` | `hasAnyAuthority('PERM_quittance:create', 'PERM_quittance:manage')` | 432 |
| `ReglementClientController.java.cancel` | `POST /api/v1/compta/reglements-clients` | `("/{paymentId}/annulation")` | `hasAuthority('PERM_reglement-client:manage')` | 446 |
| `ReglementClientController.java.pendingInstruments` | `GET /api/v1/compta/reglements-clients` | `("/instruments/en-attente")` | `hasAuthority('PERM_tresorerie:view')` | 459 |
| `ReglementClientController.java.bankRejections` | `GET /api/v1/compta/reglements-clients` | `("/instruments/rejets-bancaires")` | `hasAuthority('PERM_tresorerie:view')` | 467 |
| `ReglementClientController.java.exportBankRejections` | `GET /api/v1/compta/reglements-clients` | `("/instruments/rejets-bancaires/export")` | `hasAuthority('PERM_tresorerie:view')` | 491 |
| `ReglementClientController.java.registerBankRejection` | `POST /api/v1/compta/reglements-clients` | `("/instruments/{instrumentId}/rejet-bancaire")` | `hasAuthority('PERM_tresorerie:manage')` | 516 |
| `ReglementClientController.java.instruments` | `GET /api/v1/compta/reglements-clients` | `("/instruments")` | `hasAuthority('PERM_tresorerie:view')` | 527 |
| `ReglementClientController.java.changeInstrumentStatus` | `PUT /api/v1/compta/reglements-clients` | `("/instruments/{instrumentId}/statut")` | `hasAuthority('PERM_tresorerie:manage')` | 566 |
| `ReglementClientController.java.replaceInstrument` | `POST /api/v1/compta/reglements-clients` | `("/instruments/{instrumentId}/remplacement")` | `hasAuthority('PERM_reglement-client:manage')` | 579 |
| `ReglementClientController.java.representInstrument` | `POST /api/v1/compta/reglements-clients` | `("/instruments/{instrumentId}/representation")` | `hasAuthority('PERM_reglement-client:manage')` | 592 |
| `ReleveBancaireController.java.preview` | `POST /api/v1/compta/tresorerie/releves-bancaires` | `(` | `hasAuthority('PERM_tresorerie:manage')` | 36 |
| `ReleveBancaireController.java.confirmImport` | `POST /api/v1/compta/tresorerie/releves-bancaires` | `(consumes = MediaType.MULTIPART_FORM_DATA_VALUE)` | `hasAuthority('PERM_tresorerie:manage')` | 51 |
| `ReleveBancaireController.java.list` | `GET /api/v1/compta/tresorerie/releves-bancaires` | `(root)` | `hasAuthority('PERM_tresorerie:view')` | 68 |
| `ReleveBancaireController.java.profiles` | `GET /api/v1/compta/tresorerie/releves-bancaires` | `("/profils")` | `hasAuthority('PERM_tresorerie:view')` | 83 |
| `ReleveBancaireController.java.detail` | `GET /api/v1/compta/tresorerie/releves-bancaires` | `("/{importId}")` | `hasAuthority('PERM_tresorerie:view')` | 94 |
| `ReleveBancaireController.java.saveReconciliations` | `PUT /api/v1/compta/tresorerie/releves-bancaires` | `("/{importId}/rapprochements")` | `hasAuthority('PERM_tresorerie:manage')` | 105 |
| `ReleveBancaireController.java.validate` | `POST /api/v1/compta/tresorerie/releves-bancaires` | `("/{importId}/validation")` | `hasAuthority('PERM_tresorerie:manage')` | 118 |
| `SinistreAssistanceController.java.available` | `GET /api/v1/sinistres/assistances` | `(root)` | `hasAnyAuthority('PERM_sinistre:create', 'PERM_sinistre:view', 'PERM_sinistre:manage')` | 23 |
| `SinistreContratLookupController.java.search` | `GET /api/v1/sinistres/contrats` | `(root)` | `hasAnyAuthority('PERM_sinistre:create', 'PERM_sinistre:view', 'PERM_sinistre:manage')` | 25 |
| `SinistreController.java.duplicates` | `GET /api/v1/sinistres` | `("/doublons")` | `hasAnyAuthority('PERM_sinistre:view', 'PERM_sinistre:manage', 'PERM_sinistre:create')` | 58 |
| `SinistreController.java.treasuryAccounts` | `GET /api/v1/sinistres` | `("/comptes-tresorerie")` | `hasAuthority('PERM_sinistre:finance')` | 73 |
| `SinistreController.java.gestionnaires` | `GET /api/v1/sinistres` | `("/gestionnaires")` | `hasAnyAuthority('PERM_sinistre:view', 'PERM_sinistre:manage')` | 81 |
| `SinistreController.java.dashboard` | `GET /api/v1/sinistres` | `("/dashboard")` | `hasAnyAuthority('PERM_sinistre:view', 'PERM_sinistre:manage', 'PERM_sinistre:finance')` | 89 |
| `SinistreController.java.previewCoverage` | `GET /api/v1/sinistres` | `("/couverture")` | `hasAnyAuthority('PERM_sinistre:view', 'PERM_sinistre:create', 'PERM_sinistre:manage')` | 97 |
| `SinistreController.java.list` | `GET /api/v1/sinistres` | `(root)` | `hasAnyAuthority('PERM_sinistre:view', 'PERM_sinistre:manage', 'PERM_sinistre:finance')` | 110 |
| `SinistreController.java.create` | `POST /api/v1/sinistres` | `(root)` | `hasAuthority('PERM_sinistre:create')` | 139 |
| `SinistreController.java.ouvrir` | `POST /api/v1/sinistres` | `(value = "/ouverture", consumes = org.springframework.http.MediaType.MULTIPART_FORM_DATA_VALUE)` | `hasAuthority('PERM_sinistre:create')` | 153 |
| `SinistreController.java.transitionEtape` | `POST /api/v1/sinistres` | `("/{id}/etape")` | `hasAuthority('PERM_sinistre:manage')` | 167 |
| `SinistreController.java.get` | `GET /api/v1/sinistres` | `("/{id}")` | `hasAnyAuthority('PERM_sinistre:view', 'PERM_sinistre:manage', 'PERM_sinistre:finance')` | 178 |
| `SinistreController.java.update` | `PUT /api/v1/sinistres` | `("/{id}")` | `hasAuthority('PERM_sinistre:manage')` | 186 |
| `SinistreController.java.transition` | `POST /api/v1/sinistres` | `("/{id}/transition")` | `hasAuthority('PERM_sinistre:manage')` | 200 |
| `SinistreController.java.deleteEarlyClaim` | `DELETE /api/v1/sinistres` | `("/{id}")` | `hasAuthority('PERM_sinistre:manage')` | 214 |
| `SinistreController.java.updateGuarantee` | `PUT /api/v1/sinistres` | `("/{id}/garanties/{garantieId}")` | `hasAuthority('PERM_sinistre:manage')` | 221 |
| `SinistreController.java.updateGuarantees` | `PUT /api/v1/sinistres` | `("/{id}/garanties")` | `hasAuthority('PERM_sinistre:manage')` | 237 |
| `SinistreController.java.addParty` | `POST /api/v1/sinistres` | `("/{id}/parties")` | `hasAuthority('PERM_sinistre:manage')` | 251 |
| `SinistreController.java.updateParty` | `PUT /api/v1/sinistres` | `("/{id}/parties/{partieId}")` | `hasAuthority('PERM_sinistre:manage')` | 265 |
| `SinistreController.java.deleteParty` | `DELETE /api/v1/sinistres` | `("/{id}/parties/{partieId}")` | `hasAuthority('PERM_sinistre:manage')` | 281 |
| `SinistreController.java.addProvision` | `POST /api/v1/sinistres` | `("/{id}/provisions")` | `hasAuthority('PERM_sinistre:finance')` | 295 |
| `SinistreController.java.createMission` | `POST /api/v1/sinistres` | `("/{id}/missions")` | `hasAuthority('PERM_sinistre:manage')` | 309 |
| `SinistreController.java.updateMission` | `PUT /api/v1/sinistres` | `("/{id}/missions/{missionId}")` | `hasAuthority('PERM_sinistre:manage')` | 318 |
| `SinistreController.java.addOperation` | `POST /api/v1/sinistres` | `("/{id}/operations")` | `hasAuthority('PERM_sinistre:finance')` | 328 |
| `SinistreController.java.cancelOperation` | `POST /api/v1/sinistres` | `("/{id}/operations/{operationId}/annulation")` | `hasAuthority('PERM_sinistre:finance')` | 342 |
| `SinistreDocumentController.java.upload` | `POST /api/v1/sinistres/{sinistreId}/documents` | `(consumes = MediaType.MULTIPART_FORM_DATA_VALUE)` | `hasAuthority('PERM_sinistre:manage')` | 36 |
| `SinistreDocumentController.java.download` | `GET /api/v1/sinistres/{sinistreId}/documents` | `("/{documentId}/download")` | `hasAnyAuthority('PERM_sinistre:view', 'PERM_sinistre:manage')` | 68 |
| `SinistreDocumentController.java.review` | `PUT /api/v1/sinistres/{sinistreId}/documents` | `("/{documentId}/statut")` | `hasAuthority('PERM_sinistre:manage')` | 88 |
| `SinistreDocumentController.java.delete` | `DELETE /api/v1/sinistres/{sinistreId}/documents` | `("/{documentId}")` | `hasAuthority('PERM_sinistre:manage')` | 106 |
| `SinistreReferentielController.java.listExperts` | `GET /api/v1/sinistres/referentiels` | `("/experts")` | `hasAnyAuthority('PERM_sinistre:view', 'PERM_sinistre:manage', 'PERM_sinistre:referentiel', 'PERM_sinistre:create')` | 31 |
| `SinistreReferentielController.java.createExpert` | `POST /api/v1/sinistres/referentiels` | `("/experts")` | `hasAuthority('PERM_sinistre:referentiel')` | 44 |
| `SinistreReferentielController.java.updateExpert` | `PUT /api/v1/sinistres/referentiels` | `("/experts/{id}")` | `hasAuthority('PERM_sinistre:referentiel')` | 52 |
| `SinistreReferentielController.java.listGarages` | `GET /api/v1/sinistres/referentiels` | `("/garages")` | `hasAnyAuthority('PERM_sinistre:view', 'PERM_sinistre:manage', 'PERM_sinistre:referentiel', 'PERM_sinistre:create')` | 61 |
| `SinistreReferentielController.java.createGarage` | `POST /api/v1/sinistres/referentiels` | `("/garages")` | `hasAuthority('PERM_sinistre:referentiel')` | 72 |
| `SinistreReferentielController.java.updateGarage` | `PUT /api/v1/sinistres/referentiels` | `("/garages/{id}")` | `hasAuthority('PERM_sinistre:referentiel')` | 80 |
| `SinistreRegistreController.java.export` | `GET /api/v1/sinistres/registre` | `("/export")` | `hasAnyAuthority('PERM_sinistre:view', 'PERM_sinistre:manage', 'PERM_sinistre:finance')` | 26 |
| `SinistreStatistiquesController.java.get` | `GET /api/v1/sinistres/statistiques` | `(root)` | `hasAnyAuthority('PERM_sinistre:view', 'PERM_sinistre:manage', 'PERM_sinistre:finance')` | 22 |
| `TresorerieController.java.accounts` | `GET /api/v1/compta/tresorerie` | `("/comptes")` | `hasAuthority('PERM_tresorerie:view')` | 53 |
| `TresorerieController.java.administrationAccounts` | `GET /api/v1/compta/tresorerie` | `("/comptes/administration")` | `hasAuthority('PERM_tresorerie:manage')` | 62 |
| `TresorerieController.java.users` | `GET /api/v1/compta/tresorerie` | `("/utilisateurs")` | `hasAuthority('PERM_tresorerie:manage')` | 71 |
| `TresorerieController.java.assignments` | `GET /api/v1/compta/tresorerie` | `("/comptes/{accountId}/affectations")` | `hasAuthority('PERM_tresorerie:manage')` | 79 |
| `TresorerieController.java.saveAssignments` | `PUT /api/v1/compta/tresorerie` | `("/comptes/{accountId}/affectations")` | `hasAuthority('PERM_tresorerie:manage')` | 90 |
| `TresorerieController.java.createAccount` | `POST /api/v1/compta/tresorerie` | `("/comptes")` | `hasAuthority('PERM_tresorerie:manage')` | 103 |
| `TresorerieController.java.updateAccount` | `PUT /api/v1/compta/tresorerie` | `("/comptes/{accountId}")` | `hasAuthority('PERM_tresorerie:manage')` | 114 |
| `TresorerieController.java.changeAccountStatus` | `PUT /api/v1/compta/tresorerie` | `("/comptes/{accountId}/statut")` | `hasAuthority('PERM_tresorerie:manage')` | 127 |
| `TresorerieController.java.movements` | `GET /api/v1/compta/tresorerie` | `("/mouvements")` | `hasAuthority('PERM_tresorerie:view')` | 142 |
| `TresorerieController.java.journal` | `GET /api/v1/compta/tresorerie` | `("/journal")` | `hasAuthority('PERM_tresorerie:view')` | 150 |
| `TresorerieController.java.cashSessions` | `GET /api/v1/compta/tresorerie` | `("/sessions-caisse")` | `hasAuthority('PERM_tresorerie:view')` | 173 |
| `TresorerieController.java.openCashSession` | `POST /api/v1/compta/tresorerie` | `("/sessions-caisse")` | `hasAuthority('PERM_tresorerie:view')` | 181 |
| `TresorerieController.java.closeCashSession` | `POST /api/v1/compta/tresorerie` | `("/sessions-caisse/{sessionId}/cloture")` | `hasAuthority('PERM_tresorerie:view')` | 192 |
| `TresorerieController.java.operations` | `GET /api/v1/compta/tresorerie` | `("/operations")` | `hasAuthority('PERM_tresorerie:view')` | 205 |
| `TresorerieController.java.createTransfer` | `POST /api/v1/compta/tresorerie` | `("/operations/transferts")` | `hasAuthority('PERM_tresorerie:view')` | 230 |
| `TresorerieController.java.createAdjustment` | `POST /api/v1/compta/tresorerie` | `("/operations/ajustements")` | `hasAuthority('PERM_tresorerie:view')` | 241 |
| `TresorerieController.java.cancelOperation` | `POST /api/v1/compta/tresorerie` | `("/operations/{operationId}/annulation")` | `hasAuthority('PERM_tresorerie:view')` | 252 |
| `VehiculeController.java.search` | `GET /api/v1/vehicules` | `("/search")` | `hasAnyAuthority('PERM_vehicule:view', 'PERM_contrat:view', 'PERM_contrat:create', 'PERM_contrat:update')` | 22 |

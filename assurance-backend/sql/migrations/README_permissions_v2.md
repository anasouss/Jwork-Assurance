# Permission Catalogue V2

## Model

The assignable catalogue is `PermissionCatalog.java`: six modules, page/business
areas, and explicit actions. `PermissionDependencies` adds required read/workflow
access, not unrelated deletion, cancellation, renewal or financial capabilities.
Roles remain agency-owned. Treasury account assignments remain a separate check.

The role editor displays Production, Sinistre, Compagnies, CRM, Compta and
Administration. Each area lists its actions. Read-only users can inspect a role;
profile editing, role assignment and permission assignment are separate operations.
An administrator cannot delegate permissions they do not hold or assign platform
permissions to an agency role. Existing grants are not restored on application restart.

Shared selectors expose scoped options without granting access to full accounting
pages. Client/convention document lists are filtered by persisted origin in the
database; detail/PDF/cancel/delete endpoints check that same origin. Contract draft
endpoints check stored state: active correction requires modification, renewal
drafts require renewal, and normal drafts require creation or modification.

## Existing Database Deployment

1. Stop backend writers and review the old-to-new mapping in
   `20261114_permissions_restructure.sql` for the actual assigned roles.
2. Run that script against the intended MySQL database during maintenance.
   It preserves permission IDs and business/audit rows. It creates no backup tables.
3. Check the validation result sets and review each agency's sensitive grants.
4. Deploy the matching backend and frontend together; have users authenticate again.

Do not run the existing-database migration on an empty database. Fresh installation
uses the catalogue seeder and the initial bootstrap roles. Subsequent startups seed
metadata only; they do not repair or broaden existing role grants.

MySQL procedure DDL auto-commits. Catalogue/grant data updates are wrapped in
one transaction, with an advisory lock and rollback handler. No persistent migration
marker is stored. This is a manual one-time script: do not rerun it after roles have
been reviewed or edited, because legacy mappings could restore removed grants.
Temporary mapping tables contain only capability metadata and grant IDs and
disappear with the connection.

Unknown assigned permission codes, orphan links, duplicate codes, and agency roles
holding platform permissions stop the migration for explicit review. Retired
permission rows are retained, but their role links are removed. They no longer
produce runtime authorities.

## Deliberate Tightening

### Fleet Vehicle Excel Permissions

`contrat:import` and `contrat:export` are independent actions under Production >
Contrats. Import includes downloading the template and previewing the workbook;
it also requires the matching contract editing/renewal right. Export requires
consultation access and includes saved fleet vehicles and guarantees only.

For an existing V2 database, review and run
`20261114_fleet_vehicle_excel_permissions.sql` once before deploying this change.
It preserves previous Excel access for roles already holding the base permissions.
It creates no backups or persistent marker and does not modify business records.
Do not rerun the original full permissions migration. New installations use the
catalogue seeder; existing role grants are never broadened on application startup.
This incremental script has not been executed or database-tested locally.

Fleet Excel guarantee import is retained behind the application parameter
`ENABLE_FLEET_EXCEL_GUARANTEE_IMPORT`, default `false`. The existing parameter
service resolves an agency override before the global value. When disabled, the
import template omits the guarantee sheet, preview ignores guarantee sheets in
older files, and the frontend offers vehicle import only. Setting it to `true`
restores the guarantee sheet and review workflow. Saved-vehicle export is unchanged.
`20261114_fleet_excel_guarantee_import_setting.sql` registers the global default
without overwriting existing values; fresh installations seed the same setting.

- Old treasury read access migrates to read access only, not transfer, adjustment,
  cancellation or cash-session write actions that old endpoints accidentally allowed.
- Contract modification no longer implies contract/amendment deletion, amendment
  creation/rectification, or renewal. Assign those explicit actions when required.
- Client creation no longer implies group administration or document deletion.
- Old explicit management permissions expand once into their corresponding actions.
- General client documents and convention invoices have independent rights.
- Positive payment creation, outgoing ristourne settlement and adjustments are separate.
- A claim's read permission covers its complete dossier, including financial history;
  financial writes still require dedicated provision/operation permissions.

Keep this migration until deployment is confirmed. Execution against production and
browser verification are separate deployment steps, not implied by source checks.

## Verification Performed

- Frontend `npm run typecheck`: passed.
- Route authorization and help utilities: 157 tests passed.
- Static comparison: all 228 catalogue codes are present in the SQL; controller
  codes and declared cross-resource dependencies match the catalogue/migration.
- Diff whitespace check passed with `core.whitespace=cr-at-eol`; unrelated existing
  CRLF-only changes were left untouched.
- Backend Maven verification was interrupted; compilation and backend tests remain
  unverified. No further compilation was run after the user's instruction to stop.
- No production build, dev server, browser session or database migration was run.

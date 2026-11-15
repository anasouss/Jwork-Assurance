# Mobile And Client Portal Backend

## Scope

Backend APIs only. No React Native project, web account-management screens,
invitation flow, client self-registration, client uploads, payment actions,
push notifications, or automatic publication are introduced.

Employee and platform-admin mobile sessions reuse existing employee identities,
agency isolation, permissions and dashboards. Client portal accounts are separate
from employees and never receive employee roles or PERM_ authorities.

## Deployment

1. Review and apply `sql/migrations/20261115_client_portal_mobile.sql` before deploying.
   It adds six portal/security tables and a mobile channel flag to refresh_tokens.
   MySQL DDL auto-commits; the entire script is not transactional.
   Permission metadata and initial administrator grants are transactional.
   No backups, permanent migration markers, account creation or dossier grants.
2. The SQL explicitly delegates eight new CRM capabilities to existing platform
   SUPER_ADMIN and agency AGENCY_ADMIN roles that already have client:view.
   Review these grants. Custom roles are not expanded.
3. Existing browser refresh rows default to mobile=false and remain valid.
   Fresh databases use Hibernate table creation plus the existing catalogue/bootstrap
   seeders; production schema deployment must use the SQL.
4. Use HTTPS. Apply request-body limits and trusted-proxy/IP configuration at the
   gateway. Never trust an arbitrary forwarded IP header from the public internet.
5. Do not ship without running the focused security/repository/service tests and
   deployment checks. Compilation, tests and SQL execution have intentionally not
   been run during this implementation, following the user's standing instruction.

## Staff And Super Admin Mobile Authentication

`POST /api/v1/mobile/auth/login` accepts the existing employee login body:
`{"email":"...","password":"..."}`.

Response: `ApiResponse<{auth: AuthResponse, refreshToken: string}>`.
The existing AuthResponse supplies access token, expiry, role, agency context,
platformAdmin and permissions. The mobile client must derive available screens
from this response, never from a user-selected role or an unverified JWT payload.

`POST /api/v1/mobile/auth/refresh` and `POST /api/v1/mobile/auth/logout` accept
`{"refreshToken":"..."}`. No cookie is required or set. Browser and mobile refresh
channels cannot be exchanged. Existing session-management/password endpoints
continue to work with employee mobile bearer tokens.

Platform administrators use the existing `GET /api/v1/platform/dashboard` and
agency administration APIs, subject to their server-side checks. Agency staff use
the existing `GET /api/v1/dashboard` and their existing authorized APIs.
Platform dashboards do not require granting client portal access.

## Agency-Managed Client Accounts

Staff authenticate normally and use `/api/v1/client-accounts`:

| Method / Path | Capability | Purpose |
| --- | --- | --- |
| GET / | client-portal-account:view | Paginated agency account list |
| GET /{id} | client-portal-account:view | Agency-scoped account detail |
| POST / | client-portal-account:create | Create for an existing active client |
| PUT /{id}/active | client-portal-account:deactivate | Enable/disable |
| POST /{id}/password | client-portal-account:reset-password | Set temporary password |
| GET /{id}/access | client-portal-account:view | Paginated explicit dossier grants |
| POST /{id}/access | client-portal-account:assign | Grant or reactivate one dossier |
| DELETE /access/{id} | client-portal-account:assign | Revoke the dossier and its publications |

Account creation body:
`{"clientId":"55","identifiant":null,"password":"a-long-temporary-password"}`.

If omitted, identifier defaults to CIN for a person and RC for a company, then
passport/residence card where available. A verified staff-assigned identifier is
also possible. Identifiers are normalized to uppercase without whitespace.
One account per client per agency; login identifiers are unique within an agency.
The same CIN/RC in different agencies does not merge identities or share access.
An agency must verify the person/company representative's authority before handing
over credentials. RC identifies the company, not a particular human representative.

Passwords must contain at least 12 characters and fit BCrypt's 72-byte limit.
Only hashes are stored. Temporary passwords are never returned by these APIs.
The client must change the initial/reset password before any dossier access.
Disabled accounts/clients/agencies cannot authenticate or use existing sessions.
Reset and account disable revoke all client sessions.

Access body is exactly one of `{"contratId":"69"}` or `{"sinistreId":"12"}`.
The sharing employee must also hold contrat:view or sinistre:view as appropriate.
Targets must belong to the current agency; drafts/prospection are not shareable.
Sharing is an explicit disclosure decision, not inferred from payer, client group,
family relationship, phone number, RC or CIN. Staff must verify entitlement.
Sharing a fleet authorizes the whole dossier, not just one employee's vehicle.
Claims require a separate grant; sharing a contract does not expose every claim.
Revocation preserves history. Explicitly reactivating the same grant makes its
previously published content visible again.

## Explicit Publications

Under `/api/v1/client-accounts`:

| Method / Path | Capability | Purpose |
| --- | --- | --- |
| GET /access/{id}/documents | client-portal-publication:view | Published/withdrawn documents |
| GET /access/{id}/updates | client-portal-publication:view | Published/withdrawn claim messages |
| POST /access/{id}/documents | client-portal-publication:create | Publish an existing source file |
| DELETE /documents/{id} | client-portal-publication:deactivate | Withdraw publication, keep source |
| POST /access/{id}/updates | client-portal-publication:create | Publish a client-facing claim message |
| DELETE /updates/{id} | client-portal-publication:deactivate | Withdraw message |

Document body: `{"pieceJointeId":"123","titre":"Police automobile"}` for a contract,
or `{"sinistreDocumentId":"45","titre":"Document du dossier"}` for a claim.
The source must belong to the shared dossier and agency. Publication also requires
the corresponding dossier read right. Existing financial/PDF endpoints are not
exposed wholesale; staff can publish appropriate files stored as dossier attachments.
Published source rows remain referenced; withdraw publication before deleting a
source file. Withdrawing detaches the reference while retaining publication/audit
history. Archived or missing source files cannot be downloaded through the portal.

Claim message body: `{"titre":"Expertise programmée","message":"..."}`.
Messages are plain text explicitly written for the recipient. Never copy confidential
notes or third-party information. Internal history, financial estimates, commissions,
responsibility analysis and staff notes are not returned by client DTOs.
Sensitive account/share/publication changes are recorded in the existing audit store;
passwords and refresh secrets are not included in explicit audit snapshots.

## Client Authentication

`POST /api/v1/client-portal/auth/login`:
`{"agenceCode":"AG-001","identifiant":"AB123456","password":"..."}`.

Response: `ApiResponse<{accessToken,refreshToken,tokenType,expiresIn,profile}>`.
Profile contains the account ID, client display name, agency name/code/telephone
and passwordChangeRequired. It contains no employee role or permissions.

- POST /auth/refresh: `{"refreshToken":"..."}`; rotates the token.
- POST /auth/logout: same body; revokes the session.
- GET /auth/me: bearer-protected profile.
- POST /auth/password: `{"currentPassword":"...","newPassword":"..."}`.
  Changing the password revokes every session, including the current one.
  Discard both tokens and log in again.

Use only these client tokens for the portal. They cannot call employee/admin APIs,
even if a client account ID numerically matches an employee ID.
There is no public account-registration or identity-lookup endpoint.
Invalid account/password/agency responses use a generic authentication error.
Ten invalid passwords lock an account for 15 minutes.

## Client Read APIs

All below are GET-only and require a client bearer token plus completion of the
temporary-password change. Pagination is zero-based: page=0, size=25, max size=100.
Responses use ApiResponse and the shared PagedResponse/PageMetadata contract.

- /api/v1/client-portal/dashboard: shared contract/claim counts, active contracts,
  active contracts expiring in 30 days and open claims.
- /contracts: shared, non-draft/non-prospection contract summaries.
- /contracts/{id}: contract summary and paginated current vehicles.
- /contracts/{id}/coverages: paginated active coverage labels, target IDs,
  capitals and franchises; no internal premium calculations.
- /contracts/{id}/assistances: paginated active assistance references/company/product/dates.
- /claims and /claims/{id}: curated public statuses, policy reference and business dates.
- /claims/{id}/updates: only explicitly published messages for that account.
- /documents: only explicitly published, currently accessible files.
- /documents/{id}/download: ownership and publication checked again before storage lookup.

IDs in paths are source contract/claim IDs, not grant IDs. Document IDs are publication
IDs, never source storage IDs. Treat API IDs as opaque strings on mobile as in the
existing web application. Business dates are YYYY-MM-DD; do not timezone-shift them.
Amounts are authoritative server BigDecimal values; do not recalculate them in the app.

Public claim statuses: EN_COURS, DOCUMENTS_EN_ATTENTE, TRANSMIS, EXPERTISE,
REGLEMENT_EN_COURS, REGLE, CLOTURE, REFUSE, ANNULE. They deliberately do not expose
the full internal history or financial amounts. No prior progress is invented.

## Mobile Security And Operations

Store refresh tokens in iOS Keychain / Android Keystore-backed secure storage,
not AsyncStorage. Keep access tokens in memory, redact secrets from logs, perform
refresh single-flight, and atomically replace the rotated token before retrying.
Replaying a revoked client refresh token revokes all sessions for that client account.
Authenticated responses/downloads are no-store; do not persist dossiers offline by
default. Clear caches and credentials on logout and account changes.

POST mobile/client authentication requests share a database-backed per-IP limit
(default 30/minute; app.security.mobile-auth-requests-per-minute). It uses the trusted
server remote address, not arbitrary X-Forwarded-For input. Apply compatible gateway
limits, especially for deployments behind a reverse proxy. Stale throttle buckets
are pruned; expired session retention should be maintained operationally.

## Verification Scope

Added focused tests cover identifier/password handling, initial password restrictions,
refresh rotation/replay, account disable/reset, read-only HTTP boundaries,
client/employee isolation, explicit grants, cross-agency/account denial, hidden
drafts, publication withdrawal, source ownership and separate browser/mobile channels.
These tests are source additions, NOT a claim of successful execution.

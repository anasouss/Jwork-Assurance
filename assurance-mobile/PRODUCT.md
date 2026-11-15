# Assurance Mobile

French-language, read-only companion to the existing insurance platform. This
first release targets Android and iPhone, not tablets or a public web portal.

## People And Boundaries

- One login form accepts an identifier and password. Clients use CIN/RC (or a
  globally unique agency-assigned portal identifier); staff use email. The server
  determines the authenticated space and agency. The agency creates accounts. No registration, uploads, editing,
  payments or internal notes. Only explicitly shared dossiers and publications.
- Agency employees use their existing email/password. Existing backend permissions
  govern dashboards, contracts, clients and claims. No operational writes.
- Platform administrators monitor portfolio figures and agencies. They do not
  enter an agency's operational context from the mobile application.

Password change and session logout are security actions, not dossier editing.
First-use client password change is required before dossier access.

## Workflows

Login -> server-selected space -> dashboard -> paginated lists -> dossier detail.
Clients can view current vehicles, guarantees, assistance, public claim updates
and published documents. Employee contract details include movement history.
Platform monitoring can focus on one agency without switching tenant context.
Light/dark/system appearance, pull-to-refresh, explicit errors and empty states.

## Authority

Existing backend APIs, tenant rules, permissions and financial totals remain the
source of truth. No invented data, offline dossier database or mobile-specific
permission grants. The portal feature switch is enforced on the backend.

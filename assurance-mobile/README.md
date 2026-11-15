# Assurance Mobile

React Native / Expo application for three **read-only** spaces: clients, agency
employees and platform administrators. The server decides the space and access.
No public signup, operational editing, uploads or payments.

## Setup

Node 22.13+ on the 22 line, 24.3+ on the 24 line, or a supported newer Node release,
and npm (see `package.json` engines). Install with `npm install` inside this directory (then commit
the generated lockfile and use `npm ci` for subsequent reproducible installs). Configure a local
`.env` from `.env.example` with `EXPO_PUBLIC_API_URL` ending in `/api/v1`.
This URL is public build configuration, never a secret. Do not put passwords,
JWT signing keys or privileged API keys in an Expo environment variable.

Use your computer's LAN address for a physical device, `10.0.2.2` for the standard
Android emulator, or localhost for an iOS simulator on the backend host. Local HTTP
is allowed only in development JavaScript; release builds reject non-HTTPS URLs.
If the device OS blocks local HTTP, use a trusted HTTPS development endpoint.

Commands (not started automatically):

```sh
npm run android       # Android SDK/JDK 17 and an emulator or USB device
npm run ios           # macOS, Xcode and simulator/device
npm start             # Metro for Expo Go SDK 58
npm run start:dev-client # Metro for an installed development build
npm run typecheck
```

This baseline pins the official SDK 58 template's React/React Native versions;
native packages match its compatibility manifest. `npm start` targets Expo Go
SDK 58. A custom development build remains available with `npm run android` /
`npm run ios` and `npm run start:dev-client`. Android package / iOS bundle IDs in `app.config.ts`
are placeholders to finalize before store signing. Store credentials, signing,
production server URL, app icon/splash artwork and privacy disclosures are release
configuration; none is fabricated here.

## Screen Map

- Client: home counts, shared contracts, current vehicles/guarantees/assistance,
  shared claims and agency-published messages, published documents, account/theme.
- Employee: authorized agency dashboard, contract search/details and movements,
  claim search/details, client search/details, account/theme.
- Platform: portfolio dashboard, agency directory, scoped agency dashboard, account.
- Security: login, restore/retry, required initial client password change, password
  change and logout. All three spaces support system/light/dark appearance.

No mobile agency-context switch. Platform agency monitoring passes an agency
filter only to the existing platform dashboard; it does not impersonate employees.
Client movements/history remain deliberately out of scope, as previously agreed.

## Backend Prerequisites

Deploy `POST /api/v1/mobile/auth/sign-in` and apply
`assurance-backend/sql/migrations/20261115_unified_mobile_login.sql` before the
updated backend starts. It validates existing accounts and adds global portal
identifier uniqueness without rewriting client records or merging agencies.
Conflicts stop the migration and must be resolved explicitly. Fresh databases
receive the unique constraint from the entity mapping.

The login form sends `{identifiant,password}` only. The backend selects the
employee-email or client-identifier authentication namespace, checks credentials,
and returns `principalType` with the appropriate session. The app never tries
multiple login endpoints or asks the user to choose a role or agency. Existing
principal-specific refresh, logout and password endpoints remain in use.

Deploy the existing mobile/client portal backend and its previously supplied SQL.
Enable `ENABLE_CLIENT_PORTAL` for the intended agency and provision a client account
and explicit dossier/publication grants using the web CRM. Employee login and
platform monitoring do not depend on that portal feature switch. No new mobile
tables or permission grants are introduced by this app; the login change adds
only the unique constraint described above.

This change also adds optional `contratId` / `sinistreId` document-list filters and
`immatriculation` on public coverage DTOs. Deploy the backend changes with the app;
the previous portal API accepted but ignored those filter query parameters.

## Security And Storage

- Refresh token and principal channel only in device-only SecureStore. Access token
  and permissions remain in memory; startup rotates refresh tokens with the server.
- Single-flight refresh and serialized keychain writes protect token rotation.
  Browser cookies are never used. No tokens in URLs, logs or AsyncStorage.
- Backend permission/tenant checks are authoritative. Client JWTs never call staff
  APIs. Data is validated with Zod and identifiers are normalized at the boundary.
- Query cache is memory-only, account/agency-scoped, cleared on logout. No dossier
  persistence or offline database. Unavailable networks produce a retry state.
- Published files use authenticated requests, MIME allowlists and a 32 MB client
  limit, private cache and the OS sharing sheet. Temporary files are removed after
  sharing and at account changes. Copies exported to another app are controlled
  by that app and cannot be revoked by this client.
- No telemetry, push registration, advertising SDK, camera or microphone request.

## Release Verification Still Required

Use real authorized test accounts against a staging backend, not production data.
Verify all three spaces; initial password change; refresh/revocation; disabled
portal; cross-agency/account denials; forced logout; document withdrawal; network
loss; pagination; empty results; and large fleets. Native simulator/device captures
must cover light/dark, large fonts, keyboard and safe areas. Browser rendering is
not a substitute. No emulator/native build or end-to-end login was run here.

References: [Expo SDK 58](https://docs.expo.dev/versions/v58.0.0/),
[official template](https://github.com/expo/expo/tree/sdk-58/templates/expo-template-default),
[protected routes](https://docs.expo.dev/router/advanced/protected/),
[SecureStore](https://docs.expo.dev/versions/v58.0.0/sdk/securestore/),
[FileSystem](https://docs.expo.dev/versions/v58.0.0/sdk/filesystem/).

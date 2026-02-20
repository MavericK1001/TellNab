# Support 2.0 Replacement Plan (Implemented)

## 1) Legacy Support Decommission (Safe)

### Legacy items identified

- Legacy API routes in [server/index.js](server/index.js):
  - `/api/support/*`
  - `/api/admin/support/*`
- Legacy support frontends:
  - [support-site/index.html](support-site/index.html)
  - [support-site/app.js](support-site/app.js)
  - [support-site-react/src/App.tsx](support-site-react/src/App.tsx)

### Safe removal strategy applied

- Legacy support routes are now gated by `ENABLE_LEGACY_SUPPORT` in [server/index.js](server/index.js).
- Default behavior is disabled (`false`) to prevent old system access.
- No destructive table drop is auto-executed.
- Optional cleanup migration is provided and manual-only:
  - [modules/Support/Database/Migrations/20260220_000002_drop_legacy_support_tables_safe.sql](modules/Support/Database/Migrations/20260220_000002_drop_legacy_support_tables_safe.sql)

This keeps rollback simple: set `ENABLE_LEGACY_SUPPORT=true`.

## 2) Support 2.0 Modular Architecture

Support 2.0 is isolated under:

- [modules/Support](modules/Support)
  - [modules/Support/Controllers](modules/Support/Controllers)
  - [modules/Support/Models](modules/Support/Models)
  - [modules/Support/Services](modules/Support/Services)
  - [modules/Support/Repositories](modules/Support/Repositories)
  - [modules/Support/Policies](modules/Support/Policies)
  - [modules/Support/Routes](modules/Support/Routes)
  - [modules/Support/Database/Migrations](modules/Support/Database/Migrations)
  - [modules/Support/Database/Seeders](modules/Support/Database/Seeders)
  - [modules/Support/UI](modules/Support/UI)

Entry point:

- [modules/Support/index.js](modules/Support/index.js)

## 3) Subdomain-based Module Loading

Implemented in [server/index.js](server/index.js):

- `SUPPORT_SUBDOMAIN` host check
- Support middleware group (`req.context.module = "SUPPORT_2_0"`)
- Support module mounted only when request host matches `support.tellnab.com`

Result:

- `support.tellnab.com` → Support 2.0 routes active
- main domain → main app routes only

## 4) Environment & Configuration

Added configuration variables:

- `SUPPORT_SUBDOMAIN`
- `ENABLE_LEGACY_SUPPORT`
- `AUTH_COOKIE_DOMAIN`

Updated files:

- [.env.example](.env.example)
- [config/local/server.env](config/local/server.env)
- [config/live/server.env](config/live/server.env)

Cookie/session compatibility:

- Auth cookie options now support cross-subdomain domain via `AUTH_COOKIE_DOMAIN` in [server/index.js](server/index.js).

## 5) Database Migrations for Support 2.0

Fresh module migration for requested tables:

- [modules/Support/Database/Migrations/20260220_000001_create_support2_core_tables.sql](modules/Support/Database/Migrations/20260220_000001_create_support2_core_tables.sql)

Includes:

- `tickets`
- `ticket_messages`
- `ticket_internal_notes`
- `departments`
- `tags`
- `ticket_tags`

Seeder added:

- [modules/Support/Database/Seeders/20260220_seed_support_roles_permissions.js](modules/Support/Database/Seeders/20260220_seed_support_roles_permissions.js)

## RBAC Roles (Support 2.0)

- `customer`
- `agent`
- `senior_agent`
- `manager`
- `admin`

Policy + permission guards are in:

- [modules/Support/Policies/permissionPolicy.js](modules/Support/Policies/permissionPolicy.js)

## Operational Rollback

1. Set `ENABLE_LEGACY_SUPPORT=true`.
2. Keep Support 2.0 loaded on subdomain only.
3. Do not run legacy drop migration until migration verification is complete.

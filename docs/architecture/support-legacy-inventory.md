# Legacy Support Inventory (for safe removal)

## Legacy API surface

Defined in [server/index.js](server/index.js):

- `/api/support/tickets`
- `/api/support/tickets/status`
- `/api/support/agent/me`
- `/api/support/agent/tickets`
- `/api/support/agent/tickets/:id`
- `/api/support/agent/tickets/:id/replies`
- `/api/support/tickets/:id/thread`
- `/api/support/tickets/:id/replies`
- `/api/support/tickets/:id/close`
- `/api/admin/support/tickets`
- `/api/admin/support/tickets/:id`

Status: Wrapped behind `ENABLE_LEGACY_SUPPORT` toggle in [server/index.js](server/index.js).

## Legacy frontend assets

- [support-site/index.html](support-site/index.html)
- [support-site/app.js](support-site/app.js)
- [support-site/styles.css](support-site/styles.css)
- [support-site/status.html](support-site/status.html)
- [support-site/status.js](support-site/status.js)
- [support-site-react/src/App.tsx](support-site-react/src/App.tsx)

## Legacy support artifacts

- [tellnab-support-dist.zip](tellnab-support-dist.zip)
- [patches/support-inbox.patch](patches/support-inbox.patch)
- [patches/support-system-full.patch](patches/support-system-full.patch)

## Optional cleanup order

1. Confirm no traffic on legacy endpoints.
2. Keep `ENABLE_LEGACY_SUPPORT=false` for at least one release cycle.
3. Archive legacy UI files.
4. Execute optional SQL cleanup in [modules/Support/Database/Migrations/20260220_000002_drop_legacy_support_tables_safe.sql](modules/Support/Database/Migrations/20260220_000002_drop_legacy_support_tables_safe.sql).

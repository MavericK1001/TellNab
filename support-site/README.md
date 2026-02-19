# TellNab Support Subdomain

This folder is a standalone static support portal intended for deployment at:

- https://support.tellnab.com

## Features

- Public support request form
- Dedicated public status page: `status.html`
- Supports request types: `INQUIRY`, `ISSUE`, `SUGGESTION`
- Ticket priorities with SLA labels: `URGENT` (4h), `NORMAL` (24h), `LOW` (72h)
- Submits to backend endpoint: `/api/support/tickets`
- Public status section for outages/incidents/maintenance windows
- Help center article cards with screenshot assets
- Query-prefill support for in-app report links (`type`, `pageUrl`, `subject`)
- Includes a "suggestions we can implement" section for product planning

## Deployment

Upload the contents of this folder to your support subdomain hosting.

If the API origin is not `https://tellnab.onrender.com/api`, set this before loading `app.js`:

```html
<script>
  window.SUPPORT_API_BASE = "https://your-api-domain.com/api";
</script>
```

Then load:

```html
<script src="./app.js" type="module"></script>
```

## Backend endpoints used

- `POST /api/support/tickets` (public)
- `GET /api/admin/support/tickets` (moderator/admin)
- `PATCH /api/admin/support/tickets/:id` (moderator/admin)

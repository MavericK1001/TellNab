# TellNab Support Subdomain

This folder is a standalone static support portal intended for deployment at:

- https://support.tellnab.com

## Features

- Public support request form
- Supports request types: `INQUIRY`, `ISSUE`, `SUGGESTION`
- Submits to backend endpoint: `/api/support/tickets`
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

# Support 2.0 UI Refactor Migration Notes

## Scope

- Frontend-only refactor for support.tellnab.com
- Existing backend routes preserved
- Existing auth flow (cookie + bearer fallback) preserved
- Existing ticket APIs preserved

## New Frontend Architecture

### Entry

- `support-site-react/src/main.tsx` now mounts routed `SupportApp`
- `support-site-react/src/SupportApp.tsx` adds:
  - `/login`
  - `/dashboard`
  - role-based rendering
  - lazy-loaded pages

### Service Layer

- `support-site-react/src/services/supportApi.ts`
  - centralized API base fallback and auth handling
  - session + token handling
  - ticket CRUD calls
  - admin role control adapters

### Reusable Components

- Layout:
  - `support-site-react/src/components/layout/Sidebar.tsx`
  - `support-site-react/src/components/layout/Header.tsx`
- Common:
  - `support-site-react/src/components/common/StatCard.tsx`
  - `support-site-react/src/components/common/StatusBadge.tsx`
  - `support-site-react/src/components/common/MessageBubble.tsx`
  - `support-site-react/src/components/common/Skeleton.tsx`
- Ticket:
  - `support-site-react/src/components/tickets/TicketCard.tsx`
  - `support-site-react/src/components/tickets/ChatWindow.tsx`
- Internal agent chat:
  - `support-site-react/src/components/agent-chat/AgentChatWidget.tsx`

### Pages

- `support-site-react/src/pages/LoginPage.tsx`
- `support-site-react/src/pages/DashboardPage.tsx`

## Role-Based Dashboards

- `MEMBER` -> User dashboard
- `SUPPORT_MEMBER` / `MODERATOR` -> Agent dashboard
- `ADMIN` -> Admin dashboard

## Admin Role Control Integration

- Role fetch: `GET /api/roles` (dynamic)
- Role update: tries `PATCH /api/users/:id/role`, falls back to existing `PATCH /api/admin/users/:id/role`
- User listing uses existing `GET /api/admin/users`

## Internal Agent Chat

- Floating chat panel for support/admin roles
- WebSocket endpoint from `window.SUPPORT_AGENT_CHAT_WS_URL`
- Presence list + 1-to-1 DM event model
- Unread badge and sound ping
- Isolated module, no ticket API interference

## Styling

- `support-site-react/src/styles.css` extended for:
  - dark SaaS layout
  - sticky topbar
  - responsive sidebar
  - stat cards
  - status/priority badges
  - skeleton states
  - empty states
  - ticket chat bubbles
  - floating agent chat

## Notes

- Existing `support-site-react/src/AppV2.tsx` is retained as legacy fallback reference but no longer mounted.
- Build command unchanged: `npm run build:support`

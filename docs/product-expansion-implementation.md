# TellNab Product Expansion – Initial Implementation

## 1) New database fields and models

### Extended `Advice`

- `visibility` (`PUBLIC` | `PRIVATE`, default `PUBLIC`)
- `isCrisisFlagged` (bool)
- `crisisKeywords` (JSON string)
- `helpfulCount` (int)
- `viewCount` (int)
- `priorityTier` (`NORMAL` | `PRIORITY` | `URGENT`)
- `priorityScore` (int)

### Extended `AdviceComment`

- `messageType` (`TEXT` | `VOICE`)
- `audioUrl`
- `audioDurationSec`
- `transcript`

### Extended `User`

- Relations for advisor, reactions, saves, and priority orders:
  - `advisorProfile`
  - `advisorFollowers`
  - `followedAdvisors`
  - `adviceReactions`
  - `savedAdvices`
  - `priorityOrders`

### New models

- `AdviceReaction` (helpful reactions)
- `SavedAdvice` (saved advice list)
- `AdvisorProfile` (verified advisor profile/stats)
- `AdvisorFollow` (follow advisors)
- `AdvicePriorityOrder` (payment-ready priority queue)

### Migration

- `prisma/migrations/20260221120000_product_expansion_core/migration.sql`

---

## 2) New API routes

### Public feed + engagement

- `GET /api/public/feed` (cursor-based, trending/latest, category/query)
- `POST /api/advice/:id/reactions/helpful`
- `POST /api/advice/:id/views`

### Priority advice

- `POST /api/advice/:id/priority/checkout`

### Advisor system

- `GET /api/advisors`
- `GET /api/advisors/:userId`
- `POST /api/advisors/:userId/follow`
- `DELETE /api/advisors/:userId/follow`

### Saved advice + dashboard

- `GET /api/advice/saved`
- `POST /api/advice/:id/save`
- `DELETE /api/advice/:id/save`
- `GET /api/dashboard/summary`

### Voice + safety behavior on existing route

- `POST /api/advice/:id/comments` now supports voice payload
- Crisis keyword detection flags urgent moderation queue

### Realtime notifications

- Notification creation now emits socket event:
  - `notification_received`

---

## 3) New frontend pages

- `src/pages/AdvisorProfile.tsx` (public advisor profile + follow)

---

## 4) Reusable components created

- `src/components/MobileBottomNav.tsx` (mobile-first bottom nav)

---

## 5) Migration steps

1. Run Prisma migration:
   - `npx prisma migrate deploy` (production)
   - or `npx prisma migrate dev` (local)
2. Regenerate Prisma client:
   - `npx prisma generate`
3. Deploy backend with new routes and feature flags.
4. Deploy frontend (new feed, advisor profile, voice UI, mobile nav).
5. Optional backfill:
   - Existing approved advice rows remain compatible via defaults.

---

## 6) Feature flags for gradual rollout

Backend env flags in `server/index.js`:

- `FEATURE_PUBLIC_FEED_V2` (default `true`)
- `FEATURE_ADVISOR_PROFILES` (default `true`)
- `FEATURE_PRIORITY_ADVICE` (default `true`)
- `FEATURE_REALTIME_NOTIFICATIONS` (default `true`)
- `FEATURE_VOICE_REPLIES` (default `true`)
- `FEATURE_CRISIS_DETECTION` (default `true`)

Set any flag to `false` for staged rollout.

---

## 7) Phase 1 core differentiators (production-safe extension)

### Additive fields

- `Advice.tags` (nullable JSON string)
- `Advice.targetAudience` (nullable string)
- `Advice.isUrgent` (bool default `false`)
- `AdvisorProfile.helpfulCount` (int default `0`)
- `AdvisorProfile.level` (string default `NEW`)
- `AdvisorProfile.levelScore` (int default `0`)
- `AdvisorProfile.statsUpdatedAt` (nullable datetime)
- `AdvisorProfile.lastActiveAt` (nullable datetime)

### Additive model

- `AdviceAdvisorMatch` (cache table for ranked advisor matches with expiry)

### Migration script

- `prisma/migrations/20260221170000_phase1_core_differentiators/migration.sql`

### Required Phase 1 flags

- `PHASE1_SMART_MATCHING` (default `false`)
- `PHASE1_ADVISOR_LEVELS` (default `false`)
- `PHASE1_URGENT_MODE` (default `false`)
- `PHASE1_SHARE_CARDS` (default `false`)

### Migration and deploy order (zero-downtime)

1. Deploy DB migration (`db push`/`migrate deploy`) before enabling flags.
2. Regenerate Prisma client against live schema.
3. Deploy backend and frontend with all Phase 1 flags still `false`.
4. Enable flags incrementally and monitor logs/metrics.

### Rollback

- Turn Phase 1 flags back to `false`.
- Keep additive columns/tables in place (no destructive rollback needed).
- Redeploy previous backend/frontend artifact if required.

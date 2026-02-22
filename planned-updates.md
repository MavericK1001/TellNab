# TellNab Planned Updates

Last updated: 2026-02-23
Owner: Product + Engineering

## How this file is used
- This is the single planning source for upcoming features.
- Every time we discuss new plans, this file gets updated.
- Only items marked **Ready** should move into implementation.

---

## Planning Status Legend
- **Backlog**: idea captured
- **Planned**: scoped and approved direction
- **Ready**: ready for implementation
- **In Progress**: currently being built
- **Done**: shipped

---

## 1) Feed Evolution (Instagram-style)
Status: **Planned**
Priority: **High**

### Goal
Create a highly engaging, creator-first feed experience similar to modern social products.

### Planned scope
- Media-first feed cards (image/video-first hierarchy)
- Improved creator identity blocks (avatar, badges, credibility)
- Better interactions: like/helpful, comment, share, save
- Smooth infinite scroll and stronger content ranking signals
- Mobile-optimized feed behavior and interaction density

### Success metrics
- Increased session time on feed
- Higher interaction rate per post
- More replies/helpful actions per active user

---

## 2) Creator Monetization System
Status: **Planned**
Priority: **High**

### Goal
Enable users/advisors to earn through their content and trust signal quality.

### Planned phased rollout
#### Phase A (MVP)
- Tips/support payments to creators
- Creator earnings wallet view
- Basic payout request flow

#### Phase B
- Subscriptions (monthly support)
- Premium answer unlocks
- Better creator analytics

#### Phase C
- Payout compliance checks
- Fraud/risk controls
- Dispute/review workflow

### Dependencies
- Wallet + transaction ledger expansion
- Payment provider integration
- Admin moderation for monetization abuse controls

---

## 3) Premium UI Direction
Status: **In Progress**
Priority: **High**

### Goal
Position TellNab as premium, trusted, and category-leading.

### Current progress
- Global palette refinement and premium dark styling updates are applied.
- Hero messaging improved with stronger positioning.
- Shared component polish completed (buttons/cards/base glow system).

### Next polish pass (planned)
- Make feed cards more editorial/premium
- Improve typography rhythm and spacing consistency
- Add subtle premium micro-interactions

---

## 4) Support Email Reliability
Status: **In Progress**
Priority: **High**

### Goal
Reliable user notification when support replies.

### Current progress
- Support reply email flow implemented in legacy + support v2 paths.
- SMTP mode + diagnostics added.
- Render trust-proxy related issue handled.

### Remaining plan
- Finalize stable SMTP delivery route
- Validate provider connectivity in production
- Keep fallback strategy documented

---

## 5) Working Agreement
Status: **Active**

- New plan decisions must be added here immediately.
- Implementation starts only when item status is **Ready**.
- This file should be kept concise, actionable, and up to date.

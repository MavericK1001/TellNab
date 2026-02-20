-- SUPPORT 2.0 legacy cleanup (SAFE / OPTIONAL)
-- Run only after verifying no traffic to legacy endpoints and successful data migration.
-- Keep disabled by default for rollback safety.

-- 1) Create archive backups first (example)
-- CREATE TABLE support_ticket_archive AS SELECT * FROM support_ticket;
-- CREATE TABLE support_ticket_message_archive AS SELECT * FROM support_ticket_message;

-- 2) Optional drop (manual execution only)
-- DROP TABLE IF EXISTS support_ticket_message;
-- DROP TABLE IF EXISTS support_ticket;

-- datetime(6) matches the Hibernate mapping for Instant (see 20260907_last_seen.sql).
ALTER TABLE credentials ADD COLUMN last_login_at datetime(6) NULL;
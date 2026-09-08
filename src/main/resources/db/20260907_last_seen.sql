-- datetime(6) matches the Hibernate mapping for Instant. MySQL TIMESTAMP would apply
-- session-timezone conversion on top of Hibernate's UTC normalisation and drop the
-- microseconds, shifting the login times shown to admins.
ALTER TABLE credentials ADD COLUMN last_seen_at datetime(6) NULL;
CREATE INDEX idx_credentials_last_seen_at ON credentials (last_seen_at);

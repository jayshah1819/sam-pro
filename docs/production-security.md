# Production Security Baseline

## Database migrations

`spring.jpa.hibernate.ddl-auto` defaults to `validate`; Hibernate must never mutate a production schema. Apply the dated SQL files under `src/main/resources/db` through a reviewed migration job before deploying application code.

For a multi-instance deployment, replace the current dated SQL runner with Flyway or Liquibase and record migration checksums in the deployment pipeline. Do not set `JPA_DDL_AUTO=update` in production.

## Secrets and JWT rotation

Set `DB_URL`, `DB_USERNAME`, `DB_PASSWORD`, `JWT_SECRET`, and `JWT_EXPIRATION_MS` through the platform secret manager. Do not commit `.env` files or secrets to source control. `JWT_SECRET` must be a base64-encoded HMAC key with at least 256 bits of entropy.

For key rotation, deploy a verifier that accepts the current and previous key by `kid`, issue new tokens with the current key, wait for the maximum token lifetime, then retire the previous key. Rotation is an operational deployment step and should be handled by the secret manager, not hard-coded in the repository.

## Authentication controls

Public registration is disabled by default with `AUTH_REGISTRATION_ENABLED=false`. Login and registration have bounded in-memory throttling for a single instance. In a multi-instance deployment, move these counters to Redis or enforce equivalent limits at the API gateway/WAF.

Use HTTPS, configure a single trusted `CORS_ALLOWED_ORIGIN`, keep access tokens short-lived, and revoke/rotate signing keys when compromise is suspected.

## Authorization and tenant isolation

Credentials and role changes are tenant-scoped. Every authenticated request reloads the credential role from the database and verifies the token tenant matches the credential tenant. Continue adding tenant predicates to every repository/native query introduced in new features.

## Required deployment checks

- Run backend compile and tests before deployment.
- Apply database migrations before starting an application with `ddl-auto=validate`.
- Verify CORS allows only the deployed frontend origin.
- Verify logs do not contain passwords, tokens, or raw authorization headers.
- Run authenticated tenant-isolation tests for reads and writes, including role updates and license/contract relationships.

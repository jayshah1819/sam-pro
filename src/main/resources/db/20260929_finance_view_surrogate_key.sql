-- One software code can now have several finance_view rows (one per Cost Code
-- line item, as imported from the source spreadsheet's "Detailed"/"Other
-- Software" sheets), so software_code alone can no longer be the primary key.
-- Switch to a surrogate auto-increment id; software_code + cost_code becomes
-- the natural (non-enforced-for-NULL) uniqueness within a tenant.
ALTER TABLE finance_view
  DROP PRIMARY KEY,
  ADD COLUMN id BIGINT NOT NULL AUTO_INCREMENT FIRST,
  ADD PRIMARY KEY (id);

ALTER TABLE finance_view
  ADD INDEX idx_finance_view_software_code (software_code),
  ADD UNIQUE INDEX uq_finance_view_tenant_code_costcode (tenant_id, software_code, cost_code);

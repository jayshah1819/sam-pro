CREATE TABLE software_costs (
    cost_id INT NOT NULL AUTO_INCREMENT,
    tenant_id BIGINT NOT NULL,
    software_id INT NOT NULL,
    software_name VARCHAR(255) NULL,
    cost_month DATE NOT NULL,
    amount DECIMAL(15,2) NOT NULL,
    notes TEXT NULL,
    PRIMARY KEY (cost_id),
    INDEX idx_software_costs_tenant_id (tenant_id),
    INDEX idx_software_costs_software_id (software_id)
);

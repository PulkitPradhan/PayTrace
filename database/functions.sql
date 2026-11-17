-- ============================================================================
-- PayTrace: Stored Functions (Phase 2)
-- Database Engine: MariaDB / MySQL
-- ============================================================================

DELIMITER //

-- ----------------------------------------------------------------------------
-- Function: fn_calculate_daily_rate
-- Purpose: Computes pro-rata daily salary rate based on gross earnings and working days.
-- ----------------------------------------------------------------------------
DROP FUNCTION IF EXISTS `fn_calculate_daily_rate`//
CREATE FUNCTION `fn_calculate_daily_rate`(
    p_monthly_gross DECIMAL(10,2),
    p_working_days INT
)
RETURNS DECIMAL(10,2)
DETERMINISTIC
NO SQL
BEGIN
    IF p_working_days IS NULL OR p_working_days <= 0 THEN
        RETURN 0.00;
    END IF;
    RETURN ROUND(p_monthly_gross / p_working_days, 2);
END//

-- ----------------------------------------------------------------------------
-- Function: fn_calculate_monthly_tds
-- Purpose: Computes monthly tax deducted at source based on progressive academic slabs.
-- Slabs:
--   - Up to $300,000 annual: 0%
--   - $300,001 to $600,000: 5% of excess over 300,000
--   - $600,001 to $1,200,000: $15,000 + 10% of excess over 600,000
--   - Above $1,200,000: $75,000 + 20% of excess over 1,200,000
-- ----------------------------------------------------------------------------
DROP FUNCTION IF EXISTS `fn_calculate_monthly_tds`//
CREATE FUNCTION `fn_calculate_monthly_tds`(
    p_annual_gross DECIMAL(10,2)
)
RETURNS DECIMAL(10,2)
DETERMINISTIC
NO SQL
BEGIN
    DECLARE v_annual_tax DECIMAL(10,2) DEFAULT 0.00;

    IF p_annual_gross IS NULL OR p_annual_gross <= 300000.00 THEN
        SET v_annual_tax = 0.00;
    ELSEIF p_annual_gross <= 600000.00 THEN
        SET v_annual_tax = (p_annual_gross - 300000.00) * 0.05;
    ELSEIF p_annual_gross <= 1200000.00 THEN
        SET v_annual_tax = 15000.00 + ((p_annual_gross - 600000.00) * 0.10);
    ELSE
        SET v_annual_tax = 75000.00 + ((p_annual_gross - 1200000.00) * 0.20);
    END IF;

    RETURN ROUND(v_annual_tax / 12.0, 2);
END//

DELIMITER ;

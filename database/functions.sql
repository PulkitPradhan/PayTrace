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
    p_monthly_gross DECIMAL(12,2),
    p_working_days INT
)
RETURNS DECIMAL(10,2)
DETERMINISTIC
NO SQL
BEGIN
    IF p_monthly_gross IS NULL OR p_monthly_gross < 0.00 OR p_working_days IS NULL OR p_working_days <= 0 THEN
        RETURN 0.00;
    END IF;
    RETURN ROUND(p_monthly_gross / p_working_days, 2);
END//

-- ----------------------------------------------------------------------------
-- Function: fn_calculate_monthly_tds
-- Purpose: Computes monthly tax deducted at source based on simplified progressive academic slabs.
-- Slabs (Annual Gross):
--   - Up to $300,000 annual: 0%
--   - $300,001 to $600,000: 5% of excess over 300,000
--   - $600,001 to $1,200,000: $15,000 + 10% of excess over 600,000
--   - Above $1,200,000: $75,000 + 20% of excess over 1,200,000
-- ----------------------------------------------------------------------------
DROP FUNCTION IF EXISTS `fn_calculate_monthly_tds`//
CREATE FUNCTION `fn_calculate_monthly_tds`(
    p_annual_gross DECIMAL(12,2)
)
RETURNS DECIMAL(10,2)
DETERMINISTIC
NO SQL
BEGIN
    DECLARE v_annual_tax DECIMAL(12,2) DEFAULT 0.00;

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

-- ----------------------------------------------------------------------------
-- Function: fn_count_working_days
-- Purpose: Counts Monday-Friday working days between p_start_date and p_end_date (inclusive).
--          Used consistently for leave duration validation and cross-month proration.
-- ----------------------------------------------------------------------------
DROP FUNCTION IF EXISTS `fn_count_working_days`//
CREATE FUNCTION `fn_count_working_days`(
    p_start_date DATE,
    p_end_date DATE
)
RETURNS INT
DETERMINISTIC
NO SQL
BEGIN
    DECLARE v_curr DATE;
    DECLARE v_count INT DEFAULT 0;

    IF p_start_date IS NULL OR p_end_date IS NULL OR p_start_date > p_end_date THEN
        RETURN 0;
    END IF;

    SET v_curr = p_start_date;
    WHILE v_curr <= p_end_date DO
        -- DAYOFWEEK: 1 = Sunday, 7 = Saturday
        IF DAYOFWEEK(v_curr) NOT IN (1, 7) THEN
            SET v_count = v_count + 1;
        END IF;
        SET v_curr = DATE_ADD(v_curr, INTERVAL 1 DAY);
    END WHILE;

    RETURN v_count;
END//

DELIMITER ;

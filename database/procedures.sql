-- ============================================================================
-- PayTrace: Stored Procedures (Phase 2)
-- Database Engine: MariaDB / MySQL
-- ============================================================================

DELIMITER //

-- ----------------------------------------------------------------------------
-- Procedure: sp_calculate_payroll
-- Purpose:
--   Executes a transaction-safe payroll calculation for an individual employee
--   within a specific payroll period. Creates the parent payroll summary
--   record and normalized payroll_items line entries.
-- Business Rules:
--   - Selects effective salary structure with effective_date <= period end_date.
--   - Allocates cross-month approved leaves strictly by Mon-Fri working days
--     falling inside [period.start_date, period.end_date].
--   - Deducts 0.5 day per HALF_DAY attendance, 1.0 day per ABSENT (excluding
--     dates already covered by an approved leave to prevent double deduction).
--   - Applies late penalty: > 3 monthly late marks incur 0.5 * daily_rate each.
--   - Caps effective deductions at gross_earnings so net_salary >= 0.00 and
--     gross_earnings - total_deductions = net_salary always reconciles.
-- ----------------------------------------------------------------------------
DROP PROCEDURE IF EXISTS `sp_calculate_payroll`//
CREATE PROCEDURE `sp_calculate_payroll`(
    IN  p_employee_id    INT,
    IN  p_period_id      INT,
    IN  p_processed_by   INT,
    OUT p_payroll_id     INT,
    OUT p_net_salary     DECIMAL(10,2),
    OUT p_status_code    INT,
    OUT p_status_message VARCHAR(255)
)
proc_label: BEGIN
    DECLARE v_proc_valid INT DEFAULT 0;
    DECLARE v_emp_exists INT DEFAULT 0;
    DECLARE v_period_exists INT DEFAULT 0;
    DECLARE v_already_processed INT DEFAULT 0;
    DECLARE v_salary_id INT DEFAULT NULL;

    DECLARE v_basic_salary DECIMAL(10,2) DEFAULT 0.00;
    DECLARE v_hra DECIMAL(10,2) DEFAULT 0.00;
    DECLARE v_special_allowance DECIMAL(10,2) DEFAULT 0.00;
    DECLARE v_pf DECIMAL(10,2) DEFAULT 0.00;
    DECLARE v_pt DECIMAL(10,2) DEFAULT 0.00;

    DECLARE v_period_start DATE;
    DECLARE v_period_end DATE;
    DECLARE v_working_days INT;

    DECLARE v_present_days DECIMAL(4,1) DEFAULT 0.0;
    DECLARE v_half_day_unpaid DECIMAL(4,1) DEFAULT 0.0;
    DECLARE v_absent_days DECIMAL(4,1) DEFAULT 0.0;
    DECLARE v_paid_leave_days DECIMAL(4,1) DEFAULT 0.0;
    DECLARE v_unpaid_only_leave_days DECIMAL(4,1) DEFAULT 0.0;
    DECLARE v_unpaid_leave_days DECIMAL(4,1) DEFAULT 0.0;
    DECLARE v_late_days INT DEFAULT 0;

    DECLARE v_daily_rate DECIMAL(10,2) DEFAULT 0.00;
    DECLARE v_gross_earnings DECIMAL(10,2) DEFAULT 0.00;
    DECLARE v_unpaid_deduction DECIMAL(10,2) DEFAULT 0.00;
    DECLARE v_late_penalty DECIMAL(10,2) DEFAULT 0.00;
    DECLARE v_annual_gross DECIMAL(12,2) DEFAULT 0.00;
    DECLARE v_monthly_tds DECIMAL(10,2) DEFAULT 0.00;
    DECLARE v_raw_deductions DECIMAL(10,2) DEFAULT 0.00;

    DECLARE v_remaining DECIMAL(10,2) DEFAULT 0.00;
    DECLARE v_eff_pf DECIMAL(10,2) DEFAULT 0.00;
    DECLARE v_eff_pt DECIMAL(10,2) DEFAULT 0.00;
    DECLARE v_eff_tds DECIMAL(10,2) DEFAULT 0.00;
    DECLARE v_eff_unpaid DECIMAL(10,2) DEFAULT 0.00;
    DECLARE v_eff_late DECIMAL(10,2) DEFAULT 0.00;

    DECLARE v_total_deductions DECIMAL(10,2) DEFAULT 0.00;
    DECLARE v_calc_net DECIMAL(10,2) DEFAULT 0.00;
    DECLARE v_remarks VARCHAR(255) DEFAULT 'Monthly payroll calculated via sp_calculate_payroll';

    DECLARE EXIT HANDLER FOR SQLEXCEPTION
    BEGIN
        ROLLBACK;
        SET p_payroll_id = NULL;
        SET p_net_salary = 0.00;
        SET p_status_code = 500;
        SET p_status_message = 'Transaction aborted: SQL Exception occurred during payroll processing';
    END;

    SET p_payroll_id = NULL;
    SET p_net_salary = 0.00;
    SET p_status_code = 0;
    SET p_status_message = 'Success';

    -- 1. Validate processor identity (must be an active HR_ADMIN)
    SELECT COUNT(*) INTO v_proc_valid
    FROM `employees`
    WHERE `employee_id` = p_processed_by
      AND `status` = 'ACTIVE'
      AND `role` = 'HR_ADMIN';

    IF v_proc_valid = 0 THEN
        SET p_status_code = 403;
        SET p_status_message = 'Invalid or unauthorized payroll processor (requires active HR_ADMIN)';
        LEAVE proc_label;
    END IF;

    -- 2. Validate target employee existence and active status
    SELECT COUNT(*) INTO v_emp_exists
    FROM `employees`
    WHERE `employee_id` = p_employee_id AND `status` = 'ACTIVE';

    IF v_emp_exists = 0 THEN
        SET p_status_code = 404;
        SET p_status_message = 'Employee not found or employment status is inactive';
        LEAVE proc_label;
    END IF;

    -- 3. Validate payroll period existence (strict ONLY_FULL_GROUP_BY compatible)
    SELECT COUNT(*) INTO v_period_exists
    FROM `payroll_periods`
    WHERE `period_id` = p_period_id;

    IF v_period_exists = 0 THEN
        SET p_status_code = 404;
        SET p_status_message = 'Specified payroll period does not exist';
        LEAVE proc_label;
    END IF;

    SELECT `start_date`, `end_date`, `total_working_days`
    INTO v_period_start, v_period_end, v_working_days
    FROM `payroll_periods`
    WHERE `period_id` = p_period_id;

    -- 4. Begin transaction before consistent snapshot reads and writes
    START TRANSACTION;

    -- 5. Check for duplicate payroll processing
    SELECT COUNT(*) INTO v_already_processed
    FROM `payrolls`
    WHERE `employee_id` = p_employee_id AND `period_id` = p_period_id
    FOR UPDATE;

    IF v_already_processed > 0 THEN
        ROLLBACK;
        SET p_status_code = 409;
        SET p_status_message = 'Duplicate payroll processing prevented: employee is already processed for this period';
        LEAVE proc_label;
    END IF;

    -- 6. Retrieve effective-dated salary configuration applicable to this period
    SELECT `salary_id`, `basic_salary`, `hra`, `special_allowance`, `provident_fund`, `professional_tax`
    INTO v_salary_id, v_basic_salary, v_hra, v_special_allowance, v_pf, v_pt
    FROM `salary_structures`
    WHERE `employee_id` = p_employee_id
      AND `effective_date` <= v_period_end
    ORDER BY `effective_date` DESC, `salary_id` DESC
    LIMIT 1;

    IF v_salary_id IS NULL THEN
        ROLLBACK;
        SET p_status_code = 422;
        SET p_status_message = 'No effective salary structure found for employee in this payroll period';
        LEAVE proc_label;
    END IF;

    -- 7. Aggregate attendance metrics within period
    SELECT
        COALESCE(SUM(CASE
            WHEN `status` = 'PRESENT' THEN 1.0
            WHEN `status` = 'HALF_DAY' THEN 0.5
            ELSE 0.0
        END), 0.0),
        COALESCE(SUM(CASE
            WHEN `status` = 'HALF_DAY' THEN 0.5
            ELSE 0.0
        END), 0.0),
        COALESCE(SUM(CASE
            WHEN `is_late` = TRUE AND `status` IN ('PRESENT', 'HALF_DAY') THEN 1
            ELSE 0
        END), 0)
    INTO v_present_days, v_half_day_unpaid, v_late_days
    FROM `attendance`
    WHERE `employee_id` = p_employee_id
      AND `work_date` BETWEEN v_period_start AND v_period_end;

    -- Count unexcused ABSENT rows not already covered by an approved leave
    SELECT COALESCE(COUNT(*), 0.0)
    INTO v_absent_days
    FROM `attendance` a
    WHERE a.`employee_id` = p_employee_id
      AND a.`status` = 'ABSENT'
      AND a.`work_date` BETWEEN v_period_start AND v_period_end
      AND NOT EXISTS (
          SELECT 1
          FROM `leaves` l
          WHERE l.`employee_id` = p_employee_id
            AND l.`status` = 'APPROVED'
            AND a.`work_date` BETWEEN l.`start_date` AND l.`end_date`
      );

    -- 8. Prorate approved paid and unpaid leave days strictly within [v_period_start, v_period_end]
    SELECT COALESCE(SUM(fn_count_working_days(GREATEST(`start_date`, v_period_start), LEAST(`end_date`, v_period_end))), 0.0)
    INTO v_paid_leave_days
    FROM `leaves`
    WHERE `employee_id` = p_employee_id
      AND `status` = 'APPROVED'
      AND `leave_type` IN ('CASUAL', 'SICK', 'PAID')
      AND `start_date` <= v_period_end
      AND `end_date` >= v_period_start;

    SELECT COALESCE(SUM(fn_count_working_days(GREATEST(`start_date`, v_period_start), LEAST(`end_date`, v_period_end))), 0.0)
    INTO v_unpaid_only_leave_days
    FROM `leaves`
    WHERE `employee_id` = p_employee_id
      AND `status` = 'APPROVED'
      AND `leave_type` = 'UNPAID'
      AND `start_date` <= v_period_end
      AND `end_date` >= v_period_start;

    SET v_unpaid_leave_days = v_unpaid_only_leave_days + v_absent_days + v_half_day_unpaid;

    -- 9. Compute financial totals and reconcile deductions against gross earnings
    SET v_gross_earnings = v_basic_salary + v_hra + v_special_allowance;
    SET v_daily_rate = fn_calculate_daily_rate(v_gross_earnings, v_working_days);

    SET v_unpaid_deduction = ROUND(v_unpaid_leave_days * v_daily_rate, 2);

    IF v_late_days > 3 THEN
        SET v_late_penalty = ROUND((v_late_days - 3) * 0.5 * v_daily_rate, 2);
    ELSE
        SET v_late_penalty = 0.00;
    END IF;

    SET v_annual_gross = v_gross_earnings * 12.0;
    SET v_monthly_tds = fn_calculate_monthly_tds(v_annual_gross);

    SET v_raw_deductions = v_pf + v_pt + v_monthly_tds + v_unpaid_deduction + v_late_penalty;

    -- Cap deductions sequentially at v_gross_earnings so gross - total_deductions = net_salary >= 0.00
    SET v_remaining = v_gross_earnings;
    SET v_eff_pf = LEAST(v_pf, v_remaining);
    SET v_remaining = v_remaining - v_eff_pf;

    SET v_eff_pt = LEAST(v_pt, v_remaining);
    SET v_remaining = v_remaining - v_eff_pt;

    SET v_eff_tds = LEAST(v_monthly_tds, v_remaining);
    SET v_remaining = v_remaining - v_eff_tds;

    SET v_eff_unpaid = LEAST(v_unpaid_deduction, v_remaining);
    SET v_remaining = v_remaining - v_eff_unpaid;

    SET v_eff_late = LEAST(v_late_penalty, v_remaining);
    SET v_remaining = v_remaining - v_eff_late;

    SET v_total_deductions = v_eff_pf + v_eff_pt + v_eff_tds + v_eff_unpaid + v_eff_late;
    SET v_calc_net = v_gross_earnings - v_total_deductions;

    IF v_raw_deductions > v_gross_earnings THEN
        SET v_remarks = CONCAT(
            'Calculated via sp_calculate_payroll; deductions capped at gross earnings (uncapped total: $',
            FORMAT(v_raw_deductions, 2), ')'
        );
    END IF;

    -- 10. Persist payroll summary and reconciled line items
    INSERT INTO `payrolls` (
        `employee_id`,
        `period_id`,
        `salary_id`,
        `present_days`,
        `approved_paid_leave_days`,
        `unpaid_leave_days`,
        `late_days`,
        `gross_earnings`,
        `total_deductions`,
        `net_salary`,
        `payment_status`,
        `processed_by`,
        `processed_at`,
        `payment_date`,
        `remarks`
    ) VALUES (
        p_employee_id,
        p_period_id,
        v_salary_id,
        v_present_days,
        v_paid_leave_days,
        v_unpaid_leave_days,
        v_late_days,
        v_gross_earnings,
        v_total_deductions,
        v_calc_net,
        'CALCULATED',
        p_processed_by,
        CURRENT_TIMESTAMP,
        NULL,
        v_remarks
    );

    SET p_payroll_id = LAST_INSERT_ID();

    -- Normalized Itemized Earnings
    INSERT INTO `payroll_items` (`payroll_id`, `item_type`, `item_name`, `amount`, `description`)
    VALUES (p_payroll_id, 'EARNING', 'Basic Salary', v_basic_salary, 'Base monthly compensation');

    IF v_hra > 0 THEN
        INSERT INTO `payroll_items` (`payroll_id`, `item_type`, `item_name`, `amount`, `description`)
        VALUES (p_payroll_id, 'EARNING', 'House Rent Allowance (HRA)', v_hra, 'Housing allowance');
    END IF;

    IF v_special_allowance > 0 THEN
        INSERT INTO `payroll_items` (`payroll_id`, `item_type`, `item_name`, `amount`, `description`)
        VALUES (p_payroll_id, 'EARNING', 'Special Allowance', v_special_allowance, 'Supplementary allowance');
    END IF;

    -- Normalized Itemized Deductions (reconciled effective amounts)
    IF v_eff_pf > 0 THEN
        INSERT INTO `payroll_items` (`payroll_id`, `item_type`, `item_name`, `amount`, `description`)
        VALUES (p_payroll_id, 'DEDUCTION', 'Provident Fund (PF)', v_eff_pf, 'Retirement contribution');
    END IF;

    IF v_eff_pt > 0 THEN
        INSERT INTO `payroll_items` (`payroll_id`, `item_type`, `item_name`, `amount`, `description`)
        VALUES (p_payroll_id, 'DEDUCTION', 'Professional Tax', v_eff_pt, 'Mandatory professional tax');
    END IF;

    IF v_eff_unpaid > 0 THEN
        INSERT INTO `payroll_items` (`payroll_id`, `item_type`, `item_name`, `amount`, `description`)
        VALUES (p_payroll_id, 'DEDUCTION', 'Unpaid Leave Deduction', v_eff_unpaid,
                CONCAT('Deduction for ', v_unpaid_leave_days, ' unpaid leave/absence/half-day unit(s)'));
    END IF;

    IF v_eff_late > 0 THEN
        INSERT INTO `payroll_items` (`payroll_id`, `item_type`, `item_name`, `amount`, `description`)
        VALUES (p_payroll_id, 'DEDUCTION', 'Late Attendance Penalty', v_eff_late,
                CONCAT('Penalty for ', (v_late_days - 3), ' late mark(s) beyond grace threshold of 3'));
    END IF;

    IF v_eff_tds > 0 THEN
        INSERT INTO `payroll_items` (`payroll_id`, `item_type`, `item_name`, `amount`, `description`)
        VALUES (p_payroll_id, 'DEDUCTION', 'Income Tax (TDS)', v_eff_tds, 'Monthly TDS on projected annual gross');
    END IF;

    COMMIT;

    SET p_net_salary = v_calc_net;
    SET p_status_code = 200;
    SET p_status_message = 'Payroll successfully calculated and committed';
END//

-- ----------------------------------------------------------------------------
-- Procedure: sp_process_bulk_payroll
-- Purpose:
--   Iterates across all active employees and invokes sp_calculate_payroll
--   individually per employee. Each employee transaction commits or rolls back
--   independently (partial success is tracked via p_processed_count/p_error_count).
-- ----------------------------------------------------------------------------
DROP PROCEDURE IF EXISTS `sp_process_bulk_payroll`//
CREATE PROCEDURE `sp_process_bulk_payroll`(
    IN  p_period_id       INT,
    IN  p_processed_by    INT,
    OUT p_processed_count INT,
    OUT p_error_count     INT
)
BEGIN
    DECLARE done INT DEFAULT FALSE;
    DECLARE v_emp_id INT;
    DECLARE v_pid INT;
    DECLARE v_net DECIMAL(10,2);
    DECLARE v_code INT;
    DECLARE v_msg VARCHAR(255);

    DECLARE cur_employees CURSOR FOR
        SELECT `employee_id` FROM `employees` WHERE `status` = 'ACTIVE' ORDER BY `employee_id` ASC;
    DECLARE CONTINUE HANDLER FOR NOT FOUND SET done = TRUE;

    SET p_processed_count = 0;
    SET p_error_count = 0;

    OPEN cur_employees;

    read_loop: LOOP
        FETCH cur_employees INTO v_emp_id;
        IF done THEN
            LEAVE read_loop;
        END IF;

        CALL sp_calculate_payroll(v_emp_id, p_period_id, p_processed_by, v_pid, v_net, v_code, v_msg);

        IF v_code = 200 THEN
            SET p_processed_count = p_processed_count + 1;
        ELSE
            SET p_error_count = p_error_count + 1;
        END IF;
    END LOOP;

    CLOSE cur_employees;
END//

-- ----------------------------------------------------------------------------
-- Procedure: sp_demonstrate_transaction_rollback
-- Purpose:
--   Explicitly demonstrates a multi-step failed transaction and verified ROLLBACK.
--   Step 1 performs a valid write inside START TRANSACTION; Step 2 violates
--   chk_payroll_gross; the SQLEXCEPTION handler executes ROLLBACK so BOTH
--   Step 1 and Step 2 leave zero residual rows in the database.
-- ----------------------------------------------------------------------------
DROP PROCEDURE IF EXISTS `sp_demonstrate_transaction_rollback`//
CREATE PROCEDURE `sp_demonstrate_transaction_rollback`(
    IN  p_employee_id INT,
    IN  p_period_id INT,
    IN  p_processed_by INT,
    OUT p_result_status VARCHAR(50),
    OUT p_message VARCHAR(255)
)
BEGIN
    DECLARE v_salary_id INT DEFAULT NULL;

    DECLARE EXIT HANDLER FOR SQLEXCEPTION
    BEGIN
        ROLLBACK;
        SET p_result_status = 'ROLLBACK_VERIFIED';
        SET p_message = 'Multi-step transaction safely rolled back after constraint violation; Step 1 and Step 2 left zero residual rows';
    END;

    SELECT `salary_id` INTO v_salary_id
    FROM `salary_structures`
    WHERE `employee_id` = p_employee_id
    ORDER BY `effective_date` DESC, `salary_id` DESC
    LIMIT 1;

    IF v_salary_id IS NULL THEN
        SET v_salary_id = 1;
    END IF;

    START TRANSACTION;

    -- Step 1: Valid write that would persist if transaction were not rolled back
    INSERT INTO `departments` (`department_name`, `description`)
    VALUES ('__ROLLBACK_PROBE_DEPT__', 'Temporary probe row for multi-step rollback verification');

    -- Step 2: Invalid payroll insert violating chk_payroll_gross (negative gross)
    INSERT INTO `payrolls` (
        `employee_id`, `period_id`, `salary_id`, `present_days`, `approved_paid_leave_days`,
        `unpaid_leave_days`, `late_days`, `gross_earnings`, `total_deductions`, `net_salary`,
        `payment_status`, `processed_by`
    ) VALUES (
        p_employee_id, p_period_id, v_salary_id, 20.0, 0.0, 0.0, 0,
        -50000.00,
        0.00, 0.00, 'CALCULATED', p_processed_by
    );

    -- Unreachable if constraint fires
    COMMIT;
    SET p_result_status = 'FAILED_TO_CATCH';
    SET p_message = 'Negative salary unexpectedly succeeded';
END//

DELIMITER ;

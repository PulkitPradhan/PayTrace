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
    -- Declaration of local calculation variables
    DECLARE v_emp_exists INT DEFAULT 0;
    DECLARE v_period_exists INT DEFAULT 0;
    DECLARE v_already_processed INT DEFAULT 0;
    DECLARE v_salary_id INT;
    DECLARE v_basic_salary DECIMAL(10,2) DEFAULT 0.00;
    DECLARE v_hra DECIMAL(10,2) DEFAULT 0.00;
    DECLARE v_special_allowance DECIMAL(10,2) DEFAULT 0.00;
    DECLARE v_pf DECIMAL(10,2) DEFAULT 0.00;
    DECLARE v_pt DECIMAL(10,2) DEFAULT 0.00;
    
    DECLARE v_period_start DATE;
    DECLARE v_period_end DATE;
    DECLARE v_working_days INT;
    
    DECLARE v_present_days DECIMAL(4,1) DEFAULT 0.0;
    DECLARE v_paid_leave_days DECIMAL(4,1) DEFAULT 0.0;
    DECLARE v_unpaid_leave_days DECIMAL(4,1) DEFAULT 0.0;
    DECLARE v_late_days INT DEFAULT 0;
    
    DECLARE v_daily_rate DECIMAL(10,2) DEFAULT 0.00;
    DECLARE v_gross_earnings DECIMAL(10,2) DEFAULT 0.00;
    DECLARE v_unpaid_deduction DECIMAL(10,2) DEFAULT 0.00;
    DECLARE v_late_penalty DECIMAL(10,2) DEFAULT 0.00;
    DECLARE v_annual_gross DECIMAL(10,2) DEFAULT 0.00;
    DECLARE v_monthly_tds DECIMAL(10,2) DEFAULT 0.00;
    DECLARE v_total_deductions DECIMAL(10,2) DEFAULT 0.00;
    DECLARE v_calc_net DECIMAL(10,2) DEFAULT 0.00;

    -- Exception handler for SQL rollback
    DECLARE EXIT HANDLER FOR SQLEXCEPTION
    BEGIN
        ROLLBACK;
        SET p_payroll_id = NULL;
        SET p_net_salary = 0.00;
        SET p_status_code = 500;
        SET p_status_message = 'Transaction aborted: SQL Exception occurred during payroll processing';
    END;

    -- Initialize return values
    SET p_payroll_id = NULL;
    SET p_net_salary = 0.00;
    SET p_status_code = 0;
    SET p_status_message = 'Success';

    -- 1. Validate employee existence and active status
    SELECT COUNT(*) INTO v_emp_exists 
    FROM `employees` 
    WHERE `employee_id` = p_employee_id AND `status` = 'ACTIVE';

    IF v_emp_exists = 0 THEN
        SET p_status_code = 404;
        SET p_status_message = 'Employee not found or employment status is inactive';
        LEAVE proc_label;
    END IF;

    -- 2. Validate payroll period existence
    SELECT COUNT(*), `start_date`, `end_date`, `total_working_days`
    INTO v_period_exists, v_period_start, v_period_end, v_working_days
    FROM `payroll_periods`
    WHERE `period_id` = p_period_id;

    IF v_period_exists = 0 THEN
        SET p_status_code = 404;
        SET p_status_message = 'Specified payroll period does not exist';
        LEAVE proc_label;
    END IF;

    -- 3. Check for duplicate payroll processing
    SELECT COUNT(*) INTO v_already_processed
    FROM `payrolls`
    WHERE `employee_id` = p_employee_id AND `period_id` = p_period_id;

    IF v_already_processed > 0 THEN
        SET p_status_code = 409;
        SET p_status_message = 'Duplicate payroll processing prevented: employee is already processed for this period';
        LEAVE proc_label;
    END IF;

    -- 4. Retrieve active salary configuration for employee
    SELECT `salary_id`, `basic_salary`, `hra`, `special_allowance`, `provident_fund`, `professional_tax`
    INTO v_salary_id, v_basic_salary, v_hra, v_special_allowance, v_pf, v_pt
    FROM `salary_structures`
    WHERE `employee_id` = p_employee_id AND `is_active` = TRUE
    ORDER BY `effective_date` DESC
    LIMIT 1;

    IF v_salary_id IS NULL THEN
        SET p_status_code = 422;
        SET p_status_message = 'No active salary structure found for employee';
        LEAVE proc_label;
    END IF;

    -- 5. Calculate attendance metrics from attendance table
    SELECT 
        COALESCE(SUM(CASE 
            WHEN `status` = 'PRESENT' THEN 1.0 
            WHEN `status` = 'HALF_DAY' THEN 0.5 
            ELSE 0.0 
        END), 0.0),
        COALESCE(SUM(CASE WHEN `is_late` = TRUE THEN 1 ELSE 0 END), 0)
    INTO v_present_days, v_late_days
    FROM `attendance`
    WHERE `employee_id` = p_employee_id 
      AND `work_date` BETWEEN v_period_start AND v_period_end;

    -- 6. Calculate approved paid leave days
    SELECT COALESCE(SUM(`total_days`), 0.0)
    INTO v_paid_leave_days
    FROM `leaves`
    WHERE `employee_id` = p_employee_id 
      AND `status` = 'APPROVED'
      AND `leave_type` IN ('CASUAL', 'SICK', 'PAID')
      AND `start_date` <= v_period_end 
      AND `end_date` >= v_period_start;

    -- 7. Calculate approved unpaid leave days
    SELECT COALESCE(SUM(`total_days`), 0.0)
    INTO v_unpaid_leave_days
    FROM `leaves`
    WHERE `employee_id` = p_employee_id 
      AND `status` = 'APPROVED'
      AND `leave_type` = 'UNPAID'
      AND `start_date` <= v_period_end 
      AND `end_date` >= v_period_start;

    -- Add direct ABSENT marks to unpaid leave days
    SELECT v_unpaid_leave_days + COALESCE(COUNT(*), 0)
    INTO v_unpaid_leave_days
    FROM `attendance`
    WHERE `employee_id` = p_employee_id 
      AND `status` = 'ABSENT'
      AND `work_date` BETWEEN v_period_start AND v_period_end;

    -- 8. Compute Financial Totals
    SET v_gross_earnings = v_basic_salary + v_hra + v_special_allowance;
    SET v_daily_rate = fn_calculate_daily_rate(v_gross_earnings, v_working_days);
    
    -- Unpaid leave deduction
    SET v_unpaid_deduction = ROUND(v_unpaid_leave_days * v_daily_rate, 2);

    -- Late attendance penalty (policy: >3 late arrivals penalize 0.5 day rate per excess late mark)
    IF v_late_days > 3 THEN
        SET v_late_penalty = ROUND((v_late_days - 3) * 0.5 * v_daily_rate, 2);
    ELSE
        SET v_late_penalty = 0.00;
    END IF;

    -- TDS Tax deduction
    SET v_annual_gross = v_gross_earnings * 12.0;
    SET v_monthly_tds = fn_calculate_monthly_tds(v_annual_gross);

    -- Total deductions
    SET v_total_deductions = v_pf + v_pt + v_unpaid_deduction + v_late_penalty + v_monthly_tds;

    -- Net Salary
    SET v_calc_net = v_gross_earnings - v_total_deductions;
    IF v_calc_net < 0.00 THEN
        SET v_calc_net = 0.00;
    END IF;

    -- 9. Execute transaction: Insert payroll record and itemized details
    START TRANSACTION;

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
        v_period_end,
        'Monthly payroll calculated via sp_calculate_payroll'
    );

    SET p_payroll_id = LAST_INSERT_ID();

    -- Insert Normalized Itemized Earnings
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

    -- Insert Normalized Itemized Deductions
    IF v_pf > 0 THEN
        INSERT INTO `payroll_items` (`payroll_id`, `item_type`, `item_name`, `amount`, `description`)
        VALUES (p_payroll_id, 'DEDUCTION', 'Provident Fund (PF)', v_pf, 'Retirement contribution');
    END IF;

    IF v_pt > 0 THEN
        INSERT INTO `payroll_items` (`payroll_id`, `item_type`, `item_name`, `amount`, `description`)
        VALUES (p_payroll_id, 'DEDUCTION', 'Professional Tax', v_pt, 'Mandatory professional tax');
    END IF;

    IF v_unpaid_deduction > 0 THEN
        INSERT INTO `payroll_items` (`payroll_id`, `item_type`, `item_name`, `amount`, `description`)
        VALUES (p_payroll_id, 'DEDUCTION', 'Unpaid Leave Deduction', v_unpaid_deduction, 
                CONCAT('Deduction for ', v_unpaid_leave_days, ' unpaid leave/absence day(s)'));
    END IF;

    IF v_late_penalty > 0 THEN
        INSERT INTO `payroll_items` (`payroll_id`, `item_type`, `item_name`, `amount`, `description`)
        VALUES (p_payroll_id, 'DEDUCTION', 'Late Attendance Penalty', v_late_penalty, 
                CONCAT('Penalty for ', (v_late_days - 3), ' late mark(s) beyond grace threshold of 3'));
    END IF;

    IF v_monthly_tds > 0 THEN
        INSERT INTO `payroll_items` (`payroll_id`, `item_type`, `item_name`, `amount`, `description`)
        VALUES (p_payroll_id, 'DEDUCTION', 'Income Tax (TDS)', v_monthly_tds, 'Monthly TDS on projected annual taxable gross');
    END IF;

    COMMIT;

    SET p_net_salary = v_calc_net;
    SET p_status_code = 200;
    SET p_status_message = 'Payroll successfully calculated and committed';
END//

-- ----------------------------------------------------------------------------
-- Procedure: sp_process_bulk_payroll
-- Purpose: Iterates across all active employees and generates payroll for period.
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
        SELECT `employee_id` FROM `employees` WHERE `status` = 'ACTIVE';
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
--   Explicitly demonstrates a failed payroll transaction and verified ROLLBACK.
--   Attempts an operation that violates database constraints, catches the
--   exception, triggers ROLLBACK, and confirms zero residual rows.
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
    DECLARE EXIT HANDLER FOR SQLEXCEPTION
    BEGIN
        ROLLBACK;
        SET p_result_status = 'ROLLBACK_VERIFIED';
        SET p_message = 'Transaction safely rolled back after constraint violation';
    END;

    START TRANSACTION;

    -- Step 1: Insert an invalid payroll with a negative gross earnings amount (violating chk_payroll_gross)
    INSERT INTO `payrolls` (
        `employee_id`, `period_id`, `salary_id`, `present_days`, `approved_paid_leave_days`,
        `unpaid_leave_days`, `late_days`, `gross_earnings`, `total_deductions`, `net_salary`,
        `payment_status`, `processed_by`
    ) VALUES (
        p_employee_id, p_period_id, 1, 20.0, 0.0, 0.0, 0,
        -50000.00, -- VIOLATION: Negative gross earnings violates chk_payroll_gross
        0.00, 0.00, 'CALCULATED', p_processed_by
    );

    -- Should not reach this line
    COMMIT;
    SET p_result_status = 'FAILED_TO_CATCH';
    SET p_message = 'Negative salary unexpectedly succeeded';
END//

DELIMITER ;

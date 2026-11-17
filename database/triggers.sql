-- ============================================================================
-- PayTrace: Database Triggers (Phase 2)
-- Database Engine: MariaDB / MySQL
-- ============================================================================

DELIMITER //

-- ----------------------------------------------------------------------------
-- Trigger: trg_attendance_before_insert
-- Purpose: 
--   1. Rejects invalid clock-in/clock-out time ranges.
--   2. Verifies employee is not on approved leave on work_date.
--   3. Calculates is_late flag and late_minutes automatically.
-- ----------------------------------------------------------------------------
DROP TRIGGER IF EXISTS `trg_attendance_before_insert`//
CREATE TRIGGER `trg_attendance_before_insert`
BEFORE INSERT ON `attendance`
FOR EACH ROW
BEGIN
    DECLARE v_leave_count INT DEFAULT 0;

    -- Validate check-out is after check-in if both provided
    IF NEW.check_in_time IS NOT NULL AND NEW.check_out_time IS NOT NULL THEN
        IF NEW.check_out_time < NEW.check_in_time THEN
            SIGNAL SQLSTATE '45000' 
                SET MESSAGE_TEXT = 'Invalid attendance: check-out time cannot be earlier than check-in time';
        END IF;
    END IF;

    -- Check if employee is on approved leave on this date
    SELECT COUNT(*) INTO v_leave_count
    FROM `leaves`
    WHERE `employee_id` = NEW.employee_id
      AND `status` = 'APPROVED'
      AND NEW.work_date BETWEEN `start_date` AND `end_date`;

    IF v_leave_count > 0 AND NEW.status != 'ON_LEAVE' THEN
        SIGNAL SQLSTATE '45000' 
            SET MESSAGE_TEXT = 'Invalid attendance: employee has an approved leave for this date';
    END IF;

    -- Standard shift start is 09:00:00 with a 15-minute grace period (09:15:00)
    IF NEW.check_in_time IS NOT NULL THEN
        IF NEW.check_in_time > '09:15:00' THEN
            SET NEW.is_late = TRUE;
            SET NEW.late_minutes = ROUND(TIME_TO_SEC(TIMEDIFF(NEW.check_in_time, '09:00:00')) / 60);
        ELSE
            SET NEW.is_late = FALSE;
            SET NEW.late_minutes = 0;
        END IF;
    END IF;
END//

-- ----------------------------------------------------------------------------
-- Trigger: trg_attendance_before_update
-- Purpose: Same validations for update operations.
-- ----------------------------------------------------------------------------
DROP TRIGGER IF EXISTS `trg_attendance_before_update`//
CREATE TRIGGER `trg_attendance_before_update`
BEFORE UPDATE ON `attendance`
FOR EACH ROW
BEGIN
    DECLARE v_leave_count INT DEFAULT 0;

    IF NEW.check_in_time IS NOT NULL AND NEW.check_out_time IS NOT NULL THEN
        IF NEW.check_out_time < NEW.check_in_time THEN
            SIGNAL SQLSTATE '45000' 
                SET MESSAGE_TEXT = 'Invalid attendance: check-out time cannot be earlier than check-in time';
        END IF;
    END IF;

    SELECT COUNT(*) INTO v_leave_count
    FROM `leaves`
    WHERE `employee_id` = NEW.employee_id
      AND `status` = 'APPROVED'
      AND NEW.work_date BETWEEN `start_date` AND `end_date`;

    IF v_leave_count > 0 AND NEW.status != 'ON_LEAVE' THEN
        SIGNAL SQLSTATE '45000' 
            SET MESSAGE_TEXT = 'Invalid attendance: employee has an approved leave for this date';
    END IF;

    IF NEW.check_in_time IS NOT NULL THEN
        IF NEW.check_in_time > '09:15:00' THEN
            SET NEW.is_late = TRUE;
            SET NEW.late_minutes = ROUND(TIME_TO_SEC(TIMEDIFF(NEW.check_in_time, '09:00:00')) / 60);
        ELSE
            SET NEW.is_late = FALSE;
            SET NEW.late_minutes = 0;
        END IF;
    END IF;
END//

-- ----------------------------------------------------------------------------
-- Trigger: trg_leaves_before_insert
-- Purpose: Enforces date validity and prevents overlapping approved leaves.
-- ----------------------------------------------------------------------------
DROP TRIGGER IF EXISTS `trg_leaves_before_insert`//
CREATE TRIGGER `trg_leaves_before_insert`
BEFORE INSERT ON `leaves`
FOR EACH ROW
BEGIN
    DECLARE v_overlap_count INT DEFAULT 0;

    IF NEW.start_date > NEW.end_date THEN
        SIGNAL SQLSTATE '45000' 
            SET MESSAGE_TEXT = 'Invalid leave dates: start_date cannot be after end_date';
    END IF;

    IF NEW.total_days <= 0 THEN
        SIGNAL SQLSTATE '45000' 
            SET MESSAGE_TEXT = 'Invalid leave: total_days must be greater than zero';
    END IF;

    -- If inserting directly as APPROVED, check for overlaps
    IF NEW.status = 'APPROVED' THEN
        SELECT COUNT(*) INTO v_overlap_count
        FROM `leaves`
        WHERE `employee_id` = NEW.employee_id
          AND `status` = 'APPROVED'
          AND `start_date` <= NEW.end_date
          AND `end_date` >= NEW.start_date;

        IF v_overlap_count > 0 THEN
            SIGNAL SQLSTATE '45000' 
                SET MESSAGE_TEXT = 'Conflicting leave: overlapping approved leave already exists for this employee';
        END IF;
    END IF;
END//

-- ----------------------------------------------------------------------------
-- Trigger: trg_leaves_before_update
-- Purpose: Enforces date validity and prevents overlapping approved leaves on update.
-- ----------------------------------------------------------------------------
DROP TRIGGER IF EXISTS `trg_leaves_before_update`//
CREATE TRIGGER `trg_leaves_before_update`
BEFORE UPDATE ON `leaves`
FOR EACH ROW
BEGIN
    DECLARE v_overlap_count INT DEFAULT 0;

    IF NEW.start_date > NEW.end_date THEN
        SIGNAL SQLSTATE '45000' 
            SET MESSAGE_TEXT = 'Invalid leave dates: start_date cannot be after end_date';
    END IF;

    IF NEW.status = 'APPROVED' THEN
        SELECT COUNT(*) INTO v_overlap_count
        FROM `leaves`
        WHERE `employee_id` = NEW.employee_id
          AND `status` = 'APPROVED'
          AND `leave_id` != NEW.leave_id
          AND `start_date` <= NEW.end_date
          AND `end_date` >= NEW.start_date;

        IF v_overlap_count > 0 THEN
            SIGNAL SQLSTATE '45000' 
                SET MESSAGE_TEXT = 'Conflicting leave: overlapping approved leave already exists for this employee';
        END IF;
    END IF;
END//

-- ----------------------------------------------------------------------------
-- Trigger: trg_salary_after_update
-- Purpose: Records salary structure modifications into audit_logs.
-- ----------------------------------------------------------------------------
DROP TRIGGER IF EXISTS `trg_salary_after_update`//
CREATE TRIGGER `trg_salary_after_update`
AFTER UPDATE ON `salary_structures`
FOR EACH ROW
BEGIN
    INSERT INTO `audit_logs` (
        `table_name`, `record_id`, `action`, `actor_employee_id`, `old_values`, `new_values`
    ) VALUES (
        'salary_structures',
        NEW.salary_id,
        'UPDATE',
        NULL,
        JSON_OBJECT(
            'basic_salary', OLD.basic_salary,
            'hra', OLD.hra,
            'special_allowance', OLD.special_allowance,
            'provident_fund', OLD.provident_fund,
            'professional_tax', OLD.professional_tax,
            'effective_date', OLD.effective_date,
            'is_active', OLD.is_active
        ),
        JSON_OBJECT(
            'basic_salary', NEW.basic_salary,
            'hra', NEW.hra,
            'special_allowance', NEW.special_allowance,
            'provident_fund', NEW.provident_fund,
            'professional_tax', NEW.professional_tax,
            'effective_date', NEW.effective_date,
            'is_active', NEW.is_active
        )
    );
END//

-- ----------------------------------------------------------------------------
-- Trigger: trg_payrolls_after_insert
-- Purpose: Records finalized payroll transactions into audit_logs.
-- ----------------------------------------------------------------------------
DROP TRIGGER IF EXISTS `trg_payrolls_after_insert`//
CREATE TRIGGER `trg_payrolls_after_insert`
AFTER INSERT ON `payrolls`
FOR EACH ROW
BEGIN
    INSERT INTO `audit_logs` (
        `table_name`, `record_id`, `action`, `actor_employee_id`, `old_values`, `new_values`
    ) VALUES (
        'payrolls',
        NEW.payroll_id,
        'INSERT',
        NEW.processed_by,
        NULL,
        JSON_OBJECT(
            'payroll_id', NEW.payroll_id,
            'employee_id', NEW.employee_id,
            'period_id', NEW.period_id,
            'gross_earnings', NEW.gross_earnings,
            'total_deductions', NEW.total_deductions,
            'net_salary', NEW.net_salary,
            'payment_status', NEW.payment_status
        )
    );
END//

DELIMITER ;

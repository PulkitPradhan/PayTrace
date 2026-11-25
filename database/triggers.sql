-- ============================================================================
-- PayTrace: Database Triggers (Phase 2)
-- Database Engine: MariaDB / MySQL
-- ============================================================================

DELIMITER //

-- ----------------------------------------------------------------------------
-- Trigger: trg_attendance_before_insert
-- Purpose:
--   1. Rejects check-in/out timestamps on non-working statuses (ABSENT, ON_LEAVE).
--   2. Rejects invalid clock-in/clock-out time ranges.
--   3. Verifies employee is not on approved leave on work_date unless ON_LEAVE.
--   4. Computes is_late and late_minutes (> 09:15:00, measured from 09:00:00),
--      or resets both to FALSE/0 when check_in_time is NULL or status is non-working.
-- ----------------------------------------------------------------------------
DROP TRIGGER IF EXISTS `trg_attendance_before_insert`//
CREATE TRIGGER `trg_attendance_before_insert`
BEFORE INSERT ON `attendance`
FOR EACH ROW
BEGIN
    DECLARE v_leave_count INT DEFAULT 0;

    IF NEW.status IN ('ABSENT', 'ON_LEAVE') AND (NEW.check_in_time IS NOT NULL OR NEW.check_out_time IS NOT NULL) THEN
        SIGNAL SQLSTATE '45000'
            SET MESSAGE_TEXT = 'Invalid attendance: ABSENT or ON_LEAVE records cannot have check-in or check-out times';
    END IF;

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

    IF NEW.status IN ('ABSENT', 'ON_LEAVE') OR NEW.check_in_time IS NULL THEN
        SET NEW.is_late = FALSE;
        SET NEW.late_minutes = 0;
    ELSEIF NEW.check_in_time > '09:15:00' THEN
        SET NEW.is_late = TRUE;
        SET NEW.late_minutes = ROUND(TIME_TO_SEC(TIMEDIFF(NEW.check_in_time, '09:00:00')) / 60);
    ELSE
        SET NEW.is_late = FALSE;
        SET NEW.late_minutes = 0;
    END IF;
END//

-- ----------------------------------------------------------------------------
-- Trigger: trg_attendance_before_update
-- Purpose: Enforces identical attendance rules and resets late marks when cleared.
-- ----------------------------------------------------------------------------
DROP TRIGGER IF EXISTS `trg_attendance_before_update`//
CREATE TRIGGER `trg_attendance_before_update`
BEFORE UPDATE ON `attendance`
FOR EACH ROW
BEGIN
    DECLARE v_leave_count INT DEFAULT 0;

    IF NEW.status IN ('ABSENT', 'ON_LEAVE') AND (NEW.check_in_time IS NOT NULL OR NEW.check_out_time IS NOT NULL) THEN
        SIGNAL SQLSTATE '45000'
            SET MESSAGE_TEXT = 'Invalid attendance: ABSENT or ON_LEAVE records cannot have check-in or check-out times';
    END IF;

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

    IF NEW.status IN ('ABSENT', 'ON_LEAVE') OR NEW.check_in_time IS NULL THEN
        SET NEW.is_late = FALSE;
        SET NEW.late_minutes = 0;
    ELSEIF NEW.check_in_time > '09:15:00' THEN
        SET NEW.is_late = TRUE;
        SET NEW.late_minutes = ROUND(TIME_TO_SEC(TIMEDIFF(NEW.check_in_time, '09:00:00')) / 60);
    ELSE
        SET NEW.is_late = FALSE;
        SET NEW.late_minutes = 0;
    END IF;
END//

-- ----------------------------------------------------------------------------
-- Trigger: trg_leaves_before_insert
-- Purpose: Enforces date validity, Mon-Fri working-day duration consistency,
--          approved leave overlap rejection, and attendance conflict prevention.
-- ----------------------------------------------------------------------------
DROP TRIGGER IF EXISTS `trg_leaves_before_insert`//
CREATE TRIGGER `trg_leaves_before_insert`
BEFORE INSERT ON `leaves`
FOR EACH ROW
BEGIN
    DECLARE v_work_days INT DEFAULT 0;
    DECLARE v_overlap_count INT DEFAULT 0;
    DECLARE v_att_conflict INT DEFAULT 0;

    IF NEW.start_date > NEW.end_date THEN
        SIGNAL SQLSTATE '45000'
            SET MESSAGE_TEXT = 'Invalid leave dates: start_date cannot be after end_date';
    END IF;

    IF NEW.total_days IS NULL OR NEW.total_days <= 0 THEN
        SIGNAL SQLSTATE '45000'
            SET MESSAGE_TEXT = 'Invalid leave: total_days must be greater than zero';
    END IF;

    SET v_work_days = fn_count_working_days(NEW.start_date, NEW.end_date);
    IF v_work_days <= 0 THEN
        SIGNAL SQLSTATE '45000'
            SET MESSAGE_TEXT = 'Invalid leave dates: selected range contains zero Mon-Fri working days';
    END IF;

    IF NEW.total_days != v_work_days THEN
        SIGNAL SQLSTATE '45000'
            SET MESSAGE_TEXT = 'Invalid leave duration: total_days must match working days (Mon-Fri) in the date range';
    END IF;

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

        SELECT COUNT(*) INTO v_att_conflict
        FROM `attendance`
        WHERE `employee_id` = NEW.employee_id
          AND `work_date` BETWEEN NEW.start_date AND NEW.end_date
          AND `status` != 'ON_LEAVE';

        IF v_att_conflict > 0 THEN
            SIGNAL SQLSTATE '45000'
                SET MESSAGE_TEXT = 'Conflicting attendance: existing attendance entry conflicts with approved leave dates';
        END IF;
    END IF;
END//

-- ----------------------------------------------------------------------------
-- Trigger: trg_leaves_before_update
-- Purpose: Enforces identical date, duration, overlap, and attendance checks on UPDATE.
-- ----------------------------------------------------------------------------
DROP TRIGGER IF EXISTS `trg_leaves_before_update`//
CREATE TRIGGER `trg_leaves_before_update`
BEFORE UPDATE ON `leaves`
FOR EACH ROW
BEGIN
    DECLARE v_work_days INT DEFAULT 0;
    DECLARE v_overlap_count INT DEFAULT 0;
    DECLARE v_att_conflict INT DEFAULT 0;

    IF NEW.start_date > NEW.end_date THEN
        SIGNAL SQLSTATE '45000'
            SET MESSAGE_TEXT = 'Invalid leave dates: start_date cannot be after end_date';
    END IF;

    IF NEW.total_days IS NULL OR NEW.total_days <= 0 THEN
        SIGNAL SQLSTATE '45000'
            SET MESSAGE_TEXT = 'Invalid leave: total_days must be greater than zero';
    END IF;

    SET v_work_days = fn_count_working_days(NEW.start_date, NEW.end_date);
    IF v_work_days <= 0 THEN
        SIGNAL SQLSTATE '45000'
            SET MESSAGE_TEXT = 'Invalid leave dates: selected range contains zero Mon-Fri working days';
    END IF;

    IF NEW.total_days != v_work_days THEN
        SIGNAL SQLSTATE '45000'
            SET MESSAGE_TEXT = 'Invalid leave duration: total_days must match working days (Mon-Fri) in the date range';
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

        SELECT COUNT(*) INTO v_att_conflict
        FROM `attendance`
        WHERE `employee_id` = NEW.employee_id
          AND `work_date` BETWEEN NEW.start_date AND NEW.end_date
          AND `status` != 'ON_LEAVE';

        IF v_att_conflict > 0 THEN
            SIGNAL SQLSTATE '45000'
                SET MESSAGE_TEXT = 'Conflicting attendance: existing attendance entry conflicts with approved leave dates';
        END IF;
    END IF;
END//

-- ----------------------------------------------------------------------------
-- Trigger: trg_salary_after_insert
-- Purpose: Records new salary structure creation into audit_logs.
-- ----------------------------------------------------------------------------
DROP TRIGGER IF EXISTS `trg_salary_after_insert`//
CREATE TRIGGER `trg_salary_after_insert`
AFTER INSERT ON `salary_structures`
FOR EACH ROW
BEGIN
    INSERT INTO `audit_logs` (
        `table_name`, `record_id`, `action`, `actor_employee_id`, `old_values`, `new_values`
    ) VALUES (
        'salary_structures',
        NEW.salary_id,
        'INSERT',
        @app_actor_id,
        NULL,
        JSON_OBJECT(
            'employee_id', NEW.employee_id,
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
        @app_actor_id,
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
            'salary_id', NEW.salary_id,
            'gross_earnings', NEW.gross_earnings,
            'total_deductions', NEW.total_deductions,
            'net_salary', NEW.net_salary,
            'payment_status', NEW.payment_status
        )
    );
END//

DELIMITER ;

-- Update all account_manager values from "Julia Steele Scott" to "Mark Ma" in timesheet_uploads table
UPDATE timesheet_uploads
SET account_manager = 'Mark Ma'
WHERE account_manager = 'Julia Steele Scott';

-- Optional: Check how many rows will be affected before running the update
-- SELECT COUNT(*) FROM timesheet_uploads WHERE account_manager = 'Julia Steele Scott';

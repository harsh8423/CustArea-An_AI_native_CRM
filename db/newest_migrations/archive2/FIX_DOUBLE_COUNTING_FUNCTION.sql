-- =====================================================
-- CRITICAL FIX: Replace Double-Counting Function
-- Version 2: Without relying on constraint names
-- =====================================================

BEGIN;

-- Replace the function with a version that doesn't use ON CONFLICT
CREATE OR REPLACE FUNCTION increment_analytics_metric(
    p_tenant_id UUID,
    p_user_id UUID,
    p_metric_name TEXT,
    p_increment INTEGER DEFAULT 1
)
RETURNS void AS $$
DECLARE
    v_today DATE := CURRENT_DATE;
    v_record_exists BOOLEAN;
BEGIN
    -- Check if record exists using IS NOT DISTINCT FROM for NULL-safe comparison
    SELECT EXISTS(
        SELECT 1 FROM analytics_metrics
        WHERE tenant_id = p_tenant_id
          AND user_id IS NOT DISTINCT FROM p_user_id
          AND metric_date = v_today
          AND metric_period = 'daily'
    ) INTO v_record_exists;
    
    -- Insert if doesn't exist
    IF NOT v_record_exists THEN
        INSERT INTO analytics_metrics (
            tenant_id, 
            user_id, 
            metric_date, 
            metric_period
        )
        VALUES (p_tenant_id, p_user_id, v_today, 'daily');
    END IF;
    
    -- Update the specific metric ONCE using IS NOT DISTINCT FROM for NULL-safe comparison
    -- This handles BOTH user-specific (when p_user_id is not null) AND tenant-wide (when p_user_id is NULL)
    EXECUTE format(
        'UPDATE analytics_metrics 
         SET %I = COALESCE(%I, 0) + $1, 
             updated_at = now()
         WHERE tenant_id = $2 
           AND user_id IS NOT DISTINCT FROM $3
           AND metric_date = $4 
           AND metric_period = ''daily''',
        p_metric_name, p_metric_name
    ) USING p_increment, p_tenant_id, p_user_id, v_today;
END;
$$ LANGUAGE plpgsql;

COMMIT;

-- Verification
SELECT 'Function updated successfully! No more ON CONFLICT errors.' AS status;

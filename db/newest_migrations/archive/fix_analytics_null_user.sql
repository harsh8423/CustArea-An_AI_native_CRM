-- =====================================================
-- FIX: Analytics Metrics - Handle NULL user_id
-- =====================================================
-- Issue: increment_analytics_metric fails silently when user_id is NULL
--        because WHERE user_id = NULL doesn't match (NULL != NULL in SQL)
-- Solution: Fix the WHERE clause to handle NULL properly
-- =====================================================

BEGIN;

-- Update increment_analytics_metric to handle NULL user_id
CREATE OR REPLACE FUNCTION increment_analytics_metric(
    p_tenant_id UUID,
    p_user_id UUID,
    p_metric_name TEXT,
    p_increment INTEGER DEFAULT 1
)
RETURNS void AS $$
DECLARE
    v_today DATE := CURRENT_DATE;
BEGIN
    -- Insert record if doesn't exist
    INSERT INTO analytics_metrics (
        tenant_id, 
        user_id, 
        metric_date, 
        metric_period
    )
    VALUES (p_tenant_id, p_user_id, v_today, 'daily')
    ON CONFLICT (tenant_id, user_id, metric_date, metric_period) 
    DO NOTHING;
    
    -- Update the specific metric
    -- FIXED: Handle NULL user_id with IS NOT DISTINCT FROM
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

COMMENT ON FUNCTION increment_analytics_metric IS 
    'FIXED: Now handles NULL user_id correctly using IS NOT DISTINCT FROM';

COMMIT;

DO $$
BEGIN
    RAISE NOTICE '=====================================================';
    RAISE NOTICE 'Analytics Metrics NULL User Fix Applied';
    RAISE NOTICE '=====================================================';
    RAISE NOTICE '';
    RAISE NOTICE 'increment_analytics_metric now handles:';
    RAISE NOTICE '  ✓ NULL user_id (for unassigned conversations)';
    RAISE NOTICE '  ✓ Specific user_id (for assigned conversations)';
    RAISE NOTICE '';
    RAISE NOTICE 'Campaign emails will now be tracked even if';
    RAISE NOTICE 'conversations are not assigned to a user!';
    RAISE NOTICE '=====================================================';
END $$;

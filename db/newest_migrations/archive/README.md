# Archived Migration Files

**Archived on:** 2026-02-06  
**Reason:** Consolidated into master patch file

## What Happened

These 16 individual fix files have been **superseded** by the master patch file:

**[../analytics_and_activity_logs_master_patch.sql](file:///d:/CustArea/db/newest_migrations/analytics_and_activity_logs_master_patch.sql)**

The master patch consolidates ALL fixes in the correct order with no duplicates.

## Archived Files

### Critical Function Fixes
1. `fix_analytics_and_activity_logging.sql` - Double-counting fix, user attribution
2. `fix_analytics_null_user.sql` - NULL user handling
3. `fix_analytics_unique_constraint.sql` - Partial unique indexes
4. `fix_campaign_analytics_comprehensive.sql` - Campaign email separation

### Message/Email Tracking
5. `fix_ai_attribution.sql` - AI/assistant role support
6. `fix_campaign_email_counting.sql` - Dual counting (general + campaign)
7. `fix_campaign_email_tracking_complete.sql` - Complete campaign tracking
8. `fix_analytics_duplication.sql` - Message deduplication

### Campaign Analytics
9. `fix_campaign_analytics_v2.sql` - Backend double-counting fix
10. `fix_campaign_analytics_v3.sql` - emails_sent_today tracking
11. `fix_campaign_response_analytics.sql` - AI vs Human response tracking

### Phone/Contact/Group Fixes
12. `fix_phone_analytics_trigger.sql` - Method-based AI detection
13. `fix_contact_group_trigger.sql` - Group membership logging
14. `add_delete_activity_logging.sql` - DELETE operation support

### Schema/Data
15. `add_missing_analytics_columns.sql` - campaign_emails_received column
16. `resync_analytics_real_data.sql` - One-time data cleanup

## For New Deployments

**DO NOT** run these archived files. Instead:

1. Run `analytics_and_activity_logs.sql` (core)
2. Run `analytics_and_activity_logs_master_patch.sql` (all fixes)

That's it! No need to run any files in this archive folder.

## For Reference

These files are kept for historical reference only. They document the evolution of the analytics system and the issues that were discovered and fixed during development.

---

**Last Updated:** 2026-02-06

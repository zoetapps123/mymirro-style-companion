# Error Tracking Dashboard Queries

This document contains SQL queries to analyze customer-experienced frontend errors stored in the `error_logs` table.

## View Recent Errors (Last 24 Hours)

```sql
SELECT 
  created_at,
  error_type,
  error_message,
  url,
  user_id,
  context->>'user_agent' as user_agent
FROM error_logs
WHERE created_at > NOW() - INTERVAL '24 hours'
ORDER BY created_at DESC
LIMIT 100;
```

## Errors Grouped by Type

```sql
SELECT 
  error_type,
  COUNT(*) as error_count,
  COUNT(DISTINCT user_id) as affected_users,
  MAX(created_at) as last_occurrence
FROM error_logs
WHERE created_at > NOW() - INTERVAL '7 days'
GROUP BY error_type
ORDER BY error_count DESC;
```

## Most Common Error Messages

```sql
SELECT 
  error_message,
  error_type,
  COUNT(*) as occurrence_count,
  COUNT(DISTINCT user_id) as affected_users
FROM error_logs
WHERE created_at > NOW() - INTERVAL '7 days'
GROUP BY error_message, error_type
ORDER BY occurrence_count DESC
LIMIT 20;
```

## Errors for a Specific User

```sql
SELECT 
  created_at,
  error_type,
  error_message,
  error_stack,
  url,
  context
FROM error_logs
WHERE user_id = 'YOUR_USER_ID_HERE'
ORDER BY created_at DESC
LIMIT 50;
```

## Error Frequency Over Time (Hourly)

```sql
SELECT 
  DATE_TRUNC('hour', created_at) as hour,
  error_type,
  COUNT(*) as error_count
FROM error_logs
WHERE created_at > NOW() - INTERVAL '7 days'
GROUP BY hour, error_type
ORDER BY hour DESC, error_count DESC;
```

## Errors by URL/Route

```sql
SELECT 
  url,
  error_type,
  COUNT(*) as error_count,
  COUNT(DISTINCT user_id) as affected_users
FROM error_logs
WHERE created_at > NOW() - INTERVAL '7 days'
GROUP BY url, error_type
ORDER BY error_count DESC;
```

## Errors with Full Context (Detailed View)

```sql
SELECT 
  created_at,
  error_type,
  error_message,
  error_stack,
  url,
  user_id,
  session_id,
  context->>'user_agent' as user_agent,
  context->>'viewport' as viewport,
  context->>'messages_count' as messages_count
FROM error_logs
WHERE created_at > NOW() - INTERVAL '24 hours'
ORDER BY created_at DESC
LIMIT 50;
```

## Chat-Specific Errors

```sql
SELECT 
  created_at,
  error_message,
  error_stack,
  context->>'messages_count' as messages_count,
  user_id
FROM error_logs
WHERE error_type = 'chat_error'
  AND created_at > NOW() - INTERVAL '7 days'
ORDER BY created_at DESC;
```

## Unhandled Critical Errors

```sql
SELECT 
  created_at,
  error_message,
  error_stack,
  context->>'component_stack' as component_stack,
  url,
  user_id
FROM error_logs
WHERE error_type = 'unhandled_error'
  AND created_at > NOW() - INTERVAL '7 days'
ORDER BY created_at DESC;
```

## Error Trends (Day-over-Day Comparison)

```sql
WITH daily_errors AS (
  SELECT 
    DATE(created_at) as error_date,
    error_type,
    COUNT(*) as error_count
  FROM error_logs
  WHERE created_at > NOW() - INTERVAL '14 days'
  GROUP BY DATE(created_at), error_type
)
SELECT 
  error_date,
  error_type,
  error_count,
  LAG(error_count) OVER (PARTITION BY error_type ORDER BY error_date) as previous_day_count,
  error_count - LAG(error_count) OVER (PARTITION BY error_type ORDER BY error_date) as change
FROM daily_errors
ORDER BY error_date DESC, error_type;
```

## Cleanup Old Errors (Run Manually or Schedule)

```sql
-- Delete errors older than 30 days
SELECT cleanup_old_error_logs();
```

## Access Error Logs in Lovable Cloud

1. Click "View Backend" button in the chat
2. Navigate to Table Editor
3. Select the `error_logs` table
4. Use the SQL Editor to run any of the queries above

## Notes

- All timestamps are in UTC
- `user_id` can be NULL for unauthenticated users
- `context` field contains additional metadata as JSONB
- Errors are automatically logged from:
  - Chat AI interactions (`chat_error`)
  - Unhandled exceptions (`unhandled_error`)
- Errors older than 30 days are automatically cleaned up

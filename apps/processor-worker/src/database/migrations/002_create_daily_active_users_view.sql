CREATE MATERIALIZED VIEW IF NOT EXISTS daily_active_users AS
SELECT
  DATE(timestamp) AS day,
  COUNT(DISTINCT "userId") AS dau
FROM events
WHERE "userId" IS NOT NULL
GROUP BY DATE(timestamp)
ORDER BY day;

-- Medallion import statuses exceed the original VARCHAR(20) limit (e.g. GENERATING_AI_OUTPUTS).

ALTER TABLE data_imports
  ALTER COLUMN status TYPE VARCHAR(64);

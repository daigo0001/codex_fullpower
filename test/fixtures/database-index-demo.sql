-- Load into a disposable PostgreSQL 17 database with psql -X -v ON_ERROR_STOP=1.
-- The Index Workbench compares indexes one at a time after loading this fixture.
SET TIME ZONE 'UTC';
SET default_statistics_target = 1000;

CREATE TABLE loans (
    id bigint PRIMARY KEY,
    tenant_id integer NOT NULL,
    asset_id integer NOT NULL,
    borrower_id integer NOT NULL,
    borrowed_at timestamptz NOT NULL,
    due_on date NOT NULL,
    returned_at timestamptz,
    CHECK (returned_at IS NULL OR returned_at >= borrowed_at)
);

WITH entries AS (
    SELECT
        i,
        (i - 1) % 200 + 1 AS tenant_id,
        (i - 1) % 6000 + 1 AS asset_id,
        ((i - 1) / 200) % 12 + 1 AS borrower_id,
        TIMESTAMPTZ '2026-01-01 00:00:00+00' + (i - 1) * INTERVAL '3 minutes' AS borrowed_at
    FROM generate_series(1, 60000) AS numbers(i)
)
INSERT INTO loans (id, tenant_id, asset_id, borrower_id, borrowed_at, due_on, returned_at)
SELECT i, tenant_id, asset_id, borrower_id, borrowed_at, borrowed_at::date + 14,
    CASE WHEN i <= 59000 THEN borrowed_at + INTERVAL '7 days' END
FROM entries
ORDER BY i;

VACUUM (ANALYZE) loans;

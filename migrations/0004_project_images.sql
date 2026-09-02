-- ============================================================
-- Migration 0004: Project hero images + unit image_url column
-- Images are permanent blob URLs — restored on every demo reset
-- ============================================================

-- Add image_url and gsas_score to units (idempotent via OR IGNORE on schema)
-- (D1 silently ignores duplicate column errors on ALTER ADD COLUMN)

-- ── Project hero images ────────────────────────────────────────
-- proj001  Al Mouj Residences      (active/completed) — real-photo luxury waterfront
UPDATE projects SET hero_image_url = 'https://www.genspark.ai/api/files/s/Lpruc59V?cache_control=3600'
  WHERE id = 'proj001' AND (hero_image_url IS NULL OR hero_image_url = '');

-- proj002  Seeb Heights Villas     (active/completed) — real-photo villa community
UPDATE projects SET hero_image_url = 'https://www.genspark.ai/api/files/s/nKbe89Q3?cache_control=3600'
  WHERE id = 'proj002' AND (hero_image_url IS NULL OR hero_image_url = '');

-- proj003  Mabella View Apartments (archived/completed) — real-photo mid-rise
UPDATE projects SET hero_image_url = 'https://www.genspark.ai/api/files/s/uRuQ4F7X?cache_control=3600'
  WHERE id = 'proj003' AND (hero_image_url IS NULL OR hero_image_url = '');

-- proj004  EcoVillage Muscat Ph1   (draft/upcoming) — architectural render eco-villas
UPDATE projects SET hero_image_url = 'https://www.genspark.ai/api/files/s/kO0wp7XX?cache_control=3600'
  WHERE id = 'proj004' AND (hero_image_url IS NULL OR hero_image_url = '');

-- ── EcoVillage Phase 2 unit type images ───────────────────────
-- These are referenced by the demo script when EcoVillage Phase 2
-- units are created in Act 2; also pre-applied to any existing EV2 rows.

-- Type A — Grand Family Villa (4-bed, ~360 m²)
UPDATE units SET image_url = 'https://www.genspark.ai/api/files/s/7hHwgjwr?cache_control=3600'
  WHERE project_id IN (
    SELECT id FROM projects WHERE name LIKE '%EcoVillage%Phase 2%'
  ) AND type LIKE '%A%' AND (image_url IS NULL OR image_url = '');

-- Type B — Compact Villa (3-bed, ~270 m²)
UPDATE units SET image_url = 'https://www.genspark.ai/api/files/s/4Xs1irrT?cache_control=3600'
  WHERE project_id IN (
    SELECT id FROM projects WHERE name LIKE '%EcoVillage%Phase 2%'
  ) AND type LIKE '%B%' AND (image_url IS NULL OR image_url = '');

-- Type C — Premium Signature Villa (5-bed, ~430 m²)
UPDATE units SET image_url = 'https://www.genspark.ai/api/files/s/GdQeTTXz?cache_control=3600'
  WHERE project_id IN (
    SELECT id FROM projects WHERE name LIKE '%EcoVillage%Phase 2%'
  ) AND type LIKE '%C%' AND (image_url IS NULL OR image_url = '');

-- ── EcoVillage Phase 2 project-level hero image ────────────────────────
-- Applied to any EV2 project row created during demo (aerial architectural render)
UPDATE projects SET hero_image_url = 'https://www.genspark.ai/api/files/s/znKlE71c?cache_control=3600'
  WHERE name LIKE '%EcoVillage%Phase 2%'
  AND (hero_image_url IS NULL OR hero_image_url = '');

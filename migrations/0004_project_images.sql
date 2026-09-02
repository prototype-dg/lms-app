-- ============================================================
-- Migration 0004: Project hero images + unit image_url column
-- Images are permanent blob URLs — restored on every demo reset
-- ============================================================

-- Add image_url and gsas_score to units (idempotent via OR IGNORE on schema)
-- (D1 silently ignores duplicate column errors on ALTER ADD COLUMN)

-- ── Project hero images ────────────────────────────────────────
-- proj001  Al Mouj Residences      (active/completed) — real-photo luxury waterfront
UPDATE projects SET hero_image_url = '/static/img/proj001_hero.jpg'
  WHERE id = 'proj001' AND (hero_image_url IS NULL OR hero_image_url = '');

-- proj002  Seeb Heights Villas     (active/completed) — real-photo villa community
UPDATE projects SET hero_image_url = '/static/img/proj002_hero.jpg'
  WHERE id = 'proj002' AND (hero_image_url IS NULL OR hero_image_url = '');

-- proj003  Mabella View Apartments (archived/completed) — real-photo mid-rise
UPDATE projects SET hero_image_url = '/static/img/proj003_hero.jpg'
  WHERE id = 'proj003' AND (hero_image_url IS NULL OR hero_image_url = '');

-- proj004  EcoVillage Muscat Ph1   (draft/upcoming) — architectural render eco-villas
UPDATE projects SET hero_image_url = '/static/img/proj004_hero.jpg'
  WHERE id = 'proj004' AND (hero_image_url IS NULL OR hero_image_url = '');

-- ── EcoVillage Phase 2 unit type images ───────────────────────
-- These are referenced by the demo script when EcoVillage Phase 2
-- units are created in Act 2; also pre-applied to any existing EV2 rows.

-- Type A — Grand Family Villa (4-bed, ~360 m²)
UPDATE units SET image_url = '/static/img/ev2_type_a.jpg'
  WHERE project_id IN (
    SELECT id FROM projects WHERE name LIKE '%EcoVillage%Phase 2%'
  ) AND type LIKE '%A%' AND (image_url IS NULL OR image_url = '');

-- Type B — Compact Villa (3-bed, ~270 m²)
UPDATE units SET image_url = '/static/img/ev2_type_b.jpg'
  WHERE project_id IN (
    SELECT id FROM projects WHERE name LIKE '%EcoVillage%Phase 2%'
  ) AND type LIKE '%B%' AND (image_url IS NULL OR image_url = '');

-- Type C — Premium Signature Villa (5-bed, ~430 m²)
UPDATE units SET image_url = '/static/img/ev2_type_c.jpg'
  WHERE project_id IN (
    SELECT id FROM projects WHERE name LIKE '%EcoVillage%Phase 2%'
  ) AND type LIKE '%C%' AND (image_url IS NULL OR image_url = '');

-- ── EcoVillage Phase 2 project-level hero image ────────────────────────
-- Applied to any EV2 project row created during demo (aerial architectural render)
UPDATE projects SET hero_image_url = '/static/img/ev2_hero.jpg'
  WHERE name LIKE '%EcoVillage%Phase 2%'
  AND (hero_image_url IS NULL OR hero_image_url = '');

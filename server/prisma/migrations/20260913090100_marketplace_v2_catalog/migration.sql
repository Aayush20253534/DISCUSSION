INSERT INTO "shop_items" ("id", "sku", "name", "description", "type", "rarity", "price", "asset_key", "sort_order") VALUES
('20000000-0000-4000-8000-000000000001', 'outfit-arcane-robes', 'Scholar’s Astral Robes', 'Layered midnight robes stitched for adventurers who keep choosing one more page.', 'OUTFIT', 'RARE', 220, 'arcane-robes', 130),
('20000000-0000-4000-8000-000000000002', 'outfit-ember-cloak', 'Emberbound Cloak', 'A weathered cloak with a copper lining that seems warmer after difficult quests.', 'OUTFIT', 'EPIC', 320, 'ember-cloak', 140),
('20000000-0000-4000-8000-000000000003', 'outfit-celestial', 'Celestial Wayfarer', 'A legendary traveling coat marked with constellations visible only under moonlight.', 'OUTFIT', 'LEGENDARY', 520, 'celestial-wayfarer', 150),
('20000000-0000-4000-8000-000000000004', 'companion-forest-fox', 'Forest Fox', 'A patient little trail companion with suspiciously good instincts about taking breaks.', 'COMPANION', 'COMMON', 180, 'forest-fox', 160),
('20000000-0000-4000-8000-000000000005', 'companion-moon-wolf', 'Moon Wolf', 'A silver-eyed companion that keeps pace on the quietest stretches of the road.', 'COMPANION', 'RARE', 350, 'moon-wolf', 170),
('20000000-0000-4000-8000-000000000006', 'companion-arcane-owl', 'Arcane Owl', 'A watchful owl for scholars, night workers, and people who own far too many tabs.', 'COMPANION', 'EPIC', 420, 'arcane-owl', 180),
('20000000-0000-4000-8000-000000000007', 'companion-ember-drake', 'Ember Drake', 'A small dragon with a large opinion about abandoned quests.', 'COMPANION', 'LEGENDARY', 650, 'ember-drake', 190),
('20000000-0000-4000-8000-000000000008', 'companion-celestial-raven', 'Celestial Raven', 'A rare merchant companion said to remember roads its owner has not walked yet.', 'COMPANION', 'LEGENDARY', 720, 'celestial-raven', 200),
('20000000-0000-4000-8000-000000000009', 'aura-ember', 'Emberwake Aura', 'A restrained ring of warm sparks for momentum that refuses to disappear quietly.', 'AURA', 'RARE', 260, 'ember-aura', 210),
('20000000-0000-4000-8000-000000000010', 'aura-starlight', 'Starlight Wake', 'A legendary field of cold stars that follows the most persistent wanderers.', 'AURA', 'LEGENDARY', 540, 'starlight-aura', 220),
('20000000-0000-4000-8000-000000000011', 'aura-resolve', 'Crown of Resolve', 'A mythic aura discovered only by adventurers who have learned to return, again and again.', 'AURA', 'MYTHIC', 900, 'resolve-aura', 230),
('20000000-0000-4000-8000-000000000012', 'title-celestial-wanderer', 'The Celestial Wanderer', 'A legendary title carried by those whose progress has become impossible to mistake.', 'CHARACTER_TITLE', 'LEGENDARY', 480, 'celestial-wanderer', 240),
('20000000-0000-4000-8000-000000000013', 'title-flame-endures', 'The Flame That Endures', 'A mythic title revealed when every Emberbound relic finally answers the same call.', 'CHARACTER_TITLE', 'MYTHIC', 300, 'flame-endures', 250)
ON CONFLICT ("sku") DO NOTHING;

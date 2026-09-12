-- Part 7: reward shop, inventory, equipment and auditable gold ledger.
CREATE TYPE "ShopItemType" AS ENUM ('AVATAR_FRAME', 'PROFILE_BADGE', 'CHARACTER_TITLE', 'THEME');
CREATE TYPE "ItemRarity" AS ENUM ('COMMON', 'RARE', 'EPIC');
CREATE TYPE "EquipmentSlot" AS ENUM ('AVATAR_FRAME', 'PROFILE_BADGE', 'CHARACTER_TITLE', 'THEME');
CREATE TYPE "CurrencyTransactionType" AS ENUM ('QUEST_REWARD', 'SHOP_PURCHASE');

CREATE TABLE "shop_items" (
  "id" UUID NOT NULL,
  "sku" VARCHAR(64) NOT NULL,
  "name" VARCHAR(80) NOT NULL,
  "description" VARCHAR(400) NOT NULL,
  "type" "ShopItemType" NOT NULL,
  "rarity" "ItemRarity" NOT NULL DEFAULT 'COMMON',
  "price" INTEGER NOT NULL,
  "asset_key" VARCHAR(64) NOT NULL,
  "sort_order" INTEGER NOT NULL DEFAULT 0,
  "active" BOOLEAN NOT NULL DEFAULT true,
  "created_at" TIMESTAMPTZ(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updated_at" TIMESTAMPTZ(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "shop_items_pkey" PRIMARY KEY ("id"),
  CONSTRAINT "shop_items_price_positive" CHECK ("price" > 0),
  CONSTRAINT "shop_items_sort_nonnegative" CHECK ("sort_order" >= 0)
);

CREATE TABLE "inventory_items" (
  "id" UUID NOT NULL,
  "user_id" UUID NOT NULL,
  "shop_item_id" UUID NOT NULL,
  "price_paid" INTEGER NOT NULL,
  "purchased_at" TIMESTAMPTZ(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "inventory_items_pkey" PRIMARY KEY ("id"),
  CONSTRAINT "inventory_price_nonnegative" CHECK ("price_paid" >= 0)
);

CREATE TABLE "character_equipment" (
  "id" UUID NOT NULL,
  "user_id" UUID NOT NULL,
  "slot" "EquipmentSlot" NOT NULL,
  "inventory_item_id" UUID NOT NULL,
  "equipped_at" TIMESTAMPTZ(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "character_equipment_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "currency_transactions" (
  "id" UUID NOT NULL,
  "user_id" UUID NOT NULL,
  "type" "CurrencyTransactionType" NOT NULL,
  "amount" INTEGER NOT NULL,
  "balance_after" INTEGER NOT NULL,
  "quest_completion_id" UUID,
  "inventory_item_id" UUID,
  "created_at" TIMESTAMPTZ(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "currency_transactions_pkey" PRIMARY KEY ("id"),
  CONSTRAINT "currency_transactions_nonzero" CHECK ("amount" <> 0),
  CONSTRAINT "currency_transactions_balance_nonnegative" CHECK ("balance_after" >= 0),
  CONSTRAINT "currency_transactions_source_shape" CHECK (
    ("type" = 'QUEST_REWARD' AND "amount" > 0 AND "quest_completion_id" IS NOT NULL AND "inventory_item_id" IS NULL)
    OR
    ("type" = 'SHOP_PURCHASE' AND "amount" < 0 AND "inventory_item_id" IS NOT NULL AND "quest_completion_id" IS NULL)
  )
);

CREATE UNIQUE INDEX "shop_items_sku_key" ON "shop_items"("sku");
CREATE INDEX "shop_items_active_type_sort_order_id_idx" ON "shop_items"("active", "type", "sort_order", "id");
CREATE UNIQUE INDEX "inventory_items_user_id_shop_item_id_key" ON "inventory_items"("user_id", "shop_item_id");
CREATE UNIQUE INDEX "inventory_items_id_user_id_key" ON "inventory_items"("id", "user_id");
CREATE UNIQUE INDEX "quest_completions_id_user_id_key" ON "quest_completions"("id", "user_id");
CREATE INDEX "inventory_items_user_id_purchased_at_id_idx" ON "inventory_items"("user_id", "purchased_at", "id");
CREATE INDEX "inventory_items_shop_item_id_idx" ON "inventory_items"("shop_item_id");
CREATE UNIQUE INDEX "character_equipment_inventory_item_id_key" ON "character_equipment"("inventory_item_id");
CREATE UNIQUE INDEX "character_equipment_user_id_slot_key" ON "character_equipment"("user_id", "slot");
CREATE INDEX "character_equipment_user_id_equipped_at_idx" ON "character_equipment"("user_id", "equipped_at");
CREATE UNIQUE INDEX "currency_transactions_quest_completion_id_key" ON "currency_transactions"("quest_completion_id");
CREATE UNIQUE INDEX "currency_transactions_inventory_item_id_key" ON "currency_transactions"("inventory_item_id");
CREATE INDEX "currency_transactions_user_id_created_at_id_idx" ON "currency_transactions"("user_id", "created_at", "id");

ALTER TABLE "inventory_items" ADD CONSTRAINT "inventory_items_user_id_fkey"
  FOREIGN KEY ("user_id") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "inventory_items" ADD CONSTRAINT "inventory_items_shop_item_id_fkey"
  FOREIGN KEY ("shop_item_id") REFERENCES "shop_items"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "character_equipment" ADD CONSTRAINT "character_equipment_user_id_fkey"
  FOREIGN KEY ("user_id") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "character_equipment" ADD CONSTRAINT "character_equipment_inventory_item_id_fkey"
  FOREIGN KEY ("inventory_item_id") REFERENCES "inventory_items"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "character_equipment" ADD CONSTRAINT "character_equipment_owner_fkey"
  FOREIGN KEY ("inventory_item_id", "user_id") REFERENCES "inventory_items"("id", "user_id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "currency_transactions" ADD CONSTRAINT "currency_transactions_user_id_fkey"
  FOREIGN KEY ("user_id") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "currency_transactions" ADD CONSTRAINT "currency_transactions_quest_completion_id_fkey"
  FOREIGN KEY ("quest_completion_id") REFERENCES "quest_completions"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "currency_transactions" ADD CONSTRAINT "currency_transactions_inventory_item_id_fkey"
  FOREIGN KEY ("inventory_item_id") REFERENCES "inventory_items"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "currency_transactions" ADD CONSTRAINT "currency_transactions_quest_owner_fkey"
  FOREIGN KEY ("quest_completion_id", "user_id") REFERENCES "quest_completions"("id", "user_id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "currency_transactions" ADD CONSTRAINT "currency_transactions_inventory_owner_fkey"
  FOREIGN KEY ("inventory_item_id", "user_id") REFERENCES "inventory_items"("id", "user_id") ON DELETE CASCADE ON UPDATE CASCADE;

-- Curated catalog. Stable UUIDs/SLUGs make the catalog reproducible in every environment.
INSERT INTO "shop_items" ("id", "sku", "name", "description", "type", "rarity", "price", "asset_key", "sort_order") VALUES
('10000000-0000-4000-8000-000000000001', 'frame-moonlit', 'Moonlit Wanderer', 'A quiet silver halo for adventurers who find inspiration after dark.', 'AVATAR_FRAME', 'RARE', 120, 'moonlit', 10),
('10000000-0000-4000-8000-000000000002', 'frame-evergreen', 'Evergreen Oath', 'A living ring of leaves for the hero who keeps showing up.', 'AVATAR_FRAME', 'COMMON', 90, 'evergreen', 20),
('10000000-0000-4000-8000-000000000003', 'frame-ember', 'Emberbound', 'A warm copper frame for momentum that refuses to go cold.', 'AVATAR_FRAME', 'EPIC', 180, 'ember', 30),
('10000000-0000-4000-8000-000000000004', 'badge-forest', 'Keeper of the Forest', 'A small reminder that remarkable things grow a little every day.', 'PROFILE_BADGE', 'COMMON', 80, 'forest-keeper', 40),
('10000000-0000-4000-8000-000000000005', 'badge-starlit', 'Starlit Focus', 'For the nights when one more page, problem, or practice session mattered.', 'PROFILE_BADGE', 'RARE', 110, 'starlit-focus', 50),
('10000000-0000-4000-8000-000000000006', 'badge-unbroken', 'Unbroken Thread', 'A mark for returning to the path even after difficult days.', 'PROFILE_BADGE', 'EPIC', 160, 'unbroken-thread', 60),
('10000000-0000-4000-8000-000000000007', 'title-golden', 'A Golden Beginning', 'Carry a little sunrise into the next chapter of your story.', 'CHARACTER_TITLE', 'COMMON', 60, 'golden-beginning', 70),
('10000000-0000-4000-8000-000000000008', 'title-momentum', 'Keeper of Momentum', 'For the adventurer who learned that consistency beats spectacle.', 'CHARACTER_TITLE', 'RARE', 100, 'keeper-momentum', 80),
('10000000-0000-4000-8000-000000000009', 'title-quietly', 'Quietly Unstoppable', 'A title for patient progress that has nothing left to prove.', 'CHARACTER_TITLE', 'EPIC', 150, 'quietly-unstoppable', 90),
('10000000-0000-4000-8000-000000000010', 'theme-moonlit', 'Moonlit Journal', 'Cool indigo accents and silver light for a calmer night-time journal.', 'THEME', 'RARE', 200, 'moonlit', 100),
('10000000-0000-4000-8000-000000000011', 'theme-verdant', 'Verdant Trail', 'Deep green accents inspired by moss, pine, and steady forward motion.', 'THEME', 'COMMON', 170, 'verdant', 110),
('10000000-0000-4000-8000-000000000012', 'theme-ember', 'Ember Chronicle', 'Warm copper accents for quests powered by stubborn little sparks.', 'THEME', 'EPIC', 240, 'ember', 120);

-- Existing quest rewards become ledger entries without changing any balances.
-- The completion snapshot already stores the exact balance immediately after that reward.
INSERT INTO "currency_transactions" (
  "id", "user_id", "type", "amount", "balance_after", "quest_completion_id", "created_at"
)
SELECT
  md5(qc."id"::text || ':gold')::uuid,
  qc."user_id",
  'QUEST_REWARD'::"CurrencyTransactionType",
  qc."gold_awarded",
  qc."gold_after",
  qc."id",
  qc."completed_at"
FROM "quest_completions" qc
WHERE qc."gold_awarded" > 0;

# Part 7 — Reward shop, inventory, equipment and gold ledger

Part 7 turns gold from a decorative counter into a server-authoritative cosmetic economy. It builds on the Part 4 reward transaction and Part 6 recurring-quest rules without changing XP balance or quest rewards.

## Product contract

The economy is deliberately cosmetic. Shop items never modify quest XP, reward multipliers, streaks, attributes, or completion eligibility. The initial catalog contains four equipment types:

- `AVATAR_FRAME`
- `PROFILE_BADGE`
- `CHARACTER_TITLE`
- `THEME`

A user can own each catalog item once. One item may be equipped in each matching slot. Unequipping never deletes ownership.

## Database model

Migration `20260912000600_reward_shop_inventory` adds:

- `shop_items` — curated catalog rows with stable SKU, type, rarity, price and visual asset key.
- `inventory_items` — immutable ownership receipts. `UNIQUE(user_id, shop_item_id)` prevents duplicate ownership.
- `character_equipment` — one equipped inventory item per slot.
- `currency_transactions` — append-only gold movements for quest rewards and marketplace purchases.

The migration seeds 12 cosmetics: three frames, three badges, three titles and three themes. It also backfills existing quest-completion gold into the new ledger using the completion's saved `gold_after` snapshot. No character balance is recalculated or changed during the migration.

Important invariants are enforced in PostgreSQL as well as application code:

- shop prices must be positive;
- inventory purchase prices cannot be negative;
- a user cannot own the same catalog item twice;
- an inventory item can occupy at most one equipment slot;
- a user can equip at most one item per slot;
- each quest completion and each purchase can generate at most one currency transaction;
- ledger balances cannot be negative;
- reward ledger rows must be positive and reference a quest completion;
- purchase ledger rows must be negative and reference an inventory item.

## Purchase transaction

`POST /api/v1/shop/items/:id/purchase` is the only purchase path.

Inside one PostgreSQL transaction the server:

1. locks the user's character row with `FOR UPDATE`;
2. loads the active catalog item;
3. checks existing ownership;
4. checks the current stored gold balance;
5. decrements gold;
6. creates the inventory ownership row;
7. appends the negative wallet transaction;
8. commits everything together.

The character-row lock is shared with quest completion. A quest reward and a purchase therefore cannot race against the same stale gold balance. Two tabs purchasing simultaneously serialize at the wallet row. Repeating a purchase for an already-owned item returns the existing ownership and does not deduct gold again.

`characters.gold >= 0` remains protected by the database constraint established in Part 1, so even a programming mistake cannot commit a negative stored balance.

## Quest reward ledger integration

Part 4 already awards gold inside the completion transaction. Part 7 now creates a `QUEST_REWARD` currency transaction immediately after the immutable completion receipt is created and before the transaction commits.

If the ledger insert fails, the quest status, XP, attribute XP, gold, completion receipt and ledger row all roll back together. This keeps the wallet history consistent with the authoritative character balance.

## API

All economy endpoints require a live authenticated session and completed character onboarding. Mutating endpoints also require the existing signed CSRF token and allowed `Origin`.

### Catalog

`GET /api/v1/shop/catalog?type=ALL`

Returns:

- current gold balance;
- active catalog items;
- owned state;
- equipped state.

Allowed filters are `ALL`, `AVATAR_FRAME`, `PROFILE_BADGE`, `CHARACTER_TITLE`, and `THEME`.

### Purchase

`POST /api/v1/shop/items/:id/purchase`

Responses:

- `201` — newly purchased;
- `200` — safe replay of an already-owned reward;
- `409 INSUFFICIENT_GOLD` — no balance or ownership mutation;
- `404 SHOP_ITEM_NOT_FOUND` — item is absent or no longer active.

### Inventory

`GET /api/v1/inventory?type=ALL`

Returns owned items, purchase price/time, current equipment slot, all equipped slots and current balance.

### Equipment

`PUT /api/v1/inventory/equipment/:slot`

Body:

```json
{ "inventoryItemId": "uuid" }
```

The server verifies that the inventory row belongs to the authenticated user and that the catalog item type matches the requested slot.

`DELETE /api/v1/inventory/equipment/:slot` unequips a slot without deleting ownership.

### Wallet history

`GET /api/v1/wallet?page=1&limit=12`

Returns the current authoritative balance plus paginated, newest-first ledger entries. Entries identify whether gold came from a quest or was spent on a marketplace reward.

## Frontend

### Marketplace

The previous read-only preview is replaced by a real database catalog with:

- category filters;
- current gold balance;
- item rarity and price;
- owned/equipped states;
- insufficient-gold messaging;
- purchase preview and server-confirmed purchase action;
- loading, empty and recoverable error states;
- a direct path to Inventory.

Gold is not optimistically decremented. Purchases affect the UI only after the server transaction succeeds.

### Inventory

`/inventory` provides:

- current loadout;
- owned reward filtering;
- equip/unequip actions;
- purchase metadata;
- wallet history and pagination;
- marketplace return action.

### Equipped cosmetics

Equipped rewards now affect real application surfaces:

- avatar frames render around the character portrait in the sidebar, dashboard and Character page;
- character titles replace the default title in character surfaces;
- profile badges appear on the dashboard and Character page;
- themes change the application's global accent palette and shell background.

Theme state comes from `/auth/me`, so it survives refresh, login on another device and cross-tab updates. The underlying base theme remains readable and the cosmetics do not alter progression logic.

## Cross-tab consistency

Economy mutations broadcast `life-rpg-economy`. Other tabs invalidate:

- economy catalog/inventory/wallet queries;
- progression summary;
- authenticated user data.

This keeps gold, ownership and equipped cosmetics synchronized without trusting local storage as a source of truth.

## Test coverage

`server/tests/economy.test.js` covers:

- seeded catalog and filtering;
- quest rewards entering the wallet ledger;
- insufficient-funds rollback;
- repeated and concurrent purchase idempotency;
- concurrent overspend prevention;
- equipment type validation;
- auth-visible equipped state;
- cross-account inventory isolation;
- auth, onboarding and CSRF enforcement;
- user-deletion cascades while the global catalog remains.

`shared/tests/economy.test.js` covers the shared request contracts and bounded wallet pagination.

## Upgrade

From a verified Part 6 checkout:

```powershell
npm run db:generate
npm run db:deploy
npm run verify
npm run dev
```

Do not reset the database. Migration 006 is additive and backfills ledger history without changing existing balances.

## Manual smoke test

1. Sign in to an existing onboarded account.
2. Complete enough quests to earn at least 60 gold.
3. Open Marketplace and purchase `A Golden Beginning`.
4. Confirm the gold balance falls exactly once.
5. Refresh and confirm the item remains owned.
6. Open Inventory and equip the title.
7. Refresh and confirm the title remains equipped on Character/sidebar surfaces.
8. Open wallet history and confirm the quest earnings and purchase debit are present.
9. Open a second tab, equip a different owned item, and confirm the first tab refreshes its cosmetics.
10. Try to buy the same item again and confirm no extra gold is deducted.

import { useEffect, useState } from 'react'
import { motion } from 'motion/react'
import {
  Backpack,
  Check,
  Coins,
  History,
  LoaderCircle,
  PackageCheck,
  PackageOpen,
  Sparkles,
  Store,
} from 'lucide-react'
import { SHOP_ITEM_TYPES } from '@life-rpg/shared'
import { Link } from 'react-router-dom'
import EconomyNotice from '../economy/EconomyNotice.jsx'
import RewardArtwork from '../economy/RewardArtwork.jsx'
import { useEquipmentMutation, useInventory, useWallet } from '../economy/hooks.js'
import { useInteractionFeedback } from '../interactions/interaction-context.js'

const filters = [{ key: 'ALL', name: 'All treasures' }, ...SHOP_ITEM_TYPES]
const slotLabel = (slot) => SHOP_ITEM_TYPES.find(({ slot: value }) => value === slot)?.name || slot
const typeName = (type) => SHOP_ITEM_TYPES.find(({ key }) => key === type)?.name || type
const slotForType = (type) => SHOP_ITEM_TYPES.find(({ key }) => key === type)?.slot
const formatDate = (value) =>
  new Intl.DateTimeFormat(undefined, { dateStyle: 'medium', timeStyle: 'short' }).format(new Date(value))

export default function Inventory() {
  const [type, setType] = useState('ALL')
  const [walletPage, setWalletPage] = useState(1)
  const [pendingItemId, setPendingItemId] = useState(null)
  const [recentItemId, setRecentItemId] = useState(null)
  const inventory = useInventory(type)
  const wallet = useWallet(walletPage, 8)
  const equipment = useEquipmentMutation()
  const { moving, notify } = useInteractionFeedback()

  useEffect(() => {
    if (!recentItemId) return
    const timer = window.setTimeout(() => setRecentItemId(null), 1800)
    return () => window.clearTimeout(timer)
  }, [recentItemId])

  async function toggle(item) {
    const slot = slotForType(item.item.type)
    if (!slot || equipment.isPending) return
    const equipping = !item.equippedSlot
    setPendingItemId(item.id)
    try {
      const result = await equipment.mutateAsync({
        slot,
        inventoryItemId: equipping ? item.id : null,
      })
      setRecentItemId(item.id)
      notify({
        key: result.equipment ? `equip:${slot}:${result.equipment.equippedAt}` : undefined,
        tone: 'equip',
        title: equipping ? `${item.item.name} equipped` : `${item.item.name} unequipped`,
        detail: `${slotLabel(slot)} updated`,
        sound: 'equip',
      })
    } catch {
      // The mutation state renders the server error without creating an unhandled rejection.
    } finally {
      setPendingItemId(null)
    }
  }

  return (
    <div className="page inventory-page inventory-vault-page">
      <header className="inventory-world-heading">
        <div>
          <span className="eyebrow">THE ADVENTURER&apos;S VAULT</span>
          <h1>
            Treasures you have <em>earned.</em>
          </h1>
          <p>
            Every relic here came from real effort. Equip your favorites, shape your adventurer,
            and keep a record of every piece of gold that crossed your path.
          </p>
        </div>
        <div className="inventory-heading-actions">
          <div className="market-wallet" aria-label={`${inventory.data?.balance ?? 0} gold available`}>
            <Coins size={18} />
            <span>
              <strong>{(inventory.data?.balance ?? 0).toLocaleString()}</strong>
              <small>YOUR GOLD</small>
            </span>
          </div>
          <Link to="/marketplace" className="button button-gold">
            <Store size={15} /> Return to Emporium
          </Link>
        </div>
      </header>

      <EconomyNotice query={inventory} />

      <section className="panel inventory-loadout-section" aria-label="Equipped cosmetics">
        <div className="inventory-section-heading">
          <div>
            <span className="eyebrow">WHAT TRAVELS WITH YOU</span>
            <h2>Your current loadout</h2>
            <p>These are the treasures presently woven into your character.</p>
          </div>
          <span className="inventory-section-sigil" aria-hidden="true">
            <Sparkles size={20} />
          </span>
        </div>

        <div className="inventory-equipment-grid">
          {SHOP_ITEM_TYPES.map(({ slot, name }) => {
            const row = inventory.data?.equipment?.find((entry) => entry.slot === slot)
            return (
              <motion.div
                layout={moving}
                className={`inventory-equipment-slot ${
                  recentItemId && row?.inventoryItemId === recentItemId ? 'equipment-slot-updated' : ''
                }`}
                key={slot}
                transition={{ duration: moving ? 0.25 : 0 }}
              >
                {row ? (
                  <RewardArtwork item={row.item} compact />
                ) : (
                  <span className="inventory-empty-slot">
                    <Backpack size={21} />
                  </span>
                )}
                <div>
                  <small>{name}</small>
                  <strong>{row?.item.name || 'Nothing equipped'}</strong>
                  <span>{row ? 'Travelling with you' : 'Awaiting a treasure'}</span>
                </div>
              </motion.div>
            )
          })}
        </div>
      </section>

      <section className="inventory-treasures-section" aria-labelledby="owned-treasures-heading">
        <div className="inventory-section-heading inventory-catalog-heading">
          <div>
            <span className="eyebrow">YOUR CLAIMED TREASURES</span>
            <h2 id="owned-treasures-heading">The vault shelves</h2>
            <p>Equip or swap anything you own. Cosmetic rewards never change gameplay power.</p>
          </div>
          <span className="inventory-owned-mark">
            <PackageCheck size={15} /> {inventory.data?.items?.length ?? 0} on this shelf
          </span>
        </div>

        <div className="reward-filters inventory-filters" role="group" aria-label="Filter inventory">
          {filters.map((filter) => (
            <button
              key={filter.key}
              type="button"
              className={type === filter.key ? 'active' : ''}
              aria-pressed={type === filter.key}
              onClick={() => setType(filter.key)}
            >
              {filter.name}
            </button>
          ))}
        </div>

        {inventory.isPending ? (
          <div className="inventory-vault-grid">
            {[0, 1, 2, 3].map((key) => (
              <div className="panel inventory-vault-card inventory-skeleton skeleton" key={key} />
            ))}
          </div>
        ) : inventory.data?.items?.length ? (
          <div className="inventory-vault-grid" aria-label="Owned rewards">
            {inventory.data.items.map((item) => {
              const pending = pendingItemId === item.id
              const recent = recentItemId === item.id
              return (
                <motion.article
                  layout={moving}
                  className={`panel inventory-vault-card ${item.equippedSlot ? 'equipped' : ''} ${
                    recent ? 'inventory-card-updated' : ''
                  }`}
                  key={item.id}
                  aria-busy={pending}
                  animate={recent && moving ? { scale: [1, 1.012, 1] } : { scale: 1 }}
                  transition={{ duration: moving ? 0.4 : 0 }}
                >
                  <div className="inventory-vault-art">
                    <RewardArtwork item={item.item} />
                    {item.equippedSlot && (
                      <span className="inventory-equipped-ribbon">
                        <Check size={12} /> Equipped
                      </span>
                    )}
                  </div>
                  <div className="inventory-vault-copy">
                    <div className="item-label-row">
                      <span className="eyebrow">{typeName(item.item.type)}</span>
                      <span className={`rarity rarity-${item.item.rarity.toLowerCase()}`}>
                        {item.item.rarity}
                      </span>
                    </div>
                    <h3>{item.item.name}</h3>
                    <p>{item.item.description}</p>
                    <small>
                      Claimed {formatDate(item.purchasedAt)} · {item.pricePaid} gold
                    </small>
                    <button
                      className={item.equippedSlot ? 'button button-outline' : 'button button-gold'}
                      disabled={equipment.isPending}
                      aria-busy={pending}
                      onClick={() => toggle(item)}
                    >
                      {pending ? (
                        <>
                          <LoaderCircle className="spin" size={14} />
                          {item.equippedSlot ? 'Removing…' : 'Equipping…'}
                        </>
                      ) : (
                        <>
                          {item.equippedSlot ? 'Unequip' : 'Equip treasure'}
                          {item.equippedSlot && <Check size={14} />}
                        </>
                      )}
                    </button>
                  </div>
                </motion.article>
              )
            })}
          </div>
        ) : (
          <div className="panel economy-empty inventory-vault-empty">
            <PackageOpen size={30} />
            <h2>This shelf is still waiting.</h2>
            <p>Complete quests, earn gold, then bring something home from the Emporium.</p>
            <Link className="button button-outline" to="/marketplace">
              Browse the Emporium
            </Link>
          </div>
        )}
        {equipment.isError && (
          <p className="form-error economy-action-error" role="alert">
            {equipment.error.message}
          </p>
        )}
      </section>

      <section className="panel wallet-panel inventory-ledger-panel">
        <div className="inventory-section-heading compact-heading">
          <div>
            <span className="eyebrow">THE GOLD LEDGER</span>
            <h2>Where your gold has travelled</h2>
            <p>Quest rewards arrive here. Every trade at the Emporium leaves a line in the ledger.</p>
          </div>
          <span className="inventory-section-sigil" aria-hidden="true">
            <History size={19} />
          </span>
        </div>
        <EconomyNotice query={wallet} />
        <div className="wallet-list">
          {wallet.data?.transactions?.map((transaction) => (
            <div className="wallet-row" key={transaction.id}>
              <span className={`wallet-sign ${transaction.amount > 0 ? 'earned' : 'spent'}`}>
                {transaction.amount > 0 ? '+' : '−'}
              </span>
              <div>
                <strong>{transaction.source.label}</strong>
                <small>
                  {transaction.type === 'QUEST_REWARD' ? 'Quest reward' : 'Emporium purchase'} ·{' '}
                  {formatDate(transaction.createdAt)}
                </small>
              </div>
              <span className={transaction.amount > 0 ? 'earned' : 'spent'}>
                {transaction.amount > 0 ? '+' : ''}
                {transaction.amount} gold
              </span>
              <small>{transaction.balanceAfter} after</small>
            </div>
          ))}
          {!wallet.isPending && !wallet.data?.transactions?.length && (
            <p className="catalog-note">Your gold story begins with the first completed quest.</p>
          )}
        </div>
        {(wallet.data?.pagination?.pages || 1) > 1 && (
          <div className="wallet-pagination">
            <button
              className="button button-outline"
              disabled={walletPage <= 1}
              onClick={() => setWalletPage((page) => page - 1)}
            >
              Newer
            </button>
            <span>
              Page {wallet.data.pagination.page} of {wallet.data.pagination.pages}
            </span>
            <button
              className="button button-outline"
              disabled={walletPage >= wallet.data.pagination.pages}
              onClick={() => setWalletPage((page) => page + 1)}
            >
              Older
            </button>
          </div>
        )}
      </section>
    </div>
  )
}

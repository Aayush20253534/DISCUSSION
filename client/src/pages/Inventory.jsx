import { useEffect, useState } from 'react'
import { motion } from 'motion/react'
import { Backpack, Check, Coins, History, LoaderCircle, PackageOpen, Sparkles } from 'lucide-react'
import { SHOP_ITEM_TYPES } from '@life-rpg/shared'
import { Link } from 'react-router-dom'
import { PageHeading } from '../components/ui.jsx'
import EconomyNotice from '../economy/EconomyNotice.jsx'
import RewardArtwork from '../economy/RewardArtwork.jsx'
import { useEquipmentMutation, useInventory, useWallet } from '../economy/hooks.js'
import { useInteractionFeedback } from '../interactions/interaction-context.js'

const filters = [{ key: 'ALL', name: 'All rewards' }, ...SHOP_ITEM_TYPES]
const slotLabel = (slot) => SHOP_ITEM_TYPES.find(({ slot: value }) => value === slot)?.name || slot
const slotForType = (type) => SHOP_ITEM_TYPES.find(({ key }) => key === type)?.slot
const formatDate = (value) => new Intl.DateTimeFormat(undefined, { dateStyle: 'medium', timeStyle: 'short' }).format(new Date(value))

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
    <div className="page inventory-page">
      <PageHeading
        eyebrow="WHAT YOU EARNED STAYS YOURS"
        title={<>Your <em>inventory.</em></>}
        description="Equip the rewards you own, change your look freely, and review where every piece of gold went."
      />

      <div className="inventory-topline">
        <span><Coins size={17} /> <strong>{(inventory.data?.balance ?? 0).toLocaleString()}</strong> gold available</span>
        <Link to="/marketplace" className="button button-gold">Visit marketplace</Link>
      </div>

      <section className="equipment-strip panel" aria-label="Equipped cosmetics">
        <div className="section-heading compact-heading">
          <div><span className="eyebrow">YOUR CURRENT LOADOUT</span><h2>Equipped rewards</h2></div>
          <Sparkles size={18} className="gold" />
        </div>
        <div className="equipment-slots">
          {SHOP_ITEM_TYPES.map(({ slot, name }) => {
            const row = inventory.data?.equipment?.find((entry) => entry.slot === slot)
            return (
              <motion.div
                layout={moving}
                className={`equipment-slot ${recentItemId && row?.inventoryItemId === recentItemId ? 'equipment-slot-updated' : ''}`}
                key={slot}
                transition={{ duration: moving ? 0.25 : 0 }}
              >
                {row ? <RewardArtwork item={row.item} compact /> : <span className="empty-slot"><Backpack size={22} /></span>}
                <div><small>{name}</small><strong>{row?.item.name || 'Nothing equipped'}</strong></div>
              </motion.div>
            )
          })}
        </div>
      </section>

      <div className="reward-filters inventory-filters" role="group" aria-label="Filter inventory">
        {filters.map((filter) => (
          <button key={filter.key} type="button" className={type === filter.key ? 'active' : ''} aria-pressed={type === filter.key} onClick={() => setType(filter.key)}>{filter.name}</button>
        ))}
      </div>
      <EconomyNotice query={inventory} />

      {inventory.isPending ? (
        <div className="inventory-grid">{[0, 1, 2, 3].map((key) => <div className="panel inventory-skeleton skeleton" key={key} />)}</div>
      ) : inventory.data?.items?.length ? (
        <section className="inventory-grid" aria-label="Owned rewards">
          {inventory.data.items.map((item) => {
            const pending = pendingItemId === item.id
            const recent = recentItemId === item.id
            return (
              <motion.article
                layout={moving}
                className={`panel inventory-card ${item.equippedSlot ? 'equipped' : ''} ${recent ? 'inventory-card-updated' : ''}`}
                key={item.id}
                aria-busy={pending}
                animate={recent && moving ? { scale: [1, 1.012, 1] } : { scale: 1 }}
                transition={{ duration: moving ? 0.4 : 0 }}
              >
                <RewardArtwork item={item.item} compact />
                <div className="inventory-card-copy">
                  <span className="eyebrow">{slotLabel(item.item.type)}</span>
                  <h2>{item.item.name}</h2>
                  <p>{item.item.description}</p>
                  <small>Purchased {formatDate(item.purchasedAt)} · {item.pricePaid} gold</small>
                </div>
                <button
                  className={item.equippedSlot ? 'button button-outline' : 'button button-gold'}
                  disabled={equipment.isPending}
                  aria-busy={pending}
                  onClick={() => toggle(item)}
                >
                  {pending ? (
                    <><LoaderCircle className="spin" size={14} /> {item.equippedSlot ? 'Removing…' : 'Equipping…'}</>
                  ) : (
                    <>{item.equippedSlot ? 'Unequip' : 'Equip'} {item.equippedSlot && <Check size={14} />}</>
                  )}
                </button>
              </motion.article>
            )
          })}
        </section>
      ) : (
        <div className="panel economy-empty"><PackageOpen size={30} /><h2>Your pack is empty.</h2><p>Complete quests, earn gold, then choose something worth carrying.</p><Link className="text-link" to="/marketplace">Browse the market</Link></div>
      )}
      {equipment.isError && <p className="form-error economy-action-error" role="alert">{equipment.error.message}</p>}

      <section className="panel wallet-panel">
        <div className="section-heading compact-heading">
          <div><span className="eyebrow">GOLD, ACCOUNTED FOR</span><h2>Wallet history</h2></div>
          <History size={18} className="gold" />
        </div>
        <EconomyNotice query={wallet} />
        <div className="wallet-list">
          {wallet.data?.transactions?.map((transaction) => (
            <div className="wallet-row" key={transaction.id}>
              <span className={`wallet-sign ${transaction.amount > 0 ? 'earned' : 'spent'}`}>{transaction.amount > 0 ? '+' : '−'}</span>
              <div><strong>{transaction.source.label}</strong><small>{transaction.type === 'QUEST_REWARD' ? 'Quest reward' : 'Marketplace purchase'} · {formatDate(transaction.createdAt)}</small></div>
              <span className={transaction.amount > 0 ? 'earned' : 'spent'}>{transaction.amount > 0 ? '+' : ''}{transaction.amount} gold</span>
              <small>{transaction.balanceAfter} after</small>
            </div>
          ))}
          {!wallet.isPending && !wallet.data?.transactions?.length && <p className="catalog-note">Your gold story begins with the first completed quest.</p>}
        </div>
        {(wallet.data?.pagination?.pages || 1) > 1 && (
          <div className="wallet-pagination">
            <button className="button button-outline" disabled={walletPage <= 1} onClick={() => setWalletPage((page) => page - 1)}>Newer</button>
            <span>Page {wallet.data.pagination.page} of {wallet.data.pagination.pages}</span>
            <button className="button button-outline" disabled={walletPage >= wallet.data.pagination.pages} onClick={() => setWalletPage((page) => page + 1)}>Older</button>
          </div>
        )}
      </section>
    </div>
  )
}

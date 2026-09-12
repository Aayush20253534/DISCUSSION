import { useMemo, useState } from 'react'
import { Check, Coins, PackageCheck, ShoppingBag, Sparkles } from 'lucide-react'
import { SHOP_ITEM_TYPES } from '@life-rpg/shared'
import { Link } from 'react-router-dom'
import { Modal, PageHeading } from '../components/ui.jsx'
import EconomyNotice from '../economy/EconomyNotice.jsx'
import RewardArtwork from '../economy/RewardArtwork.jsx'
import { useCatalog, usePurchase } from '../economy/hooks.js'

const filters = [{ key: 'ALL', name: 'All treasures' }, ...SHOP_ITEM_TYPES]
const typeName = (type) => SHOP_ITEM_TYPES.find(({ key }) => key === type)?.name || type

export default function Marketplace() {
  const [type, setType] = useState('ALL')
  const [selected, setSelected] = useState(null)
  const [message, setMessage] = useState('')
  const catalog = useCatalog(type)
  const purchase = usePurchase()
  const items = useMemo(() => catalog.data?.items ?? [], [catalog.data?.items])
  const selectedLive = useMemo(
    () => (selected ? items.find((item) => item.id === selected.id) || selected : null),
    [items, selected],
  )

  async function buy() {
    if (!selectedLive || selectedLive.owned) return
    setMessage('')
    try {
      const data = await purchase.mutateAsync(selectedLive.id)
      setMessage(
        data.purchased
          ? `${selectedLive.name} is now in your inventory.`
          : `${selectedLive.name} was already in your inventory.`,
      )
      setSelected(null)
    } catch {
      // Mutation error is rendered inside the modal and remains actionable.
    }
  }

  return (
    <div className="page market-page">
      <PageHeading
        eyebrow="LITTLE TREASURES, WELL EARNED"
        title={<>The wandering <em>market.</em></>}
        description="Spend only the gold you earned through real quests. Cosmetics change your story, never your power."
      />

      <div className="market-intro">
        <Sparkles size={23} />
        <p>
          Make your character feel a little more like you.
          <br />
          <span>Every purchase is permanent, cosmetic, and recorded in your gold ledger.</span>
        </p>
        <span className="market-balance" aria-label={`${catalog.data?.balance ?? 0} gold available`}>
          <Coins size={17} />
          {(catalog.data?.balance ?? 0).toLocaleString()} <small>YOUR GOLD</small>
        </span>
      </div>

      <div className="market-actions">
        <div className="reward-filters" role="group" aria-label="Filter reward catalog">
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
        <Link className="button button-outline" to="/inventory">
          <PackageCheck size={16} /> My inventory
        </Link>
      </div>

      <EconomyNotice query={catalog} />
      <div className="sr-only" aria-live="polite">{message}</div>
      {message && <div className="market-success"><Check size={16} /> {message}</div>}

      {catalog.isPending ? (
        <section className="market-grid" aria-label="Loading reward catalog">
          {[0, 1, 2, 3, 4, 5].map((key) => <div className="panel market-skeleton skeleton" key={key} />)}
        </section>
      ) : items.length ? (
        <section className="market-grid" aria-label="Reward catalog">
          {items.map((item) => {
            const short = catalog.data.balance < item.price ? item.price - catalog.data.balance : 0
            return (
              <article className={`panel item-card ${item.owned ? 'owned' : ''}`} key={item.id}>
                <RewardArtwork item={item} />
                <div className="item-copy">
                  <div className="item-label-row">
                    <span className="eyebrow">{typeName(item.type)}</span>
                    <span className={`rarity rarity-${item.rarity.toLowerCase()}`}>{item.rarity}</span>
                  </div>
                  <h2>{item.name}</h2>
                  <p>{item.description}</p>
                  <div className="item-state">
                    {item.equipped ? <span><Check size={13} /> Equipped</span> : item.owned ? <span><PackageCheck size={13} /> Owned</span> : short ? <span>{short} gold short</span> : <span>Ready to claim</span>}
                  </div>
                  <div className="item-footer">
                    <span className="gold"><Coins size={16} />{item.price} gold</span>
                    {item.owned ? (
                      <Link className="button button-outline" to="/inventory">Manage</Link>
                    ) : (
                      <button className="button button-outline" onClick={() => { purchase.reset(); setSelected(item) }}>Preview</button>
                    )}
                  </div>
                </div>
              </article>
            )
          })}
        </section>
      ) : (
        <div className="panel economy-empty">
          <ShoppingBag size={30} />
          <h2>No treasures on this shelf yet.</h2>
          <p>Try another category.</p>
        </div>
      )}

      <Modal
        open={Boolean(selectedLive)}
        onOpenChange={(open) => !open && setSelected(null)}
        title={selectedLive?.name || 'Reward preview'}
        description={selectedLive?.description || ''}
      >
        {selectedLive && (
          <>
            <RewardArtwork item={selectedLive} />
            <div className="purchase-summary">
              <span>Price <strong>{selectedLive.price} gold</strong></span>
              <span>After purchase <strong>{Math.max(0, (catalog.data?.balance || 0) - selectedLive.price)} gold</strong></span>
            </div>
            {purchase.isError && <p className="form-error" role="alert">{purchase.error.message}</p>}
            <p className="modal-note">Purchases are cosmetic and permanent. The server deducts gold and grants ownership in one transaction.</p>
            <button
              className="button button-gold full-width"
              disabled={purchase.isPending || selectedLive.owned || (catalog.data?.balance || 0) < selectedLive.price}
              onClick={buy}
            >
              {purchase.isPending ? 'Claiming treasure…' : (catalog.data?.balance || 0) < selectedLive.price ? 'Not enough gold yet' : 'Purchase reward'}
            </button>
          </>
        )}
      </Modal>
    </div>
  )
}

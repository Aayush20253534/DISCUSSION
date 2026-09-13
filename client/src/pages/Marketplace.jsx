import { useEffect, useMemo, useRef, useState } from 'react'
import { motion } from 'motion/react'
import {
  Check,
  Clock3,
  Coins,
  Crown,
  Gem,
  LoaderCircle,
  LockKeyhole,
  PackageCheck,
  ShoppingBag,
  Sparkles,
  Store,
  WandSparkles,
} from 'lucide-react'
import { SHOP_ITEM_TYPES } from '@life-rpg/shared'
import { Link } from 'react-router-dom'
import { Modal } from '../components/ui.jsx'
import EconomyNotice from '../economy/EconomyNotice.jsx'
import RewardArtwork from '../economy/RewardArtwork.jsx'
import { useCatalog, usePurchase } from '../economy/hooks.js'
import { useInteractionFeedback } from '../interactions/interaction-context.js'

const filters = [{ key: 'ALL', name: 'All treasures' }, ...SHOP_ITEM_TYPES]
const typeName = (type) => SHOP_ITEM_TYPES.find(({ key }) => key === type)?.name || type

function Price({ item }) {
  const discounted = item.basePrice && item.basePrice !== item.price
  return (
    <span className="gold market-price">
      <Coins size={15} />
      <strong>{item.price}</strong>
      {discounted && <del>{item.basePrice}</del>}
      <small>gold</small>
    </span>
  )
}

function RequirementList({ item, compact = false }) {
  const requirements = item.requirements || []
  if (!requirements.length) return null
  return (
    <div className={`market-requirements ${compact ? 'compact' : ''}`} aria-label="Unlock requirements">
      {requirements.map((requirement) => (
        <span className={requirement.met ? 'met' : ''} key={requirement.key}>
          {requirement.met ? <Check size={12} /> : <LockKeyhole size={12} />}
          {requirement.label}
        </span>
      ))}
    </div>
  )
}

function TreasureCard({ item, balance, recentPurchaseId, moving, onPreview, feature = false }) {
  const short = balance < item.price ? item.price - balance : 0
  const justPurchased = item.id === recentPurchaseId
  const unavailable = item.available === false
  return (
    <motion.article
      layout={moving}
      className={`panel item-card market-treasure-card ${feature ? 'feature' : ''} ${item.owned ? 'owned' : ''} ${item.locked ? 'locked' : ''} ${unavailable ? 'unavailable' : ''} ${justPurchased ? 'just-purchased' : ''}`}
      key={item.id}
      animate={justPurchased && moving ? { scale: [1, 1.018, 1] } : { scale: 1 }}
      transition={{ duration: moving ? 0.46 : 0 }}
    >
      <div className="treasure-art-wrap">
        <RewardArtwork item={item} />
        {item.marketTag && <span className={`market-tag market-tag-${item.marketTag.toLowerCase()}`}>{item.marketLabel || item.marketTag}</span>}
        {item.locked && <span className="treasure-lock"><LockKeyhole size={16} /> Locked</span>}
      </div>
      <div className="item-copy">
        <div className="item-label-row">
          <span className="eyebrow">{typeName(item.type)}</span>
          <span className={`rarity rarity-${item.rarity.toLowerCase()}`}>{item.rarity}</span>
        </div>
        <h2>{item.name}</h2>
        <p>{item.description}</p>
        <RequirementList item={item} compact />
        <div className="item-state">
          {item.equipped ? (
            <span><Check size={13} /> Equipped</span>
          ) : item.owned ? (
            <span><PackageCheck size={13} /> Owned</span>
          ) : unavailable ? (
            <span><Clock3 size={13} /> Returns with the wandering merchant</span>
          ) : item.locked ? (
            <span><LockKeyhole size={13} /> Prove yourself to unlock</span>
          ) : short ? (
            <span>{short} gold short</span>
          ) : (
            <span>Ready to claim</span>
          )}
        </div>
        <div className="item-footer">
          <Price item={item} />
          {item.owned ? (
            <Link className="button button-outline" data-market-item={item.id} to="/inventory">Manage</Link>
          ) : (
            <button className="button button-outline" data-market-item={item.id} onClick={(event) => onPreview(item, event)}>Inspect</button>
          )}
        </div>
      </div>
    </motion.article>
  )
}

export default function Marketplace() {
  const [type, setType] = useState('ALL')
  const [selected, setSelected] = useState(null)
  const [message, setMessage] = useState('')
  const [purchaseResult, setPurchaseResult] = useState(null)
  const [recentPurchaseId, setRecentPurchaseId] = useState(null)
  const returnFocusRef = useRef(null)
  const catalog = useCatalog(type)
  const purchase = usePurchase()
  const { moving, notify } = useInteractionFeedback()
  const items = useMemo(() => catalog.data?.items ?? [], [catalog.data?.items])
  const market = catalog.data?.marketplace || {}
  const featuredById = useMemo(() => new Map((market.featuredItems || []).map((item) => [item.id, item])), [market.featuredItems])
  const dailyDeals = market.dailyDeals || []
  const weeklyLegend = market.weeklyLegend || null
  const merchantItems = market.wanderingMerchant?.items || []
  const standardItems = items.filter((item) => !item.merchantOnly)
  const selectedLive = useMemo(() => {
    if (!selected) return null
    return items.find((item) => item.id === selected.id) || featuredById.get(selected.id) || selected
  }, [featuredById, items, selected])

  useEffect(() => {
    if (!recentPurchaseId) return
    const timer = window.setTimeout(() => setRecentPurchaseId(null), 2200)
    return () => window.clearTimeout(timer)
  }, [recentPurchaseId])

  function preview(item, event) {
    returnFocusRef.current = event.currentTarget
    purchase.reset()
    setPurchaseResult(null)
    setSelected(item)
  }

  function closePreview() {
    if (purchase.isPending) return
    setSelected(null)
    setPurchaseResult(null)
  }

  async function buy() {
    if (!selectedLive || selectedLive.owned || selectedLive.locked || selectedLive.available === false || purchase.isPending) return
    setMessage('')
    try {
      const data = await purchase.mutateAsync(selectedLive.id)
      setPurchaseResult(data)
      if (data.purchased) {
        setRecentPurchaseId(data.item.id)
        setMessage(`${data.item.name} is now in your inventory.`)
        notify({
          key: `purchase:${data.inventoryItem.id}`,
          tone: 'purchase',
          title: `${data.item.rarity} treasure claimed`,
          detail: `${data.item.name} · ${data.balance.toLocaleString()} gold remaining`,
          sound: 'purchase',
        })
      } else {
        setMessage(`${data.item.name} was already in your inventory.`)
      }
    } catch {
      // Mutation error is rendered inside the modal and remains actionable.
    }
  }

  return (
    <div className="page market-page market-v2-page">
      <header className="market-world-heading">
        <div>
          <span className="eyebrow">REWARDS FOR THE ROAD AHEAD</span>
          <h1>The Wandering <em>Emporium.</em></h1>
          <p>Gold is earned in the real world. What you collect here becomes part of the adventurer you bring back to it.</p>
        </div>
        <div className="market-heading-actions">
          <div className="market-wallet" aria-label={`${catalog.data?.balance ?? 0} gold available`}>
            <Coins size={18} />
            <span><strong>{(catalog.data?.balance ?? 0).toLocaleString()}</strong><small>YOUR GOLD</small></span>
          </div>
          <Link className="button button-outline" to="/inventory"><PackageCheck size={16} /> Inventory</Link>
        </div>
      </header>

      <EconomyNotice query={catalog} />
      <div className="sr-only" aria-live="polite">{message}</div>
      {message && <div className="market-success"><Check size={16} /> {message}</div>}

      {!catalog.isPending && (
        <>
          <section className="market-feature-grid" aria-label="Featured marketplace rewards">
            <article className="panel market-merchant-card">
              <div className="merchant-copy">
                <span className="eyebrow"><Store size={13} /> THE WANDERING MERCHANT</span>
                <h2>{market.wanderingMerchant?.active ? 'A curious trader has found your road.' : 'The merchant has moved on.'}</h2>
                <p>{market.wanderingMerchant?.active ? '“You weren’t expecting me. That is generally the point.”' : 'Their lantern will appear again soon. Permanent shelves remain open below.'}</p>
                <div className="merchant-meta">
                  <span><Clock3 size={14} /> {market.wanderingMerchant?.active ? 'Leaves at the next market turn' : 'Returns on another day'}</span>
                  <span><Gem size={14} /> Rare · Legendary · Secret wares</span>
                </div>
              </div>
              <div className="merchant-sigil" aria-hidden="true"><WandSparkles size={42} /></div>
            </article>

            {weeklyLegend && (
              <article className="panel weekly-legend-card">
                <div>
                  <span className="eyebrow"><Crown size={13} /> THIS WEEK’S LEGEND</span>
                  <h2>{weeklyLegend.name}</h2>
                  <p>{weeklyLegend.description}</p>
                  <RequirementList item={weeklyLegend} compact />
                </div>
                <div className="weekly-legend-side">
                  <RewardArtwork item={weeklyLegend} compact />
                  <Price item={weeklyLegend} />
                  <button className="button button-gold" data-market-item={weeklyLegend.id} onClick={(event) => preview(weeklyLegend, event)}>Inspect</button>
                </div>
              </article>
            )}
          </section>

          {!!dailyDeals.length && (
            <section className="market-section daily-market-section">
              <div className="market-section-heading">
                <div>
                  <span className="eyebrow">TODAY AT THE EMPORIUM</span>
                  <h2>Daily discoveries</h2>
                  <p>Three treasures receive a small merchant’s discount until the next daily turn.</p>
                </div>
                <span className="market-reset"><Clock3 size={14} /> Refreshes tomorrow</span>
              </div>
              <div className="daily-deal-grid">
                {dailyDeals.map((item) => <TreasureCard key={item.id} item={item} balance={catalog.data?.balance || 0} recentPurchaseId={recentPurchaseId} moving={moving} onPreview={preview} feature />)}
              </div>
            </section>
          )}

          {!!merchantItems.length && market.wanderingMerchant?.active && (
            <section className="market-section merchant-shelf-section">
              <div className="market-section-heading">
                <div><span className="eyebrow">A RARE STOP ALONG THE ROAD</span><h2>The merchant’s hidden shelf</h2></div>
                <span className="rarity rarity-legendary">LIMITED</span>
              </div>
              <div className="daily-deal-grid">
                {merchantItems.map((item) => <TreasureCard key={item.id} item={item} balance={catalog.data?.balance || 0} recentPurchaseId={recentPurchaseId} moving={moving} onPreview={preview} feature />)}
              </div>
            </section>
          )}

          {!!market.collections?.length && (
            <section className="market-section collections-section">
              <div className="market-section-heading">
                <div><span className="eyebrow">TREASURES THAT BELONG TOGETHER</span><h2>Collections</h2><p>Build sets across frames, themes, outfits, companions and auras. Completion reveals rarer rewards.</p></div>
              </div>
              <div className="collection-grid">
                {market.collections.map((collection) => (
                  <article className={`panel collection-card ${collection.complete ? 'complete' : ''}`} key={collection.key}>
                    <span className="collection-icon"><Sparkles size={22} /></span>
                    <div>
                      <span className="eyebrow">{collection.complete ? 'COLLECTION COMPLETE' : 'COLLECTION IN PROGRESS'}</span>
                      <h3>{collection.name}</h3>
                      <p>{collection.description}</p>
                      <div className="collection-progress"><span style={{ width: `${collection.percent}%` }} /></div>
                      <small>{collection.owned} / {collection.total} collected · {collection.reward}</small>
                    </div>
                  </article>
                ))}
              </div>
            </section>
          )}
        </>
      )}

      <section className="market-section standard-market-section">
        <div className="market-section-heading market-catalog-heading">
          <div><span className="eyebrow">THE PERMANENT SHELVES</span><h2>Choose what your journey wears.</h2><p>Cosmetic rewards only. Progress unlocks access; gold completes the trade.</p></div>
          <div className="market-profile-summary">
            <span>Level <strong>{market.profile?.level ?? 1}</strong></span>
            <span><strong>{market.profile?.completedQuests ?? 0}</strong> quests</span>
            <span><strong>{market.profile?.currentStreak ?? 0}</strong> day streak</span>
          </div>
        </div>

        <div className="market-actions">
          <div className="reward-filters" role="group" aria-label="Filter reward catalog">
            {filters.map((filter) => (
              <button key={filter.key} type="button" className={type === filter.key ? 'active' : ''} aria-pressed={type === filter.key} onClick={() => setType(filter.key)}>{filter.name}</button>
            ))}
          </div>
        </div>

        {catalog.isPending ? (
          <section className="market-grid" aria-label="Loading reward catalog">{[0, 1, 2, 3, 4, 5].map((key) => <div className="panel market-skeleton skeleton" key={key} />)}</section>
        ) : standardItems.length ? (
          <section className="market-grid market-v2-grid" aria-label="Reward catalog">
            {standardItems.map((item) => <TreasureCard key={item.id} item={item} balance={catalog.data?.balance || 0} recentPurchaseId={recentPurchaseId} moving={moving} onPreview={preview} />)}
          </section>
        ) : (
          <div className="panel economy-empty"><ShoppingBag size={30} /><h2>No treasures on this shelf yet.</h2><p>Try another category.</p></div>
        )}
      </section>

      <Modal
        open={Boolean(selectedLive)}
        onOpenChange={(open) => !open && closePreview()}
        title={purchaseResult?.purchased ? `${purchaseResult.item.rarity} treasure claimed.` : selectedLive?.name || 'Reward preview'}
        description={purchaseResult?.purchased ? `${purchaseResult.item.name} now belongs to your character.` : selectedLive?.description || ''}
        returnFocusRef={returnFocusRef}
        returnFocusSelector={selectedLive ? `[data-market-item="${selectedLive.id}"]` : undefined}
      >
        {selectedLive && purchaseResult?.purchased ? (
          <div className={`purchase-confirmed purchase-rarity-${purchaseResult.item.rarity.toLowerCase()}`}>
            <div className="purchase-rarity-banner"><Sparkles size={15} /> {purchaseResult.item.rarity} REWARD <Sparkles size={15} /></div>
            <motion.div initial={moving ? { opacity: 0, scale: 0.82, rotate: -2 } : false} animate={{ opacity: 1, scale: 1, rotate: 0 }} transition={moving ? { type: 'spring', stiffness: 240, damping: 18 } : { duration: 0 }}><RewardArtwork item={purchaseResult.item} /></motion.div>
            <div className="purchase-confirmed-copy"><PackageCheck size={19} /><span><strong>{purchaseResult.item.name}</strong>Added to your inventory. Your new balance is {purchaseResult.balance.toLocaleString()} gold.</span></div>
            <div className="purchase-confirmed-actions"><button className="button button-outline" onClick={closePreview}>Keep browsing</button><Link className="button button-gold" to="/inventory">Equip from inventory</Link></div>
          </div>
        ) : selectedLive ? (
          <div className="market-preview-content">
            <RewardArtwork item={selectedLive} />
            <div className="preview-rarity-line"><span className={`rarity rarity-${selectedLive.rarity.toLowerCase()}`}>{selectedLive.rarity}</span><span>{typeName(selectedLive.type)}</span></div>
            <RequirementList item={selectedLive} />
            <div className="purchase-summary"><span>Price <strong>{selectedLive.price} gold</strong>{selectedLive.basePrice !== selectedLive.price && <small>Normally {selectedLive.basePrice}</small>}</span><span>After purchase <strong>{Math.max(0, (catalog.data?.balance || 0) - selectedLive.price)} gold</strong></span></div>
            {purchase.isError && <p className="form-error" role="alert">{purchase.error.message}</p>}
            <p className="modal-note">Rewards are cosmetic and permanent. Unlock conditions and pricing are verified on the server before gold is deducted.</p>
            <button className="button button-gold full-width" disabled={purchase.isPending || selectedLive.owned || selectedLive.locked || selectedLive.available === false || (catalog.data?.balance || 0) < selectedLive.price} onClick={buy}>
              {purchase.isPending ? <><LoaderCircle className="spin" size={16} /> Claiming treasure…</> : selectedLive.available === false ? 'The merchant is away' : selectedLive.locked ? 'Requirements not met' : (catalog.data?.balance || 0) < selectedLive.price ? 'Not enough gold yet' : 'Claim this treasure'}
            </button>
          </div>
        ) : null}
      </Modal>
    </div>
  )
}

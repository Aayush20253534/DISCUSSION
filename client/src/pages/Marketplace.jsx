import { useState } from 'react'
import { Coins, Leaf, Moon, Sparkles, Sun } from 'lucide-react'
import { Modal, PageHeading, PreviewNotice } from '../components/ui.jsx'
import { sampleItems } from '../data/preview.js'

const icons = { moon: Moon, leaf: Leaf, sun: Sun }

export default function Marketplace() {
  const [selected, setSelected] = useState(null)
  return (
    <div className="page">
      <PageHeading
        eyebrow="LITTLE TREASURES, WELL EARNED"
        title={
          <>
            The wandering <em>market.</em>
          </>
        }
        description="A glimpse of the rewards waiting along your path."
      />
      <PreviewNotice />
      <div className="market-intro">
        <Sparkles size={23} />
        <p>
          Make your character feel a little more like you.
          <br />
          <span>Earn gold through quests, then discover something special.</span>
        </p>
        <span className="market-balance">
          <Coins size={17} />
          185 <small>SAMPLE GOLD</small>
        </span>
      </div>
      <section className="market-grid" aria-label="Sample reward catalog">
        {sampleItems.map((item) => {
          const Icon = icons[item.icon]
          return (
            <article className="panel item-card" key={item.id}>
              <div className={`item-art ${item.tone}`}>
                <span className="item-orbit orbit-one" />
                <span className="item-orbit orbit-two" />
                <Icon size={62} strokeWidth={1.1} />
                <span className="item-star star-one">✦</span>
                <span className="item-star star-two">✧</span>
              </div>
              <div className="item-copy">
                <span className="eyebrow">{item.type}</span>
                <h2>{item.name}</h2>
                <p>{item.description}</p>
                <div className="item-footer">
                  <span className="gold">
                    <Coins size={16} />
                    {item.price} gold
                  </span>
                  <button className="button button-outline" onClick={() => setSelected(item)}>
                    Preview
                  </button>
                </div>
              </div>
            </article>
          )
        })}
      </section>
      <p className="catalog-note">
        A preview of things to come. Purchases and inventory will open alongside earned rewards.
      </p>
      <Modal
        open={Boolean(selected)}
        onOpenChange={(open) => !open && setSelected(null)}
        title={selected?.name || 'Reward preview'}
        description={selected?.description || ''}
      >
        {selected && (
          <>
            <div className="reward-price">
              <Coins size={23} />
              <span>{selected.price} gold</span>
            </div>
            <p className="modal-note">
              This is a sample cosmetic. No purchase will be made and no gold will be deducted.
            </p>
            <button className="button button-gold full-width" onClick={() => setSelected(null)}>
              Keep exploring
            </button>
          </>
        )}
      </Modal>
    </div>
  )
}

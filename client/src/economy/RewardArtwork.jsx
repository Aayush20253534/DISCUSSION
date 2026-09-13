import {
  Award,
  Bird,
  Cat,
  Crown,
  Flame,
  Footprints,
  Gem,
  Leaf,
  Moon,
  Palette,
  Shield,
  Sparkles,
  Stars,
  Sun,
  Trees,
} from 'lucide-react'

const icons = {
  moonlit: Moon,
  evergreen: Trees,
  ember: Sun,
  'forest-keeper': Leaf,
  'starlit-focus': Sparkles,
  'unbroken-thread': Award,
  'golden-beginning': Sun,
  'keeper-momentum': Crown,
  'quietly-unstoppable': Sparkles,
  verdant: Leaf,
  'arcane-robes': Stars,
  'ember-cloak': Flame,
  'celestial-wayfarer': Sparkles,
  'forest-fox': Cat,
  'moon-wolf': Footprints,
  'arcane-owl': Bird,
  'ember-drake': Flame,
  'celestial-raven': Bird,
  'ember-aura': Flame,
  'starlight-aura': Stars,
  'resolve-aura': Crown,
  'celestial-wanderer': Gem,
  'flame-endures': Shield,
}

export default function RewardArtwork({ item, compact = false }) {
  const Icon = item.type === 'THEME' ? Palette : icons[item.assetKey] || Sparkles
  return (
    <div className={`reward-art reward-art-${item.assetKey} reward-rarity-${item.rarity.toLowerCase()} ${compact ? 'compact' : ''}`}>
      <span className="item-orbit orbit-one" />
      <span className="item-orbit orbit-two" />
      <Icon size={compact ? 30 : 62} strokeWidth={1.15} />
      {!compact && <><span className="item-star star-one">✦</span><span className="item-star star-two">✧</span></>}
    </div>
  )
}

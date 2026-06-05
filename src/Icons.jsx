const s = { fill: 'none', stroke: 'currentColor', strokeWidth: '1.7', strokeLinecap: 'round', strokeLinejoin: 'round' }

/* ── Expense category icons ──────────────────────────── */
export const FoodIcon = ({ size = 16 }) => (
  <svg width={size} height={size} viewBox="0 0 24 24" {...s}>
    <path d="M3 2v7c0 1.1.9 2 2 2h4a2 2 0 0 0 2-2V2"/>
    <path d="M7 2v20"/>
    <path d="M21 15V2a5 5 0 0 0-5 5v6c0 1.1.9 2 2 2h3z"/>
    <path d="M21 22v-7"/>
  </svg>
)

export const TransportIcon = ({ size = 16 }) => (
  <svg width={size} height={size} viewBox="0 0 24 24" {...s}>
    <path d="M5 17H3a2 2 0 0 1-2-2V9a2 2 0 0 1 2-2h2l2-4h10l2 4h2a2 2 0 0 1 2 2v6a2 2 0 0 1-2 2h-2"/>
    <circle cx="7" cy="17" r="2"/>
    <circle cx="17" cy="17" r="2"/>
  </svg>
)

export const GroceryIcon = ({ size = 16 }) => (
  <svg width={size} height={size} viewBox="0 0 24 24" {...s}>
    <circle cx="9" cy="21" r="1"/>
    <circle cx="20" cy="21" r="1"/>
    <path d="M1 1h4l2.68 13.39a2 2 0 0 0 2 1.61h9.72a2 2 0 0 0 2-1.61L23 6H6"/>
  </svg>
)

export const RentalIcon = ({ size = 16 }) => (
  <svg width={size} height={size} viewBox="0 0 24 24" {...s}>
    <path d="M3 9l9-7 9 7v11a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2z"/>
    <polyline points="9 22 9 12 15 12 15 22"/>
  </svg>
)

export const SubscriptionIcon = ({ size = 16 }) => (
  <svg width={size} height={size} viewBox="0 0 24 24" {...s}>
    <path d="M21 2v6h-6"/>
    <path d="M3 12a9 9 0 0 1 15-6.7L21 8"/>
    <path d="M3 22v-6h6"/>
    <path d="M21 12a9 9 0 0 1-15 6.7L3 16"/>
  </svg>
)

export const SportsIcon = ({ size = 16 }) => (
  <svg width={size} height={size} viewBox="0 0 24 24" {...s}>
    <polygon points="13 2 3 14 12 14 11 22 21 10 12 10 13 2"/>
  </svg>
)

export const ShoppingIcon = ({ size = 16 }) => (
  <svg width={size} height={size} viewBox="0 0 24 24" {...s}>
    <path d="M6 2L3 6v14a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2V6l-3-4z"/>
    <line x1="3" y1="6" x2="21" y2="6"/>
    <path d="M16 10a4 4 0 0 1-8 0"/>
  </svg>
)

export const CoffeeIcon = ({ size = 16 }) => (
  <svg width={size} height={size} viewBox="0 0 24 24" {...s}>
    <path d="M17 8h1a4 4 0 0 1 0 8h-1"/>
    <path d="M3 8h14v9a4 4 0 0 1-4 4H7a4 4 0 0 1-4-4V8z"/>
    <line x1="6" y1="2" x2="6" y2="5"/>
    <line x1="10" y1="2" x2="10" y2="5"/>
    <line x1="14" y1="2" x2="14" y2="5"/>
  </svg>
)

export const DiningIcon = ({ size = 16 }) => (
  <svg width={size} height={size} viewBox="0 0 24 24" {...s}>
    <path d="M18 8h1a4 4 0 0 1 0 8h-1"/>
    <path d="M2 8h16v9a4 4 0 0 1-4 4H6a4 4 0 0 1-4-4V8z"/>
    <line x1="6" y1="2" x2="6" y2="8"/>
    <line x1="10" y1="2" x2="10" y2="8"/>
    <line x1="14" y1="2" x2="14" y2="8"/>
  </svg>
)

export const PetrolIcon = ({ size = 16 }) => (
  <svg width={size} height={size} viewBox="0 0 24 24" {...s}>
    <path d="M3 22V7a2 2 0 0 1 2-2h8a2 2 0 0 1 2 2v15"/>
    <path d="M15 8h3a1 1 0 0 1 1 1v3a1 1 0 0 1-1 1h-3"/>
    <line x1="3" y1="22" x2="15" y2="22"/>
    <line x1="7" y1="11" x2="11" y2="11"/>
  </svg>
)

export const TollIcon = ({ size = 16 }) => (
  <svg width={size} height={size} viewBox="0 0 24 24" {...s}>
    <rect x="2" y="8" width="20" height="4" rx="1"/>
    <line x1="6" y1="12" x2="6" y2="19"/>
    <line x1="18" y1="12" x2="18" y2="19"/>
    <line x1="3" y1="19" x2="21" y2="19"/>
  </svg>
)

export const OnlineShoppingIcon = ({ size = 16 }) => (
  <svg width={size} height={size} viewBox="0 0 24 24" {...s}>
    <path d="M12.89 1.45l8 4A2 2 0 0 1 22 7.24v9.53a2 2 0 0 1-1.11 1.79l-8 4a2 2 0 0 1-1.79 0l-8-4A2 2 0 0 1 2 16.76V7.24a2 2 0 0 1 1.11-1.79l8-4a2 2 0 0 1 1.78 0z"/>
    <polyline points="2.32 6.16 12 11 21.68 6.16"/>
    <line x1="12" y1="22.76" x2="12" y2="11"/>
  </svg>
)

export const HealthIcon = ({ size = 16 }) => (
  <svg width={size} height={size} viewBox="0 0 24 24" {...s}>
    <path d="M20.84 4.61a5.5 5.5 0 0 0-7.78 0L12 5.67l-1.06-1.06a5.5 5.5 0 0 0-7.78 7.78l1.06 1.06L12 21.23l7.78-7.78 1.06-1.06a5.5 5.5 0 0 0 0-7.78z"/>
  </svg>
)

export const EntertainmentIcon = ({ size = 16 }) => (
  <svg width={size} height={size} viewBox="0 0 24 24" {...s}>
    <circle cx="12" cy="12" r="10"/>
    <polygon points="10 8 16 12 10 16 10 8" style={{ fill: 'currentColor', stroke: 'none' }}/>
  </svg>
)

export const TravelIcon = ({ size = 16 }) => (
  <svg width={size} height={size} viewBox="0 0 24 24" {...s}>
    <circle cx="12" cy="12" r="10"/>
    <line x1="2" y1="12" x2="22" y2="12"/>
    <path d="M12 2a15.3 15.3 0 0 1 4 10 15.3 15.3 0 0 1-4 10 15.3 15.3 0 0 1-4-10 15.3 15.3 0 0 1 4-10z"/>
  </svg>
)

export const UtilitiesIcon = ({ size = 16 }) => (
  <svg width={size} height={size} viewBox="0 0 24 24" {...s}>
    <path d="M18.36 6.64a9 9 0 1 1-12.73 0"/>
    <line x1="12" y1="2" x2="12" y2="12"/>
  </svg>
)

export const EducationIcon = ({ size = 16 }) => (
  <svg width={size} height={size} viewBox="0 0 24 24" {...s}>
    <path d="M4 19.5A2.5 2.5 0 0 1 6.5 17H20"/>
    <path d="M6.5 2H20v20H6.5A2.5 2.5 0 0 1 4 19.5v-15A2.5 2.5 0 0 1 6.5 2z"/>
  </svg>
)

export const CAT_ICONS = {
  food:            FoodIcon,
  transport:       TransportIcon,
  grocery:         GroceryIcon,
  rental:          RentalIcon,
  subscription:    SubscriptionIcon,
  sports:          SportsIcon,
  shopping:        ShoppingIcon,
  coffee:          CoffeeIcon,
  dining:          DiningIcon,
  petrol:          PetrolIcon,
  toll:            TollIcon,
  online_shopping: OnlineShoppingIcon,
  health:          HealthIcon,
  entertainment:   EntertainmentIcon,
  travel:          TravelIcon,
  utilities:       UtilitiesIcon,
  education:       EducationIcon,
}

/* ── Action icons ────────────────────────────────────── */
export const MicIcon = ({ active }) => (
  <svg width="15" height="15" viewBox="0 0 24 24" {...s}>
    {active
      ? <rect x="5" y="5" width="14" height="14" rx="2"/>
      : <>
          <path d="M12 1a3 3 0 0 1 3 3v8a3 3 0 0 1-6 0V4a3 3 0 0 1 3-3z"/>
          <path d="M19 10v2a7 7 0 0 1-14 0v-2"/>
          <line x1="12" y1="19" x2="12" y2="23"/>
          <line x1="8" y1="23" x2="16" y2="23"/>
        </>
    }
  </svg>
)

export const SendIcon = () => (
  <svg width="14" height="14" viewBox="0 0 24 24" {...s}>
    <line x1="12" y1="19" x2="12" y2="5"/>
    <polyline points="5 12 12 5 19 12"/>
  </svg>
)

export const GearIcon = ({ size = 18 }) => (
  <svg width={size} height={size} viewBox="0 0 24 24" {...s}>
    <circle cx="12" cy="12" r="3"/>
    <path d="M19.4 15a1.65 1.65 0 0 0 .33 1.82l.06.06a2 2 0 0 1-2.83 2.83l-.06-.06a1.65 1.65 0 0 0-1.82-.33 1.65 1.65 0 0 0-1 1.51V21a2 2 0 0 1-4 0v-.09A1.65 1.65 0 0 0 9 19.4a1.65 1.65 0 0 0-1.82.33l-.06.06a2 2 0 0 1-2.83-2.83l.06-.06A1.65 1.65 0 0 0 4.68 15a1.65 1.65 0 0 0-1.51-1H3a2 2 0 0 1 0-4h.09A1.65 1.65 0 0 0 4.6 9a1.65 1.65 0 0 0-.33-1.82l-.06-.06a2 2 0 0 1 2.83-2.83l.06.06A1.65 1.65 0 0 0 9 4.68a1.65 1.65 0 0 0 1-1.51V3a2 2 0 0 1 4 0v.09a1.65 1.65 0 0 0 1 1.51 1.65 1.65 0 0 0 1.82-.33l.06-.06a2 2 0 0 1 2.83 2.83l-.06.06A1.65 1.65 0 0 0 19.4 9a1.65 1.65 0 0 0 1.51 1H21a2 2 0 0 1 0 4h-.09a1.65 1.65 0 0 0-1.51 1z"/>
  </svg>
)

export const BackIcon = () => (
  <svg width="18" height="18" viewBox="0 0 24 24" {...s}>
    <polyline points="15 18 9 12 15 6"/>
  </svg>
)

export const EditIcon = ({ size = 14 }) => (
  <svg width={size} height={size} viewBox="0 0 24 24" {...s}>
    <path d="M11 4H4a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2v-7"/>
    <path d="M18.5 2.5a2.121 2.121 0 0 1 3 3L12 15l-4 1 1-4 9.5-9.5z"/>
  </svg>
)

export const SearchIcon = ({ size = 18 }) => (
  <svg width={size} height={size} viewBox="0 0 24 24" {...s}>
    <circle cx="11" cy="11" r="8"/>
    <line x1="21" y1="21" x2="16.65" y2="16.65"/>
  </svg>
)

export const XIcon = ({ size = 16 }) => (
  <svg width={size} height={size} viewBox="0 0 24 24" {...s} strokeWidth="2">
    <line x1="18" y1="6" x2="6" y2="18"/>
    <line x1="6" y1="6" x2="18" y2="18"/>
  </svg>
)

export const RepeatIcon = ({ size = 12 }) => (
  <svg width={size} height={size} viewBox="0 0 24 24" {...s} strokeWidth="2">
    <polyline points="17 1 21 5 17 9"/>
    <path d="M3 11V9a4 4 0 0 1 4-4h14"/>
    <polyline points="7 23 3 19 7 15"/>
    <path d="M21 13v2a4 4 0 0 1-4 4H3"/>
  </svg>
)

/* ── Nav icons ───────────────────────────────────────── */
export const NavLogIcon = () => (
  <svg width="20" height="20" viewBox="0 0 24 24" {...s}>
    <path d="M12 20h9"/>
    <path d="M16.5 3.5a2.121 2.121 0 0 1 3 3L7 19l-4 1 1-4L16.5 3.5z"/>
  </svg>
)

export const NavChartIcon = () => (
  <svg width="20" height="20" viewBox="0 0 24 24" {...s}>
    <line x1="18" y1="20" x2="18" y2="10"/>
    <line x1="12" y1="20" x2="12" y2="4"/>
    <line x1="6" y1="20" x2="6" y2="14"/>
  </svg>
)

export const NavCalendarIcon = () => (
  <svg width="20" height="20" viewBox="0 0 24 24" {...s}>
    <rect x="3" y="4" width="18" height="18" rx="2"/>
    <line x1="16" y1="2" x2="16" y2="6"/>
    <line x1="8" y1="2" x2="8" y2="6"/>
    <line x1="3" y1="10" x2="21" y2="10"/>
  </svg>
)

export const NavInsightsIcon = () => (
  <svg width="20" height="20" viewBox="0 0 24 24" {...s}>
    <polyline points="22 12 18 12 15 21 9 3 6 12 2 12"/>
  </svg>
)

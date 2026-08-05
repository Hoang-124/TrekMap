# DESIGN.md - TrekMap Cyber-Alpine Expedition Design System

> **Google Stitch & VoltAgent DESIGN.md Standard + Impeccable 6-Pillars & GIS 3D Engine**
> Design language, visual tokens, spatial grid, typography, 3D map stage, component specs, and anti-slop rules for TrekMap.

---

## 🌲 Design Identity & Aesthetic Theme

**TrekMap** features the **Cyber-Alpine Expedition** aesthetic — combining the pristine majesty of Vietnam's mountain ranges (Fansipan, Tà Xùa, Tây Ninh) with a modern tactical expedition command center visual identity.

- **Theme**: Void Dark Alpine (`#030a0e`), Electric Cyber Jade (`#00ffd5`), Aurora Emerald (`#059669`), and Mist Altitude (`#e0f2fe`).
- **Atmosphere**: Mountain mist, 3D terrain pitch stage, glowing vector trails, glassmorphism 24px, and tactical command controls.
- **Core Typography**: `Plus Jakarta Sans` (Google Fonts) with tight spatial rhythm.

---

## 🎨 Color Palette & Design Tokens

### Backgrounds & Glass Surfaces
| Token Name | Hex / Value | Purpose / Semantic Role |
| :--- | :--- | :--- |
| `--bg-dark` | `#030a0e` | Void Alpine Canvas Background |
| `--bg-darker` | `#020609` | Tactical Sidebar & Navigation Base |
| `--bg-card` | `#0a1c24` | Elevated Card & Modal Base |
| `--bg-card-glass` | `rgba(10, 28, 36, 0.82)` | Glassmorphism Surface (`backdrop-filter: blur(24px)`) |
| `--bg-card-hover` | `#0f2631` | Card Hover Elevation State |
| `--border-color` | `rgba(0, 255, 213, 0.18)` | Subtle Hologram Border |
| `--border-glow` | `rgba(0, 255, 213, 0.45)` | Active Glow Border |

### Nature & Cyber Accent Colors
| Token Name | Hex Code | Semantic Role |
| :--- | :--- | :--- |
| `--accent-stream` | `#00ffd5` | **Cyber Jade / Ngọc Bích** (Primary Active, Focus Rings, Trail Polylines) |
| `--accent-cyan` | `#06b6d4` | Hydration Streams & Waterfalls |
| `--accent-forest` | `#10b981` | Pine Forest & Moss Badges |
| `--accent-emerald` | `#059669` | Old-Growth Forest & Summit Markers |
| `--accent-cloud` | `#e0f2fe` | Peak Mist & Elevation Altitude Pills |
| `--accent-sky` | `#38bdf8` | Open Sky & Active GPS Position |
| `--accent-sun` | `#fbbf24` | Sunrise Weather Highlights & Caution |
| `--accent-danger` | `#ef4444` | Emergency SOS Rescue Beacon |

---

## 📐 Spatial Hierarchy & Layout Grid (Impeccable 8px Grid)

- **Base Unit**: `8px`
- **Padding & Margin Scale**:
  - `4px` (xs) - Badge padding, micro spacing
  - `8px` (sm) - Icon gaps, button internal spacing
  - `16px` (md) - Form input padding, card inner gap
  - `24px` (lg) - Card default padding, section gap
  - `32px` (xl) - Modal padding, hero margins
  - `48px` (2xl) - Main container padding

### Corner Radius System
- `--radius-md`: `12px` (Buttons, Inputs, Badges)
- `--radius-lg`: `16px` (Cards, Map Popups)
- `--radius-xl`: `24px` (Modals, Floating Tactical Navbar, 3D Map Stage)

---

## 🗺️ GIS 3D Terrain Pitch Stage Specifications

- **Stage Perspective**: `1400px`
- **3D Tilt Angle**: `rotateX(34deg)` with zero Z-skew distortion
- **Map Polyline Style**: Stroke `#00ffd5`, weight `4px`, drop-shadow `0 0 12px rgba(0, 255, 213, 0.8)`
- **Glass Map Popups**: Background `rgba(10, 28, 36, 0.92)` with `backdrop-filter: blur(16px)` and border `1px solid rgba(0, 255, 213, 0.35)`.

---

## ⚡ Anti-Slop Quality Gate (Paul Bakaus Impeccable Rules)

1. ❌ **No default browser buttons or unstyled inputs**.
2. ❌ **No static flat UI** - Every interactive element must feature smooth transitions (`cubic-bezier(0.4, 0, 0.2, 1)`).
3. ✅ **Visual Feedback Required**: Default ➔ Hover (`translateY(-2px)`) ➔ Active (`scale(0.98)`) ➔ Focus Ring (`0 0 14px rgba(0, 255, 213, 0.4)`).
4. ✅ **Accessible Contrast**: WCAG AA compliant text colors (`--text-main: #f0f9ff`, `--text-muted: #94a3b8`).

---
name: apple-design
description: Apple Human Interface Guidelines (iOS 27 Liquid Glass × Apple Wallet × Flighty) minimal, zero-neon design system for GoTravel. Use whenever building, auditing, or polishing UI components, modals, buttons, navigation bars, cards, Canvas exports, or mobile RWD layouts in GoTravel.
---

# GoTravel Apple Design System (iOS 27 Liquid Glass · Quiet & Minimal)

Follow these non-negotiable Apple HIG & iOS 27 Liquid Glass rules for every UI change in GoTravel. Prioritize **restraint, clarity, and simple color hierarchy** over decorative flashiness.

## 1. Unified Semantic Color Language — Nordic Slate (航空霧藍 · Low-Saturation Light ↔ Dark)
- **Color with Purpose (Taste Skill Low-Saturation Discipline — Never Neon, Never Over-Saturated)**:
  - Keep large backgrounds and card surfaces calm and monochrome (strictly consistent cool-slate gray temperature — never mix warm & cool grays randomly), while giving **functional icons, categories, badges, and actions controlled low-saturation semantic color** so users scan effortlessly.
  - Every color MUST use calibrated **Nordic Slate Light ↔ Dark pairs**:
    - **Canvas (`--bg-canvas`)**: Light `#F5F6F8` ↔ Dark `#0B0D11`
    - **Elevated Surface (`--bg-surface`)**: Light `#FFFFFF` ↔ Dark `#14171F`
    - **Subtle Surface (`--bg-subtle`)**: Light `#F0F2F5` ↔ Dark `#1B1F2A`
    - **Primary / Secondary Ink**: Light `#1A1D23` / `#68707D` ↔ Dark `#ECEFF4` / `#8B93A1`
    - **Accent / Flights (霧海藍)**: Light `#3B6B9B` ↔ Dark `#6A98C6`
    - **Success / Maps (鼠尾草綠)**: Light `#4A7C64` ↔ Dark `#6FA38A`
    - **Notes / Food / Pending (陶土琥珀)**: Light `#B57B45` ↔ Dark `#CFA06E`
    - **Destructive / Error / Calendar (乾燥玫瑰紅)**: Light `#B25052` ↔ Dark `#CF7678`
    - **Transit / Checklist (暮色灰紫)**: Light `#626596` ↔ Dark `#8B8EC0`
- **STRICT ANTI-CLUTTER & ANTI-NEON BANS**:
  - **NO inline helper subtext / explanatory micro-copy**: Never clutter cards or rows with 1–2 lines of tiny grey explanatory notes. Keep labels ultra-clean and place optional explanations behind a compact **`?` info popover button** (`w-5 h-5 rounded-full`).
  - **NO emojis in UI copy or chrome**: Use consistent stroke icons (`lucide-react`) instead of OS emojis.
  - **NO colored glow shadows**: Never use `shadow-primary/*`, `shadow-indigo-*`, `shadow-sky-*`, `shadow-blue-*`, `shadow-purple-*`, or `vision-glow`. Use subtle neutral shadows (`shadow-sm`, `shadow-ios`) and crisp 1px hairline borders instead.
  - **NO decorative floating blur orbs**: Never add `blur-3xl` / `blur-2xl` radial light blobs behind cards, modals, or heroes, and never paint multi-color aurora `createRadialGradient` glows on Canvas exports.
  - **NO loud full-card rainbow backgrounds**: Keep card containers on unified neutral glass; put low-saturation semantic color on compact icon tiles, status pills, and badges.

## 2. Liquid Glass Surfaces & Theme Parity (Light & Dark)
- **Light Mode is a first-class citizen**: Never leave harsh dark backdrops (`bg-black/70`) on light screens.
  - Full-screen modal overlays: `bg-[#F5F5F7]/90 dark:bg-[#060709]/85 backdrop-blur-2xl`.
  - Elevated glass cards: crisp translucent surface with subtle hairline borders (`border-black/[0.06] dark:border-white/[0.10]`).
  - Third-party brand logos (e.g. airline logos designed for light backgrounds): always mount inside a clean white squircle (`bg-white dark:bg-white/95 border border-black/10 dark:border-white/20 p-1.5`) so dark wordmarks stay crisp in Dark Mode.
- **Full-Viewport Modals**: Any full-screen modal rendered inside a tab or swipe-animated container MUST use `createPortal(..., document.body)` with `z-[9999]` so CSS `transform` ancestors never clip the backdrop or trap it below the bottom Floating Dock.

## 3. Controls, Pills & Buttons (Zero Ugly Wrapping)
- **Single-Line Rule**: Action pills and toolbar buttons MUST ALWAYS carry `whitespace-nowrap shrink-0`. Never allow a 2–4 character CJK label (`編輯`, `出票動畫`) to wrap onto two lines on mobile.
- **Mobile Toolbar Compression**: When a row contains a title/badge + multiple actions on `< 640px`:
  - Give the left badge/title `min-w-0 truncate` so it yields gracefully.
  - Collapse secondary action pills to crisp circular icon-only buttons on mobile (`w-9 h-9 justify-center` with `aria-label` and `title`), expanding to icon + label on `sm:` (`sm:w-auto sm:px-3.5`).
  - Keep sibling pills on the same row **uniform in height** (`h-9`).
- **Touch Targets & Tactile Feedback**:
  - Primary tap targets on mobile should be `>= 36px–44px` (`h-9` / `h-11` / `min-w-[44px]`).
  - Use subtle press feedback (`active:scale-[0.98]` / `active:scale-95 transition-all cursor-pointer`).

## 4. Typography & Numeric Precision
- **Tabular Numerals**: Always apply `tabular-nums` (and `font-mono` where appropriate) to flight times (`07:50 → 11:00`), dates (`2027-03-09`), currency amounts, countdowns, and map pin numbers.
- **Mathematical Centering**: Badge/marker numbers inside circles must use Flexbox (`flex items-center justify-center leading-none`) with concentric outer halos.

## 5. Mobile-First RWD (320px–390px Safe)
- **Never squeeze wide inputs into `grid-cols-2` on mobile**: Date pickers (`YYYY/MM/DD`), time ranges, and long inputs MUST use `grid-cols-1 sm:grid-cols-2` on mobile.
- **Flex Sibling Icons**: Never overlay an `absolute` icon on top of a narrow text input where digits can slide underneath; place the input (`min-w-0 flex-1`) and icon button (`shrink-0`) as flex siblings.
- **Compact Mobile Chrome**: Prefer `p-5 sm:p-8` on modals and put contextual mobile CTAs as compact pills inside the sticky header (`sm:hidden`) instead of tall banners that crush map/content height.
- **Chip Lists**: Multi-chip quick-pick bars on mobile should scroll horizontally in a single row (`flex flex-nowrap sm:flex-wrap overflow-x-auto no-scrollbar gap-1.5` with `shrink-0` chips).

## 6. Motion & Calm Focus
- **Purposeful Motion Only**: Use smooth, bounded animations (e.g. boarding pass slot print with `prefers-reduced-motion` support). Never use distracting infinite flashing (`animate-ping` / `animate-pulse`) on active map pins; use a calm static focus ring instead.

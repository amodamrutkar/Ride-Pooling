---
name: PoolIQ
colors:
  surface: '#131318'
  surface-dim: '#131318'
  surface-bright: '#39383e'
  surface-container-lowest: '#0e0e13'
  surface-container-low: '#1b1b20'
  surface-container: '#1f1f25'
  surface-container-high: '#2a292f'
  surface-container-highest: '#35343a'
  on-surface: '#e4e1e9'
  on-surface-variant: '#bacac2'
  inverse-surface: '#e4e1e9'
  inverse-on-surface: '#303036'
  outline: '#85948d'
  outline-variant: '#3b4a44'
  surface-tint: '#2cdfb2'
  primary: '#49f1c3'
  on-primary: '#00382a'
  primary-container: '#0ed4a8'
  on-primary-container: '#005642'
  inverse-primary: '#006b54'
  secondary: '#c8c5cc'
  on-secondary: '#303035'
  secondary-container: '#47464c'
  on-secondary-container: '#b6b4bb'
  tertiary: '#ffcea6'
  on-tertiary: '#4c2700'
  tertiary-container: '#ffa858'
  on-tertiary-container: '#733e00'
  error: '#ffb4ab'
  on-error: '#690005'
  error-container: '#93000a'
  on-error-container: '#ffdad6'
  primary-fixed: '#58fcce'
  primary-fixed-dim: '#2cdfb2'
  on-primary-fixed: '#002117'
  on-primary-fixed-variant: '#00513e'
  secondary-fixed: '#e4e1e8'
  secondary-fixed-dim: '#c8c5cc'
  on-secondary-fixed: '#1b1b20'
  on-secondary-fixed-variant: '#47464c'
  tertiary-fixed: '#ffdcc1'
  tertiary-fixed-dim: '#ffb77a'
  on-tertiary-fixed: '#2e1500'
  on-tertiary-fixed-variant: '#6c3a00'
  background: '#131318'
  on-background: '#e4e1e9'
  surface-variant: '#35343a'
typography:
  headline-xl:
    fontFamily: Inter
    fontSize: 36px
    fontWeight: '600'
    lineHeight: 40px
    letterSpacing: -0.03em
  headline-xl-mobile:
    fontFamily: Inter
    fontSize: 28px
    fontWeight: '600'
    lineHeight: 32px
    letterSpacing: -0.025em
  headline-lg:
    fontFamily: Inter
    fontSize: 24px
    fontWeight: '600'
    lineHeight: 28px
    letterSpacing: -0.02em
  headline-md:
    fontFamily: Inter
    fontSize: 20px
    fontWeight: '500'
    lineHeight: 24px
    letterSpacing: -0.015em
  body-lg:
    fontFamily: Inter
    fontSize: 16px
    fontWeight: '400'
    lineHeight: 24px
    letterSpacing: -0.01em
  body-md:
    fontFamily: Inter
    fontSize: 14px
    fontWeight: '400'
    lineHeight: 20px
    letterSpacing: -0.005em
  body-sm:
    fontFamily: Inter
    fontSize: 12px
    fontWeight: '400'
    lineHeight: 16px
    letterSpacing: 0em
  label-lg:
    fontFamily: Inter
    fontSize: 13px
    fontWeight: '500'
    lineHeight: 16px
    letterSpacing: 0.01em
  label-mono:
    fontFamily: Inter
    fontSize: 11px
    fontWeight: '600'
    lineHeight: 14px
    letterSpacing: 0.06em
rounded:
  sm: 0.125rem
  DEFAULT: 0.25rem
  md: 0.375rem
  lg: 0.5rem
  xl: 0.75rem
  full: 9999px
spacing:
  gutter: 1rem
  gutter-mobile: 0.75rem
  margin: 1.5rem
  margin-mobile: 1rem
  space-xs: 0.25rem
  space-sm: 0.5rem
  space-md: 1rem
  space-lg: 1.5rem
  space-xl: 2rem
---

## Brand & Style

This design system establishes an ultra-clean, mathematically disciplined interface tailored for real-time ride pooling and route optimization. Built on functional minimalism and instrumental precision, the visual language avoids decorative noise, gratuitous gradients, and skeuomorphic excess. Every line, gap, and pixel communicates state, timing, or route geometry.

The target audience consists of urban commuters, logistics operators, and transit-oriented professionals who demand high information density, low cognitive drag, and instantaneous operational clarity. The interface evokes a sense of calculated certainty, quiet control, and technical refinement. Interactions are crisp, deliberate, and direct.

## Colors

The palette operates in strict dark mode, anchored by deep obsidian backgrounds and surgical telemetry accents.

- **Canvas Background (`#0A0A0F`):** Deep, non-reflective base canvas ensuring maximum screen contrast and reduced optical fatigue in mobile field use.
- **Surface Elevation (`#141418`):** Restrained structural surface used for modular cards, route nodes, and control panels.
- **Structural Border (`#232328`):** Low-contrast boundaries providing architectural separation without introducing optical clutter.
- **Primary Telemetry Accent (`#0ED4A8`):** High-efficiency signal teal reserved strictly for active pool states, optimal route vectors, confirmed matches, and key call-to-actions.
- **Primary Text (`#EAEAF0`):** High-readability cool white for primary values, ETAs, and core instructions.
- **Muted Text (`#6B6B76`):** Secondary metadata, inactive states, mathematical labels, and path details.

Functional signaling rules:
- Telemetry teal is never used for decorative fills; its presence exclusively indicates actionable routes, confirmations, or real-time connectivity.
- Surfaces maintain flat, opaque tonality. Gradients are prohibited across all interactive elements.

## Typography

Typography relies entirely on the neutral, disciplined geometry of Inter. The typesetting rules emphasize mathematical hierarchy, tight tracking, and zero ornamental flair.

- **Tracking:** Headlines utilize negative letter-spacing (`-0.03em` to `-0.015em`) for dense, editorial authority. Technical tags and status indicators leverage uppercase labels with expanded tracking (`+0.06em`) for rapid scanning under transit conditions.
- **Tabular Figures:** All numeric displays (timestamps, ETAs, seat allocations, distances, pricing splits) must explicitly render using OpenType tabular figures (`tnum`) to eliminate layout reflow during live telemetry updates.
- **Hierarchy Discipline:** Restrict styling to standard medium and regular weights. Bold styles are reserved strictly for critical numeric readouts and core headings.

## Layout & Spacing

The layout model is governed by a strict 4px/8px geometric grid designed for responsive mobile and compact dashboard contexts.

- **Mobile Viewports (<600px):** Single-column fluid architecture utilizing a consistent `margin-mobile` of 16px (`1rem`) and `gutter-mobile` of 12px (`0.75rem`). Operational components hug bottom screen bounds to facilitate single-thumb navigation during movement.
- **Tablet & Split-Screen Viewports (600px - 1024px):** 6-column fluid grid with 16px gutters and 24px margins. Separates map-based spatial telemetry from pool participant queues.
- **Desktop & Ops Dashboards (>1024px):** 12-column structured layout with 24px margins, keeping control sidebars pinned while route visualizations scale contextually.
- **Internal Spacing Discipline:** Component internal gaps scale strictly through `space-xs` (4px), `space-sm` (8px), `space-md` (16px), `space-lg` (24px), and `space-xl` (32px). Asymmetric or arbitrary padding is strictly disallowed.

## Elevation & Depth

Spatial layering is conveyed exclusively through tonal planes and sharp low-contrast micro-borders. Shadows, diffuse blurs, and glassmorphism are completely rejected in favor of high-legibility solid architectural surfaces.

- **Plane 0 (Canvas):** Pure `#0A0A0F`. The spatial substrate hosting live maps, route graphs, and telemetry vectors.
- **Plane 1 (Modules & Cards):** Solid `#141418` bordered by a 1px solid `#232328` perimeter. Used for list items, route waypoints, and vehicle spec panels.
- **Plane 2 (Floating Action Trays & Sheets):** Solid `#18181D` with a 1px solid `#2E2E36` outline. Positioned above base telemetry with no drop shadows; boundary definition is preserved purely through edge value contrast.
- **State Highlighting:** Active, selected, or focused modules swap their standard border for a 1px solid `#0ED4A8` rule, instantly elevating their perceptual hierarchy without altering geometric positioning.

## Shapes

The geometric identity relies on disciplined, tight radiuses that reflect mechanical instrumentation.

- **Standard Elements (Level 1 - Soft):** Buttons, input fields, route segment chips, and list cells feature an exact 4px (`0.25rem`) corner radius.
- **Container Elements (`rounded-lg`):** Modals, persistent bottom sheets, and route cards use an 8px (`0.5rem`) corner radius.
- **Overlays & Dialogs (`rounded-xl`):** Dedicated terminal viewports and detached system drawers max out at 12px (`0.75rem`).
- Circular geometry is prohibited with the sole exception of route nodal points (pickup, drop-off pins) and driver status rings, which remain pure geometric circles to contrast against rectilinear data containers.

## Components

### Buttons
- **Primary Action:** Solid `#0ED4A8` background, `#0A0A0F` bold typography, 4px corner radius. Padding: 12px 20px. Focused on instant confirmation (e.g., "Confirm Pool", "Lock Route").
- **Secondary Action:** Transparent background with 1px solid `#232328` border, `#EAEAF0` text. Hover/Active state shifts border to `#6B6B76` and subtle fill to `#18181E`.
- **Destructive/Cancel:** Transparent background with 1px solid `#361E23` border and muted crimson `#E55353` typography.

### Input Fields & Controls
- **Text Inputs:** Solid `#141418` fill, 1px solid `#232328` border, 4px border radius. Typographic placeholder in `#6B6B76`, active input text in `#EAEAF0`. Focused state switches border to `#0ED4A8`.
- **Checkboxes & Segment Toggles:** Monolithic 16x16px boxes with 2px radius and 1px border. Selected state fills with `#0ED4A8` accompanied by an obsidian inner check mark.

### Waypoint & Route Chips
- **Status Chips:** Low-profile capsules using 4px radius, `#141418` surface, and 1px `#232328` border. Typographic label set in uppercase `label-mono` in `#6B6B76`.
- **Active Pool Indicator:** Prefixed with a solid 6px `#0ED4A8` dot indicator with `#EAEAF0` text.

### Cards & Module Lists
- **Structure:** Modular `#141418` cards bordered by 1px solid `#232328` with 8px radius. Content padded with `space-md` (16px).
- **Dividers:** Internal card segmentations rely on hairline 1px `#1C1C22` divider rules.

### Transport-Specific Components
- **Route Graph Timeline:** Continuous vertical 1px line in `#232328` connecting waypoints. Origin node: 6px open ring in `#EAEAF0`; Pool pickup nodes: 6px solid `#0ED4A8` discs; Destination node: 6px solid `#EAEAF0` square.
- **Seat Allocation Bar:** Segmented grid measuring seat availability via strict rectangular blocks (4px wide, 8px high) with 2px gaps. Available seats rendered in `#232328`, reserved pool seats filled with `#0ED4A8`.
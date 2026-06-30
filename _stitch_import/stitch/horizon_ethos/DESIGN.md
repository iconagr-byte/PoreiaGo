---
name: Horizon Ethos
colors:
  surface: '#fcf8fb'
  surface-dim: '#dcd9dc'
  surface-bright: '#fcf8fb'
  surface-container-lowest: '#ffffff'
  surface-container-low: '#f6f3f5'
  surface-container: '#f0edef'
  surface-container-high: '#eae7ea'
  surface-container-highest: '#e4e2e4'
  on-surface: '#1b1b1d'
  on-surface-variant: '#404850'
  inverse-surface: '#303032'
  inverse-on-surface: '#f3f0f2'
  outline: '#707881'
  outline-variant: '#bfc7d1'
  surface-tint: '#006399'
  primary: '#005d90'
  on-primary: '#ffffff'
  primary-container: '#0077b6'
  on-primary-container: '#f3f7ff'
  inverse-primary: '#94ccff'
  secondary: '#7d5800'
  on-secondary: '#ffffff'
  secondary-container: '#ffb702'
  on-secondary-container: '#6b4b00'
  tertiary: '#266449'
  on-tertiary: '#ffffff'
  tertiary-container: '#417d61'
  on-tertiary-container: '#dfffeb'
  error: '#ba1a1a'
  on-error: '#ffffff'
  error-container: '#ffdad6'
  on-error-container: '#93000a'
  primary-fixed: '#cde5ff'
  primary-fixed-dim: '#94ccff'
  on-primary-fixed: '#001d32'
  on-primary-fixed-variant: '#004b74'
  secondary-fixed: '#ffdea9'
  secondary-fixed-dim: '#ffba27'
  on-secondary-fixed: '#271900'
  on-secondary-fixed-variant: '#5e4100'
  tertiary-fixed: '#b1f0ce'
  tertiary-fixed-dim: '#95d4b3'
  on-tertiary-fixed: '#002114'
  on-tertiary-fixed-variant: '#0e5138'
  background: '#fcf8fb'
  on-background: '#1b1b1d'
  surface-variant: '#e4e2e4'
typography:
  headline-xl:
    fontFamily: Montserrat
    fontSize: 48px
    fontWeight: '700'
    lineHeight: '1.2'
    letterSpacing: -0.02em
  headline-lg:
    fontFamily: Montserrat
    fontSize: 32px
    fontWeight: '700'
    lineHeight: '1.3'
    letterSpacing: -0.01em
  headline-lg-mobile:
    fontFamily: Montserrat
    fontSize: 28px
    fontWeight: '700'
    lineHeight: '1.3'
  headline-md:
    fontFamily: Montserrat
    fontSize: 24px
    fontWeight: '600'
    lineHeight: '1.4'
  body-lg:
    fontFamily: Inter
    fontSize: 18px
    fontWeight: '400'
    lineHeight: '1.6'
  body-md:
    fontFamily: Inter
    fontSize: 16px
    fontWeight: '400'
    lineHeight: '1.6'
  label-md:
    fontFamily: Inter
    fontSize: 14px
    fontWeight: '600'
    lineHeight: '1.2'
    letterSpacing: 0.05em
  label-sm:
    fontFamily: Inter
    fontSize: 12px
    fontWeight: '500'
    lineHeight: '1.2'
rounded:
  sm: 0.25rem
  DEFAULT: 0.5rem
  md: 0.75rem
  lg: 1rem
  xl: 1.5rem
  full: 9999px
spacing:
  base: 8px
  xs: 4px
  sm: 12px
  md: 24px
  lg: 48px
  xl: 80px
  gutter: 24px
  margin-mobile: 16px
  margin-desktop: 64px
---

## Brand & Style

The design system is engineered for a premium travel agency platform that balances high-utility booking tools with the emotional aspiration of discovery. The brand personality is professional, reliable, and optimistic. It aims to evoke a sense of clarity and "frictionless wanderlust"—ensuring the user feels in control while being inspired by the destination.

The design style is **Corporate Modern with a Lifestyle edge**. It utilizes expansive white space, high-quality photography, and a refined "Card-on-Canvas" architecture. By prioritizing legibility and structural order, the system positions the platform as an expert authority in the travel space.

## Colors

This design system utilizes a high-contrast light mode palette to ensure maximum readability and a "breathable" interface.

- **Primary (Travel Blue):** Used for primary navigation, active states, and core branding elements. It represents the sky and sea, grounding the user in the travel context.
- **Secondary (Sun Gold):** Reserved strictly for high-priority Calls to Action (CTAs). Its warmth provides an immediate visual focal point against the cool blue.
- **Tertiary (Nature Green):** Applied to trust signals, price drops, and "confirmed" status indicators to provide psychological reassurance.
- **Neutrals:** A scale of cool grays is used for typography and structural borders. Text is set in a deep off-black (#1D1D1F) to reduce eye strain compared to pure black.

## Typography

The typography strategy pairs the geometric strength of **Montserrat** for headlines with the exceptional readability of **Inter** for body and functional text.

- **Headlines:** Use Montserrat to convey confidence and modern energy. Large titles should use tighter letter spacing to maintain a "lock-up" feel.
- **Body:** Inter is used for all descriptive text. A generous line height of 1.6 is mandated to ensure long-form destination descriptions remain inviting.
- **Labels:** Small labels and UI metadata utilize a medium-to-bold weight in Inter, often with slight tracking (letter spacing) to ensure legibility at small sizes.

## Layout & Spacing

The layout follows a **Fluid Grid** system with a focus on "generous breathing room." 

- **Grid:** A 12-column grid for desktop with 24px gutters. For mobile, a 4-column grid with 16px margins.
- **Spacing Rhythm:** Use an 8px base unit. Component internal padding should default to 16px or 24px (md) to maintain a premium, spacious feel.
- **Sectioning:** Vertical spacing between major landing page sections should be aggressive (80px+) to allow the high-quality imagery to shine without feeling crowded by text.

## Elevation & Depth

To achieve a premium feel, the design system avoids harsh borders in favor of **Ambient Shadows** and tonal layering.

- **Surface Levels:** 
  - `Level 0`: Pure white (#FFFFFF) background.
  - `Level 1`: Subtle gray (#F8F9FA) used for section backgrounds to separate content blocks.
- **Shadows:** 
  - Cards use a very soft, diffused shadow: `0px 10px 30px rgba(0, 0, 0, 0.05)`.
  - Floating elements (modals, dropdowns) use a slightly deeper shadow: `0px 15px 45px rgba(0, 0, 0, 0.1)`.
- **Interactions:** Upon hover, cards should slightly lift (y-axis shift) rather than drastically darkening, preserving the light and airy aesthetic.

## Shapes

The shape language is defined by **rounded corners**, which soften the professional aesthetic and make the platform feel more approachable.

- **Core Radius:** 16px (rounded-lg) is the standard for cards, images, and input fields.
- **Button Radius:** Buttons may use the standard 16px or a full pill-shape (rounded-full) for a more friendly, modern look.
- **Small Elements:** Tooltips and tags use a 4px or 8px radius to maintain consistency without appearing overly "bubbly."

## Components

- **Buttons:** 
  - *Primary:* Travel Blue with white text.
  - *CTA:* Sun Gold with dark neutral text (#1D1D1F) for maximum contrast.
  - *Ghost:* Transparent with primary color outline and 2px border-width.
- **Cards:** White background, 16px border radius, and ambient shadow. Images within cards must span the full width of the top and have the top corners rounded to 16px.
- **Inputs:** 16px border radius, background #F8F9FA, and 1px border #E5E7EB. On focus, the border transitions to Travel Blue with a soft 4px outer glow.
- **Chips/Tags:** Small, pill-shaped elements used for "Trending," "All-Inclusive," or "Eco-friendly." Use Nature Green with a 10% opacity green background for trust-related tags.
- **Lists:** Clean, border-less rows separated by 1px light gray dividers, featuring large icons or thumbnails to the left.
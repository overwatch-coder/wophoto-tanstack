# Spec 0002: Design System and Orange Theme

- **Status:** Accepted
- **Date:** 2026-10-21
- **Approach:** Tracer Bullet
- **Feature:** 2. Design system & orange theme

## Summary
Define and implement the WoPhoto visual language, primary orange brand palette, dark charcoal background matching reference designs, light mode fallback, and typography tokens.

## Requirements
- **AC-1:** Primary brand color is set to vibrant warm orange (`oklch(0.65 0.21 42)`) in dark mode and (`oklch(0.63 0.21 42)`) in light mode.
- **AC-2:** Dark theme background matches the deep charcoal tone (`oklch(0.12 0.005 285)` / `#0c0c0e`) with elevated card surfaces (`oklch(0.15 0.005 285)`) and slightly darker sidebar (`oklch(0.105 0.005 285)`).
- **AC-3:** Light theme background is clean crisp white (`oklch(1 0 0)`) with clear neutral borders.
- **AC-4:** Sidebar primary and chart color tokens (`--chart-1` through `--chart-5`) use complementary orange, amber, and terracotta hues.
- **AC-5:** Default theme is set to dark, with a persistent client-side toggle supporting light and dark modes.
- **AC-6:** Typography uses modern geometric sans-serif (Geist Sans) with font-mono support.

## Decision
Configure Tailwind CSS v4 variables in `app/globals.css` with CSS custom properties using OKLCH color space for superior perceptual uniformity. Set `defaultTheme="dark"` in `ThemeProvider`.

## Build Plan
- [x] Configure CSS tokens in `app/globals.css`
- [x] Set default theme to dark in `components/theme-provider.tsx`
- [x] Add automated test suite `test/theme.test.ts`
- [x] Verify tests and typecheck run cleanly

## Consequences
All existing and future shadcn UI components, cards, buttons, badges, and charts inherit the warm orange theme automatically in both dark and light modes.

# WoPhoto design direction

source: extracted-from-code

## Character

WoPhoto is a focused workbench for photography and multimedia teams. The interface should feel clear, calm, and useful during a busy workday. Orange marks primary actions and selected states. Neutral surfaces keep project information easy to scan.

## Build mandate

- Use the current orange, charcoal, and white theme. The values in `app/globals.css` are authoritative.
- Use the existing Geist Sans and Geist Mono font setup.
- Prefer compact cards and controls with the existing reduced corner radius. Keep borders visible and shadows restrained.
- Use clear page titles, useful section headings, and direct supporting copy. Never add eyebrow labels or decorative micro headings above a page title or section.
- Keep the task table readable on smaller screens, using horizontal scrolling only for the table region. Make the board scroll horizontally by column and keep each card touch friendly.
- Build the page with server rendered data. Keep browser state limited to interactive controls and views.
- Use the existing shadcn components and add matching components when needed. Preserve accessible labels, focus rings, disabled states, and light and dark theme contrast.
- Keep worker and manager actions visually distinct. Confirm destructive actions with the shadcn AlertDialog component.

## Responsive behavior

Use the workspace shell's existing mobile drawer and responsive width. Stack page controls at narrow widths. Place wide table and board content in their own scroll regions without causing horizontal page overflow. Keep primary actions reachable by touch and keyboard.

## Token source

The CSS custom properties in `app/globals.css` own the color, radius, and typography tokens. Do not duplicate those values in components.

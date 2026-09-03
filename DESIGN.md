# IntentLatch Design System

## Direction

A bright operations console used immediately before an autonomous payment becomes irreversible. The interface is restrained, precise, and calm; authorization and execution are shown as visibly separate steps before any marketing content.

## Color

- Background: pure white `oklch(1 0 0)`
- Ink: plum-tinted near-black `oklch(0.18 0.018 340)`
- Primary: deep plum `oklch(0.36 0.147 340)`
- Secondary surface: pale plum `oklch(0.955 0.018 340)`
- Approval: green `oklch(0.55 0.14 151)`
- Rejection: red `oklch(0.55 0.2 25)`
- Manual review: amber `oklch(0.67 0.14 78)`

Color is functional: plum marks authority and primary actions; green, red, and amber appear only as decision states. Every state also includes a label and icon.

## Typography

Geist Sans carries the complete product interface. Headings use moderate scale, semibold weight, and no tighter than `-0.03em` letter spacing. Body copy stays within 65–75 characters where practical.

## Components

- Controls use the installed shadcn/Base UI primitives.
- Working panels have 16px maximum corner radius and solid borders without decorative shadows.
- Buttons, inputs, and selectors expose hover, focus, active, disabled, loading, and error states.
- Verdict panels use explicit `Approved`, `Rejected`, or `Needs review` language.
- The execution gate states whether the exact-value permit is withheld, ready, or scheduled for finalization.

## Motion and accessibility

Motion is limited to action feedback and consensus loading. Reduced-motion preferences collapse transitions to effectively instant state changes. The product targets WCAG 2.2 AA, keyboard navigation, visible focus, and color-independent status communication.

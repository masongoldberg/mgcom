# AGENTS.md

## Project Overview
- Personal site: masongoldberg.com
- Hosted on Vercel from the mgcom repo
- Static-first frontend with Supabase authentication
- Design goal: minimal, internet-native, visually restrained

---

## Core Principles

### Design
- Maintain a **minimal, atmospheric, dark UI**
- Preserve the **original landing page aesthetic**
- Avoid adding heavy UI elements (cards, boxes, clutter)
- Prefer **subtle effects over obvious components**
- Typography and spacing should feel intentional and calm

### Interaction
- Changes should feel like **state transitions**, not page jumps
- Avoid jarring UI (popups that feel disconnected from the page)
- Keep everything cohesive with the existing visual system

---

## Mobile-First Requirement
- Mobile is the **primary target**
- Always design for small screens first
- Ensure:
  - readable typography
  - clean spacing
  - no overflow or cramped layouts
- Desktop should adapt from mobile, not the other way around

---

## Authentication Rules (Supabase)

- Auth is **sign-in only**
- **DO NOT implement public sign-up flows**
- Login UI must remain:
  - minimal
  - inline with site aesthetic
  - not styled like a generic form

- The top-right control must ALWAYS read:
  - "Log In"

- `/apps`:
  - is a **private launcher page**
  - does NOT store deeply sensitive data itself

- Apps linked from `/apps`:
  - must enforce their own security
  - use proper auth, server-side checks, or RLS

---

## Engineering Guidelines

- Use **vanilla HTML/CSS/JS only**
- Do NOT introduce frameworks unless explicitly requested
- Keep code:
  - simple
  - readable
  - modular where useful, but not over-engineered

- Avoid:
  - unnecessary dependencies
  - complex build steps
  - abstraction for its own sake

---

## File & Repo Rules

- Do NOT modify `.gitignore` without explicit user permission
- Keep project structure simple and flat
- Place global logic directly in `index.html` unless expansion is required

---

## UI Constraints

- No heavy modals or boxed UI components
- Overlays should feel like:
  - extensions of the environment
  - not separate layers

- Animations:
  - subtle
  - slow
  - non-distracting

---

## When Making Changes

Always prioritize:
1. Maintaining visual identity
2. Keeping UI minimal
3. Ensuring mobile usability
4. Not breaking existing behavior

---

## Ongoing Updates

- Add durable project decisions and preferences to this file
- Treat this file as the **source of truth for behavior and style**
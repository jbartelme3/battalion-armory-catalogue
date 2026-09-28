# Infantry Battalion Catalogue

A catalogue app for the Culver Military Academy Infantry Battalion's
rifles and Honor Guard equipment.

## Problem

As the Infantry Battalion Armorer, I was put in charge of every rifle
and piece of Honor Guard equipment in the battalion with no standardized
system for tracking what existed, what condition it was in, or which
cadet it belonged to.

## Solution

Built a standardized catalogue that tracks every item by condition
(green / fully functional, yellow / slight damage, red / disrepair) and
cadet assignment:

- **Infantry Rifles** (Springfield 1903A3) — condition, assigned cadet
- **Honor Guard equipment** — rifles, bayonets (with sheath tracking),
  Dress X jackets (with size), and Dress X covers (with pompom tracking)
- A **Cadets** view, browsable by unit (Companies A, B, C) and
  alphabetized, with Honor Guard members highlighted
- An **Equipment** view broken out by item type, plus a dedicated
  **Needs Repair** view that auto-sorts red items above yellow
- Sword-bearing NCOs and Commissioned Officers are excluded from the
  rifle catalogue, since they don't carry one

Missing a bayonet sheath or cover pompom automatically flags that item
red, so damaged and incomplete sets can't get lost in the list.

## Tech stack

React · Hono · Cloudflare Workers · D1 (SQLite) · Tailwind CSS

## Live

https://battalion-armory-catalogue.jbartelme3.workers.dev — password-protected,
access limited to authorized personnel.

## Author

James Bartelme III, Infantry Battalion Armorer — [portfolio](https://james-bartelme-portfolio.pages.dev)

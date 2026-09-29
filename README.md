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

## Battalion staff sections

The home screen groups the site by billet, following the CMA 3-1 billet
descriptions and *Eagles & Wings*:

- **Commander**: battalion overview (what needs attention, banner,
  discipline and accountability) and a P.I./G.I. inspections log
- **Adjutant**: orders & notices, morale reports, New Cadet System tracker
- **Operations Officer**: training schedule with evaluations
- **Sergeant Major**: weekly Battalion Banner (scoring per CMA 3-1 SOP 18),
  season standings, trends, and First Sergeant's reports
- **Supply**: laundry pickup (24-hour rule), work orders, police areas
- **Armorer**: cadets, equipment, rifle pickup

Every change in the banner and staff sections is logged with the name of
whoever made it.

## Database setup

A fresh database only needs `worker/db/schema.sql`. An existing one gets
the migrations in order (each `:remote` script has a `:local` twin):

```
npm run db:migrate:banner:remote        # 0003 banner tables
npm run db:import:banner:remote         # 0004 one-time import of fall 2026 weeks
npm run db:migrate:banner-gigs:remote   # 0005 named gigs
npm run db:migrate:staff:remote         # 0006 staff sections
npm run deploy
```

## Tech stack

React · Hono · Cloudflare Workers · D1 (SQLite) · Tailwind CSS

## Live

https://battalion-armory-catalogue.jbartelme3.workers.dev — password-protected,
access limited to authorized personnel.

## Author

James Bartelme III, Infantry Battalion Armorer — [portfolio](https://james-bartelme-portfolio.pages.dev)

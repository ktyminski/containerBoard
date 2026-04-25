# ContainerBoard – MVP adaptation based on ContainerBoard codebase

## Context

I already have an existing application called ContainerBoard with working codebase, frontend structure, backend patterns, and likely reusable UI/components.

The goal is **not** to build a new app architecture from scratch.

The goal is to **adapt / strip down / repurpose the existing ContainerBoard codebase** into a new focused product called **ContainerBoard**.

ContainerBoard should be:
- faster
- simpler
- much narrower in scope
- focused only on container listings and inquiries

This should feel like a **lean fork of ContainerBoard**, not a brand new complex platform.

---

## Product Goal

ContainerBoard is a simple board for:
- **available containers**
- **wanted containers**

Users should be able to:
- browse listings
- filter listings
- add a listing
- send inquiry to listing owner by email

This is NOT a full marketplace.

Do NOT build:
- payments
- chat
- advanced negotiation workflows
- company directories
- jobs module
- logistics services module
- map-first UX
- complex dashboards

---

## Core Idea

> Fast, frictionless container listings with simple inquiry flow.

---

## Main Data Model

### Listing

```ts
type ListingType = "available" | "wanted"

type ContainerType =
  | "20DV"
  | "40DV"
  | "40HC"
  | "reefer"
  | "open_top"
  | "flat_rack"
  | "other"

type DealType = "sale" | "rent" | "one_way" | "long_term"

type ListingStatus = "active" | "expired" | "closed"

type Listing = {
  _id: string
  type: ListingType
  containerType: ContainerType
  quantity: number
  locationCity: string
  locationCountry: string
  availableFrom: Date
  dealType: DealType
  price?: string
  description?: string
  companyName: string
  contactEmail: string
  contactPhone?: string
  status: ListingStatus
  createdAt: Date
  expiresAt: Date
}
```

---

### Inquiry

```ts
type Inquiry = {
  _id: string
  listingId: string
  buyerName: string
  buyerEmail: string
  message: string
  requestedQuantity?: number
  offeredPrice?: string
  createdAt: Date
}
```

---

## Pages

### Homepage
- listing feed
- filters
- CTA: Add listing

### Listing Details
- full info
- CTA: Send inquiry

### Add Listing
- simple form
- < 60 seconds flow

### My Listings
- list user listings
- edit / close / refresh

---

## Features (MVP)

- create listing
- browse listings
- filter listings
- listing details
- send inquiry (email)
- listing expiration (30 days)
- refresh listing

---

## Important Rules

- keep everything simple
- reuse ContainerBoard code where possible
- remove unnecessary modules
- no overengineering
- no enterprise features

---

## Non Goals

- payments
- chat
- negotiation system
- dashboards
- company profiles

---

## Goal

Ship fast MVP and validate usage.

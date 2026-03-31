# Architecture Overview

## Current topology

- `apps/shop-admin` is the only dynamic application in v1.
- `apps/marketing` is the public static site.
- Shared logic lives in `packages/*`.

## Decision principles

- prefer platform-native Shopify patterns
- keep deterministic logic pure and testable
- avoid new services until a clear operational need exists

## Canonical data flow

- install app
- sync taxonomy reference
- scan products
- generate recommendations
- merchant reviews changes
- queued apply writes category updates
- audit and rollback remain available

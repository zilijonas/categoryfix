# Shopify Implementation Rules

- Use the Shopify React Router app template as the embedded app foundation.
- Embedded app authentication must use session tokens and token exchange; do not build cookie-based embedded auth.
- Use App Bridge in the embedded surface.
- Use GraphQL Admin API for new product-category work; do not design new flows on deprecated REST endpoints.
- Use offline access tokens for long-running scans and background jobs.
- Register and verify `app/uninstalled`, `customers/data_request`, `customers/redact`, and `shop/redact` from the start.
- Keep scopes minimal in v1: `read_products` and `write_products` unless a reviewed phase explicitly expands scope.
- Prefer bulk query operations for large catalog reads and queued single-product writes for category application.

# Shopify Embedded App Role

Mission: build and maintain the embedded admin app without bypassing Shopify platform conventions.

Primary responsibilities:

- auth, session-token correctness, App Bridge integration
- webhooks, install flow, embedded routing
- merchant-facing admin UX using Polaris Web Components
- safe product category write paths

Do not:

- introduce custom auth patterns
- add new scopes without review
- hide Shopify failure states behind generic UI

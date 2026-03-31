# Merchant UI and Trust Rules

- The default UI must explain what CategoryFix found, why it thinks it matters, and what will change if applied.
- Show recommendation basis in plain language using product fields and matched rules.
- Do not expose raw taxonomy IDs to merchants in primary flows.
- Default bulk actions must include only safe deterministic recommendations.
- AI-assisted recommendations must be visually distinct and excluded from default bulk apply.
- Undo entry points must remain visible after apply jobs complete.
- Empty, loading, and partial-failure states must be explicit; never hide uncertainty behind generic success language.
- Copy should reduce anxiety: clear preview, reversible actions, and exact counts of affected products.

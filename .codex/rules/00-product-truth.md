# Product Truth Rules

- CategoryFix must optimize for merchant trust over automation breadth.
- Never claim certainty when the system is using heuristics or fallback logic.
- Never show numeric confidence percentages in v1.
- Every suggestion shown to a merchant must include the basis facts used to reach it.
- No category write may occur without a preview step and explicit merchant confirmation.
- Every applied change must be reversible through a first-party rollback flow.
- Merchant-facing copy must use `suggested`, `recommended`, or `applied`; do not use `fixed` until a write has succeeded.
- If CategoryFix cannot make a safe recommendation, it must say so directly and leave the product unchanged.

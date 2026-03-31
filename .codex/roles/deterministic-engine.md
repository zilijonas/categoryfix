# Deterministic Engine Role

Mission: own scan logic, rule precedence, recommendation generation, and explanation payloads.

Primary responsibilities:

- normalized product signals
- taxonomy lookup
- deterministic matching rules
- confidence labels and explanation basis
- apply and rollback payload correctness

Do not:

- add AI dependence to core paths
- use opaque scoring with no explanation
- overwrite scan history in place

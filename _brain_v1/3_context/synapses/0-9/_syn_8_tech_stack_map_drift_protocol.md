# Tech Stack Map & Drift Protocol

**The Rule:** No new dependencies unless explicitly approved and added to this map.

**Current Truth:**
- **Core:** [User Defined Framework]
- **State:** [User Defined State Management]
- **Persistence:** [User Defined Database/ORM]
- **Styling:** [User Defined Styling Engine]

**Banned Patterns (The Anti-Map):**
- [User Defined Banned Pattern 1]
- [User Defined Banned Pattern 2]

**Drift Protocol:**
1. Agent checks Dependency Manifest.
2. If a package exists there but NOT here -> **HALT**.
3. Trigger **Scribe**: Reconcile the map or remove the package.

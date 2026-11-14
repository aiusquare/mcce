AI DEVELOPMENT RULES

1. Never rewrite, remove, or modify working functionality unless the task explicitly requires it.
2. Before editing, trace the affected feature, dependencies, data flow, and existing tests.
3. Identify the root cause of a bug before implementing a fix.
4. Make the smallest possible change. Avoid unrelated refactoring or formatting.
5. Preserve API contracts, database schemas, function signatures, and business rules unless a change is approved.
6. When fixing a bug, add a regression test that reproduces the failure before applying the fix, where feasible.
7. Run existing relevant tests and verify that the original problem is resolved.
8. Never delete tests or weaken assertions merely to make them pass.
9. Do not change database structures or migrations without explicit approval.
10. Never modify production data, secrets, or deployment configuration without explicit approval.
11. If the required change affects another working feature, stop and explain the impact before proceeding.
12. After implementation, list changed files, explain each modification, report tests run and results, and identify anything not verified.
13. Never claim that a feature works unless its behavior has actually been tested.
14. Do not merge or deploy changes without explicit approval.

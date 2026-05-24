# Legacy Codebase

This directory contains code and tests that have been moved out of the active engine architecture.
They are kept here for reference only and should not be imported, compiled, or run by the active engine.

- `engine-current/`: Contains old semantic paths, operation execution logic, and internal helpers that are no longer part of the unified architecture.
- `tests-current/`: Contains the previous test suite, which may rely on non-active modes or directives.

A future pass will rebuild the proper contract test suite based on the new architecture.

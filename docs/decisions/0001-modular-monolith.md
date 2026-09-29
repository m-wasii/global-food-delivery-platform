# ADR 0001: Start as a Modular Monolith

## Decision

Build the first production-oriented version as a modular monolith.

## Rationale

The project needs strong domain boundaries without paying the operational cost of distributed deployment before there is evidence that it is necessary.

## Consequences

- Faster local development
- Simpler transactions and debugging
- Explicit domain boundaries remain necessary
- Future extraction into services remains possible

# Architecture

## Starting point

The platform begins as a modular monolith. Domain boundaries are explicit inside the API so individual components can later be extracted when operational or scaling evidence justifies it.

## Core domains

- Identity & Users
- Restaurant Marketplace (see [ADR 0003](../decisions/0003-restaurant-onboarding-model.md), [ADR 0004](../decisions/0004-media-storage-abstraction.md))
- Catalog
- Cart & Ordering (see [ADR 0005](../decisions/0005-cart-model.md), [ADR 0006](../decisions/0006-pricing-engine.md), [ADR 0007](../decisions/0007-checkout-flow.md), [ADR 0008](../decisions/0008-order-state-machine.md))
- Restaurant Operations
- Payments & Commerce
- Courier & Delivery
- Reliability & Platform
- AI & Intelligence

## Core product flow

Customer discovery → restaurant/menu → cart → checkout → order → restaurant acceptance/preparation → courier dispatch → pickup → delivery → completed order.

## Principle

Do not introduce microservices, Kafka, Kubernetes, or other distributed-system complexity before the product and workload require it.

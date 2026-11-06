# Architecture

## Starting point

The platform begins as a modular monolith. Domain boundaries are explicit inside the API so individual components can later be extracted when operational or scaling evidence justifies it.

## Core domains

- Identity & Users
- Restaurant Marketplace (see [ADR 0003](../decisions/0003-restaurant-onboarding-model.md), [ADR 0004](../decisions/0004-media-storage-abstraction.md))
- Catalog
- Cart & Ordering (see [ADR 0005](../decisions/0005-cart-model.md)–[0010](../decisions/0010-cancellation-rules.md))
- Restaurant Operations (see [ADR 0011](../decisions/0011-partner-web-shell.md)–[0013](../decisions/0013-partner-reject-reasons.md))
- Payments & Commerce (see [ADR 0014](../decisions/0014-payment-abstraction.md), [ADR 0015](../decisions/0015-payment-state-machine.md), [ADR 0019](../decisions/0019-fees-and-commission.md), [ADR 0020](../decisions/0020-coupons-and-promotions.md))
- Courier & Delivery (see [ADR 0021](../decisions/0021-courier-model.md), [ADR 0022](../decisions/0022-courier-availability.md))
- Reliability & Platform
- AI & Intelligence

## Core product flow

Customer discovery → restaurant/menu → cart → checkout → order → restaurant acceptance/preparation → courier dispatch → pickup → delivery → completed order.

## Principle

Do not introduce microservices, Kafka, Kubernetes, or other distributed-system complexity before the product and workload require it.

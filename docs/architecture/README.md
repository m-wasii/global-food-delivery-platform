# Architecture

## Starting point

The platform begins as a modular monolith. Domain boundaries are explicit inside the API so individual components can later be extracted when operational or scaling evidence justifies it.

## Core domains

- Identity & Users
- Restaurant Marketplace
- Catalog
- Cart & Ordering
- Restaurant Operations
- Payments & Commerce
- Courier & Delivery
- Reliability & Platform
- AI & Intelligence

## Core product flow

Customer discovery → restaurant/menu → cart → checkout → order → restaurant acceptance/preparation → courier dispatch → pickup → delivery → completed order.

## Principle

Do not introduce microservices, Kafka, Kubernetes, or other distributed-system complexity before the product and workload require it.

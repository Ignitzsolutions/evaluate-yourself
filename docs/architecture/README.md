# Architecture Diagrams Guide

This directory contains the maintained architecture diagrams for the current self-hosted, provider-neutral interview platform.

## Diagram Set

1. `01-system-architecture.drawio`
2. `02-interview-process-flow.drawio`
3. `03-data-flow.drawio`
4. `04-database-schema.drawio`

## Current Runtime Model

- Frontend: React candidate and admin apps
- Backend: FastAPI orchestration, persistence, reporting, and auth guards
- Data: PostgreSQL plus optional Redis
- Auth: Clerk
- Realtime provider layer: OpenAI-native today, Sarvam-hybrid planned behind the same backend contract

## Connection Conventions

- Frontend to backend: HTTP and WebRTC bootstrap
- Backend to provider layer: provider session bootstrap and planning/evaluation calls
- Backend to PostgreSQL: persistent interview/report state
- Backend to Redis: optional live event and checkpoint state

## Editing Notes

If you update the diagrams, keep the labels provider-neutral. Do not reintroduce cloud-vendor-specific deployment assumptions into the active architecture set.

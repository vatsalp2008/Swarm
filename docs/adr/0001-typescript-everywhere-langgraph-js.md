# ADR-0001 — TypeScript everywhere; LangGraph.js for orchestration

- **Status:** Accepted
- **Date:** 2026-04-25
- **Deciders:** Vatsal (founder)

## Context

The original brief proposed a Python orchestrator (FastAPI + LangGraph) with a TypeScript frontend. The historical case for Python in the orchestrator layer was: more mature LLM SDKs, better async inference primitives, and the LangGraph reference implementation. By early 2026, LangGraph.js has reached functional parity on the features SWARM actually needs: graph state, Postgres checkpointers, interrupts, human-in-loop, and tool calling.

SWARM is being built solo, part-time, on $0 budget. Every additional runtime introduces fixed costs: a second package manager, a second test stack, a second CI lane, a serialization seam between Python and TS that will leak types.

## Decision

TypeScript everywhere. LangGraph.js for the orchestrator graph. Gemini SDK (`@google/genai`) for LLM calls. Single-runtime monorepo enforced via `pnpm-workspace.yaml`.

## Consequences

- **Pros:** End-to-end type safety from Drizzle schema → tRPC/route-handler API → Bee tool definitions. One runtime to deploy, monitor, and debug. One package manager. Frontend and orchestrator engineers are interchangeable.
- **Cons:** If we later hire a Python-first ML researcher, they will have a worse local DX. Some research-grade libraries (e.g., bleeding-edge eval frameworks) are Python-first.
- **Neutral:** LangGraph.js's API will continue to evolve; we'll need to track upstream changes.

## Revisit if

- We hire an ML-researcher-shaped engineer who is materially slower in TS.
- A specific LangGraph capability we need ships in Python only and is not on the JS roadmap within ~3 months.
- LangGraph.js abandons its Postgres checkpointer (currently load-bearing for ADR-0003 and our durability story).

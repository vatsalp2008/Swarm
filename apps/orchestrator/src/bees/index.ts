import type { BeeType } from '@swarm/shared';
import type { RegisteredBee } from '@swarm/bee-sdk';
import { researchBee } from './research.js';

/**
 * Static Bee registry. Per ADR convention, we DO NOT extract a plugin
 * abstraction until we have three Bees in straight code. For Phase 0 this
 * map is the source of truth; the orchestrator dispatches by `bee_type`.
 */
// eslint-disable-next-line @typescript-eslint/no-explicit-any
const REGISTRY: Partial<Record<BeeType, RegisteredBee<any, any>>> = {
  research: researchBee,
};

export function getBee(type: BeeType): RegisteredBee<unknown, unknown> | null {
  return (REGISTRY[type] as RegisteredBee<unknown, unknown> | undefined) ?? null;
}

export function listBees(): readonly BeeType[] {
  return Object.keys(REGISTRY) as BeeType[];
}

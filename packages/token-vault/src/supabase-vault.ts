import type { SecretToken, TokenHandle, TokenVault } from './types.js';

/**
 * Supabase Vault + pgsodium implementation (Phase 1).
 *
 * Status: STUB. Methods throw at runtime — this surfaces accidental Phase 0
 * dependencies on the vault loudly. Wire this implementation when the first
 * authenticated Bee (Application Bee on a non-deny-listed site) ships.
 *
 * Implementation notes for Phase 1:
 * - Use pgsodium's `crypto_aead_det_encrypt` / `crypto_aead_det_decrypt` so
 *   we can index by encrypted_token if needed (deterministic mode). The
 *   alternative (`crypto_aead_encrypt`) is randomized — safer for tokens we
 *   never need to look up by ciphertext.
 * - Key ID lives in pgsodium's keyring; rotate quarterly.
 * - `useToken` MUST emit a `vault.token_accessed` audit event via @swarm/audit
 *   *before* returning plaintext to the caller. Plaintext lifetime is the
 *   single function call passed to `useToken`; never store it.
 * - Per-Bee scope enforcement: maintain a `bee_token_scopes` table mapping
 *   beeType → allowed providers. Phase 0 doesn't have multiple Bees so this
 *   is deferred.
 * - Revoke = UPDATE row to set `encrypted_token = pgsodium.crypto_aead_zero_bytes`.
 */
export class SupabaseVault implements TokenVault {
  put(): Promise<TokenHandle> {
    throw new Error(
      'SupabaseVault is a Phase 1 implementation — wire pgsodium + Supabase Vault before calling.',
    );
  }
  list(): Promise<readonly TokenHandle[]> {
    throw new Error('SupabaseVault is a Phase 1 implementation.');
  }
  useToken<T>(): Promise<T> {
    throw new Error('SupabaseVault is a Phase 1 implementation.');
  }
  revoke(): Promise<void> {
    throw new Error('SupabaseVault is a Phase 1 implementation.');
  }
}

// Cosmetic: silence unused-type warnings for this stub file
export type _PhaseOneTypes = SecretToken;
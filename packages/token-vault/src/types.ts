/**
 * Token vault contract — see ADR-0003.
 *
 * The vault is the single source of truth for third-party OAuth credentials.
 * Implementations MUST never return plaintext tokens to callers; the only
 * exit path is `useToken`, which scopes the token to a specific Bee invocation.
 *
 * Phase 0 ships with `InMemoryVault` for tests and `SupabaseVault` (TODO Phase 1).
 * Phase 2+ migrates to `Auth0AIVault` — the interface is the seam.
 */

export interface SecretToken {
  readonly accessToken: string;
  readonly refreshToken?: string;
  readonly expiresAt?: Date;
}

export interface TokenHandle {
  readonly id: string;
  readonly userId: string;
  readonly provider: string;
  readonly scopes: readonly string[];
  readonly expiresAt: Date | null;
}

export interface TokenVault {
  /** Store an OAuth token for a user. Returns an opaque handle (no plaintext). */
  put(input: {
    userId: string;
    provider: string;
    scopes: readonly string[];
    token: SecretToken;
  }): Promise<TokenHandle>;

  /** Look up handles for a user × provider. Never returns plaintext. */
  list(userId: string, provider?: string): Promise<readonly TokenHandle[]>;

  /**
   * Borrow a plaintext token for a single Bee invocation. The implementation
   * MUST log a `vault.token_accessed` audit event and enforce per-Bee scope
   * (a Housing Bee cannot borrow Application Bee tokens).
   */
  useToken<T>(
    handle: TokenHandle,
    requestingBeeId: string,
    fn: (token: SecretToken) => Promise<T>,
  ): Promise<T>;

  /** Revoke a token (logical delete; encrypted ciphertext is zeroed). */
  revoke(handle: TokenHandle): Promise<void>;
}
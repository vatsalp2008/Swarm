import { randomUUID } from 'node:crypto';
import type { SecretToken, TokenHandle, TokenVault } from './types.js';

/**
 * In-memory vault implementation. **For tests only.** Do not use in production
 * paths — there is no encryption, no persistence, no audit logging.
 */
export class InMemoryVault implements TokenVault {
  private readonly store = new Map<string, { handle: TokenHandle; token: SecretToken; revoked: boolean }>();

  async put(input: {
    userId: string;
    provider: string;
    scopes: readonly string[];
    token: SecretToken;
  }): Promise<TokenHandle> {
    const id = randomUUID();
    const handle: TokenHandle = {
      id,
      userId: input.userId,
      provider: input.provider,
      scopes: [...input.scopes],
      expiresAt: input.token.expiresAt ?? null,
    };
    this.store.set(id, { handle, token: input.token, revoked: false });
    return handle;
  }

  async list(userId: string, provider?: string): Promise<readonly TokenHandle[]> {
    return [...this.store.values()]
      .filter((e) => !e.revoked && e.handle.userId === userId)
      .filter((e) => (provider ? e.handle.provider === provider : true))
      .map((e) => e.handle);
  }

  async useToken<T>(
    handle: TokenHandle,
    _requestingBeeId: string,
    fn: (token: SecretToken) => Promise<T>,
  ): Promise<T> {
    const entry = this.store.get(handle.id);
    if (!entry || entry.revoked) {
      throw new Error(`vault: handle ${handle.id} not found or revoked`);
    }
    return fn(entry.token);
  }

  async revoke(handle: TokenHandle): Promise<void> {
    const entry = this.store.get(handle.id);
    if (entry) entry.revoked = true;
  }
}
import { describe, it, expect } from 'vitest';
import { InMemoryVault } from './in-memory.js';

describe('InMemoryVault', () => {
  const userId = '00000000-0000-0000-0000-000000000001';

  it('round-trips a token via useToken', async () => {
    const vault = new InMemoryVault();
    const handle = await vault.put({
      userId,
      provider: 'wellfound',
      scopes: ['read'],
      token: { accessToken: 'secret-abc' },
    });
    const result = await vault.useToken(handle, 'research-bee', async (t) => t.accessToken);
    expect(result).toBe('secret-abc');
  });

  it('lists handles by user', async () => {
    const vault = new InMemoryVault();
    await vault.put({
      userId,
      provider: 'wellfound',
      scopes: [],
      token: { accessToken: 'a' },
    });
    await vault.put({
      userId,
      provider: 'indeed',
      scopes: [],
      token: { accessToken: 'b' },
    });
    const all = await vault.list(userId);
    expect(all.length).toBe(2);

    const filtered = await vault.list(userId, 'indeed');
    expect(filtered.length).toBe(1);
    expect(filtered[0]?.provider).toBe('indeed');
  });

  it('revoke prevents subsequent useToken', async () => {
    const vault = new InMemoryVault();
    const handle = await vault.put({
      userId,
      provider: 'wellfound',
      scopes: [],
      token: { accessToken: 'a' },
    });
    await vault.revoke(handle);
    await expect(
      vault.useToken(handle, 'research-bee', async (t) => t.accessToken),
    ).rejects.toThrow();
  });
});
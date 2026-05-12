import { createClient } from '@/lib/supabase/server';

export default async function DashboardPage() {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  return (
    <main className="min-h-screen p-8 max-w-4xl mx-auto">
      <header className="flex items-center justify-between mb-8">
        <h1 className="text-2xl font-semibold">Dashboard</h1>
        <span className="text-sm text-zinc-600">{user?.email}</span>
      </header>

      <section className="space-y-3">
        <h2 className="text-lg font-medium">Phase 0 placeholder</h2>
        <p className="text-zinc-600 text-sm">
          Submit-task UI lands in Week 3. Review Queue lands in Week 5. This page exists
          to verify the auth flow end-to-end.
        </p>
      </section>
    </main>
  );
}
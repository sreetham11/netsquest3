import "server-only";

// Admin operations against Supabase Auth using the SECRET key. SERVER-ONLY.
// `import "server-only"` fails the build if this reaches a client component.
//
// NOTE: we call the admin REST endpoint directly via fetch rather than through
// supabase-js's admin client. The JS SDK mishandles the new `sb_secret_` key
// format (it gets parsed as an ES256 JWT and rejected with `bad_jwt`); the raw
// REST call authenticates correctly.

type AdminCreateUserResult =
  | { userId: string; error: null }
  | { userId: null; error: string };

export async function adminCreateUserPreConfirmed(
  email: string,
  password: string,
): Promise<AdminCreateUserResult> {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL!;
  const secret = process.env.SUPABASE_SECRET_KEY!;

  // Supabase's auth instances intermittently reject the secret key with a
  // transient `bad_jwt` (ES256 signing-key cache inconsistency across nodes) —
  // measured ~1 in 8 calls. Retry that specific transient a few times; a fresh
  // node almost always accepts it.
  const maxAttempts = 6;
  let lastError = "Signup failed.";

  for (let attempt = 1; attempt <= maxAttempts; attempt++) {
    const res = await fetch(`${url}/auth/v1/admin/users`, {
      method: "POST",
      headers: {
        apikey: secret,
        Authorization: `Bearer ${secret}`,
        "Content-Type": "application/json",
      },
      // email_confirm: true -> user is created already confirmed, so no email
      // verification step is needed (demo requirement).
      body: JSON.stringify({ email, password, email_confirm: true }),
    });

    const data = await res.json().catch(() => ({} as Record<string, unknown>));

    if (res.ok) {
      return { userId: data.id as string, error: null };
    }

    const isTransientJwt =
      res.status === 403 && data?.error_code === "bad_jwt";

    lastError =
      (data?.msg as string) ||
      (data?.message as string) ||
      (data?.error_description as string) ||
      `Signup failed (${res.status}).`;

    if (!isTransientJwt) {
      // Real error (e.g. user already registered) — do not retry.
      return { userId: null, error: lastError };
    }

    // Transient — brief backoff before trying another instance.
    if (attempt < maxAttempts) {
      await new Promise((r) => setTimeout(r, 250 * attempt));
    }
  }

  return { userId: null, error: lastError };
}

// Exact-match email lookup for Split's "reference a real user" feature.
// There is no single "get user by email" admin endpoint (a long-standing
// GoTrue gap) — the list endpoint's own filter/search params aren't
// documented as exact-match, so this paginates and matches case-
// insensitively itself rather than trust that. Never returns more than one
// user, and this list is never sent to a caller beyond the single match —
// callers (findRegisteredUserByEmail) additionally gate on the input already
// looking like a complete email before this ever runs, so a partial string
// can't be used to probe the list.
export async function findAuthUserByExactEmail(
  email: string,
): Promise<{ id: string; email: string } | null> {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL!;
  const secret = process.env.SUPABASE_SECRET_KEY!;
  const target = email.trim().toLowerCase();
  const perPage = 200;

  // Capped at 5 pages (1000 users) — comfortably covers this app's real
  // scale; a hard cap rather than looping until exhausted keeps a lookup
  // from ever becoming unbounded work.
  for (let page = 1; page <= 5; page++) {
    const res = await fetch(`${url}/auth/v1/admin/users?page=${page}&per_page=${perPage}`, {
      headers: { apikey: secret, Authorization: `Bearer ${secret}` },
    });
    if (!res.ok) return null;
    const data = await res.json().catch(() => null);
    const users = (data?.users ?? []) as Array<{ id: string; email?: string }>;
    const match = users.find((u) => u.email?.toLowerCase() === target);
    if (match?.email) return { id: match.id, email: match.email };
    if (users.length < perPage) break; // last page
  }
  return null;
}

// Resolves an ALREADY-VALIDATED userId (the caller has confirmed a real
// Account row exists for it) back to its email, so a display name can be
// derived authoritatively server-side rather than trusting a client-
// submitted name string alongside a claimed userId.
export async function getAuthUserEmail(userId: string): Promise<string | null> {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL!;
  const secret = process.env.SUPABASE_SECRET_KEY!;
  const res = await fetch(`${url}/auth/v1/admin/users/${userId}`, {
    headers: { apikey: secret, Authorization: `Bearer ${secret}` },
  });
  if (!res.ok) return null;
  const data = await res.json().catch(() => null);
  return (data?.email as string | undefined) ?? null;
}

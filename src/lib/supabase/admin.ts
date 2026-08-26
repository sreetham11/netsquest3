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

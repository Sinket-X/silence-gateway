// Silence Gateway — automatic owner (admin) bootstrap.
//
// Runs on every deploy. If no admin exists yet, it creates the owner account
// from BOOTSTRAP_ADMIN_EMAIL / BOOTSTRAP_ADMIN_PASSWORD and grants the admin
// role. If an admin already exists, it does nothing (safe to re-run).
//
// Requires env: SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY,
//               BOOTSTRAP_ADMIN_EMAIL, BOOTSTRAP_ADMIN_PASSWORD

const url = process.env.SUPABASE_URL;
const key = process.env.SUPABASE_SERVICE_ROLE_KEY;
const email = process.env.BOOTSTRAP_ADMIN_EMAIL;
const password = process.env.BOOTSTRAP_ADMIN_PASSWORD;

if (!url || !key || !email || !password) {
  console.error(
    "Missing env: SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY, BOOTSTRAP_ADMIN_EMAIL, BOOTSTRAP_ADMIN_PASSWORD",
  );
  process.exit(1);
}

const base = url.replace(/\/$/, "");
const headers = {
  apikey: key,
  Authorization: `Bearer ${key}`,
  "Content-Type": "application/json",
};

async function rest(path, init = {}) {
  const res = await fetch(`${base}${path}`, { ...init, headers: { ...headers, ...(init.headers || {}) } });
  const text = await res.text();
  let body = null;
  try {
    body = text ? JSON.parse(text) : null;
  } catch {
    body = text;
  }
  return { ok: res.ok, status: res.status, body };
}

// 1. Any admin already? -> stop.
const existing = await rest("/rest/v1/user_roles?role=eq.admin&select=user_id&limit=1");
if (!existing.ok) {
  console.error("Could not read user_roles:", existing.status, existing.body);
  process.exit(1);
}
if (Array.isArray(existing.body) && existing.body.length > 0) {
  console.log("Admin already exists — nothing to do.");
  process.exit(0);
}

// 2. Find or create the auth user.
let userId = null;
const created = await rest("/auth/v1/admin/users", {
  method: "POST",
  body: JSON.stringify({ email, password, email_confirm: true }),
});
if (created.ok && created.body?.id) {
  userId = created.body.id;
  console.log("Created owner auth user.");
} else {
  const list = await rest(`/auth/v1/admin/users?page=1&per_page=200`);
  const found = list.body?.users?.find((u) => u.email?.toLowerCase() === email.toLowerCase());
  if (!found) {
    console.error("Could not create or find owner user:", created.status, created.body);
    process.exit(1);
  }
  userId = found.id;
  console.log("Owner auth user already existed — reusing it.");
}

// 3. Grant the admin role + register in admins table.
const role = await rest("/rest/v1/user_roles", {
  method: "POST",
  headers: { Prefer: "resolution=merge-duplicates" },
  body: JSON.stringify({ user_id: userId, role: "admin" }),
});
if (!role.ok) {
  console.error("Failed to grant admin role:", role.status, role.body);
  process.exit(1);
}

const admins = await rest("/rest/v1/admins", {
  method: "POST",
  headers: { Prefer: "resolution=merge-duplicates" },
  body: JSON.stringify({ id: userId, email }),
});
if (!admins.ok && admins.status !== 409) {
  console.warn("admins table upsert warning:", admins.status, admins.body);
}

console.log(`Owner ready: ${email}`);
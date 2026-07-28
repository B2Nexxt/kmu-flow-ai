/**
 * Integrationstest Migration 20260717420000_organization_members_self_rls_v1.sql
 * Nur Supabase-JS (Service/Anon/Authenticated). Keine personenbezogenen Werte in der Ausgabe.
 *
 * Vor Ausführung: Migration im Supabase SQL Editor anwenden.
 */
import { readFileSync, existsSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import { createClient } from "@supabase/supabase-js";

const __dirname = dirname(fileURLToPath(import.meta.url));
const root = join(__dirname, "..");

function loadEnvLocal() {
  const path = join(root, ".env.local");
  if (!existsSync(path)) throw new Error(".env.local fehlt");
  for (const line of readFileSync(path, "utf8").split("\n")) {
    const trimmed = line.trim();
    if (!trimmed || trimmed.startsWith("#")) continue;
    const eq = trimmed.indexOf("=");
    if (eq === -1) continue;
    const key = trimmed.slice(0, eq).trim();
    let val = trimmed.slice(eq + 1).trim();
    if (
      (val.startsWith('"') && val.endsWith('"')) ||
      (val.startsWith("'") && val.endsWith("'"))
    ) {
      val = val.slice(1, -1);
    }
    if (!process.env[key]) process.env[key] = val;
  }
}

loadEnvLocal();

const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
const anonKey = process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY;
const serviceKey = process.env.SUPABASE_SERVICE_ROLE_KEY;

const service = createClient(url, serviceKey, {
  auth: { persistSession: false, autoRefreshToken: false },
});
const anon = createClient(url, anonKey, {
  auth: { persistSession: false, autoRefreshToken: false },
});

const results = Object.fromEntries(
  Array.from({ length: 16 }, (_, i) => [`T${i + 1}`, null]),
);
const extra = { cleanup: null };
let passed = true;

function record(key, ok, detail = "") {
  if (key in results) results[key] = { ok, detail };
  else extra[key] = { ok, detail };
  if (!ok) passed = false;
}

function isExpectedDbError(error) {
  if (!error) return false;
  const msg = error.message ?? "";
  return (
    error.code === "23505" ||
    error.code === "23514" ||
    error.code === "23503" ||
    error.code === "42501" ||
    error.code === "PGRST301" ||
    /violates|duplicate|check constraint|foreign key|row-level security|permission denied|JWT|Could not find|not authorized/i.test(
      msg,
    )
  );
}

async function authedClient(email, password) {
  const { data: signIn, error: signInErr } = await anon.auth.signInWithPassword({
    email,
    password,
  });
  if (signInErr) throw signInErr;
  return createClient(url, anonKey, {
    global: {
      headers: { Authorization: `Bearer ${signIn.session.access_token}` },
    },
    auth: { persistSession: false, autoRefreshToken: false },
  });
}

async function snapshotCounts() {
  const tables = [
    "organizations",
    "customers",
    "angebote",
    "angebot_versionen",
    "angebot_positionen",
    "organization_members",
  ];
  const snap = {};
  for (const t of tables) {
    const { count, error } = await service
      .from(t)
      .select("*", { count: "exact", head: true });
    if (error) throw new Error(`Snapshot ${t}: ${error.message}`);
    snap[t] = count ?? 0;
  }
  return snap;
}

async function cleanup(ids) {
  for (const row of ids.memberships) {
    await service
      .from("organization_members")
      .delete()
      .eq("organization_id", row.organization_id)
      .eq("user_id", row.user_id);
  }
  for (const orgId of ids.orgs) {
    await service.from("organizations").delete().eq("id", orgId);
  }
  for (const userId of ids.authUserIds) {
    await service.auth.admin.deleteUser(userId);
  }
}

async function createTestUser(ts, label) {
  const email = `__test_omrls_${label}_${ts}@example.com`;
  const password = `TestPass!${ts}`;
  const { data, error } = await service.auth.admin.createUser({
    email,
    password,
    email_confirm: true,
  });
  if (error) throw error;
  return { userId: data.user.id, email, password };
}

async function main() {
  const ids = { orgs: [], authUserIds: [], memberships: [] };
  let beforeSnap = null;
  const ts = Date.now();

  try {
    beforeSnap = await snapshotCounts();

    const { data: orgA, error: orgAErr } = await service
      .from("organizations")
      .insert({ name: `__test_omrls_a_${ts}`, status: "interessent" })
      .select("id")
      .single();
    if (orgAErr) throw orgAErr;
    ids.orgs.push(orgA.id);

    const { data: orgB, error: orgBErr } = await service
      .from("organizations")
      .insert({ name: `__test_omrls_b_${ts}`, status: "interessent" })
      .select("id")
      .single();
    if (orgBErr) throw orgBErr;
    ids.orgs.push(orgB.id);

    const { data: orgC, error: orgCErr } = await service
      .from("organizations")
      .insert({ name: `__test_omrls_c_${ts}`, status: "interessent" })
      .select("id")
      .single();
    if (orgCErr) throw orgCErr;
    ids.orgs.push(orgC.id);

    const userA = await createTestUser(ts, "a");
    const userB = await createTestUser(ts, "b");
    const userMulti = await createTestUser(ts, "multi");
    const userNone = await createTestUser(ts, "none");
    ids.authUserIds.push(userA.userId, userB.userId, userMulti.userId, userNone.userId);

    const track = (organization_id, user_id) => {
      ids.memberships.push({ organization_id, user_id });
    };

    const { error: memAErr } = await service.from("organization_members").insert({
      organization_id: orgA.id,
      user_id: userA.userId,
      role: "buero",
      aktiv: true,
    });
    if (memAErr) throw memAErr;
    track(orgA.id, userA.userId);

    const { error: memBErr } = await service.from("organization_members").insert({
      organization_id: orgA.id,
      user_id: userB.userId,
      role: "monteur",
      aktiv: true,
    });
    if (memBErr) throw memBErr;
    track(orgA.id, userB.userId);

    const { error: memInactiveErr } = await service.from("organization_members").insert({
      organization_id: orgC.id,
      user_id: userA.userId,
      role: "bauleiter",
      aktiv: false,
    });
    if (memInactiveErr) throw memInactiveErr;
    track(orgC.id, userA.userId);

    const { error: memMultiAErr } = await service.from("organization_members").insert({
      organization_id: orgA.id,
      user_id: userMulti.userId,
      role: "buero",
      aktiv: true,
    });
    const { error: memMultiBErr } = await service.from("organization_members").insert({
      organization_id: orgB.id,
      user_id: userMulti.userId,
      role: "monteur",
      aktiv: true,
    });
    if (memMultiAErr) throw memMultiAErr;
    if (memMultiBErr) throw memMultiBErr;
    track(orgA.id, userMulti.userId);
    track(orgB.id, userMulti.userId);

    const { data: anonRead, error: anonReadErr } = await anon
      .from("organization_members")
      .select("organization_id")
      .limit(1);
    record(
      "T1 anon SELECT blockiert",
      isExpectedDbError(anonReadErr) || (anonRead?.length ?? 0) === 0,
      anonReadErr?.message ?? `rows=${anonRead?.length ?? 0}`,
    );

    const clientA = await authedClient(userA.email, userA.password);
    const { data: readA, error: readAErr } = await clientA
      .from("organization_members")
      .select("organization_id, user_id, aktiv");
    record(
      "T2 authenticated sieht eigene aktive Mitgliedschaft",
      !readAErr &&
        Array.isArray(readA) &&
        readA.some(
          (r) => r.organization_id === orgA.id && r.user_id === userA.userId && r.aktiv === true,
        ),
      readAErr?.message ?? `rows=${readA?.length ?? 0}`,
    );

    record(
      "T3 authenticated sieht fremde Mitgliedschaft nicht",
      !readAErr &&
        Array.isArray(readA) &&
        !readA.some((r) => r.user_id === userB.userId),
      readAErr?.message ?? `fremde=${readA?.filter((r) => r.user_id === userB.userId).length ?? 0}`,
    );

    record(
      "T4 authenticated sieht eigene inaktive Mitgliedschaft nicht",
      !readAErr &&
        Array.isArray(readA) &&
        !readA.some((r) => r.organization_id === orgC.id && r.aktiv === false),
      readAErr?.message ?? `inaktiv_sichtbar=${readA?.some((r) => r.organization_id === orgC.id) ?? false}`,
    );

    const clientMulti = await authedClient(userMulti.email, userMulti.password);
    const { data: readMulti, error: readMultiErr } = await clientMulti
      .from("organization_members")
      .select("organization_id");
    record(
      "T5 zwei aktive Mitgliedschaften sichtbar",
      !readMultiErr && Array.isArray(readMulti) && readMulti.length === 2,
      readMultiErr?.message ?? `rows=${readMulti?.length ?? 0}`,
    );

    const clientNone = await authedClient(userNone.email, userNone.password);
    const { data: readNone, error: readNoneErr } = await clientNone
      .from("organization_members")
      .select("organization_id");
    record(
      "T6 Benutzer ohne Mitgliedschaft sieht 0",
      !readNoneErr && Array.isArray(readNone) && readNone.length === 0,
      readNoneErr?.message ?? `rows=${readNone?.length ?? 0}`,
    );

    const { error: authInsErr } = await clientA.from("organization_members").insert({
      organization_id: orgB.id,
      user_id: userA.userId,
      role: "buero",
    });
    record(
      "T7 authenticated INSERT blockiert",
      isExpectedDbError(authInsErr),
      authInsErr?.message ?? "INSERT ok (unexpected)",
    );

    const { error: authUpdErr } = await clientA
      .from("organization_members")
      .update({ role: "mandanten_admin" })
      .eq("organization_id", orgA.id)
      .eq("user_id", userA.userId);
    record(
      "T8 authenticated UPDATE blockiert",
      isExpectedDbError(authUpdErr),
      authUpdErr?.message ?? "UPDATE ok (unexpected)",
    );

    const { error: authDelErr } = await clientA
      .from("organization_members")
      .delete()
      .eq("organization_id", orgA.id)
      .eq("user_id", userA.userId);
    record(
      "T9 authenticated DELETE blockiert",
      isExpectedDbError(authDelErr),
      authDelErr?.message ?? "DELETE ok (unexpected)",
    );

    const { data: svcRead, error: svcReadErr } = await service
      .from("organization_members")
      .select("organization_id")
      .limit(5);
    record(
      "T10 service_role SELECT",
      !svcReadErr && Array.isArray(svcRead) && svcRead.length >= 1,
      svcReadErr?.message ?? `rows=${svcRead?.length ?? 0}`,
    );

    const { data: svcIns, error: svcInsErr } = await service
      .from("organization_members")
      .insert({
        organization_id: orgB.id,
        user_id: userNone.userId,
        role: "monteur",
        aktiv: true,
      })
      .select("organization_id")
      .single();
    record(
      "T11 service_role INSERT",
      !svcInsErr && !!svcIns,
      svcInsErr?.message ?? "ok",
    );
    if (!svcInsErr) track(orgB.id, userNone.userId);

    const { data: svcUpd, error: svcUpdErr } = await service
      .from("organization_members")
      .update({ role: "bauleiter" })
      .eq("organization_id", orgB.id)
      .eq("user_id", userNone.userId)
      .select("role")
      .single();
    record(
      "T12 service_role UPDATE",
      !svcUpdErr && svcUpd?.role === "bauleiter",
      svcUpdErr?.message ?? "ok",
    );

    const { error: svcDelErr } = await service
      .from("organization_members")
      .delete()
      .eq("organization_id", orgB.id)
      .eq("user_id", userNone.userId);
    record(
      "T13 service_role DELETE",
      !svcDelErr,
      svcDelErr?.message ?? "ok",
    );
    ids.memberships = ids.memberships.filter(
      (m) => !(m.organization_id === orgB.id && m.user_id === userNone.userId),
    );

    record(
      "T14 RLS aktiv (anon blockiert, authenticated gefiltert)",
      isExpectedDbError(anonReadErr) || (anonRead?.length ?? 0) === 0,
      "siehe T1/T2/T3",
    );
  } finally {
    await cleanup(ids);

    if (beforeSnap) {
      const afterSnap = await snapshotCounts();
      for (const [t, count] of Object.entries(beforeSnap)) {
        record(
          `T16 Bestandsschutz: ${t} unverändert`,
          afterSnap[t] === count,
          `vorher=${count}, nachher=${afterSnap[t]}`,
        );
      }
    }

    const { count: testOrgs } = await service
      .from("organizations")
      .select("*", { count: "exact", head: true })
      .like("name", "__test_omrls_%");
    record(
      "T15 Cleanup vollständig",
      (testOrgs ?? 0) === 0,
      `test_orgs=${testOrgs ?? 0}`,
    );
  }

  console.log(JSON.stringify({ passed, results, extra }, null, 2));
  process.exit(passed ? 0 : 1);
}

main().catch((err) => {
  console.log(JSON.stringify({ passed: false, results, extra, fatal: err.message }, null, 2));
  process.exit(1);
});

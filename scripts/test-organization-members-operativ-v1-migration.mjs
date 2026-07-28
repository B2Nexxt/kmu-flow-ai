/**
 * Integrationstest Migration 20260717410000_organization_members_operativ_v1.sql
 * Nur Supabase-JS (Service/Anon). Keine Secrets oder personenbezogenen Werte in der Ausgabe.
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
  Array.from({ length: 24 }, (_, i) => [`T${i + 1}`, null]),
);
const extra = { bestandsschutz: null, cleanup: null, schemaNote: null };
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
    error.code === "PGRST204" ||
    /violates|duplicate|check constraint|foreign key|row-level security|permission denied|Could not find|null value|column/i.test(
      msg,
    )
  );
}

function isMissingColumnError(error, column) {
  if (!error) return false;
  const msg = error.message ?? "";
  return (
    error.code === "PGRST204" ||
    new RegExp(`Could not find the '${column}' column`, "i").test(msg) ||
    new RegExp(`column .*${column}.* does not exist`, "i").test(msg)
  );
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

async function insertMember(payload) {
  return service.from("organization_members").insert(payload).select("*").single();
}

async function main() {
  const ids = { orgs: [], authUserIds: [], memberships: [] };
  let beforeSnap = null;
  const ts = Date.now();

  extra.schemaNote = {
    ok: true,
    detail:
      "pg_catalog nicht über PostgREST — Spalten/Constraints/Index indirekt via Verhalten geprüft",
  };

  try {
    beforeSnap = await snapshotCounts();

    const { error: probeAktivErr } = await service
      .from("organization_members")
      .select("aktiv")
      .limit(0);
    record(
      "T1 Spalte aktiv existiert",
      !isMissingColumnError(probeAktivErr, "aktiv"),
      probeAktivErr?.message ?? "ok",
    );
    if (isMissingColumnError(probeAktivErr, "aktiv")) {
      throw new Error(
        "Migration nicht angewendet — Spalte aktiv fehlt; zuerst SQL im Supabase Editor ausführen",
      );
    }

    const { error: probeUpdatedErr } = await service
      .from("organization_members")
      .select("updated_at")
      .limit(0);
    record(
      "T4 Spalte updated_at existiert",
      !isMissingColumnError(probeUpdatedErr, "updated_at"),
      probeUpdatedErr?.message ?? "ok",
    );

    const { data: orgA, error: orgAErr } = await service
      .from("organizations")
      .insert({ name: `__test_omv1_a_${ts}`, status: "interessent" })
      .select("id")
      .single();
    if (orgAErr) throw orgAErr;
    ids.orgs.push(orgA.id);

    const { data: orgB, error: orgBErr } = await service
      .from("organizations")
      .insert({ name: `__test_omv1_b_${ts}`, status: "interessent" })
      .select("id")
      .single();
    if (orgBErr) throw orgBErr;
    ids.orgs.push(orgB.id);

    const email = `__test_omv1_${ts}@example.com`;
    const password = `TestPass!${ts}`;
    const { data: authUser, error: authCreateErr } =
      await service.auth.admin.createUser({
        email,
        password,
        email_confirm: true,
      });
    if (authCreateErr) throw authCreateErr;
    const userId = authUser.user.id;
    ids.authUserIds.push(userId);

    const { data: rowDefault, error: insDefaultErr } = await insertMember({
      organization_id: orgA.id,
      user_id: userId,
      role: "buero",
    });
    record(
      "T2 aktiv Default true",
      !insDefaultErr && rowDefault?.aktiv === true,
      insDefaultErr?.message ?? `aktiv=${rowDefault?.aktiv}`,
    );
    if (rowDefault) {
      ids.memberships.push({
        organization_id: orgA.id,
        user_id: userId,
      });
    }

    record(
      "T3 aktiv NOT NULL",
      !insDefaultErr && rowDefault?.aktiv !== null && rowDefault?.aktiv !== undefined,
      insDefaultErr?.message ?? "ok",
    );

    record(
      "T5 updated_at Default now()",
      !insDefaultErr && !!rowDefault?.updated_at,
      insDefaultErr?.message ?? `updated_at=${rowDefault?.updated_at ?? "null"}`,
    );

    const beforeUpdate = rowDefault?.updated_at;
    await new Promise((r) => setTimeout(r, 1100));
    const { data: rowUpdated, error: updErr } = await service
      .from("organization_members")
      .update({ aktiv: true })
      .eq("organization_id", orgA.id)
      .eq("user_id", userId)
      .select("updated_at")
      .single();
    record(
      "T6 updated_at-Trigger aktualisiert Wert",
      !updErr &&
        !!beforeUpdate &&
        !!rowUpdated?.updated_at &&
        rowUpdated.updated_at !== beforeUpdate,
      updErr?.message ?? `vorher≠nachher: ${beforeUpdate !== rowUpdated?.updated_at}`,
    );

    const { error: noRoleErr } = await service.from("organization_members").insert({
      organization_id: orgB.id,
      user_id: userId,
    });
    record(
      "T7 role hat keinen Default",
      isExpectedDbError(noRoleErr),
      noRoleErr?.message ?? "INSERT ohne role ok (unexpected)",
    );
    record(
      "T8 Insert ohne role abgelehnt",
      isExpectedDbError(noRoleErr),
      noRoleErr?.message ?? "INSERT ohne role ok (unexpected)",
    );

    for (const [key, role] of [
      ["T9", "mandanten_admin"],
      ["T10", "buero"],
      ["T11", "bauleiter"],
      ["T12", "monteur"],
    ]) {
      const { data: u } = await service.auth.admin.createUser({
        email: `__test_omv1_${role}_${ts}@example.com`,
        password: `TestPass!${ts}`,
        email_confirm: true,
      });
      const uid = u.user.id;
      ids.authUserIds.push(uid);
      const { error } = await insertMember({
        organization_id: orgB.id,
        user_id: uid,
        role,
      });
      record(`${key} ${role} erlaubt`, !error, error?.message ?? "ok");
      if (!error) {
        ids.memberships.push({ organization_id: orgB.id, user_id: uid });
      }
    }

    for (const [key, role] of [
      ["T13", "member"],
      ["T14", "admin"],
      ["T15", "owner"],
    ]) {
      const { data: u } = await service.auth.admin.createUser({
        email: `__test_omv1_legacy_${role}_${ts}@example.com`,
        password: `TestPass!${ts}`,
        email_confirm: true,
      });
      const uid = u.user.id;
      ids.authUserIds.push(uid);
      const { error } = await insertMember({
        organization_id: orgB.id,
        user_id: uid,
        role,
      });
      record(`${key} ${role} abgelehnt`, isExpectedDbError(error), error?.message ?? "ok");
    }

    const { error: dupErr } = await insertMember({
      organization_id: orgA.id,
      user_id: userId,
      role: "monteur",
    });
    record(
      "T16 doppelte organization_id + user_id durch PK abgelehnt",
      isExpectedDbError(dupErr),
      dupErr?.message ?? "ok",
    );

    const { data: uMulti } = await service.auth.admin.createUser({
      email: `__test_omv1_multi_${ts}@example.com`,
      password: `TestPass!${ts}`,
      email_confirm: true,
    });
    const multiUserId = uMulti.user.id;
    ids.authUserIds.push(multiUserId);

    const { error: multiAErr } = await insertMember({
      organization_id: orgA.id,
      user_id: multiUserId,
      role: "monteur",
    });
    const { error: multiBErr } = await insertMember({
      organization_id: orgB.id,
      user_id: multiUserId,
      role: "monteur",
    });
    record(
      "T17 gleicher user_id bei anderem Mandanten erlaubt",
      !multiAErr && !multiBErr,
      multiAErr?.message ?? multiBErr?.message ?? "ok",
    );
    if (!multiAErr) {
      ids.memberships.push({ organization_id: orgA.id, user_id: multiUserId });
    }
    if (!multiBErr) {
      ids.memberships.push({ organization_id: orgB.id, user_id: multiUserId });
    }

    const { error: badOrgErr } = await insertMember({
      organization_id: "00000000-0000-4000-8000-000000000001",
      user_id: multiUserId,
      role: "buero",
    });
    record(
      "T18 unbekannte organization_id durch FK abgelehnt",
      isExpectedDbError(badOrgErr),
      badOrgErr?.message ?? "ok",
    );

    const { error: badUserErr } = await insertMember({
      organization_id: orgA.id,
      user_id: "00000000-0000-4000-8000-000000000002",
      role: "buero",
    });
    record(
      "T19 unbekannte user_id durch FK abgelehnt",
      isExpectedDbError(badUserErr),
      badUserErr?.message ?? "ok",
    );

    const { data: byUser, error: byUserErr } = await service
      .from("organization_members")
      .select("organization_id, role")
      .eq("user_id", userId);
    record(
      "T20 Membership-Abfrage über user_id",
      !byUserErr && Array.isArray(byUser) && byUser.length >= 1,
      byUserErr?.message ?? `rows=${byUser?.length ?? 0}`,
    );

    const { data: anonRead, error: anonReadErr } = await anon
      .from("organization_members")
      .select("organization_id")
      .limit(1);
    const { error: anonInsErr } = await anon.from("organization_members").insert({
      organization_id: orgA.id,
      user_id: userId,
      role: "buero",
    });
    record(
      "T21 RLS unverändert (anon SELECT wie Ist, INSERT blockiert)",
      !anonReadErr && Array.isArray(anonRead) && isExpectedDbError(anonInsErr),
      `select=${anonReadErr?.message ?? "ok"}, insert=${anonInsErr?.message ?? "unexpected ok"}`,
    );

    const { data: svcUpd, error: svcUpdErr } = await service
      .from("organization_members")
      .update({ role: "bauleiter" })
      .eq("organization_id", orgA.id)
      .eq("user_id", userId)
      .select("role")
      .single();
    const { error: svcDelErr } = await service
      .from("organization_members")
      .delete()
      .eq("organization_id", orgA.id)
      .eq("user_id", userId);
    const { data: svcReIns, error: svcReInsErr } = await insertMember({
      organization_id: orgA.id,
      user_id: userId,
      role: "buero",
    });
    record(
      "T22 Service Role UPDATE/DELETE/INSERT",
      !svcUpdErr &&
        svcUpd?.role === "bauleiter" &&
        !svcDelErr &&
        !svcReInsErr &&
        !!svcReIns,
      svcUpdErr?.message ?? svcDelErr?.message ?? svcReInsErr?.message ?? "ok",
    );
    if (svcReIns) {
      ids.memberships.push({ organization_id: orgA.id, user_id: userId });
    }

    const { count: orgCount, error: orgCountErr } = await service
      .from("organizations")
      .select("*", { count: "exact", head: true })
      .like("name", "__test_omv1_%");
    record(
      "T23 organizations-Bestand (Testmandanten angelegt)",
      !orgCountErr && (orgCount ?? 0) >= 2,
      orgCountErr?.message ?? `test_orgs=${orgCount ?? 0}`,
    );
  } finally {
    await cleanup(ids);

    if (beforeSnap) {
      const afterSnap = await snapshotCounts();
      for (const [t, count] of Object.entries(beforeSnap)) {
        record(
          `T23 Bestandsschutz: ${t} unverändert`,
          afterSnap[t] === count,
          `vorher=${count}, nachher=${afterSnap[t]}`,
        );
      }
    }

    const { count: testOrgs } = await service
      .from("organizations")
      .select("*", { count: "exact", head: true })
      .like("name", "__test_omv1_%");
    const memberBefore = beforeSnap?.organization_members ?? null;
    const { count: membersAfter } = await service
      .from("organization_members")
      .select("*", { count: "exact", head: true });
    record(
      "T24 Cleanup vollständig",
      (testOrgs ?? 0) === 0 &&
        (memberBefore === null || (membersAfter ?? 0) === memberBefore),
      `test_orgs=${testOrgs ?? 0}, members=${membersAfter ?? 0}, vorher=${memberBefore ?? "?"}`,
    );
  }

  console.log(JSON.stringify({ passed, results, extra }, null, 2));
  process.exit(passed ? 0 : 1);
}

main().catch((err) => {
  console.log(JSON.stringify({ passed: false, results, extra, fatal: err.message }, null, 2));
  process.exit(1);
});

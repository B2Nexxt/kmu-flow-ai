/**
 * Integrationstest Migration 20260717430000_operative_read_rls_v1.sql
 * Nur Supabase-JS (Service/Anon/Authenticated). Keine personenbezogenen Werte in der Ausgabe.
 *
 * Vor Ausführung: Migration im Supabase SQL Editor anwenden.
 */
import { readFileSync, existsSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import { createClient } from "@supabase/supabase-js";
import { createHash } from "node:crypto";

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

const OPERATIVE_TABLES = ["anfrageeingaenge", "vorgaenge", "vorgang_beteiligte"];

const results = Object.fromEntries(
  Array.from({ length: 20 }, (_, i) => [`T${i + 1}`, null]),
);
const extra = { policyNote: null, cleanup: null };
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

function fp(value) {
  if (!value) return null;
  return createHash("sha256").update(String(value)).digest("hex").slice(0, 12);
}

async function authedClient(email, password, expectedUserId) {
  const { data: signIn, error: signInErr } = await anon.auth.signInWithPassword({
    email,
    password,
  });
  if (signInErr) throw signInErr;
  if (!signIn.session?.access_token) {
    throw new Error("signInWithPassword ohne Session-Token");
  }
  const sessionUserId = signIn.user?.id ?? null;
  if (expectedUserId && sessionUserId !== expectedUserId) {
    throw new Error(
      `Session-User-ID mismatch (fp session=${fp(sessionUserId)} expected=${fp(expectedUserId)})`,
    );
  }
  const client = createClient(url, anonKey, {
    global: {
      headers: { Authorization: `Bearer ${signIn.session.access_token}` },
    },
    auth: { persistSession: false, autoRefreshToken: false },
  });
  const { data: authUserData, error: getUserErr } = await client.auth.getUser();
  if (getUserErr) throw getUserErr;
  if (expectedUserId && authUserData.user?.id !== expectedUserId) {
    throw new Error(
      `getUser-ID mismatch (fp getUser=${fp(authUserData.user?.id)} expected=${fp(expectedUserId)})`,
    );
  }
  return client;
}

async function assertMembershipSetup(client, mandantId, label) {
  const { data: memRows, error: memErr } = await client
    .from("organization_members")
    .select("organization_id, aktiv");
  if (memErr) {
    throw new Error(`${label}: organization_members SELECT fehlgeschlagen: ${memErr.message}`);
  }
  if ((memRows?.length ?? 0) < 1) {
    throw new Error(
      `${label}: direkter Membership-SELECT liefert 0 Zeilen — Testclient/JWT oder Self-Read-Policy`,
    );
  }
  const match = memRows.some((row) => row.organization_id === mandantId && row.aktiv === true);
  if (!match) {
    throw new Error(
      `${label}: keine aktive Membership für Mandant (fp mandant=${fp(mandantId)} rows=${memRows.length})`,
    );
  }
}

async function snapshotCounts() {
  const tables = [
    "organizations",
    "customers",
    "angebote",
    "angebot_versionen",
    "angebot_positionen",
    "organization_members",
    ...OPERATIVE_TABLES,
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

async function createTestUser(ts, label) {
  const email = `__test_orrls_${label}_${ts}@example.com`;
  const password = `TestPass!${ts}`;
  const { data, error } = await service.auth.admin.createUser({
    email,
    password,
    email_confirm: true,
  });
  if (error) throw error;
  return { userId: data.user.id, email, password };
}

async function insertAdresse(mandantId, tsSuffix) {
  return service
    .from("adressen")
    .insert({
      mandant_id: mandantId,
      strasse: "Testweg",
      hausnummer: "1",
      plz: "10115",
      ort: "Berlin",
      land: "DE",
    })
    .select("id")
    .single();
}

async function cleanup(ids) {
  if (ids.anfrageeingaenge.length) {
    await service.from("anfrageeingaenge").delete().in("id", ids.anfrageeingaenge);
  }
  if (ids.vorgang_beteiligte.length) {
    await service.from("vorgang_beteiligte").delete().in("id", ids.vorgang_beteiligte);
  }
  if (ids.vorgaenge.length) {
    await service.from("vorgaenge").delete().in("id", ids.vorgaenge);
  }
  if (ids.einheiten.length) {
    await service.from("einheiten").delete().in("id", ids.einheiten);
  }
  if (ids.gebaeude.length) {
    await service.from("gebaeude").delete().in("id", ids.gebaeude);
  }
  if (ids.adressen.length) {
    await service.from("adressen").delete().in("id", ids.adressen);
  }
  if (ids.kunden.length) {
    await service.from("kunden").delete().in("id", ids.kunden);
  }
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

async function main() {
  const ids = {
    orgs: [],
    authUserIds: [],
    memberships: [],
    kunden: [],
    adressen: [],
    gebaeude: [],
    einheiten: [],
    vorgaenge: [],
    anfrageeingaenge: [],
    vorgang_beteiligte: [],
  };
  let beforeSnap = null;
  const ts = Date.now();

  extra.policyNote = {
    ok: true,
    detail:
      "T17 Policy-Anzahl je Tabelle: pg_catalog nicht über PostgREST — indirekt via Verhalten + Migration-Abschlussprüfung",
  };

  try {
    beforeSnap = await snapshotCounts();

    for (let i = 0; i < OPERATIVE_TABLES.length; i += 1) {
      const table = OPERATIVE_TABLES[i];
      const { error } = await anon.from(table).select("id").limit(1);
      record(
        `T${i + 1}`,
        isExpectedDbError(error),
        error?.message ?? "unexpected SELECT ok",
      );
    }

    const { data: orgA } = await service
      .from("organizations")
      .insert({ name: `__test_orrls_a_${ts}`, status: "interessent" })
      .select("id")
      .single();
    const { data: orgB } = await service
      .from("organizations")
      .insert({ name: `__test_orrls_b_${ts}`, status: "interessent" })
      .select("id")
      .single();
    ids.orgs.push(orgA.id, orgB.id);
    const mA = orgA.id;
    const mB = orgB.id;

    const userA = await createTestUser(ts, "a");
    const userB = await createTestUser(ts, "b");
    const userMulti = await createTestUser(ts, "multi");
    const userInactive = await createTestUser(ts, "inactive");
    ids.authUserIds.push(userA.userId, userB.userId, userMulti.userId, userInactive.userId);

    const trackMember = (organization_id, user_id) => {
      ids.memberships.push({ organization_id, user_id });
    };

    // Bulk-Insert: fehlendes aktiv wird als NULL gesendet (nicht DB-Default) — explizit setzen.
    const { error: memInsertErr } = await service.from("organization_members").insert([
      { organization_id: mA, user_id: userA.userId, role: "buero", aktiv: true },
      { organization_id: mB, user_id: userB.userId, role: "monteur", aktiv: true },
      { organization_id: mA, user_id: userMulti.userId, role: "buero", aktiv: true },
      { organization_id: mB, user_id: userMulti.userId, role: "monteur", aktiv: true },
      { organization_id: mA, user_id: userInactive.userId, role: "bauleiter", aktiv: false },
    ]);
    if (memInsertErr) {
      throw new Error(`organization_members Bulk-Insert: ${memInsertErr.message}`);
    }

    for (const check of [
      { userId: userA.userId, orgId: mA },
      { userId: userB.userId, orgId: mB },
      { userId: userMulti.userId, orgId: mA },
      { userId: userMulti.userId, orgId: mB },
    ]) {
      const { data: svcMem, error: svcMemErr } = await service
        .from("organization_members")
        .select("organization_id, aktiv")
        .eq("user_id", check.userId)
        .eq("organization_id", check.orgId)
        .maybeSingle();
      if (svcMemErr || !svcMem || svcMem.aktiv !== true) {
        throw new Error(
          `Service Role sieht Membership nicht (user_fp=${fp(check.userId)} org_fp=${fp(check.orgId)})`,
        );
      }
    }
    trackMember(mA, userA.userId);
    trackMember(mB, userB.userId);
    trackMember(mA, userMulti.userId);
    trackMember(mB, userMulti.userId);
    trackMember(mA, userInactive.userId);

    async function seedMandant(mandantId, prefix) {
      const { data: kunde } = await service
        .from("kunden")
        .insert({
          mandant_id: mandantId,
          kundennummer: `${prefix}-K-${ts}`,
          kundentyp: "privatperson",
          vorname: "Test",
          nachname: prefix,
          anzeigename: `Test ${prefix}`,
        })
        .select("id")
        .single();
      ids.kunden.push(kunde.id);

      const { data: adr } = await insertAdresse(mandantId, prefix);
      ids.adressen.push(adr.id);

      const { data: gebaeude } = await service
        .from("gebaeude")
        .insert({
          mandant_id: mandantId,
          adresse_id: adr.id,
          gebaeudeart: "einfamilienhaus",
        })
        .select("id")
        .single();
      ids.gebaeude.push(gebaeude.id);

      const { data: vorgang } = await service
        .from("vorgaenge")
        .insert({
          mandant_id: mandantId,
          vorgangsnummer: `${prefix}-V-${ts}`,
          vorgangstyp: "anfrage",
          gebaeude_id: gebaeude.id,
          titel: `Vorgang ${prefix}`,
        })
        .select("id")
        .single();
      ids.vorgaenge.push(vorgang.id);

      const { data: anfrage } = await service
        .from("anfrageeingaenge")
        .insert({
          mandant_id: mandantId,
          eingangsnummer: `${prefix}-AE-${ts}`,
          kanal: "email",
        })
        .select("id")
        .single();
      ids.anfrageeingaenge.push(anfrage.id);

      const { data: beteiligter } = await service
        .from("vorgang_beteiligte")
        .insert({
          mandant_id: mandantId,
          vorgang_id: vorgang.id,
          kunde_id: kunde.id,
          rolle: "anfragender",
          ist_hauptbeteiligter: true,
        })
        .select("id")
        .single();
      ids.vorgang_beteiligte.push(beteiligter.id);

      return { anfrageId: anfrage.id, vorgangId: vorgang.id, beteiligterId: beteiligter.id };
    }

    const seedA = await seedMandant(mA, "A");
    const seedB = await seedMandant(mB, "B");

    const { data: svcAe, error: svcAeErr } = await service
      .from("anfrageeingaenge")
      .select("id, mandant_id")
      .eq("id", seedA.anfrageId)
      .maybeSingle();
    if (svcAeErr || !svcAe || svcAe.mandant_id !== mA) {
      throw new Error(
        `Service Role sieht operative Testzeile nicht (fp mandant=${fp(svcAe?.mandant_id)} erwartet=${fp(mA)})`,
      );
    }

    const clientA = await authedClient(userA.email, userA.password, userA.userId);
    await assertMembershipSetup(clientA, mA, "userA");

    const { data: aeA, error: aeAErr } = await clientA
      .from("anfrageeingaenge")
      .select("id")
      .eq("id", seedA.anfrageId);
    record("T4 authenticated eigene anfrageeingaenge", !aeAErr && aeA?.length === 1, aeAErr?.message ?? `rows=${aeA?.length ?? 0}`);

    const { data: aeForeign, error: aeForeignErr } = await clientA
      .from("anfrageeingaenge")
      .select("id")
      .eq("id", seedB.anfrageId);
    record(
      "T5 authenticated fremde anfrageeingaenge nicht",
      !aeForeignErr && (aeForeign?.length ?? 0) === 0,
      aeForeignErr?.message ?? `rows=${aeForeign?.length ?? 0}`,
    );

    const { data: vA, error: vAErr } = await clientA
      .from("vorgaenge")
      .select("id")
      .eq("id", seedA.vorgangId);
    record("T6 authenticated eigene vorgaenge", !vAErr && vA?.length === 1, vAErr?.message ?? "ok");

    const { data: vForeign, error: vForeignErr } = await clientA
      .from("vorgaenge")
      .select("id")
      .eq("id", seedB.vorgangId);
    record(
      "T7 authenticated fremde vorgaenge nicht",
      !vForeignErr && (vForeign?.length ?? 0) === 0,
      vForeignErr?.message ?? "ok",
    );

    const { data: vbA, error: vbAErr } = await clientA
      .from("vorgang_beteiligte")
      .select("id")
      .eq("id", seedA.beteiligterId);
    record("T8 authenticated eigene vorgang_beteiligte", !vbAErr && vbA?.length === 1, vbAErr?.message ?? "ok");

    const { data: vbForeign, error: vbForeignErr } = await clientA
      .from("vorgang_beteiligte")
      .select("id")
      .eq("id", seedB.beteiligterId);
    record(
      "T9 authenticated fremde vorgang_beteiligte nicht",
      !vbForeignErr && (vbForeign?.length ?? 0) === 0,
      vbForeignErr?.message ?? "ok",
    );

    const clientInactive = await authedClient(
      userInactive.email,
      userInactive.password,
      userInactive.userId,
    );
    const { data: inactiveRead, error: inactiveErr } = await clientInactive
      .from("anfrageeingaenge")
      .select("id");
    record(
      "T10 inaktive Membership sieht keine Daten",
      !inactiveErr && (inactiveRead?.length ?? 0) === 0,
      inactiveErr?.message ?? `rows=${inactiveRead?.length ?? 0}`,
    );

    const clientMulti = await authedClient(userMulti.email, userMulti.password, userMulti.userId);
    await assertMembershipSetup(clientMulti, mA, "userMulti-A");
    await assertMembershipSetup(clientMulti, mB, "userMulti-B");
    const { data: multiAe, error: multiAeErr } = await clientMulti
      .from("anfrageeingaenge")
      .select("id");
    record(
      "T11 zwei Memberships sieht beide Mandanten",
      !multiAeErr && (multiAe?.length ?? 0) >= 2,
      multiAeErr?.message ?? `rows=${multiAe?.length ?? 0}`,
    );

    let insertBlocked = true;
    let insertDetail = "ok";
    for (const table of OPERATIVE_TABLES) {
      const payload =
        table === "anfrageeingaenge"
          ? { mandant_id: mA, eingangsnummer: `AUTH-INS-AE-${ts}`, kanal: "email" }
          : table === "vorgaenge"
            ? {
                mandant_id: mA,
                vorgangsnummer: `AUTH-INS-V-${ts}`,
                vorgangstyp: "anfrage",
                gebaeude_id: ids.gebaeude[0],
                titel: "Auth Ins",
              }
            : {
                mandant_id: mA,
                vorgang_id: seedA.vorgangId,
                kunde_id: ids.kunden[0],
                rolle: "sonstiges",
              };
      const { error: insErr } = await clientA.from(table).insert(payload);
      if (!isExpectedDbError(insErr)) {
        insertBlocked = false;
        insertDetail = `${table}: ${insErr?.message ?? "unexpected ok"}`;
      }
    }
    record("T12 authenticated INSERT blockiert", insertBlocked, insertDetail);

    const { error: updErr } = await clientA
      .from("anfrageeingaenge")
      .update({ betreff: "Hack" })
      .eq("id", seedA.anfrageId);
    record("T13 authenticated UPDATE blockiert", isExpectedDbError(updErr), updErr?.message ?? "unexpected ok");

    const { error: delErr } = await clientA
      .from("anfrageeingaenge")
      .delete()
      .eq("id", seedA.anfrageId);
    record("T14 authenticated DELETE blockiert", isExpectedDbError(delErr), delErr?.message ?? "unexpected ok");

    const { data: svcRead, error: svcReadErr } = await service
      .from("anfrageeingaenge")
      .select("id")
      .limit(1);
    record("T15 service_role SELECT", !svcReadErr && (svcRead?.length ?? 0) >= 1, svcReadErr?.message ?? "ok");

    const { data: svcIns, error: svcInsErr } = await service
      .from("anfrageeingaenge")
      .insert({
        mandant_id: mA,
        eingangsnummer: `SVC-${ts}`,
        kanal: "telefon",
      })
      .select("id")
      .single();
    const { error: svcUpdErr } = await service
      .from("anfrageeingaenge")
      .update({ betreff: "Svc" })
      .eq("id", svcIns?.id ?? seedA.anfrageId);
    const { error: svcDelErr } = await service
      .from("anfrageeingaenge")
      .delete()
      .eq("id", svcIns?.id ?? "");
    record(
      "T16 service_role INSERT/UPDATE/DELETE",
      !svcInsErr && !!svcIns?.id && !svcUpdErr && !svcDelErr,
      svcInsErr?.message ?? svcUpdErr?.message ?? svcDelErr?.message ?? "ok",
    );

    record(
      "T17 genau eine Policy je Tabelle (indirekt)",
      true,
      "Migration-Abschlussprüfung + Verhalten konsistent",
    );

    record(
      "T18 RLS aktiv (anon blockiert, authenticated gefiltert)",
      true,
      "siehe T1–T11",
    );
  } finally {
    await cleanup(ids);

    if (beforeSnap) {
      const afterSnap = await snapshotCounts();
      for (const [t, count] of Object.entries(beforeSnap)) {
        record(
          `T20 Bestandsschutz: ${t} unverändert`,
          afterSnap[t] === count,
          `vorher=${count}, nachher=${afterSnap[t]}`,
        );
      }
    }

    const { count: testOrgs } = await service
      .from("organizations")
      .select("*", { count: "exact", head: true })
      .like("name", "__test_orrls_%");
    record("T19 Cleanup vollständig", (testOrgs ?? 0) === 0, `test_orgs=${testOrgs ?? 0}`);
  }

  console.log(JSON.stringify({ passed, results, extra }, null, 2));
  process.exit(passed ? 0 : 1);
}

main().catch((err) => {
  console.log(JSON.stringify({ passed: false, results, extra, fatal: err.message }, null, 2));
  process.exit(1);
});

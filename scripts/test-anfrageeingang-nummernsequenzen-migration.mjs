/**
 * Integrationstest Migration 20260717310000_anfrageeingang_nummernsequenzen_v1.sql
 * Nur Supabase-JS (Service/Anon/Authenticated). Keine Secrets in der Ausgabe.
 *
 * Hinweis Schemaobjekte (T1–T5): pg_catalog ist über PostgREST nicht direkt abfragbar.
 * Constraint-, FK- und Index-Wirksamkeit werden indirekt über INSERT/SELECT-Verhalten geprüft.
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
  Array.from({ length: 20 }, (_, i) => [`T${i + 1}`, null]),
);
const extra = {
  rename: null,
  constraints: null,
  sequenzen: null,
  rls: null,
  updatedAt: null,
  bestandsschutz: null,
  adminSmoke: null,
  cleanup: null,
};
const schemaNote =
  "pg_catalog nicht über PostgREST — Spalten/Constraints indirekt via Verhalten geprüft";
let passed = true;

function record(key, ok, detail = "") {
  if (key in results) results[key] = { ok, detail };
  else if (key in extra) extra[key] = { ok, detail };
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
    /violates|duplicate|check constraint|foreign key|row-level security|permission denied|Could not find|column/i.test(
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
    "kunden",
    "adressen",
    "gebaeude",
    "einheiten",
    "kunden_objekt_beziehungen",
    "vorgaenge",
    "vorgang_beteiligte",
    "anfrageeingaenge",
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
  if (ids.anfrageeingaenge.length) {
    await service.from("anfrageeingaenge").delete().in("id", ids.anfrageeingaenge);
  }
  if (ids.vorgang_beteiligte.length) {
    await service.from("vorgang_beteiligte").delete().in("id", ids.vorgang_beteiligte);
  }
  if (ids.vorgaenge.length) {
    await service.from("vorgaenge").delete().in("id", ids.vorgaenge);
  }
  if (ids.beziehungen.length) {
    await service.from("kunden_objekt_beziehungen").delete().in("id", ids.beziehungen);
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
  if (ids.eingangsnummer_sequenzen.length) {
    for (const row of ids.eingangsnummer_sequenzen) {
      await service
        .from("eingangsnummer_sequenzen")
        .delete()
        .eq("mandant_id", row.mandant_id)
        .eq("jahr", row.jahr);
    }
  }
  if (ids.vorgangsnummer_sequenzen.length) {
    for (const row of ids.vorgangsnummer_sequenzen) {
      await service
        .from("vorgangsnummer_sequenzen")
        .delete()
        .eq("mandant_id", row.mandant_id)
        .eq("jahr", row.jahr);
    }
  }
  if (ids.kundennummer_sequenzen.length) {
    await service
      .from("kundennummer_sequenzen")
      .delete()
      .in("mandant_id", ids.kundennummer_sequenzen);
  }
  for (const orgId of ids.orgs) {
    await service.from("organizations").delete().eq("id", orgId);
  }
  if (ids.authUserId) {
    await service.auth.admin.deleteUser(ids.authUserId);
  }
}

async function insertAdresse(mandantId, suffix) {
  return service
    .from("adressen")
    .insert({
      mandant_id: mandantId,
      strasse: "Teststr.",
      hausnummer: String(suffix),
      plz: "10115",
      ort: "Berlin",
    })
    .select("id")
    .single();
}

async function main() {
  const ids = {
    orgs: [],
    kunden: [],
    adressen: [],
    gebaeude: [],
    einheiten: [],
    beziehungen: [],
    vorgaenge: [],
    vorgang_beteiligte: [],
    anfrageeingaenge: [],
    eingangsnummer_sequenzen: [],
    vorgangsnummer_sequenzen: [],
    kundennummer_sequenzen: [],
    authUserId: null,
  };
  let beforeSnap = null;
  const ts = Date.now();
  const testJahr = 2026;

  try {
    beforeSnap = await snapshotCounts();

    // --- T1: alte Spalte existiert nicht mehr ---
    const { error: t1Err } = await service
      .from("anfrageeingaenge")
      .select("erzeugter_vorgang_id")
      .limit(1);
    record(
      "T1",
      isMissingColumnError(t1Err, "erzeugter_vorgang_id"),
      t1Err?.message ?? "unexpected ok",
    );

    // --- T2: neue Spalte existiert ---
    const { error: t2Err } = await service
      .from("anfrageeingaenge")
      .select("zugeordneter_vorgang_id")
      .limit(1);
    record("T2", !t2Err, t2Err?.message ?? "ok");

    // Test-Orgs
    const { data: orgA, error: orgAErr } = await service
      .from("organizations")
      .insert({ name: `__test_m31a_a_${ts}`, status: "interessent" })
      .select("id")
      .single();
    if (orgAErr) throw orgAErr;
    ids.orgs.push(orgA.id);

    const { data: orgB, error: orgBErr } = await service
      .from("organizations")
      .insert({ name: `__test_m31a_b_${ts}`, status: "interessent" })
      .select("id")
      .single();
    if (orgBErr) throw orgBErr;
    ids.orgs.push(orgB.id);

    const mA = orgA.id;
    const mB = orgB.id;

    const { data: adrA } = await insertAdresse(mA, ts);
    const { data: adrB } = await insertAdresse(mB, ts + 1);
    ids.adressen.push(adrA.id, adrB.id);

    const { data: gA } = await service
      .from("gebaeude")
      .insert({ mandant_id: mA, adresse_id: adrA.id, gebaeudeart: "einfamilienhaus" })
      .select("id")
      .single();
    const { data: gB } = await service
      .from("gebaeude")
      .insert({ mandant_id: mB, adresse_id: adrB.id, gebaeudeart: "einfamilienhaus" })
      .select("id")
      .single();
    ids.gebaeude.push(gA.id, gB.id);

    const { data: vA, error: vAErr } = await service
      .from("vorgaenge")
      .insert({
        mandant_id: mA,
        vorgangsnummer: `M31A-V-${ts}`,
        vorgangstyp: "anfrage",
        gebaeude_id: gA.id,
        titel: "Test-Vorgang M3.1a",
      })
      .select("id")
      .single();
    if (vAErr) throw vAErr;
    ids.vorgaenge.push(vA.id);

    const { data: vB, error: vBErr } = await service
      .from("vorgaenge")
      .insert({
        mandant_id: mB,
        vorgangsnummer: `M31A-VB-${ts}`,
        vorgangstyp: "anfrage",
        gebaeude_id: gB.id,
        titel: "Test-Vorgang B",
      })
      .select("id")
      .single();
    if (vBErr) throw vBErr;
    ids.vorgaenge.push(vB.id);

    const beendet = new Date().toISOString();

    // --- T3: CHECK wirksam (Status ohne FK) — indirekt für anfrageeingaenge_zugeordneter_vorgang_status_check ---
    const { error: t3Err } = await service.from("anfrageeingaenge").insert({
      mandant_id: mA,
      eingangsnummer: `M31A-T3-${ts}`,
      kanal: "email",
      status: "in_vorgang_ueberfuehrt",
      beendet_am: beendet,
    });
    record("T3", isExpectedDbError(t3Err), t3Err?.message ?? "unexpected ok");

    // --- T4: FK wirksam (gültiger Vorgang) — indirekt für anfrageeingaenge_mandant_zugeordneter_vorgang_fkey ---
    const { data: t4row, error: t4Err } = await service
      .from("anfrageeingaenge")
      .insert({
        mandant_id: mA,
        eingangsnummer: `M31A-T4-${ts}`,
        kanal: "email",
        status: "in_vorgang_ueberfuehrt",
        zugeordneter_vorgang_id: vA.id,
        beendet_am: beendet,
      })
      .select("id, zugeordneter_vorgang_id")
      .single();
    if (t4row?.id) ids.anfrageeingaenge.push(t4row.id);
    record(
      "T4",
      !t4Err && t4row?.zugeordneter_vorgang_id === vA.id,
      t4Err?.message ?? "ok",
    );

    // --- T5: Index-Zugriff (Filter auf zugeordneter_vorgang_id) — indirekt für idx_anfrageeingaenge_zugeordneter_vorgang ---
    const { data: t5rows, error: t5Err } = await service
      .from("anfrageeingaenge")
      .select("id")
      .eq("mandant_id", mA)
      .eq("zugeordneter_vorgang_id", vA.id);
    record(
      "T5",
      !t5Err && (t5rows?.length ?? 0) >= 1,
      t5Err?.message ?? `treffer=${t5rows?.length ?? 0}`,
    );

    // --- T6: Eingang Vorgang zuordnen ---
    const { data: t6row, error: t6Err } = await service
      .from("anfrageeingaenge")
      .insert({
        mandant_id: mA,
        eingangsnummer: `M31A-T6-${ts}`,
        kanal: "telefon",
        status: "in_vorgang_ueberfuehrt",
        zugeordneter_vorgang_id: vA.id,
        beendet_am: beendet,
      })
      .select("id")
      .single();
    if (t6row?.id) ids.anfrageeingaenge.push(t6row.id);
    record("T6", !t6Err && !!t6row?.id, t6Err?.message ?? "ok");

    // --- T7: mehrere Eingänge, gleicher Vorgang ---
    const { data: t7row, error: t7Err } = await service
      .from("anfrageeingaenge")
      .insert({
        mandant_id: mA,
        eingangsnummer: `M31A-T7-${ts}`,
        kanal: "email",
        status: "in_vorgang_ueberfuehrt",
        zugeordneter_vorgang_id: vA.id,
        beendet_am: beendet,
      })
      .select("id")
      .single();
    if (t7row?.id) ids.anfrageeingaenge.push(t7row.id);
    const { count: t7count } = await service
      .from("anfrageeingaenge")
      .select("*", { count: "exact", head: true })
      .eq("mandant_id", mA)
      .eq("zugeordneter_vorgang_id", vA.id);
    record(
      "T7",
      !t7Err && (t7count ?? 0) >= 3,
      t7Err?.message ?? `count=${t7count ?? 0}`,
    );

    // --- T8: Status ohne FK ---
    const { error: t8Err } = await service.from("anfrageeingaenge").insert({
      mandant_id: mA,
      eingangsnummer: `M31A-T8-${ts}`,
      kanal: "email",
      status: "in_vorgang_ueberfuehrt",
      beendet_am: beendet,
    });
    record("T8", isExpectedDbError(t8Err), t8Err?.message ?? "unexpected ok");

    // --- T9: FK ohne Status ---
    const { error: t9Err } = await service.from("anfrageeingaenge").insert({
      mandant_id: mA,
      eingangsnummer: `M31A-T9-${ts}`,
      kanal: "email",
      status: "analysiert",
      zugeordneter_vorgang_id: vA.id,
    });
    record("T9", isExpectedDbError(t9Err), t9Err?.message ?? "unexpected ok");

    // --- T10: Cross-Tenant FK ---
    const { error: t10Err } = await service.from("anfrageeingaenge").insert({
      mandant_id: mA,
      eingangsnummer: `M31A-T10-${ts}`,
      kanal: "email",
      status: "in_vorgang_ueberfuehrt",
      zugeordneter_vorgang_id: vB.id,
      beendet_am: beendet,
    });
    record("T10", isExpectedDbError(t10Err), t10Err?.message ?? "unexpected ok");

    record(
      "rename",
      results.T1?.ok && results.T2?.ok,
      "erzeugter_vorgang_id weg, zugeordneter_vorgang_id vorhanden",
    );
    record(
      "constraints",
      results.T3?.ok &&
        results.T4?.ok &&
        results.T8?.ok &&
        results.T9?.ok &&
        results.T10?.ok,
      "CHECK/FK indirekt T3,T4,T8–T10",
    );

    // --- T11: gültige Eingangssequenz ---
    const { data: t11row, error: t11Err } = await service
      .from("eingangsnummer_sequenzen")
      .insert({ mandant_id: mA, jahr: testJahr, letzter_wert: 1 })
      .select("mandant_id, jahr, letzter_wert")
      .single();
    if (t11row) ids.eingangsnummer_sequenzen.push({ mandant_id: mA, jahr: testJahr });
    record("T11", !t11Err && t11row?.letzter_wert === 1, t11Err?.message ?? "ok");

    // --- T12: doppelte PK Eingangssequenz ---
    const { error: t12Err } = await service
      .from("eingangsnummer_sequenzen")
      .insert({ mandant_id: mA, jahr: testJahr, letzter_wert: 2 });
    record("T12", isExpectedDbError(t12Err), t12Err?.message ?? "unexpected ok");

    // --- T13: gleiches Jahr, anderer Mandant ---
    const { data: t13row, error: t13Err } = await service
      .from("eingangsnummer_sequenzen")
      .insert({ mandant_id: mB, jahr: testJahr, letzter_wert: 1 })
      .select("mandant_id")
      .single();
    if (t13row) ids.eingangsnummer_sequenzen.push({ mandant_id: mB, jahr: testJahr });
    record("T13", !t13Err && !!t13row?.mandant_id, t13Err?.message ?? "ok");

    // --- T14: ungültiges Jahr ---
    const { error: t14lowErr } = await service
      .from("eingangsnummer_sequenzen")
      .insert({ mandant_id: mA, jahr: 1999, letzter_wert: 0 });
    const { error: t14highErr } = await service
      .from("eingangsnummer_sequenzen")
      .insert({ mandant_id: mA, jahr: 10000, letzter_wert: 0 });
    record(
      "T14",
      isExpectedDbError(t14lowErr) && isExpectedDbError(t14highErr),
      `${t14lowErr?.message ?? "ok"} / ${t14highErr?.message ?? "ok"}`,
    );

    // --- T15: negativer letzter_wert (Eingang) ---
    const { error: t15Err } = await service
      .from("eingangsnummer_sequenzen")
      .insert({ mandant_id: mA, jahr: testJahr + 1, letzter_wert: -1 });
    record("T15", isExpectedDbError(t15Err), t15Err?.message ?? "unexpected ok");

    // --- T16: Vorgangssequenz je Mandant/Jahr ---
    const { data: t16a, error: t16aErr } = await service
      .from("vorgangsnummer_sequenzen")
      .insert({ mandant_id: mA, jahr: testJahr, letzter_wert: 5 })
      .select("mandant_id, jahr")
      .single();
    const { data: t16b, error: t16bErr } = await service
      .from("vorgangsnummer_sequenzen")
      .insert({ mandant_id: mB, jahr: testJahr, letzter_wert: 3 })
      .select("mandant_id, jahr")
      .single();
    if (t16a) ids.vorgangsnummer_sequenzen.push({ mandant_id: mA, jahr: testJahr });
    if (t16b) ids.vorgangsnummer_sequenzen.push({ mandant_id: mB, jahr: testJahr });
    record(
      "T16",
      !t16aErr && !t16bErr && t16a?.mandant_id === mA && t16b?.mandant_id === mB,
      t16aErr?.message ?? t16bErr?.message ?? "ok",
    );

    // --- T17: doppelte PK Vorgangssequenz ---
    const { error: t17Err } = await service
      .from("vorgangsnummer_sequenzen")
      .insert({ mandant_id: mA, jahr: testJahr, letzter_wert: 99 });
    record("T17", isExpectedDbError(t17Err), t17Err?.message ?? "unexpected ok");

    // --- T18: Kundennummer je Mandant ---
    const { data: t18a, error: t18aErr } = await service
      .from("kundennummer_sequenzen")
      .insert({ mandant_id: mA, letzter_wert: 10 })
      .select("mandant_id")
      .single();
    const { data: t18b, error: t18bErr } = await service
      .from("kundennummer_sequenzen")
      .insert({ mandant_id: mB, letzter_wert: 1 })
      .select("mandant_id")
      .single();
    if (t18a) ids.kundennummer_sequenzen.push(mA);
    if (t18b) ids.kundennummer_sequenzen.push(mB);
    record(
      "T18",
      !t18aErr && !t18bErr && !!t18a?.mandant_id && !!t18b?.mandant_id,
      t18aErr?.message ?? t18bErr?.message ?? "ok",
    );

    // --- T19: negativer letzter_wert (Kunde) ---
    const { error: t19Err } = await service
      .from("kundennummer_sequenzen")
      .update({ letzter_wert: -5 })
      .eq("mandant_id", mA);
    record("T19", isExpectedDbError(t19Err), t19Err?.message ?? "unexpected ok");

    record(
      "sequenzen",
      results.T11?.ok &&
        results.T12?.ok &&
        results.T13?.ok &&
        results.T14?.ok &&
        results.T15?.ok &&
        results.T16?.ok &&
        results.T17?.ok &&
        results.T18?.ok &&
        results.T19?.ok,
      "T11–T19",
    );

    // --- T20: RLS, Service CRUD, updated_at, Bestand ---
    const seqTables = [
      "eingangsnummer_sequenzen",
      "vorgangsnummer_sequenzen",
      "kundennummer_sequenzen",
    ];
    let rlsOk = true;
    const rlsDetails = [];

    for (const t of seqTables) {
      const { data: anonRead, error: anonReadErr } = await anon.from(t).select("mandant_id").limit(1);
      const anonBlocked = !anonReadErr && (anonRead?.length ?? 0) === 0;
      const { error: anonInsErr } = await anon.from(t).insert({});
      const anonInsBlocked = isExpectedDbError(anonInsErr);
      if (!anonBlocked || !anonInsBlocked) rlsOk = false;
      rlsDetails.push(`${t}:anon=${anonBlocked}/${anonInsBlocked}`);
    }

    const email = `m31a-test-${ts}@example.com`;
    const password = `TestPass!${ts}`;
    const { data: authUser, error: authCreateErr } = await service.auth.admin.createUser({
      email,
      password,
      email_confirm: true,
    });
    if (authUser?.user?.id) ids.authUserId = authUser.user.id;
    const { data: signIn, error: signInErr } = await anon.auth.signInWithPassword({
      email,
      password,
    });
    const authed = createClient(url, anonKey, {
      global: { headers: { Authorization: `Bearer ${signIn?.session?.access_token}` } },
      auth: { persistSession: false, autoRefreshToken: false },
    });

    for (const t of seqTables) {
      const { data: authRead, error: authReadErr } = await authed.from(t).select("mandant_id").limit(1);
      const authBlocked =
        !signInErr && !authCreateErr && !authReadErr && (authRead?.length ?? 0) === 0;
      const { error: authInsErr } = await authed.from(t).insert({});
      const authInsBlocked = isExpectedDbError(authInsErr);
      if (!authBlocked || !authInsBlocked) rlsOk = false;
      rlsDetails.push(`${t}:auth=${authBlocked}/${authInsBlocked}`);
    }

    // Service CRUD auf eingangsnummer_sequenzen
    const svcJahr = testJahr + 2;
    const { data: svcIns, error: svcInsErr } = await service
      .from("eingangsnummer_sequenzen")
      .insert({ mandant_id: mA, jahr: svcJahr, letzter_wert: 0 })
      .select("mandant_id, jahr, updated_at")
      .single();
    if (svcIns) ids.eingangsnummer_sequenzen.push({ mandant_id: mA, jahr: svcJahr });

    await new Promise((r) => setTimeout(r, 1100));

    const { data: svcUpd, error: svcUpdErr } = await service
      .from("eingangsnummer_sequenzen")
      .update({ letzter_wert: 1 })
      .eq("mandant_id", mA)
      .eq("jahr", svcJahr)
      .select("updated_at")
      .single();

    const { error: svcDelErr } = await service
      .from("eingangsnummer_sequenzen")
      .delete()
      .eq("mandant_id", mA)
      .eq("jahr", svcJahr);
    if (svcIns) {
      const idx = ids.eingangsnummer_sequenzen.findIndex(
        (r) => r.mandant_id === mA && r.jahr === svcJahr,
      );
      if (idx >= 0) ids.eingangsnummer_sequenzen.splice(idx, 1);
    }

    const updatedAtOk =
      !svcInsErr &&
      !svcUpdErr &&
      !svcDelErr &&
      !!svcIns?.updated_at &&
      !!svcUpd?.updated_at &&
      svcUpd.updated_at > svcIns.updated_at;

    record("updatedAt", updatedAtOk, updatedAtOk ? "updated_at erhöht nach UPDATE" : "Trigger-Check fehlgeschlagen");

    const serviceCrudOk = !svcInsErr && !svcUpdErr && !svcDelErr;
    record("rls", rlsOk && serviceCrudOk, `${rlsDetails.join("; ")}; svcCrud=${serviceCrudOk}`);

    record(
      "T20",
      rlsOk && serviceCrudOk && updatedAtOk,
      `rls=${rlsOk}, svcCrud=${serviceCrudOk}, updatedAt=${updatedAtOk}`,
    );
  } finally {
    await cleanup(ids);

    if (beforeSnap) {
      const afterSnap = await snapshotCounts();
      const details = Object.entries(beforeSnap)
        .map(([t, c]) => `${t}: ${c}→${afterSnap[t]}`)
        .join(", ");
      const bestandOk = Object.entries(beforeSnap).every(([t, c]) => afterSnap[t] === c);
      record("bestandsschutz", bestandOk, details);
      const adminOk =
        afterSnap.organizations === beforeSnap.organizations &&
        afterSnap.angebote === beforeSnap.angebote;
      record(
        "adminSmoke",
        adminOk,
        `organizations ${beforeSnap.organizations}→${afterSnap.organizations}, angebote ${beforeSnap.angebote}→${afterSnap.angebote}`,
      );
      if (results.T20?.ok && (!bestandOk || !adminOk)) {
        results.T20 = {
          ok: false,
          detail: `${results.T20.detail}; bestand/admin nach Cleanup fehlgeschlagen`,
        };
        passed = false;
      } else if (results.T20?.ok && bestandOk && adminOk) {
        results.T20 = {
          ok: true,
          detail: `${results.T20.detail}; bestand/admin nach Cleanup ok`,
        };
      }
    }

    const { count: cOrg } = await service
      .from("organizations")
      .select("*", { count: "exact", head: true })
      .like("name", "__test_m31a_%");
    const { count: cAe } = await service
      .from("anfrageeingaenge")
      .select("*", { count: "exact", head: true })
      .like("eingangsnummer", "M31A-%");
    const cleanupOk = (cOrg ?? 0) === 0 && (cAe ?? 0) === 0;
    record("cleanup", cleanupOk, `orgs=${cOrg ?? 0}, anfrageeingaenge=${cAe ?? 0}`);
  }

  const problems = [];
  for (const [k, v] of Object.entries(results)) {
    if (v && !v.ok) problems.push(`${k}: ${v.detail}`);
  }
  for (const [k, v] of Object.entries(extra)) {
    if (v && !v.ok) problems.push(`${k}: ${v.detail}`);
  }

  console.log(
    JSON.stringify({ passed, schemaNote, results, extra, problems }, null, 2),
  );
  process.exit(passed ? 0 : 1);
}

main().catch((err) => {
  console.log(
    JSON.stringify(
      { passed: false, fatal: err.message, schemaNote, results, extra, problems: [err.message] },
      null,
      2,
    ),
  );
  process.exit(1);
});

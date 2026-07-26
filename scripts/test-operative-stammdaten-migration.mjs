/**
 * Integrationstest Migration 20260717280000_operative_stammdaten_v1.sql
 * Nur Supabase-JS (Service/Anon/Authenticated). Keine Secrets in der Ausgabe.
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

const results = [];
let passed = true;

function record(name, ok, detail = "") {
  results.push({ name, ok, detail });
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
    /violates|duplicate|check constraint|foreign key|row-level security|permission denied/i.test(
      msg,
    )
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
  for (const orgId of ids.orgs) {
    await service.from("organizations").delete().eq("id", orgId);
  }
  if (ids.authUserId) {
    await service.auth.admin.deleteUser(ids.authUserId);
  }
}

async function main() {
  const ids = { orgs: [], kunden: [], adressen: [], gebaeude: [], einheiten: [], authUserId: null };
  let beforeSnap = null;

  try {
    beforeSnap = await snapshotCounts();

    for (const t of ["kunden", "adressen", "gebaeude", "einheiten"]) {
      const { error } = await service.from(t).select("id").limit(1);
      record(`Tabelle ${t} vorhanden`, !error, error?.message ?? "ok");
    }

    const ts = Date.now();
    const { data: orgA, error: orgAErr } = await service
      .from("organizations")
      .insert({ name: `__test_m1_a_${ts}`, status: "interessent" })
      .select("id")
      .single();
    if (orgAErr) throw orgAErr;
    ids.orgs.push(orgA.id);

    const { data: orgB, error: orgBErr } = await service
      .from("organizations")
      .insert({ name: `__test_m1_b_${ts}`, status: "interessent" })
      .select("id")
      .single();
    if (orgBErr) throw orgBErr;
    ids.orgs.push(orgB.id);

    const mA = orgA.id;
    const mB = orgB.id;

    // --- Kunden ---
    const { data: kPriv, error: kPrivErr } = await service
      .from("kunden")
      .insert({
        mandant_id: mA,
        kundennummer: "T-PRIV-1",
        kundentyp: "privatperson",
        vorname: "Max",
        nachname: "Müller",
        anzeigename: "Max Müller",
      })
      .select("id")
      .single();
    record("Kunde: gültige Privatperson", !kPrivErr && !!kPriv?.id, kPrivErr?.message ?? "ok");
    if (kPriv?.id) ids.kunden.push(kPriv.id);

    const { error: kBadPrivErr } = await service.from("kunden").insert({
      mandant_id: mA,
      kundennummer: "T-PRIV-BAD",
      kundentyp: "privatperson",
      vorname: "Max",
      anzeigename: "Max",
    });
    record(
      "Kunde: ungültige Privatperson ohne Nachname",
      isExpectedDbError(kBadPrivErr),
      kBadPrivErr?.message ?? "INSERT ok (unexpected)",
    );

    const { data: kFirma, error: kFirmaErr } = await service
      .from("kunden")
      .insert({
        mandant_id: mA,
        kundennummer: "T-FIRMA-1",
        kundentyp: "unternehmen",
        firmenname: "Test GmbH",
        anzeigename: "Test GmbH",
      })
      .select("id")
      .single();
    record("Kunde: gültiges Unternehmen", !kFirmaErr && !!kFirma?.id, kFirmaErr?.message ?? "ok");
    if (kFirma?.id) ids.kunden.push(kFirma.id);

    const { error: kBadFirmaErr } = await service.from("kunden").insert({
      mandant_id: mA,
      kundennummer: "T-FIRMA-BAD",
      kundentyp: "unternehmen",
      anzeigename: "Ohne Firma",
    });
    record(
      "Kunde: ungültiges Unternehmen ohne Firmenname",
      isExpectedDbError(kBadFirmaErr),
      kBadFirmaErr?.message ?? "INSERT ok (unexpected)",
    );

    const { error: kDupErr } = await service.from("kunden").insert({
      mandant_id: mA,
      kundennummer: "T-PRIV-1",
      kundentyp: "privatperson",
      vorname: "Anna",
      nachname: "Meier",
      anzeigename: "Anna Meier",
    });
    record(
      "Kunde: gleiche Kundennummer selber Mandant",
      isExpectedDbError(kDupErr),
      kDupErr?.message ?? "INSERT ok (unexpected)",
    );

    const { data: kB, error: kBErr } = await service
      .from("kunden")
      .insert({
        mandant_id: mB,
        kundennummer: "T-PRIV-1",
        kundentyp: "privatperson",
        vorname: "Bea",
        nachname: "Test",
        anzeigename: "Bea Test",
      })
      .select("id")
      .single();
    record(
      "Kunde: gleiche Kundennummer anderer Mandant",
      !kBErr && !!kB?.id,
      kBErr?.message ?? "ok",
    );
    if (kB?.id) ids.kunden.push(kB.id);

    // --- Adressen ---
    const { data: adr1, error: adr1Err } = await service
      .from("adressen")
      .insert({
        mandant_id: mA,
        strasse: "Hauptstr.",
        hausnummer: " 12 a ",
        plz: "12345",
        ort: "Berlin",
        land: "Deutschland",
      })
      .select("id, hausnummer_normalisiert, strasse_normalisiert, adress_fingerprint")
      .single();
    record(
      "Adresse: Normalisierung beim INSERT",
      !adr1Err &&
        adr1?.hausnummer_normalisiert === "12a" &&
        adr1?.strasse_normalisiert === "hauptstr.",
      adr1Err?.message ?? `hn=${adr1?.hausnummer_normalisiert}, str=${adr1?.strasse_normalisiert}`,
    );
    if (adr1?.id) ids.adressen.push(adr1.id);

    const { data: adr2, error: adr2Err } = await service
      .from("adressen")
      .insert({
        mandant_id: mA,
        strasse: "Hauptstr.",
        hausnummer: "  12   a  ",
        plz: "12345",
        ort: "Berlin",
      })
      .select("id, adress_fingerprint")
      .single();
    record(
      "Adresse: Fingerprint deterministisch",
      !adr2Err && adr1?.adress_fingerprint === adr2?.adress_fingerprint,
      adr2Err?.message ?? `fp1=${adr1?.adress_fingerprint}, fp2=${adr2?.adress_fingerprint}`,
    );
    record(
      "Adresse: Duplikat erlaubt (kein Merge)",
      !adr2Err && adr1?.id !== adr2?.id,
      "zwei Zeilen",
    );
    if (adr2?.id) ids.adressen.push(adr2.id);

    const { data: adrSp, error: adrSpErr } = await service
      .from("adressen")
      .insert({
        mandant_id: mA,
        strasse: "Neben   Weg",
        hausnummer: "1",
        plz: "99999",
        ort: "Hamburg",
      })
      .select("id, strasse_normalisiert")
      .single();
    record(
      "Adresse: Leerzeichen reduziert",
      !adrSpErr && adrSp?.strasse_normalisiert === "neben weg",
      adrSpErr?.message ?? adrSp?.strasse_normalisiert,
    );
    if (adrSp?.id) ids.adressen.push(adrSp.id);

    // --- Gebäude ---
    const adrId = adr1?.id;
    const { data: g1, error: g1Err } = await service
      .from("gebaeude")
      .insert({ mandant_id: mA, adresse_id: adrId, gebaeudeart: "mehrfamilienhaus" })
      .select("id")
      .single();
    if (g1?.id) ids.gebaeude.push(g1.id);

    const { data: g2, error: g2Err } = await service
      .from("gebaeude")
      .insert({
        mandant_id: mA,
        adresse_id: adrId,
        gebaeudeart: "nebengebaeude",
        gebaeudebezeichnung: "Garage",
      })
      .select("id")
      .single();
    record(
      "Gebäude: mehrere an gleicher Adresse",
      !g1Err && !g2Err && !!g1?.id && !!g2?.id,
      g1Err?.message ?? g2Err?.message ?? "ok",
    );
    if (g2?.id) ids.gebaeude.push(g2.id);

    const { data: gValid, error: gValidErr } = await service
      .from("gebaeude")
      .insert({ mandant_id: mA, adresse_id: adrId, gebaeudeart: "einfamilienhaus" })
      .select("id")
      .single();
    record("Gebäude: gültige gebaeudeart", !gValidErr && !!gValid?.id, gValidErr?.message ?? "ok");
    if (gValid?.id) ids.gebaeude.push(gValid.id);

    const { error: gBadErr } = await service.from("gebaeude").insert({
      mandant_id: mA,
      adresse_id: adrId,
      gebaeudeart: "invalid_art",
    });
    record(
      "Gebäude: ungültige gebaeudeart",
      isExpectedDbError(gBadErr),
      gBadErr?.message ?? "INSERT ok (unexpected)",
    );

    const { data: adrB, error: adrBErr } = await service
      .from("adressen")
      .insert({
        mandant_id: mB,
        strasse: "Fremd",
        hausnummer: "1",
        plz: "11111",
        ort: "Ort",
      })
      .select("id")
      .single();
    if (adrB?.id) ids.adressen.push(adrB.id);

    const { error: gFkErr } = await service.from("gebaeude").insert({
      mandant_id: mA,
      adresse_id: adrB?.id,
      gebaeudeart: "sonstiges",
    });
    record(
      "Gebäude: Composite-FK fremder Mandant",
      isExpectedDbError(gFkErr),
      gFkErr?.message ?? "INSERT ok (unexpected)",
    );

    const gebaeudeId = g1?.id;

    // --- Einheiten ---
    const { data: e1, error: e1Err } = await service
      .from("einheiten")
      .insert({
        mandant_id: mA,
        gebaeude_id: gebaeudeId,
        bezeichnung: "EG links",
        einheit_typ: "wohnung",
      })
      .select("id, bezeichnung_normalisiert")
      .single();
    record(
      "Einheit: Bezeichnung normalisiert",
      !e1Err && e1?.bezeichnung_normalisiert === "eg links",
      e1Err?.message ?? e1?.bezeichnung_normalisiert,
    );
    if (e1?.id) ids.einheiten.push(e1.id);

    const { error: eDupErr } = await service.from("einheiten").insert({
      mandant_id: mA,
      gebaeude_id: gebaeudeId,
      bezeichnung: "eg links",
      einheit_typ: "wohnung",
    });
    record(
      "Einheit: zweite aktive gleiche Bezeichnung abgelehnt",
      isExpectedDbError(eDupErr),
      eDupErr?.message ?? "INSERT ok (unexpected)",
    );

    const { data: eArch, error: eArchErr } = await service
      .from("einheiten")
      .insert({
        mandant_id: mA,
        gebaeude_id: gebaeudeId,
        bezeichnung: "EG links",
        einheit_typ: "wohnung",
        aktiv: false,
        archiviert_am: new Date().toISOString(),
      })
      .select("id")
      .single();
    record(
      "Einheit: archivierte + aktive gleicher Name",
      !eArchErr && !!eArch?.id,
      eArchErr?.message ?? "ok",
    );
    if (eArch?.id) ids.einheiten.push(eArch.id);

    const { error: eReactErr } = await service
      .from("einheiten")
      .update({ aktiv: true, archiviert_am: null })
      .eq("id", eArch?.id);
    record(
      "Einheit: Reaktivierung kollidiert",
      isExpectedDbError(eReactErr),
      eReactErr?.message ?? "UPDATE ok (unexpected)",
    );

    const { error: eTypErr } = await service.from("einheiten").insert({
      mandant_id: mA,
      gebaeude_id: gebaeudeId,
      bezeichnung: "Dach",
      einheit_typ: "invalid_typ",
    });
    record(
      "Einheit: ungültiger einheit_typ",
      isExpectedDbError(eTypErr),
      eTypErr?.message ?? "INSERT ok (unexpected)",
    );

    // --- Archivierung ---
    const { error: archBadErr } = await service
      .from("kunden")
      .update({ aktiv: false })
      .eq("id", kPriv?.id);
    record(
      "Archivierung: aktiv=false ohne archiviert_am",
      isExpectedDbError(archBadErr),
      archBadErr?.message ?? "UPDATE ok (unexpected)",
    );

    const { error: archOkErr } = await service
      .from("kunden")
      .update({ aktiv: false, archiviert_am: new Date().toISOString() })
      .eq("id", kPriv?.id);
    record("Archivierung: atomar archivieren", !archOkErr, archOkErr?.message ?? "ok");

    const { error: reactOkErr } = await service
      .from("kunden")
      .update({ aktiv: true, archiviert_am: null })
      .eq("id", kPriv?.id);
    record("Archivierung: Reaktivierung", !reactOkErr, reactOkErr?.message ?? "ok");

    // --- RLS ---
    const { data: anonRead, error: anonReadErr } = await anon.from("kunden").select("id").limit(1);
    record(
      "RLS: anon SELECT blockiert",
      !anonReadErr && (anonRead?.length ?? 0) === 0,
      anonReadErr?.message ?? `rows=${anonRead?.length ?? 0}`,
    );

    const { error: anonInsErr } = await anon.from("kunden").insert({
      mandant_id: mA,
      kundennummer: "RLS-ANON",
      kundentyp: "sonstiges",
      anzeigename: "Anon Test",
    });
    record(
      "RLS: anon INSERT blockiert",
      isExpectedDbError(anonInsErr),
      anonInsErr?.message ?? "INSERT ok (unexpected)",
    );

    const email = `m1-test-${ts}@example.com`;
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
      global: {
        headers: { Authorization: `Bearer ${signIn?.session?.access_token}` },
      },
      auth: { persistSession: false, autoRefreshToken: false },
    });

    const { data: authRead, error: authReadErr } = await authed.from("kunden").select("id").limit(1);
    record(
      "RLS: authenticated SELECT blockiert",
      !signInErr && !authCreateErr && !authReadErr && (authRead?.length ?? 0) === 0,
      signInErr?.message ?? authReadErr?.message ?? `rows=${authRead?.length ?? 0}`,
    );

    const { error: authInsErr } = await authed.from("kunden").insert({
      mandant_id: mA,
      kundennummer: "RLS-AUTH",
      kundentyp: "sonstiges",
      anzeigename: "Auth Test",
    });
    record(
      "RLS: authenticated INSERT blockiert",
      isExpectedDbError(authInsErr),
      authInsErr?.message ?? "INSERT ok (unexpected)",
    );

    const { data: svcRead, error: svcReadErr } = await service.from("kunden").select("id").limit(1);
    record(
      "RLS: Service Role SELECT",
      !svcReadErr && Array.isArray(svcRead),
      svcReadErr?.message ?? `rows=${svcRead?.length ?? 0}`,
    );

    const { data: svcIns, error: svcInsErr } = await service
      .from("kunden")
      .insert({
        mandant_id: mA,
        kundennummer: `RLS-SVC-${ts}`,
        kundentyp: "sonstiges",
        anzeigename: "Service Test",
      })
      .select("id")
      .single();
    record(
      "RLS: Service Role INSERT",
      !svcInsErr && !!svcIns?.id,
      svcInsErr?.message ?? "ok",
    );
    if (svcIns?.id) ids.kunden.push(svcIns.id);
  } finally {
    await cleanup(ids);

    if (beforeSnap) {
      const afterSnap = await snapshotCounts();
      for (const [t, count] of Object.entries(beforeSnap)) {
        record(
          `Bestandsschutz: ${t} unverändert`,
          afterSnap[t] === count,
          `vorher=${count}, nachher=${afterSnap[t]}`,
        );
      }
    }

    const { count: testKunden } = await service
      .from("kunden")
      .select("*", { count: "exact", head: true })
      .or("kundennummer.like.T-%,kundennummer.like.RLS-%");
    const { count: testOrgs } = await service
      .from("organizations")
      .select("*", { count: "exact", head: true })
      .like("name", "__test_m1_%");
    record(
      "Cleanup: keine Testreste (kunden/orgs)",
      (testKunden ?? 0) === 0 && (testOrgs ?? 0) === 0,
      `kunden=${testKunden ?? 0}, orgs=${testOrgs ?? 0}`,
    );
  }

  console.log(JSON.stringify({ passed, results }, null, 2));
  process.exit(passed ? 0 : 1);
}

main().catch((err) => {
  console.log(JSON.stringify({ passed: false, results, fatal: err.message }, null, 2));
  process.exit(1);
});

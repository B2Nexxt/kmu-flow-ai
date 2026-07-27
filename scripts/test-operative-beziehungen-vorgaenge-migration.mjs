/**
 * Integrationstest Migration 20260717290000_operative_beziehungen_vorgaenge_v1.sql
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

const results = {
  T1: null,
  T2: null,
  T3: null,
  T4: null,
  T5: null,
  T6: null,
  T7: null,
  T8: null,
  T9: null,
  T10: null,
  T11: null,
  T12: null,
  T13: null,
  T14: null,
  T15: null,
  T16: null,
  T17: null,
  T18: null,
  T19: null,
  T20: null,
  T21: null,
  T22: null,
  T23: null,
  T24: null,
  T25: null,
  T26: null,
};
const extra = {
  kundenstatus: null,
  parentKeys: null,
  rls: null,
  policies: null,
  bestandsschutz: null,
  adminSmoke: null,
  cleanup: null,
};
const tablesChecked = [];
let passed = true;

function record(key, ok, detail = "") {
  if (key.startsWith("T") && key in results) {
    results[key] = { ok, detail };
  } else if (key in extra) {
    extra[key] = { ok, detail };
  } else {
    extra[key] = { ok, detail };
  }
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
    "kunden",
    "adressen",
    "gebaeude",
    "einheiten",
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
  for (const orgId of ids.orgs) {
    await service.from("organizations").delete().eq("id", orgId);
  }
  if (ids.authUserId) {
    await service.auth.admin.deleteUser(ids.authUserId);
  }
}

async function insertKunde(mandantId, nummer, fields = {}) {
  return service
    .from("kunden")
    .insert({
      mandant_id: mandantId,
      kundennummer: nummer,
      kundentyp: "privatperson",
      vorname: "Test",
      nachname: "Person",
      anzeigename: `Test ${nummer}`,
      ...fields,
    })
    .select("id, kundenstatus")
    .single();
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

async function insertGebaeude(mandantId, adresseId) {
  return service
    .from("gebaeude")
    .insert({
      mandant_id: mandantId,
      adresse_id: adresseId,
      gebaeudeart: "mehrfamilienhaus",
    })
    .select("id")
    .single();
}

async function insertEinheit(mandantId, gebaeudeId, bezeichnung) {
  return service
    .from("einheiten")
    .insert({
      mandant_id: mandantId,
      gebaeude_id: gebaeudeId,
      bezeichnung,
      einheit_typ: "wohnung",
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
    authUserId: null,
  };
  let beforeSnap = null;
  let authed = null;
  const ts = Date.now();

  try {
    beforeSnap = await snapshotCounts();

    for (const t of [
      "kunden_objekt_beziehungen",
      "vorgaenge",
      "vorgang_beteiligte",
    ]) {
      const { error } = await service.from(t).select("id").limit(1);
      tablesChecked.push(t);
      if (error) throw new Error(`Tabelle ${t} fehlt — Migration M2 anwenden: ${error.message}`);
    }

    // kundenstatus + Default
    const { data: kStatusRow, error: kStatusErr } = await service
      .from("kunden")
      .insert({
        mandant_id: (
          await service
            .from("organizations")
            .insert({ name: `__test_m2_status_${ts}`, status: "interessent" })
            .select("id")
            .single()
        ).data.id,
        kundennummer: `M2-STATUS-${ts}`,
        kundentyp: "sonstiges",
        anzeigename: "Status Check",
      })
      .select("id, kundenstatus")
      .single();
    if (kStatusRow?.id) {
      ids.kunden.push(kStatusRow.id);
      const orgForStatus = (
        await service.from("kunden").select("mandant_id").eq("id", kStatusRow.id).single()
      ).data?.mandant_id;
      if (orgForStatus) ids.orgs.push(orgForStatus);
    }
    record(
      "kundenstatus",
      !kStatusErr && kStatusRow?.kundenstatus === "bestaetigt",
      kStatusErr?.message ?? `kundenstatus=${kStatusRow?.kundenstatus}`,
    );

    // Parent-Key smoke via composite FK success path (T10/T7/T8 cover failures)
    record(
      "parentKeys",
      !kStatusErr,
      "Composite-FKs in T7–T11/T17 implizit geprüft; Indizes via erfolgreiche Parent-FKs",
    );

    const { data: orgA, error: orgAErr } = await service
      .from("organizations")
      .insert({ name: `__test_m2_a_${ts}`, status: "interessent" })
      .select("id")
      .single();
    if (orgAErr) throw orgAErr;
    ids.orgs.push(orgA.id);

    const { data: orgB, error: orgBErr } = await service
      .from("organizations")
      .insert({ name: `__test_m2_b_${ts}`, status: "interessent" })
      .select("id")
      .single();
    if (orgBErr) throw orgBErr;
    ids.orgs.push(orgB.id);

    const mA = orgA.id;
    const mB = orgB.id;

    const { data: kMieter1, error: kM1Err } = await insertKunde(mA, `M2-M1-${ts}`, {
      vorname: "Anna",
      nachname: "Mieter1",
      anzeigename: "Anna Mieter1",
    });
    const { data: kMieter2, error: kM2Err } = await insertKunde(mA, `M2-M2-${ts}`, {
      vorname: "Ben",
      nachname: "Mieter2",
      anzeigename: "Ben Mieter2",
    });
    const { data: kEigentuemer, error: kEErr } = await insertKunde(mA, `M2-EIG-${ts}`, {
      vorname: "Clara",
      nachname: "Eigentuemer",
      anzeigename: "Clara Eigentuemer",
    });
    const { data: kSame, error: kSameErr } = await insertKunde(mA, `M2-SAME-${ts}`, {
      vorname: "Dana",
      nachname: "Same",
      anzeigename: "Dana Same",
    });
    for (const k of [kMieter1, kMieter2, kEigentuemer, kSame]) {
      if (k?.id) ids.kunden.push(k.id);
    }
    if (kM1Err || kM2Err || kEErr || kSameErr) throw kM1Err || kM2Err || kEErr || kSameErr;

    const { data: adrA, error: adrAErr } = await insertAdresse(mA, ts);
    if (adrAErr) throw adrAErr;
    ids.adressen.push(adrA.id);

    const { data: adrB, error: adrBErr } = await insertAdresse(mB, ts + 1);
    if (adrBErr) throw adrBErr;
    ids.adressen.push(adrB.id);

    const { data: gA, error: gAErr } = await insertGebaeude(mA, adrA.id);
    const { data: gB, error: gBErr } = await insertGebaeude(mB, adrB.id);
    if (gAErr || gBErr) throw gAErr || gBErr;
    ids.gebaeude.push(gA.id, gB.id);

    const { data: gA2, error: gA2Err } = await insertGebaeude(mA, adrA.id);
    if (gA2Err) throw gA2Err;
    ids.gebaeude.push(gA2.id);

    const { data: eA, error: eAErr } = await insertEinheit(mA, gA.id, `Whg-${ts}`);
    if (eAErr) throw eAErr;
    ids.einheiten.push(eA.id);

    const { data: eB, error: eBErr } = await insertEinheit(mB, gB.id, `Whg-B-${ts}`);
    if (eBErr) throw eBErr;
    ids.einheiten.push(eB.id);

    const today = new Date().toISOString().slice(0, 10);

    // T1: Mehrere aktive Mieter gleiche Einheit
    const { data: bz1, error: bz1Err } = await service
      .from("kunden_objekt_beziehungen")
      .insert({
        mandant_id: mA,
        kunde_id: kMieter1.id,
        gebaeude_id: gA.id,
        einheit_id: eA.id,
        rolle: "mieter",
        gueltig_ab: today,
      })
      .select("id")
      .single();
    const { data: bz1b, error: bz1bErr } = await service
      .from("kunden_objekt_beziehungen")
      .insert({
        mandant_id: mA,
        kunde_id: kMieter2.id,
        gebaeude_id: gA.id,
        einheit_id: eA.id,
        rolle: "mieter",
        gueltig_ab: today,
      })
      .select("id")
      .single();
    if (bz1?.id) ids.beziehungen.push(bz1.id);
    if (bz1b?.id) ids.beziehungen.push(bz1b.id);
    record("T1", !bz1Err && !bz1bErr, bz1Err?.message ?? bz1bErr?.message ?? "ok");

    // T2: Doppelte aktive Beziehung
    const { error: t2Err } = await service.from("kunden_objekt_beziehungen").insert({
      mandant_id: mA,
      kunde_id: kMieter1.id,
      gebaeude_id: gA.id,
      einheit_id: eA.id,
      rolle: "mieter",
      gueltig_ab: today,
    });
    record("T2", isExpectedDbError(t2Err), t2Err?.message ?? "INSERT ok (unexpected)");

    // T3: Doppelte aktive Gebäude-Beziehung einheit_id NULL
    const { data: bzGb1, error: bzGb1Err } = await service
      .from("kunden_objekt_beziehungen")
      .insert({
        mandant_id: mA,
        kunde_id: kEigentuemer.id,
        gebaeude_id: gA.id,
        einheit_id: null,
        rolle: "eigentuemer",
        gueltig_ab: today,
      })
      .select("id")
      .single();
    if (bzGb1?.id) ids.beziehungen.push(bzGb1.id);
    const { error: t3Err } = await service.from("kunden_objekt_beziehungen").insert({
      mandant_id: mA,
      kunde_id: kEigentuemer.id,
      gebaeude_id: gA.id,
      einheit_id: null,
      rolle: "eigentuemer",
      gueltig_ab: today,
    });
    record(
      "T3",
      !bzGb1Err && isExpectedDbError(t3Err),
      bzGb1Err?.message ?? t3Err?.message ?? "unexpected",
    );

    // T4: Inaktive alte + neue aktive
    const { data: bzOld, error: bzOldErr } = await service
      .from("kunden_objekt_beziehungen")
      .insert({
        mandant_id: mA,
        kunde_id: kSame.id,
        gebaeude_id: gA.id,
        einheit_id: eA.id,
        rolle: "nutzer",
        gueltig_ab: "2020-01-01",
        gueltig_bis: "2024-12-31",
        aktiv: false,
      })
      .select("id")
      .single();
    const { data: bzNew, error: bzNewErr } = await service
      .from("kunden_objekt_beziehungen")
      .insert({
        mandant_id: mA,
        kunde_id: kSame.id,
        gebaeude_id: gA.id,
        einheit_id: eA.id,
        rolle: "nutzer",
        gueltig_ab: today,
      })
      .select("id")
      .single();
    if (bzOld?.id) ids.beziehungen.push(bzOld.id);
    if (bzNew?.id) ids.beziehungen.push(bzNew.id);
    record("T4", !bzOldErr && !bzNewErr, bzOldErr?.message ?? bzNewErr?.message ?? "ok");

    // T5: aktiv=false ohne gueltig_bis
    const { error: t5Err } = await service.from("kunden_objekt_beziehungen").insert({
      mandant_id: mA,
      kunde_id: kSame.id,
      gebaeude_id: gA2.id,
      rolle: "sonstiges",
      gueltig_ab: today,
      aktiv: false,
    });
    record("T5", isExpectedDbError(t5Err), t5Err?.message ?? "INSERT ok (unexpected)");

    // T6: gueltig_bis vor gueltig_ab
    const { error: t6Err } = await service.from("kunden_objekt_beziehungen").insert({
      mandant_id: mA,
      kunde_id: kSame.id,
      gebaeude_id: gA2.id,
      rolle: "sonstiges",
      gueltig_ab: "2025-06-01",
      gueltig_bis: "2025-01-01",
    });
    record("T6", isExpectedDbError(t6Err), t6Err?.message ?? "INSERT ok (unexpected)");

    // T7: Einheit aus fremdem Gebäude
    const { error: t7Err } = await service.from("kunden_objekt_beziehungen").insert({
      mandant_id: mA,
      kunde_id: kSame.id,
      gebaeude_id: gA.id,
      einheit_id: eB.id,
      rolle: "mieter",
      gueltig_ab: today,
    });
    record("T7", isExpectedDbError(t7Err), t7Err?.message ?? "INSERT ok (unexpected)");

    // T8: Einheit aus fremdem Mandanten (same mandant_id mismatch via gebaeude B + einheit B but mandant A)
    const { error: t8Err } = await service.from("kunden_objekt_beziehungen").insert({
      mandant_id: mA,
      kunde_id: kSame.id,
      gebaeude_id: gB.id,
      einheit_id: eB.id,
      rolle: "mieter",
      gueltig_ab: today,
    });
    record("T8", isExpectedDbError(t8Err), t8Err?.message ?? "INSERT ok (unexpected)");

    // T9: Vorgang am gesamten Gebäude
    const { data: vGeb, error: vGebErr } = await service
      .from("vorgaenge")
      .insert({
        mandant_id: mA,
        vorgangsnummer: `M2-VG-${ts}`,
        vorgangstyp: "anfrage",
        gebaeude_id: gA.id,
        einheit_id: null,
        titel: "Gebäude-Vorgang",
      })
      .select("id")
      .single();
    if (vGeb?.id) ids.vorgaenge.push(vGeb.id);
    record("T9", !vGebErr && !!vGeb?.id, vGebErr?.message ?? "ok");

    // T10: Vorgang mit passender Einheit
    const { data: vEin, error: vEinErr } = await service
      .from("vorgaenge")
      .insert({
        mandant_id: mA,
        vorgangsnummer: `M2-VE-${ts}`,
        vorgangstyp: "service",
        gebaeude_id: gA.id,
        einheit_id: eA.id,
        titel: "Einheits-Vorgang",
      })
      .select("id")
      .single();
    if (vEin?.id) ids.vorgaenge.push(vEin.id);
    record("T10", !vEinErr && !!vEin?.id, vEinErr?.message ?? "ok");

    // T11: Vorgang falsche Einheit/Gebäude
    const { error: t11Err } = await service.from("vorgaenge").insert({
      mandant_id: mA,
      vorgangsnummer: `M2-VBAD-${ts}`,
      vorgangstyp: "service",
      gebaeude_id: gA.id,
      einheit_id: eB.id,
      titel: "Falscher FK",
    });
    record("T11", isExpectedDbError(t11Err), t11Err?.message ?? "INSERT ok (unexpected)");

    // T12: gleiche vorgangsnummer gleicher Mandant
    const { error: t12Err } = await service.from("vorgaenge").insert({
      mandant_id: mA,
      vorgangsnummer: `M2-VG-${ts}`,
      vorgangstyp: "anfrage",
      gebaeude_id: gA.id,
      titel: "Duplikat Nummer",
    });
    record("T12", isExpectedDbError(t12Err), t12Err?.message ?? "INSERT ok (unexpected)");

    // T13: gleiche vorgangsnummer anderer Mandant
    const { data: vB, error: vBErr } = await service
      .from("vorgaenge")
      .insert({
        mandant_id: mB,
        vorgangsnummer: `M2-VG-${ts}`,
        vorgangstyp: "anfrage",
        gebaeude_id: gB.id,
        titel: "Anderer Mandant",
      })
      .select("id")
      .single();
    if (vB?.id) ids.vorgaenge.push(vB.id);
    record("T13", !vBErr && !!vB?.id, vBErr?.message ?? "ok");

    // T14: Endstatus ohne beendet_am
    const { error: t14Err } = await service.from("vorgaenge").insert({
      mandant_id: mA,
      vorgangsnummer: `M2-VEND-${ts}`,
      vorgangstyp: "anfrage",
      gebaeude_id: gA.id,
      titel: "Ende ohne Datum",
      status: "abgeschlossen",
    });
    record("T14", isExpectedDbError(t14Err), t14Err?.message ?? "INSERT ok (unexpected)");

    // T15: aktiver Status mit beendet_am
    const { error: t15Err } = await service.from("vorgaenge").insert({
      mandant_id: mA,
      vorgangsnummer: `M2-VACT-${ts}`,
      vorgangstyp: "anfrage",
      gebaeude_id: gA.id,
      titel: "Aktiv mit Ende",
      status: "neu",
      beendet_am: new Date().toISOString(),
    });
    record("T15", isExpectedDbError(t15Err), t15Err?.message ?? "INSERT ok (unexpected)");

    // T16: parent = id (Selbstreferenz) — UPDATE nach INSERT
    const { data: vSelf, error: vSelfErr } = await service
      .from("vorgaenge")
      .insert({
        mandant_id: mA,
        vorgangsnummer: `M2-VSELF-${ts}`,
        vorgangstyp: "anfrage",
        gebaeude_id: gA.id,
        titel: "Self test",
      })
      .select("id")
      .single();
    if (vSelf?.id) ids.vorgaenge.push(vSelf.id);
    const { error: t16Err } = await service
      .from("vorgaenge")
      .update({ parent_vorgang_id: vSelf?.id })
      .eq("id", vSelf?.id);
    record(
      "T16",
      !vSelfErr && isExpectedDbError(t16Err),
      vSelfErr?.message ?? t16Err?.message ?? "unexpected",
    );

    // T17: Reklamation mit gültigem Parent
    const { data: vParent, error: vParentErr } = await service
      .from("vorgaenge")
      .insert({
        mandant_id: mA,
        vorgangsnummer: `M2-VPAR-${ts}`,
        vorgangstyp: "anfrage",
        gebaeude_id: gA.id,
        titel: "Parent Vorgang",
      })
      .select("id")
      .single();
    const { data: vChild, error: vChildErr } = await service
      .from("vorgaenge")
      .insert({
        mandant_id: mA,
        vorgangsnummer: `M2-VCH-${ts}`,
        vorgangstyp: "reklamation",
        gebaeude_id: gA.id,
        parent_vorgang_id: vParent?.id,
        titel: "Reklamation",
      })
      .select("id")
      .single();
    if (vParent?.id) ids.vorgaenge.push(vParent.id);
    if (vChild?.id) ids.vorgaenge.push(vChild.id);
    record("T17", !vParentErr && !vChildErr, vParentErr?.message ?? vChildErr?.message ?? "ok");

    const vorgangId = vEin?.id;

    // T18: Mieter anfragender, Eigentümer auftraggeber/rechnungsempfaenger
    const { data: bt18a, error: bt18aErr } = await service
      .from("vorgang_beteiligte")
      .insert({
        mandant_id: mA,
        vorgang_id: vorgangId,
        kunde_id: kMieter1.id,
        rolle: "anfragender",
      })
      .select("id")
      .single();
    const { data: bt18b, error: bt18bErr } = await service
      .from("vorgang_beteiligte")
      .insert({
        mandant_id: mA,
        vorgang_id: vorgangId,
        kunde_id: kEigentuemer.id,
        rolle: "auftraggeber",
        ist_hauptbeteiligter: true,
      })
      .select("id")
      .single();
    const { data: bt18c, error: bt18cErr } = await service
      .from("vorgang_beteiligte")
      .insert({
        mandant_id: mA,
        vorgang_id: vorgangId,
        kunde_id: kEigentuemer.id,
        rolle: "rechnungsempfaenger",
        ist_hauptbeteiligter: true,
      })
      .select("id")
      .single();
    for (const b of [bt18a, bt18b, bt18c]) if (b?.id) ids.vorgang_beteiligte.push(b.id);
    record(
      "T18",
      !bt18aErr && !bt18bErr && !bt18cErr,
      bt18aErr?.message ?? bt18bErr?.message ?? bt18cErr?.message ?? "ok",
    );

    // T19: Derselbe Kunde mehrere Rollen
    const { data: bt19, error: bt19Err } = await service
      .from("vorgang_beteiligte")
      .insert({
        mandant_id: mA,
        vorgang_id: vorgangId,
        kunde_id: kMieter1.id,
        rolle: "ansprechpartner",
      })
      .select("id")
      .single();
    if (bt19?.id) ids.vorgang_beteiligte.push(bt19.id);
    record("T19", !bt19Err, bt19Err?.message ?? "ok");

    // T20: Doppelte identische Rolle
    const { error: t20Err } = await service.from("vorgang_beteiligte").insert({
      mandant_id: mA,
      vorgang_id: vorgangId,
      kunde_id: kMieter1.id,
      rolle: "anfragender",
    });
    record("T20", isExpectedDbError(t20Err), t20Err?.message ?? "INSERT ok (unexpected)");

    // T21: Zwei Hauptauftraggeber
    const { data: bt21a, error: bt21aErr } = await service
      .from("vorgang_beteiligte")
      .insert({
        mandant_id: mA,
        vorgang_id: vorgangId,
        kunde_id: kMieter2.id,
        rolle: "auftraggeber",
        ist_hauptbeteiligter: true,
      })
      .select("id")
      .single();
    if (bt21a?.id) ids.vorgang_beteiligte.push(bt21a.id);
    record(
      "T21",
      isExpectedDbError(bt21aErr),
      bt21aErr?.message ?? "INSERT ok (unexpected)",
    );

    // T22: Mehrere normale Ansprechpartner
    const { data: bt22a, error: bt22aErr } = await service
      .from("vorgang_beteiligte")
      .insert({
        mandant_id: mA,
        vorgang_id: vorgangId,
        kunde_id: kMieter2.id,
        rolle: "ansprechpartner",
      })
      .select("id")
      .single();
    const { data: bt22b, error: bt22bErr } = await service
      .from("vorgang_beteiligte")
      .insert({
        mandant_id: mA,
        vorgang_id: vorgangId,
        kunde_id: kSame.id,
        rolle: "ansprechpartner",
      })
      .select("id")
      .single();
    for (const b of [bt22a, bt22b]) if (b?.id) ids.vorgang_beteiligte.push(b.id);
    record("T22", !bt22aErr && !bt22bErr, bt22aErr?.message ?? bt22bErr?.message ?? "ok");

    // T23: RLS anon/authenticated auf neuen Tabellen
    const rlsTables = ["kunden_objekt_beziehungen", "vorgaenge", "vorgang_beteiligte"];
    const rlsDetails = [];
    let rlsOk = true;
    for (const t of rlsTables) {
      const { data: anonRead, error: anonReadErr } = await anon.from(t).select("id").limit(1);
      const anonBlocked = !anonReadErr && (anonRead?.length ?? 0) === 0;
      const { error: anonInsErr } = await anon.from(t).insert({}).select();
      const anonInsBlocked = isExpectedDbError(anonInsErr);
      if (!anonBlocked || !anonInsBlocked) rlsOk = false;
      rlsDetails.push(`${t}:anon_read=${anonBlocked},anon_ins=${anonInsBlocked}`);
    }

    const email = `m2-test-${ts}@example.com`;
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
    authed = createClient(url, anonKey, {
      global: {
        headers: { Authorization: `Bearer ${signIn?.session?.access_token}` },
      },
      auth: { persistSession: false, autoRefreshToken: false },
    });

    for (const t of rlsTables) {
      const { data: authRead, error: authReadErr } = await authed.from(t).select("id").limit(1);
      const authBlocked = !signInErr && !authCreateErr && !authReadErr && (authRead?.length ?? 0) === 0;
      const { error: authInsErr } = await authed.from(t).insert({}).select();
      const authInsBlocked = isExpectedDbError(authInsErr);
      if (!authBlocked || !authInsBlocked) rlsOk = false;
      rlsDetails.push(`${t}:auth_read=${authBlocked},auth_ins=${authInsBlocked}`);
    }
    record("T23", rlsOk, rlsDetails.join("; "));
    record("rls", rlsOk, rlsDetails.join("; "));

    // Policies: keine sichtbaren Zeilen für anon/auth = effektiv blockiert
    record(
      "policies",
      rlsOk,
      "Kein direkter pg_catalog-Zugriff; effektiver Zugriff über JS geprüft",
    );

    // T24: Service Role CRUD
    const { data: svcBz, error: svcBzErr } = await service
      .from("kunden_objekt_beziehungen")
      .insert({
        mandant_id: mA,
        kunde_id: kSame.id,
        gebaeude_id: gA2.id,
        rolle: "hausverwaltung",
        gueltig_ab: today,
      })
      .select("id")
      .single();
    if (svcBz?.id) ids.beziehungen.push(svcBz.id);
    const { error: svcUpdErr } = await service
      .from("kunden_objekt_beziehungen")
      .update({ notizen: "svc update" })
      .eq("id", svcBz?.id);
    const { error: svcDelPrep } = await service
      .from("kunden_objekt_beziehungen")
      .delete()
      .eq("id", svcBz?.id);
    record(
      "T24",
      !svcBzErr && !svcUpdErr && !svcDelPrep,
      svcBzErr?.message ?? svcUpdErr?.message ?? svcDelPrep?.message ?? "ok",
    );
    if (svcBz?.id) {
      const idx = ids.beziehungen.indexOf(svcBz.id);
      if (idx >= 0) ids.beziehungen.splice(idx, 1);
    }

    record("parentKeys", !svcBzErr && !vEinErr, "Composite-FKs erfolgreich in T1/T10/T17/T24");
  } finally {
    await cleanup(ids);

    if (beforeSnap) {
      const afterSnap = await snapshotCounts();
      const bestandOk = Object.entries(beforeSnap).every(([t, c]) => afterSnap[t] === c);
      const details = Object.entries(beforeSnap)
        .map(([t, c]) => `${t}: ${c}→${afterSnap[t]}`)
        .join(", ");
      record("T25", bestandOk, details);
      record("bestandsschutz", bestandOk, details);

      const orgOk = afterSnap.organizations === beforeSnap.organizations;
      const angebOk = afterSnap.angebote === beforeSnap.angebote;
      record(
        "adminSmoke",
        orgOk && angebOk,
        `organizations ${beforeSnap.organizations}→${afterSnap.organizations}, angebote ${beforeSnap.angebote}→${afterSnap.angebote}`,
      );
    }

    const remnants = {};
    const { count: cOrg } = await service
      .from("organizations")
      .select("*", { count: "exact", head: true })
      .like("name", "__test_m2_%");
    const { count: cKunden } = await service
      .from("kunden")
      .select("*", { count: "exact", head: true })
      .like("kundennummer", "M2-%");
    const { count: cVorg } = await service
      .from("vorgaenge")
      .select("*", { count: "exact", head: true })
      .like("vorgangsnummer", "M2-%");
    const { count: cBz } = await service
      .from("kunden_objekt_beziehungen")
      .select("*", { count: "exact", head: true })
      .limit(1);
    remnants.orgs = cOrg ?? 0;
    remnants.kunden = cKunden ?? 0;
    remnants.vorgaenge = cVorg ?? 0;

    const cleanupOk =
      remnants.orgs === 0 && remnants.kunden === 0 && remnants.vorgaenge === 0;
    record(
      "T26",
      cleanupOk,
      `orgs=${remnants.orgs}, kunden=${remnants.kunden}, vorgaenge=${remnants.vorgaenge}`,
    );
    record(
      "cleanup",
      cleanupOk,
      `orgs=${remnants.orgs}, kunden=${remnants.kunden}, vorgaenge=${remnants.vorgaenge}`,
    );
  }

  const problems = [];
  for (const [k, v] of Object.entries(results)) {
    if (v && !v.ok) problems.push(`${k}: ${v.detail}`);
  }
  for (const [k, v] of Object.entries(extra)) {
    if (v && !v.ok) problems.push(`${k}: ${v.detail}`);
  }

  console.log(
    JSON.stringify(
      {
        passed,
        tablesChecked,
        results,
        extra,
        problems,
      },
      null,
      2,
    ),
  );
  process.exit(passed ? 0 : 1);
}

main().catch((err) => {
  console.log(
    JSON.stringify({ passed: false, fatal: err.message, results, extra, problems: [err.message] }, null, 2),
  );
  process.exit(1);
});

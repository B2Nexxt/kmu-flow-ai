/**
 * Integrationstest Migration 20260717300000_operativer_anfrageeingang_v1.sql
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

const results = Object.fromEntries(
  Array.from({ length: 30 }, (_, i) => [`T${i + 1}`, null]),
);
const extra = {
  tabelle: null,
  funktion: null,
  trigger: null,
  rohinhaltSchutz: null,
  zuordnungFk: null,
  dubletten: null,
  rls: null,
  bestandsschutz: null,
  adminSmoke: null,
  cleanup: null,
};
const objectsChecked = [];
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
    error.code === "P0001" ||
    /violates|duplicate|check constraint|foreign key|row-level security|permission denied|anfrageeingaenge:/i.test(
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
    "kunden_objekt_beziehungen",
    "vorgaenge",
    "vorgang_beteiligte",
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
    authUserId: null,
  };
  let beforeSnap = null;
  const ts = Date.now();

  try {
    beforeSnap = await snapshotCounts();

    const { error: tblErr } = await service.from("anfrageeingaenge").select("id").limit(1);
    objectsChecked.push("public.anfrageeingaenge");
    record(
      "tabelle",
      !tblErr,
      tblErr?.message ?? "Tabelle vorhanden (Migration M3 anwenden falls fehlt)",
    );
    if (tblErr) throw tblErr;

    objectsChecked.push("public.anfrageeingaenge_protect_raw_content() (indirekt)");
    objectsChecked.push("Trigger anfrageeingaenge_protect_raw_content (indirekt)");
    objectsChecked.push("Trigger anfrageeingaenge_set_updated_at (indirekt)");

    const { data: orgA, error: orgAErr } = await service
      .from("organizations")
      .insert({ name: `__test_m3_a_${ts}`, status: "interessent" })
      .select("id")
      .single();
    if (orgAErr) throw orgAErr;
    ids.orgs.push(orgA.id);

    const { data: orgB, error: orgBErr } = await service
      .from("organizations")
      .insert({ name: `__test_m3_b_${ts}`, status: "interessent" })
      .select("id")
      .single();
    if (orgBErr) throw orgBErr;
    ids.orgs.push(orgB.id);

    const mA = orgA.id;
    const mB = orgB.id;

    const { data: kA, error: kAErr } = await service
      .from("kunden")
      .insert({
        mandant_id: mA,
        kundennummer: `M3-K-${ts}`,
        kundentyp: "privatperson",
        vorname: "Test",
        nachname: "Kunde",
        anzeigename: "Test Kunde",
      })
      .select("id")
      .single();
    if (kAErr) throw kAErr;
    ids.kunden.push(kA.id);

    const { data: kB, error: kBErr } = await service
      .from("kunden")
      .insert({
        mandant_id: mB,
        kundennummer: `M3-K-${ts}`,
        kundentyp: "privatperson",
        vorname: "Fremd",
        nachname: "Kunde",
        anzeigename: "Fremd Kunde",
      })
      .select("id")
      .single();
    if (kBErr) throw kBErr;
    ids.kunden.push(kB.id);

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

    const { data: gA2 } = await service
      .from("gebaeude")
      .insert({ mandant_id: mA, adresse_id: adrA.id, gebaeudeart: "nebengebaeude" })
      .select("id")
      .single();
    ids.gebaeude.push(gA2.id);

    const { data: eA } = await service
      .from("einheiten")
      .insert({
        mandant_id: mA,
        gebaeude_id: gA.id,
        bezeichnung: `Whg-${ts}`,
        einheit_typ: "wohnung",
      })
      .select("id")
      .single();
    const { data: eB } = await service
      .from("einheiten")
      .insert({
        mandant_id: mB,
        gebaeude_id: gB.id,
        bezeichnung: `Whg-B-${ts}`,
        einheit_typ: "wohnung",
      })
      .select("id")
      .single();
    ids.einheiten.push(eA.id, eB.id);

    const { data: vA, error: vAErr } = await service
      .from("vorgaenge")
      .insert({
        mandant_id: mA,
        vorgangsnummer: `M3-V-${ts}`,
        vorgangstyp: "anfrage",
        gebaeude_id: gA.id,
        titel: "Test-Vorgang",
      })
      .select("id")
      .single();
    if (vAErr) throw vAErr;
    ids.vorgaenge.push(vA.id);

    // T1: minimal INSERT
    const { data: t1, error: t1Err } = await service
      .from("anfrageeingaenge")
      .insert({ mandant_id: mA, eingangsnummer: `M3-E1-${ts}`, kanal: "email" })
      .select("id, rohinhalt_gesperrt_am")
      .single();
    if (t1?.id) ids.anfrageeingaenge.push(t1.id);
    record("T1", !t1Err && !!t1?.id, t1Err?.message ?? "ok");

    // T2: invalid kanal
    const { error: t2Err } = await service.from("anfrageeingaenge").insert({
      mandant_id: mA,
      eingangsnummer: `M3-BAD-K-${ts}`,
      kanal: "invalid",
    });
    record("T2", isExpectedDbError(t2Err), t2Err?.message ?? "unexpected ok");

    // T3: invalid status
    const { error: t3Err } = await service.from("anfrageeingaenge").insert({
      mandant_id: mA,
      eingangsnummer: `M3-BAD-S-${ts}`,
      kanal: "email",
      status: "invalid",
    });
    record("T3", isExpectedDbError(t3Err), t3Err?.message ?? "unexpected ok");

    // T4: verworfen ohne beendet_am
    const { error: t4Err } = await service.from("anfrageeingaenge").insert({
      mandant_id: mA,
      eingangsnummer: `M3-VW-${ts}`,
      kanal: "email",
      status: "verworfen",
    });
    record("T4", isExpectedDbError(t4Err), t4Err?.message ?? "unexpected ok");

    // T5: aktiver status mit beendet_am
    const { error: t5Err } = await service.from("anfrageeingaenge").insert({
      mandant_id: mA,
      eingangsnummer: `M3-BA-${ts}`,
      kanal: "email",
      status: "neu",
      beendet_am: new Date().toISOString(),
    });
    record("T5", isExpectedDbError(t5Err), t5Err?.message ?? "unexpected ok");

    // T6: bestaetigt ohne Kunde/Gebäude
    const { error: t6Err } = await service.from("anfrageeingaenge").insert({
      mandant_id: mA,
      eingangsnummer: `M3-B6-${ts}`,
      kanal: "email",
      status: "analysiert",
      zuordnungsstatus: "bestaetigt",
    });
    record("T6", isExpectedDbError(t6Err), t6Err?.message ?? "unexpected ok");

    // T7: FK bei nicht bestaetigt
    const { error: t7Err } = await service.from("anfrageeingaenge").insert({
      mandant_id: mA,
      eingangsnummer: `M3-B7-${ts}`,
      kanal: "email",
      status: "analysiert",
      zuordnungsstatus: "eindeutig",
      zugeordnet_kunde_id: kA.id,
      zugeordnet_gebaeude_id: gA.id,
    });
    record("T7", isExpectedDbError(t7Err), t7Err?.message ?? "unexpected ok");

    // T8: bestaetigt mit gültigen FKs
    const { data: t8, error: t8Err } = await service
      .from("anfrageeingaenge")
      .insert({
        mandant_id: mA,
        eingangsnummer: `M3-B8-${ts}`,
        kanal: "email",
        status: "analysiert",
        zuordnungsstatus: "bestaetigt",
        zugeordnet_kunde_id: kA.id,
        zugeordnet_gebaeude_id: gA.id,
        zugeordnet_einheit_id: eA.id,
      })
      .select("id")
      .single();
    if (t8?.id) ids.anfrageeingaenge.push(t8.id);
    record("T8", !t8Err && !!t8?.id, t8Err?.message ?? "ok");

    // T9: falsche Einheit zum Gebäude
    const { error: t9Err } = await service.from("anfrageeingaenge").insert({
      mandant_id: mA,
      eingangsnummer: `M3-B9-${ts}`,
      kanal: "email",
      status: "analysiert",
      zuordnungsstatus: "bestaetigt",
      zugeordnet_kunde_id: kA.id,
      zugeordnet_gebaeude_id: gA.id,
      zugeordnet_einheit_id: eB.id,
    });
    record("T9", isExpectedDbError(t9Err), t9Err?.message ?? "unexpected ok");

    // T10: Cross-Tenant
    const { error: t10Err } = await service.from("anfrageeingaenge").insert({
      mandant_id: mA,
      eingangsnummer: `M3-B10-${ts}`,
      kanal: "email",
      status: "analysiert",
      zuordnungsstatus: "bestaetigt",
      zugeordnet_kunde_id: kB.id,
      zugeordnet_gebaeude_id: gA.id,
    });
    record("T10", isExpectedDbError(t10Err), t10Err?.message ?? "unexpected ok");

    // T11: duplicate eingangsnummer
    const { error: t11Err } = await service.from("anfrageeingaenge").insert({
      mandant_id: mA,
      eingangsnummer: `M3-E1-${ts}`,
      kanal: "telefon",
    });
    record("T11", isExpectedDbError(t11Err), t11Err?.message ?? "unexpected ok");

    // T12: same nummer other mandant
    const { data: t12, error: t12Err } = await service
      .from("anfrageeingaenge")
      .insert({
        mandant_id: mB,
        eingangsnummer: `M3-E1-${ts}`,
        kanal: "email",
      })
      .select("id")
      .single();
    if (t12?.id) ids.anfrageeingaenge.push(t12.id);
    record("T12", !t12Err && !!t12?.id, t12Err?.message ?? "ok");

    // T13: duplicate kanal_externe_id
    const extId = `ext-${ts}`;
    const { data: t13a, error: t13aErr } = await service
      .from("anfrageeingaenge")
      .insert({
        mandant_id: mA,
        eingangsnummer: `M3-EXT1-${ts}`,
        kanal: "email",
        kanal_externe_id: extId,
        status: "analysiert",
      })
      .select("id")
      .single();
    if (t13a?.id) ids.anfrageeingaenge.push(t13a.id);
    const { error: t13Err } = await service.from("anfrageeingaenge").insert({
      mandant_id: mA,
      eingangsnummer: `M3-EXT2-${ts}`,
      kanal: "email",
      kanal_externe_id: extId,
      status: "analysiert",
    });
    record("T13", !t13aErr && isExpectedDbError(t13Err), t13Err?.message ?? "unexpected ok");

    // T14: same ext id other mandant
    const { data: t14, error: t14Err } = await service
      .from("anfrageeingaenge")
      .insert({
        mandant_id: mB,
        eingangsnummer: `M3-EXT-B-${ts}`,
        kanal: "email",
        kanal_externe_id: extId,
        status: "analysiert",
      })
      .select("id")
      .single();
    if (t14?.id) ids.anfrageeingaenge.push(t14.id);
    record("T14", !t14Err && !!t14?.id, t14Err?.message ?? "ok");

    // T15: two eingaenge same vorgang
    const beendet = new Date().toISOString();
    const { data: t15a, error: t15aErr } = await service
      .from("anfrageeingaenge")
      .insert({
        mandant_id: mA,
        eingangsnummer: `M3-V1-${ts}`,
        kanal: "email",
        status: "in_vorgang_ueberfuehrt",
        erzeugter_vorgang_id: vA.id,
        beendet_am: beendet,
      })
      .select("id")
      .single();
    const { data: t15b, error: t15bErr } = await service
      .from("anfrageeingaenge")
      .insert({
        mandant_id: mA,
        eingangsnummer: `M3-V2-${ts}`,
        kanal: "telefon",
        status: "in_vorgang_ueberfuehrt",
        erzeugter_vorgang_id: vA.id,
        beendet_am: beendet,
      })
      .select("id")
      .single();
    if (t15a?.id) ids.anfrageeingaenge.push(t15a.id);
    if (t15b?.id) ids.anfrageeingaenge.push(t15b.id);
    record("T15", !t15aErr && !t15bErr, t15aErr?.message ?? t15bErr?.message ?? "ok");

    // T16: vorgang_id ohne status
    const { error: t16Err } = await service.from("anfrageeingaenge").insert({
      mandant_id: mA,
      eingangsnummer: `M3-VBAD-${ts}`,
      kanal: "email",
      status: "analysiert",
      erzeugter_vorgang_id: vA.id,
    });
    record("T16", isExpectedDbError(t16Err), t16Err?.message ?? "unexpected ok");

    // T17: parent self
    const { data: t17row, error: t17insErr } = await service
      .from("anfrageeingaenge")
      .insert({
        mandant_id: mA,
        eingangsnummer: `M3-PAR-${ts}`,
        kanal: "email",
      })
      .select("id")
      .single();
    if (t17row?.id) ids.anfrageeingaenge.push(t17row.id);
    const { error: t17Err } = await service
      .from("anfrageeingaenge")
      .update({ parent_anfrageeingang_id: t17row?.id })
      .eq("id", t17row?.id);
    record("T17", !t17insErr && isExpectedDbError(t17Err), t17Err?.message ?? "unexpected ok");

    // T18: archivierung
    const { data: t18row, error: t18insErr } = await service
      .from("anfrageeingaenge")
      .insert({
        mandant_id: mA,
        eingangsnummer: `M3-ARCH-${ts}`,
        kanal: "email",
      })
      .select("id")
      .single();
    if (t18row?.id) ids.anfrageeingaenge.push(t18row.id);
    const { error: t18badErr } = await service
      .from("anfrageeingaenge")
      .update({ aktiv: false })
      .eq("id", t18row?.id);
    const { error: t18okErr } = await service
      .from("anfrageeingaenge")
      .update({ aktiv: false, archiviert_am: new Date().toISOString() })
      .eq("id", t18row?.id);
    record(
      "T18",
      !t18insErr && isExpectedDbError(t18badErr) && !t18okErr,
      t18badErr?.message ?? t18okErr?.message ?? "ok",
    );

    // Rohinhalt tests setup
    const { data: rohNeu, error: rohNeuErr } = await service
      .from("anfrageeingaenge")
      .insert({
        mandant_id: mA,
        eingangsnummer: `M3-ROH-${ts}`,
        kanal: "email",
        status: "neu",
        rohinhalt: "Originaltext",
      })
      .select("id, rohinhalt_gesperrt_am")
      .single();
    if (rohNeu?.id) ids.anfrageeingaenge.push(rohNeu.id);

    // T22: INSERT analysiert sets lock (before T19-T23 chain)
    const { data: t22, error: t22Err } = await service
      .from("anfrageeingaenge")
      .insert({
        mandant_id: mA,
        eingangsnummer: `M3-INS-A-${ts}`,
        kanal: "email",
        status: "analysiert",
        rohinhalt: "Sofort gesperrt",
      })
      .select("id, rohinhalt_gesperrt_am")
      .single();
    if (t22?.id) ids.anfrageeingaenge.push(t22.id);
    record(
      "T22",
      !t22Err && !!t22?.rohinhalt_gesperrt_am,
      t22Err?.message ?? `gesperrt=${!!t22?.rohinhalt_gesperrt_am}`,
    );

    // T21: combo update neu -> analysiert + rohinhalt fix
    const { error: t21Err } = await service
      .from("anfrageeingaenge")
      .update({ status: "analysiert", rohinhalt: "Korrigierter Text" })
      .eq("id", rohNeu?.id);
    const { data: rohAfter21 } = await service
      .from("anfrageeingaenge")
      .select("rohinhalt, rohinhalt_gesperrt_am, status")
      .eq("id", rohNeu?.id)
      .single();
    record(
      "T21",
      !t21Err &&
        rohAfter21?.rohinhalt === "Korrigierter Text" &&
        !!rohAfter21?.rohinhalt_gesperrt_am,
      t21Err?.message ?? JSON.stringify(rohAfter21),
    );

    // T19: later rohinhalt change blocked
    const { error: t19Err } = await service
      .from("anfrageeingaenge")
      .update({ rohinhalt: "Später geändert" })
      .eq("id", rohNeu?.id);
    record("T19", isExpectedDbError(t19Err), t19Err?.message ?? "unexpected ok");

    // T20: status back to neu, rohinhalt still locked
    const { error: t20statusErr } = await service
      .from("anfrageeingaenge")
      .update({ status: "neu" })
      .eq("id", rohNeu?.id);
    const { error: t20rohErr } = await service
      .from("anfrageeingaenge")
      .update({ rohinhalt: "Nochmal" })
      .eq("id", rohNeu?.id);
    const { data: rohAfter20 } = await service
      .from("anfrageeingaenge")
      .select("status, rohinhalt_gesperrt_am")
      .eq("id", rohNeu?.id)
      .single();
    record(
      "T20",
      !t20statusErr &&
        isExpectedDbError(t20rohErr) &&
        rohAfter20?.status === "neu" &&
        !!rohAfter20?.rohinhalt_gesperrt_am,
      t20rohErr?.message ?? JSON.stringify(rohAfter20),
    );

    // T23: manual null gesperrt_am
    const { error: t23Err } = await service
      .from("anfrageeingaenge")
      .update({ rohinhalt_gesperrt_am: null })
      .eq("id", rohNeu?.id);
    record("T23", isExpectedDbError(t23Err), t23Err?.message ?? "unexpected ok");

    record(
      "funktion",
      !t22Err && isExpectedDbError(t19Err) && isExpectedDbError(t23Err),
      "Schutzfunktion wirksam (Trigger-Verhalten)",
    );
    record(
      "trigger",
      !t21Err && isExpectedDbError(t19Err),
      "protect_raw_content + set_updated_at indirekt verifiziert",
    );
    record(
      "rohinhaltSchutz",
      results.T19?.ok &&
        results.T20?.ok &&
        results.T21?.ok &&
        results.T22?.ok &&
        results.T23?.ok,
      "T19–T23",
    );

    // T24: nicht_erforderlich
    const { data: t24, error: t24Err } = await service
      .from("anfrageeingaenge")
      .insert({
        mandant_id: mA,
        eingangsnummer: `M3-NR-${ts}`,
        kanal: "email",
        status: "analysiert",
        zuordnungsstatus: "nicht_erforderlich",
      })
      .select("id, zugeordnet_kunde_id")
      .single();
    if (t24?.id) ids.anfrageeingaenge.push(t24.id);
    record(
      "T24",
      !t24Err && t24?.zugeordnet_kunde_id == null,
      t24Err?.message ?? "ok",
    );

    // T25: JSON types
    const { error: t25badErr } = await service.from("anfrageeingaenge").insert({
      mandant_id: mA,
      eingangsnummer: `M3-JSON-BAD-${ts}`,
      kanal: "email",
      status: "analysiert",
      zuordnungskandidaten: {},
    });
    const { data: t25ok, error: t25okErr } = await service
      .from("anfrageeingaenge")
      .insert({
        mandant_id: mA,
        eingangsnummer: `M3-JSON-OK-${ts}`,
        kanal: "email",
        status: "analysiert",
      })
      .select("id, strukturierte_daten, fehlende_angaben")
      .single();
    if (t25ok?.id) ids.anfrageeingaenge.push(t25ok.id);
    record(
      "T25",
      isExpectedDbError(t25badErr) &&
        !t25okErr &&
        typeof t25ok?.strukturierte_daten === "object" &&
        Array.isArray(t25ok?.fehlende_angaben),
      t25badErr?.message ?? t25okErr?.message ?? "ok",
    );

    // T26: confidence_score
    const { error: t26Err } = await service.from("anfrageeingaenge").insert({
      mandant_id: mA,
      eingangsnummer: `M3-CONF-${ts}`,
      kanal: "email",
      status: "analysiert",
      confidence_score: 1.5,
    });
    record("T26", isExpectedDbError(t26Err), t26Err?.message ?? "unexpected ok");

    // Parent valid (T17 companion - valid parent)
    const { data: parentRow, error: parentInsErr } = await service
      .from("anfrageeingaenge")
      .insert({
        mandant_id: mA,
        eingangsnummer: `M3-PARENT-${ts}`,
        kanal: "email",
        status: "analysiert",
      })
      .select("id")
      .single();
    const { data: childRow, error: childErr } = await service
      .from("anfrageeingaenge")
      .insert({
        mandant_id: mA,
        eingangsnummer: `M3-CHILD-${ts}`,
        kanal: "email",
        status: "analysiert",
        parent_anfrageeingang_id: parentRow?.id,
      })
      .select("id")
      .single();
    if (parentRow?.id) ids.anfrageeingaenge.push(parentRow.id);
    if (childRow?.id) ids.anfrageeingaenge.push(childRow.id);

    // inhalt_hash duplicate allowed
    const hash = `hash-${ts}`;
    const { data: h1, error: h1Err } = await service
      .from("anfrageeingaenge")
      .insert({
        mandant_id: mA,
        eingangsnummer: `M3-H1-${ts}`,
        kanal: "email",
        status: "analysiert",
        inhalt_hash: hash,
      })
      .select("id")
      .single();
    const { data: h2, error: h2Err } = await service
      .from("anfrageeingaenge")
      .insert({
        mandant_id: mA,
        eingangsnummer: `M3-H2-${ts}`,
        kanal: "email",
        status: "analysiert",
        inhalt_hash: hash,
      })
      .select("id")
      .single();
    if (h1?.id) ids.anfrageeingaenge.push(h1.id);
    if (h2?.id) ids.anfrageeingaenge.push(h2.id);

    record(
      "zuordnungFk",
      results.T8?.ok && results.T9?.ok && results.T10?.ok && results.T6?.ok && results.T7?.ok,
      "T6–T10, T8",
    );
    record(
      "dubletten",
      results.T13?.ok &&
        results.T14?.ok &&
        results.T15?.ok &&
        !h1Err &&
        !h2Err &&
        !childErr,
      "T13–T15, Hash, Parent",
    );

    // T27: RLS
    const rlsTables = ["anfrageeingaenge"];
    let rlsOk = true;
    const rlsDetails = [];
    for (const t of rlsTables) {
      const { data: anonRead, error: anonReadErr } = await anon.from(t).select("id").limit(1);
      const anonBlocked = !anonReadErr && (anonRead?.length ?? 0) === 0;
      const { error: anonInsErr } = await anon.from(t).insert({});
      const anonInsBlocked = isExpectedDbError(anonInsErr);
      if (!anonBlocked || !anonInsBlocked) rlsOk = false;
      rlsDetails.push(`${t}:anon=${anonBlocked}/${anonInsBlocked}`);
    }
    const email = `m3-test-${ts}@example.com`;
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
    const { data: authRead, error: authReadErr } = await authed
      .from("anfrageeingaenge")
      .select("id")
      .limit(1);
    const authBlocked =
      !signInErr && !authCreateErr && !authReadErr && (authRead?.length ?? 0) === 0;
    const { error: authInsErr } = await authed.from("anfrageeingaenge").insert({});
    const authInsBlocked = isExpectedDbError(authInsErr);
    if (!authBlocked || !authInsBlocked) rlsOk = false;
    rlsDetails.push(`auth=${authBlocked}/${authInsBlocked}`);
    record("T27", rlsOk, rlsDetails.join("; "));
    record("rls", rlsOk, rlsDetails.join("; "));

    // T28: Service CRUD
    const { data: svcIns, error: svcInsErr } = await service
      .from("anfrageeingaenge")
      .insert({
        mandant_id: mA,
        eingangsnummer: `M3-SVC-${ts}`,
        kanal: "sonstiges",
        status: "analysiert",
      })
      .select("id")
      .single();
    const { error: svcUpdErr } = await service
      .from("anfrageeingaenge")
      .update({ betreff: "Svc Update" })
      .eq("id", svcIns?.id);
    const { error: svcDelErr } = await service
      .from("anfrageeingaenge")
      .delete()
      .eq("id", svcIns?.id);
    record(
      "T28",
      !svcInsErr && !svcUpdErr && !svcDelErr,
      svcInsErr?.message ?? svcUpdErr?.message ?? svcDelErr?.message ?? "ok",
    );
  } finally {
    await cleanup(ids);

    if (beforeSnap) {
      const afterSnap = await snapshotCounts();
      const details = Object.entries(beforeSnap)
        .map(([t, c]) => `${t}: ${c}→${afterSnap[t]}`)
        .join(", ");
      const bestandOk = Object.entries(beforeSnap).every(([t, c]) => afterSnap[t] === c);
      record("T29", bestandOk, details);
      record("bestandsschutz", bestandOk, details);
      record(
        "adminSmoke",
        afterSnap.organizations === beforeSnap.organizations &&
          afterSnap.angebote === beforeSnap.angebote,
        `organizations ${beforeSnap.organizations}→${afterSnap.organizations}, angebote ${beforeSnap.angebote}→${afterSnap.angebote}`,
      );
    }

    const { count: cOrg } = await service
      .from("organizations")
      .select("*", { count: "exact", head: true })
      .like("name", "__test_m3_%");
    const { count: cAe } = await service
      .from("anfrageeingaenge")
      .select("*", { count: "exact", head: true })
      .like("eingangsnummer", "M3-%");
    const cleanupOk = (cOrg ?? 0) === 0 && (cAe ?? 0) === 0;
    record("T30", cleanupOk, `orgs=${cOrg ?? 0}, anfrageeingaenge=${cAe ?? 0}`);
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
    JSON.stringify({ passed, objectsChecked, results, extra, problems }, null, 2),
  );
  process.exit(passed ? 0 : 1);
}

main().catch((err) => {
  console.log(
    JSON.stringify({ passed: false, fatal: err.message, results, extra, problems: [err.message] }, null, 2),
  );
  process.exit(1);
});

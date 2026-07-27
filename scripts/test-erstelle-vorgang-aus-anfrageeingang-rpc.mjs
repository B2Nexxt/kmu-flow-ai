/**
 * Integrationstest RPC public.erstelle_vorgang_aus_anfrageeingang
 * Migration 20260717350000_erstelle_vorgang_aus_anfrageeingang_rpc.sql
 */
import { readFileSync, existsSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import { spawnSync } from "node:child_process";
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
  Array.from({ length: 38 }, (_, i) => [`T${i + 1}`, null]),
);
const extra = {
  nummerierung: null,
  parallelitaet: null,
  titelPrioritaet: null,
  beteiligte: null,
  idempotenz: null,
  rollback: null,
  abschluss: null,
  berechtigungen: null,
  regression: null,
  bestandsschutz: null,
  adminSmoke: null,
  cleanup: null,
};
const notes = {
  directUpdate:
    "T23/T24: vollstaendigkeitsstatus bzw. status per direktem UPDATE (nicht über vorhandene RPCs erreichbar)",
  rollbackGrenze:
    "T33: Fachliche Beteiligtenvalidierung vor Nummernvergabe — kein post-Sequenz-Fehler ohne Produktionsrisiko reproduzierbar",
};
let passed = true;
let beforeSnap = null;

function record(key, ok, detail = "") {
  if (key in results) results[key] = { ok, detail };
  else if (key in extra) extra[key] = { ok, detail };
  else extra[key] = { ok, detail };
  if (!ok) passed = false;
}

function zweiMerkmaleGrund(extraFields = {}) {
  return {
    merkmale: [
      { typ: "email", ergebnis: "uebereinstimmung" },
      { typ: "objektadresse", ergebnis: "uebereinstimmung" },
    ],
    widersprueche: [],
    regelversion: "v1",
    ...extraFields,
  };
}

function baseBewertung(overrides = {}) {
  return {
    p_strukturierte_daten: { quelle: "test" },
    p_zuordnungsstatus: "eindeutig",
    p_zuordnungsgrund: zweiMerkmaleGrund(),
    p_zuordnungskandidaten: [],
    p_vollstaendigkeitsstatus: "vollstaendig",
    p_fehlende_angaben: [],
    p_dringlichkeit: "normal",
    p_manuelle_pruefung_erforderlich: false,
    ...overrides,
  };
}

async function createEingang(mandantId, suffix, ts, overrides = {}) {
  const { data, error } = await service.rpc("create_anfrageeingang", {
    p_mandant_id: mandantId,
    p_kanal: "email",
    p_rohinhalt: `vorg-test-${suffix}-${ts}`,
    ...overrides,
  });
  if (error) throw error;
  if (!data?.ok) throw new Error(`create fehlgeschlagen (${suffix}): ${JSON.stringify(data)}`);
  return data;
}

async function bewertung(mandantId, anfrageeingangId, overrides = {}) {
  const { data, error } = await service.rpc("update_anfrageeingang_bewertung", {
    p_mandant_id: mandantId,
    p_anfrageeingang_id: anfrageeingangId,
    ...baseBewertung(overrides),
  });
  return { data, error };
}

async function bestaetige(mandantId, anfrageeingangId, kundeId, gebaeudeId, einheitId = null) {
  const { data, error } = await service.rpc("bestaetige_anfrageeingang_zuordnung", {
    p_mandant_id: mandantId,
    p_anfrageeingang_id: anfrageeingangId,
    p_kunde_id: kundeId,
    p_gebaeude_id: gebaeudeId,
    p_einheit_id: einheitId,
    p_bestaetigungsquelle: "test-vorgang",
  });
  return { data, error };
}

async function erstelle(client, mandantId, anfrageeingangId, overrides = {}) {
  const { data, error } = await client.rpc("erstelle_vorgang_aus_anfrageeingang", {
    p_mandant_id: mandantId,
    p_anfrageeingang_id: anfrageeingangId,
    ...overrides,
  });
  return { data, error };
}

async function fetchEingang(id) {
  const { data, error } = await service.from("anfrageeingaenge").select("*").eq("id", id).single();
  if (error) throw error;
  return data;
}

async function fetchVorgang(id) {
  const { data, error } = await service.from("vorgaenge").select("*").eq("id", id).single();
  if (error) throw error;
  return data;
}

async function fetchBeteiligte(vorgangId) {
  const { data, error } = await service
    .from("vorgang_beteiligte")
    .select("*")
    .eq("vorgang_id", vorgangId);
  if (error) throw error;
  return data ?? [];
}

async function getVorgangsSeq(mandantId, jahr) {
  const { data } = await service
    .from("vorgangsnummer_sequenzen")
    .select("letzter_wert")
    .eq("mandant_id", mandantId)
    .eq("jahr", jahr)
    .maybeSingle();
  return data?.letzter_wert ?? 0;
}

function trackEingangSeq(ids, mandantId, jahr) {
  const key = `${mandantId}|e|${jahr}`;
  if (!ids.sequenzKeys.has(key)) {
    ids.sequenzKeys.add(key);
    ids.eingangsnummer_sequenzen.push({ mandant_id: mandantId, jahr });
  }
}

function trackVorgangSeq(ids, mandantId, jahr) {
  const key = `${mandantId}|v|${jahr}`;
  if (!ids.sequenzKeys.has(key)) {
    ids.sequenzKeys.add(key);
    ids.vorgangsnummer_sequenzen.push({ mandant_id: mandantId, jahr });
  }
}

function trackVorgang(ids, vorgangId) {
  if (vorgangId && !ids.vorgaenge.includes(vorgangId)) ids.vorgaenge.push(vorgangId);
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
    const { count, error } = await service.from(t).select("*", { count: "exact", head: true });
    if (error) throw new Error(`Snapshot ${t}: ${error.message}`);
    snap[t] = count ?? 0;
  }
  return snap;
}

async function cleanup(ids) {
  if (ids.vorgaenge.length) {
    await service.from("vorgang_beteiligte").delete().in("vorgang_id", ids.vorgaenge);
  }
  if (ids.anfrageeingaenge.length) {
    await service.from("anfrageeingaenge").delete().in("id", ids.anfrageeingaenge);
  }
  if (ids.vorgaenge.length) {
    await service.from("vorgaenge").delete().in("id", ids.vorgaenge);
  }
  for (const row of ids.vorgangsnummer_sequenzen) {
    await service
      .from("vorgangsnummer_sequenzen")
      .delete()
      .eq("mandant_id", row.mandant_id)
      .eq("jahr", row.jahr);
  }
  for (const row of ids.eingangsnummer_sequenzen) {
    await service
      .from("eingangsnummer_sequenzen")
      .delete()
      .eq("mandant_id", row.mandant_id)
      .eq("jahr", row.jahr);
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
  for (const row of ids.kundennummer_sequenzen) {
    await service.from("kundennummer_sequenzen").delete().eq("mandant_id", row.mandant_id);
  }
  for (const orgId of ids.orgs) {
    await service.from("organizations").delete().eq("id", orgId);
  }
  if (ids.authUserId) {
    await service.auth.admin.deleteUser(ids.authUserId);
  }
}

async function createOrg(ts, suffix) {
  const { data, error } = await service
    .from("organizations")
    .insert({ name: `__test_vorg_${suffix}_${ts}`, status: "interessent" })
    .select("id")
    .single();
  if (error) throw error;
  return data.id;
}

async function setupStammdaten(ts, orgA, orgB, ids) {
  const insKunde = (mid, num, name, arch = false) =>
    service
      .from("kunden")
      .insert({
        mandant_id: mid,
        kundennummer: num,
        kundentyp: "privatperson",
        vorname: name,
        nachname: "Test",
        anzeigename: `${name} Test`,
        ...(arch ? { aktiv: false, archiviert_am: new Date().toISOString() } : {}),
      })
      .select("id")
      .single();

  const { data: kA } = await insKunde(orgA, `VORG-KA-${ts}`, "Aktiv");
  const { data: kA2 } = await insKunde(orgA, `VORG-KA2-${ts}`, "Zweit");
  const { data: kArch } = await insKunde(orgA, `VORG-KARCH-${ts}`, "Arch", true);
  const { data: kB } = await insKunde(orgB, `VORG-KB-${ts}`, "Fremd");
  ids.kunden.push(kA.id, kA2.id, kArch.id, kB.id);

  const insAdr = (mid, n) =>
    service
      .from("adressen")
      .insert({
        mandant_id: mid,
        strasse: "Vorgstr.",
        hausnummer: String(n),
        plz: "10115",
        ort: "Berlin",
      })
      .select("id")
      .single();
  const { data: adrA } = await insAdr(orgA, 1);
  const { data: adrB } = await insAdr(orgB, 2);
  ids.adressen.push(adrA.id, adrB.id);

  const insGeb = (mid, adrId) =>
    service
      .from("gebaeude")
      .insert({ mandant_id: mid, adresse_id: adrId, gebaeudeart: "einfamilienhaus" })
      .select("id")
      .single();
  const { data: gebA } = await insGeb(orgA, adrA.id);
  const { data: gebB } = await insGeb(orgB, adrB.id);
  ids.gebaeude.push(gebA.id, gebB.id);

  const { data: einA } = await service
    .from("einheiten")
    .insert({
      mandant_id: orgA,
      gebaeude_id: gebA.id,
      bezeichnung: `Whg-${ts}`,
      einheit_typ: "wohnung",
    })
    .select("id")
    .single();
  ids.einheiten.push(einA.id);

  return { kA: kA.id, kA2: kA2.id, kArch: kArch.id, kB: kB.id, gebA: gebA.id, gebB: gebB.id, einA: einA.id };
}

async function createEingangOnly(mandantId, suffix, ts, ids, createOverrides = {}, bewOverrides = {}) {
  const e = await createEingang(mandantId, suffix, ts, createOverrides);
  ids.anfrageeingaenge.push(e.anfrageeingang_id);
  const row = await fetchEingang(e.anfrageeingang_id);
  const jahr = new Date(row.empfangen_am).getFullYear();
  trackEingangSeq(ids, mandantId, jahr);
  const { data: bData, error: bErr } = await bewertung(mandantId, e.anfrageeingang_id, bewOverrides);
  if (bErr) throw bErr;
  if (!bData?.ok) throw new Error(`bewertung fehlgeschlagen (${suffix}): ${JSON.stringify(bData)}`);
  return e.anfrageeingang_id;
}

async function readyPipeline(mandantId, suffix, ts, ids, sd, opts = {}) {
  const eingangId = await createEingangOnly(
    mandantId,
    suffix,
    ts,
    ids,
    opts.createOverrides ?? {},
    opts.bewOverrides ?? {},
  );
  if (!opts.skipBestaetige) {
    const { data, error } = await bestaetige(
      mandantId,
      eingangId,
      opts.kundeId ?? sd.kA,
      opts.gebaeudeId ?? sd.gebA,
      opts.einheitId ?? null,
    );
    if (error) throw error;
    if (data?.code !== "confirmed") {
      throw new Error(`bestaetige fehlgeschlagen (${suffix}): ${JSON.stringify(data)}`);
    }
  }
  const row = await fetchEingang(eingangId);
  trackVorgangSeq(ids, mandantId, new Date(row.empfangen_am).getFullYear());
  return eingangId;
}

function expectedVorgangsnummer(jahr, seq) {
  return `VG-${jahr}-${String(seq).padStart(4, "0")}`;
}

function pickSnapshotFields(row) {
  return {
    strukturierte_daten: row.strukturierte_daten,
    zuordnungsstatus: row.zuordnungsstatus,
    zuordnungsgrund: row.zuordnungsgrund,
    zuordnungskandidaten: row.zuordnungskandidaten,
    fehlende_angaben: row.fehlende_angaben,
    confidence_score: row.confidence_score,
    dringlichkeit: row.dringlichkeit,
    zugeordnet_kunde_id: row.zugeordnet_kunde_id,
    zugeordnet_gebaeude_id: row.zugeordnet_gebaeude_id,
    zugeordnet_einheit_id: row.zugeordnet_einheit_id,
  };
}

function runRegression(script) {
  const r = spawnSync("node", [join(root, "scripts", script)], {
    cwd: root,
    encoding: "utf8",
    env: process.env,
  });
  return { ok: r.status === 0, status: r.status, tail: (r.stdout || r.stderr || "").split("\n").slice(-5).join("\n") };
}

async function main() {
  const ts = Date.now();
  const currentYear = new Date().getFullYear();
  const ids = {
    orgs: [],
    anfrageeingaenge: [],
    eingangsnummer_sequenzen: [],
    vorgangsnummer_sequenzen: [],
    sequenzKeys: new Set(),
    vorgaenge: [],
    beziehungen: [],
    einheiten: [],
    gebaeude: [],
    adressen: [],
    kunden: [],
    kundennummer_sequenzen: [],
    authUserId: null,
  };

  try {
    beforeSnap = await snapshotCounts();
    const orgA = await createOrg(ts, "a");
    const orgB = await createOrg(ts, "b");
    ids.orgs.push(orgA, orgB);
    const sd = await setupStammdaten(ts, orgA, orgB, ids);

    // T1–T3 Nummerierung (orgA, current year)
    const e1 = await readyPipeline(orgA, "t1", ts, ids, sd);
    const seqBefore = await getVorgangsSeq(orgA, currentYear);
    const { data: v1, error: v1Err } = await erstelle(service, orgA, e1, { p_titel: "T1 Minimal" });
    trackVorgang(ids, v1?.vorgang_id);
    const row1 = await fetchEingang(e1);
    record("T1", !v1Err && v1?.ok === true && v1?.code === "created", v1Err?.message ?? v1?.code);
    record(
      "T2",
      v1?.vorgangsnummer === expectedVorgangsnummer(currentYear, seqBefore + 1),
      v1?.vorgangsnummer,
    );

    const e2 = await readyPipeline(orgA, "t2", ts, ids, sd);
    const { data: v2 } = await erstelle(service, orgA, e2, { p_titel: "T2 Zweiter" });
    trackVorgang(ids, v2?.vorgang_id);
    record(
      "T3",
      v2?.vorgangsnummer === expectedVorgangsnummer(currentYear, seqBefore + 2),
      v2?.vorgangsnummer,
    );

    // T4 anderes Jahr
    const altYear = currentYear - 1;
    const e4 = await readyPipeline(orgA, "t4", ts, ids, sd, {
      createOverrides: { p_empfangen_am: `${altYear}-06-15T10:00:00.000Z` },
    });
    const seqAltBefore = await getVorgangsSeq(orgA, altYear);
    const { data: v4 } = await erstelle(service, orgA, e4, { p_titel: "T4 Altjahr" });
    trackVorgang(ids, v4?.vorgang_id);
    record(
      "T4",
      v4?.vorgangsnummer === expectedVorgangsnummer(altYear, seqAltBefore + 1),
      v4?.vorgangsnummer,
    );

    // T5 anderer Mandant
    const e5 = await readyPipeline(orgB, "t5", ts, ids, sd, {
      kundeId: sd.kB,
      gebaeudeId: sd.gebB,
    });
    const seqBBefore = await getVorgangsSeq(orgB, currentYear);
    const { data: v5 } = await erstelle(service, orgB, e5, { p_titel: "T5 Mandant B" });
    trackVorgang(ids, v5?.vorgang_id);
    record(
      "T5",
      v5?.vorgangsnummer === expectedVorgangsnummer(currentYear, seqBBefore + 1),
      v5?.vorgangsnummer,
    );

    record(
      "nummerierung",
      results.T2?.ok && results.T3?.ok && results.T4?.ok && results.T5?.ok,
      "T2–T5",
    );

    // T6–T9 Titel
    const e6 = await readyPipeline(orgA, "t6", ts, ids, sd);
    const { data: v6 } = await erstelle(service, orgA, e6, { p_titel: "Expliziter Titel T6" });
    trackVorgang(ids, v6?.vorgang_id);
    const vorg6 = await fetchVorgang(v6.vorgang_id);
    record("T6", vorg6.titel === "Expliziter Titel T6", vorg6.titel);

    const e7 = await readyPipeline(orgA, "t7", ts, ids, sd, {
      createOverrides: { p_betreff: null },
      bewOverrides: {
        p_strukturierte_daten: { felder: { anliegen: { wert: "Anliegen aus SD T7" } } },
      },
    });
    const { data: v7 } = await erstelle(service, orgA, e7);
    trackVorgang(ids, v7?.vorgang_id);
    const vorg7 = await fetchVorgang(v7.vorgang_id);
    record("T7", vorg7.titel === "Anliegen aus SD T7", vorg7.titel);

    const e8 = await readyPipeline(orgA, "t8", ts, ids, sd, {
      createOverrides: { p_betreff: "Betreff T8" },
      bewOverrides: { p_strukturierte_daten: { quelle: "test" } },
    });
    const { data: v8 } = await erstelle(service, orgA, e8);
    trackVorgang(ids, v8?.vorgang_id);
    const vorg8 = await fetchVorgang(v8.vorgang_id);
    record("T8", vorg8.titel === "Betreff T8", vorg8.titel);

    const e9 = await readyPipeline(orgA, "t9", ts, ids, sd, {
      createOverrides: { p_betreff: null },
      bewOverrides: { p_strukturierte_daten: { quelle: "test" } },
    });
    const { data: t9 } = await erstelle(service, orgA, e9);
    record(
      "T9",
      t9?.ok === false && t9?.code === "validation_error" && t9?.field === "titel",
      JSON.stringify(t9),
    );

    record("titelPrioritaet", results.T6?.ok && results.T7?.ok && results.T8?.ok && results.T9?.ok, "T6–T9");

    // T10–T11 Priorität
    const e10 = await readyPipeline(orgA, "t10", ts, ids, sd, {
      bewOverrides: { p_dringlichkeit: "niedrig" },
    });
    const { data: v10 } = await erstelle(service, orgA, e10, {
      p_titel: "T10 Priorität",
      p_prioritaet: "dringend",
    });
    trackVorgang(ids, v10?.vorgang_id);
    const vorg10 = await fetchVorgang(v10.vorgang_id);
    record("T10", vorg10.prioritaet === "dringend", vorg10.prioritaet);

    const e11 = await readyPipeline(orgA, "t11", ts, ids, sd, {
      bewOverrides: { p_dringlichkeit: "hoch" },
    });
    const { data: v11 } = await erstelle(service, orgA, e11, { p_titel: "T11 Priorität" });
    trackVorgang(ids, v11?.vorgang_id);
    const vorg11 = await fetchVorgang(v11.vorgang_id);
    record("T11", vorg11.prioritaet === "hoch", vorg11.prioritaet);

    // T12–T14 Beteiligte
    const e12 = await readyPipeline(orgA, "t12", ts, ids, sd);
    const { data: v12 } = await erstelle(service, orgA, e12, { p_titel: "T12 Minimalbeteiligter" });
    trackVorgang(ids, v12?.vorgang_id);
    const bet12 = await fetchBeteiligte(v12.vorgang_id);
    record(
      "T12",
      bet12.length === 1 &&
        bet12[0].kunde_id === sd.kA &&
        bet12[0].rolle === "anfragender" &&
        bet12[0].ist_hauptbeteiligter === true,
      JSON.stringify(bet12),
    );

    record(
      "T13",
      bet12.every((b) => !["auftraggeber", "rechnungsempfaenger"].includes(b.rolle)),
      `rollen=${bet12.map((b) => b.rolle).join(",")}`,
    );

    const e14 = await readyPipeline(orgA, "t14", ts, ids, sd);
    const customBeteiligte = [
      { kunde_id: sd.kA, rolle: "anfragender", ist_hauptbeteiligter: true },
      { kunde_id: sd.kA2, rolle: "ansprechpartner", ist_hauptbeteiligter: false, notizen: "Kontakt" },
    ];
    const { data: v14 } = await erstelle(service, orgA, e14, {
      p_titel: "T14 Custom",
      p_beteiligte: customBeteiligte,
    });
    trackVorgang(ids, v14?.vorgang_id);
    const bet14 = await fetchBeteiligte(v14.vorgang_id);
    record(
      "T14",
      bet14.length === 2 &&
        bet14.some((b) => b.rolle === "ansprechpartner" && b.kunde_id === sd.kA2),
      `count=${bet14.length}`,
    );

    // T15–T21 Beteiligten-Negativtests
    async function negBeteiligte(suffix, beteiligte, expect) {
      const eId = await readyPipeline(orgA, suffix, ts, ids, sd);
      const { data } = await erstelle(service, orgA, eId, {
        p_titel: `Neg ${suffix}`,
        p_beteiligte: beteiligte,
      });
      const row = await fetchEingang(eId);
      return {
        data,
        row,
        ok:
          data?.ok === false &&
          data?.code === expect.code &&
          (expect.field ? data?.field === expect.field : true) &&
          row.status === "bereit_fuer_vorgang" &&
          row.zugeordneter_vorgang_id === null,
      };
    }

    const t15 = await negBeteiligte(
      "t15",
      [{ kunde_id: sd.kA2, rolle: "anfragender", ist_hauptbeteiligter: true }],
      { code: "validation_error", field: "beteiligte" },
    );
    record("T15", t15.ok, JSON.stringify(t15.data));

    const t16 = await negBeteiligte(
      "t16",
      [{ kunde_id: sd.kA, rolle: "auftraggeber", ist_hauptbeteiligter: true }],
      { code: "validation_error", field: "beteiligte" },
    );
    record("T16", t16.ok, JSON.stringify(t16.data));

    const t17 = await negBeteiligte(
      "t17",
      [{ kunde_id: sd.kA, rolle: "anfragender", ist_hauptbeteiligter: false }],
      { code: "validation_error", field: "beteiligte" },
    );
    record("T17", t17.ok, JSON.stringify(t17.data));

    const t18 = await negBeteiligte(
      "t18",
      [
        { kunde_id: sd.kA, rolle: "anfragender", ist_hauptbeteiligter: true },
        { kunde_id: sd.kA, rolle: "anfragender", ist_hauptbeteiligter: false },
      ],
      { code: "conflict", field: "beteiligte" },
    );
    record("T18", t18.ok, JSON.stringify(t18.data));

    const t19 = await negBeteiligte(
      "t19",
      [
        { kunde_id: sd.kA, rolle: "anfragender", ist_hauptbeteiligter: true },
        { kunde_id: sd.kA2, rolle: "anfragender", ist_hauptbeteiligter: true },
      ],
      { code: "conflict", field: "beteiligte" },
    );
    record("T19", t19.ok, JSON.stringify(t19.data));

    const e20 = await readyPipeline(orgA, "t20", ts, ids, sd);
    const { data: t20 } = await erstelle(service, orgA, e20, {
      p_titel: "T20",
      p_beteiligte: [
        { kunde_id: sd.kB, rolle: "anfragender", ist_hauptbeteiligter: true },
        { kunde_id: sd.kA, rolle: "ansprechpartner", ist_hauptbeteiligter: false },
      ],
    });
    record(
      "T20",
      t20?.ok === false && t20?.code === "cross_tenant_reference" && t20?.field === "kunde_id",
      JSON.stringify(t20),
    );

    const e21 = await readyPipeline(orgA, "t21", ts, ids, sd);
    const { data: t21 } = await erstelle(service, orgA, e21, {
      p_titel: "T21",
      p_beteiligte: [
        { kunde_id: sd.kArch, rolle: "anfragender", ist_hauptbeteiligter: true },
        { kunde_id: sd.kA, rolle: "ansprechpartner", ist_hauptbeteiligter: false },
      ],
    });
    record(
      "T21",
      t21?.ok === false && t21?.code === "conflict" && t21?.field === "kunde_id",
      JSON.stringify(t21),
    );

    record(
      "beteiligte",
      results.T12?.ok &&
        results.T13?.ok &&
        results.T14?.ok &&
        results.T15?.ok &&
        results.T16?.ok &&
        results.T17?.ok &&
        results.T18?.ok &&
        results.T19?.ok &&
        results.T20?.ok &&
        results.T21?.ok,
      "T12–T21",
    );

    // T22 nicht bestätigt
    const e22 = await readyPipeline(orgA, "t22", ts, ids, sd, { skipBestaetige: true });
    const { data: t22 } = await erstelle(service, orgA, e22, { p_titel: "T22" });
    record(
      "T22",
      t22?.ok === false && t22?.code === "assignment_not_confirmed",
      JSON.stringify(t22),
    );

    // T23 unzureichende Vollständigkeit (direktes UPDATE)
    const e23 = await readyPipeline(orgA, "t23", ts, ids, sd);
    await service.from("anfrageeingaenge").update({ vollstaendigkeitsstatus: "unvollstaendig" }).eq("id", e23);
    const { data: t23 } = await erstelle(service, orgA, e23, { p_titel: "T23" });
    record(
      "T23",
      t23?.ok === false && t23?.code === "insufficient_data" && t23?.field === "vollstaendigkeitsstatus",
      JSON.stringify(t23),
    );

    // T24 falscher Status (direktes UPDATE)
    const e24 = await readyPipeline(orgA, "t24", ts, ids, sd);
    await service.from("anfrageeingaenge").update({ status: "analysiert" }).eq("id", e24);
    const { data: t24 } = await erstelle(service, orgA, e24, { p_titel: "T24" });
    record(
      "T24",
      t24?.ok === false && t24?.code === "invalid_status_transition" && t24?.field === "status",
      JSON.stringify(t24),
    );

    // T25 Idempotenz
    const e25 = await readyPipeline(orgA, "t25", ts, ids, sd);
    const seq25Before = await getVorgangsSeq(orgA, currentYear);
    const { data: c25a } = await erstelle(service, orgA, e25, { p_titel: "T25" });
    trackVorgang(ids, c25a?.vorgang_id);
    const bet25a = await fetchBeteiligte(c25a.vorgang_id);
    const { data: c25b } = await erstelle(service, orgA, e25, { p_titel: "T25 Replay" });
    const seq25After = await getVorgangsSeq(orgA, currentYear);
    const bet25b = await fetchBeteiligte(c25a.vorgang_id);
    record(
      "T25",
      c25a?.code === "created" &&
        c25b?.ok === true &&
        c25b?.code === "already_converted" &&
        c25b?.idempotent === true &&
        c25b?.vorgang_id === c25a?.vorgang_id &&
        c25b?.vorgangsnummer === c25a?.vorgangsnummer &&
        bet25a.length === bet25b.length &&
        seq25Before + 1 === seq25After,
      `seq ${seq25Before}→${seq25After}, bet=${bet25b.length}`,
    );
    record("idempotenz", results.T25?.ok, "T25");

    // T26 parallele identische Aufrufe
    const e26 = await readyPipeline(orgA, "t26", ts, ids, sd);
    const seq26Before = await getVorgangsSeq(orgA, currentYear);
    const [p26a, p26b] = await Promise.all([
      erstelle(service, orgA, e26, { p_titel: "T26a" }),
      erstelle(service, orgA, e26, { p_titel: "T26b" }),
    ]);
    trackVorgang(ids, p26a.data?.vorgang_id ?? p26b.data?.vorgang_id);
    const seq26After = await getVorgangsSeq(orgA, currentYear);
    const codes26 = [p26a.data?.code, p26b.data?.code].sort();
    const vorg26Id = p26a.data?.vorgang_id ?? p26b.data?.vorgang_id;
    const { count: vorgCount26 } = await service
      .from("vorgaenge")
      .select("*", { count: "exact", head: true })
      .eq("id", vorg26Id);
    const bet26 = vorg26Id ? await fetchBeteiligte(vorg26Id) : [];
    record(
      "T26",
      codes26.includes("created") &&
        codes26.includes("already_converted") &&
        p26a.data?.vorgang_id === p26b.data?.vorgang_id &&
        vorgCount26 === 1 &&
        bet26.length === 1 &&
        seq26After === seq26Before + 1,
      `codes=${codes26.join(",")}, seq=${seq26Before}→${seq26After}`,
    );

    // T27 mehrere Eingänge
    const e27a = await readyPipeline(orgA, "t27a", ts, ids, sd);
    const e27b = await readyPipeline(orgA, "t27b", ts, ids, sd);
    const { data: v27a } = await erstelle(service, orgA, e27a, { p_titel: "T27a" });
    const { data: v27b } = await erstelle(service, orgA, e27b, { p_titel: "T27b" });
    trackVorgang(ids, v27a?.vorgang_id);
    trackVorgang(ids, v27b?.vorgang_id);
    record(
      "T27",
      v27a?.vorgang_id && v27b?.vorgang_id && v27a.vorgang_id !== v27b.vorgang_id,
      `${v27a?.vorgangsnummer} vs ${v27b?.vorgangsnummer}`,
    );

    // T28 parallele verschiedene Eingänge
    const parIds = [];
    for (let i = 0; i < 4; i++) {
      parIds.push(await readyPipeline(orgA, `t28-${i}`, ts, ids, sd));
    }
    const seq28Before = await getVorgangsSeq(orgA, currentYear);
    const parResults = await Promise.all(
      parIds.map((id, i) => erstelle(service, orgA, id, { p_titel: `T28-${i}` })),
    );
    const seq28After = await getVorgangsSeq(orgA, currentYear);
    const nums28 = parResults.map((r) => r.data?.vorgangsnummer).filter(Boolean);
    const uniq28 = new Set(nums28);
    parResults.forEach((r) => trackVorgang(ids, r.data?.vorgang_id));
    record(
      "T28",
      parResults.every((r) => r.data?.code === "created") &&
        nums28.length === 4 &&
        uniq28.size === 4 &&
        seq28After === seq28Before + 4,
      `nums=${nums28.join(",")}, seq=${seq28Before}→${seq28After}`,
    );
    record(
      "parallelitaet",
      results.T26?.ok && results.T27?.ok && results.T28?.ok,
      "T26–T28",
    );

    // T29 Abschluss + T30 Daten erhalten
    const e29 = await readyPipeline(orgA, "t29", ts, ids, sd, {
      einheitId: sd.einA,
      bewOverrides: {
        p_strukturierte_daten: { marker: "t30", felder: { anliegen: { wert: "T29" } } },
        p_zuordnungsgrund: zweiMerkmaleGrund({ marker: "behalten" }),
        p_zuordnungskandidaten: [{ kunde_id: sd.kA, score: 0.9 }],
        p_fehlende_angaben: [],
        p_confidence_score: 0.88,
        p_dringlichkeit: "normal",
      },
    });
    const before29 = pickSnapshotFields(await fetchEingang(e29));
    const beforeTime = Date.now();
    const { data: v29 } = await erstelle(service, orgA, e29, { p_titel: "T29 Abschluss" });
    trackVorgang(ids, v29?.vorgang_id);
    const after29 = await fetchEingang(e29);
    record(
      "T29",
      after29.status === "in_vorgang_ueberfuehrt" &&
        after29.zugeordneter_vorgang_id === v29?.vorgang_id &&
        after29.beendet_am &&
        after29.zuletzt_bearbeitet_am &&
        new Date(after29.zuletzt_bearbeitet_am).getTime() >= beforeTime - 5000 &&
        after29.manuelle_pruefung_erforderlich === false,
      JSON.stringify({
        status: after29.status,
        vorgang: after29.zugeordneter_vorgang_id,
        beendet: !!after29.beendet_am,
      }),
    );

    const afterSnap29 = pickSnapshotFields(after29);
    const t30Ok = Object.keys(before29).every((k) => {
      const a = before29[k];
      const b = afterSnap29[k];
      return JSON.stringify(a) === JSON.stringify(b);
    });
    record("T30", t30Ok, t30Ok ? "unverändert" : JSON.stringify({ before29, afterSnap29 }));
    record("abschluss", results.T29?.ok && results.T30?.ok, "T29–T30");

    // T31–T32 Validierung
    const e31 = await readyPipeline(orgA, "t31", ts, ids, sd);
    const { data: t31 } = await erstelle(service, orgA, e31, {
      p_titel: "T31",
      p_vorgangstyp: "ungueltig",
    });
    record(
      "T31",
      t31?.ok === false && t31?.code === "validation_error" && t31?.field === "vorgangstyp",
      JSON.stringify(t31),
    );

    const e32 = await readyPipeline(orgA, "t32", ts, ids, sd);
    const { data: t32 } = await erstelle(service, orgA, e32, {
      p_titel: "T32",
      p_prioritaet: "sofort",
    });
    record(
      "T32",
      t32?.ok === false && t32?.code === "validation_error" && t32?.field === "prioritaet",
      JSON.stringify(t32),
    );

    // T33 Rollback / Sequenzschutz vor Vergabe
    const e33 = await readyPipeline(orgA, "t33", ts, ids, sd);
    const seq33Before = await getVorgangsSeq(orgA, currentYear);
    const { data: t33 } = await erstelle(service, orgA, e33, {
      p_titel: "T33",
      p_beteiligte: [{ kunde_id: sd.kA2, rolle: "anfragender", ist_hauptbeteiligter: true }],
    });
    const seq33After = await getVorgangsSeq(orgA, currentYear);
    const row33 = await fetchEingang(e33);
    const { count: vorgCount33 } = await service
      .from("vorgaenge")
      .select("*", { count: "exact", head: true })
      .eq("mandant_id", orgA)
      .like("titel", "T33");
    record(
      "T33",
      t33?.ok === false &&
        t33?.code === "validation_error" &&
        row33.status === "bereit_fuer_vorgang" &&
        row33.zugeordneter_vorgang_id === null &&
        seq33Before === seq33After &&
        (vorgCount33 ?? 0) === 0,
      `seq=${seq33Before}→${seq33After}, ${notes.rollbackGrenze}`,
    );
    record("rollback", results.T33?.ok, notes.rollbackGrenze);

    // T34–T36 Berechtigungen
    const ePerm = await readyPipeline(orgA, "tperm", ts, ids, sd);
    const email = `vorg-test-${ts}@example.com`;
    const password = `TestPass!${ts}`;
    const { data: authUser } = await service.auth.admin.createUser({
      email,
      password,
      email_confirm: true,
    });
    if (authUser?.user?.id) ids.authUserId = authUser.user.id;
    const { data: signIn } = await anon.auth.signInWithPassword({ email, password });
    const authed = createClient(url, anonKey, {
      global: { headers: { Authorization: `Bearer ${signIn?.session?.access_token}` } },
      auth: { persistSession: false, autoRefreshToken: false },
    });
    const { error: anonErr } = await erstelle(anon, orgA, ePerm, { p_titel: "perm" });
    const { error: authErr } = await erstelle(authed, orgA, ePerm, { p_titel: "perm" });
    const { data: svcPerm, error: svcPermErr } = await erstelle(service, orgA, ePerm, {
      p_titel: "perm svc",
    });
    trackVorgang(ids, svcPerm?.vorgang_id);
    record(
      "T34",
      !!anonErr && /permission denied|42501/i.test(anonErr.message ?? ""),
      anonErr?.code ?? anonErr?.message?.slice(0, 40),
    );
    record(
      "T35",
      !!authErr && /permission denied|42501/i.test(authErr.message ?? ""),
      authErr?.code ?? authErr?.message?.slice(0, 40),
    );
    record("T36", !svcPermErr && svcPerm?.ok === true && svcPerm?.code === "created", svcPerm?.code);
    record(
      "berechtigungen",
      results.T34?.ok && results.T35?.ok && results.T36?.ok,
      "anon/auth denied, svc ok",
    );
  } finally {
    await cleanup(ids);

    if (beforeSnap) {
      const afterSnap = await snapshotCounts();
      const details = Object.entries(beforeSnap)
        .map(([t, c]) => `${t}: ${c}→${afterSnap[t]}`)
        .join(", ");
      const bestandOk = Object.entries(beforeSnap).every(([t, c]) => afterSnap[t] === c);
      record("T37", bestandOk, details);
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
      .like("name", "__test_vorg_%");
    record("cleanup", (cOrg ?? 0) === 0, `orgs=${cOrg ?? 0}`);

    const regScripts = [
      "test-create-anfrageeingang-rpc.mjs",
      "test-update-anfrageeingang-bewertung-rpc.mjs",
      "test-bestaetige-anfrageeingang-zuordnung-rpc.mjs",
      "test-operative-anfrageeingang-migration.mjs",
      "test-anfrageeingang-nummernsequenzen-migration.mjs",
    ];
    const regResults = regScripts.map((s) => ({ script: s, ...runRegression(s) }));
    const regOk = regResults.every((r) => r.ok);
    record("regression", regOk, regResults.map((r) => `${r.script}:${r.status}`).join(", "));
    record("T38", (extra.cleanup?.ok ?? false) && regOk, `cleanup=${extra.cleanup?.ok}, reg=${regOk}`);
  }

  const problems = [];
  for (const [k, v] of Object.entries(results)) {
    if (v && !v.ok) problems.push(`${k}: ${v.detail}`);
  }
  for (const [k, v] of Object.entries(extra)) {
    if (v && !v.ok) problems.push(`${k}: ${v.detail}`);
  }

  console.log(JSON.stringify({ passed, notes, results, extra, problems }, null, 2));
  process.exit(passed ? 0 : 1);
}

main().catch((err) => {
  console.log(
    JSON.stringify({ passed: false, fatal: err.message, results, extra, problems: [err.message] }, null, 2),
  );
  process.exit(1);
});

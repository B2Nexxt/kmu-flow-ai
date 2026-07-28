/**
 * Integrationstest RPC public.ordne_anfrageeingang_vorgang_zu
 * Migration 20260717370000_ordne_anfrageeingang_vorgang_zu_rpc.sql
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
  Array.from({ length: 30 }, (_, i) => [`T${i + 1}`, null]),
);
const extra = {
  berechtigungen: null,
  bestandsschutz: null,
  adminSmoke: null,
  cleanup: null,
  regression: null,
};
const notes = {
  directUpdate:
    "T12–T14: Vorgangsstatus/archiviert per direktem UPDATE (kein RPC für abgeschlossen/abgebrochen/archiviert)",
  setup:
    "Vorgänge über erstelle_vorgang_aus_anfrageeingang; Eingänge über create_anfrageeingang (+ ggf. Bewertung/Bestätigung)",
};
let passed = true;
let beforeSnap = null;
let orphanBefore = null;

const REGRESSION_PREFIXES = {
  "test-create-anfrageeingang-rpc.mjs": "__test_rpc_ae_%",
  "test-update-anfrageeingang-bewertung-rpc.mjs": "__test_bew_%",
  "test-bestaetige-anfrageeingang-zuordnung-rpc.mjs": "__test_conf_%",
  "test-erstelle-vorgang-aus-anfrageeingang-rpc.mjs": "__test_vorg_%",
  "test-create-vorlaeufiger-kunde-mit-objekt-rpc.mjs": "__test_vlk_%",
};

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
    p_strukturierte_daten: { quelle: "test", marker: "ordne" },
    p_zuordnungsstatus: "eindeutig",
    p_zuordnungsgrund: zweiMerkmaleGrund(),
    p_zuordnungskandidaten: [{ kunde_id: null, score: 0.9 }],
    p_vollstaendigkeitsstatus: "vollstaendig",
    p_fehlende_angaben: [],
    p_confidence_score: 0.88,
    p_dringlichkeit: "hoch",
    p_manuelle_pruefung_erforderlich: false,
    ...overrides,
  };
}

async function createEingang(mandantId, suffix, ts, overrides = {}) {
  const { data, error } = await service.rpc("create_anfrageeingang", {
    p_mandant_id: mandantId,
    p_kanal: "email",
    p_rohinhalt: `ordne-test-${suffix}-${ts}`,
    ...overrides,
  });
  if (error) throw error;
  if (!data?.ok) throw new Error(`create fehlgeschlagen (${suffix}): ${JSON.stringify(data)}`);
  return data;
}

async function bewertung(mandantId, anfrageeingangId, overrides = {}) {
  const payload = baseBewertung(overrides);
  if (payload.p_zuordnungskandidaten?.[0]?.kunde_id === null) {
    delete payload.p_zuordnungskandidaten;
    payload.p_zuordnungskandidaten = [];
  }
  const { data, error } = await service.rpc("update_anfrageeingang_bewertung", {
    p_mandant_id: mandantId,
    p_anfrageeingang_id: anfrageeingangId,
    ...payload,
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
    p_bestaetigungsquelle: "test-ordne",
  });
  return { data, error };
}

async function erstelle(mandantId, anfrageeingangId, overrides = {}) {
  const { data, error } = await service.rpc("erstelle_vorgang_aus_anfrageeingang", {
    p_mandant_id: mandantId,
    p_anfrageeingang_id: anfrageeingangId,
    ...overrides,
  });
  return { data, error };
}

async function ordne(client, mandantId, anfrageeingangId, vorgangId) {
  const { data, error } = await client.rpc("ordne_anfrageeingang_vorgang_zu", {
    p_mandant_id: mandantId,
    p_anfrageeingang_id: anfrageeingangId,
    p_vorgang_id: vorgangId,
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

function uniqueIds(list) {
  return [...new Set(list.filter(Boolean))];
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

function trackKundennummerSeq(ids, mandantId) {
  if (!ids.kundennummer_sequenzen.some((r) => r.mandant_id === mandantId)) {
    ids.kundennummer_sequenzen.push({ mandant_id: mandantId });
  }
}

async function trackVorgang(ids, vorgangId) {
  if (!vorgangId || ids.vorgaenge.includes(vorgangId)) return;
  ids.vorgaenge.push(vorgangId);
  const bet = await fetchBeteiligte(vorgangId);
  for (const b of bet) {
    if (b.id && !ids.vorgang_beteiligte.includes(b.id)) ids.vorgang_beteiligte.push(b.id);
  }
}

function pickSnapshotFields(row) {
  return {
    strukturierte_daten: row.strukturierte_daten,
    zuordnungsstatus: row.zuordnungsstatus,
    zuordnungsgrund: row.zuordnungsgrund,
    zuordnungskandidaten: row.zuordnungskandidaten,
    vollstaendigkeitsstatus: row.vollstaendigkeitsstatus,
    fehlende_angaben: row.fehlende_angaben,
    confidence_score: row.confidence_score,
    dringlichkeit: row.dringlichkeit,
    zugeordnet_kunde_id: row.zugeordnet_kunde_id,
    zugeordnet_gebaeude_id: row.zugeordnet_gebaeude_id,
    zugeordnet_einheit_id: row.zugeordnet_einheit_id,
  };
}

async function countOrgsByPrefix(prefix) {
  const { count } = await service
    .from("organizations")
    .select("*", { count: "exact", head: true })
    .like("name", prefix);
  return count ?? 0;
}

async function countTestOrphans() {
  const { data: orgs } = await service
    .from("organizations")
    .select("id")
    .like("name", "__test_ordne_%");
  const orgIds = (orgs ?? []).map((o) => o.id);
  if (!orgIds.length) {
    return { orgs: 0, anfrageeingaenge: 0, vorgaenge: 0, vorgang_beteiligte: 0, sequenzen: 0, stammdaten: 0 };
  }
  const countFor = async (table) => {
    const { count } = await service
      .from(table)
      .select("*", { count: "exact", head: true })
      .in("mandant_id", orgIds);
    return count ?? 0;
  };
  const [ae, vorg, bet, vSeq, eSeq, bez, ein, geb, adr, kun, kSeq] = await Promise.all([
    countFor("anfrageeingaenge"),
    countFor("vorgaenge"),
    countFor("vorgang_beteiligte"),
    countFor("vorgangsnummer_sequenzen"),
    countFor("eingangsnummer_sequenzen"),
    countFor("kunden_objekt_beziehungen"),
    countFor("einheiten"),
    countFor("gebaeude"),
    countFor("adressen"),
    countFor("kunden"),
    countFor("kundennummer_sequenzen"),
  ]);
  return {
    orgs: orgIds.length,
    anfrageeingaenge: ae,
    vorgaenge: vorg,
    vorgang_beteiligte: bet,
    sequenzen: vSeq + eSeq + kSeq,
    stammdaten: bez + ein + geb + adr + kun,
    orgIds,
  };
}

async function deleteForMandants(mandantIds) {
  if (!mandantIds.length) return;
  await service.from("vorgang_beteiligte").delete().in("mandant_id", mandantIds);
  await service.from("anfrageeingaenge").delete().in("mandant_id", mandantIds);
  await service.from("vorgaenge").delete().in("mandant_id", mandantIds);
  await service.from("vorgangsnummer_sequenzen").delete().in("mandant_id", mandantIds);
  await service.from("eingangsnummer_sequenzen").delete().in("mandant_id", mandantIds);
  await service.from("kunden_objekt_beziehungen").delete().in("mandant_id", mandantIds);
  await service.from("einheiten").delete().in("mandant_id", mandantIds);
  await service.from("gebaeude").delete().in("mandant_id", mandantIds);
  await service.from("adressen").delete().in("mandant_id", mandantIds);
  await service.from("kunden").delete().in("mandant_id", mandantIds);
  await service.from("kundennummer_sequenzen").delete().in("mandant_id", mandantIds);
  await service.from("organizations").delete().in("id", mandantIds);
}

async function cleanupOrphans() {
  const orphan = await countTestOrphans();
  if (orphan.orgIds?.length) await deleteForMandants(orphan.orgIds);
  return orphan;
}

async function verifyCleanup(ids) {
  const mandantIds = uniqueIds(ids.orgs);
  const countFor = async (table) => {
    if (!mandantIds.length) return 0;
    const { count } = await service
      .from(table)
      .select("*", { count: "exact", head: true })
      .in("mandant_id", mandantIds);
    return count ?? 0;
  };
  const [bet, ae, vorg, vSeq, eSeq, bez, ein, geb, adr, kun, kSeq, orgs] = await Promise.all([
    countFor("vorgang_beteiligte"),
    countFor("anfrageeingaenge"),
    countFor("vorgaenge"),
    countFor("vorgangsnummer_sequenzen"),
    countFor("eingangsnummer_sequenzen"),
    countFor("kunden_objekt_beziehungen"),
    countFor("einheiten"),
    countFor("gebaeude"),
    countFor("adressen"),
    countFor("kunden"),
    countFor("kundennummer_sequenzen"),
    countOrgsByPrefix("__test_ordne_%"),
  ]);
  return {
    orgs,
    vorgang_beteiligte: bet,
    anfrageeingaenge: ae,
    vorgaenge: vorg,
    sequenzen: vSeq + eSeq + kSeq,
    stammdaten: bez + ein + geb + adr + kun,
  };
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

async function getVorgangsSeqRows(mandantId) {
  const { data } = await service
    .from("vorgangsnummer_sequenzen")
    .select("jahr, letzter_wert")
    .eq("mandant_id", mandantId);
  return (data ?? []).map((r) => `${r.jahr}:${r.letzter_wert}`).sort().join("|");
}

async function cleanup(ids) {
  const mandantIds = uniqueIds(ids.orgs);
  const vorgangIds = uniqueIds(ids.vorgaenge);
  const eingangIds = uniqueIds(ids.anfrageeingaenge);
  const beteiligteIds = uniqueIds(ids.vorgang_beteiligte);
  const beziehungIds = uniqueIds(ids.beziehungen);
  const einheitIds = uniqueIds(ids.einheiten);
  const gebaeudeIds = uniqueIds(ids.gebaeude);
  const adressenIds = uniqueIds(ids.adressen);
  const kundenIds = uniqueIds(ids.kunden);

  if (beteiligteIds.length) await service.from("vorgang_beteiligte").delete().in("id", beteiligteIds);
  if (vorgangIds.length) await service.from("vorgang_beteiligte").delete().in("vorgang_id", vorgangIds);
  if (mandantIds.length) await service.from("vorgang_beteiligte").delete().in("mandant_id", mandantIds);

  if (eingangIds.length) await service.from("anfrageeingaenge").delete().in("id", eingangIds);
  if (mandantIds.length) await service.from("anfrageeingaenge").delete().in("mandant_id", mandantIds);

  if (vorgangIds.length) await service.from("vorgaenge").delete().in("id", vorgangIds);
  if (mandantIds.length) await service.from("vorgaenge").delete().in("mandant_id", mandantIds);

  if (mandantIds.length) {
    await service.from("vorgangsnummer_sequenzen").delete().in("mandant_id", mandantIds);
    await service.from("eingangsnummer_sequenzen").delete().in("mandant_id", mandantIds);
  }

  if (beziehungIds.length) await service.from("kunden_objekt_beziehungen").delete().in("id", beziehungIds);
  if (mandantIds.length) await service.from("kunden_objekt_beziehungen").delete().in("mandant_id", mandantIds);

  if (einheitIds.length) await service.from("einheiten").delete().in("id", einheitIds);
  if (gebaeudeIds.length) await service.from("gebaeude").delete().in("id", gebaeudeIds);
  if (adressenIds.length) await service.from("adressen").delete().in("id", adressenIds);
  if (kundenIds.length) await service.from("kunden").delete().in("id", kundenIds);
  if (mandantIds.length) {
    await service.from("einheiten").delete().in("mandant_id", mandantIds);
    await service.from("gebaeude").delete().in("mandant_id", mandantIds);
    await service.from("adressen").delete().in("mandant_id", mandantIds);
    await service.from("kunden").delete().in("mandant_id", mandantIds);
  }

  if (mandantIds.length) await service.from("kundennummer_sequenzen").delete().in("mandant_id", mandantIds);
  if (mandantIds.length) await service.from("organizations").delete().in("id", mandantIds);
  if (ids.authUserId) await service.auth.admin.deleteUser(ids.authUserId);
}

async function createOrg(ts, suffix) {
  const { data, error } = await service
    .from("organizations")
    .insert({ name: `__test_ordne_${suffix}_${ts}`, status: "interessent" })
    .select("id")
    .single();
  if (error) throw error;
  return data.id;
}

async function setupStammdaten(ts, orgA, orgB, ids) {
  const insKunde = (mid, num, name) =>
    service
      .from("kunden")
      .insert({
        mandant_id: mid,
        kundennummer: num,
        kundentyp: "privatperson",
        vorname: name,
        nachname: "Test",
        anzeigename: `${name} Test`,
      })
      .select("id")
      .single();

  const { data: kA } = await insKunde(orgA, `ORD-KA-${ts}`, "Aktiv");
  const { data: kB } = await insKunde(orgB, `ORD-KB-${ts}`, "Fremd");
  ids.kunden.push(kA.id, kB.id);
  trackKundennummerSeq(ids, orgA);
  trackKundennummerSeq(ids, orgB);

  const insAdr = (mid, n) =>
    service
      .from("adressen")
      .insert({
        mandant_id: mid,
        strasse: "Ordstr.",
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
  const { data: gebA2 } = await insGeb(orgA, adrA.id);
  const { data: gebB } = await insGeb(orgB, adrB.id);
  ids.gebaeude.push(gebA.id, gebA2.id, gebB.id);

  const { data: einA } = await service
    .from("einheiten")
    .insert({
      mandant_id: orgA,
      gebaeude_id: gebA.id,
      bezeichnung: `WhgA-${ts}`,
      einheit_typ: "wohnung",
    })
    .select("id")
    .single();
  const { data: einA2 } = await service
    .from("einheiten")
    .insert({
      mandant_id: orgA,
      gebaeude_id: gebA.id,
      bezeichnung: `WhgA2-${ts}`,
      einheit_typ: "wohnung",
    })
    .select("id")
    .single();
  ids.einheiten.push(einA.id, einA2.id);

  return { kA: kA.id, kB: kB.id, gebA: gebA.id, gebA2: gebA2.id, gebB: gebB.id, einA: einA.id, einA2: einA2.id };
}

async function trackRawEingang(mandantId, suffix, ts, ids, overrides = {}) {
  const e = await createEingang(mandantId, suffix, ts, overrides);
  ids.anfrageeingaenge.push(e.anfrageeingang_id);
  const row = await fetchEingang(e.anfrageeingang_id);
  trackEingangSeq(ids, mandantId, new Date(row.empfangen_am).getFullYear());
  return e.anfrageeingang_id;
}

async function readyForVorgang(mandantId, suffix, ts, ids, sd, opts = {}) {
  const eingangId = await trackRawEingang(mandantId, suffix, ts, ids, opts.createOverrides ?? {});
  const { data: bData, error: bErr } = await bewertung(
    mandantId,
    eingangId,
    opts.bewOverrides ?? {},
  );
  if (bErr) throw bErr;
  if (!bData?.ok) throw new Error(`bewertung (${suffix}): ${JSON.stringify(bData)}`);
  const { data: cData, error: cErr } = await bestaetige(
    mandantId,
    eingangId,
    opts.kundeId ?? sd.kA,
    opts.gebaeudeId ?? sd.gebA,
    opts.einheitId ?? null,
  );
  if (cErr) throw cErr;
  if (cData?.code !== "confirmed") throw new Error(`bestaetige (${suffix}): ${JSON.stringify(cData)}`);
  const row = await fetchEingang(eingangId);
  trackVorgangSeq(ids, mandantId, new Date(row.empfangen_am).getFullYear());
  return eingangId;
}

async function createVorgang(mandantId, suffix, ts, ids, sd, opts = {}) {
  const eingangId = await readyForVorgang(mandantId, suffix, ts, ids, sd, opts);
  const { data, error } = await erstelle(mandantId, eingangId, {
    p_titel: `Vorgang ${suffix}`,
    ...opts.erstelleOverrides,
  });
  if (error) throw error;
  if (!data?.ok) throw new Error(`erstelle (${suffix}): ${JSON.stringify(data)}`);
  await trackVorgang(ids, data.vorgang_id);
  return { eingangId, vorgangId: data.vorgang_id, vorgangsnummer: data.vorgangsnummer };
}

async function prepareEingangStatus(mandantId, suffix, ts, ids, sd, targetStatus) {
  const eingangId = await trackRawEingang(mandantId, suffix, ts, ids);
  if (targetStatus === "neu") return eingangId;

  if (targetStatus === "analysiert") {
    const { data, error } = await bewertung(mandantId, eingangId);
    if (error) throw error;
    if (!data?.ok) throw new Error(`bew analysiert (${suffix}): ${JSON.stringify(data)}`);
    return eingangId;
  }

  if (targetStatus === "zur_manuellen_pruefung") {
    const { data, error } = await bewertung(mandantId, eingangId, {
      p_zuordnungsstatus: "mehrere_treffer",
      p_zuordnungskandidaten: [{ kunde_id: sd.kA, score: 0.5 }],
    });
    if (error) throw error;
    if (!data?.ok) throw new Error(`bew manuell (${suffix}): ${JSON.stringify(data)}`);
    return eingangId;
  }

  if (targetStatus === "wartet_auf_informationen") {
    const { data: bData, error: bErr } = await bewertung(mandantId, eingangId, {
      p_vollstaendigkeitsstatus: "unvollstaendig",
      p_fehlende_angaben: ["telefon"],
    });
    if (bErr) throw bErr;
    if (!bData?.ok) throw new Error(`bew wartet (${suffix}): ${JSON.stringify(bData)}`);
    const { data: cData, error: cErr } = await bestaetige(mandantId, eingangId, sd.kA, sd.gebA);
    if (cErr) throw cErr;
    if (cData?.code !== "confirmed") throw new Error(`best wartet (${suffix}): ${JSON.stringify(cData)}`);
    return eingangId;
  }

  if (targetStatus === "bereit_fuer_vorgang") {
    const { data: bData, error: bErr } = await bewertung(mandantId, eingangId);
    if (bErr) throw bErr;
    if (!bData?.ok) throw new Error(`bew bereit (${suffix}): ${JSON.stringify(bData)}`);
    const { data: cData, error: cErr } = await bestaetige(mandantId, eingangId, sd.kA, sd.gebA);
    if (cErr) throw cErr;
    if (cData?.code !== "confirmed") throw new Error(`best bereit (${suffix}): ${JSON.stringify(cData)}`);
    return eingangId;
  }

  throw new Error(`Unbekannter Zielstatus: ${targetStatus}`);
}

async function bestaetigeEingang(mandantId, eingangId, sd, opts = {}) {
  const { data: bData, error: bErr } = await bewertung(mandantId, eingangId, opts.bewOverrides ?? {});
  if (bErr) throw bErr;
  if (!bData?.ok) throw new Error(`bew: ${JSON.stringify(bData)}`);
  const { data: cData, error: cErr } = await bestaetige(
    mandantId,
    eingangId,
    opts.kundeId ?? sd.kA,
    opts.gebaeudeId ?? sd.gebA,
    opts.einheitId ?? null,
  );
  if (cErr) throw cErr;
  if (cData?.code !== "confirmed") throw new Error(`best: ${JSON.stringify(cData)}`);
}

function runRegression(script) {
  const r = spawnSync("node", [join(root, "scripts", script)], {
    cwd: root,
    encoding: "utf8",
    env: process.env,
  });
  return { ok: r.status === 0, status: r.status };
}

async function main() {
  const ts = Date.now();
  const ids = {
    orgs: [],
    anfrageeingaenge: [],
    eingangsnummer_sequenzen: [],
    vorgangsnummer_sequenzen: [],
    sequenzKeys: new Set(),
    vorgaenge: [],
    vorgang_beteiligte: [],
    beziehungen: [],
    einheiten: [],
    gebaeude: [],
    adressen: [],
    kunden: [],
    kundennummer_sequenzen: [],
    authUserId: null,
  };

  try {
    orphanBefore = await cleanupOrphans();
    beforeSnap = await snapshotCounts();

    const orgA = await createOrg(ts, "a");
    const orgB = await createOrg(ts, "b");
    ids.orgs.push(orgA, orgB);
    const sd = await setupStammdaten(ts, orgA, orgB, ids);

    const baseVorg = await createVorgang(orgA, "base", ts, ids, sd, {
      erstelleOverrides: { p_titel: "Basis-Vorgang" },
      einheitId: sd.einA,
    });

    // T1–T6: Happy path auf neuem Eingang
    const eMain = await trackRawEingang(orgA, "t1-main", ts, ids);
    const beforeAssign = Date.now();
    const { data: assignMain, error: assignErr } = await ordne(service, orgA, eMain, baseVorg.vorgangId);
    if (assignErr) throw assignErr;
    const afterMain = await fetchEingang(eMain);

    record(
      "T1",
      assignMain?.ok === true && assignMain?.code === "assigned" && assignMain?.vorgang_id === baseVorg.vorgangId,
      assignMain?.code ?? "error",
    );
    record("T2", afterMain.status === "in_vorgang_ueberfuehrt", afterMain.status);
    record(
      "T3",
      afterMain.zugeordneter_vorgang_id === baseVorg.vorgangId,
      String(afterMain.zugeordneter_vorgang_id),
    );
    record("T4", !!afterMain.beendet_am, afterMain.beendet_am ?? "null");
    record(
      "T5",
      !!afterMain.zuletzt_bearbeitet_am &&
        new Date(afterMain.zuletzt_bearbeitet_am).getTime() >= beforeAssign - 5000,
      afterMain.zuletzt_bearbeitet_am ?? "null",
    );
    record("T6", afterMain.manuelle_pruefung_erforderlich === false, String(afterMain.manuelle_pruefung_erforderlich));

    const betBeforeOrdne = (await fetchBeteiligte(baseVorg.vorgangId)).length;

    // T7–T11: Erlaubte Eingangsstatus
    for (const [idx, status] of [
      ["T7", "neu"],
      ["T8", "analysiert"],
      ["T9", "wartet_auf_informationen"],
      ["T10", "zur_manuellen_pruefung"],
      ["T11", "bereit_fuer_vorgang"],
    ]) {
      const v = await createVorgang(orgA, `st-${status}`, ts, ids, sd);
      const eId = await prepareEingangStatus(orgA, `${idx}-${status}`, ts, ids, sd, status);
      const rowBefore = await fetchEingang(eId);
      const { data } = await ordne(service, orgA, eId, v.vorgangId);
      const rowAfter = await fetchEingang(eId);
      record(
        idx,
        data?.ok === true &&
          data?.code === "assigned" &&
          rowBefore.status === status &&
          rowAfter.status === "in_vorgang_ueberfuehrt",
        `${status}→${data?.code}`,
      );
    }

    // T12: abgeschlossener Vorgang
    const vAbgeschl = await createVorgang(orgA, "t12-v", ts, ids, sd);
    await service
      .from("vorgaenge")
      .update({ status: "abgeschlossen", beendet_am: new Date().toISOString() })
      .eq("id", vAbgeschl.vorgangId);
    const e12 = await trackRawEingang(orgA, "t12-e", ts, ids);
    const { data: d12 } = await ordne(service, orgA, e12, vAbgeschl.vorgangId);
    record("T12", d12?.ok === true && d12?.code === "assigned", JSON.stringify(d12));

    // T13–T14: abgebrochen / archiviert
    const vAbbr = await createVorgang(orgA, "t13-v", ts, ids, sd);
    await service
      .from("vorgaenge")
      .update({ status: "abgebrochen", beendet_am: new Date().toISOString() })
      .eq("id", vAbbr.vorgangId);
    const e13 = await trackRawEingang(orgA, "t13-e", ts, ids);
    const { data: d13 } = await ordne(service, orgA, e13, vAbbr.vorgangId);
    record(
      "T13",
      d13?.ok === false && d13?.code === "conflict" && d13?.field === "vorgang_id",
      JSON.stringify(d13),
    );

    const vArch = await createVorgang(orgA, "t14-v", ts, ids, sd);
    await service
      .from("vorgaenge")
      .update({ aktiv: false, archiviert_am: new Date().toISOString() })
      .eq("id", vArch.vorgangId);
    const e14 = await trackRawEingang(orgA, "t14-e", ts, ids);
    const { data: d14 } = await ordne(service, orgA, e14, vArch.vorgangId);
    record(
      "T14",
      d14?.ok === false && d14?.code === "conflict" && d14?.field === "vorgang_id",
      JSON.stringify(d14),
    );

    // T15–T17: not_found / cross_tenant
    const e15 = await trackRawEingang(orgA, "t15-e", ts, ids);
    const fakeVorg = "00000000-0000-4000-8000-000000000099";
    const { data: d15 } = await ordne(service, orgA, e15, fakeVorg);
    record(
      "T15",
      d15?.ok === false && d15?.code === "not_found" && d15?.field === "vorgang_id",
      JSON.stringify(d15),
    );

    const vB = await createVorgang(orgB, "t16-v", ts, ids, sd, { kundeId: sd.kB, gebaeudeId: sd.gebB });
    const e16 = await trackRawEingang(orgA, "t16-e", ts, ids);
    const { data: d16 } = await ordne(service, orgA, e16, vB.vorgangId);
    record(
      "T16",
      d16?.ok === false && d16?.code === "cross_tenant_reference" && d16?.field === "vorgang_id",
      JSON.stringify(d16),
    );

    const e17 = await trackRawEingang(orgA, "t17-e", ts, ids);
    const { data: d17 } = await ordne(service, orgB, e17, vB.vorgangId);
    record(
      "T17",
      d17?.ok === false && d17?.code === "cross_tenant_reference" && d17?.field === "anfrageeingang_id",
      JSON.stringify(d17),
    );

    // T18: passender Objektkontext
    const v18 = await createVorgang(orgA, "t18-v", ts, ids, sd, { einheitId: sd.einA });
    const e18 = await trackRawEingang(orgA, "t18-e", ts, ids);
    await bestaetigeEingang(orgA, e18, sd, { gebaeudeId: sd.gebA, einheitId: sd.einA });
    const { data: d18 } = await ordne(service, orgA, e18, v18.vorgangId);
    record("T18", d18?.ok === true && d18?.code === "assigned", JSON.stringify(d18));

    // T19: Gebäudeabweichung
    const v19 = await createVorgang(orgA, "t19-v", ts, ids, sd);
    const e19 = await trackRawEingang(orgA, "t19-e", ts, ids);
    await bestaetigeEingang(orgA, e19, sd, { gebaeudeId: sd.gebA2 });
    const { data: d19 } = await ordne(service, orgA, e19, v19.vorgangId);
    record(
      "T19",
      d19?.ok === false && d19?.code === "conflict" && d19?.field === "objektkontext",
      JSON.stringify(d19),
    );

    // T20: Einheitenabweichung
    const v20 = await createVorgang(orgA, "t20-v", ts, ids, sd, { einheitId: sd.einA });
    const e20 = await trackRawEingang(orgA, "t20-e", ts, ids);
    await bestaetigeEingang(orgA, e20, sd, { gebaeudeId: sd.gebA, einheitId: sd.einA2 });
    const { data: d20 } = await ordne(service, orgA, e20, v20.vorgangId);
    record(
      "T20",
      d20?.ok === false && d20?.code === "conflict" && d20?.field === "objektkontext",
      JSON.stringify(d20),
    );

    // T21–T22: ohne finale Zuordnung
    const v21 = await createVorgang(orgA, "t21-v", ts, ids, sd);
    const e21 = await trackRawEingang(orgA, "t21-e", ts, ids);
    const { data: b21 } = await bewertung(orgA, e21, {
      p_strukturierte_daten: { marker: "t21-ohne-fk" },
      p_zuordnungsstatus: "kein_treffer",
    });
    if (!b21?.ok) throw new Error(`T21 bewertung: ${JSON.stringify(b21)}`);
    const snap21 = pickSnapshotFields(await fetchEingang(e21));
    const { data: d21 } = await ordne(service, orgA, e21, v21.vorgangId);
    const after21 = pickSnapshotFields(await fetchEingang(e21));
    const fkUnchanged =
      snap21.zuordnungsstatus === after21.zuordnungsstatus &&
      snap21.zugeordnet_kunde_id === after21.zugeordnet_kunde_id &&
      snap21.zugeordnet_gebaeude_id === after21.zugeordnet_gebaeude_id &&
      snap21.zugeordnet_einheit_id === after21.zugeordnet_einheit_id;
    record("T21", d21?.ok === true && d21?.code === "assigned", JSON.stringify(d21));
    record("T22", fkUnchanged, fkUnchanged ? "FKs unverändert" : JSON.stringify({ snap21, after21 }));

    // T23–T24: Idempotenz
    const v23 = await createVorgang(orgA, "t23-v", ts, ids, sd);
    const v23b = await createVorgang(orgA, "t23b-v", ts, ids, sd);
    const e23 = await trackRawEingang(orgA, "t23-e", ts, ids);
    const { data: first23 } = await ordne(service, orgA, e23, v23.vorgangId);
    const snap23 = await fetchEingang(e23);
    const { data: replay23 } = await ordne(service, orgA, e23, v23.vorgangId);
    const snap23b = await fetchEingang(e23);
    record(
      "T23",
      first23?.code === "assigned" &&
        replay23?.ok === true &&
        replay23?.code === "already_converted" &&
        replay23?.idempotent === true &&
        replay23?.vorgang_id === v23.vorgangId &&
        replay23?.vorgangsnummer === v23.vorgangsnummer &&
        JSON.stringify(pickSnapshotFields(snap23)) === JSON.stringify(pickSnapshotFields(snap23b)),
      replay23?.code,
    );

    const { data: conflict24 } = await ordne(service, orgA, e23, v23b.vorgangId);
    record(
      "T24",
      conflict24?.ok === false &&
        conflict24?.code === "conflict" &&
        conflict24?.field === "zugeordneter_vorgang_id",
      JSON.stringify(conflict24),
    );

    // T25: parallele identische Aufrufe
    const v25 = await createVorgang(orgA, "t25-v", ts, ids, sd);
    const e25 = await trackRawEingang(orgA, "t25-e", ts, ids);
    const [p25a, p25b] = await Promise.all([
      ordne(service, orgA, e25, v25.vorgangId),
      ordne(service, orgA, e25, v25.vorgangId),
    ]);
    const codes25 = [p25a.data?.code, p25b.data?.code].sort();
    const end25 = await fetchEingang(e25);
    record(
      "T25",
      codes25.includes("assigned") &&
        codes25.includes("already_converted") &&
        end25.zugeordneter_vorgang_id === v25.vorgangId &&
        p25a.data?.vorgang_id === p25b.data?.vorgang_id,
      `codes=${codes25.join(",")}`,
    );

    // T26: parallele unterschiedliche Vorgänge
    const v26a = await createVorgang(orgA, "t26a-v", ts, ids, sd);
    const v26b = await createVorgang(orgA, "t26b-v", ts, ids, sd);
    const e26 = await trackRawEingang(orgA, "t26-e", ts, ids);
    const [p26a, p26b] = await Promise.all([
      ordne(service, orgA, e26, v26a.vorgangId),
      ordne(service, orgA, e26, v26b.vorgangId),
    ]);
    const codes26 = [p26a.data?.code, p26b.data?.code].sort();
    const winner26 = p26a.data?.code === "assigned" ? p26a.data?.vorgang_id : p26b.data?.vorgang_id;
    const end26 = await fetchEingang(e26);
    record(
      "T26",
      codes26.includes("assigned") &&
        codes26.includes("conflict") &&
        end26.zugeordneter_vorgang_id === winner26 &&
        (end26.zugeordneter_vorgang_id === v26a.vorgangId || end26.zugeordneter_vorgang_id === v26b.vorgangId),
      `codes=${codes26.join(",")}, winner=${winner26}`,
    );

    // T27: Bewertungsdaten unverändert
    const v27 = await createVorgang(orgA, "t27-v", ts, ids, sd);
    const e27 = await trackRawEingang(orgA, "t27-e", ts, ids);
    await bewertung(orgA, e27, {
      p_strukturierte_daten: { marker: "t27", felder: { anliegen: { wert: "Behalten" } } },
      p_zuordnungsstatus: "moeglicher_treffer",
      p_zuordnungsgrund: zweiMerkmaleGrund({ marker: "keep" }),
      p_zuordnungskandidaten: [{ kunde_id: sd.kA, score: 0.7 }],
      p_vollstaendigkeitsstatus: "ausreichend_fuer_vorgang",
      p_fehlende_angaben: ["plz"],
      p_confidence_score: 0.77,
      p_dringlichkeit: "dringend",
    });
    const before27 = pickSnapshotFields(await fetchEingang(e27));
    await ordne(service, orgA, e27, v27.vorgangId);
    const after27 = pickSnapshotFields(await fetchEingang(e27));
    const t27Ok = Object.keys(before27).every(
      (k) => JSON.stringify(before27[k]) === JSON.stringify(after27[k]),
    );
    record("T27", t27Ok, t27Ok ? "unverändert" : JSON.stringify({ before27, after27 }));

    // T28: ordne ändert vorgangsnummer_sequenzen nicht (erstelle darf Sequenz erhöhen)
    const v28a = await createVorgang(orgA, "t28a-v", ts, ids, sd);
    const v28b = await createVorgang(orgA, "t28b-v", ts, ids, sd);
    const seqAfterErstelle = await getVorgangsSeqRows(orgA);
    const e28a = await trackRawEingang(orgA, "t28a-e", ts, ids);
    const e28b = await trackRawEingang(orgA, "t28b-e", ts, ids);
    await ordne(service, orgA, e28a, v28a.vorgangId);
    await ordne(service, orgA, e28b, v28b.vorgangId);
    const seqAfterOrdneOnly = await getVorgangsSeqRows(orgA);
    record("T28", seqAfterErstelle === seqAfterOrdneOnly, `${seqAfterErstelle}→${seqAfterOrdneOnly}`);

    const betAfterOrdne = (await fetchBeteiligte(baseVorg.vorgangId)).length;
    record("T29", betBeforeOrdne === betAfterOrdne, `${betBeforeOrdne}→${betAfterOrdne}`);

    // T30: Berechtigungen (Teil 1 — anon/auth/svc)
    const ePerm = await trackRawEingang(orgA, "t30-e", ts, ids);
    const { error: anonErr } = await ordne(anon, orgA, ePerm, baseVorg.vorgangId);
    const email = `ordne-test-${ts}@example.com`;
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
    const { error: authErr } = await ordne(authed, orgA, ePerm, baseVorg.vorgangId);
    const { data: svcPerm, error: svcErr } = await ordne(service, orgA, ePerm, baseVorg.vorgangId);
    record(
      "T30",
      !!anonErr &&
        /permission denied|42501/i.test(anonErr.message ?? "") &&
        !!authErr &&
        /permission denied|42501/i.test(authErr.message ?? "") &&
        !svcErr &&
        svcPerm?.ok === true &&
        svcPerm?.code === "assigned",
      `anon=${anonErr?.code ?? "ok"}, auth=${authErr?.code ?? "ok"}, svc=${svcPerm?.code}`,
    );
    record(
      "berechtigungen",
      results.T30?.ok,
      "anon/auth denied, service_role assigned",
    );
  } finally {
    await cleanup(ids);
    await cleanupOrphans();
    const cleanupVerify = await verifyCleanup(ids);

    if (beforeSnap) {
      const afterSnap = await snapshotCounts();
      const details = Object.entries(beforeSnap)
        .map(([t, c]) => `${t}: ${c}→${afterSnap[t]}`)
        .join(", ");
      const bestandOk = Object.entries(beforeSnap).every(([t, c]) => afterSnap[t] === c);
      record("bestandsschutz", bestandOk, details);
      record(
        "adminSmoke",
        afterSnap.organizations === beforeSnap.organizations &&
          afterSnap.angebote === beforeSnap.angebote,
        `organizations ${beforeSnap.organizations}→${afterSnap.organizations}, angebote ${beforeSnap.angebote}→${afterSnap.angebote}`,
      );

      const cleanupOk =
        cleanupVerify.orgs === 0 &&
        cleanupVerify.vorgang_beteiligte === 0 &&
        cleanupVerify.anfrageeingaenge === 0 &&
        cleanupVerify.vorgaenge === 0 &&
        cleanupVerify.sequenzen === 0 &&
        cleanupVerify.stammdaten === 0;
      record(
        "cleanup",
        cleanupOk,
        `orgs=${cleanupVerify.orgs}, bet=${cleanupVerify.vorgang_beteiligte}, ae=${cleanupVerify.anfrageeingaenge}, vorg=${cleanupVerify.vorgaenge}, seq=${cleanupVerify.sequenzen}, stamm=${cleanupVerify.stammdaten}`,
      );

      const t30Full =
        (results.T30?.ok ?? false) &&
        bestandOk &&
        cleanupOk;
      if (results.T30 && !t30Full) {
        results.T30 = {
          ok: false,
          detail: `${results.T30.detail}; bestand/cleanup=${bestandOk}/${cleanupOk}`,
        };
        passed = false;
      } else if (results.T30) {
        results.T30 = {
          ok: t30Full,
          detail: `${results.T30.detail}; bestand=${bestandOk}, cleanup=${cleanupOk}`,
        };
      }
    }

    const regScripts = [
      "test-create-anfrageeingang-rpc.mjs",
      "test-update-anfrageeingang-bewertung-rpc.mjs",
      "test-bestaetige-anfrageeingang-zuordnung-rpc.mjs",
      "test-erstelle-vorgang-aus-anfrageeingang-rpc.mjs",
      "test-create-vorlaeufiger-kunde-mit-objekt-rpc.mjs",
    ];
    if (process.env.SKIP_REGRESSION === "1") {
      record("regression", true, "skipped (SKIP_REGRESSION=1)");
    } else {
    const regResults = [];
    for (const script of regScripts) {
      const result = runRegression(script);
      const prefix = REGRESSION_PREFIXES[script];
      const leftoverOrgs = prefix ? await countOrgsByPrefix(prefix) : 0;
      regResults.push({ script, ...result, leftoverOrgs, cleanupOk: leftoverOrgs === 0 });
    }
    const regOk = regResults.every((r) => r.ok && r.cleanupOk);
    record(
      "regression",
      regOk,
      regResults
        .map((r) => `${r.script}:${r.status}${r.cleanupOk ? "" : `(orgs=${r.leftoverOrgs})`}`)
        .join(", "),
    );
    if (results.T30?.ok && !regOk) {
      results.T30 = { ok: false, detail: `${results.T30.detail}; regression=${regOk}` };
      passed = false;
    }
    }
  }

  const problems = [];
  for (const [k, v] of Object.entries(results)) {
    if (v && !v.ok) problems.push(`${k}: ${v.detail}`);
  }
  for (const [k, v] of Object.entries(extra)) {
    if (v && !v.ok) problems.push(`${k}: ${v.detail}`);
  }

  console.log(
    JSON.stringify({ passed, notes, orphanBefore, results, extra, problems }, null, 2),
  );
  process.exit(passed ? 0 : 1);
}

main().catch((err) => {
  console.log(
    JSON.stringify({ passed: false, fatal: err.message, results, extra, problems: [err.message] }, null, 2),
  );
  process.exit(1);
});

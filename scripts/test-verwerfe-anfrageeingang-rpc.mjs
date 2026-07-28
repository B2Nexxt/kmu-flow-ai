/**
 * Integrationstest RPC public.verwerfe_anfrageeingang
 * Migration 20260717380000_verwerfe_anfrageeingang_rpc.sql
 */
import { readFileSync, existsSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import { spawnSync } from "node:child_process";
import { createClient } from "@supabase/supabase-js";

const __dirname = dirname(fileURLToPath(import.meta.url));
const root = join(__dirname, "..");

const GLOBAL_TIMEOUT_MS = 10 * 60 * 1000;
const REGRESSION_TIMEOUT_MS = 120 * 1000;
let currentPhase = "boot";
let globalTimeoutHandle = null;

function setPhase(phase) {
  currentPhase = phase;
  console.log(`[PHASE] ${phase}`);
}

function logPhaseDone(phase) {
  console.log(`[PHASE] ${phase} done`);
}

function failGlobalTimeout() {
  console.log(
    JSON.stringify(
      {
        passed: false,
        fatal: "global_timeout",
        lastPhase: currentPhase,
        timeoutMs: GLOBAL_TIMEOUT_MS,
      },
      null,
      2,
    ),
  );
  process.exit(1);
}

process.on("unhandledRejection", (reason) => {
  const message = reason instanceof Error ? reason.message : String(reason);
  console.log(
    JSON.stringify(
      { passed: false, fatal: "unhandledRejection", lastPhase: currentPhase, message },
      null,
      2,
    ),
  );
  process.exit(1);
});

process.on("uncaughtException", (err) => {
  console.log(
    JSON.stringify(
      {
        passed: false,
        fatal: "uncaughtException",
        lastPhase: currentPhase,
        message: err?.message ?? String(err),
      },
      null,
      2,
    ),
  );
  process.exit(1);
});

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

let url;
let anonKey;
let serviceKey;
let service;
let anon;

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
    "T21: archivierter Eingang per direktem UPDATE (aktiv=false, archiviert_am); T19/T20: in_vorgang_ueberfuehrt bzw. zugeordneter_vorgang_id via erstelle_vorgang_aus_anfrageeingang",
  setup: "Eingänge über create_anfrageeingang; bewertete/bestätigte Zustände über bestehende RPCs",
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
  "test-ordne-anfrageeingang-vorgang-zu-rpc.mjs": "__test_ordne_%",
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
    marker: "behalten",
    ...extraFields,
  };
}

function baseBewertung(overrides = {}) {
  return {
    p_strukturierte_daten: { quelle: "test", marker: "verw" },
    p_zuordnungsstatus: "eindeutig",
    p_zuordnungsgrund: zweiMerkmaleGrund(),
    p_zuordnungskandidaten: [],
    p_vollstaendigkeitsstatus: "vollstaendig",
    p_fehlende_angaben: [],
    p_confidence_score: 0.82,
    p_dringlichkeit: "hoch",
    p_manuelle_pruefung_erforderlich: true,
    ...overrides,
  };
}

function pickBewertungFields(row) {
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

async function createEingang(mandantId, suffix, ts, overrides = {}) {
  const { data, error } = await service.rpc("create_anfrageeingang", {
    p_mandant_id: mandantId,
    p_kanal: "email",
    p_rohinhalt: `verw-test-${suffix}-${ts}`,
    ...overrides,
  });
  if (error) throw error;
  if (!data?.ok) throw new Error(`create (${suffix}): ${JSON.stringify(data)}`);
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
    p_bestaetigungsquelle: "test-verw",
  });
  return { data, error };
}

async function erstelle(mandantId, anfrageeingangId) {
  return service.rpc("erstelle_vorgang_aus_anfrageeingang", {
    p_mandant_id: mandantId,
    p_anfrageeingang_id: anfrageeingangId,
    p_titel: "Konflikt-Vorgang",
  });
}

async function ordne(mandantId, anfrageeingangId, vorgangId) {
  return service.rpc("ordne_anfrageeingang_vorgang_zu", {
    p_mandant_id: mandantId,
    p_anfrageeingang_id: anfrageeingangId,
    p_vorgang_id: vorgangId,
  });
}

async function verwerfe(client, mandantId, anfrageeingangId, grund, quelle = "test") {
  const { data, error } = await client.rpc("verwerfe_anfrageeingang", {
    p_mandant_id: mandantId,
    p_anfrageeingang_id: anfrageeingangId,
    p_grund: grund,
    p_quelle: quelle,
  });
  return { data, error };
}

async function fetchEingang(id) {
  const { data, error } = await service.from("anfrageeingaenge").select("*").eq("id", id).single();
  if (error) throw error;
  return data;
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

function trackKundennummerSeq(ids, mandantId) {
  if (!ids.kundennummer_sequenzen.some((r) => r.mandant_id === mandantId)) {
    ids.kundennummer_sequenzen.push({ mandant_id: mandantId });
  }
}

async function trackVorgang(ids, vorgangId) {
  if (!vorgangId || ids.vorgaenge.includes(vorgangId)) return;
  ids.vorgaenge.push(vorgangId);
  const { data } = await service.from("vorgang_beteiligte").select("id").eq("vorgang_id", vorgangId);
  for (const b of data ?? []) {
    if (b.id && !ids.vorgang_beteiligte.includes(b.id)) ids.vorgang_beteiligte.push(b.id);
  }
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
    .like("name", "__test_verw_%");
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
    countOrgsByPrefix("__test_verw_%"),
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

async function cleanup(ids) {
  const mandantIds = uniqueIds(ids.orgs);
  const vorgangIds = uniqueIds(ids.vorgaenge);
  const eingangIds = uniqueIds(ids.anfrageeingaenge);
  const beteiligteIds = uniqueIds(ids.vorgang_beteiligte);
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
    await service.from("kundennummer_sequenzen").delete().in("mandant_id", mandantIds);
    await service.from("organizations").delete().in("id", mandantIds);
  }
  if (ids.authUserId) await service.auth.admin.deleteUser(ids.authUserId);
}

async function createOrg(ts, suffix) {
  const { data, error } = await service
    .from("organizations")
    .insert({ name: `__test_verw_${suffix}_${ts}`, status: "interessent" })
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

  const { data: kA } = await insKunde(orgA, `VERW-KA-${ts}`, "Aktiv");
  const { data: kB } = await insKunde(orgB, `VERW-KB-${ts}`, "Fremd");
  ids.kunden.push(kA.id, kB.id);
  trackKundennummerSeq(ids, orgA);
  trackKundennummerSeq(ids, orgB);

  const insAdr = (mid, n) =>
    service
      .from("adressen")
      .insert({
        mandant_id: mid,
        strasse: "Verwstr.",
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

  return { kA: kA.id, kB: kB.id, gebA: gebA.id, gebB: gebB.id, einA: einA.id };
}

async function trackRawEingang(mandantId, suffix, ts, ids, overrides = {}) {
  const e = await createEingang(mandantId, suffix, ts, overrides);
  ids.anfrageeingaenge.push(e.anfrageeingang_id);
  const row = await fetchEingang(e.anfrageeingang_id);
  trackEingangSeq(ids, mandantId, new Date(row.empfangen_am).getFullYear());
  return e.anfrageeingang_id;
}

async function prepareEingangStatus(mandantId, suffix, ts, ids, sd, targetStatus) {
  const eingangId = await trackRawEingang(mandantId, suffix, ts, ids);
  if (targetStatus === "neu") return eingangId;

  if (targetStatus === "analysiert") {
    const { data, error } = await bewertung(mandantId, eingangId);
    if (error) throw error;
    if (!data?.ok) throw new Error(`bew ${suffix}: ${JSON.stringify(data)}`);
    return eingangId;
  }

  if (targetStatus === "zur_manuellen_pruefung") {
    const { data, error } = await bewertung(mandantId, eingangId, {
      p_zuordnungsstatus: "mehrere_treffer",
      p_zuordnungskandidaten: [{ kunde_id: sd.kA, score: 0.5 }],
    });
    if (error) throw error;
    if (!data?.ok) throw new Error(`bew manuell ${suffix}: ${JSON.stringify(data)}`);
    return eingangId;
  }

  if (targetStatus === "wartet_auf_informationen") {
    const { data: bData, error: bErr } = await bewertung(mandantId, eingangId, {
      p_vollstaendigkeitsstatus: "unvollstaendig",
      p_fehlende_angaben: ["telefon"],
    });
    if (bErr) throw bErr;
    if (!bData?.ok) throw new Error(`bew wartet ${suffix}: ${JSON.stringify(bData)}`);
    const { data: cData, error: cErr } = await bestaetige(mandantId, eingangId, sd.kA, sd.gebA);
    if (cErr) throw cErr;
    if (cData?.code !== "confirmed") throw new Error(`best wartet ${suffix}: ${JSON.stringify(cData)}`);
    return eingangId;
  }

  if (targetStatus === "bereit_fuer_vorgang") {
    const { data: bData, error: bErr } = await bewertung(mandantId, eingangId);
    if (bErr) throw bErr;
    if (!bData?.ok) throw new Error(`bew bereit ${suffix}: ${JSON.stringify(bData)}`);
    const { data: cData, error: cErr } = await bestaetige(mandantId, eingangId, sd.kA, sd.gebA, sd.einA);
    if (cErr) throw cErr;
    if (cData?.code !== "confirmed") throw new Error(`best bereit ${suffix}: ${JSON.stringify(cData)}`);
    return eingangId;
  }

  throw new Error(`Unbekannter Status ${targetStatus}`);
}

async function readyForVorgang(mandantId, suffix, ts, ids, sd) {
  const eingangId = await prepareEingangStatus(mandantId, suffix, ts, ids, sd, "bereit_fuer_vorgang");
  const row = await fetchEingang(eingangId);
  const jahr = new Date(row.empfangen_am).getFullYear();
  if (!ids.vorgangsnummer_sequenzen.some((r) => r.mandant_id === mandantId && r.jahr === jahr)) {
    ids.vorgangsnummer_sequenzen.push({ mandant_id: mandantId, jahr });
  }
  return eingangId;
}

async function createVorgang(mandantId, suffix, ts, ids, sd) {
  const eingangId = await readyForVorgang(mandantId, suffix, ts, ids, sd);
  const { data, error } = await erstelle(mandantId, eingangId);
  if (error) throw error;
  if (!data?.ok) throw new Error(`erstelle ${suffix}: ${JSON.stringify(data)}`);
  await trackVorgang(ids, data.vorgang_id);
  return { eingangId, vorgangId: data.vorgang_id };
}

function runRegression(script) {
  console.log(`[REGRESSION] start ${script}`);
  const r = spawnSync("node", [join(root, "scripts", script)], {
    cwd: root,
    encoding: "utf8",
    env: { ...process.env, SKIP_REGRESSION: "1" },
    timeout: REGRESSION_TIMEOUT_MS,
    killSignal: "SIGKILL",
    maxBuffer: 10 * 1024 * 1024,
  });
  const timedOut = r.error?.code === "ETIMEDOUT";
  const status = timedOut ? "TIMEOUT" : (r.status ?? "null");
  console.log(`[REGRESSION] end ${script} exit=${status}`);
  if (timedOut) {
    return { ok: false, status: "TIMEOUT", timedOut: true, stderrTail: "", stdoutTail: "" };
  }
  const stderrTail = (r.stderr || "").split("\n").slice(-3).join("\n");
  const stdoutTail = (r.stdout || "").split("\n").slice(-3).join("\n");
  if (r.status !== 0 && (stderrTail || stdoutTail)) {
    console.log(`[REGRESSION] ${script} stderr tail: ${stderrTail || "(empty)"}`);
    console.log(`[REGRESSION] ${script} stdout tail: ${stdoutTail || "(empty)"}`);
  }
  return { ok: r.status === 0, status: r.status, timedOut: false, stderrTail, stdoutTail };
}

async function main() {
  console.log("[START] test-verwerfe-anfrageeingang-rpc");
  globalTimeoutHandle = setTimeout(failGlobalTimeout, GLOBAL_TIMEOUT_MS);

  setPhase("loadEnvLocal");
  loadEnvLocal();
  logPhaseDone("loadEnvLocal");

  setPhase("createSupabaseClients");
  url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  anonKey = process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY;
  serviceKey = process.env.SUPABASE_SERVICE_ROLE_KEY;
  service = createClient(url, serviceKey, {
    auth: { persistSession: false, autoRefreshToken: false },
  });
  anon = createClient(url, anonKey, {
    auth: { persistSession: false, autoRefreshToken: false },
  });
  logPhaseDone("createSupabaseClients");

  const ts = Date.now();
  const ids = {
    orgs: [],
    anfrageeingaenge: [],
    eingangsnummer_sequenzen: [],
    vorgangsnummer_sequenzen: [],
    sequenzKeys: new Set(),
    vorgaenge: [],
    vorgang_beteiligte: [],
    einheiten: [],
    gebaeude: [],
    adressen: [],
    kunden: [],
    kundennummer_sequenzen: [],
    authUserId: null,
  };

  try {
    setPhase("cleanupOrphans");
    orphanBefore = await cleanupOrphans();
    logPhaseDone("cleanupOrphans");

    setPhase("snapshotCounts.before");
    beforeSnap = await snapshotCounts();
    logPhaseDone("snapshotCounts.before");

    setPhase("createTestMandanten");
    const orgA = await createOrg(ts, "a");
    const orgB = await createOrg(ts, "b");
    ids.orgs.push(orgA, orgB);
    logPhaseDone("createTestMandanten");

    setPhase("setupTestdaten");
    const sd = await setupStammdaten(ts, orgA, orgB, ids);
    logPhaseDone("setupTestdaten");

    setPhase("T1-T10");
    const eMain = await trackRawEingang(orgA, "t1-main", ts, ids);
    const beforeMain = Date.now();
    const { data: dMain, error: errMain } = await verwerfe(
      service,
      orgA,
      eMain,
      "Spam erkannt",
      "test-manuell",
    );
    if (errMain) throw errMain;
    const afterMain = await fetchEingang(eMain);

    record("T1", dMain?.ok === true && dMain?.code === "discarded", dMain?.code ?? "error");
    record("T6", afterMain.status === "verworfen", afterMain.status);
    record("T7", !!afterMain.beendet_am, afterMain.beendet_am ?? "null");
    record(
      "T8",
      !!afterMain.zuletzt_bearbeitet_am &&
        new Date(afterMain.zuletzt_bearbeitet_am).getTime() >= beforeMain - 5000,
      afterMain.zuletzt_bearbeitet_am ?? "null",
    );
    record("T9", afterMain.manuelle_pruefung_erforderlich === false, String(afterMain.manuelle_pruefung_erforderlich));
    record("T10", afterMain.aktiv === true, String(afterMain.aktiv));
    record("T11", afterMain.archiviert_am === null, String(afterMain.archiviert_am));
    logPhaseDone("T1-T10");

    setPhase("T11-T20");
    for (const [idx, status] of [
      ["T2", "analysiert"],
      ["T3", "wartet_auf_informationen"],
      ["T4", "zur_manuellen_pruefung"],
      ["T5", "bereit_fuer_vorgang"],
    ]) {
      const eId = await prepareEingangStatus(orgA, idx, ts, ids, sd, status);
      const rowBefore = await fetchEingang(eId);
      const { data } = await verwerfe(service, orgA, eId, `Grund ${idx}`, "test");
      const rowAfter = await fetchEingang(eId);
      record(
        idx,
        data?.code === "discarded" &&
          rowBefore.status === status &&
          rowAfter.status === "verworfen",
        `${status}→${data?.code}`,
      );
    }

    // T12–T16: Metadaten auf bestätigtem Eingang
    const eMeta = await trackRawEingang(orgA, "t12-meta", ts, ids);
    const t14Grund = {
      merkmale: [
        { typ: "email", ergebnis: "uebereinstimmung" },
        { typ: "objektadresse", ergebnis: "uebereinstimmung" },
      ],
      widersprueche: [],
      regelversion: "v1",
      test_marker: "T14",
    };
    const { data: bMeta, error: bMetaErr } = await bewertung(orgA, eMeta, {
      p_zuordnungsgrund: t14Grund,
      p_zuordnungskandidaten: [{ kunde_id: sd.kA, score: 0.91 }],
      p_fehlende_angaben: ["plz"],
      p_confidence_score: 0.77,
      p_dringlichkeit: "normal",
    });
    if (bMetaErr) throw bMetaErr;
    if (!bMeta?.ok) throw new Error(`T14 bewertung: ${JSON.stringify(bMeta)}`);
    const { data: cMeta, error: cMetaErr } = await bestaetige(orgA, eMeta, sd.kA, sd.gebA, sd.einA);
    if (cMetaErr) throw cMetaErr;
    if (cMeta?.code !== "confirmed") throw new Error(`T14 bestaetige: ${JSON.stringify(cMeta)}`);
    const beforeMetaRow = await fetchEingang(eMeta);
    const beforeMeta = pickBewertungFields(beforeMetaRow);
    const grundBefore = beforeMetaRow.zuordnungsgrund;
    await verwerfe(service, orgA, eMeta, "Kein Interesse", "sachbearbeiter");
    const afterMetaRow = await fetchEingang(eMeta);
    const afterMeta = pickBewertungFields(afterMetaRow);

    record(
      "T12",
      beforeMeta.zuordnungsstatus === afterMeta.zuordnungsstatus &&
        beforeMeta.zuordnungsstatus === "bestaetigt",
      `${beforeMeta.zuordnungsstatus}→${afterMeta.zuordnungsstatus}`,
    );
    record(
      "T13",
      beforeMeta.zugeordnet_kunde_id === afterMeta.zugeordnet_kunde_id &&
        beforeMeta.zugeordnet_gebaeude_id === afterMeta.zugeordnet_gebaeude_id &&
        beforeMeta.zugeordnet_einheit_id === afterMeta.zugeordnet_einheit_id,
      "FKs gleich",
    );
    const t14GrundAfter = afterMetaRow.zuordnungsgrund;
    const t14Verw = t14GrundAfter?.verwerfung;
    const t14ZeitpunktOk =
      !!t14Verw?.zeitpunkt && !Number.isNaN(Date.parse(t14Verw.zeitpunkt));
    const t14Ok =
      JSON.stringify(beforeMeta.strukturierte_daten) ===
        JSON.stringify(afterMeta.strukturierte_daten) &&
      JSON.stringify(beforeMeta.zuordnungskandidaten) ===
        JSON.stringify(afterMeta.zuordnungskandidaten) &&
      beforeMeta.vollstaendigkeitsstatus === afterMeta.vollstaendigkeitsstatus &&
      JSON.stringify(beforeMeta.fehlende_angaben) === JSON.stringify(afterMeta.fehlende_angaben) &&
      beforeMeta.confidence_score === afterMeta.confidence_score &&
      beforeMeta.dringlichkeit === afterMeta.dringlichkeit &&
      beforeMeta.zuordnungsstatus === afterMeta.zuordnungsstatus &&
      JSON.stringify(t14GrundAfter?.merkmale) === JSON.stringify(grundBefore?.merkmale) &&
      t14GrundAfter?.regelversion === grundBefore?.regelversion &&
      t14GrundAfter?.test_marker === grundBefore?.test_marker &&
      t14Verw?.grund === "Kein Interesse" &&
      t14Verw?.quelle === "sachbearbeiter" &&
      t14ZeitpunktOk;
    record("T14", t14Ok, t14Ok ? "Bewertung erhalten + verwerfung ergänzt" : "Abweichung");

    const verw = afterMetaRow.zuordnungsgrund?.verwerfung;
    record(
      "T15",
      verw?.grund === "Kein Interesse" &&
        verw?.quelle === "sachbearbeiter" &&
        !!verw?.zeitpunkt,
      JSON.stringify(verw),
    );
    record(
      "T16",
      afterMetaRow.zuordnungsgrund?.marker === grundBefore?.marker &&
        afterMetaRow.zuordnungsgrund?.merkmale?.length === grundBefore?.merkmale?.length,
      "bestehendes JSON erhalten",
    );

    // T17–T18: Idempotenz
    const eIdemp = await trackRawEingang(orgA, "t17", ts, ids);
    const firstGrund = "Erster Grund";
    await verwerfe(service, orgA, eIdemp, firstGrund, "test");
    const grundAfterFirst = (await fetchEingang(eIdemp)).zuordnungsgrund?.verwerfung?.grund;
    const { data: replay } = await verwerfe(service, orgA, eIdemp, "Anderer Grund beim Replay", "replay");
    const grundAfterReplay = (await fetchEingang(eIdemp)).zuordnungsgrund?.verwerfung?.grund;
    record(
      "T17",
      replay?.ok === true &&
        replay?.code === "already_discarded" &&
        replay?.idempotent === true &&
        replay?.status === "verworfen",
      replay?.code,
    );
    record(
      "T18",
      grundAfterFirst === firstGrund &&
        grundAfterReplay === firstGrund &&
        grundAfterReplay !== "Anderer Grund beim Replay",
      `${grundAfterFirst} unverändert`,
    );

    // T19: in_vorgang_ueberfuehrt via erstelle
    const { eingangId: e19, vorgangId: v19 } = await createVorgang(orgA, "t19", ts, ids, sd);
    const { data: d19 } = await verwerfe(service, orgA, e19, "Zu spät", "test");
    record(
      "T19",
      d19?.ok === false && d19?.code === "conflict" && d19?.field === "zugeordneter_vorgang_id",
      JSON.stringify(d19),
    );

    // T20: zugeordneter_vorgang via ordne (separater Vorgang + Eingang)
    const { vorgangId: v20 } = await createVorgang(orgA, "t20-v", ts, ids, sd);
    const e20 = await trackRawEingang(orgA, "t20-e", ts, ids);
    const { data: ord20 } = await ordne(orgA, e20, v20);
    if (!ord20?.ok) throw new Error(`T20 ordne: ${JSON.stringify(ord20)}`);
    const { data: d20 } = await verwerfe(service, orgA, e20, "Konflikt", "test");
    record(
      "T20",
      d20?.ok === false && d20?.code === "conflict" && d20?.field === "zugeordneter_vorgang_id",
      JSON.stringify(d20),
    );
    logPhaseDone("T11-T20");

    setPhase("T21-T30");
    const e21 = await trackRawEingang(orgA, "t21", ts, ids);
    await service
      .from("anfrageeingaenge")
      .update({ aktiv: false, archiviert_am: new Date().toISOString() })
      .eq("id", e21);
    const { data: d21 } = await verwerfe(service, orgA, e21, "Archiv", "test");
    record(
      "T21",
      d21?.ok === false && d21?.code === "invalid_status_transition" && d21?.field === "aktiv",
      JSON.stringify(d21),
    );

    // T22–T23: not_found / cross_tenant
    const fakeId = "00000000-0000-4000-8000-000000000088";
    const { data: d22 } = await verwerfe(service, orgA, fakeId, "X", "test");
    record(
      "T22",
      d22?.ok === false && d22?.code === "not_found" && d22?.field === "anfrageeingang_id",
      JSON.stringify(d22),
    );

    const e23 = await trackRawEingang(orgA, "t23", ts, ids);
    const { data: d23 } = await verwerfe(service, orgB, e23, "Fremd", "test");
    record(
      "T23",
      d23?.ok === false && d23?.code === "cross_tenant_reference" && d23?.field === "anfrageeingang_id",
      JSON.stringify(d23),
    );

    // T24–T25: validation
    const e24 = await trackRawEingang(orgA, "t24", ts, ids);
    const { data: d24 } = await verwerfe(service, orgA, e24, "   ", "test");
    record(
      "T24",
      d24?.ok === false && d24?.code === "validation_error" && d24?.field === "grund",
      JSON.stringify(d24),
    );

    const e25 = await trackRawEingang(orgA, "t25", ts, ids);
    const { data: d25 } = await verwerfe(service, orgA, e25, "Grund ok", "  ");
    record(
      "T25",
      d25?.ok === false && d25?.code === "validation_error" && d25?.field === "quelle",
      JSON.stringify(d25),
    );

    // T26: parallele identische Verwerfungen
    const e26 = await trackRawEingang(orgA, "t26", ts, ids);
    const [p26a, p26b] = await Promise.all([
      verwerfe(service, orgA, e26, "Parallel", "test"),
      verwerfe(service, orgA, e26, "Parallel", "test"),
    ]);
    const codes26 = [p26a.data?.code, p26b.data?.code].sort();
    const end26 = await fetchEingang(e26);
    record(
      "T26",
      codes26.includes("discarded") &&
        codes26.includes("already_discarded") &&
        end26.status === "verworfen",
      `codes=${codes26.join(",")}`,
    );

    // T27: parallele Verwerfung vs. Vorgangszuordnung
    const { vorgangId: v27 } = await createVorgang(orgA, "t27-v", ts, ids, sd);
    const e27 = await trackRawEingang(orgA, "t27-e", ts, ids);
    const [p27a, p27b] = await Promise.all([
      verwerfe(service, orgA, e27, "Race discard", "test"),
      ordne(orgA, e27, v27),
    ]);
    const codeVerwerfe = p27a.data?.code;
    const codeOrdne = p27b.data?.code;
    const okVerwerfe = p27a.data?.ok === true;
    const okOrdne = p27b.data?.ok === true;
    const rejectedCodes = ["conflict", "invalid_status_transition"];
    const variantA =
      okOrdne &&
      codeOrdne === "assigned" &&
      !okVerwerfe &&
      rejectedCodes.includes(codeVerwerfe);
    const variantB =
      okVerwerfe &&
      codeVerwerfe === "discarded" &&
      !okOrdne &&
      rejectedCodes.includes(codeOrdne);
    const exactlyOneSuccess = (okVerwerfe ? 1 : 0) + (okOrdne ? 1 : 0) === 1;
    const end27 = await fetchEingang(e27);
    let t27EndStateOk = false;
    if (variantA) {
      t27EndStateOk =
        end27.status === "in_vorgang_ueberfuehrt" &&
        end27.zugeordneter_vorgang_id === v27 &&
        !!end27.beendet_am &&
        !end27.zuordnungsgrund?.verwerfung?.grund;
    } else if (variantB) {
      t27EndStateOk =
        end27.status === "verworfen" &&
        end27.zugeordneter_vorgang_id === null &&
        !!end27.beendet_am &&
        !!end27.zuordnungsgrund?.verwerfung?.grund;
    }
    record(
      "T27",
      exactlyOneSuccess &&
        (variantA || variantB) &&
        t27EndStateOk &&
        !p27a.error &&
        !p27b.error,
      `codes=${codeVerwerfe},${codeOrdne}, status=${end27.status}`,
    );

    // T28–T29: Berechtigungen
    const ePerm = await trackRawEingang(orgA, "t28", ts, ids);
    const { error: anonErr } = await verwerfe(anon, orgA, ePerm, "perm", "test");
    const email = `verw-test-${ts}@example.com`;
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
    const { error: authErr } = await verwerfe(authed, orgA, ePerm, "perm", "test");
    const { data: svcPerm, error: svcErr } = await verwerfe(service, orgA, ePerm, "perm svc", "test");
    record(
      "T28",
      !!anonErr &&
        /permission denied|42501/i.test(anonErr.message ?? "") &&
        !!authErr &&
        /permission denied|42501/i.test(authErr.message ?? ""),
      `anon=${anonErr?.code ?? "ok"}, auth=${authErr?.code ?? "ok"}`,
    );
    record(
      "T29",
      !svcErr && svcPerm?.ok === true && svcPerm?.code === "discarded",
      svcPerm?.code ?? svcErr?.message,
    );
    record("berechtigungen", results.T28?.ok && results.T29?.ok, "anon/auth denied, svc ok");
    logPhaseDone("T21-T30");
  } finally {
    setPhase("hauptCleanup");
    await cleanup(ids);
    await cleanupOrphans();
    const cleanupVerify = await verifyCleanup(ids);
    logPhaseDone("hauptCleanup");

    setPhase("endverifikation");
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

      const t30Ok =
        (results.T28?.ok ?? false) &&
        (results.T29?.ok ?? false) &&
        bestandOk &&
        cleanupOk;
      record(
        "T30",
        t30Ok,
        `bestand=${bestandOk}, cleanup=${cleanupOk}, berecht=${results.T28?.ok && results.T29?.ok}`,
      );
    }
    logPhaseDone("endverifikation");

    setPhase("regressionen");
    const regScripts = [
      "test-create-anfrageeingang-rpc.mjs",
      "test-update-anfrageeingang-bewertung-rpc.mjs",
      "test-bestaetige-anfrageeingang-zuordnung-rpc.mjs",
      "test-erstelle-vorgang-aus-anfrageeingang-rpc.mjs",
      "test-create-vorlaeufiger-kunde-mit-objekt-rpc.mjs",
      "test-ordne-anfrageeingang-vorgang-zu-rpc.mjs",
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
    logPhaseDone("regressionen");
  }

  if (globalTimeoutHandle) clearTimeout(globalTimeoutHandle);

  const problems = [];
  for (const [k, v] of Object.entries(results)) {
    if (v && !v.ok) problems.push(`${k}: ${v.detail}`);
  }
  for (const [k, v] of Object.entries(extra)) {
    if (v && !v.ok) problems.push(`${k}: ${v.detail}`);
  }

  console.log(JSON.stringify({ passed, notes, orphanBefore, results, extra, problems }, null, 2));
  console.log("[END] test-verwerfe-anfrageeingang-rpc");
  process.exit(passed ? 0 : 1);
}

main().catch((err) => {
  if (globalTimeoutHandle) clearTimeout(globalTimeoutHandle);
  console.log(
    JSON.stringify(
      { passed: false, fatal: err.message, lastPhase: currentPhase, results, extra, problems: [err.message] },
      null,
      2,
    ),
  );
  process.exit(1);
});

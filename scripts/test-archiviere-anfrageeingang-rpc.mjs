/**
 * Integrationstest RPC public.archiviere_anfrageeingang
 * Migration 20260717390000_archiviere_anfrageeingang_rpc.sql
 */
import { readFileSync, existsSync } from "node:fs";
import { randomUUID } from "node:crypto";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import { spawnSync } from "node:child_process";
import { createClient } from "@supabase/supabase-js";

const __dirname = dirname(fileURLToPath(import.meta.url));
const root = join(__dirname, "..");

const GLOBAL_TIMEOUT_MS = 10 * 60 * 1000;
const REGRESSION_TIMEOUT_MS = 120 * 1000;
const TEST_ORG_PREFIX = "__test_arch_%";
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
  Array.from({ length: 18 }, (_, i) => [`T${i + 1}`, null]),
);
const extra = {
  orthogonalitaet: null,
  idempotenz: null,
  parallelitaet: null,
  berechtigungen: null,
  bestandsschutz: null,
  adminSmoke: null,
  cleanup: null,
  regression: null,
};
const notes = {
  setup:
    "Eingänge über create_anfrageeingang; Bewertung/Zuordnung/Vorgang über bestehende M3.1-RPCs",
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
  "test-verwerfe-anfrageeingang-rpc.mjs": "__test_verw_%",
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
    marker: "arch",
    ...extraFields,
  };
}

function baseBewertung(overrides = {}) {
  return {
    p_strukturierte_daten: { quelle: "test", marker: "arch" },
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
    zuordnungsgrund: row.zuordnungsgrund,
    zuordnungskandidaten: row.zuordnungskandidaten,
    vollstaendigkeitsstatus: row.vollstaendigkeitsstatus,
    fehlende_angaben: row.fehlende_angaben,
    confidence_score: row.confidence_score,
    dringlichkeit: row.dringlichkeit,
  };
}

function pickImmutableSnapshot(row) {
  return {
    status: row.status,
    beendet_am: row.beendet_am,
    zuordnungsstatus: row.zuordnungsstatus,
    zugeordnet_kunde_id: row.zugeordnet_kunde_id,
    zugeordnet_gebaeude_id: row.zugeordnet_gebaeude_id,
    zugeordnet_einheit_id: row.zugeordnet_einheit_id,
    zugeordneter_vorgang_id: row.zugeordneter_vorgang_id,
    ...pickBewertungFields(row),
  };
}

function snapshotsEqual(a, b) {
  return JSON.stringify(a) === JSON.stringify(b);
}

async function createEingang(mandantId, suffix, ts, overrides = {}) {
  const { data, error } = await service.rpc("create_anfrageeingang", {
    p_mandant_id: mandantId,
    p_kanal: "email",
    p_rohinhalt: `arch-test-${suffix}-${ts}`,
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
    p_bestaetigungsquelle: "test-arch",
  });
  return { data, error };
}

async function erstelle(mandantId, anfrageeingangId) {
  return service.rpc("erstelle_vorgang_aus_anfrageeingang", {
    p_mandant_id: mandantId,
    p_anfrageeingang_id: anfrageeingangId,
    p_titel: "Arch-Orthogonal-Vorgang",
  });
}

async function verwerfe(mandantId, anfrageeingangId, grund = "Orthogonal") {
  const { data, error } = await service.rpc("verwerfe_anfrageeingang", {
    p_mandant_id: mandantId,
    p_anfrageeingang_id: anfrageeingangId,
    p_grund: grund,
    p_quelle: "test-arch",
  });
  return { data, error };
}

async function archiviere(client, mandantId, anfrageeingangId) {
  const { data, error } = await client.rpc("archiviere_anfrageeingang", {
    p_mandant_id: mandantId,
    p_anfrageeingang_id: anfrageeingangId,
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
    .like("name", TEST_ORG_PREFIX);
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
    countOrgsByPrefix(TEST_ORG_PREFIX),
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
    .insert({ name: `__test_arch_${suffix}_${ts}`, status: "interessent" })
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

  const { data: kA } = await insKunde(orgA, `ARCH-KA-${ts}`, "Aktiv");
  const { data: kB } = await insKunde(orgB, `ARCH-KB-${ts}`, "Fremd");
  ids.kunden.push(kA.id, kB.id);
  trackKundennummerSeq(ids, orgA);
  trackKundennummerSeq(ids, orgB);

  const insAdr = (mid, n) =>
    service
      .from("adressen")
      .insert({
        mandant_id: mid,
        strasse: "Archstr.",
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

async function prepareBewertetBestaetigt(mandantId, suffix, ts, ids, sd) {
  const eingangId = await trackRawEingang(mandantId, suffix, ts, ids);
  const { data: bData, error: bErr } = await bewertung(mandantId, eingangId, {
    p_zuordnungskandidaten: [{ kunde_id: sd.kA, score: 0.91 }],
    p_fehlende_angaben: ["plz"],
    p_confidence_score: 0.77,
    p_dringlichkeit: "normal",
    p_zuordnungsgrund: zweiMerkmaleGrund({ marker: suffix }),
  });
  if (bErr) throw bErr;
  if (!bData?.ok) throw new Error(`bew ${suffix}: ${JSON.stringify(bData)}`);
  const { data: cData, error: cErr } = await bestaetige(mandantId, eingangId, sd.kA, sd.gebA, sd.einA);
  if (cErr) throw cErr;
  if (cData?.code !== "confirmed") throw new Error(`best ${suffix}: ${JSON.stringify(cData)}`);
  return eingangId;
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
    return { ok: false, status: "TIMEOUT", timedOut: true };
  }
  return { ok: r.status === 0, status: r.status, timedOut: false };
}

async function main() {
  console.log("[START] test-archiviere-anfrageeingang-rpc");
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
    const eMain = await prepareBewertetBestaetigt(orgA, "t1-main", ts, ids, sd);
    const beforeMainRow = await fetchEingang(eMain);
    const beforeSnapshot = pickImmutableSnapshot(beforeMainRow);
    const updatedAtBefore = beforeMainRow.updated_at;

    const { data: dMain, error: errMain } = await archiviere(service, orgA, eMain);
    if (errMain) throw errMain;
    const afterMainRow = await fetchEingang(eMain);
    const afterSnapshot = pickImmutableSnapshot(afterMainRow);

    record("T1", dMain?.ok === true && dMain?.code === "archived", dMain?.code ?? "error");
    record("T2", afterMainRow.aktiv === false, String(afterMainRow.aktiv));
    record("T3", !!afterMainRow.archiviert_am, afterMainRow.archiviert_am ?? "null");
    record(
      "T4",
      !!afterMainRow.updated_at &&
        new Date(afterMainRow.updated_at).getTime() >= new Date(updatedAtBefore).getTime(),
      `${updatedAtBefore}→${afterMainRow.updated_at}`,
    );
    record("T5", afterSnapshot.status === beforeSnapshot.status, `${beforeSnapshot.status}→${afterSnapshot.status}`);
    record(
      "T6",
      afterSnapshot.beendet_am === beforeSnapshot.beendet_am,
      String(afterSnapshot.beendet_am),
    );
    record(
      "T7",
      afterSnapshot.zuordnungsstatus === beforeSnapshot.zuordnungsstatus &&
        afterSnapshot.zugeordnet_kunde_id === beforeSnapshot.zugeordnet_kunde_id &&
        afterSnapshot.zugeordnet_gebaeude_id === beforeSnapshot.zugeordnet_gebaeude_id &&
        afterSnapshot.zugeordnet_einheit_id === beforeSnapshot.zugeordnet_einheit_id,
      "Zuordnungsfelder gleich",
    );
    record(
      "T8",
      snapshotsEqual(pickBewertungFields(afterMainRow), pickBewertungFields(beforeMainRow)),
      "Bewertungsdaten gleich",
    );
    record(
      "T9",
      afterSnapshot.zugeordneter_vorgang_id === beforeSnapshot.zugeordneter_vorgang_id,
      String(afterSnapshot.zugeordneter_vorgang_id),
    );

    const archAmFirst = afterMainRow.archiviert_am;
    const { data: dReplay, error: errReplay } = await archiviere(service, orgA, eMain);
    if (errReplay) throw errReplay;
    const afterReplayRow = await fetchEingang(eMain);
    const t10Ok =
      dReplay?.ok === true &&
      dReplay?.code === "already_archived" &&
      dReplay?.idempotent === true &&
      afterReplayRow.archiviert_am === archAmFirst;
    record("T10", t10Ok, dReplay?.code ?? "error");
    extra.idempotenz = { ok: t10Ok, detail: dReplay?.code ?? "error" };

    const e11 = await trackRawEingang(orgA, "t11", ts, ids);
    const [p11a, p11b] = await Promise.all([
      archiviere(service, orgA, e11),
      archiviere(service, orgA, e11),
    ]);
    const codes11 = [p11a.data?.code, p11b.data?.code].sort();
    const end11 = await fetchEingang(e11);
    const t11Ok =
      codes11.includes("archived") &&
      codes11.includes("already_archived") &&
      end11.aktiv === false &&
      !!end11.archiviert_am;
    record("T11", t11Ok, `codes=${codes11.join(",")}`);
    extra.parallelitaet = { ok: t11Ok, detail: `codes=${codes11.join(",")}` };
    logPhaseDone("T1-T10");

    setPhase("T12-T18");
    const { data: d12 } = await archiviere(service, orgA, randomUUID());
    record(
      "T12",
      d12?.ok === false && d12?.code === "not_found" && d12?.field === "anfrageeingang_id",
      JSON.stringify(d12),
    );

    const e13 = await trackRawEingang(orgB, "t13", ts, ids);
    const { data: d13 } = await archiviere(service, orgA, e13);
    record(
      "T13",
      d13?.ok === false && d13?.code === "cross_tenant_reference" && d13?.field === "anfrageeingang_id",
      JSON.stringify(d13),
    );

    const { data: d14a } = await archiviere(service, null, randomUUID());
    const { data: d14b } = await archiviere(service, orgA, null);
    record(
      "T14",
      d14a?.ok === false &&
        d14a?.code === "validation_error" &&
        d14a?.field === "mandant_id" &&
        d14b?.ok === false &&
        d14b?.code === "validation_error" &&
        d14b?.field === "anfrageeingang_id",
      `mandant=${d14a?.field}, eingang=${d14b?.field}`,
    );

    const ePerm = await trackRawEingang(orgA, "t15", ts, ids);
    const { error: anonErr } = await archiviere(anon, orgA, ePerm);
    const email = `arch-test-${ts}@example.com`;
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
    const { error: authErr } = await archiviere(authed, orgA, ePerm);
    const t15Ok =
      !!anonErr &&
      /permission denied|42501/i.test(anonErr.message ?? "") &&
      !!authErr &&
      /permission denied|42501/i.test(authErr.message ?? "");
    record("T15", t15Ok, `anon=${anonErr?.code ?? "ok"}, auth=${authErr?.code ?? "ok"}`);
    extra.berechtigungen = { ok: t15Ok, detail: "anon/auth denied" };

    const e16 = await trackRawEingang(orgA, "t16", ts, ids);
    const { data: d16, error: err16 } = await archiviere(service, orgA, e16);
    record(
      "T16",
      !err16 && d16?.ok === true && d16?.code === "archived",
      d16?.code ?? err16?.message,
    );
    logPhaseDone("T12-T18");

    setPhase("orthogonalitaet");
    const eOrthVerw = await trackRawEingang(orgA, "orth-verw", ts, ids);
    const { data: vOrth } = await verwerfe(orgA, eOrthVerw, "Archiv nach Verwerfung");
    if (!vOrth?.ok) throw new Error(`orth verworfen: ${JSON.stringify(vOrth)}`);
    const beforeOrthVerw = await fetchEingang(eOrthVerw);
    const { data: aOrthVerw } = await archiviere(service, orgA, eOrthVerw);
    const afterOrthVerw = await fetchEingang(eOrthVerw);
    const orthVerwOk =
      aOrthVerw?.code === "archived" &&
      beforeOrthVerw.status === "verworfen" &&
      afterOrthVerw.status === "verworfen" &&
      afterOrthVerw.aktiv === false &&
      !!afterOrthVerw.archiviert_am;

    const eOrthVorg = await prepareBewertetBestaetigt(orgA, "orth-vorg", ts, ids, sd);
    const { data: erOrth, error: erOrthErr } = await erstelle(orgA, eOrthVorg);
    if (erOrthErr) throw erOrthErr;
    if (!erOrth?.ok) throw new Error(`orth erstelle: ${JSON.stringify(erOrth)}`);
    await trackVorgang(ids, erOrth.vorgang_id);
    const beforeOrthVorg = await fetchEingang(eOrthVorg);
    const { data: aOrthVorg } = await archiviere(service, orgA, eOrthVorg);
    const afterOrthVorg = await fetchEingang(eOrthVorg);
    const orthVorgOk =
      aOrthVorg?.code === "archived" &&
      beforeOrthVorg.status === "in_vorgang_ueberfuehrt" &&
      afterOrthVorg.status === "in_vorgang_ueberfuehrt" &&
      afterOrthVorg.aktiv === false &&
      !!afterOrthVorg.archiviert_am;

    const orthOk = orthVerwOk && orthVorgOk;
    extra.orthogonalitaet = {
      ok: orthOk,
      detail: `verworfen=${orthVerwOk}, in_vorgang_ueberfuehrt=${orthVorgOk}`,
    };
    if (!orthOk) passed = false;
    logPhaseDone("orthogonalitaet");
  } finally {
    setPhase("hauptCleanup");
    await cleanup(ids);
    await cleanupOrphans();
    const cleanupVerify = await verifyCleanup(ids);
    logPhaseDone("hauptCleanup");

    setPhase("endverifikation");
    if (beforeSnap) {
      const afterSnap = await snapshotCounts();
      const bestandOk = Object.entries(beforeSnap).every(([t, c]) => afterSnap[t] === c);
      const adminOk =
        afterSnap.organizations === beforeSnap.organizations &&
        afterSnap.angebote === beforeSnap.angebote;
      record(
        "T17",
        bestandOk && adminOk,
        `orgs ${beforeSnap.organizations}→${afterSnap.organizations}, angebote ${beforeSnap.angebote}→${afterSnap.angebote}`,
      );
      record("bestandsschutz", bestandOk, "global counts unchanged");
      record(
        "adminSmoke",
        adminOk,
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
      "test-verwerfe-anfrageeingang-rpc.mjs",
    ];
    if (process.env.SKIP_REGRESSION === "1") {
      record("regression", true, "skipped (SKIP_REGRESSION=1)");
      record("T18", extra.cleanup?.ok ?? false, "regression skipped");
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
      const t18Ok = (extra.cleanup?.ok ?? false) && regOk;
      record("T18", t18Ok, `cleanup=${extra.cleanup?.ok}, regression=${regOk}`);
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
  console.log("[END] test-archiviere-anfrageeingang-rpc");
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

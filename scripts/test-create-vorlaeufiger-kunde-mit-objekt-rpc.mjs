/**
 * Integrationstest RPC public.create_vorlaeufiger_kunde_mit_objekt
 * Migration 20260717360000_create_vorlaeufiger_kunde_mit_objekt_rpc.sql
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
  Array.from({ length: 40 }, (_, i) => [`T${i + 1}`, null]),
);
const extra = {
  kundendaten: null,
  dubletten: null,
  nummerierung: null,
  adresseGebaeude: null,
  objektbeziehung: null,
  eingangUpdate: null,
  idempotenz: null,
  rollback: null,
  berechtigungen: null,
  e2e: null,
  regression: null,
  bestandsschutz: null,
  adminSmoke: null,
  cleanup: null,
};
const notes = {
  directInsert:
    "T29: zweiter Seed-Kunde per direktem INSERT für widersprüchliche Dublettenprüfung",
  rollbackGrenze:
    "T39: Vollständige fachliche Validierung vor Kundennummernvergabe — post-Sequenz-Constraint-Fehler ohne RPC-Änderung nicht sicher reproduzierbar",
  migrationFix:
    "T37/T38: Idempotenz-Check in Migration vor bereit_fuer_vorgang-Ablehnung verschoben — 20260717360000 erneut anwenden",
};
let passed = true;
let beforeSnap = null;
let seedT1 = null;

function record(key, ok, detail = "") {
  if (key in results) results[key] = { ok, detail };
  else if (key in extra) extra[key] = { ok, detail };
  else extra[key] = { ok, detail };
  if (!ok) passed = false;
}

function baseBewertung(overrides = {}) {
  return {
    p_strukturierte_daten: { quelle: "vlk-test" },
    p_zuordnungsstatus: "kein_treffer",
    p_zuordnungsgrund: { regelversion: "v1", widersprueche: [] },
    p_zuordnungskandidaten: [],
    p_vollstaendigkeitsstatus: "vollstaendig",
    p_fehlende_angaben: [],
    p_dringlichkeit: "normal",
    p_manuelle_pruefung_erforderlich: false,
    ...overrides,
  };
}

function basePayload(ts, suffix, overrides = {}) {
  const hn = String((suffix.length * 17 + (ts % 100)) % 900 + 1);
  return {
    p_kundentyp: "privatperson",
    p_vorname: `Vk-${suffix}`,
    p_nachname: `Test-${String(ts).slice(-6)}`,
    p_email: `vk-${suffix}-${ts}@example.test`,
    p_strasse: "Vlkstr.",
    p_hausnummer: hn,
    p_plz: "10115",
    p_ort: "Berlin",
    p_gebaeudeart: "einfamilienhaus",
    ...overrides,
  };
}

async function createEingang(mandantId, suffix, ts, overrides = {}) {
  const { data, error } = await service.rpc("create_anfrageeingang", {
    p_mandant_id: mandantId,
    p_kanal: "email",
    p_rohinhalt: `vlk-${suffix}-${ts}`,
    ...overrides,
  });
  if (error) throw error;
  if (!data?.ok) throw new Error(`create fehlgeschlagen (${suffix}): ${JSON.stringify(data)}`);
  return data;
}

async function bewertung(mandantId, anfrageeingangId, overrides = {}) {
  return service.rpc("update_anfrageeingang_bewertung", {
    p_mandant_id: mandantId,
    p_anfrageeingang_id: anfrageeingangId,
    ...baseBewertung(overrides),
  });
}

async function pipelineEingang(mandantId, suffix, ts, ids, bewOverrides = {}) {
  const e = await createEingang(mandantId, suffix, ts);
  ids.anfrageeingaenge.push(e.anfrageeingang_id);
  trackEingangSeq(ids, mandantId);
  const { data: bData, error: bErr } = await bewertung(mandantId, e.anfrageeingang_id, bewOverrides);
  if (bErr) throw bErr;
  if (!bData?.ok) throw new Error(`bewertung fehlgeschlagen (${suffix}): ${JSON.stringify(bData)}`);
  return e.anfrageeingang_id;
}

async function createVorlaeufig(client, mandantId, anfrageeingangId, payload) {
  const { data, error } = await client.rpc("create_vorlaeufiger_kunde_mit_objekt", {
    p_mandant_id: mandantId,
    p_anfrageeingang_id: anfrageeingangId,
    ...payload,
  });
  return { data, error };
}

function trackEingangSeq(ids, mandantId) {
  if (!ids.kundennummer_sequenzen.some((r) => r.mandant_id === mandantId)) {
    ids.kundennummer_sequenzen.push({ mandant_id: mandantId });
  }
  const y = new Date().getFullYear();
  const ek = `${mandantId}|e|${y}`;
  if (!ids.sequenzKeys.has(ek)) {
    ids.sequenzKeys.add(ek);
    ids.eingangsnummer_sequenzen.push({ mandant_id: mandantId, jahr: y });
  }
}

function trackCreateResult(ids, data) {
  if (!data?.ok) return;
  if (data.kunde_id) ids.kunden.push(data.kunde_id);
  if (data.adresse_id) ids.adressen.push(data.adresse_id);
  if (data.gebaeude_id) ids.gebaeude.push(data.gebaeude_id);
  if (data.einheit_id) ids.einheiten.push(data.einheit_id);
  if (data.kunden_objekt_beziehung_id) ids.beziehungen.push(data.kunden_objekt_beziehung_id);
}

async function fetchEingang(id) {
  const { data, error } = await service.from("anfrageeingaenge").select("*").eq("id", id).single();
  if (error) throw error;
  return data;
}

async function fetchKunde(id) {
  const { data, error } = await service.from("kunden").select("*").eq("id", id).single();
  if (error) throw error;
  return data;
}

async function fetchAdresse(id) {
  const { data, error } = await service.from("adressen").select("*").eq("id", id).single();
  if (error) throw error;
  return data;
}

async function getKundenSeq(mandantId) {
  const { data } = await service
    .from("kundennummer_sequenzen")
    .select("letzter_wert")
    .eq("mandant_id", mandantId)
    .maybeSingle();
  return data?.letzter_wert ?? 0;
}

async function countKunden(mandantId) {
  const { count } = await service
    .from("kunden")
    .select("*", { count: "exact", head: true })
    .eq("mandant_id", mandantId);
  return count ?? 0;
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

async function cleanupOrphans() {
  const { data: orgs } = await service
    .from("organizations")
    .select("id")
    .like("name", "__test_vlk_%");
  for (const org of orgs ?? []) {
    const mid = org.id;
    const { data: vorgaenge } = await service.from("vorgaenge").select("id").eq("mandant_id", mid);
    const vIds = (vorgaenge ?? []).map((v) => v.id);
    if (vIds.length) await service.from("vorgang_beteiligte").delete().in("vorgang_id", vIds);
    if (vIds.length) await service.from("vorgaenge").delete().in("id", vIds);
    await service.from("anfrageeingaenge").delete().eq("mandant_id", mid);
    await service.from("kunden_objekt_beziehungen").delete().eq("mandant_id", mid);
    await service.from("einheiten").delete().eq("mandant_id", mid);
    await service.from("gebaeude").delete().eq("mandant_id", mid);
    await service.from("adressen").delete().eq("mandant_id", mid);
    await service.from("kunden").delete().eq("mandant_id", mid);
    await service.from("vorgangsnummer_sequenzen").delete().eq("mandant_id", mid);
    await service.from("eingangsnummer_sequenzen").delete().eq("mandant_id", mid);
    await service.from("kundennummer_sequenzen").delete().eq("mandant_id", mid);
    await service.from("organizations").delete().eq("id", mid);
  }
}

async function cleanup(ids) {
  if (ids.vorgaenge.length) {
    await service.from("vorgang_beteiligte").delete().in("vorgang_id", ids.vorgaenge);
  }
  if (ids.vorgaenge.length) {
    await service.from("vorgaenge").delete().in("id", ids.vorgaenge);
  }
  if (ids.anfrageeingaenge.length) {
    await service.from("anfrageeingaenge").delete().in("id", ids.anfrageeingaenge);
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
    .insert({ name: `__test_vlk_${suffix}_${ts}`, status: "interessent" })
    .select("id")
    .single();
  if (error) throw error;
  return data.id;
}

function runRegression(script) {
  const r = spawnSync("node", [join(root, "scripts", script)], {
    cwd: root,
    encoding: "utf8",
    env: process.env,
  });
  return { ok: r.status === 0, status: r.status };
}

function expectedKnr(n) {
  return `K-${String(n).padStart(6, "0")}`;
}

async function main() {
  const ts = Date.now();
  const ids = {
    orgs: [],
    anfrageeingaenge: [],
    eingangsnummer_sequenzen: [],
    vorgangsnummer_sequenzen: [],
    kundennummer_sequenzen: [],
    sequenzKeys: new Set(),
    kunden: [],
    adressen: [],
    gebaeude: [],
    einheiten: [],
    beziehungen: [],
    vorgaenge: [],
    authUserId: null,
  };

  try {
    await cleanupOrphans();
    beforeSnap = await snapshotCounts();
    const orgA = await createOrg(ts, "a");
    const orgB = await createOrg(ts, "b");
    ids.orgs.push(orgA, orgB);
    trackEingangSeq(ids, orgA);
    trackEingangSeq(ids, orgB);

    const seq0 = await getKundenSeq(orgA);

    // T1 Privatperson
    const e1 = await pipelineEingang(orgA, "t1", ts, ids);
    const p1 = basePayload(ts, "t1");
    const { data: r1 } = await createVorlaeufig(service, orgA, e1, p1);
    trackCreateResult(ids, r1);
    const k1 = await fetchKunde(r1.kunde_id);
    seedT1 = { payload: p1, result: r1, eingangId: e1 };
    record(
      "T1",
      r1?.ok === true &&
        r1.code === "created" &&
        k1.kundentyp === "privatperson" &&
        k1.kundenstatus === "vorlaeufig",
      r1?.code,
    );

    // T2 Unternehmen
    const e2 = await pipelineEingang(orgA, "t2", ts, ids);
    const p2 = basePayload(ts, "t2", {
      p_kundentyp: "unternehmen",
      p_firmenname: `Vlk Firma T2 ${ts} GmbH`,
      p_vorname: null,
      p_nachname: null,
    });
    const { data: r2 } = await createVorlaeufig(service, orgA, e2, p2);
    trackCreateResult(ids, r2);
    const k2 = await fetchKunde(r2.kunde_id);
    record("T2", r2?.ok && k2.kundentyp === "unternehmen", k2.firmenname?.slice(0, 30));

    // T3 sonstiges
    const e3 = await pipelineEingang(orgA, "t3", ts, ids);
    const p3 = basePayload(ts, "t3", {
      p_kundentyp: "sonstiges",
      p_anzeigename: `Sonst T3 ${ts}`,
      p_vorname: null,
      p_nachname: null,
    });
    const { data: r3 } = await createVorlaeufig(service, orgA, e3, p3);
    trackCreateResult(ids, r3);
    record("T3", r3?.ok && (await fetchKunde(r3.kunde_id)).kundentyp === "sonstiges", r3?.code);

    record(
      "kundendaten",
      results.T1?.ok && results.T2?.ok && results.T3?.ok,
      "T1–T3",
    );

    // T4–T10 Validierung
    async function negTest(id, suffix, payload, expectField) {
      const eId = await pipelineEingang(orgA, suffix, ts, ids);
      const { data } = await createVorlaeufig(service, orgA, eId, payload);
      return data?.ok === false && data?.code === "validation_error" && data?.field === expectField;
    }

    record(
      "T4",
      await negTest("T4", "t4", { ...basePayload(ts, "t4"), p_vorname: null }, "vorname"),
      "vorname",
    );
    record(
      "T5",
      await negTest("T5", "t5", { ...basePayload(ts, "t5"), p_nachname: null }, "nachname"),
      "nachname",
    );
    record(
      "T6",
      await negTest(
        "T6",
        "t6",
        {
          ...basePayload(ts, "t6"),
          p_kundentyp: "unternehmen",
          p_firmenname: null,
          p_vorname: null,
          p_nachname: null,
        },
        "firmenname",
      ),
      "firmenname",
    );
    record(
      "T7",
      await negTest(
        "T7",
        "t7",
        {
          ...basePayload(ts, "t7"),
          p_kundentyp: "sonstiges",
          p_anzeigename: null,
          p_vorname: null,
          p_nachname: null,
        },
        "anzeigename",
      ),
      "anzeigename",
    );
    record(
      "T8",
      await negTest(
        "T8",
        "t8",
        { ...basePayload(ts, "t8"), p_email: null, p_telefon: null, p_mobil: null },
        "kontakt",
      ),
      "kontakt",
    );
    record(
      "T9",
      await negTest("T9", "t9", { ...basePayload(ts, "t9"), p_vorname: "unbekannt" }, "vorname"),
      "vorname",
    );
    record(
      "T10",
      await negTest("T10", "t10", { ...basePayload(ts, "t10"), p_email: "n/a" }, "email"),
      "email",
    );

    // T11–T13 Nummerierung
    record("T11", r1?.kundennummer === expectedKnr(seq0 + 1), r1?.kundennummer);
    record("T12", r2?.kundennummer === expectedKnr(seq0 + 2), r2?.kundennummer);

    const e13 = await pipelineEingang(orgB, "t13", ts, ids);
    const seqB0 = await getKundenSeq(orgB);
    const { data: r13 } = await createVorlaeufig(
      service,
      orgB,
      e13,
      basePayload(ts, "t13b"),
    );
    trackCreateResult(ids, r13);
    record("T13", r13?.kundennummer === expectedKnr(seqB0 + 1), r13?.kundennummer);

    // T14 parallele Nummern (separate Eingänge)
    const parSuffixes = ["p14a", "p14b", "p14c"];
    const parEingaenge = await Promise.all(
      parSuffixes.map((s) => pipelineEingang(orgA, s, ts, ids)),
    );
    const seq14Before = await getKundenSeq(orgA);
    const par14 = await Promise.all(
      parEingaenge.map((eId, i) =>
        createVorlaeufig(service, orgA, eId, basePayload(ts, parSuffixes[i])),
      ),
    );
    par14.forEach(({ data }) => trackCreateResult(ids, data));
    const nums14 = par14.map((r) => r.data?.kundennummer).filter(Boolean);
    const seq14After = await getKundenSeq(orgA);
    record(
      "T14",
      par14.every((r) => r.data?.code === "created") &&
        new Set(nums14).size === 3 &&
        seq14After === seq14Before + 3,
      `nums=${nums14.join(",")}, seq=${seq14Before}→${seq14After}`,
    );
    record("nummerierung", results.T11?.ok && results.T12?.ok && results.T13?.ok && results.T14?.ok, "T11–T14");

    // T15–T18 Adresse/Gebäude
    const adr1 = await fetchAdresse(r1.adresse_id);
    record("T15", !!adr1?.id && adr1.strasse === p1.p_strasse, adr1?.id);
    record(
      "T16",
      !!adr1?.strasse_normalisiert &&
        !!adr1?.hausnummer_normalisiert &&
        !!adr1?.adress_fingerprint,
      adr1?.adress_fingerprint,
    );

    const e17 = await pipelineEingang(orgA, "t17", ts, ids);
    const p17 = basePayload(ts, "t17", {
      p_email: `only-addr-${ts}@example.test`,
      p_strasse: p1.p_strasse,
      p_hausnummer: p1.p_hausnummer,
      p_plz: p1.p_plz,
      p_ort: p1.p_ort,
    });
    const kCountBefore17 = await countKunden(orgA);
    const { data: r17 } = await createVorlaeufig(service, orgA, e17, p17);
    trackCreateResult(ids, r17);
    record(
      "T17",
      r17?.ok === true && (await countKunden(orgA)) === kCountBefore17 + 1,
      r17?.code,
    );

    const { data: geb1 } = await service
      .from("gebaeude")
      .select("*")
      .eq("id", r1.gebaeude_id)
      .single();
    record(
      "T18",
      geb1?.gebaeudeart === "einfamilienhaus" && geb1.adresse_id === r1.adresse_id,
      geb1?.gebaeudeart,
    );
    record("adresseGebaeude", results.T15?.ok && results.T16?.ok && results.T17?.ok && results.T18?.ok, "T15–T18");

    // T19–T25 Einheit/Objektrolle
    const e19 = await pipelineEingang(orgA, "t19", ts, ids);
    const { data: r19 } = await createVorlaeufig(
      service,
      orgA,
      e19,
      basePayload(ts, "t19", {
        p_gebaeudeart: "mehrfamilienhaus",
        p_einheit_anlegen: true,
        p_einheit_bezeichnung: `Whg-T19-${ts}`,
        p_einheit_typ: "wohnung",
      }),
    );
    trackCreateResult(ids, r19);
    record("T19", r19?.ok && r19.einheit_id, String(r19?.einheit_id));

    record(
      "T20",
      await negTest(
        "T20",
        "t20",
        {
          ...basePayload(ts, "t20"),
          p_einheit_anlegen: false,
          p_einheit_bezeichnung: "X",
        },
        "einheit_anlegen",
      ),
      "einheit_anlegen",
    );
    record(
      "T21",
      await negTest(
        "T21",
        "t21",
        { ...basePayload(ts, "t21"), p_gebaeudeart: "invalid" },
        "gebaeudeart",
      ),
      "gebaeudeart",
    );
    record(
      "T22",
      await negTest(
        "T22",
        "t22",
        {
          ...basePayload(ts, "t22"),
          p_einheit_anlegen: true,
          p_einheit_bezeichnung: "X",
          p_einheit_typ: "invalid",
        },
        "einheit_typ",
      ),
      "einheit_typ",
    );

    const e23 = await pipelineEingang(orgA, "t23", ts, ids);
    const { data: r23 } = await createVorlaeufig(
      service,
      orgA,
      e23,
      basePayload(ts, "t23", { p_objektrolle: "eigentuemer" }),
    );
    trackCreateResult(ids, r23);
    const bez23 = r23?.kunden_objekt_beziehung_id
      ? await service
          .from("kunden_objekt_beziehungen")
          .select("*")
          .eq("id", r23.kunden_objekt_beziehung_id)
          .single()
      : { data: null };
    record("T23", bez23.data?.rolle === "eigentuemer", bez23.data?.rolle);

    const e24 = await pipelineEingang(orgA, "t24", ts, ids);
    const { data: r24 } = await createVorlaeufig(
      service,
      orgA,
      e24,
      basePayload(ts, "t24", {
        p_gebaeudeart: "mehrfamilienhaus",
        p_einheit_anlegen: true,
        p_einheit_bezeichnung: `Whg-T24-${ts}`,
        p_einheit_typ: "wohnung",
        p_objektrolle: "mieter",
      }),
    );
    trackCreateResult(ids, r24);
    const bez24 = r24?.kunden_objekt_beziehung_id
      ? await service
          .from("kunden_objekt_beziehungen")
          .select("*")
          .eq("id", r24.kunden_objekt_beziehung_id)
          .single()
      : { data: null };
    record(
      "T24",
      bez24.data?.rolle === "mieter" && bez24.data?.einheit_id === r24.einheit_id,
      JSON.stringify({ rolle: bez24.data?.rolle, einheit: bez24.data?.einheit_id }),
    );

    const e25 = await pipelineEingang(orgA, "t25", ts, ids);
    const { data: r25 } = await createVorlaeufig(service, orgA, e25, basePayload(ts, "t25"));
    trackCreateResult(ids, r25);
    record("T25", r25?.ok && r25.kunden_objekt_beziehung_id === null, "null");

    record(
      "objektbeziehung",
      results.T19?.ok &&
        results.T20?.ok &&
        results.T21?.ok &&
        results.T22?.ok &&
        results.T23?.ok &&
        results.T24?.ok &&
        results.T25?.ok,
      "T19–T25",
    );

    // T26–T30 Dubletten
    const e26 = await pipelineEingang(orgA, "t26", ts, ids);
    const p26 = basePayload(ts, "t26", {
      p_email: p1.p_email,
      p_strasse: p1.p_strasse,
      p_hausnummer: p1.p_hausnummer,
      p_plz: p1.p_plz,
      p_ort: p1.p_ort,
    });
    const kMid26 = await countKunden(orgA);
    const { data: d26 } = await createVorlaeufig(service, orgA, e26, p26);
    const kAfter26 = await countKunden(orgA);
    record(
      "T26",
      d26?.ok === false &&
        d26?.code === "conflict" &&
        d26?.field === "dublettenpruefung" &&
        d26?.requires_manual_review === true,
      JSON.stringify(d26),
    );

    const e27 = await pipelineEingang(orgA, "t27", ts, ids);
    const { data: r27 } = await createVorlaeufig(
      service,
      orgA,
      e27,
      basePayload(ts, "t27", {
        p_email: `unique-t27-${ts}@example.test`,
        p_strasse: p1.p_strasse,
        p_hausnummer: p1.p_hausnummer,
        p_plz: p1.p_plz,
        p_ort: p1.p_ort,
      }),
    );
    trackCreateResult(ids, r27);
    record("T27", r27?.ok === true, r27?.code);

    const e28 = await pipelineEingang(orgA, "t28", ts, ids);
    const { data: r28 } = await createVorlaeufig(
      service,
      orgA,
      e28,
      basePayload(ts, "t28", {
        p_email: p1.p_email,
        p_strasse: "Andere Str.",
        p_hausnummer: "99",
      }),
    );
    trackCreateResult(ids, r28);
    record("T28", r28?.ok === true, r28?.code);

    // T29 widersprüchliche Treffer (direkter Seed-Kunde B)
    const { data: seedB } = await service
      .from("kunden")
      .insert({
        mandant_id: orgA,
        kundennummer: `VLK-SEED-B-${ts}`,
        kundentyp: "privatperson",
        vorname: "Widerspr",
        nachname: `B-${ts}`,
        anzeigename: `Widerspr B-${ts}`,
        email: `widerspr-b-${ts}@example.test`,
        kundenstatus: "bestaetigt",
        aktiv: true,
      })
      .select("id")
      .single();
    if (seedB?.id) ids.kunden.push(seedB.id);

    const e29 = await pipelineEingang(orgA, "t29", ts, ids);
    const { data: d29 } = await createVorlaeufig(
      service,
      orgA,
      e29,
      basePayload(ts, "t29", {
        p_email: p1.p_email,
        p_vorname: "Widerspr",
        p_nachname: `B-${ts}`,
      }),
    );
    record(
      "T29",
      d29?.ok === false && d29?.code === "conflict" && d29?.field === "dublettenpruefung",
      JSON.stringify(d29),
    );

    record(
      "T30",
      kMid26 === kAfter26,
      `kein Merge bei Dublette: ${kMid26}→${kAfter26}`,
    );
    record(
      "dubletten",
      results.T26?.ok &&
        results.T27?.ok &&
        results.T28?.ok &&
        results.T29?.ok &&
        results.T30?.ok,
      "T26–T30",
    );

    // T31–T34 Eingang-Aktualisierung
    const e31 = await pipelineEingang(orgA, "t31", ts, ids, {
      p_zuordnungsgrund: { regelversion: "v1", marker: "behalten" },
    });
    const before31 = await fetchEingang(e31);
    const { data: r31 } = await createVorlaeufig(service, orgA, e31, basePayload(ts, "t31"));
    trackCreateResult(ids, r31);
    const after31 = await fetchEingang(e31);
    record(
      "T31",
      after31.zuordnungsstatus === "bestaetigt" &&
        after31.zugeordnet_kunde_id === r31.kunde_id &&
        after31.zugeordnet_gebaeude_id === r31.gebaeude_id,
      JSON.stringify({
        zs: after31.zuordnungsstatus,
        k: after31.zugeordnet_kunde_id,
      }),
    );

    const e32 = await pipelineEingang(orgA, "t32", ts, ids, {
      p_vollstaendigkeitsstatus: "vollstaendig",
    });
    const { data: r32 } = await createVorlaeufig(service, orgA, e32, basePayload(ts, "t32"));
    trackCreateResult(ids, r32);
    record("T32", (await fetchEingang(e32)).status === "bereit_fuer_vorgang", r32?.status);

    const e33 = await pipelineEingang(orgA, "t33", ts, ids, {
      p_vollstaendigkeitsstatus: "unvollstaendig",
    });
    const { data: r33 } = await createVorlaeufig(service, orgA, e33, basePayload(ts, "t33"));
    trackCreateResult(ids, r33);
    record("T33", (await fetchEingang(e33)).status === "wartet_auf_informationen", r33?.status);

    const e34 = await pipelineEingang(orgA, "t34", ts, ids, {
      p_zuordnungsgrund: { regelversion: "v1", marker: "t34" },
    });
    const { data: r34 } = await createVorlaeufig(service, orgA, e34, basePayload(ts, "t34"));
    trackCreateResult(ids, r34);
    const after34 = await fetchEingang(e34);
    const best = after34.zuordnungsgrund?.bestaetigung;
    record(
      "T34",
      after34.zuordnungsgrund?.marker === "t34" &&
        best?.quelle === "neuanlage" &&
        best?.art === "neuanlage" &&
        !!best?.zeitpunkt,
      JSON.stringify(best),
    );
    record(
      "eingangUpdate",
      results.T31?.ok && results.T32?.ok && results.T33?.ok && results.T34?.ok,
      "T31–T34",
    );

    // T35–T36 Status ablehnen
    const e35 = await createEingang(orgA, "t35", ts);
    ids.anfrageeingaenge.push(e35.anfrageeingang_id);
    const { data: d35 } = await createVorlaeufig(
      service,
      orgA,
      e35.anfrageeingang_id,
      basePayload(ts, "t35"),
    );
    record(
      "T35",
      d35?.ok === false && d35?.code === "invalid_status_transition",
      JSON.stringify(d35),
    );

    const e36 = await pipelineEingang(orgA, "t36", ts, ids, {
      p_zuordnungsstatus: "nicht_erforderlich",
    });
    const { data: d36 } = await createVorlaeufig(service, orgA, e36, basePayload(ts, "t36"));
    record(
      "T36",
      d36?.ok === false && d36?.code === "invalid_status_transition",
      JSON.stringify(d36),
    );

    // T37 Idempotenz Replay
    const e37 = await pipelineEingang(orgA, "t37", ts, ids);
    const seq37Before = await getKundenSeq(orgA);
    const p37 = basePayload(ts, "t37");
    const { data: c37a } = await createVorlaeufig(service, orgA, e37, p37);
    trackCreateResult(ids, c37a);
    const kCount37a = await countKunden(orgA);
    const { data: c37b } = await createVorlaeufig(service, orgA, e37, p37);
    const seq37After = await getKundenSeq(orgA);
    record(
      "T37",
      c37a?.code === "created" &&
        c37b?.ok === true &&
        c37b?.code === "already_confirmed" &&
        c37b?.idempotent === true &&
        c37b?.kunde_id === c37a?.kunde_id &&
        (await countKunden(orgA)) === kCount37a &&
        seq37Before + 1 === seq37After,
      `seq ${seq37Before}→${seq37After}`,
    );

    // T38 parallele identische Aufrufe
    const e38 = await pipelineEingang(orgA, "t38", ts, ids);
    const p38 = basePayload(ts, "t38");
    const seq38Before = await getKundenSeq(orgA);
    const kBefore38 = await countKunden(orgA);
    const [p38a, p38b] = await Promise.all([
      createVorlaeufig(service, orgA, e38, p38),
      createVorlaeufig(service, orgA, e38, p38),
    ]);
    trackCreateResult(ids, p38a.data);
    const seq38After = await getKundenSeq(orgA);
    const codes38 = [p38a.data?.code, p38b.data?.code].sort();
    const kAfter38 = await countKunden(orgA);
    const { count: adrCnt38 } = await service
      .from("adressen")
      .select("*", { count: "exact", head: true })
      .eq("mandant_id", orgA)
      .in("id", ids.adressen);
    record(
      "T38",
      codes38.includes("created") &&
        codes38.includes("already_confirmed") &&
        p38a.data?.kunde_id === p38b.data?.kunde_id &&
        kAfter38 === kBefore38 + 1 &&
        seq38After === seq38Before + 1,
      `codes=${codes38.join(",")}, k=${kBefore38}→${kAfter38}, adrTracked=${adrCnt38}`,
    );
    record("idempotenz", results.T37?.ok && results.T38?.ok, "T37–T38");

    // T39 Rollback (pre-sequenz Validierung)
    const e39 = await pipelineEingang(orgA, "t39", ts, ids);
    const seq39Before = await getKundenSeq(orgA);
    const row39Before = await fetchEingang(e39);
    const { data: d39 } = await createVorlaeufig(
      service,
      orgA,
      e39,
      basePayload(ts, "t39", { p_vorname: "unbekannt" }),
    );
    const seq39After = await getKundenSeq(orgA);
    const row39After = await fetchEingang(e39);
    const { count: k39 } = await service
      .from("kunden")
      .select("*", { count: "exact", head: true })
      .eq("mandant_id", orgA)
      .like("vorname", "Vk-t39%");
    record(
      "T39",
      d39?.ok === false &&
        seq39Before === seq39After &&
        row39After.zuordnungsstatus === row39Before.zuordnungsstatus &&
        row39After.zugeordnet_kunde_id === null &&
        (k39 ?? 0) === 0,
      `${notes.rollbackGrenze}`,
    );
    record("rollback", results.T39?.ok, notes.rollbackGrenze);

    // T40 Berechtigungen + E2E Vorgang
    const e40perm = await pipelineEingang(orgA, "t40perm", ts, ids);
    const email = `vlk-test-${ts}@example.com`;
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
    const { error: anonErr } = await createVorlaeufig(anon, orgA, e40perm, basePayload(ts, "t40perm"));
    const { error: authErr } = await createVorlaeufig(authed, orgA, e40perm, basePayload(ts, "t40perm"));
    const { data: svc40, error: svc40Err } = await createVorlaeufig(
      service,
      orgA,
      e40perm,
      basePayload(ts, "t40perm"),
    );
    trackCreateResult(ids, svc40);

    const e40e2e = await pipelineEingang(orgA, "t40e2e", ts, ids, {
      p_vollstaendigkeitsstatus: "vollstaendig",
    });
    const { data: r40e2e } = await createVorlaeufig(service, orgA, e40e2e, basePayload(ts, "t40e2e"));
    trackCreateResult(ids, r40e2e);
    const { data: vorg40, error: vorg40Err } = await service.rpc(
      "erstelle_vorgang_aus_anfrageeingang",
      {
        p_mandant_id: orgA,
        p_anfrageeingang_id: e40e2e,
        p_titel: "E2E nach Vorläufig",
      },
    );
    if (vorg40?.vorgang_id) {
      ids.vorgaenge.push(vorg40.vorgang_id);
      const y = new Date().getFullYear();
      ids.vorgangsnummer_sequenzen.push({ mandant_id: orgA, jahr: y });
    }

    record(
      "T40",
      !!anonErr &&
        !!authErr &&
        !svc40Err &&
        svc40?.ok === true &&
        !vorg40Err &&
        vorg40?.ok === true &&
        vorg40?.code === "created" &&
        /permission denied|42501/i.test(anonErr.message ?? ""),
      `perm ok, vorg=${vorg40?.code}`,
    );
    record(
      "berechtigungen",
      !!anonErr && !!authErr && svc40?.ok,
      "anon/auth denied, svc ok",
    );
    record("e2e", vorg40?.ok === true, vorg40?.vorgangsnummer ?? vorg40Err?.message);
  } finally {
    await cleanup(ids);
    await cleanupOrphans();

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
    }

    const { count: cOrg } = await service
      .from("organizations")
      .select("*", { count: "exact", head: true })
      .like("name", "__test_vlk_%");
    record("cleanup", (cOrg ?? 0) === 0, `orgs=${cOrg ?? 0}`);

    const regScripts = [
      "test-create-anfrageeingang-rpc.mjs",
      "test-update-anfrageeingang-bewertung-rpc.mjs",
      "test-bestaetige-anfrageeingang-zuordnung-rpc.mjs",
      "test-erstelle-vorgang-aus-anfrageeingang-rpc.mjs",
    ];
    const regResults = regScripts.map((s) => ({ script: s, ...runRegression(s) }));
    const regOk = regResults.every((r) => r.ok);
    record("regression", regOk, regResults.map((r) => `${r.script}:${r.status}`).join(", "));
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

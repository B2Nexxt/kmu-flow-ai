/**
 * Integrationstest RPC public.bestaetige_anfrageeingang_zuordnung
 * Migration 20260717340000_bestaetige_anfrageeingang_zuordnung_rpc.sql
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
  Array.from({ length: 34 }, (_, i) => [`T${i + 1}`, null]),
);
const extra = {
  zielstatus: null,
  stammdaten: null,
  idempotenz: null,
  parallel: null,
  jsonMeta: null,
  berechtigungen: null,
  bestandsschutz: null,
  adminSmoke: null,
  cleanup: null,
};
const notes = {
  terminalDirectInsert:
    "T16/T17: terminaler Status nur per direktem INSERT (nicht über vorhandene RPCs erreichbar)",
};
let passed = true;
let beforeSnap = null;

function record(key, ok, detail = "") {
  if (key in results) results[key] = { ok, detail };
  else if (key in extra) extra[key] = { ok, detail };
  else extra[key] = { ok, detail };
  if (!ok) passed = false;
}

function zweiMerkmaleGrund(extra = {}) {
  return {
    merkmale: [
      { typ: "email", ergebnis: "uebereinstimmung" },
      { typ: "objektadresse", ergebnis: "uebereinstimmung" },
    ],
    widersprueche: [],
    regelversion: "v1",
    ...extra,
  };
}

function baseBewertung(overrides = {}) {
  return {
    p_strukturierte_daten: { quelle: "test" },
    p_zuordnungsstatus: "kein_treffer",
    p_zuordnungsgrund: { regelversion: "v1" },
    p_zuordnungskandidaten: [],
    p_vollstaendigkeitsstatus: "vollstaendig",
    p_fehlende_angaben: [],
    p_dringlichkeit: "normal",
    p_manuelle_pruefung_erforderlich: false,
    ...overrides,
  };
}

async function createEingang(mandantId, suffix, ts) {
  const { data, error } = await service.rpc("create_anfrageeingang", {
    p_mandant_id: mandantId,
    p_kanal: "email",
    p_rohinhalt: `conf-test-${suffix}-${ts}`,
    p_betreff: `Conf-${suffix}`,
  });
  if (error) throw error;
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

async function bestaetige(
  client,
  mandantId,
  anfrageeingangId,
  kundeId,
  gebaeudeId,
  einheitId = null,
  quelle = "manuell",
) {
  const { data, error } = await client.rpc("bestaetige_anfrageeingang_zuordnung", {
    p_mandant_id: mandantId,
    p_anfrageeingang_id: anfrageeingangId,
    p_kunde_id: kundeId,
    p_gebaeude_id: gebaeudeId,
    p_einheit_id: einheitId,
    p_bestaetigungsquelle: quelle,
  });
  return { data, error };
}

async function fetchRow(id) {
  const { data, error } = await service.from("anfrageeingaenge").select("*").eq("id", id).single();
  if (error) throw error;
  return data;
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

function trackSeq(ids, mandantId, jahr) {
  const key = `${mandantId}|${jahr}`;
  if (!ids.sequenzKeys.has(key)) {
    ids.sequenzKeys.add(key);
    ids.eingangsnummer_sequenzen.push({ mandant_id: mandantId, jahr });
  }
}

async function cleanup(ids) {
  if (ids.anfrageeingaenge.length) {
    await service.from("anfrageeingaenge").delete().in("id", ids.anfrageeingaenge);
  }
  for (const row of ids.eingangsnummer_sequenzen) {
    await service
      .from("eingangsnummer_sequenzen")
      .delete()
      .eq("mandant_id", row.mandant_id)
      .eq("jahr", row.jahr);
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

async function createOrg(ts, suffix) {
  const { data, error } = await service
    .from("organizations")
    .insert({ name: `__test_conf_${suffix}_${ts}`, status: "interessent" })
    .select("id")
    .single();
  if (error) throw error;
  return data.id;
}

async function setupStammdaten(ts, orgA, orgB, ids) {
  const { data: kA } = await service
    .from("kunden")
    .insert({
      mandant_id: orgA,
      kundennummer: `CONF-KA-${ts}`,
      kundentyp: "privatperson",
      vorname: "Aktiv",
      nachname: "Kunde",
      anzeigename: "Aktiv Kunde",
    })
    .select("id")
    .single();
  const { data: kA2 } = await service
    .from("kunden")
    .insert({
      mandant_id: orgA,
      kundennummer: `CONF-KA2-${ts}`,
      kundentyp: "privatperson",
      vorname: "Zweit",
      nachname: "Kunde",
      anzeigename: "Zweit Kunde",
    })
    .select("id")
    .single();
  const { data: kArch } = await service
    .from("kunden")
    .insert({
      mandant_id: orgA,
      kundennummer: `CONF-KARCH-${ts}`,
      kundentyp: "privatperson",
      vorname: "Arch",
      nachname: "Kunde",
      anzeigename: "Arch Kunde",
      aktiv: false,
      archiviert_am: new Date().toISOString(),
    })
    .select("id")
    .single();
  const { data: kB } = await service
    .from("kunden")
    .insert({
      mandant_id: orgB,
      kundennummer: `CONF-KB-${ts}`,
      kundentyp: "privatperson",
      vorname: "Fremd",
      nachname: "Kunde",
      anzeigename: "Fremd Kunde",
    })
    .select("id")
    .single();
  ids.kunden.push(kA.id, kA2.id, kArch.id, kB.id);

  const insAdr = (mid, n) =>
    service
      .from("adressen")
      .insert({
        mandant_id: mid,
        strasse: "Confstr.",
        hausnummer: String(n),
        plz: "10115",
        ort: "Berlin",
      })
      .select("id")
      .single();
  const { data: adrA } = await insAdr(orgA, 1);
  const { data: adrA2 } = await insAdr(orgA, 2);
  const { data: adrB } = await insAdr(orgB, 3);
  ids.adressen.push(adrA.id, adrA2.id, adrB.id);

  const insGeb = (mid, adrId, arch = false) =>
    service
      .from("gebaeude")
      .insert({
        mandant_id: mid,
        adresse_id: adrId,
        gebaeudeart: "einfamilienhaus",
        ...(arch
          ? { aktiv: false, archiviert_am: new Date().toISOString() }
          : {}),
      })
      .select("id")
      .single();
  const { data: gebA } = await insGeb(orgA, adrA.id);
  const { data: gebA2 } = await insGeb(orgA, adrA2.id);
  const { data: gebArch } = await insGeb(orgA, adrA.id, true);
  const { data: gebB } = await insGeb(orgB, adrB.id);
  ids.gebaeude.push(gebA.id, gebA2.id, gebArch.id, gebB.id);

  const insEin = (mid, gebId, name, arch = false) =>
    service
      .from("einheiten")
      .insert({
        mandant_id: mid,
        gebaeude_id: gebId,
        bezeichnung: name,
        einheit_typ: "wohnung",
        ...(arch
          ? { aktiv: false, archiviert_am: new Date().toISOString() }
          : {}),
      })
      .select("id")
      .single();
  const { data: einA } = await insEin(orgA, gebA.id, `Whg-A-${ts}`);
  const { data: einWrong } = await insEin(orgA, gebA2.id, `Whg-wrong-${ts}`);
  const { data: einArch } = await insEin(orgA, gebA.id, `Whg-arch-${ts}`, true);
  const { data: einB } = await insEin(orgB, gebB.id, `Whg-B-${ts}`);
  ids.einheiten.push(einA.id, einWrong.id, einArch.id, einB.id);

  return {
    kA: kA.id,
    kA2: kA2.id,
    kArch: kArch.id,
    kB: kB.id,
    gebA: gebA.id,
    gebA2: gebA2.id,
    gebArch: gebArch.id,
    gebB: gebB.id,
    einA: einA.id,
    einWrong: einWrong.id,
    einArch: einArch.id,
    einB: einB.id,
  };
}

async function pipeline(mandantId, suffix, ts, ids, bewOverrides = {}) {
  const e = await createEingang(mandantId, suffix, ts);
  ids.anfrageeingaenge.push(e.anfrageeingang_id);
  trackSeq(ids, mandantId, new Date().getFullYear());
  const { data: bData, error: bErr } = await bewertung(mandantId, e.anfrageeingang_id, bewOverrides);
  if (bErr) throw bErr;
  if (!bData?.ok) throw new Error(`bewertung fehlgeschlagen (${suffix}): ${JSON.stringify(bData)}`);
  return e.anfrageeingang_id;
}

async function main() {
  const ts = Date.now();
  const ids = {
    orgs: [],
    anfrageeingaenge: [],
    eingangsnummer_sequenzen: [],
    sequenzKeys: new Set(),
    vorgang_beteiligte: [],
    vorgaenge: [],
    beziehungen: [],
    einheiten: [],
    gebaeude: [],
    adressen: [],
    kunden: [],
    authUserId: null,
  };

  try {
    beforeSnap = await snapshotCounts();
    const orgA = await createOrg(ts, "a");
    const orgB = await createOrg(ts, "b");
    ids.orgs.push(orgA, orgB);
    const sd = await setupStammdaten(ts, orgA, orgB, ids);
    record("stammdaten", true, "2 Mandanten, Kunden/Gebäude/Einheiten aktiv+archiviert");

    // T1–T4
    const e1 = await pipeline(orgA, "t1", ts, ids, {
      p_zuordnungsstatus: "eindeutig",
      p_zuordnungsgrund: zweiMerkmaleGrund({ marker: "t1-grund" }),
      p_vollstaendigkeitsstatus: "vollstaendig",
    });
    const { data: c1, error: c1Err } = await bestaetige(
      service,
      orgA,
      e1,
      sd.kA,
      sd.gebA,
      sd.einA,
      "manuell-test",
    );
    const r1 = await fetchRow(e1);
    record("T1", !c1Err && c1?.code === "confirmed", c1Err?.message ?? c1?.code);
    record("T2", r1.zuordnungsstatus === "bestaetigt", r1.zuordnungsstatus);
    record(
      "T3",
      r1.zugeordnet_kunde_id === sd.kA && r1.zugeordnet_gebaeude_id === sd.gebA,
      JSON.stringify({ k: r1.zugeordnet_kunde_id, g: r1.zugeordnet_gebaeude_id }),
    );
    record("T4", r1.zugeordnet_einheit_id === sd.einA, String(r1.zugeordnet_einheit_id));

    // T5–T9 Zielstatus
    async function testVoll(voll, key, expected) {
      const eId = await pipeline(orgA, key, ts, ids, {
        p_zuordnungsstatus: "eindeutig",
        p_zuordnungsgrund: zweiMerkmaleGrund(),
        p_vollstaendigkeitsstatus: voll,
      });
      const { data, error } = await bestaetige(service, orgA, eId, sd.kA, sd.gebA);
      const row = await fetchRow(eId);
      return {
        ok: !error && data?.status === expected && row.status === expected,
        detail: row.status,
      };
    }
    const t5 = await testVoll("vollstaendig", "t5", "bereit_fuer_vorgang");
    record("T5", t5.ok, t5.detail);
    const t6 = await testVoll("ausreichend_fuer_vorgang", "t6", "bereit_fuer_vorgang");
    record("T6", t6.ok, t6.detail);
    const t7 = await testVoll("unvollstaendig", "t7", "wartet_auf_informationen");
    record("T7", t7.ok, t7.detail);
    const t8 = await testVoll("ausreichend_fuer_rueckfrage", "t8", "wartet_auf_informationen");
    record("T8", t8.ok, t8.detail);
    const t9 = await testVoll("unbekannt", "t9", "wartet_auf_informationen");
    record("T9", t9.ok, t9.detail);
    record(
      "zielstatus",
      results.T5?.ok && results.T6?.ok && results.T7?.ok && results.T8?.ok && results.T9?.ok,
      "T5–T9",
    );

    // T10–T13 Zuordnungsstatus
    for (const [key, zuordnung, testId] of [
      ["t10", "moeglicher_treffer", "T10"],
      ["t11", "mehrere_treffer", "T11"],
      ["t12", "konflikt", "T12"],
      ["t13", "kein_treffer", "T13"],
    ]) {
      const eId = await pipeline(orgA, key, ts, ids, {
        p_zuordnungsstatus: zuordnung,
        p_zuordnungsgrund: zuordnung === "eindeutig" ? zweiMerkmaleGrund() : { regelversion: "v1" },
        p_vollstaendigkeitsstatus: "vollstaendig",
      });
      const { data, error } = await bestaetige(service, orgA, eId, sd.kA, sd.gebA);
      record(testId, !error && data?.code === "confirmed", data?.code ?? error?.message);
    }

    // T14 nicht_erforderlich
    const e14 = await pipeline(orgA, "t14", ts, ids, {
      p_zuordnungsstatus: "nicht_erforderlich",
      p_vollstaendigkeitsstatus: "vollstaendig",
    });
    const { data: t14 } = await bestaetige(service, orgA, e14, sd.kA, sd.gebA);
    record(
      "T14",
      t14?.ok === false && t14?.code === "invalid_status_transition",
      JSON.stringify(t14),
    );

    // T15 neu
    const e15 = await createEingang(orgA, "t15", ts);
    ids.anfrageeingaenge.push(e15.anfrageeingang_id);
    trackSeq(ids, orgA, new Date().getFullYear());
    const { data: t15 } = await bestaetige(service, orgA, e15.anfrageeingang_id, sd.kA, sd.gebA);
    record(
      "T15",
      t15?.ok === false && t15?.code === "invalid_status_transition",
      JSON.stringify(t15),
    );

    // T16/T17 terminal — direkter INSERT (Ausnahme dokumentiert)
    const beendet = new Date().toISOString();
    const { data: vorg } = await service
      .from("vorgaenge")
      .insert({
        mandant_id: orgA,
        vorgangsnummer: `CONF-V-${ts}`,
        vorgangstyp: "anfrage",
        gebaeude_id: sd.gebA,
        titel: "T16",
      })
      .select("id")
      .single();
    if (vorg?.id) ids.vorgaenge.push(vorg.id);

    const { data: e16 } = await service
      .from("anfrageeingaenge")
      .insert({
        mandant_id: orgA,
        eingangsnummer: `CONF-T16-${ts}`,
        kanal: "email",
        status: "in_vorgang_ueberfuehrt",
        rohinhalt: "terminal",
        rohinhalt_gesperrt_am: beendet,
        zugeordneter_vorgang_id: vorg.id,
        beendet_am: beendet,
      })
      .select("id")
      .single();
    if (e16?.id) ids.anfrageeingaenge.push(e16.id);
    const { data: t16 } = await bestaetige(service, orgA, e16.id, sd.kA, sd.gebA);
    record(
      "T16",
      t16?.ok === false && t16?.code === "invalid_status_transition",
      JSON.stringify(t16),
    );

    const { data: e17 } = await service
      .from("anfrageeingaenge")
      .insert({
        mandant_id: orgA,
        eingangsnummer: `CONF-T17-${ts}`,
        kanal: "email",
        status: "verworfen",
        rohinhalt: "verworfen",
        rohinhalt_gesperrt_am: beendet,
        beendet_am: beendet,
      })
      .select("id")
      .single();
    if (e17?.id) ids.anfrageeingaenge.push(e17.id);
    const { data: t17 } = await bestaetige(service, orgA, e17.id, sd.kA, sd.gebA);
    record(
      "T17",
      t17?.ok === false && t17?.code === "invalid_status_transition",
      JSON.stringify(t17),
    );

    // T18–T19 not_found
    const e18base = await pipeline(orgA, "t18base", ts, ids, {
      p_zuordnungsstatus: "eindeutig",
      p_zuordnungsgrund: zweiMerkmaleGrund(),
    });
    const fakeK = "00000000-0000-4000-8000-000000000010";
    const fakeG = "00000000-0000-4000-8000-000000000011";
    const { data: t18 } = await bestaetige(service, orgA, e18base, fakeK, sd.gebA);
    const { data: t19 } = await bestaetige(service, orgA, e18base, sd.kA, fakeG);
    record("T18", t18?.ok === false && t18?.code === "not_found", JSON.stringify(t18));
    record("T19", t19?.ok === false && t19?.code === "not_found", JSON.stringify(t19));

    // T20–T21 archived
    const e20 = await pipeline(orgA, "t20", ts, ids, {
      p_zuordnungsstatus: "eindeutig",
      p_zuordnungsgrund: zweiMerkmaleGrund(),
    });
    const { data: t20 } = await bestaetige(service, orgA, e20, sd.kArch, sd.gebA);
    const e21 = await pipeline(orgA, "t21", ts, ids, {
      p_zuordnungsstatus: "eindeutig",
      p_zuordnungsgrund: zweiMerkmaleGrund(),
    });
    const { data: t21 } = await bestaetige(service, orgA, e21, sd.kA, sd.gebArch);
    record("T20", t20?.ok === false && t20?.code === "conflict", JSON.stringify(t20));
    record("T21", t21?.ok === false && t21?.code === "conflict", JSON.stringify(t21));

    // T22–T25 einheit
    const e22 = await pipeline(orgA, "t22", ts, ids, {
      p_zuordnungsstatus: "eindeutig",
      p_zuordnungsgrund: zweiMerkmaleGrund(),
    });
    const { data: c22 } = await bestaetige(service, orgA, e22, sd.kA, sd.gebA, sd.einA);
    record("T22", c22?.ok === true, JSON.stringify(c22));

    const e23 = await pipeline(orgA, "t23", ts, ids, {
      p_zuordnungsstatus: "eindeutig",
      p_zuordnungsgrund: zweiMerkmaleGrund(),
    });
    const { data: t23 } = await bestaetige(service, orgA, e23, sd.kA, sd.gebA, sd.einWrong);
    record(
      "T23",
      t23?.ok === false && t23?.code === "conflict" && t23?.field === "einheit_id",
      JSON.stringify(t23),
    );

    const e24 = await pipeline(orgA, "t24", ts, ids, {
      p_zuordnungsstatus: "eindeutig",
      p_zuordnungsgrund: zweiMerkmaleGrund(),
    });
    const { data: t24 } = await bestaetige(service, orgA, e24, sd.kA, sd.gebA, sd.einB);
    record(
      "T24",
      t24?.ok === false && t24?.code === "cross_tenant_reference" && t24?.field === "einheit_id",
      JSON.stringify(t24),
    );

    const e25 = await pipeline(orgA, "t25", ts, ids, {
      p_zuordnungsstatus: "eindeutig",
      p_zuordnungsgrund: zweiMerkmaleGrund(),
    });
    const { data: t25 } = await bestaetige(service, orgA, e25, sd.kA, sd.gebA, sd.einArch);
    record("T25", t25?.ok === false && t25?.code === "conflict", JSON.stringify(t25));

    // T26–T27 cross tenant kunde/gebaeude
    const e26 = await pipeline(orgA, "t26", ts, ids, {
      p_zuordnungsstatus: "eindeutig",
      p_zuordnungsgrund: zweiMerkmaleGrund(),
    });
    const { data: t26 } = await bestaetige(service, orgA, e26, sd.kB, sd.gebA);
    const e27 = await pipeline(orgA, "t27", ts, ids, {
      p_zuordnungsstatus: "eindeutig",
      p_zuordnungsgrund: zweiMerkmaleGrund(),
    });
    const { data: t27 } = await bestaetige(service, orgA, e27, sd.kA, sd.gebB);
    record(
      "T26",
      t26?.ok === false && t26?.code === "cross_tenant_reference",
      JSON.stringify(t26),
    );
    record(
      "T27",
      t27?.ok === false && t27?.code === "cross_tenant_reference",
      JSON.stringify(t27),
    );

    // T28 idempotent replay
    const e28 = await pipeline(orgA, "t28", ts, ids, {
      p_zuordnungsstatus: "eindeutig",
      p_zuordnungsgrund: zweiMerkmaleGrund(),
    });
    const { data: c28a } = await bestaetige(service, orgA, e28, sd.kA, sd.gebA);
    const row28a = await fetchRow(e28);
    const { data: c28b } = await bestaetige(service, orgA, e28, sd.kA, sd.gebA);
    const row28b = await fetchRow(e28);
    record(
      "T28",
      c28a?.code === "confirmed" &&
        c28b?.ok === true &&
        c28b?.code === "already_confirmed" &&
        c28b?.idempotent === true &&
        row28a.zugeordnet_kunde_id === row28b.zugeordnet_kunde_id &&
        row28a.status === row28b.status,
      JSON.stringify(c28b),
    );

    // T29 conflict replay
    const e29 = await pipeline(orgA, "t29", ts, ids, {
      p_zuordnungsstatus: "eindeutig",
      p_zuordnungsgrund: zweiMerkmaleGrund(),
    });
    await bestaetige(service, orgA, e29, sd.kA, sd.gebA);
    const { data: t29 } = await bestaetige(service, orgA, e29, sd.kA2, sd.gebA);
    record(
      "T29",
      t29?.ok === false && t29?.code === "conflict" && t29?.field === "zuordnung",
      JSON.stringify(t29),
    );
    record(
      "idempotenz",
      results.T28?.ok && results.T29?.ok,
      "T28–T29",
    );

    // T30 parallel identical
    const e30 = await pipeline(orgA, "t30", ts, ids, {
      p_zuordnungsstatus: "eindeutig",
      p_zuordnungsgrund: zweiMerkmaleGrund(),
    });
    const [p30a, p30b] = await Promise.all([
      bestaetige(service, orgA, e30, sd.kA, sd.gebA),
      bestaetige(service, orgA, e30, sd.kA, sd.gebA),
    ]);
    const row30 = await fetchRow(e30);
    const codes30 = [p30a.data?.code, p30b.data?.code].sort();
    const t30Ok =
      codes30.includes("confirmed") &&
      codes30.includes("already_confirmed") &&
      row30.zuordnungsstatus === "bestaetigt" &&
      row30.zugeordnet_kunde_id === sd.kA;

    // T31 parallel different
    const e31 = await pipeline(orgA, "t31", ts, ids, {
      p_zuordnungsstatus: "eindeutig",
      p_zuordnungsgrund: zweiMerkmaleGrund(),
    });
    const [p31a, p31b] = await Promise.all([
      bestaetige(service, orgA, e31, sd.kA, sd.gebA),
      bestaetige(service, orgA, e31, sd.kA2, sd.gebA),
    ]);
    const row31 = await fetchRow(e31);
    const codes31 = [p31a.data?.code, p31b.data?.code].sort();
    const t31Ok =
      codes31.includes("confirmed") &&
      codes31.includes("conflict") &&
      (row31.zugeordnet_kunde_id === sd.kA || row31.zugeordnet_kunde_id === sd.kA2) &&
      row31.zugeordnet_kunde_id !== null;

    record("T30", t30Ok, `codes=${codes30.join(",")}, kunde=${row30.zugeordnet_kunde_id}`);
    record("T31", t31Ok, `codes=${codes31.join(",")}, kunde=${row31.zugeordnet_kunde_id}`);
    record("parallel", t30Ok && t31Ok, `T30=${t30Ok}, T31=${t31Ok}`);

    // T32 JSON metadata
    const e32 = await pipeline(orgA, "t32", ts, ids, {
      p_zuordnungsstatus: "eindeutig",
      p_zuordnungsgrund: zweiMerkmaleGrund({ bewertung_marker: "behalten" }),
      p_vollstaendigkeitsstatus: "vollstaendig",
    });
    await bestaetige(service, orgA, e32, sd.kA, sd.gebA, null, "manuell-json");
    const row32 = await fetchRow(e32);
    const t32Ok =
      row32.zuordnungsgrund?.regelversion === "v1" &&
      row32.zuordnungsgrund?.bewertung_marker === "behalten" &&
      row32.zuordnungsgrund?.bestaetigung?.quelle === "manuell-json" &&
      row32.zuordnungsgrund?.bestaetigung?.zeitpunkt != null;
    record("T32", t32Ok, JSON.stringify(row32.zuordnungsgrund));
    record("jsonMeta", t32Ok, "bestaetigung ergänzt, bestehendes erhalten");

    // T33 atomic FK + bestaetigt
    const e33 = await pipeline(orgA, "t33", ts, ids, {
      p_zuordnungsstatus: "eindeutig",
      p_zuordnungsgrund: zweiMerkmaleGrund(),
    });
    const { data: c33 } = await bestaetige(service, orgA, e33, sd.kA, sd.gebA);
    const row33 = await fetchRow(e33);
    const t33Ok =
      c33?.ok &&
      row33.zuordnungsstatus === "bestaetigt" &&
      row33.zugeordnet_kunde_id === sd.kA &&
      row33.zugeordnet_gebaeude_id === sd.gebA;
    record("T33", t33Ok, JSON.stringify({
      zs: row33.zuordnungsstatus,
      k: row33.zugeordnet_kunde_id,
      g: row33.zugeordnet_gebaeude_id,
    }));

    // T34 permissions
    const email = `conf-test-${ts}@example.com`;
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
    const e34 = await pipeline(orgA, "t34", ts, ids, {
      p_zuordnungsstatus: "kein_treffer",
      p_vollstaendigkeitsstatus: "vollstaendig",
    });
    const { error: anonErr } = await bestaetige(anon, orgA, e34, sd.kA, sd.gebA);
    const { error: authErr } = await bestaetige(authed, orgA, e34, sd.kA, sd.gebA);
    const { data: svc34, error: svc34Err } = await bestaetige(service, orgA, e34, sd.kA, sd.gebA);
    const permOk =
      !!anonErr &&
      !!authErr &&
      !svc34Err &&
      svc34?.ok === true &&
      /permission denied|42501/i.test(anonErr.message ?? "");
    record(
      "T34",
      permOk,
      `anon=${anonErr?.code ?? "ok"} auth=${authErr?.code ?? "ok"} svc=${svc34?.code}`,
    );
    record("berechtigungen", permOk, anonErr?.message?.slice(0, 80) ?? "");
  } finally {
    await cleanup(ids);

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
      .like("name", "__test_conf_%");
    record("cleanup", (cOrg ?? 0) === 0, `orgs=${cOrg ?? 0}`);
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

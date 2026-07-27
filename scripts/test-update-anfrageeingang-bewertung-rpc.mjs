/**
 * Integrationstest RPC public.update_anfrageeingang_bewertung
 * Migration 20260717330000_update_anfrageeingang_bewertung_rpc.sql
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
  zweiMerkmale: null,
  statusermittlung: null,
  parallel: null,
  fkSchutz: null,
  berechtigungen: null,
  bestandsschutz: null,
  adminSmoke: null,
  cleanup: null,
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
    p_rohinhalt: `bew-test-${suffix}-${ts}`,
    p_betreff: `Bew-${suffix}`,
  });
  if (error) throw error;
  return data;
}

async function bewertung(client, mandantId, anfrageeingangId, overrides = {}) {
  const payload = {
    p_mandant_id: mandantId,
    p_anfrageeingang_id: anfrageeingangId,
    ...baseBewertung(overrides),
  };
  const { data, error } = await client.rpc("update_anfrageeingang_bewertung", payload);
  return { data, error };
}

async function fetchRow(id) {
  const { data, error } = await service
    .from("anfrageeingaenge")
    .select("*")
    .eq("id", id)
    .single();
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

function trackSeq(ids, mandantId, jahr) {
  const key = `${mandantId}|${jahr}`;
  if (!ids.sequenzKeys.has(key)) {
    ids.sequenzKeys.add(key);
    ids.eingangsnummer_sequenzen.push({ mandant_id: mandantId, jahr });
  }
}

async function createTestOrg(ts, suffix) {
  const { data, error } = await service
    .from("organizations")
    .insert({ name: `__test_bew_${suffix}_${ts}`, status: "interessent" })
    .select("id")
    .single();
  if (error) throw error;
  return data.id;
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

    const orgA = await createTestOrg(ts, "a");
    const orgB = await createTestOrg(ts, "b");
    ids.orgs.push(orgA, orgB);

    // T1–T3: gültige Bewertung, neu → analysiert, rohinhalt gesperrt
    const e1 = await createEingang(orgA, "t1", ts);
    ids.anfrageeingaenge.push(e1.anfrageeingang_id);
    trackSeq(ids, orgA, new Date().getFullYear());
    const before1 = await fetchRow(e1.anfrageeingang_id);
    const { data: t1, error: t1Err } = await bewertung(
      service,
      orgA,
      e1.anfrageeingang_id,
      {
        p_zuordnungsstatus: "kein_treffer",
        p_vollstaendigkeitsstatus: "vollstaendig",
      },
    );
    const after1 = await fetchRow(e1.anfrageeingang_id);
    record("T1", !t1Err && t1?.ok === true && t1?.code === "updated", t1Err?.message ?? t1?.code);
    record(
      "T2",
      after1.status === "analysiert" && before1.status === "neu",
      `${before1.status}→${after1.status}`,
    );
    record(
      "T3",
      before1.rohinhalt_gesperrt_am == null && after1.rohinhalt_gesperrt_am != null,
      String(after1.rohinhalt_gesperrt_am),
    );

    // T4, T5
    async function testStatusFromVoll(name, voll, expectedStatus) {
      const e = await createEingang(orgA, name, ts);
      ids.anfrageeingaenge.push(e.anfrageeingang_id);
      const { data, error } = await bewertung(service, orgA, e.anfrageeingang_id, {
        p_vollstaendigkeitsstatus: voll,
        p_zuordnungsstatus: "kein_treffer",
      });
      const row = await fetchRow(e.anfrageeingang_id);
      return { ok: !error && data?.status === expectedStatus && row.status === expectedStatus, detail: row.status };
    }
    const t4 = await testStatusFromVoll("t4", "unvollstaendig", "wartet_auf_informationen");
    record("T4", t4.ok, t4.detail);
    const t5 = await testStatusFromVoll("t5", "ausreichend_fuer_rueckfrage", "wartet_auf_informationen");
    record("T5", t5.ok, t5.detail);

    // T6–T9
    async function testManuell(zuordnung, testKey) {
      const e = await createEingang(orgA, testKey, ts);
      ids.anfrageeingaenge.push(e.anfrageeingang_id);
      const { data, error } = await bewertung(service, orgA, e.anfrageeingang_id, {
        p_zuordnungsstatus: zuordnung,
        p_vollstaendigkeitsstatus: "vollstaendig",
        p_manuelle_pruefung_erforderlich: false,
      });
      const row = await fetchRow(e.anfrageeingang_id);
      return {
        ok:
          !error &&
          data?.status === "zur_manuellen_pruefung" &&
          row.status === "zur_manuellen_pruefung" &&
          row.manuelle_pruefung_erforderlich === true,
        detail: JSON.stringify({ status: row.status, manuell: row.manuelle_pruefung_erforderlich }),
      };
    }
    const t6 = await testManuell("moeglicher_treffer", "t6");
    record("T6", t6.ok, t6.detail);
    const t7 = await testManuell("mehrere_treffer", "t7");
    record("T7", t7.ok, t7.detail);
    const t8 = await testManuell("konflikt", "t8");
    record("T8", t8.ok, t8.detail);
    record(
      "T9",
      t6.ok && t7.ok && t8.ok,
      "moeglicher/mehrere/konflikt erzwingen manuelle_pruefung=true",
    );
    record(
      "statusermittlung",
      results.T2?.ok &&
        results.T4?.ok &&
        results.T5?.ok &&
        results.T6?.ok &&
        results.T7?.ok &&
        results.T8?.ok,
      "T2,T4–T8",
    );

    // T10–T14 Zwei-Merkmale
    const e10 = await createEingang(orgA, "t10", ts);
    ids.anfrageeingaenge.push(e10.anfrageeingang_id);
    const { data: t10, error: t10Err } = await bewertung(service, orgA, e10.anfrageeingang_id, {
      p_zuordnungsstatus: "eindeutig",
      p_zuordnungsgrund: zweiMerkmaleGrund(),
    });
    record("T10", !t10Err && t10?.ok === true, t10Err?.message ?? JSON.stringify(t10));

    const e11 = await createEingang(orgA, "t11", ts);
    ids.anfrageeingaenge.push(e11.anfrageeingang_id);
    const { data: t11 } = await bewertung(service, orgA, e11.anfrageeingang_id, {
      p_zuordnungsstatus: "eindeutig",
      p_zuordnungsgrund: {
        merkmale: [{ typ: "email", ergebnis: "uebereinstimmung" }],
        widersprueche: [],
      },
    });
    record(
      "T11",
      t11?.ok === false && t11?.code === "insufficient_data" && t11?.field === "zuordnungsgrund",
      JSON.stringify(t11),
    );

    const e12 = await createEingang(orgA, "t12", ts);
    ids.anfrageeingaenge.push(e12.anfrageeingang_id);
    const { data: t12 } = await bewertung(service, orgA, e12.anfrageeingang_id, {
      p_zuordnungsstatus: "eindeutig",
      p_zuordnungsgrund: {
        merkmale: [
          { typ: "email", ergebnis: "uebereinstimmung" },
          { typ: "email", ergebnis: "uebereinstimmung" },
        ],
        widersprueche: [],
      },
    });
    record(
      "T12",
      t12?.ok === false && t12?.code === "insufficient_data",
      JSON.stringify(t12),
    );

    const e13 = await createEingang(orgA, "t13", ts);
    ids.anfrageeingaenge.push(e13.anfrageeingang_id);
    const { data: t13 } = await bewertung(service, orgA, e13.anfrageeingang_id, {
      p_zuordnungsstatus: "eindeutig",
      p_zuordnungsgrund: {
        merkmale: [
          { typ: "email", ergebnis: "uebereinstimmung" },
          { typ: "objektadresse", ergebnis: "uebereinstimmung" },
        ],
        widersprueche: [{ typ: "konflikt", beschreibung: "test" }],
      },
    });
    record(
      "T13",
      t13?.ok === false && t13?.code === "insufficient_data",
      JSON.stringify(t13),
    );

    const e14 = await createEingang(orgA, "t14", ts);
    ids.anfrageeingaenge.push(e14.anfrageeingang_id);
    const { data: t14 } = await bewertung(service, orgA, e14.anfrageeingang_id, {
      p_zuordnungsstatus: "eindeutig",
      p_confidence_score: 1,
      p_zuordnungsgrund: {
        merkmale: [{ typ: "email", ergebnis: "uebereinstimmung" }],
        widersprueche: [],
      },
    });
    record(
      "T14",
      t14?.ok === false && t14?.code === "insufficient_data",
      JSON.stringify(t14),
    );

    record(
      "zweiMerkmale",
      results.T10?.ok &&
        results.T11?.ok &&
        results.T12?.ok &&
        results.T13?.ok &&
        results.T14?.ok,
      "T10–T14",
    );

    // T15–T22 Validierung
    const e15 = await createEingang(orgA, "t15", ts);
    ids.anfrageeingaenge.push(e15.anfrageeingang_id);
    const { data: t15 } = await bewertung(service, orgA, e15.anfrageeingang_id, {
      p_zuordnungsstatus: "bestaetigt",
    });
    record(
      "T15",
      t15?.ok === false && t15?.code === "validation_error" && t15?.field === "zuordnungsstatus",
      JSON.stringify(t15),
    );

    const eVal = await createEingang(orgA, "val", ts);
    ids.anfrageeingaenge.push(eVal.anfrageeingang_id);

    const { data: t16 } = await bewertung(service, orgA, eVal.anfrageeingang_id, {
      p_strukturierte_daten: [],
    });
    record("T16", t16?.ok === false && t16?.field === "strukturierte_daten", JSON.stringify(t16));

    const { data: t17 } = await bewertung(service, orgA, eVal.anfrageeingang_id, {
      p_zuordnungsgrund: [],
    });
    record("T17", t17?.ok === false && t17?.field === "zuordnungsgrund", JSON.stringify(t17));

    const { data: t18 } = await bewertung(service, orgA, eVal.anfrageeingang_id, {
      p_zuordnungskandidaten: {},
    });
    record("T18", t18?.ok === false && t18?.field === "zuordnungskandidaten", JSON.stringify(t18));

    const { data: t19 } = await bewertung(service, orgA, eVal.anfrageeingang_id, {
      p_fehlende_angaben: {},
    });
    record("T19", t19?.ok === false && t19?.field === "fehlende_angaben", JSON.stringify(t19));

    const { data: t20 } = await bewertung(service, orgA, eVal.anfrageeingang_id, {
      p_vollstaendigkeitsstatus: "invalid",
    });
    record("T20", t20?.ok === false && t20?.code === "validation_error", JSON.stringify(t20));

    const { data: t21 } = await bewertung(service, orgA, eVal.anfrageeingang_id, {
      p_dringlichkeit: "invalid",
    });
    record("T21", t21?.ok === false && t21?.field === "dringlichkeit", JSON.stringify(t21));

    const { data: t22a } = await bewertung(service, orgA, eVal.anfrageeingang_id, {
      p_confidence_score: -0.1,
    });
    const { data: t22b } = await bewertung(service, orgA, eVal.anfrageeingang_id, {
      p_confidence_score: 1.1,
    });
    record(
      "T22",
      t22a?.ok === false && t22b?.ok === false && t22a?.field === "confidence_score",
      JSON.stringify(t22a),
    );

    // T23–T24
    const e23 = await createEingang(orgA, "t23", ts);
    ids.anfrageeingaenge.push(e23.anfrageeingang_id);
    const { data: t23 } = await bewertung(service, orgB, e23.anfrageeingang_id);
    record(
      "T23",
      t23?.ok === false && t23?.code === "cross_tenant_reference",
      JSON.stringify(t23),
    );

    const fakeId = "00000000-0000-4000-8000-000000000099";
    const { data: t24 } = await bewertung(service, orgA, fakeId);
    record(
      "T24",
      t24?.ok === false && t24?.code === "not_found",
      JSON.stringify(t24),
    );

    // T25–T27 terminal statuses (direct insert)
    const empfangen = `${new Date().getFullYear()}-06-01T10:00:00.000Z`;
    const beendet = new Date().toISOString();

    const { data: e25 } = await service
      .from("anfrageeingaenge")
      .insert({
        mandant_id: orgA,
        eingangsnummer: `BEW-T25-${ts}`,
        kanal: "email",
        status: "bereit_fuer_vorgang",
        rohinhalt: "terminal-bereit",
        rohinhalt_gesperrt_am: beendet,
      })
      .select("id")
      .single();
    if (e25?.id) ids.anfrageeingaenge.push(e25.id);
    const { data: t25 } = await bewertung(service, orgA, e25.id);
    record(
      "T25",
      t25?.ok === false && t25?.code === "invalid_status_transition",
      JSON.stringify(t25),
    );

    const { data: adr } = await service
      .from("adressen")
      .insert({
        mandant_id: orgA,
        strasse: "Bewstr.",
        hausnummer: "1",
        plz: "10115",
        ort: "Berlin",
      })
      .select("id")
      .single();
    if (adr?.id) ids.adressen.push(adr.id);
    const { data: geb } = await service
      .from("gebaeude")
      .insert({ mandant_id: orgA, adresse_id: adr.id, gebaeudeart: "einfamilienhaus" })
      .select("id")
      .single();
    if (geb?.id) ids.gebaeude.push(geb.id);
    const { data: vorg } = await service
      .from("vorgaenge")
      .insert({
        mandant_id: orgA,
        vorgangsnummer: `BEW-V-${ts}`,
        vorgangstyp: "anfrage",
        gebaeude_id: geb.id,
        titel: "T26",
      })
      .select("id")
      .single();
    if (vorg?.id) ids.vorgaenge.push(vorg.id);

    const { data: e26 } = await service
      .from("anfrageeingaenge")
      .insert({
        mandant_id: orgA,
        eingangsnummer: `BEW-T26-${ts}`,
        kanal: "email",
        status: "in_vorgang_ueberfuehrt",
        rohinhalt: "terminal-vorgang",
        rohinhalt_gesperrt_am: beendet,
        zugeordneter_vorgang_id: vorg.id,
        beendet_am: beendet,
      })
      .select("id")
      .single();
    if (e26?.id) ids.anfrageeingaenge.push(e26.id);
    const { data: t26 } = await bewertung(service, orgA, e26.id);
    record(
      "T26",
      t26?.ok === false && t26?.code === "invalid_status_transition",
      JSON.stringify(t26),
    );

    const { data: e27 } = await service
      .from("anfrageeingaenge")
      .insert({
        mandant_id: orgA,
        eingangsnummer: `BEW-T27-${ts}`,
        kanal: "email",
        status: "verworfen",
        rohinhalt: "terminal-verworfen",
        rohinhalt_gesperrt_am: beendet,
        beendet_am: beendet,
      })
      .select("id")
      .single();
    if (e27?.id) ids.anfrageeingaenge.push(e27.id);
    const { data: t27 } = await bewertung(service, orgA, e27.id);
    record(
      "T27",
      t27?.ok === false && t27?.code === "invalid_status_transition",
      JSON.stringify(t27),
    );

    // T28 replay
    const e28 = await createEingang(orgA, "t28", ts);
    ids.anfrageeingaenge.push(e28.anfrageeingang_id);
    const replayPayload = {
      p_zuordnungsstatus: "nicht_erforderlich",
      p_vollstaendigkeitsstatus: "ausreichend_fuer_vorgang",
      p_strukturierte_daten: { replay: true },
    };
    const { data: t28a, error: t28aErr } = await bewertung(
      service,
      orgA,
      e28.anfrageeingang_id,
      replayPayload,
    );
    await new Promise((r) => setTimeout(r, 50));
    const { data: t28b, error: t28bErr } = await bewertung(
      service,
      orgA,
      e28.anfrageeingang_id,
      replayPayload,
    );
    const row28 = await fetchRow(e28.anfrageeingang_id);
    const t28Ok =
      !t28aErr &&
      !t28bErr &&
      t28a?.status === t28b?.status &&
      row28.zuordnungsstatus === "nicht_erforderlich" &&
      row28.status === "analysiert";
    record(
      "T28",
      t28Ok,
      `status=${row28.status}, zuletzt=${row28.zuletzt_bearbeitet_am}`,
    );

    // T29 FK-Schutz
    const e29 = await createEingang(orgA, "t29", ts);
    ids.anfrageeingaenge.push(e29.anfrageeingang_id);
    await bewertung(service, orgA, e29.anfrageeingang_id, {
      p_zuordnungsstatus: "eindeutig",
      p_zuordnungsgrund: zweiMerkmaleGrund(),
      p_zuordnungskandidaten: [{ kunde_id: "00000000-0000-4000-8000-000000000002" }],
    });
    const row29 = await fetchRow(e29.anfrageeingang_id);
    const t29Ok =
      row29.zugeordnet_kunde_id == null &&
      row29.zugeordnet_gebaeude_id == null &&
      row29.zugeordnet_einheit_id == null &&
      row29.zugeordneter_vorgang_id == null;
    record("T29", t29Ok, JSON.stringify({
      k: row29.zugeordnet_kunde_id,
      g: row29.zugeordnet_gebaeude_id,
      e: row29.zugeordnet_einheit_id,
      v: row29.zugeordneter_vorgang_id,
    }));
    record("fkSchutz", t29Ok, "FKs bleiben NULL");

    // T30: permissions + parallel
    const email = `bew-test-${ts}@example.com`;
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

    const e30perm = await createEingang(orgA, "t30perm", ts);
    ids.anfrageeingaenge.push(e30perm.anfrageeingang_id);
    const { error: anonErr } = await bewertung(anon, orgA, e30perm.anfrageeingang_id);
    const { error: authErr } = await bewertung(authed, orgA, e30perm.anfrageeingang_id);
    const { data: svcPerm, error: svcPermErr } = await bewertung(
      service,
      orgA,
      e30perm.anfrageeingang_id,
    );

    const e30par = await createEingang(orgA, "t30par", ts);
    ids.anfrageeingaenge.push(e30par.anfrageeingang_id);
    const payloadA = {
      p_strukturierte_daten: { parallel_marker: "A" },
      p_zuordnungsstatus: "moeglicher_treffer",
      p_zuordnungsgrund: { regelversion: "v1", parallel: "A" },
      p_zuordnungskandidaten: [{ id: "A" }],
      p_vollstaendigkeitsstatus: "vollstaendig",
      p_fehlende_angaben: ["A"],
      p_dringlichkeit: "hoch",
      p_manuelle_pruefung_erforderlich: false,
    };
    const payloadB = {
      p_strukturierte_daten: { parallel_marker: "B" },
      p_zuordnungsstatus: "kein_treffer",
      p_zuordnungsgrund: { regelversion: "v1", parallel: "B" },
      p_zuordnungskandidaten: [{ id: "B" }],
      p_vollstaendigkeitsstatus: "unvollstaendig",
      p_fehlende_angaben: ["B"],
      p_dringlichkeit: "niedrig",
      p_manuelle_pruefung_erforderlich: false,
    };
    const [parA, parB] = await Promise.all([
      bewertung(service, orgA, e30par.anfrageeingang_id, payloadA),
      bewertung(service, orgA, e30par.anfrageeingang_id, payloadB),
    ]);
    const row30 = await fetchRow(e30par.anfrageeingang_id);

    const matchesA =
      row30.strukturierte_daten?.parallel_marker === "A" &&
      row30.zuordnungsstatus === "moeglicher_treffer" &&
      row30.zuordnungsgrund?.parallel === "A" &&
      row30.vollstaendigkeitsstatus === "vollstaendig" &&
      row30.dringlichkeit === "hoch" &&
      row30.status === "zur_manuellen_pruefung";
    const matchesB =
      row30.strukturierte_daten?.parallel_marker === "B" &&
      row30.zuordnungsstatus === "kein_treffer" &&
      row30.zuordnungsgrund?.parallel === "B" &&
      row30.vollstaendigkeitsstatus === "unvollstaendig" &&
      row30.dringlichkeit === "niedrig" &&
      row30.status === "wartet_auf_informationen";
    const parOk =
      (parA.data?.ok || parB.data?.ok) &&
      (matchesA || matchesB) &&
      !(matchesA && matchesB);

    const permOk =
      !!anonErr &&
      !!authErr &&
      !svcPermErr &&
      svcPerm?.ok === true &&
      /permission denied|42501/i.test(anonErr.message ?? authErr.message ?? "");
    record("T30", permOk && parOk, `perm=${permOk}, par=${parOk}, winner=${matchesA ? "A" : matchesB ? "B" : "none"}`);
    record("berechtigungen", permOk, anonErr?.message?.slice(0, 80) ?? "");
    record(
      "parallel",
      parOk,
      `A.ok=${parA.data?.ok}, B.ok=${parB.data?.ok}, status=${row30.status}`,
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
      .like("name", "__test_bew_%");
    const cleanupOk = (cOrg ?? 0) === 0;
    record("cleanup", cleanupOk, `orgs=${cOrg ?? 0}`);
  }

  const problems = [];
  for (const [k, v] of Object.entries(results)) {
    if (v && !v.ok) problems.push(`${k}: ${v.detail}`);
  }
  for (const [k, v] of Object.entries(extra)) {
    if (v && !v.ok) problems.push(`${k}: ${v.detail}`);
  }

  console.log(JSON.stringify({ passed, results, extra, problems }, null, 2));
  process.exit(passed ? 0 : 1);
}

main().catch((err) => {
  console.log(
    JSON.stringify({ passed: false, fatal: err.message, results, extra, problems: [err.message] }, null, 2),
  );
  process.exit(1);
});

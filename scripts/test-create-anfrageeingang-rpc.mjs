/**
 * Integrationstest RPC public.create_anfrageeingang
 * Migration 20260717320000_create_anfrageeingang_rpc.sql
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
  Array.from({ length: 24 }, (_, i) => [`T${i + 1}`, null]),
);
const extra = {
  parallel: null,
  idempotenz: null,
  validierung: null,
  berechtigungen: null,
  rollback: null,
  bestandsschutz: null,
  adminSmoke: null,
  cleanup: null,
};
const notes = {
  t18Validierungsreihenfolge:
    "kanal → trim-Felder → whitespace-pro-Feld (betreff, rohinhalt, absender_*, kanal_externe_id, inhalt_hash) → mandant → empfangen_am/Jahr → inhalt-mindestens-eins",
  t24Einschraenkung:
    "Rollback via vorab reservierter eingangsnummer (Unique-Verletzung nach Sequenz-UPSERT); Sequenz und Eingang bleiben unverändert",
};
let passed = true;
let beforeSnap = null;
let orphanBefore = null;

function record(key, ok, detail = "") {
  if (key in results) results[key] = { ok, detail };
  else if (key in extra) extra[key] = { ok, detail };
  else extra[key] = { ok, detail };
  if (!ok) passed = false;
}

async function rpc(client, params) {
  const { data, error } = await client.rpc("create_anfrageeingang", params);
  return { data, error };
}

function trackId(ids, row) {
  if (row?.anfrageeingang_id) ids.anfrageeingaenge.push(row.anfrageeingang_id);
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

async function getSeq(mandantId, jahr) {
  const { data } = await service
    .from("eingangsnummer_sequenzen")
    .select("letzter_wert")
    .eq("mandant_id", mandantId)
    .eq("jahr", jahr)
    .maybeSingle();
  return data?.letzter_wert ?? null;
}

function trackSeq(ids, mandantId, jahr) {
  const key = `${mandantId}|${jahr}`;
  if (!ids.sequenzKeys.has(key)) {
    ids.sequenzKeys.add(key);
    ids.eingangsnummer_sequenzen.push({ mandant_id: mandantId, jahr });
  }
}

function uniqueIds(list) {
  return [...new Set(list.filter(Boolean))];
}

async function countTestOrphans() {
  const { data: orgs } = await service
    .from("organizations")
    .select("id")
    .like("name", "__test_rpc_ae_%");
  const orgIds = (orgs ?? []).map((o) => o.id);
  if (!orgIds.length) {
    return { orgs: 0, anfrageeingaenge: 0, sequenzen: 0 };
  }
  const { count: aeCount } = await service
    .from("anfrageeingaenge")
    .select("*", { count: "exact", head: true })
    .in("mandant_id", orgIds);
  const { count: seqCount } = await service
    .from("eingangsnummer_sequenzen")
    .select("*", { count: "exact", head: true })
    .in("mandant_id", orgIds);
  return {
    orgs: orgIds.length,
    anfrageeingaenge: aeCount ?? 0,
    sequenzen: seqCount ?? 0,
    orgIds,
  };
}

/** Reste früherer Läufe: nur eindeutig benannte Test-Organisationen + deren Daten */
async function cleanupOrphans() {
  const orphan = await countTestOrphans();
  if (!orphan.orgIds?.length) return orphan;

  await service.from("anfrageeingaenge").delete().in("mandant_id", orphan.orgIds);
  await service.from("eingangsnummer_sequenzen").delete().in("mandant_id", orphan.orgIds);
  await service.from("organizations").delete().in("id", orphan.orgIds);
  return orphan;
}

async function verifyCleanup(ids) {
  const mandantIds = uniqueIds(ids.orgs);
  let aeCount = 0;
  let seqCount = 0;
  if (mandantIds.length) {
    const { count: cAe } = await service
      .from("anfrageeingaenge")
      .select("*", { count: "exact", head: true })
      .in("mandant_id", mandantIds);
    const { count: cSeq } = await service
      .from("eingangsnummer_sequenzen")
      .select("*", { count: "exact", head: true })
      .in("mandant_id", mandantIds);
    aeCount = cAe ?? 0;
    seqCount = cSeq ?? 0;
  }
  const { count: cOrg } = await service
    .from("organizations")
    .select("*", { count: "exact", head: true })
    .like("name", "__test_rpc_ae_%");
  return {
    orgs: cOrg ?? 0,
    anfrageeingaenge: aeCount,
    sequenzen: seqCount,
  };
}

async function cleanup(ids) {
  const mandantIds = uniqueIds(ids.orgs);
  const eingangIds = uniqueIds(ids.anfrageeingaenge);

  // 1. Anfrageeingänge: gesammelte IDs + alle Testmandanten (fängt Lücken auf)
  if (eingangIds.length) {
    await service.from("anfrageeingaenge").delete().in("id", eingangIds);
  }
  if (mandantIds.length) {
    await service.from("anfrageeingaenge").delete().in("mandant_id", mandantIds);
  }

  // 2. Sequenzen für alle Testmandanten
  if (mandantIds.length) {
    await service.from("eingangsnummer_sequenzen").delete().in("mandant_id", mandantIds);
  } else {
    for (const row of ids.eingangsnummer_sequenzen) {
      await service
        .from("eingangsnummer_sequenzen")
        .delete()
        .eq("mandant_id", row.mandant_id)
        .eq("jahr", row.jahr);
    }
  }

  // 3. Temporäre Organizations
  for (const orgId of mandantIds) {
    await service.from("organizations").delete().eq("id", orgId);
  }

  // 4. Temporärer Auth-User
  if (ids.authUserId) {
    await service.auth.admin.deleteUser(ids.authUserId);
  }
}

async function createTestOrg(ts, suffix) {
  const { data, error } = await service
    .from("organizations")
    .insert({ name: `__test_rpc_ae_${suffix}_${ts}`, status: "interessent" })
    .select("id")
    .single();
  if (error) throw error;
  return data.id;
}

async function main() {
  const ts = Date.now();
  const testJahr = 2026;
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
    orphanBefore = await cleanupOrphans();
    beforeSnap = await snapshotCounts();

    const orgNumA = await createTestOrg(ts, "numA");
    const orgNumB = await createTestOrg(ts, "numB");
    const orgPar = await createTestOrg(ts, "par");
    const orgIdemp = await createTestOrg(ts, "idemp");
    const orgVal = await createTestOrg(ts, "val");
    const orgDef = await createTestOrg(ts, "def");
    const orgRoll = await createTestOrg(ts, "roll");
    ids.orgs.push(orgNumA, orgNumB, orgPar, orgIdemp, orgVal, orgDef, orgRoll);

    const empfangen2026 = `${testJahr}-06-15T10:00:00.000Z`;
    const empfangen2025 = "2025-03-01T12:00:00.000Z";

    // T1 + T2
    const { data: t1, error: t1Err } = await rpc(service, {
      p_mandant_id: orgNumA,
      p_kanal: "email",
      p_rohinhalt: `T1-${ts}`,
      p_empfangen_am: empfangen2026,
    });
    trackId(ids, t1);
    trackSeq(ids, orgNumA, testJahr);
    const t2Expected = `AE-${testJahr}-0001`;
    record(
      "T1",
      !t1Err && t1?.ok === true && t1?.code === "created",
      t1Err?.message ?? JSON.stringify(t1),
    );
    record(
      "T2",
      t1?.eingangsnummer === t2Expected,
      `nummer=${t1?.eingangsnummer}, erwartet=${t2Expected}`,
    );

    // T3
    const { data: t3, error: t3Err } = await rpc(service, {
      p_mandant_id: orgNumA,
      p_kanal: "telefon",
      p_betreff: `T3-${ts}`,
      p_empfangen_am: empfangen2026,
    });
    trackId(ids, t3);
    record(
      "T3",
      !t3Err && t3?.eingangsnummer === `AE-${testJahr}-0002`,
      t3Err?.message ?? t3?.eingangsnummer ?? "fail",
    );

    // T4
    const { data: t4, error: t4Err } = await rpc(service, {
      p_mandant_id: orgNumA,
      p_kanal: "email",
      p_rohinhalt: `T4-${ts}`,
      p_empfangen_am: empfangen2025,
    });
    trackId(ids, t4);
    trackSeq(ids, orgNumA, 2025);
    record(
      "T4",
      !t4Err && t4?.eingangsnummer === "AE-2025-0001",
      t4Err?.message ?? t4?.eingangsnummer ?? "fail",
    );

    // T5
    const { data: t5, error: t5Err } = await rpc(service, {
      p_mandant_id: orgNumB,
      p_kanal: "email",
      p_rohinhalt: `T5-${ts}`,
      p_empfangen_am: empfangen2026,
    });
    trackId(ids, t5);
    trackSeq(ids, orgNumB, testJahr);
    record(
      "T5",
      !t5Err && t5?.eingangsnummer === `AE-${testJahr}-0001`,
      t5Err?.message ?? t5?.eingangsnummer ?? "fail",
    );

    // T6 parallel
    const parCount = 10;
    const parResults = await Promise.all(
      Array.from({ length: parCount }, (_, i) =>
        rpc(service, {
          p_mandant_id: orgPar,
          p_kanal: "email",
          p_rohinhalt: `T6-par-${ts}-${i}`,
          p_empfangen_am: empfangen2026,
        }),
      ),
    );
    trackSeq(ids, orgPar, testJahr);
    const parCreated = parResults.filter((r) => r.data?.code === "created");
    const parNums = parCreated.map((r) => r.data.eingangsnummer).sort();
    const parIds = parCreated.map((r) => r.data.anfrageeingang_id);
    ids.anfrageeingaenge.push(...parIds);
    const parUnique = new Set(parNums);
    const parSeq = await getSeq(orgPar, testJahr);
    const t6Ok =
      parCreated.length === parCount &&
      parUnique.size === parCount &&
      parNums[0] === `AE-${testJahr}-0001` &&
      parNums[parNums.length - 1] === `AE-${testJahr}-${String(parCount).padStart(4, "0")}` &&
      parSeq === parCount;
    record(
      "T6",
      t6Ok,
      `created=${parCreated.length}, unique=${parUnique.size}, seq=${parSeq}, nums=${parNums.join(",")}`,
    );
    record("parallel", t6Ok, `T6: ${parCreated.length} parallel, seq=${parSeq}`);

    // T7
    const extId = `ext-${ts}`;
    const { data: t7, error: t7Err } = await rpc(service, {
      p_mandant_id: orgIdemp,
      p_kanal: "email",
      p_rohinhalt: `T7-${ts}`,
      p_kanal_externe_id: extId,
      p_empfangen_am: empfangen2026,
    });
    trackId(ids, t7);
    trackSeq(ids, orgIdemp, testJahr);
    const seqAfterT7 = await getSeq(orgIdemp, testJahr);
    record("T7", !t7Err && t7?.code === "created", t7Err?.message ?? t7?.code ?? "fail");

    // T8
    const { data: t8, error: t8Err } = await rpc(service, {
      p_mandant_id: orgIdemp,
      p_kanal: "email",
      p_rohinhalt: `T8-should-not-matter-${ts}`,
      p_kanal_externe_id: extId,
      p_empfangen_am: empfangen2026,
    });
    const t8Ok =
      !t8Err &&
      t8?.ok === true &&
      t8?.code === "duplicate_external_message" &&
      t8?.idempotent === true &&
      t8?.anfrageeingang_id === t7?.anfrageeingang_id &&
      t8?.eingangsnummer === t7?.eingangsnummer;
    record("T8", t8Ok, t8Err?.message ?? JSON.stringify(t8));

    // T9
    const seqAfterT8 = await getSeq(orgIdemp, testJahr);
    record(
      "T9",
      seqAfterT7 === seqAfterT8 && seqAfterT7 === 1,
      `seq nach T7=${seqAfterT7}, nach T8=${seqAfterT8}`,
    );

    // T10
    const { data: t10, error: t10Err } = await rpc(service, {
      p_mandant_id: orgIdemp,
      p_kanal: "telefon",
      p_rohinhalt: `T10-${ts}`,
      p_kanal_externe_id: extId,
      p_empfangen_am: empfangen2026,
    });
    trackId(ids, t10);
    record(
      "T10",
      !t10Err && t10?.code === "created" && t10?.anfrageeingang_id !== t7?.anfrageeingang_id,
      t10Err?.message ?? JSON.stringify(t10),
    );

    // T11
    const { data: t11, error: t11Err } = await rpc(service, {
      p_mandant_id: orgNumB,
      p_kanal: "email",
      p_rohinhalt: `T11-${ts}`,
      p_kanal_externe_id: extId,
      p_empfangen_am: empfangen2026,
    });
    trackId(ids, t11);
    record(
      "T11",
      !t11Err && t11?.code === "created",
      t11Err?.message ?? JSON.stringify(t11),
    );

    // T12
    const hash = `hash-${ts}`;
    const { data: t12a, error: t12aErr } = await rpc(service, {
      p_mandant_id: orgIdemp,
      p_kanal: "email",
      p_rohinhalt: `T12a-${ts}`,
      p_inhalt_hash: hash,
      p_empfangen_am: empfangen2026,
    });
    const { data: t12b, error: t12bErr } = await rpc(service, {
      p_mandant_id: orgIdemp,
      p_kanal: "sms",
      p_betreff: `T12b-${ts}`,
      p_inhalt_hash: hash,
      p_empfangen_am: empfangen2026,
    });
    trackId(ids, t12a);
    trackId(ids, t12b);
    record(
      "T12",
      !t12aErr &&
        !t12bErr &&
        t12a?.anfrageeingang_id !== t12b?.anfrageeingang_id,
      t12aErr?.message ?? t12bErr?.message ?? "ok",
    );

    record(
      "idempotenz",
      results.T7?.ok && results.T8?.ok && results.T9?.ok && results.T10?.ok && results.T11?.ok && results.T12?.ok,
      "T7–T12",
    );

    // T13
    const { data: t13, error: t13Err } = await rpc(service, {
      p_mandant_id: orgVal,
      p_kanal: "invalid_kanal",
      p_rohinhalt: "x",
    });
    record(
      "T13",
      !t13Err && t13?.ok === false && t13?.code === "validation_error" && t13?.field === "kanal",
      t13Err?.message ?? JSON.stringify(t13),
    );

    // T14
    const fakeMandant = "00000000-0000-4000-8000-000000000001";
    const { data: t14, error: t14Err } = await rpc(service, {
      p_mandant_id: fakeMandant,
      p_kanal: "email",
      p_rohinhalt: "x",
    });
    record(
      "T14",
      !t14Err && t14?.ok === false && t14?.code === "not_found" && t14?.field === "mandant_id",
      t14Err?.message ?? JSON.stringify(t14),
    );

    // T15
    const { data: t15parent, error: t15pErr } = await rpc(service, {
      p_mandant_id: orgVal,
      p_kanal: "email",
      p_rohinhalt: `T15-parent-${ts}`,
      p_empfangen_am: empfangen2026,
    });
    trackId(ids, t15parent);
    trackSeq(ids, orgVal, testJahr);
    const { data: t15, error: t15Err } = await rpc(service, {
      p_mandant_id: orgVal,
      p_kanal: "email",
      p_rohinhalt: `T15-child-${ts}`,
      p_parent_anfrageeingang_id: t15parent?.anfrageeingang_id,
      p_empfangen_am: empfangen2026,
    });
    trackId(ids, t15);
    record("T15", !t15pErr && !t15Err && t15?.code === "created", t15Err?.message ?? "ok");

    // T16
    const { data: t16parent, error: t16pErr } = await rpc(service, {
      p_mandant_id: orgNumB,
      p_kanal: "email",
      p_rohinhalt: `T16-parent-${ts}`,
      p_empfangen_am: empfangen2026,
    });
    trackId(ids, t16parent);
    const { data: t16, error: t16Err } = await rpc(service, {
      p_mandant_id: orgVal,
      p_kanal: "email",
      p_rohinhalt: `T16-child-${ts}`,
      p_parent_anfrageeingang_id: t16parent?.anfrageeingang_id,
      p_empfangen_am: empfangen2026,
    });
    record(
      "T16",
      !t16Err &&
        t16?.ok === false &&
        t16?.code === "cross_tenant_reference" &&
        t16?.field === "parent_anfrageeingang_id",
      t16Err?.message ?? JSON.stringify(t16),
    );

    // T17
    const { data: t17, error: t17Err } = await rpc(service, {
      p_mandant_id: orgVal,
      p_kanal: "email",
    });
    record(
      "T17",
      !t17Err && t17?.ok === false && t17?.code === "validation_error" && t17?.field === "inhalt",
      t17Err?.message ?? JSON.stringify(t17),
    );

    // T18
    const { data: t18a, error: t18aErr } = await rpc(service, {
      p_mandant_id: orgVal,
      p_kanal: "email",
      p_betreff: "   ",
      p_rohinhalt: "fallback",
    });
    const { data: t18b, error: t18bErr } = await rpc(service, {
      p_mandant_id: orgVal,
      p_kanal: "email",
      p_rohinhalt: "   ",
    });
    const { data: t18c, error: t18cErr } = await rpc(service, {
      p_mandant_id: orgVal,
      p_kanal: "email",
      p_rohinhalt: `T18c-${ts}`,
    });
    trackId(ids, t18c);
    trackSeq(ids, orgVal, testJahr);
    const { data: t18row } = await service
      .from("anfrageeingaenge")
      .select("betreff, rohinhalt")
      .eq("id", t18c?.anfrageeingang_id)
      .single();
    const t18Ok =
      !t18aErr &&
      t18a?.ok === false &&
      t18a?.field === "betreff" &&
      !t18bErr &&
      t18b?.ok === false &&
      t18b?.field === "rohinhalt" &&
      !t18cErr &&
      t18c?.code === "created" &&
      t18row?.betreff == null &&
      t18row?.rohinhalt === `T18c-${ts}`;
    record(
      "T18",
      t18Ok,
      `betreff_ws→${t18a?.field}, rohinhalt_ws→${t18b?.field}, optional_null→betreff=${t18row?.betreff}`,
    );

    record(
      "validierung",
      results.T13?.ok &&
        results.T14?.ok &&
        results.T15?.ok &&
        results.T16?.ok &&
        results.T17?.ok &&
        results.T18?.ok,
      "T13–T18",
    );

    // T19–T21 defaults
    const { data: t19row, error: t19Err } = await rpc(service, {
      p_mandant_id: orgDef,
      p_kanal: "kontaktformular",
      p_rohinhalt: `T19-${ts}`,
      p_empfangen_am: empfangen2026,
    });
    trackId(ids, t19row);
    trackSeq(ids, orgDef, testJahr);
    const { data: defRow } = await service
      .from("anfrageeingaenge")
      .select(
        "status, rohinhalt_gesperrt_am, zuordnungsstatus, vollstaendigkeitsstatus, dringlichkeit, manuelle_pruefung_erforderlich, aktiv",
      )
      .eq("id", t19row?.anfrageeingang_id)
      .single();
    record("T19", !t19Err && defRow?.status === "neu", defRow?.status ?? t19Err?.message);
    record(
      "T20",
      defRow?.rohinhalt_gesperrt_am == null,
      String(defRow?.rohinhalt_gesperrt_am),
    );
    record(
      "T21",
      defRow?.zuordnungsstatus === "kein_treffer" &&
        defRow?.vollstaendigkeitsstatus === "unbekannt" &&
        defRow?.dringlichkeit === "normal" &&
        defRow?.manuelle_pruefung_erforderlich === false &&
        defRow?.aktiv === true,
      JSON.stringify(defRow),
    );

    // T22
    const fixedTime = "2024-08-20T08:30:00.000Z";
    const { data: t22a, error: t22aErr } = await rpc(service, {
      p_mandant_id: orgDef,
      p_kanal: "email",
      p_rohinhalt: `T22a-${ts}`,
      p_empfangen_am: fixedTime,
    });
    trackId(ids, t22a);
    trackSeq(ids, orgDef, 2024);
    const { data: t22aRow } = await service
      .from("anfrageeingaenge")
      .select("empfangen_am")
      .eq("id", t22a?.anfrageeingang_id)
      .single();
    const beforeNow = Date.now();
    const { data: t22b, error: t22bErr } = await rpc(service, {
      p_mandant_id: orgDef,
      p_kanal: "email",
      p_rohinhalt: `T22b-${ts}`,
    });
    trackId(ids, t22b);
    const afterNow = Date.now();
    const { data: t22bRow } = await service
      .from("anfrageeingaenge")
      .select("empfangen_am")
      .eq("id", t22b?.anfrageeingang_id)
      .single();
    const t22bTime = new Date(t22bRow?.empfangen_am).getTime();
    record(
      "T22",
      !t22aErr &&
        !t22bErr &&
        t22aRow?.empfangen_am?.startsWith("2024-08-20") &&
        t22bTime >= beforeNow - 5000 &&
        t22bTime <= afterNow + 5000,
      `fixed=${t22aRow?.empfangen_am}, now=${t22bRow?.empfangen_am}`,
    );

    // T23 permissions
    const { error: anonErr } = await anon.rpc("create_anfrageeingang", {
      p_mandant_id: orgDef,
      p_kanal: "email",
      p_rohinhalt: "anon",
    });
    const email = `rpc-ae-test-${ts}@example.com`;
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
    const { error: authErr } = await authed.rpc("create_anfrageeingang", {
      p_mandant_id: orgDef,
      p_kanal: "email",
      p_rohinhalt: "auth",
    });
    const { data: svcOk, error: svcErr } = await rpc(service, {
      p_mandant_id: orgDef,
      p_kanal: "email",
      p_rohinhalt: `T23-svc-${ts}`,
    });
    trackId(ids, svcOk);
    const permMsg = anonErr?.message ?? authErr?.message ?? "";
    const t23Ok =
      !!anonErr &&
      !!authErr &&
      !svcErr &&
      svcOk?.ok === true &&
      /permission denied|42501/i.test(permMsg);
    record(
      "T23",
      t23Ok,
      `anon=${anonErr?.code ?? "ok"} auth=${authErr?.code ?? "ok"} svc=${svcOk?.code ?? svcErr?.message}`,
    );
    record("berechtigungen", t23Ok, permMsg.slice(0, 120));

    // T24 rollback via duplicate eingangsnummer after sequence bump
    const rollJahr = 2027;
    const rollTime = `${rollJahr}-01-10T09:00:00.000Z`;
    await service.from("eingangsnummer_sequenzen").upsert({
      mandant_id: orgRoll,
      jahr: rollJahr,
      letzter_wert: 3,
    });
    trackSeq(ids, orgRoll, rollJahr);
    const reservedNum = `AE-${rollJahr}-0004`;
    const { data: preRow, error: preErr } = await service
      .from("anfrageeingaenge")
      .insert({
        mandant_id: orgRoll,
        eingangsnummer: reservedNum,
        kanal: "email",
        status: "neu",
        rohinhalt: `T24-pre-${ts}`,
        empfangen_am: rollTime,
      })
      .select("id")
      .single();
    if (preRow?.id) ids.anfrageeingaenge.push(preRow.id);
    const seqBeforeFail = await getSeq(orgRoll, rollJahr);
    const countBeforeFail = (
      await service
        .from("anfrageeingaenge")
        .select("*", { count: "exact", head: true })
        .eq("mandant_id", orgRoll)
    ).count;
    const { data: t24fail, error: t24Err } = await rpc(service, {
      p_mandant_id: orgRoll,
      p_kanal: "email",
      p_rohinhalt: `T24-fail-${ts}`,
      p_empfangen_am: rollTime,
    });
    const seqAfterFail = await getSeq(orgRoll, rollJahr);
    const countAfterFail = (
      await service
        .from("anfrageeingaenge")
        .select("*", { count: "exact", head: true })
        .eq("mandant_id", orgRoll)
    ).count;
    const t24Ok =
      !preErr &&
      !!t24Err &&
      !t24fail &&
      seqBeforeFail === 3 &&
      seqAfterFail === 3 &&
      countBeforeFail === countAfterFail;
    record(
      "T24",
      t24Ok,
      `rpcError=${t24Err?.message?.slice(0, 80)}, seq ${seqBeforeFail}→${seqAfterFail}, count ${countBeforeFail}→${countAfterFail}`,
    );
    record("rollback", t24Ok, notes.t24Einschraenkung);
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
      if (results.T24?.ok && !bestandOk) {
        results.T24 = { ok: false, detail: `${results.T24.detail}; bestand nach cleanup fehlgeschlagen` };
        passed = false;
      }
    }

    const cleanupOk =
      cleanupVerify.orgs === 0 &&
      cleanupVerify.anfrageeingaenge === 0 &&
      cleanupVerify.sequenzen === 0;
    record(
      "cleanup",
      cleanupOk,
      `orgs=${cleanupVerify.orgs}, ae(mandant)=${cleanupVerify.anfrageeingaenge}, seq(mandant)=${cleanupVerify.sequenzen}`,
    );
  }

  console.log(
    JSON.stringify(
      {
        passed,
        notes,
        orphanBefore,
        results,
        extra,
        problems: (() => {
          const problems = [];
          for (const [k, v] of Object.entries(results)) {
            if (v && !v.ok) problems.push(`${k}: ${v.detail}`);
          }
          for (const [k, v] of Object.entries(extra)) {
            if (v && !v.ok) problems.push(`${k}: ${v.detail}`);
          }
          return problems;
        })(),
      },
      null,
      2,
    ),
  );
  process.exit(passed ? 0 : 1);
}

main().catch((err) => {
  console.log(
    JSON.stringify(
      { passed: false, fatal: err.message, results, extra, problems: [err.message] },
      null,
      2,
    ),
  );
  process.exit(1);
});

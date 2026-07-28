/**
 * Diagnose: operative Read-RLS — Membership vs Fachtabellen (read-only, kein PII).
 * Ausführen: node scripts/diagnose-operative-read-rls.mjs
 */
import { readFileSync, existsSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import { createClient } from "@supabase/supabase-js";
import { createHash } from "node:crypto";

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

function fp(value) {
  if (!value) return null;
  return createHash("sha256").update(String(value)).digest("hex").slice(0, 12);
}

function idsMatch(a, b) {
  return Boolean(a && b && a === b);
}

async function authedClient(email, password) {
  const { data: signIn, error: signInErr } = await anon.auth.signInWithPassword({
    email,
    password,
  });
  if (signInErr) throw signInErr;
  const token = signIn.session?.access_token;
  const client = createClient(url, anonKey, {
    global: token ? { headers: { Authorization: `Bearer ${token}` } } : undefined,
    auth: { persistSession: false, autoRefreshToken: false },
  });
  return { client, sessionUserId: signIn.user?.id ?? null, role: signIn.user?.role ?? null };
}

async function cleanup(ids) {
  if (ids.anfrageId) {
    await service.from("anfrageeingaenge").delete().eq("id", ids.anfrageId);
  }
  if (ids.vorgangId) {
    await service.from("vorgang_beteiligte").delete().eq("vorgang_id", ids.vorgangId);
    await service.from("vorgaenge").delete().eq("id", ids.vorgangId);
  }
  if (ids.gebaeudeId) {
    await service.from("gebaeude").delete().eq("id", ids.gebaeudeId);
  }
  if (ids.adresseId) {
    await service.from("adressen").delete().eq("id", ids.adresseId);
  }
  if (ids.kundeId) {
    await service.from("kunden").delete().eq("id", ids.kundeId);
  }
  if (ids.membership) {
    await service
      .from("organization_members")
      .delete()
      .eq("organization_id", ids.membership.organization_id)
      .eq("user_id", ids.membership.user_id);
  }
  if (ids.orgId) {
    await service.from("organizations").delete().eq("id", ids.orgId);
  }
  if (ids.authUserId) {
    await service.auth.admin.deleteUser(ids.authUserId);
  }
}

async function main() {
  const ts = Date.now();
  const ids = {};
  const report = { steps: [] };

  function step(name, ok, detail) {
    report.steps.push({ name, ok, detail });
  }

  try {
    const { data: org } = await service
      .from("organizations")
      .insert({ name: `__test_diag_orrls_${ts}`, status: "interessent" })
      .select("id")
      .single();
    ids.orgId = org.id;

    const email = `__test_diag_orrls_${ts}@example.com`;
    const password = `TestPass!${ts}`;
    const { data: authUser } = await service.auth.admin.createUser({
      email,
      password,
      email_confirm: true,
    });
    ids.authUserId = authUser.user.id;

    const { error: memErr } = await service.from("organization_members").insert({
      organization_id: org.id,
      user_id: authUser.user.id,
      role: "buero",
      aktiv: true,
    });
    step("service: membership insert", !memErr, memErr?.message ?? "ok");
    ids.membership = { organization_id: org.id, user_id: authUser.user.id };

    const { data: svcMem } = await service
      .from("organization_members")
      .select("organization_id, user_id, role, aktiv")
      .eq("user_id", authUser.user.id);
    step("service: membership visible", (svcMem?.length ?? 0) === 1, `rows=${svcMem?.length ?? 0}`);

    const { data: adr } = await service
      .from("adressen")
      .insert({
        mandant_id: org.id,
        strasse: "Diag",
        hausnummer: "1",
        plz: "10115",
        ort: "Berlin",
        land: "DE",
      })
      .select("id")
      .single();
    ids.adresseId = adr.id;

    const { data: gebaeude } = await service
      .from("gebaeude")
      .insert({ mandant_id: org.id, adresse_id: adr.id, gebaeudeart: "einfamilienhaus" })
      .select("id")
      .single();
    ids.gebaeudeId = gebaeude.id;

    const { data: vorgang } = await service
      .from("vorgaenge")
      .insert({
        mandant_id: org.id,
        vorgangsnummer: `DIAG-V-${ts}`,
        vorgangstyp: "anfrage",
        gebaeude_id: gebaeude.id,
        titel: "Diag",
      })
      .select("id, mandant_id")
      .single();
    ids.vorgangId = vorgang.id;

    const { data: anfrage } = await service
      .from("anfrageeingaenge")
      .insert({
        mandant_id: org.id,
        eingangsnummer: `DIAG-AE-${ts}`,
        kanal: "email",
      })
      .select("id, mandant_id")
      .single();
    ids.anfrageId = anfrage.id;

    step(
      "service: mandant_id === membership org (fp match)",
      idsMatch(anfrage.mandant_id, org.id) && idsMatch(vorgang.mandant_id, org.id),
      `ae_fp=${fp(anfrage.mandant_id)} org_fp=${fp(org.id)} match=${idsMatch(anfrage.mandant_id, org.id)}`,
    );

    const { client, sessionUserId, role } = await authedClient(email, password);

    step(
      "signIn session user === membership user (fp match)",
      idsMatch(sessionUserId, authUser.user.id),
      `session_fp=${fp(sessionUserId)} member_fp=${fp(authUser.user.id)} role=${role ?? "?"}`,
    );

    const { data: authUserData, error: getUserErr } = await client.auth.getUser();
    step(
      "getUser on authed client",
      !getUserErr && idsMatch(authUserData.user?.id, authUser.user.id),
      getUserErr?.message ?? `user_fp=${fp(authUserData.user?.id)}`,
    );

    const { data: memAuth, error: memAuthErr } = await client
      .from("organization_members")
      .select("organization_id, role, aktiv");
    step(
      "A: authenticated organization_members SELECT",
      !memAuthErr && (memAuth?.length ?? 0) >= 1,
      memAuthErr?.message ?? `rows=${memAuth?.length ?? 0} aktiv=${memAuth?.[0]?.aktiv ?? "?"}`,
    );

    const { data: aeAuth, error: aeAuthErr } = await client
      .from("anfrageeingaenge")
      .select("id, mandant_id");
    step(
      "B: authenticated anfrageeingaenge SELECT",
      !aeAuthErr && (aeAuth?.length ?? 0) >= 1,
      aeAuthErr?.message ?? `rows=${aeAuth?.length ?? 0}`,
    );

    const { data: vAuth, error: vAuthErr } = await client.from("vorgaenge").select("id");
    step(
      "B2: authenticated vorgaenge SELECT",
      !vAuthErr && (vAuth?.length ?? 0) >= 1,
      vAuthErr?.message ?? `rows=${vAuth?.length ?? 0}`,
    );

    if ((memAuth?.length ?? 0) >= 1 && (aeAuth?.length ?? 0) === 0) {
      step(
        "C: nested policy hypothesis",
        false,
        "membership sichtbar, Fachtabelle leer → verschachtelte EXISTS/RLS wahrscheinlich",
      );
    } else if ((memAuth?.length ?? 0) === 0) {
      step(
        "C: session/JWT hypothesis",
        false,
        "membership unsichtbar → auth.uid()/Client vor verschachtelter Policy",
      );
    } else {
      step("C: both visible", true, "kein Policy-Rekursionsproblem im Smoke");
    }

    report.conclusion =
      (memAuth?.length ?? 0) === 0
        ? "TESTCLIENT_OR_JWT"
        : (aeAuth?.length ?? 0) === 0
          ? "NESTED_RLS_EXISTS"
          : "OK";
  } finally {
    await cleanup(ids);
  }

  console.log(JSON.stringify(report, null, 2));
}

main().catch((err) => {
  console.log(JSON.stringify({ fatal: err.message }, null, 2));
  process.exit(1);
});

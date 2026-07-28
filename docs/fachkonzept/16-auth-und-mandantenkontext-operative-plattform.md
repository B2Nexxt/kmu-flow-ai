# Spezifikation: Auth und Mandantenkontext — operative Plattform

Verbindliche **Zielspezifikation** für den Auth-/Mandanten-Sprint der operativen Kundenplattform (`/`).

**Status:** Verbindliche Spezifikation — **Mandantenauswahl-UI implementiert (2026-07-28)**; Live-Daten folgen  
**Bezug:** ADR-0014, ADR-0016, ADR-0020, [`08-rollenmodell.md`](./08-rollenmodell.md), [`12-spezifikation-migration-1-operative-stammdaten.md`](./12-spezifikation-migration-1-operative-stammdaten.md), [`15-spezifikation-m31-anfrageeingang-serverlogik.md`](./15-spezifikation-m31-anfrageeingang-serverlogik.md)

**Nicht-Ziele dieses Dokuments:** Produktive UI-Anbindung, Live-Counts, RLS-DDL, RPCs, Server-Actions-Implementierung, Änderungen unter `/admin`.

---

## 1. Ist-Analyse `organization_members`

### 1.1 Repository

| Aspekt | Ergebnis |
| --- | --- |
| DDL in `supabase/migrations/` | **Nein** — Tabelle wird als **vorbestehend** vorausgesetzt |
| Referenzen | `20260717090000_mandanten_onboarding_mvp.sql`, M1/M2/M3-Migrationen (unverändert), `supabase/migrations/README.md`, `docs/datenmodell.md` |
| Anwendungscode (`app/`, `lib/`) | **0** Lese-/Schreibzugriffe |
| Generierte DB-Typen | **Keine** im Repo |
| Test-Snapshot | `scripts/test-operative-stammdaten-migration.mjs` zählt Zeilen in Bestandsschutz |

### 1.2 Live-Introspection (Stand 2026-07-26 — vorläufig)

Quelle: [`11-analyse-bestehende-endkundenstruktur.md`](./11-analyse-bestehende-endkundenstruktur.md) (read-only PostgREST, aggregierte Zeilen).

| Prüfpunkt | Ergebnis |
| --- | --- |
| Tabelle existiert | **Ja** |
| Zeilenanzahl | **0** |
| Vollständiges Schema | **Nein** (nur Spaltenüberblick) |

→ **Ersetzt durch Abschnitt 1.4** (verbindliche Verifikation 2026-07-28).

### 1.3 Fachliche Einordnung (Projektentscheidung)

| Tabelle | Domäne | Zweck |
| --- | --- | --- |
| `organizations` | SaaS + Tenant-Scope | SaaS-Mandant; `organizations.id` = `mandant_id` operativ |
| `organization_members` | Operativ (Login) | **Mitarbeiter-Login** des Handwerksbetriebs — nicht Endkunde |
| `customers` / `kunden` | Getrennt | CRM-Endkunden — **nicht** Login |

### 1.4 Live-Schema-Verifikation (2026-07-28)

**Methode:** Read-only PostgREST OpenAPI + Spalten-/Constraint-Probing (fehlgeschlagene INSERTs ohne persistierte Zeilen). **Kein** `DATABASE_URL` / kein `pg_catalog`-Zugang im Projekt. Trigger, Indizes (außer PK), `FORCE RLS` und Policy-Texte **nicht vollständig** auslesbar — vor DDL-Sprint im Supabase-Dashboard oder per `pg_catalog` nachziehen.

**Keine personenbezogenen Einzelwerte ausgegeben.**

#### Tabelle

| Aspekt | Ergebnis |
| --- | --- |
| Schema | `public` |
| Name | `organization_members` |
| Zeilen (aggregiert) | **0** |

#### Spalten (live bestätigt)

| Spalte | Typ | NOT NULL | Default | Anmerkung |
| --- | --- | --- | --- | --- |
| `organization_id` | `uuid` | ja | — | PK (Teil 1) |
| `user_id` | `uuid` | ja | — | PK (Teil 2) |
| `role` | `text` | ja | `'member'` | CHECK vorhanden |
| `created_at` | `timestamptz` | ja | `now()` | — |

**Nicht vorhanden (live verifiziert):** `id`, `aktiv`, `updated_at`.

#### Primary Key / Unique

| Objekt | Live |
| --- | --- |
| Primary Key | **Composite** `(organization_id, user_id)` |
| Surrogate `id` | **Nein** |
| Separate UNIQUE neben PK | **Nicht ermittelt** — PK deckt `(organization_id, user_id)` ab |

#### Foreign Keys (live bestätigt)

| Constraint | Referenz |
| --- | --- |
| `organization_members_organization_id_fkey` | `organizations(id)` |
| FK auf `user_id` | **`users`** (Supabase-Auth-Schema; Fehlermeldung: „not present in table users“) |

`ON DELETE`-Regeln und exakter Schema-Pfad (`auth.users` vs. View) **nicht** über PostgREST ermittelt — vor Migration per `pg_catalog` verifizieren.

#### CHECK Constraints (live bestätigt)

| Constraint | Inhalt (aus Probing) |
| --- | --- |
| `organization_members_role_check` | Erlaubt derzeit u. a. **`member`**, **`admin`**, **`owner`** |
| Operative Rollen V1 (`mandanten_admin`, `buero`, …) | **Abgelehnt** (CHECK-Verletzung) |

#### Indizes / Trigger

| Aspekt | Ergebnis |
| --- | --- |
| PK-Index | **Implizit** (Composite PK) |
| Weitere Indizes | **Nicht auslesbar** (PostgREST) |
| `set_updated_at`-Trigger | **Nein** (`updated_at` fehlt) |

#### RLS / Grants (live, teilweise)

| Aspekt | Ergebnis |
| --- | --- |
| RLS aktiv | **Ja** (INSERT `anon` → `42501` Policy-Verletzung) |
| `FORCE RLS` | **Nicht ermittelt** |
| Policy-Namen / USING / WITH CHECK | **Nicht auslesbar** über PostgREST |
| SELECT `anon` | **HTTP 200** (leere Menge) — **SELECT-Policy oder Grant vorhanden** |
| SELECT `service_role` | **HTTP 200** (Bypass erwartet) |
| INSERT `anon` | **Blockiert** (RLS) |
| INSERT `service_role` | **Technisch möglich** (Constraint-Probing) |
| REST `Allow` | `GET, HEAD, POST, OPTIONS` (PATCH/DELETE nicht in OPTIONS) |

#### Repository-Code

| Bereich | Treffer |
| --- | --- |
| `app/`, `lib/` | **0** |
| Migrationen | **0** DDL |

---

## 2. Zielrolle der Tabelle — Entscheidung nach Live-Verifikation

### Entscheidung: **B — bestehende Tabelle weiterverwenden, Erweiterungsmigration nötig**

`organization_members` bleibt **Source of Truth**. Das Ist-Schema ist **nicht** V1-tauglich ohne Anpassungen (fehlende `aktiv`/`updated_at`, andere Rollen-CHECK, Composite PK statt Surrogate `id`).

**Nicht C** — Tabelle ist strukturell grundsätzlich geeignet (Mandant + User + Rolle + Zeitstempel).

### Abweichungen Ist → V1-Ziel

| Anforderung V1 | Live | Maßnahme |
| --- | --- | --- |
| `organization_id` NOT NULL | ✅ | — |
| `user_id` NOT NULL | ✅ | — |
| `role` NOT NULL | ✅ | CHECK **ersetzen** (operative Rollen) |
| `aktiv` NOT NULL DEFAULT true | ❌ | **Spalte hinzufügen** |
| `created_at` | ✅ | — |
| `updated_at` | ❌ | **Spalte + Trigger** |
| Surrogate `id` | ❌ | **Optional** — Composite PK als `membershipId` aus `(organization_id, user_id)` ausreichend |
| UNIQUE `(organization_id, user_id)` | ✅ (PK) | — |
| FK → `organizations` | ✅ | — |
| FK → Auth-User | ✅ (→ `users`) | Regel verifizieren |
| CHECK operative Rollen | ❌ | **Migration** |
| Deaktivierungsmodell | ❌ | über `aktiv` |

### Zielmodell (Mindestanforderungen V1 — angepasst)

| Feld | Zweck |
| --- | --- |
| `organization_id` + `user_id` | Composite PK (= `membershipId` logisch) |
| `user_id` | Auth-User (`users` / `auth.users`) |
| `organization_id` | `organizations.id` (= operatives `mandant_id`) |
| `role` | Operative Rolle (Text, siehe Abschnitt 3) |
| `aktiv` | Mitgliedschaft aktiv/inaktiv |
| `created_at` / `updated_at` | Audit |

**Surrogate `id`:** in V1 **optional** — nicht zwingend, solange Server-Kontext Composite PK trägt.

### Optionale Erweiterungen (V1.1 / V2)

| Feld | Zweck |
| --- | --- |
| `invited_at` / `accepted_at` | Einladungslebenszyklus |
| `invited_by_user_id` | Einladender (Plattform- oder Mandanten-Admin) |
| `deaktiviert_am` | Soft-Deaktivierung |

**Constraint-Zielbild:**

- UNIQUE `(user_id, organization_id)` — ein Mitgliedschaftsdatensatz pro User und Mandant
- FK `user_id` → `auth.users`
- FK `organization_id` → `organizations`
- CHECK `role` ∈ erlaubte operative Rollen
- CHECK Konsistenz `aktiv` (kein „aktiv ohne Rolle“)

Falls Ist-Schema Felder fehlt: **eine** Erweiterungsmigration versionieren — keine Parallel-Tabelle.

### 2.1 Migrationsbedarf (Entscheidung B — noch kein SQL)

**Vereinfigung:** **0 Zeilen** — kein Backfill, keine Datenmigration, CHECK kann ohne Legacy-Mapping ersetzt werden.

| Maßnahme | Detail |
| --- | --- |
| **Neue Spalten** | `aktiv boolean NOT NULL DEFAULT true`; `updated_at timestamptz NOT NULL DEFAULT now()` |
| **Surrogate `id`** | **Optional** — Composite PK beibehalten empfohlen |
| **Backfill** | **Entfällt** (leere Tabelle) |
| **CHECK ersetzen** | `organization_members_role_check` → operative V1-Rollen (`mandanten_admin`, `buero`, `bauleiter`, `monteur`); Legacy-Werte `member`/`admin`/`owner` **nicht** übernehmen |
| **Default `role`** | `'member'` → entfernen oder auf `'buero'`/`mandanten_admin` anpassen (Entscheidung beim DDL) |
| **FK `user_id`** | Bestehenden FK beibehalten; `ON DELETE`-Regel per `pg_catalog` festlegen (Empfehlung: `CASCADE` oder `RESTRICT` je nach Einladungsmodell) |
| **Indizes** | PK bleibt; optional Index `(user_id)` für Membership-Lookups pro User |
| **Trigger** | `BEFORE UPDATE` → `set_updated_at()` (wie operative Tabellen M1–M3) |
| **RLS-Auswirkungen** | Neue Policies **ersetzen** Ist-Zustand; heutiges **`anon`-SELECT** ist für Produktion **zu offen** — vor Live-Daten einschränken |
| **Breaking Changes** | **Keine** für Anwendungscode (0 Referenzen); API-Consumer mit Legacy-Rollen **n/a** (0 Zeilen) |
| **Versionierung** | Erste DDL im Repo unter `supabase/migrations/` |

### 2.2 Legacy-Rollen vs. operative Rollen

| Ist-CHECK (live) | V1-Ziel |
| --- | --- |
| `member`, `admin`, `owner` | `mandanten_admin`, `buero`, `bauleiter`, `monteur` |

**Kompatibilität:** Keine bestehenden Zeilen — **kein** Migrations-Mapping nötig. Falls externe Systeme das alte Rollenset erwarteten: dokumentieren, dass V1 ein **Greenfield-CHECK** einführt.

### 2.3 Supabase-Auth-Kompatibilität (Zielbild, keine Implementierung)

| Prüfpunkt | Ergebnis |
| --- | --- |
| `user_id` → Auth-User | **Ja** — FK auf `users` (Supabase `auth.users`) |
| PostgREST + RLS abfragbar | **Ja** — Tabelle REST-exponiert; RLS aktiv |
| Rekursive RLS auf `organization_members` | **Risiko**, wenn Policy auf `organization_members` selbst wieder `EXISTS organization_members` nutzt → **Self-Policy** stattdessen: `user_id = auth.uid()` (ggf. `AND aktiv = true`) |
| Operative Tabellen-Policies | `EXISTS` auf `organization_members` **ohne** verschachtelte Abfrage auf dieselbe Tabelle in deren Policy — **keine Rekursion** |
| Membership-Lookups vor Policy-Sprint | Server-Helfer **`getActiveMandantContext()`** zunächst mit **Service Role** oder dedizierter **Self-Read-Policy** für `authenticated` |
| Schreiben Mitgliedschaft | V1: **Service Role** / Admin-RPC — nicht direkt Client-INSERT |

**Offen (pg_catalog):** exakte Policy-Texte, `FORCE RLS`, Grants pro Rolle (`authenticated` vs. `anon`), `ON DELETE` FK-Regeln.

---

## 3. Rollenmodell V1

### 3.1 Empfohlene Rollen (erste UI)

| Rolle | Kurzbeschreibung |
| --- | --- |
| `mandanten_admin` | Vollzugriff operativ + Benutzer/Rollen im Mandanten |
| `buero` | Anfrageeingang, Zuordnung, Vorgänge, Stammdaten — Tagesgeschäft |
| `bauleiter` | Vorgänge, Objekte, Einsatz — weniger Anfrageeingang-Schreiben |
| `monteur` | Ausführung — überwiegend Lesen, begrenzte Vorgang-Updates |

**Nicht in V1 (später):** `buchhaltung`, `leser` — können ohne Schema-Bruch ergänzt werden.

### 3.2 Berechtigungsmatrix (fachlich, keine Policies)

Legende: ✅ erlaubt · 🔶 eingeschränkt · ❌ nicht erlaubt

| Aktion | mandanten_admin | buero | bauleiter | monteur |
| --- | --- | --- | --- | --- |
| Anfrageeingang sehen | ✅ | ✅ | ✅ | 🔶 (eigene/zugewiesene) |
| Anfrage bewerten | ✅ | ✅ | 🔶 | ❌ |
| Zuordnung bestätigen | ✅ | ✅ | 🔶 | ❌ |
| Neukunde anlegen (vorläufig) | ✅ | ✅ | ❌ | ❌ |
| Vorgang erzeugen | ✅ | ✅ | ✅ | ❌ |
| Vorgang bearbeiten | ✅ | ✅ | ✅ | 🔶 (Status/Fertigmeldung) |
| Kunden-/Objektdaten sehen | ✅ | ✅ | ✅ | 🔶 |
| Archivieren / Verwerfen | ✅ | ✅ | ❌ | ❌ |
| Einstellungen verwalten | ✅ | ❌ | ❌ | ❌ |

**Durchsetzung:** Server-Helfer `requireOperativeRole(...)` vor schreibenden Server Actions / RPC-Aufrufen; RLS sichert **Mandantengrenze**, nicht feingranulare Rollen.

### 3.3 Spätere Rollen (Referenz)

| Rolle | V1.1+ |
| --- | --- |
| `buchhaltung` | Rechnungen/Lesen breit; kein Anfrageeingang-Schreiben |
| `leser` | Nur Lesen im Mandanten-Scope |

---

## 4. Mandantenauflösung pro Request

### 4.1 Verbindlicher Ablauf

```
1. Supabase Auth Session (Cookie) → auth.uid()
2. Server lädt aktive Mitgliedschaft(en) aus organization_members
3. Server bestimmt aktiven Mandanten (Abschnitt 5)
4. mandant_id = organization_id des aktiven Kontexts
5. Alle Server-Queries/RPCs erhalten nur diese mandant_id (aus Server-Kontext)
6. Client-Parameter mandant_id / organization_id werden ignoriert oder abgelehnt
```

### 4.2 Mehrfachmitgliedschaft

| Frage | Entscheidung |
| --- | --- |
| Darf ein User mehreren Mandanten angehören? | **Ja**, technisch erlaubt |
| V1-Variante | **B** — mehrere Mitgliedschaften + **Mandantenauswahl** |
| V1-Vereinfachung | Bei **genau einer** aktiven Mitgliedschaft: automatische Auswahl, kein UI-Zwang |

**Nicht empfohlen für V1:**

- **A** (nur eine Mitgliedschaft erlauben) — zu restriktiv für Berater/Wechselmandanten
- **C** (stille „erste“ Mitgliedschaft) — unvorhersehbar bei Mehrfachzugehörigkeit

---

## 5. Aktiver Mandantenkontext

### 5.1 Speicherung — Empfehlung

| Option | Bewertung |
| --- | --- |
| **HttpOnly-Cookie** (serverseitig gesetzt) | ✅ **Empfohlen** |
| Serverseitige Session (DB/Redis) | ✅ Alternative bei Bedarf |
| `user_profiles.default_organization_id` | 🔶 nur als Default-Vorschlag, nicht alleinige Quelle |
| URL-Segment `/m/{id}/...` | ❌ mandant_id in URL vermeiden (ADR-0020) |
| `localStorage` | ❌ **Niemals** alleinige Quelle |

**Cookie-Zielbild (Implementierung):**

- Name: z. B. `kmu_active_mandant_id`
- Flags: `HttpOnly`, `Secure` (Prod), `SameSite=Lax`
- Wert: UUID des `organizations.id`
- Lebensdauer: an Auth-Session gekoppelt; bei Logout löschen

### 5.2 Setzen / Prüfen / Wechsel

| Schritt | Regel |
| --- | --- |
| **Setzen** | Nur Server-Route/Action nach Prüfung: User hat `organization_members`-Zeile mit `organization_id = Ziel` und `aktiv = true` |
| **Prüfen** | Jeder Request: Cookie-Wert ∈ aktive Mitgliedschaften des Users |
| **Wechsel** | Dedizierte Server-Action `switchActiveMandant(targetOrganizationId)` — Cookie neu setzen |
| **Keine Mitgliedschaft** | Redirect `/login` oder `/kein-zugang` — **kein** operativer Datenzugriff |
| **Deaktivierte Mitgliedschaft** | `inactive_membership`-Fehler; Cookie invalidieren; Mandantenauswahl erneut |

### 5.3 Ein-Mandant-Fall

Wenn `auth.uid()` genau **eine** aktive Mitgliedschaft hat:

- Cookie automatisch setzen (beim ersten operativen Request nach Login)
- Kein Mandanten-Picker nötig

---

## 6. Auth-Grenzen `/admin` vs `/`

### 6.1 Getrennte Domänen (ADR-0014)

| Domäne | Route | Berechtigungsquelle |
| --- | --- | --- |
| SaaS-Administration | `/admin/**` | **Plattform-Operator** (separat von `organization_members`) |
| Operative Plattform | `/`, `/dashboard`, `/anfrageeingang`, `/vorgaenge`, … | **`organization_members`** |

### 6.2 Gleicher Auth-User in beiden Welten?

**Technisch möglich**, aber:

- `/admin`-Rechte **übertragen nicht** automatisch auf operative Daten
- Operative Mitgliedschaft **erteilt keinen** `/admin`-Zugriff
- **Keine** organisationsbasierte operative Sicht für SaaS-Admins ohne expliziten Support-/Impersonation-Prozess (später, auditpflichtig)

### 6.3 Plattform-Operator (Zielbild V1)

Separater Nachweis für `/admin`, z. B.:

- Tabelle `platform_operators (user_id, aktiv, …)`, **oder**
- Supabase `app_metadata.platform_role = 'platform_admin'`

**Ist-Stand:** `/admin` ohne Auth-Middleware; Service Role serverseitig. Auth-Sprint operative Domäne **blockiert nicht** parallele `/admin`-Auth-Einführung, darf `/admin` aber **nicht** verändern (Projektvorgabe).

### 6.4 Route Guards (implementiert 2026-07-28)

| Route | Guard |
| --- | --- |
| `/admin/**` | Unverändert — kein operativer Guard |
| `app/(app)/(protected)/**` | `evaluateOperativeAppAccess()` → Redirects |
| Öffentliche operative Seiten | `/login`, `/kein-zugang`, `/mandant-waehlen` (ohne `(protected)`-Layout) |
| API | `/api/operative-auth/init-mandant` — Cookie-Initialisierung |
| Server Actions operativ | `getActiveMandantContext()` / `requireOperativeRole()` |

---

## 7. Server-Helfer — Implementierung (2026-07-28)

Ort: `lib/operative-auth/` · Auth-Client: `lib/supabase/server-auth.ts` (`@supabase/ssr`)

| Modul | Zweck |
| --- | --- |
| `require-authenticated-user.ts` | `getUser()` — sonst `unauthenticated` |
| `get-active-mandant-context.ts` | Cookie + DB-Mitgliedschaften → Kontext (**liest/setzt keinen Cookie in RSC**) |
| `require-operative-role.ts` | Rollen-Check gegen DB |
| `switch-active-mandant.ts` | Server Action — Cookie nach Membership-Prüfung |
| `evaluate-operative-app-access.ts` | Route-Guard-Zustand für `(protected)`-Layout |
| `resolve-mandant-context.ts` | Reine Auflösungslogik (Unit-Tests) |
| `active-mandant-cookie.ts` | `kmu_flow_active_mandant` (HttpOnly, nur `organization_id`) |

### Rückgabe `ActiveMandantContext`

```typescript
{
  userId: string;
  mandantId: string;      // organizations.id — Composite PK, kein surrogate membershipId
  role: OperativeRole;
  organizationName?: string;
}
```

### Cookie-Schreibgrenze (Next.js App Router)

`getActiveMandantContext()` **darf in Server Components keinen Cookie setzen**. Bei genau einer aktiven Mitgliedschaft:

1. `(protected)/layout` → Status `init_cookie`
2. Redirect auf `/api/operative-auth/init-mandant`
3. Route Handler setzt Cookie nach erneuter Membership-Prüfung

Alternativ: `switchActiveMandant()` (Server Action) für expliziten Wechsel.

### Fehlercodes

| Code | Bedeutung |
| --- | --- |
| `unauthenticated` | Keine gültige Auth-Session |
| `no_membership` | Keine sichtbare aktive Mitgliedschaft (RLS: inaktive nicht lesbar) |
| `inactive_membership` | Reserviert — derzeit wie `no_membership` über RLS |
| `mandant_selection_required` | Mehrere Mitgliedschaften, kein gültiger Cookie |
| `invalid_mandant_context` | Cookie passt nicht zu aktiver Mitgliedschaft |
| `forbidden` | Rolle unzureichend |

Unit-Tests: `npx tsx lib/operative-auth/operative-auth.test.ts` (13 Fälle, ohne Live-Supabase).

---

## 8. RLS-Zielbild (spätere Migration — kein SQL hier)

### 8.1 Grundprinzip

- Operative Tabellen: RLS **ENABLED** (Ist)
- Neue Policies für `authenticated`: Zugriff nur wenn **aktive Mitgliedschaft** für Zeilen-`mandant_id`
- `mandant_id`-Spalte bleibt Policy-Grundlage
- Composite-FKs bleiben zusätzliche DB-Absicherung
- Service Role: Bypass nur serverseitig; `mandant_id` weiterhin aus Server-Kontext

### 8.2 Policy-Muster — Empfehlung

**Bevorzugt:** einfache `EXISTS`-Subquery auf `organization_members`:

```text
EXISTS (
  SELECT 1 FROM organization_members om
  WHERE om.user_id = auth.uid()
    AND om.organization_id = <tabelle>.mandant_id
    AND om.aktiv = true
)
```

**Kein** SECURITY DEFINER-Helper in V1, solange Policies lesbar bleiben.

**Feingranulare Rollen** (z. B. nur `mandanten_admin` darf löschen): primär **Server-Schicht**; optionale Policy-Ergänzung später via `has_operative_role(mandant_id, text[])` STABLE Helper.

### 8.3 Mehrfachmitgliedschaft und RLS

RLS erlaubt Zugriff auf **alle** Mandanten mit aktiver Mitgliedschaft. Der **aktive Mandant** wird **zusätzlich** in der Server-Schicht erzwungen:

```text
.eq('mandant_id', ctx.mandantId)
```

So kann ein User zwar technisch mehrere Mandanten sehen (nach Wechsel), aber nie parallel zwei Mandanten in einer Query vermischen.

### 8.4 Risiken aus Live-Ist (2026-07-28)

| Risiko | Beschreibung | Mitigation (Zielbild) |
| --- | --- | --- |
| **Anon-SELECT** | Live: `anon` kann `organization_members` lesen (leer, aber Policy/Grant vorhanden) | Policies so gestalten, dass nur `authenticated` eigene Zeilen sieht; `anon` **kein** SELECT |
| **RLS-Rekursion** | Policy auf `organization_members` mit Subquery auf `organization_members` | **Self-Policy** `user_id = auth.uid()` |
| **Operative EXISTS-Policies** | Andere Tabellen lesen `organization_members` | Unkritisch, solange `organization_members`-Policy nicht zurückfragt |
| **Service Role vor RLS-Sprint** | Membership-Bootstrap ohne Policies | Server-Helfer mit Service Role bis Self-Policy live; dann `authenticated` für Reads |
| **Unbekannte Ist-Policies** | Namen/USING/WITH CHECK nicht ausgelesen | Vor Policy-Migration Dashboard/`pg_catalog`; ggf. alte Policies droppen |

---

## 9. Übergang zur ersten UI mit Live-Daten

### 9.1 Erste Queries (nach Auth-Sprint)

| Query | Kanal | Begründung |
| --- | --- | --- |
| Count „neue Anfrageeingänge“ | `authenticated` + RLS + Server `mandant_id` | Einfaches Lesen |
| Anfrageeingang-Liste | `authenticated` + RLS | Filter `status`, `aktiv = true` |
| Vorgänge-Liste | `authenticated` + RLS | Filter `status`, `aktiv = true` |
| Detailseiten (Read) | `authenticated` + RLS | Einzelzeile per ID + Mandant |

### 9.2 Weiterhin Service Role (serverseitig)

| Operation | Kanal |
| --- | --- |
| Alle M3.1-RPCs (`create_anfrageeingang`, …) | Service Role in Server Action |
| Mandanten-Onboarding `/admin` | Unverändert Service Role |
| Batch-/Systemprozesse | Service Role |

**Regel:** Schreibende **Fachoperationen** bleiben RPC + Service Role; **Lesen/Listen** wechseln auf `authenticated` + RLS sobald Policies live sind.

---

## 10. Fehlerfälle (UX-Zielbild)

| Situation | Verhalten |
| --- | --- |
| Nicht eingeloggt | Login-Seite; operative Routen geschützt |
| Eingeloggt, keine Mitgliedschaft | `/kein-zugang` — Hinweis „Kein Mandantenzugang“ |
| Mitgliedschaft deaktiviert | Kein Datenzugriff; ggf. Support-Hinweis |
| Mehrere Mandanten, kein Cookie | Mandanten-Auswahl |
| Ungültiger Cookie | Cookie löschen → Auswahl oder Auto-Set bei Single-Membership |
| Rolle unzureichend | 403 / Inline „Keine Berechtigung“ |

---

## 11. UI-Übergang (Reihenfolge nach Auth-Sprint)

1. ✅ **Login** operative App (`/login`, `loginAction`, `@supabase/ssr`) — **Logout-Action** ohne UI-Anbindung (siehe unten)
2. ✅ Route Guards `(app)/(protected)/layout`
3. ✅ Mandanten-Kontext + **Auswahl-UI** `/mandant-waehlen`
4. ✅ **Live-Liste `/anfrageeingang`** — authenticated SSR-Read, KPI-Counts, Tabelle (max. 100 Zeilen)
5. Liste `/vorgaenge`
6. ✅ **Detail-Route `/anfrageeingang/[id]`** — Read-only, authenticated SSR
7. ✅ **Verwerfen auf Detailseite** — Server Action + RPC `verwerfe_anfrageeingang`
8. ✅ **Archivieren auf Detailseite** — Server Action + RPC `archiviere_anfrageeingang`, Redirect zur Liste
9. Weitere Schreib-Actions → bestehende RPCs via Service Role

**Login (implementiert):** `app/(app)/login/` — E-Mail/Passwort, Server Action `signInWithPassword`, Redirect `/dashboard`. Bereits angemeldete Benutzer werden serverseitig weitergeleitet. Öffentliche Seite ohne Sidebar (`app-chrome.tsx`).

**Logout:** `logoutAction` — auf `/mandant-waehlen` eingebunden; Sidebar/Einstellungen optional später.

**Mandantenauswahl (implementiert):** `/mandant-waehlen` — serverseitige Mitgliedschaftsprüfung; bei 1 Mandant → Init-Route; bei mehreren → Karten mit Betriebsname + Rolle (deutsch); `selectActiveMandantAction` → `switchActiveMandant` → Cookie → `/dashboard`; Logout auf der Seite; `?fehler=ungueltig` für ungültigen Cookie.

**Bereits vorhanden (Skeleton):** `/vorgaenge` — ohne Live-Daten.

**Live-Liste (implementiert):** `/anfrageeingang` — Server Component; `loadAnfrageeingangPageData()` mit `createSupabaseServerAuthClient()` + `getActiveMandantContextOrThrow()`; Filter `mandant_id = ctx.mandantId` und `aktiv = true`; KPI-Counts je Status (`head=true`); Tabellenlimit 100; Suche/Filter UI vorbereitet ohne Funktion.

**Detailseite (implementiert):** `/anfrageeingang/[id]` — Read-only Server Component; `loadAnfrageeingangDetail()` mit UUID-Validierung, `maybeSingle()`, gleicher Mandanten-/aktiv-Filter; fremde/archivierte/ungültige IDs → `notFound()`; technische Fehler → neutrale Meldung; Rohinhalt/JSON gezielt geladen und als Text/JSON dargestellt.

**Verwerfen (implementiert):** `verwerfeAnfrageeingangAction` — `getActiveMandantContextOrThrow()` + `createSupabaseAdminClient()`; RPC mit `p_mandant_id` aus Kontext, `p_quelle = 'manuell'` serverseitig; Erfolg → `revalidatePath` + Redirect auf Detailseite mit Hinweis; Sichtbarkeit nur bei verwertbarem Status.

**Archivieren (implementiert):** `archiviereAnfrageeingangAction` — RPC `archiviere_anfrageeingang`; setzt nur `aktiv=false`/`archiviert_am` (Status unverändert); Erfolg → Redirect `/anfrageeingang?hinweis=archiviert`; Aktion auf jeder aktiven Detailseite sichtbar (orthogonal zum Prozessstatus).

---

## 12. Offene Entscheidungen

| # | Thema | Status |
| --- | --- | --- |
| O1 | Exaktes Ist-Schema `organization_members` | ✅ **Live-Verifikation 2026-07-28** (Abschnitt 1.4); Entscheidung **B**; pg_catalog-Lücken (Policies, FORCE RLS, Indizes) vor DDL nachziehen |
| O2 | `platform_operators` vs. `app_metadata` für `/admin` | Parallel zum operativen Sprint, `/admin` unverändert lassen |
| O3 | Einladungsflow (E-Mail) | V1 manuell durch Plattform-Admin; Self-Service später |
| O4 | Impersonation / Support-Zugriff | Explizit **out of scope** V1 |
| O5 | JWT Custom Claim für `active_mandant_id` | Optional V1.1; Cookie reicht für V1 |

---

## Änderungshistorie

| Datum | Änderung |
| --- | --- |
| 2026-07-28 | Live-Schema-Verifikation `organization_members`; Entscheidung **B**; Migrationsbedarf §2.1 |
| 2026-07-28 | Server-Helfer `lib/operative-auth/` implementiert; Cookie-Modell §7 |
| 2026-07-28 | Login-UI `/login`, `loginAction`, `logoutAction` §11 |
| 2026-07-28 | Mandantenauswahl-UI `/mandant-waehlen` §11 |
| 2026-07-28 | Erstversion — Auth-/Mandantenkontext operative Plattform |

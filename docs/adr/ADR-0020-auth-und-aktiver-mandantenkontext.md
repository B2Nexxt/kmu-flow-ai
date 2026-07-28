# ADR-0020: Auth und aktiver Mandantenkontext (operative Plattform)

**Status:** Angenommen (verbindlich)  
**Datum:** 2026-07-28  
**Bezug:** ADR-0014, ADR-0016, [`docs/fachkonzept/16-auth-und-mandantenkontext-operative-plattform.md`](../fachkonzept/16-auth-und-mandantenkontext-operative-plattform.md)

---

## Kontext

Die operative Plattform (`/`) benötigt vor Live-Daten und RLS-Policies ein verbindliches Modell für:

- Zuordnung **Auth-User → Mandant (`organizations.id`) → Rolle**
- **Aktiver Mandant** bei Mehrfachmitgliedschaft
- **Strikte Trennung** von SaaS-Administration (`/admin`) und operativem Zugriff

M1–M3.1 haben operative Tabellen mit `mandant_id` und RLS **ENABLED ohne authenticated-Policies** eingeführt. Zugriff erfolgte bisher nur serverseitig über **Service Role**. UI-Skeletons für `/anfrageeingang` und `/vorgaenge` existieren ohne Datenanbindung.

Die Tabelle `organization_members` existiert (vorbestehend, aktuell leer), ist aber weder im Repo versioniert noch produktiv angebunden.

**Live-Verifikation (2026-07-28):** Composite PK `(organization_id, user_id)`, FKs zu `organizations` und Auth-`users`, CHECK erlaubt Legacy-Rollen `member`/`admin`/`owner` — **nicht** operative V1-Rollen. Fehlend: `aktiv`, `updated_at`. RLS aktiv; `anon`-SELECT derzeit möglich. → **Entscheidung B:** Tabelle weiterverwenden, Erweiterungsmigration nötig (Details: Fachkonzept 16, §1.4–§2.1).

---

## Entscheidung

### 1. Mitgliedschaft

- **`public.organization_members`** ist die **Source of Truth** für operative Mandantenmitgliedschaft.
- **Keine** parallele Mitgliedschaftstabelle in V1.
- Fehlende Spalten/Constraints werden per **Erweiterungsmigration** ergänzt — nicht durch neue Tabelle.
- **Composite PK** `(organization_id, user_id)` ist ausreichend; Surrogate `id` optional.
- Legacy-Rollen-CHECK (`member`/`admin`/`owner`) wird durch operative V1-Rollen ersetzt (0 Zeilen → ohne Daten-Mapping).

### 2. Mandant-ID

- Operative `mandant_id` = `organizations.id`.
- `mandant_id` wird **ausschließlich** aus geprüfter Mitgliedschaft + aktivem Mandantenkontext abgeleitet.
- **Client, URL, Formular und localStorage** dürfen `mandant_id` **nicht** authoritative setzen.

### 3. Mehrfachmitgliedschaft

- Ein User **darf** mehreren Mandanten angehören (`organization_members` UNIQUE pro `(user_id, organization_id)`).
- Bei mehreren aktiven Mitgliedschaften ist ein **expliziter Mandantenkontext** erforderlich.

### 4. Aktiver Mandant

- Der aktive Mandant wird **serverseitig** in einem **HttpOnly-Cookie** gehalten (**Implementiert:** `kmu_flow_active_mandant`).
- Bei genau **einer** aktiven Mitgliedschaft: automatische Auswahl ohne Pflicht-Picker.
- Wechsel nur nach Server-Prüfung der Ziel-Mitgliedschaft.

### 5. Domänentrennung `/admin` vs `/`

- **Operative Rechte** aus `organization_members` — **nicht** aus Plattform-Admin-Status.
- **Plattform-Admin-Rechte** aus separatem Operator-Modell — **nicht** aus Mandantenmitgliedschaft.
- Derselbe Auth-User **kann** beides haben; **keine** automatische Rechteübernahme zwischen Domänen.
- SaaS-Admins erhalten **keinen** Standardzugriff auf operative Tabellen; Support/Impersonation nur als expliziter, später auditierter Prozess.

### 6. Datenzugriff nach Auth-Sprint

| Zugriff | Mechanismus |
| --- | --- |
| Listen / Reads / Counts | Supabase **`authenticated`** Client + **RLS** + Server-Filter `mandant_id` aus Kontext |
| Fachoperationen (M3.1-RPCs) | Weiterhin **Service Role** in Server Actions; `mandant_id` aus `getActiveMandantContext()` |
| `/admin` | Unverändert eigene Domäne; **out of scope** dieses ADR für Code-Änderungen |

### 7. Rollen V1

Operative Rollen: `mandanten_admin`, `buero`, `bauleiter`, `monteur`.

Feingranulare Durchsetzung in der **Server-Schicht**; RLS sichert primär die **Mandantengrenze**.

### 8. Implementierungsstand (2026-07-28)

| Teil | Status |
| --- | --- |
| `organization_members` operativ V1 | Migration + Tests |
| Self-Read-RLS `organization_members` | Migration + Tests |
| `lib/operative-auth/` + `@supabase/ssr` | Implementiert |
| Route Guard `(app)/(protected)/layout.tsx` | Implementiert |
| Cookie-Init Route Handler | `/api/operative-auth/init-mandant` |
| Login-UI / Mandantenauswahl-UI | Offen |
| RLS operative Fachtabellen | Offen |
| Live-Daten in UI | Offen |

Cookie-Schreiben in Server Components ist in Next.js nicht erlaubt — automatische Cookie-Setzung bei Single-Membership über Route Handler (siehe Fachkonzept 16 §7).

---

## Konsequenzen

### Positiv

- Einheitliches Mitgliedschaftsmodell ohne Duplikat-Tabellen
- Klare Voraussetzung für RLS-Policies und erste Live-UI
- ADR-0014-Domänentrennung bleibt technisch durchsetzbar

### Aufwand

- Login-UI und Mandantenauswahl-UI vor erster operativer Live-UI
- RLS-Policy-Migration für **operative Fachtabellen** (folge Sprint)
- ~~Erweiterungsmigration `organization_members`~~ ✅
- ~~Server-Helfer + Route Guards + Cookie-Handling~~ ✅

### Risiken

- ~~Ist-RLS auf `organization_members`: `anon`-SELECT~~ — durch Self-Read-Migration geschlossen
- End-to-End-Auth ohne Login-UI noch nicht manuell testbar
- RLS-Rekursion auf Fachtabellen bei EXISTS-Policies weiterhin beachten
- `/admin`-Auth bleibt vorerst separat — kein Big-Bang

---

## Alternativen ( verworfen )

| Alternative | Grund |
| --- | --- |
| Neue Tabelle `operative_mitarbeiter` | Redundanz zu `organization_members` |
| Nur eine Mitgliedschaft pro User (V1) | Zu restriktiv |
| Stille Default-Mitgliedschaft ohne UI | Unvorhersehbar bei Mehrfachzugehörigkeit |
| `mandant_id` in URL | Manipulationsrisiko; widerspricht Server-only-Kontext |
| localStorage als alleinige Quelle | Nicht vertrauenswürdig |

---

## Verweise

- [`docs/fachkonzept/16-auth-und-mandantenkontext-operative-plattform.md`](../fachkonzept/16-auth-und-mandantenkontext-operative-plattform.md)
- [`docs/adr/ADR-0014-trennung-saas-admin-und-operative-kundenplattform.md`](./ADR-0014-trennung-saas-admin-und-operative-kundenplattform.md)
- [`docs/adr/ADR-0016-operative-objektgrundlagen-rls-archivierung.md`](./ADR-0016-operative-objektgrundlagen-rls-archivierung.md)

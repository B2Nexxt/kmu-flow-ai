# Supabase Migrationen

## Mandanten-Onboarding MVP (Phase 2)

**Datei:** `supabase/migrations/20260717090000_mandanten_onboarding_mvp.sql`

### Datenmodell

Erweitert das **bestehende** Multi-Tenant-Modell – keine parallelen `mandanten`-Tabellen.

| Tabelle | Rolle |
| --- | --- |
| `organizations` | Mandant + Hauptunternehmen (erweitert) |
| `organization_members` | Login-Benutzer (unverändert) |
| `customers` | CRM-Kunden des Mandanten (unverändert) |
| `ansprechpartner` | Ansprechpartner/GF |
| `bankverbindungen` | Bankverbindung |
| `organization_modules` | Module |
| `organization_automatisierungen` | Automatisierungen |

### Funktion

- `create_mandant_onboarding(payload jsonb)` – atomare Anlage in `organizations` und verknüpften Tabellen

### Ausführung

1. Supabase-Projekt öffnen
2. Falls die **alte parallele Migration** bereits lief (`mandanten`, `unternehmen` …), diese Tabellen zuerst manuell entfernen
3. SQL Editor → Inhalt der Migration einfügen und ausführen

   **oder**

4. Mit Supabase CLI: `supabase db push`

### Umgebungsvariablen

Siehe `.env.example`:

- `NEXT_PUBLIC_SUPABASE_URL`
- `NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY`
- `SUPABASE_SERVICE_ROLE_KEY` (nur Server, nicht im Browser)

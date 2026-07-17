# Architektur- und Produktentscheidungen

Diese Datei dokumentiert alle grundlegenden fachlichen und technischen Entscheidungen des Projekts. Neue Entscheidungen werden ausschließlich hier ergänzt und niemals stillschweigend geändert.

---

## Geschäftsmodell

KMU Flow AI ist **keine klassische Angebots- oder Rechnungssoftware**.

Die Plattform unterstützt Beratungsunternehmen bei der **Digitalisierung von KMU**. Die Beratung steht im Mittelpunkt; die Software begleitet und unterstützt den gesamten Kundenprozess – von der ersten Anfrage über Analyse und Angebot bis hin zu Vertrag, Umsetzung und laufendem Betrieb.

**Konsequenzen:**

- Funktionen werden nicht isoliert als reine Verwaltungssoftware gedacht, sondern als Teil eines beratungsgeleiteten Gesamtprozesses.
- Workflows, Automatisierungen und KI-Funktionen dienen der Entlastung von Beratung und Betrieb, nicht dem Ersatz der fachlichen Begleitung.

---

## Plattform

KMU Flow AI ist **eine Plattform mit zwei getrennten Bereichen**:

| Bereich | Zweck |
| --- | --- |
| **Plattform-Admin** | Verwaltung von Interessenten, Mandanten, Verträgen, Modulen, Preisen und internen Prozessen |
| **Kundenportal** | Nutzung der gebuchten Module und Prozesse durch den Mandanten und seine Benutzer |

Beide Bereiche gehören zur gleichen Plattform, unterscheiden sich aber in Zielgruppe, Berechtigungen und Funktionsumfang.

---

## Registrierung

Es gibt **keine öffentliche Selbstregistrierung**.

Jeder Mandant wird **ausschließlich durch den Plattform-Hauptadmin** angelegt. Der Zugang entsteht erst nach einem geführten Vertriebs- und Onboarding-Prozess.

**Konsequenzen:**

- Es gibt keinen offenen Registrierungsflow für Endkunden.
- Mandanten entstehen bewusst und kontrolliert über den Plattform-Admin-Bereich.
- Erste Benutzer eines Mandanten werden eingeladen oder durch den Plattform-Hauptadmin angelegt.

---

## Plattform-Hauptadmin

Für **Version 1** gibt es genau **einen Plattform-Hauptadmin** mit vollständigem Zugriff auf den Plattform-Admin-Bereich.

Weitere interne Plattform-Rollen wie Vertrieb, Buchhaltung, Support, Technik oder Berater werden **später** ergänzt. Feingranulare Plattform-Berechtigungen werden in Version 1 nicht umgesetzt.

**Konsequenzen:**

- Der Plattform-Admin-Bereich wird zunächst für einen Hauptadmin konzipiert.
- Rollen und Berechtigungen sollen später zentral verwaltet werden, nicht fest in einzelnen Seiten verankert.

---

## Mandantenmodell

Ein **Mandant** ist die übergeordnete Organisationseinheit auf Kundenseite. Das Mandantenmodell ist bewusst flexibel angelegt:

- Ein Mandant kann **mehrere Unternehmen** besitzen.
- Unternehmen können **mehrere Standorte** besitzen.
- **Mehrere Bankverbindungen** sind möglich.
- **Mehrere Geschäftsführer** sind möglich.
- **Mehrere Ansprechpartner** sind möglich.
- Ansprechpartner können gleichzeitig **Plattformbenutzer** sein.
- **Unternehmensbeziehungen** sollen abgebildet werden können.

**Konsequenzen:**

- Das Datenmodell muss Mandant, Unternehmen, Standort und Personen voneinander trennen.
- Der Einrichtungsassistent bildet zunächst nur einen vereinfachten Ausschnitt ab; das Zielmodell ist deutlich umfangreicher.
- Berechtigungen und Module können später auf unterschiedlichen Ebenen gelten.

---

## Einheitlicher Mandantendatensatz mit Status

Es gibt **nur noch einen gemeinsamen Datensatztyp „Mandant“**.

Die Unterscheidung zwischen Interessent und aktivem Mandanten erfolgt **ausschließlich über einen Status** am selben Datensatz.

Grundsätze:

- **„Interessent“ ist kein eigener Datensatztyp**, sondern ein Status eines Mandanten.
- Der Datensatz wird während seines **gesamten Lebenszyklus weiterverwendet**.
- Eine **Statusänderung erzeugt keinen neuen Datensatz**.
- Interessent und aktiver Mandant verwenden **dieselbe Mandantenakte** und **dieselbe Datenstruktur**.
- Im Plattform-Admin gibt es nur noch die Anlageaktion **„Mandant anlegen“**.

Status im MVP:

- **Interessent**
- **Aktiver Mandant**

Später erweiterbar um unter anderem:

- Qualifiziert
- Angebot erstellt
- Angebot angenommen
- Pausiert
- Gekündigt
- Archiviert

**Konsequenzen:**

- Es gibt keine getrennte Anlage für Interessenten und Mandanten mehr.
- Ein Interessent wird durch **Änderung des Status** zum aktiven Mandanten.
- Beim Statuswechsel werden **keine Daten dupliziert** und **kein neuer Datensatz angelegt**.
- Der gewählte Status wird beim Anlegen im Onboarding erfasst und im Mandantendatensatz gespeichert.

---

## Persistierung aus dem Onboarding-Assistenten (Phase 2)

Ablauf bei „Mandant anlegen“:

1. Benutzer füllt den 6-stufigen Assistenten aus.
2. Benutzer klickt auf **Mandant anlegen**.
3. Die Daten werden **vollständig validiert** (serverseitig, ergänzend zu den Schrittvalidierungen).
4. Der Mandant wird **atomar in Supabase** gespeichert.
5. Zugehöriges Unternehmen, Ansprechpartner und optionale Bankverbindung werden gespeichert.
6. Module und Automatisierungen werden als Zuordnungen gespeichert.
7. Die **ID des neu angelegten Mandanten** wird zurückgegeben.
8. Weiterleitung auf `/admin/mandanten/[id]?created=true`.
9. Einmalige grüne Meldung: **„Mandant wurde erfolgreich angelegt.“**

Weitere Regeln:

- **Interessent** und **Aktiver Mandant** sind Statuswerte desselben Mandantendatensatzes.
- Eine Statusänderung erzeugt **keinen neuen Datensatz**.
- Bei Speicherfehlern erfolgt **keine automatische Löschung** bereits gespeicherter Teildaten (Transaktion verhindert Teilspeicherung).
- **Bankdaten sind optional.** Wurde die Bankverbindung begonnen, müssen alle Bankfelder vollständig und gültig sein.
- Supabase-Schreibzugriffe mit erhöhten Rechten erfolgen **serverseitig** (Server Action), nicht im Browser.

---

## Angebote

Angebote besitzen **Versionen**.

Änderungen an einem Angebot führen nicht stillschweigend zur Überschreibung der bisherigen Fassung, sondern zu einer neuen Version mit nachvollziehbarer Historie.

**Konsequenz:**

- Der **Vertrag basiert immer auf der letzten angenommenen Angebotsversion**.

---

## Verträge

Das Vertragsmodell ist mandanten- und unternehmensfähig:

- **Mehrere Verträge pro Mandant** sind möglich.
- Verträge können **mehrere Unternehmen** umfassen.
- **Vertragsvorlagen werden versioniert**.

**Konsequenzen:**

- Verträge sind eigenständige Objekte und nicht nur eine Kopie eines Angebots.
- Vertragsänderungen und Vorlagen müssen historisch nachvollziehbar sein.

---

## Module

Module sind zentrale Bestandteile des Geschäftsmodells:

- Module besitzen **Listenpreise**.
- **Individuelle Rabatte** sind möglich.
- Module können **je Unternehmen oder Standort unterschiedlich aktiviert** werden.

**Konsequenzen:**

- Preislogik und Modulaktivierung müssen mandanten- und ggf. standortspezifisch abbildbar sein.
- Der Modul- und Preisschritt im Einrichtungsassistenten ist ein vereinfachter Prototyp für dieses Zielmodell.

---

## Rechnungen

Das Rechnungswesen ist flexibel und mehrstufig:

- **Mehrere Rechnungsempfänger** sind möglich.
- **Externe Provider** können Rechnungsempfänger sein.
- **Mehrere Rechnungsprofile** sind möglich.
- **Wiederkehrende und einmalige Rechnungen** werden unterstützt.

**Konsequenzen:**

- Rechnungen sind nicht auf einen einzigen Empfänger oder ein einziges Profil beschränkt.
- Abrechnungslogik muss wiederkehrende und einmalige Vorgänge gemeinsam abbilden können.

---

## Mahnwesen

Das Mahnwesen folgt klaren Sicherheits- und Verantwortungsregeln:

| Regel | Entscheidung |
| --- | --- |
| Rechnungen automatisch erstellen | **Erlaubt** |
| Mahnungen automatisch versenden | **Nicht erlaubt** |
| Prüfung vor Mahnung | **Pflicht** – ein Mitarbeiter prüft den Zahlungseingang |
| Nach letzter Mahnung | Es wird eine **Aufgabe zur Vertragsprüfung** erzeugt |
| Kündigungen automatisch | **Nicht erlaubt** |
| Zugangssperren automatisch | **Nicht erlaubt** |
| Sperrungen | Werden **manuell entschieden** und anschließend technisch ausgeführt |
| Daten automatisch löschen | **Nicht erlaubt** |

**Konsequenz:**

- Automatisierung unterstützt Vorbereitung und Erinnerung, aber keine kritischen Entscheidungen ohne menschliche Prüfung.

---

## Dokumente

Dokumente unterliegen **Rollen- und Benutzerberechtigungen**.

Nicht jeder Mitarbeiter darf alle Dokumente sehen. Der Zugriff richtet sich nach Rolle, Kontext und expliziten Berechtigungen.

**Konsequenz:**

- Dokumentenlogik und Berechtigungssystem müssen von Anfang an gemeinsam gedacht werden.

---

## Beratung

Beratung ist ein **eigenständiger fachlicher Bereich** der Plattform:

- **Beratungen** sind eigenständige Vorgänge.
- **Prozessanalysen** besitzen Ist- und Soll-Prozesse.
- Prozessanalysen können **Angebote erzeugen**.
- **Projekte** entstehen aus angenommenen Angeboten.

**Konsequenz:**

- Beratung, Angebot und Projekt sind miteinander verknüpft, aber fachlich getrennte Objekte.

---

## Homepage

Die öffentliche Homepage wird **später mit der Plattform verbunden**.

Geplante Funktionen:

- Interessenten können **Beratungen anfragen oder direkt buchen**.
- Termine werden **internen Mitarbeitern** zugeordnet.
- **Kalenderanbindungen** werden später ergänzt.

**Konsequenz:**

- Die aktuelle Startseite ist ein Platzhalter; der spätere Vertriebs- und Terminprozess wird bewusst in die Plattform integriert.

---

## KI

KI unterstützt zunächst **ausschließlich den Vertrieb**.

Grundprinzipien:

- KI erzeugt **Entwürfe**.
- **Entscheidungen trifft immer ein Mensch**.

**Konsequenz:**

- KI-Funktionen sind Assistenzsysteme, keine autonomen Entscheidungsträger.

---

## Automatische Stammdatenergänzung

Die Plattform soll den Benutzer bei der Dateneingabe aktiv unterstützen.

Grundsatz:

Stammdaten werden, wenn möglich, automatisch aus vertrauenswürdigen Datenquellen ergänzt.

Automatisch ermittelte Werte dienen der Entlastung des Benutzers und der Verbesserung der Datenqualität.

Sie ersetzen jedoch niemals die Verantwortung des Benutzers.

Automatisch vorgeschlagene Werte müssen nachvollziehbar bleiben und – sofern fachlich sinnvoll – manuell bearbeitet werden können.

### Bankverbindung

Für die zukünftige Ausbaustufe gilt:

Der Benutzer gibt lediglich folgende Daten ein:

- Kontoinhaber
- IBAN

Nach erfolgreicher IBAN-Validierung soll die Plattform automatisch ermitteln:

- Bankname
- BIC

Bankname und BIC werden automatisch eingetragen.

Standardmäßig sind beide Felder schreibgeschützt.

Über „Manuell bearbeiten“ können sie bei Bedarf geändert werden.

Diese Funktion ist ausdrücklich **nicht** Bestandteil des MVP und wird erst in einer späteren Ausbaustufe umgesetzt.

Weitere zukünftige automatische Ergänzungen:

- Land → Telefonvorwahl
- PLZ → Ort
- Ort → Bundesland
- USt-IdNr. → Unternehmensstammdaten (soweit technisch und rechtlich möglich)
- Adresse → Geokoordinaten
- E-Mail → Formatvalidierung

---

## Änderungsprinzip

Grundlegende Entscheidungen werden **niemals stillschweigend geändert**.

Vor jeder Änderung wird **zuerst die Dokumentation aktualisiert**. Erst danach beginnt die technische Umsetzung.

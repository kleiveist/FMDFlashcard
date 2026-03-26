<!-- AUTO-GENERATED:backlink START -->
[← Back](rendering.md)
<!-- AUTO-GENERATED:backlink END -->
Unten findest du **konkrete, sinnvolle Ergänzungen**, die fehlen, um mit **gerenderten Markdown-Tabellen wirklich „ideal“ zu arbeiten**, ohne den Markdown-Charakter zu verlieren.

Ich gliedere das in:
1. **fehlende Kernfunktionen**
2. **Editier- und Fokusregeln**
3. **Struktur- & Sicherheitsregeln**
4. **ergänzte Tabelle (vollständig)**

---
## 1) Fehlende Kernfunktionen (essentiell)
### a) Spalte / Zeile hinzufügen & löschen
**Warum wichtig:** Tabellen sind sonst faktisch read-only strukturell.
- Spalte links / rechts einfügen
- Zeile oben / unten einfügen
- Spalte löschen
- Zeile löschen
➡ **Wichtig:** Aktion erzeugt _deterministische Markdown-Änderung_, kein Auto-Reflow ohne Nutzeraktion.

---
### b) Tabellenkopf separat behandeln
Markdown unterscheidet logisch:
- Header (`| A | B |`)
- Separator (`| --- | --- |`)
- Body
**Ergänzen:**
- Kopfzeile markieren
- Kopfzeile editieren wie normalen Text
- Separator-Zeile nie automatisch verändern (keine Längenanpassung ohne Befehl)

---

### c) Zell- vs Block-Editierung

Du hast „Text normal editierbar“ – gut, aber es fehlt die **Granularität**:
- Einzelzelle editieren (Inline-Edit)
- Ganze Zelle als Block editieren (für Mehrzeiligkeit)

Beispiel:
- kurzer Text → inline
- Text mit `<br>` oder Markdown → Block-Edit

---

## 2) Fokus- und Edit-Regeln (entscheidend für UX)
### a) Klarer Tabellen-Fokus

- Tabelle hat **eigenen Fokuszustand**
- Außerhalb der Tabelle:
    - normales Markdown-Editing
- Innerhalb:
    - Tabellen-Interaktionen aktiv
➡ verhindert, dass Pfeiltasten, Enter etc. unerwartet „aus der Tabelle springen“.

---

### b) Expliziter Wechsel: „Tabellenmodus ↔ Rohtext“

Fehlt aktuell konzeptionell.
- Aktion: „Tabelle als Markdown bearbeiten“
- Ergebnis: gesamte Tabelle wird **als Rohtextblock** editierbar
- Rückkehr: wieder gerendert
➡ wichtig für Power-User und Edge-Cases.

---
## 3) Struktur- & Sicherheitsregeln (damit nichts kaputtgeht)

### a) Kein automatisches Reformatieren
- Keine automatische:
    - Spaltenbreiten-Anpassung
    - `---`-Normalisierung
    - Leerzeichen-Korrektur
➡ Formatierung nur auf expliziten Befehl („Format table“).
---
### b) Gemischter Inhalt in Zellen
Zellen dürfen enthalten:
- Inline-Markdown (`**`, `` ` ``, `% %`)
- `<br>` für Zeilenumbrüche
- Tokens (z. B. `"token"`)
➡ Editor darf das **nicht auflösen oder blockieren**.

---
### c) Tabellen dürfen keine Editor-Sperre erzeugen
- Cursor darf **immer**:
    - vor / nach der Tabelle positioniert werden
    - per Tastatur aus der Tabelle heraus
---

## 4) Ergänzte Tabelle – „Tabellen-Interaktion vollständig“
Hier deine Tabelle **sauber erweitert**, ohne Implementierungsdetails:

| Tabellen | Funktion                       | UI                     | Steuerung                             | Voraussetzung          |
| -------- | ------------------------------ | ---------------------- | ------------------------------------- | ---------------------- |
| Spalten  | Einzelspalten-Markierung       | Farbhevorhebung        | Rechts gedrückt halten + ziehen       |                        |
| Spalten  | Ganze Spalten-Markierung       | Farbhevorhebung        | Ziehen über gesamte Spalte            |                        |
| Spalten  | Spalte verschieben             | Greiffläche oben/unten | Linksklick halten + Maus links/rechts | Spalte markiert        |
| Spalten  | Spalte einfügen (links/rechts) | Plus-Indikator         | Klick auf Einfügepunkt                |                        |
| Spalten  | Spalte löschen                 | Kontextaktion          | Klick / Bestätigung                   | Spalte markiert        |
| Zeilen   | Einzelzeilen-Markierung        | Farbhevorhebung        | Rechts gedrückt halten + ziehen       |                        |
| Zeilen   | Ganze Zeilen-Markierung        | Farbhevorhebung        | Ziehen über gesamte Zeile             |                        |
| Zeilen   | Zeile verschieben              | Greiffläche links      | Linksklick halten + Maus hoch/runter  | Zeile markiert         |
| Zeilen   | Zeile einfügen (oben/unten)    | Plus-Indikator         | Klick auf Einfügepunkt                |                        |
| Zeilen   | Zeile löschen                  | Kontextaktion          | Klick / Bestätigung                   | Zeile markiert         |
| Zelle    | Inline-Edit                    | Cursor im Text         | Linksklick in Zelle                   |                        |
| Zelle    | Block-Edit                     | Editor-Overlay         | Klick / Fokus                         | Mehrzeiliger Inhalt    |
| Tabelle  | Kopfzeile markieren            | Farbhevorhebung        | Klick auf Header                      |                        |
| Tabelle  | Separator-Zeile erhalten       | visuell neutral        | keine Autoaktion                      |                        |
| Tabelle  | Gesamttabelle markieren        | Rahmen                 | Klick auf Tabellenrand                |                        |
| Tabelle  | Tabelle als Rohtext bearbeiten | Umschaltaktion         | Klick / Shortcut                      |                        |
| Tabelle  | Rohtext → Render               | Umschaltaktion         | Fokus verlassen                       |                        |
| Tabelle  | Markdown in Zellen             | normal gerendert       | Inline-Edit                           |                        |
| Tabelle  | Navigation                     | visuelle Fokuslinie    | Pfeiltasten / Tab                     |                        |
| Tabelle  | Verlassen der Tabelle          | Cursor außerhalb       | Pfeil / Klick                         |                        |
| Tabelle  | Keine Autoformatierung         | –                      | –                                     | explizite Aktion nötig |

---

## Quintessenz
Was du ergänzt hast, deckt **Bewegung und Selektion** ab.
Was gefehlt hat, sind:

- **Strukturelle Aktionen** (Einfügen/Löschen)
- **Fokus- & Modusregeln**
- **Rohtext-Fallback**
- **Autoformatierungs-Verbot**
- **Header/Separator-Bewusstsein**

Mit diesen Ergänzungen sind Tabellen:
- mächtig,
- kontrollierbar,
- und vor allem **kein Fremdkörper im Markdown-Editor**.
Wenn du willst, kann ich daraus als nächsten Schritt eine **„Table Editing Policy“ (1 Seite)** oder eine **Minimal-UX-Skizze in Textform** ableiten.

## Issue (DE): Flashcard-Syntax v1 (Multiple-Choice) in Markdown + UI-Button „Flashcard“

**Typ:** Feature  
**Priorität:** Medium (anpassbar)  
**Komponenten:** Editor/Markdown-Parser, UI (Right Toolbar), Flashcard-Renderer

### Hintergrund / Problem

In Markdown-Notizen soll ein definierter Flashcard-Block eingebettet werden können. Ein neuer UI-Einstieg soll diese Blöcke erkennen und als Karteikarten anzeigen. In diesem Issue wird ausschließlich **Multiple-Choice** umgesetzt.

### Ziel

1. **Syntax v1** für Multiple-Choice-Flashcards definieren und implementieren.
2. **Neues Buttonfeld „Flashcard“** in der rechten Toolbar (unterhalb Dashboard).
3. Beim Klick: Markdown validieren/parsen, Flashcards extrahieren und im rechten Aktionsfeld rendern – **ohne Auflösung/Ergebnisanzeige**.

---

### Flashcard-Syntax (v1) – Multiple-Choice

**Start:** `#card` (eigene Zeile)  
**Frage:** nächste Zeile (frei, z. B. „1.5 …“)  
**Optionen:** Zeilen im Format `<buchstabe>) <text>` (z. B. `a) …`)  
**Korrekte Antwort(en):** Markerzeilen `-<buchstabe>` (z. B. `-d`, mehrere möglich wie `-a` und `-d`)  
**Ende:** `#` (eigene Zeile)

**Beispiel**

```md
#card
1.5 Welche SQL-Kategorie steuert Zugriffsrechte?
a) DML
b) DDL
c) TCL
d) DCL

-d
#
```

---

### UI/UX Anforderungen

* In der **rechten Toolbar**, **unterhalb des Dashboards**, ein neues Buttonfeld:

  * **Label:** `Flashcard`
* Klick auf `Flashcard`:

  * Validierung/Parsing der aktuellen Markdown-Notiz
  * Suche nach dem oben definierten Syntaxmuster
  * Darstellung der gefundenen Karten im **rechten Aktions-/Anzeige-Feld**
  * **Keine Anzeige der korrekten Antwort(en)** (Marker `-x` dürfen nicht als Ergebnis sichtbar sein)
* Rechts zusätzlich eine **Toolbar für zukünftige Einstellungen** (Placeholder/Struktur, ohne Funktion in diesem Issue), z. B.:

  * Reihenfolge: „in Reihenfolge“ vs. „zufällig“ (ovale Buttons)
  * weitere Modi (z. B. Ja/Nein)
  * Box-System / Anzahl Kästen

---

### Funktionale Anforderungen

* Mehrere Karten pro Markdown-Notiz werden unterstützt.
* Korrektmarker können 0..n mal vorkommen (für spätere Auflösung); Darstellung bleibt ohne Lösung.
* Parser ignoriert die Markerzeilen in der Anzeige.

---

### Akzeptanzkriterien

1. Parser erkennt Karte anhand **exakt**:

   * Startzeile `#card`
   * Endzeile `#`
2. Optionen werden erkannt als Zeilen `a) …`, `b) …`, `c) …`, `d) …` (weitere Buchstaben optional).
3. Korrektmarker werden erkannt als `-a`, `-d` etc., auch mehrfach.
4. Flashcard-Ansicht zeigt:

   * Frage + Optionen
   * **nicht** die `-x` Marker und **kein** „richtig/falsch“-Ergebnis.
5. Button `Flashcard` ist sichtbar in der rechten Toolbar unterhalb Dashboard und triggert das Rendern.
6. Wenn keine Karten gefunden werden:

   * Empty State (z. B. „Keine Flashcards gefunden“), keine Fehler.

---

### Out of Scope

* Weitere Flashcard-Typen (kommen in separaten Issues)
* Implementierung der zukünftigen Einstellungen (nur Placeholder/Struktur)
* Spaced Repetition / Box-Logik / Randomization-Logik

---

### Technische Notizen (optional)

* Parser als reine Textanalyse über Markdown-Content (kein Markdown-AST erforderlich, solange Robustheit genügt).
* Rendering-Komponente erhält strukturierte Daten: `{question, options[], correctKeys[]}`; `correctKeys` wird in UI nicht angezeigt.

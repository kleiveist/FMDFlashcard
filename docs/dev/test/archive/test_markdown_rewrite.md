<!-- AUTO-GENERATED:backlink START -->
[← Back](docs/dev/test/test.md)
<!-- AUTO-GENERATED:backlink END -->
# 1) PreviewPanel Markdown Rewrite Repro (Testdatei)

Ziel: Diese Datei dient dazu, das Verhalten **„Markdown-Editor schließen ⇒ Datei wird umgeschrieben und bekommt zusätzliche Leerzeilen“** zuverlässig zu prüfen.

## Anleitung

1. Datei in der App öffnen.
2. In den **Markdown view (preview/editor)** wechseln.
3. **Nichts ändern** (kein Tippen).
4. Preview/Editor **schließen**.
5. Datei im Diff/Dateisystem prüfen: Wurden **zusätzliche Leerzeilen** eingefügt oder Absätze/Listen/Tabelle umformatiert?

---

## 1) Absätze & harte Zeilenumbrüche

Erste Zeile.
Zweite Zeile (direkt darunter, ohne Leerzeile).

Dritter Absatz (mit Leerzeile davor).

Vierter Absatz.

---

## 2) Mehrere Leerzeilen (sollten stabil bleiben)

Zwischen diesem Absatz

und diesem Absatz sind absichtlich **zwei** leere Zeilen.

---

## 3) Blockquote mit Leerzeilen

> Das ist eine Quote in Zeile 1.
>
> Das ist Quote Zeile 3 (mit leerer Quote-Zeile dazwischen).

---

## 4) Listen (verschachtelt, gemischt)

- Punkt A
- Punkt B
    - Unterpunkt B.1
    - Unterpunkt B.2

1. Nummeriert 1
2. Nummeriert 2
    - Unterpunkt 2.a
    - Unterpunkt 2.b

---

## 5) Inline-Formatierungen (Stern/Unterstrich/Tilde)

**Fett** und *kursiv* und ~~durchgestrichen~~.

Sonderzeichen-Test: a\_b \* c\_d ~~e~~ `inline code` und ein Backslash: \\

---

## 6) Links & Bilder (Link-Text / URL Roundtrip)

Ein normaler Link: [OpenAI](https://openai.com)

Ein Link mit Klammern in der URL:
[Test](https://example.com/path_(with)_parens)

Ein Bild (nur Syntax, muss nicht existieren):

---

## 7) Tabellen (Pipe-Escapes & Zelleninhalt)

| Spalte A | Spalte B | Spalte C |
| --- | --- | --- |
| normal | Text mit \| Pipe | Mehr   Spaces |
| `code` | **bold** | *italic* |
| Zeile mit  HTML | zweite Zelle | dritte Zelle |

---

## 8) Codeblöcke (Backticks, Fence-Länge, Leerzeilen)

````
// Codeblock Test
const x = "``` not a real fence inside string";
const y = "`inline` and **bold** in string";
console.log(x, y);
````

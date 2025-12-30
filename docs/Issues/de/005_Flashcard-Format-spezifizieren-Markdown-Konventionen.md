# Flashcard-Format spezifizieren (Markdown-Konventionen)

## Kontext
Als nächstes folgt Flashcard-Extraktion. Ein klares, versioniertes Format verhindert ad-hoc Parsing.

## Ziel
Ein minimales Flashcard-Syntax-Format definieren, das in Markdown-Notizen eingebettet werden kann.

## Vorschlag (Beispiele)
Wähle eine Variante (andere später ergänzen):
1) Frontmatter:
- `cards:` mit `q`/`a`
2) Fenced Blocks:
```text
:::card
Q: ...
A: ...
:::
```
3) Heading-basiert:
- `## Card` mit `Q:`/`A:` Sections

## Aufgaben
- [ ] Eine kanonische Variante für v1 festlegen.
- [ ] Kurze Spezifikation schreiben: `docs/flashcard-format.md`.
- [ ] Beispiele + Edge-Cases aufnehmen (mehrzeilige Antworten, Codeblöcke).
- [ ] Versions-Tag definieren (z. B. `fmd: 1`) für spätere Erweiterungen.

## Akzeptanzkriterien
- Format ist dokumentiert mit mindestens 5 Beispielen.
- Parser-Anforderungen sind eindeutig genug, um ohne Rätselraten zu implementieren.

## Hinweise
v1 lieber strikt, Kompatibilität später.

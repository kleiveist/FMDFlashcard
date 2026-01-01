# Markdown-Preview rendern (mit sicherer HTML-Sanitization)

## Kontext
Preview zeigt aktuell Rohtext in einem `<pre>`-Block. Für Notizen ist gerendertes Markdown deutlich besser.

## Ziel
Markdown im Preview-Panel zu HTML rendern, ohne unsichere Inhalte auszuführen.

## Umfang
- Markdown-Rendering in React (z. B. `react-markdown`).
- Sanitization (z. B. `rehype-sanitize`) gegen Script-Injection.
- Optional: Code-Block-Highlighting.

## Aufgaben
- [ ] Markdown-Renderer-Dependencies hinzufügen.
- [ ] `<pre className="preview">` durch Markdown-Renderer ersetzen.
- [ ] Optional: Toggle „Raw View“ behalten.
- [ ] Große Dateien sollen weiterhin performant scrollen (Performance prüfen).

## Akzeptanzkriterien
- Markdown rendert Überschriften, Listen, Links, Codeblöcke korrekt.
- Keine Ausführung von Raw-HTML/Script aus Notizen.

## Hinweise
Auch später bei Flashcard-Extraktion ist gerendertes Markdown als Kontext hilfreich.

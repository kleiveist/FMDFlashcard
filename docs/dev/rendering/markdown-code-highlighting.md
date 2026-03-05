<!-- AUTO-GENERATED:backlink START -->
[← Back](rendering.md)
<!-- AUTO-GENERATED:backlink END -->

# Markdown Code Highlighting

## Scope

The desktop frontend uses one shared markdown code highlighting pipeline for:

- Preview panel (view + hybrid preview render paths)
- Markdown contentEditable edit layer in preview mode
- Flashcard markdown blocks
- Exam markdown rendering
- Help panel markdown rendering
- Help editor preview

SVG fences (`language-svg`) still use the dedicated SVG preview path.

## Architecture

- Core engine: `apps/fmd-desktop/src/lib/markdownCodeHighlight.ts`
- Config flags: `apps/fmd-desktop/src/lib/markdownCodeHighlightConfig.ts`
- Shared pre renderer: `apps/fmd-desktop/src/components/MarkdownHighlightedPre.tsx`
- Shared styles: `apps/fmd-desktop/src/styles/components/code-highlighting.css`

Code blocks are rendered as `<pre><code class="language-*">...</code></pre>` and highlighted with `highlight.js` core + language modules loaded lazily on demand.

## Supported Languages

Canonical lazy-loaded language set:

- `bash`
- `c`
- `cpp`
- `csharp`
- `css`
- `diff`
- `dockerfile`
- `go`
- `graphql`
- `groovy`
- `ini`
- `java`
- `javascript`
- `json`
- `kotlin`
- `latex`
- `less`
- `lua`
- `makefile`
- `markdown`
- `matlab`
- `objectivec`
- `perl`
- `php`
- `powershell`
- `python`
- `r`
- `ruby`
- `rust`
- `scala`
- `sql`
- `swift`
- `toml`
- `typescript`
- `vbnet`
- `xml`
- `yaml`

## Aliases

- `js`, `jsx` -> `javascript`
- `ts`, `tsx` -> `typescript`
- `py` -> `python`
- `sh`, `shell`, `zsh` -> `bash`
- `ps1`, `pwsh` -> `powershell`
- `yml` -> `yaml`
- `md` -> `markdown`
- `rb` -> `ruby`
- `rs` -> `rust`
- `c++`, `hpp` -> `cpp`
- `cs` -> `csharp`
- `objc` -> `objectivec`
- `tex` -> `latex`
- `docker` -> `dockerfile`
- `gql` -> `graphql`
- `plain`, `text`, `txt` -> `plaintext` (always plain fallback)

## Config Flags

`MARKDOWN_CODE_HIGHLIGHT_CONFIG` defaults:

- `autoDetectWithoutLanguage: false`
- `showLanguageLabel: true`
- `highlightInContentEditable: true`
- `autoDetectCandidateLanguages`: deterministic fixed order (see config file)

No settings UI is wired. Flags are code-based internal defaults.

## Fallback Behavior

- Explicit known language: highlight with that language.
- Explicit unknown/unsupported language: plain code fallback, no crash.
- No language + default config: plain code fallback.
- No language + `autoDetectWithoutLanguage=true`: auto-detect using configured candidates.
- Any highlight loader/runtime failure: plain code fallback.

## Caching and Scheduling

- Highlight results are cached by key `(language, contentHash)`.
- Cache uses an LRU cap to avoid unbounded growth.
- Live re-highlight in contentEditable mode is debounced and idle-scheduled.
- On input, only affected/nearby code blocks are re-queued (no full document pass per keystroke).

## Security

- Plain fallback output is escaped text.
- Highlight HTML is sanitized before injection:
  - only `span` elements are allowed
  - only `hljs*` classes are allowed
- If sanitization fails, the pipeline falls back to plain escaped code.
- Markdown sanitization (`rehypeRaw` + `rehypeSanitize`) remains unchanged for non-code markdown content.

## DOM Metadata

Code blocks expose:

- `data-md-code-language`
- `data-md-code-language-label`
- `data-md-code-highlighted`

These attributes are used for styling, accessibility labels, and deterministic behavior checks.

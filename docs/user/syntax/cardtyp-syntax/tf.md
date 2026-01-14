<!-- AUTO-GENERATED:backlink START -->
[← Back](cardtyp-syntax.md)
<!-- AUTO-GENERATED:backlink END -->
# Code `tf`: True/False marker (2-button card)

True/false interactions count as `tf` and render as two-button questions where the learner chooses between true and false. The parser recognizes them by pairing a prompt line with the next non-empty line that starts with a `-` and a truthy/falsy token.

## Format

```
#card
Is the following statement true?
The Sun is a star.
-true
#
```

- The question line(s) appear first, followed by a dedicated result marker on the next non-empty line (no blank line between question and marker is required but allowed).
- The marker must begin with `-` and then a keyword. Valid true tokens include `true`, `yes`, `ja`, `wahr`, `vrai`, `verdadero`, `vero`, `waar`, `sant`, `právda`, etc. False tokens include `false`, `no`, `nein`, `falsch`, `falso`, `neh`, `falskt`, `epätosi`, `hakis`, `ложь`, `خطأ`, and their localized equivalents.
- The parser strips punctuation at the end and matches the normalized keyword, so `-true.` and `-ja` both work.

## Behavior notes

- The marker must sit on the next non-empty line after the question; the parser skips blank lines between them.
- The UI shows the question from the card prompt and then the `true/false` buttons. The correct button is governed by the marker.
- Mixing `tf` with other interactive types (m1/m2/cl/cd) in the same task requires explicit multi-widget handling, so keep the block focused or split it with `---`.

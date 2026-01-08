# Table Rendering

This page describes how tables are rendered inside the FMD Flashcard documentation vault:

- Tables follow the standard Markdown syntax (`| Column |`) and respect the ambient theme colors so they stay readable in dark and light modes.
- Overflowing table content wraps within its cell instead of breaking the layout, and vertical alignment is handled automatically by the Markdown renderer.
- If you encounter rendering glitches, check for mismatched pipes or trailing spaces in each row; the parser is strict about consistent column counts.

Add any implementation-specific reminders or browser quirks here as you discover them.

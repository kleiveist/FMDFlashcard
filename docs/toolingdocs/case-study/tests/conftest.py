from __future__ import annotations

import sys
from pathlib import Path

CASE_STUDY = Path(__file__).resolve().parents[1]
SCRIPTS = CASE_STUDY / "scripts"
if str(SCRIPTS) not in sys.path:
    sys.path.insert(0, str(SCRIPTS))

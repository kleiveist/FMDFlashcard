#!/usr/bin/env python3
"""
Debian installer (apt-get).

Rust is installed via official rustup script to avoid apt conflicts and version drift.
Exposes: run_install(dry_run: bool = False) -> int
"""

from __future__ import annotations

# Debian == Ubuntu implementation for now (same logic, different defaults/fallbacks)
from installuixubu import run_install  # re-export


if __name__ == "__main__":
    import argparse

    ap = argparse.ArgumentParser()
    ap.add_argument("--dry-run", action="store_true")
    raise SystemExit(run_install(dry_run=ap.parse_args().dry_run))

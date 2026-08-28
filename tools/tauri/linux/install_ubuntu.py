from __future__ import annotations

from tools.tauri.linux import install_debian


def install(*, dry_run: bool, version_id: str | None = None) -> int:
    return install_debian.install(
        dry_run=dry_run,
        distro_id="ubuntu",
        version_id=version_id,
    )

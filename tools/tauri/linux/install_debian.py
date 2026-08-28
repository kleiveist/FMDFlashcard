from __future__ import annotations

from tools.tauri import common


BASE_PACKAGES = (
    "libwebkit2gtk-4.1-dev",
    "libgtk-3-dev",
    "librsvg2-dev",
    "libssl-dev",
    "libayatana-appindicator3-dev",
    "build-essential",
    "curl",
    "wget",
    "file",
    "libxdo-dev",
    "patchelf",
    "squashfs-tools",
    "desktop-file-utils",
)


def dependency_packages(*, distro_id: str, version_id: str | None) -> tuple[str, ...]:
    """Return Tauri v2 packages using the FUSE 2 name provided by the release."""
    return (*BASE_PACKAGES, fuse_package(distro_id=distro_id, version_id=version_id))


def fuse_package(*, distro_id: str, version_id: str | None) -> str:
    major = _major_version(version_id)
    if distro_id == "ubuntu" and (major is None or major >= 24):
        return "libfuse2t64"
    if distro_id == "debian" and major is not None and major >= 13:
        return "libfuse2t64"
    return "libfuse2"


def _major_version(version_id: str | None) -> int | None:
    if not version_id:
        return None
    try:
        return int(version_id.split(".", 1)[0])
    except ValueError:
        return None


def install(
    *,
    dry_run: bool,
    distro_id: str = "debian",
    version_id: str | None = None,
) -> int:
    distribution = distro_id.capitalize()
    update_command = ["sudo", "apt-get", "update"]
    update_result = common.run_command(update_command, dry_run=dry_run)
    if update_result.returncode != 0:
        common.print_result(
            update_result,
            f"{distribution} package metadata refreshed",
            f"Failed to refresh {distribution} package metadata before installing Tauri dependencies",
        )
        return 1

    common.print_result(
        update_result,
        f"{distribution} package metadata refreshed",
        f"Failed to refresh {distribution} package metadata before installing Tauri dependencies",
    )

    packages = dependency_packages(distro_id=distro_id, version_id=version_id)
    install_command = [
        "sudo",
        "env",
        "DEBIAN_FRONTEND=noninteractive",
        "apt-get",
        "install",
        "-y",
        "--no-install-recommends",
        *packages,
    ]
    install_result = common.run_command(install_command, dry_run=dry_run)
    if install_result.returncode != 0:
        common.print_result(
            install_result,
            f"{distribution} Tauri system dependencies ready",
            f"Failed to install {distribution} Tauri dependencies",
        )
        return 1

    common.print_result(
        install_result,
        f"{distribution} Tauri system dependencies ready",
        f"Failed to install {distribution} Tauri dependencies",
    )
    return 0

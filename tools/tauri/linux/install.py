from __future__ import annotations

from dataclasses import dataclass
from pathlib import Path

from tools import logger
from tools.tauri import common
from tools.tauri.linux import install_arch, install_debian, install_ubuntu


@dataclass(frozen=True, slots=True)
class LinuxDistribution:
    distro_id: str
    version_id: str | None = None


def install_system_dependencies(*, dry_run: bool) -> int:
    if common.host_os() != "linux":
        logger.info("System dependency install skipped on non-Linux host")
        return 0

    distribution = _detect_distribution()
    distro = distribution.distro_id if distribution else None
    version_id = distribution.version_id if distribution else None
    if distro == "ubuntu":
        return install_ubuntu.install(dry_run=dry_run, version_id=version_id)
    if distro == "debian":
        return install_debian.install(
            dry_run=dry_run,
            distro_id="debian",
            version_id=version_id,
        )
    if distro in {"arch", "manjaro"}:
        return install_arch.install(dry_run=dry_run)

    logger.warn(f"Unsupported Linux distribution for automatic Tauri deps: {distro or 'unknown'}")
    logger.info("Install WebKitGTK, GTK3, librsvg, OpenSSL, AppIndicator, patchelf, squashfs-tools and fuse2 manually.")
    return 0


def appimage_install_hint() -> str:
    distribution = _detect_distribution()
    distro = distribution.distro_id if distribution else None
    version_id = distribution.version_id if distribution else None
    if distro in {"arch", "manjaro"}:
        return "sudo pacman -S --needed --noconfirm patchelf squashfs-tools desktop-file-utils fuse2 file"
    if distro in {"ubuntu", "debian"}:
        fuse_package = install_debian.fuse_package(distro_id=distro, version_id=version_id)
        return f"sudo apt-get install -y patchelf squashfs-tools desktop-file-utils file {fuse_package}"
    return "Install patchelf, squashfs-tools, desktop-file-utils, file and libfuse2/fuse2 for your distribution."


def _detect_distro() -> str | None:
    distribution = _detect_distribution()
    return distribution.distro_id if distribution else None


def _detect_distribution() -> LinuxDistribution | None:
    for os_release in (Path("/run/host/etc/os-release"), Path("/etc/os-release")):
        if not os_release.exists():
            continue
        distribution = _distribution_from_os_release(os_release)
        if distribution:
            return distribution
    return None


def _distro_from_os_release(os_release: Path) -> str | None:
    distribution = _distribution_from_os_release(os_release)
    return distribution.distro_id if distribution else None


def _distribution_from_os_release(os_release: Path) -> LinuxDistribution | None:
    values: dict[str, str] = {}
    for line in os_release.read_text(encoding="utf-8", errors="ignore").splitlines():
        if "=" not in line:
            continue
        key, value = line.split("=", 1)
        values[key.lower()] = value.strip().strip('"').lower()
    distro_id = values.get("id")
    like = values.get("id_like", "")
    version_id = values.get("version_id") or None
    if distro_id in {"ubuntu", "debian", "arch", "manjaro"}:
        return LinuxDistribution(distro_id, version_id)
    if distro_id in {"cachyos", "endeavouros"} or "arch" in like:
        return LinuxDistribution("arch", version_id)
    if "ubuntu" in like:
        return LinuxDistribution("ubuntu", version_id)
    if "debian" in like:
        return LinuxDistribution("debian", version_id)
    if distro_id:
        return LinuxDistribution(distro_id, version_id)
    return None

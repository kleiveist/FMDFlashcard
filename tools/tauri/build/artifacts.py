from __future__ import annotations

import argparse
import hashlib
import json
import os
import platform
import shutil
import stat
import tempfile
from collections.abc import Mapping
from dataclasses import dataclass
from pathlib import Path

from tools import logger
from tools.tauri import paths

LINUX_BUNDLE_ORDER = ("deb", "rpm", "appimage")
DEFAULT_LINUX_BUNDLES = ",".join(LINUX_BUNDLE_ORDER)
LINUX_BUNDLE_PATTERNS = {
    "deb": ("*.deb",),
    "rpm": ("*.rpm",),
    "appimage": ("*.AppImage", "*.appimage"),
}
LINUX_ARCHITECTURE = "x86_64"
MANIFEST_NAME = "linux-bundles.json"
CHECKSUMS_NAME = "SHA256SUMS"


class LinuxBundleError(RuntimeError):
    """Raised when Linux bundle inputs or evidence are unsafe or incomplete."""


@dataclass(frozen=True, slots=True)
class LinuxBundleArtifact:
    bundle_type: str
    path: Path
    relative_path: str
    size: int
    sha256: str

    def as_manifest_entry(self) -> dict[str, str | int]:
        return {
            "type": self.bundle_type,
            "path": self.relative_path,
            "size": self.size,
            "sha256": self.sha256,
        }


@dataclass(frozen=True, slots=True)
class VerificationResult:
    requested: tuple[str, ...]
    artifacts: tuple[LinuxBundleArtifact, ...]
    errors: tuple[str, ...]

    @property
    def ok(self) -> bool:
        return not self.errors


@dataclass(frozen=True, slots=True)
class EvidenceFiles:
    manifest: Path
    checksums: Path


@dataclass(frozen=True, slots=True)
class ArtifactFingerprint:
    size: int
    modified_ns: int
    changed_ns: int
    sha256: str


ArtifactSnapshot = dict[str, ArtifactFingerprint]


@dataclass(frozen=True, slots=True)
class _VerificationContext:
    bundle_root: Path
    resolved_bundle_root: Path
    repository: Path
    previous_snapshot: Mapping[str, ArtifactFingerprint] | None


def normalize_linux_bundles(value: str | None, *, default: str = DEFAULT_LINUX_BUNDLES) -> tuple[str, ...]:
    raw = default if value is None else value
    if not raw.strip():
        raise LinuxBundleError("Linux bundle list must not be empty.")

    parts = [item.strip().lower() for item in raw.split(",")]
    if any(not item for item in parts):
        raise LinuxBundleError("Linux bundle list contains an empty item.")

    unknown = sorted(set(parts) - set(LINUX_BUNDLE_ORDER))
    if unknown:
        detail = ", ".join(unknown)
        allowed = ", ".join(LINUX_BUNDLE_ORDER)
        raise LinuxBundleError(f"Unsupported Linux bundle target(s): {detail}. Allowed targets: {allowed}.")

    selected = set(parts)
    return tuple(bundle_type for bundle_type in LINUX_BUNDLE_ORDER if bundle_type in selected)


def prepare_linux_bundle_outputs(
    requested: tuple[str, ...],
    *,
    bundle_root: Path,
    evidence_root: Path,
    repository_root: Path,
    clean_bundles: bool = True,
) -> None:
    """Remove only generated Linux bundle and evidence outputs before a real build."""
    _require_x86_64()
    normalize_linux_bundles(",".join(requested))
    _validate_output_roots(bundle_root, evidence_root, repository_root)
    for bundle_type in LINUX_BUNDLE_ORDER:
        target = bundle_root / bundle_type
        if target.is_symlink():
            raise LinuxBundleError(f"Refusing symlinked Linux bundle directory: {target}")
        if target.exists() and not target.is_dir():
            raise LinuxBundleError(f"Linux bundle output is not a directory: {target}")
        if clean_bundles and target.is_dir():
            shutil.rmtree(target)

    if evidence_root.is_symlink():
        raise LinuxBundleError(f"Refusing to clean symlinked Linux evidence directory: {evidence_root}")
    if evidence_root.exists() and not evidence_root.is_dir():
        raise LinuxBundleError(f"Linux evidence output is not a directory: {evidence_root}")
    if evidence_root.is_dir():
        shutil.rmtree(evidence_root)


def snapshot_linux_bundle_outputs(
    requested: tuple[str, ...],
    bundle_root: Path,
) -> ArtifactSnapshot:
    """Fingerprint existing regular bundle files for strict --no-clean verification."""
    _require_x86_64()
    requested = normalize_linux_bundles(",".join(requested))
    snapshot: ArtifactSnapshot = {}
    for bundle_type in requested:
        bundle_dir = bundle_root / bundle_type
        if bundle_dir.is_symlink():
            continue
        for candidate in _bundle_candidates(bundle_dir, LINUX_BUNDLE_PATTERNS[bundle_type]):
            if candidate.is_symlink():
                continue
            try:
                details = candidate.lstat()
            except OSError:
                continue
            if not stat.S_ISREG(details.st_mode):
                continue
            relative_path = candidate.relative_to(bundle_root).as_posix()
            snapshot[relative_path] = _fingerprint(candidate, details)
    return snapshot


def verify_linux_bundles(
    requested: tuple[str, ...],
    bundle_root: Path,
    *,
    repository_root: Path,
    previous_snapshot: Mapping[str, ArtifactFingerprint] | None = None,
) -> VerificationResult:
    _require_x86_64()
    requested = normalize_linux_bundles(",".join(requested))
    repository = repository_root.resolve()
    resolved_bundle_root = bundle_root.resolve()
    if not resolved_bundle_root.is_relative_to(repository):
        raise LinuxBundleError(f"Linux bundle root is outside the repository: {bundle_root}")
    _reject_symlinked_components(bundle_root, repository_root, "Linux bundle root")

    context = _VerificationContext(
        bundle_root=bundle_root,
        resolved_bundle_root=resolved_bundle_root,
        repository=repository,
        previous_snapshot=previous_snapshot,
    )
    artifacts: list[LinuxBundleArtifact] = []
    errors: list[str] = []
    for bundle_type in requested:
        bundle_artifacts, bundle_errors = _verify_bundle_type(bundle_type, context)
        artifacts.extend(bundle_artifacts)
        errors.extend(bundle_errors)

    artifacts.sort(
        key=lambda item: (
            LINUX_BUNDLE_ORDER.index(item.bundle_type),
            item.relative_path,
        )
    )
    return VerificationResult(requested=requested, artifacts=tuple(artifacts), errors=tuple(errors))


def write_linux_bundle_evidence(
    result: VerificationResult,
    *,
    evidence_root: Path,
    repository_root: Path,
) -> EvidenceFiles:
    if not result.ok:
        raise LinuxBundleError("Cannot write Linux bundle evidence for a failed verification.")

    _validate_evidence_root(evidence_root, repository_root)
    evidence_root.mkdir(parents=True, exist_ok=True)
    manifest_path = evidence_root / MANIFEST_NAME
    checksums_path = evidence_root / CHECKSUMS_NAME
    payload = {
        "schema_version": 1,
        "platform": "linux",
        "architecture": LINUX_ARCHITECTURE,
        "signed": False,
        "bundles": [artifact.as_manifest_entry() for artifact in result.artifacts],
    }
    manifest_text = json.dumps(payload, indent=2, ensure_ascii=False) + "\n"
    checksums_text = "".join(f"{item.sha256}  {item.relative_path}\n" for item in result.artifacts)
    _write_text_atomically(manifest_path, manifest_text)
    _write_text_atomically(checksums_path, checksums_text)
    return EvidenceFiles(manifest=manifest_path, checksums=checksums_path)


def verify_and_write_linux_bundles(
    requested: tuple[str, ...],
    *,
    bundle_root: Path,
    repository_root: Path,
    evidence_root: Path,
    previous_snapshot: Mapping[str, ArtifactFingerprint] | None = None,
) -> tuple[VerificationResult, EvidenceFiles | None]:
    result = verify_linux_bundles(
        requested,
        bundle_root,
        repository_root=repository_root,
        previous_snapshot=previous_snapshot,
    )
    if not result.ok:
        return result, None
    return result, write_linux_bundle_evidence(
        result,
        evidence_root=evidence_root,
        repository_root=repository_root,
    )


def render_linux_bundle_summary(result: VerificationResult) -> str:
    if not result.ok:
        raise LinuxBundleError("Cannot render a Linux bundle summary for a failed verification.")
    lines = [
        "## Unsigned Linux x86_64 verification candidates",
        "",
        "| Format | Architecture | File | Size | SHA-256 |",
        "| --- | --- | --- | ---: | --- |",
    ]
    for artifact in result.artifacts:
        label = "AppImage" if artifact.bundle_type == "appimage" else artifact.bundle_type.upper()
        lines.append(
            f"| {label} | {LINUX_ARCHITECTURE} | `{artifact.relative_path}` | {artifact.size} | `{artifact.sha256}` |"
        )
    return "\n".join(lines) + "\n"


def main(args: argparse.Namespace) -> int:
    if getattr(args, "target", "linux") != "linux":
        logger.fail("Linux bundle verification supports only '--target linux'.")
        return 1
    try:
        requested = normalize_linux_bundles(getattr(args, "bundles", None))
        result, evidence = verify_and_write_linux_bundles(
            requested,
            bundle_root=paths.TAURI_DIR / "target" / "release" / "bundle",
            repository_root=paths.ROOT,
            evidence_root=paths.DIST_DIR / "linux",
        )
    except (LinuxBundleError, OSError) as exc:
        logger.fail(str(exc))
        return 1

    log_linux_bundle_verification(result)
    if not result.ok or evidence is None:
        return 1
    logger.ok(f"Linux bundle manifest: {evidence.manifest.relative_to(paths.ROOT)}")
    logger.ok(f"Linux bundle checksums: {evidence.checksums.relative_to(paths.ROOT)}")
    summary_file = getattr(args, "summary_file", None)
    if summary_file:
        try:
            with Path(summary_file).open("a", encoding="utf-8") as stream:
                stream.write(render_linux_bundle_summary(result))
        except OSError as exc:
            logger.fail(f"Could not write Linux bundle summary: {exc}")
            return 1
    return 0


def _bundle_candidates(bundle_dir: Path, patterns: tuple[str, ...]) -> list[Path]:
    candidates = {candidate for pattern in patterns for candidate in bundle_dir.rglob(pattern)}
    return sorted(candidates, key=lambda path: path.as_posix())


def _verify_bundle_type(
    bundle_type: str,
    context: _VerificationContext,
) -> tuple[list[LinuxBundleArtifact], list[str]]:
    bundle_dir = context.bundle_root / bundle_type
    if bundle_dir.is_symlink() or not bundle_dir.resolve().is_relative_to(context.resolved_bundle_root):
        return [], [f"Requested Linux bundle '{bundle_type}' has an unsafe output directory: {bundle_dir}"]

    verified: list[LinuxBundleArtifact] = []
    errors: list[str] = []
    for candidate in _bundle_candidates(bundle_dir, LINUX_BUNDLE_PATTERNS[bundle_type]):
        artifact, error = _verify_candidate(bundle_type, candidate, bundle_dir, context)
        if error:
            errors.append(error)
        elif artifact is not None:
            verified.append(artifact)
    if not verified and not errors:
        errors.append(f"Requested Linux bundle '{bundle_type}' was not produced.")
    return verified, errors


def _verify_candidate(
    bundle_type: str,
    candidate: Path,
    bundle_dir: Path,
    context: _VerificationContext,
) -> tuple[LinuxBundleArtifact | None, str | None]:
    error = _candidate_error(candidate, bundle_dir, context.resolved_bundle_root)
    if error:
        return None, error
    try:
        details = candidate.lstat()
        if details.st_size <= 0:
            return (
                None,
                f"Requested Linux bundle '{bundle_type}' is empty: {_relative(candidate, context.repository)}",
            )
        digest = _sha256(candidate)
        final_details = candidate.lstat()
    except OSError as exc:
        return None, f"Linux bundle could not be inspected: {candidate}: {exc}"
    if _stat_identity(details) != _stat_identity(final_details):
        return (
            None,
            f"Requested Linux bundle '{bundle_type}' changed during verification: {candidate}",
        )

    snapshot_path = candidate.relative_to(context.bundle_root).as_posix()
    fingerprint = ArtifactFingerprint(
        final_details.st_size,
        final_details.st_mtime_ns,
        final_details.st_ctime_ns,
        digest,
    )
    if context.previous_snapshot is not None and context.previous_snapshot.get(snapshot_path) == fingerprint:
        relative_path = _relative(candidate, context.repository)
        return (
            None,
            f"Requested Linux bundle '{bundle_type}' was not refreshed by the current build: {relative_path}",
        )
    return (
        LinuxBundleArtifact(
            bundle_type=bundle_type,
            path=candidate,
            relative_path=_relative(candidate, context.repository),
            size=final_details.st_size,
            sha256=digest,
        ),
        None,
    )


def _candidate_error(candidate: Path, bundle_dir: Path, bundle_root: Path) -> str | None:
    try:
        details = candidate.lstat()
    except OSError as exc:
        return f"Linux bundle could not be inspected: {candidate}: {exc}"
    if candidate.is_symlink() or not stat.S_ISREG(details.st_mode):
        return f"Linux bundle is not a regular file: {candidate}"
    resolved = candidate.resolve()
    if not resolved.is_relative_to(bundle_dir.resolve()) or not resolved.is_relative_to(bundle_root):
        return f"Linux bundle resolves outside its allowed directory: {candidate}"
    return None


def log_linux_bundle_verification(result: VerificationResult) -> None:
    logger.info("Linux release bundle verification")
    for bundle_type in result.requested:
        label = "AppImage" if bundle_type == "appimage" else bundle_type.upper()
        logger.info(f"{label}:")
        for artifact in (item for item in result.artifacts if item.bundle_type == bundle_type):
            logger.ok(f"PASS {artifact.relative_path} ({artifact.size} bytes)")
    for error in result.errors:
        logger.fail(f"FAIL: {error}")


def _require_x86_64() -> None:
    if platform.machine().lower() not in {"x86_64", "amd64"}:
        raise LinuxBundleError("Linux release bundle evidence currently supports x86_64 hosts only.")


def _relative(path: Path, repository_root: Path) -> str:
    return path.resolve().relative_to(repository_root.resolve()).as_posix()


def _sha256(path: Path) -> str:
    digest = hashlib.sha256()
    with path.open("rb") as stream:
        for chunk in iter(lambda: stream.read(1024 * 1024), b""):
            digest.update(chunk)
    return digest.hexdigest()


def _fingerprint(path: Path, details: os.stat_result | None = None) -> ArtifactFingerprint:
    details = details or path.lstat()
    return ArtifactFingerprint(
        size=details.st_size,
        modified_ns=details.st_mtime_ns,
        changed_ns=details.st_ctime_ns,
        sha256=_sha256(path),
    )


def _stat_identity(details: os.stat_result) -> tuple[int, int, int]:
    return details.st_size, details.st_mtime_ns, details.st_ctime_ns


def _validate_output_roots(bundle_root: Path, evidence_root: Path, repository_root: Path) -> None:
    repository = repository_root.resolve()
    resolved_bundle_root = bundle_root.resolve()
    resolved_evidence_root = evidence_root.resolve()
    if bundle_root.parts[-3:] != ("target", "release", "bundle"):
        raise LinuxBundleError(f"Refusing unsafe Linux bundle cleanup root: {bundle_root}")
    if evidence_root.parts[-3:] != (".dist", "desktop", "linux"):
        raise LinuxBundleError(f"Refusing unsafe Linux evidence cleanup root: {evidence_root}")
    if not resolved_bundle_root.is_relative_to(repository):
        raise LinuxBundleError(f"Linux bundle cleanup root is outside the repository: {bundle_root}")
    if not resolved_evidence_root.is_relative_to(repository):
        raise LinuxBundleError(f"Linux evidence cleanup root is outside the repository: {evidence_root}")
    _reject_symlinked_components(bundle_root, repository_root, "Linux bundle cleanup root")
    _reject_symlinked_components(evidence_root, repository_root, "Linux evidence cleanup root")


def _validate_evidence_root(evidence_root: Path, repository_root: Path) -> None:
    if evidence_root.exists() and not evidence_root.is_dir():
        raise LinuxBundleError(f"Linux evidence output is not a directory: {evidence_root}")
    if evidence_root.parts[-3:] != (".dist", "desktop", "linux"):
        raise LinuxBundleError(f"Refusing unsafe Linux evidence output root: {evidence_root}")
    if not evidence_root.resolve().is_relative_to(repository_root.resolve()):
        raise LinuxBundleError(f"Linux evidence output is outside the repository: {evidence_root}")
    _reject_symlinked_components(evidence_root, repository_root, "Linux evidence output root")


def _reject_symlinked_components(path: Path, repository_root: Path, label: str) -> None:
    repository = Path(os.path.abspath(repository_root))
    target = Path(os.path.abspath(path))
    try:
        relative = target.relative_to(repository)
    except ValueError as exc:
        raise LinuxBundleError(f"{label} is outside the repository: {path}") from exc
    current = repository
    for component in relative.parts:
        current /= component
        if current.is_symlink():
            raise LinuxBundleError(f"Refusing symlinked component in {label}: {current}")


def _write_text_atomically(path: Path, content: str) -> None:
    descriptor, temporary_name = tempfile.mkstemp(prefix=f".{path.name}.", suffix=".tmp", dir=path.parent)
    temporary = Path(temporary_name)
    try:
        with os.fdopen(descriptor, "w", encoding="utf-8", newline="\n") as stream:
            stream.write(content)
        temporary.chmod(0o644)
        temporary.replace(path)
    except BaseException:
        temporary.unlink(missing_ok=True)
        raise

from __future__ import annotations

import hashlib
import os
from pathlib import Path

import pytest

from tools.integration.assets import (
    AssetError,
    copy_packaged_asset,
    read_packaged_asset,
)


def test_packaged_asset_read_and_atomic_copy_are_bounded(tmp_path: Path) -> None:
    assets = tmp_path / "resources"
    destination = tmp_path / "staging"
    (assets / "profiles").mkdir(parents=True)
    destination.mkdir()
    content = b'profile = "web-only"\n'
    (assets / "profiles/web-only.toml").write_bytes(content)
    digest = hashlib.sha256(content).hexdigest()

    assert (
        read_packaged_asset(
            assets,
            "profiles/web-only.toml",
            expected_sha256=f"sha256:{digest}",
        )
        == content
    )
    copied = copy_packaged_asset(
        assets,
        "profiles/web-only.toml",
        destination,
        "tools/resources/profiles/web-only.toml",
        expected_sha256=digest,
    )

    assert copied == destination / "tools/resources/profiles/web-only.toml"
    assert copied.read_bytes() == content
    assert not copied.stat().st_mode & 0o111
    if os.name != "nt":
        assert copied.stat().st_mode & 0o777 == 0o644


@pytest.mark.parametrize(
    "relative",
    (
        "../secret.txt",
        "/absolute.txt",
        "C:/absolute.txt",
        "nested\\windows.txt",
        "nested//empty.txt",
        "tools/CON",
    ),
)
def test_packaged_asset_paths_must_be_portable_and_relative(
    tmp_path: Path, relative: str
) -> None:
    assets = tmp_path / "resources"
    assets.mkdir()

    with pytest.raises(AssetError, match="safe project-relative"):
        read_packaged_asset(assets, relative)


def test_packaged_asset_rejects_symlinks_and_digest_or_size_mismatch(
    tmp_path: Path,
) -> None:
    assets = tmp_path / "resources"
    assets.mkdir()
    external = tmp_path / "external.txt"
    external.write_bytes(b"external")
    try:
        os.symlink(external, assets / "linked.txt")
    except (OSError, NotImplementedError):
        pytest.skip("symbolic links are not available")

    with pytest.raises(AssetError, match="regular file"):
        read_packaged_asset(assets, "linked.txt")
    (assets / "ordinary.txt").write_bytes(b"ordinary")
    with pytest.raises(AssetError, match="SHA-256"):
        read_packaged_asset(assets, "ordinary.txt", expected_sha256="0" * 64)
    with pytest.raises(AssetError, match="exceeds"):
        read_packaged_asset(assets, "ordinary.txt", max_bytes=2)


@pytest.mark.parametrize(
    "relative",
    (
        "frontend/src/generated.ts",
        "backend/app/generated.py",
        "src-tauri/src/generated.rs",
        "storage/customer.sqlite",
        ".env",
        "package.json",
        "tools/secrets/token.txt",
        "tools/.env.production",
        "tools/secrets.json",
        "tools/.envrc",
        "tools/production.env",
        "tools/client.jks",
        "tools/id_rsa",
    ),
)
def test_asset_copy_refuses_product_data_and_source_paths(
    tmp_path: Path, relative: str
) -> None:
    assets = tmp_path / "resources"
    destination = tmp_path / "staging"
    assets.mkdir()
    destination.mkdir()
    (assets / "safe.txt").write_bytes(b"safe")

    with pytest.raises(AssetError, match="Refusing"):
        copy_packaged_asset(assets, "safe.txt", destination, relative)


def test_asset_copy_never_follows_destination_links_or_overwrites_by_default(
    tmp_path: Path,
) -> None:
    assets = tmp_path / "resources"
    destination = tmp_path / "staging"
    assets.mkdir()
    destination.mkdir()
    (assets / "safe.txt").write_bytes(b"safe")
    (destination / "tools").mkdir()
    (destination / "tools/existing.txt").write_bytes(b"project")

    with pytest.raises(AssetError, match="Refusing to overwrite"):
        copy_packaged_asset(assets, "safe.txt", destination, "tools/existing.txt")

    external = tmp_path / "external"
    external.mkdir()
    try:
        os.symlink(external, destination / "tools/linked")
    except (OSError, NotImplementedError):
        pytest.skip("symbolic links are not available")
    with pytest.raises(AssetError, match="symbolic link"):
        copy_packaged_asset(assets, "safe.txt", destination, "tools/linked/copied.txt")

from __future__ import annotations

from pathlib import Path

import pytest

from tools.quality.config import DEFAULT_CONFIG_PATH, load_quality_config
from tools.quality.model import QualityConfig

ROOT = Path(__file__).resolve().parents[3]
CONFIG_PATH = DEFAULT_CONFIG_PATH


@pytest.fixture
def quality_config() -> QualityConfig:
    return load_quality_config(CONFIG_PATH, project_root=ROOT)


@pytest.fixture
def quality_config_text() -> str:
    return CONFIG_PATH.read_text(encoding="utf-8")

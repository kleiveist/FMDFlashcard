"""Profile-driven technology adapters for portable project tooling."""

from collections.abc import Iterable

from tools.adapters.backend import BackendAdapter
from tools.adapters.base import (
    Adapter,
    AdapterActionResult,
    AdapterApplyError,
    AdapterCapability,
    AdapterContractError,
    AdapterDesiredState,
    AdapterDetection,
    AdapterError,
    BaseAdapter,
    BuildCapability,
    InstallCapability,
    PathRequirement,
    RunCapability,
    StopCapability,
    TestCapability,
    TransactionBoundary,
    project_relative_path,
)
from tools.adapters.ci import CiAdapter
from tools.adapters.container import ContainerAdapter
from tools.adapters.database import DatabaseAdapter
from tools.adapters.documentation import DocumentationAdapter
from tools.adapters.frontend import FrontendAdapter
from tools.adapters.quality import QualityAdapter
from tools.adapters.registry import (
    AdapterRegistry,
    AdapterRegistryError,
    UnknownAdapterError,
)
from tools.adapters.release import ReleaseAdapter
from tools.adapters.tauri import TauriAdapter
from tools.adapters.testing import TestingAdapter
from tools.integration.model import StructuredChange


def default_adapters(
    *,
    transaction_boundary: TransactionBoundary | None = None,
) -> tuple[Adapter, ...]:
    """Construct every built-in adapter with one optional shared boundary."""

    adapter_types = (
        BackendAdapter,
        CiAdapter,
        ContainerAdapter,
        DatabaseAdapter,
        DocumentationAdapter,
        FrontendAdapter,
        QualityAdapter,
        ReleaseAdapter,
        TestingAdapter,
        TauriAdapter,
    )
    return tuple(
        adapter_type(transaction_boundary=transaction_boundary)
        for adapter_type in adapter_types
    )


def build_default_registry(
    *,
    transaction_boundary: TransactionBoundary | None = None,
    extra_adapters: Iterable[Adapter] = (),
) -> AdapterRegistry:
    """Build a fresh deterministic registry for one integration service."""

    return AdapterRegistry(
        (*default_adapters(transaction_boundary=transaction_boundary), *extra_adapters),
        transaction_boundary=transaction_boundary,
    )


DEFAULT_REGISTRY = build_default_registry()


__all__ = [
    "DEFAULT_REGISTRY",
    "Adapter",
    "AdapterActionResult",
    "AdapterApplyError",
    "AdapterCapability",
    "AdapterContractError",
    "AdapterDesiredState",
    "AdapterDetection",
    "AdapterError",
    "AdapterRegistry",
    "AdapterRegistryError",
    "BackendAdapter",
    "BaseAdapter",
    "BuildCapability",
    "CiAdapter",
    "ContainerAdapter",
    "DatabaseAdapter",
    "DocumentationAdapter",
    "FrontendAdapter",
    "InstallCapability",
    "PathRequirement",
    "QualityAdapter",
    "ReleaseAdapter",
    "RunCapability",
    "StopCapability",
    "StructuredChange",
    "TauriAdapter",
    "TestCapability",
    "TestingAdapter",
    "TransactionBoundary",
    "UnknownAdapterError",
    "build_default_registry",
    "default_adapters",
    "project_relative_path",
]

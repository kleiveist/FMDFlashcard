"""Deterministic adapter registration and profile-driven orchestration."""

from __future__ import annotations

import re
from collections.abc import Iterable
from typing import TYPE_CHECKING

from tools.adapters.base import (
    Adapter,
    AdapterCapability,
    AdapterDesiredState,
    AdapterDetection,
    AdapterError,
    TransactionBoundary,
)
from tools.core.context import ProjectContext
from tools.core.filesystem import FilesystemSafetyError, safe_relative_path
from tools.integration.model import (
    Conflict,
    IntegrationPlan,
    IntegrationResult,
    Operation,
    OperationKind,
    Ownership,
    StructuredChange,
    VerificationResult,
)
from tools.integration.planner import DesiredProfile
from tools.integration.verify import verify_adapters

if TYPE_CHECKING:
    from tools.profiles.model import ProfileCatalog, ProjectProfile


_IDENTIFIER = re.compile(r"[a-z][a-z0-9]*(?:-[a-z0-9]+)*")


class AdapterRegistryError(AdapterError):
    """Raised when registration or selection is ambiguous."""


class UnknownAdapterError(AdapterRegistryError):
    """Raised when a profile references an adapter absent from the registry."""


class AdapterRegistry:
    """Unique adapter catalog with deterministic profile orchestration."""

    def __init__(
        self,
        adapters: Iterable[Adapter] = (),
        *,
        transaction_boundary: TransactionBoundary | None = None,
    ) -> None:
        self._adapters: dict[str, Adapter] = {}
        self._features: dict[str, str] = {}
        self._transaction_boundary = transaction_boundary
        for adapter in adapters:
            self.register(adapter)

    def register(self, adapter: Adapter) -> None:
        """Register one contract-valid adapter and reject ambiguous ownership."""

        if not isinstance(adapter, Adapter):
            raise AdapterRegistryError(
                f"Object {type(adapter).__name__} does not implement the adapter contract."
            )
        name = adapter.name
        if not isinstance(name, str) or not _IDENTIFIER.fullmatch(name):
            raise AdapterRegistryError(
                f"Adapter name must use lowercase kebab-case: {name!r}."
            )
        if name in self._adapters:
            raise AdapterRegistryError(f"Duplicate adapter name: {name!r}.")
        for feature in adapter.feature_ids:
            if not isinstance(feature, str) or not _IDENTIFIER.fullmatch(feature):
                raise AdapterRegistryError(
                    f"Adapter {name!r} declares an invalid feature id: {feature!r}."
                )
            owner = self._features.get(feature)
            if owner is not None:
                raise AdapterRegistryError(
                    f"Feature {feature!r} is claimed by both {owner!r} and {name!r}."
                )
        declared = tuple(adapter.feature_ids)
        if declared != tuple(sorted(set(declared))):
            raise AdapterRegistryError(
                f"Adapter {name!r} feature ids must be unique and sorted."
            )
        if not isinstance(adapter.core, bool):
            raise AdapterRegistryError(f"Adapter {name!r} core flag must be boolean.")
        if not isinstance(adapter.capabilities, frozenset) or any(
            not isinstance(item, AdapterCapability) for item in adapter.capabilities
        ):
            raise AdapterRegistryError(
                f"Adapter {name!r} capabilities must be AdapterCapability values."
            )
        self._adapters[name] = adapter
        self._features.update({feature: name for feature in declared})

    @property
    def names(self) -> tuple[str, ...]:
        return tuple(sorted(self._adapters))

    @property
    def feature_ids(self) -> tuple[str, ...]:
        return tuple(sorted(self._features))

    def all(self) -> tuple[Adapter, ...]:
        return tuple(self._adapters[name] for name in self.names)

    def get(self, name: str) -> Adapter:
        try:
            return self._adapters[name]
        except KeyError as exc:
            known = ", ".join(self.names)
            raise UnknownAdapterError(
                f"Unknown adapter {name!r}. Available adapters: {known}."
            ) from exc

    def select_names(self, names: Iterable[str]) -> tuple[Adapter, ...]:
        requested = tuple(names)
        if any(not isinstance(name, str) for name in requested):
            raise AdapterRegistryError("Adapter selections must contain only names.")
        return tuple(self.get(name) for name in sorted(set(requested)))

    def select_for_features(
        self,
        feature_ids: Iterable[str],
        *,
        include_core: bool = True,
    ) -> tuple[Adapter, ...]:
        """Select core and uniquely claimed feature adapters by stable name."""

        requested = tuple(feature_ids)
        unknown = sorted(set(requested).difference(self._features))
        if unknown:
            raise AdapterRegistryError(
                f"No adapter is registered for feature(s): {', '.join(unknown)}."
            )
        names = {self._features[feature] for feature in requested}
        if include_core:
            names.update(adapter.name for adapter in self.all() if adapter.core)
        return self.select_names(names)

    def select_for_profile(
        self,
        profile: ProjectProfile,
        catalog: ProfileCatalog,
    ) -> tuple[Adapter, ...]:
        """Resolve catalog-declared core and feature adapter mappings."""

        core_names = getattr(catalog, "core_adapters", None)
        if not isinstance(core_names, tuple):
            raise AdapterRegistryError(
                "Profile catalog must expose a tuple of core adapter names."
            )
        profile_features = getattr(profile, "features", None)
        if not isinstance(profile_features, tuple):
            raise AdapterRegistryError("Project profile features must be a tuple.")
        names = set(core_names)
        for feature_id in profile_features:
            feature = catalog.features.get(feature_id)
            if feature is None:
                raise AdapterRegistryError(
                    f"Profile {profile.profile_id!r} references unknown feature {feature_id!r}."
                )
            adapter_name = getattr(feature, "adapter", None)
            if not isinstance(adapter_name, str) or not adapter_name:
                raise AdapterRegistryError(
                    f"Feature {feature_id!r} has no adapter mapping."
                )
            adapter = self.get(adapter_name)
            if feature_id not in adapter.feature_ids:
                raise AdapterRegistryError(
                    f"Feature {feature_id!r} maps to adapter {adapter_name!r}, "
                    "but that adapter does not claim the feature."
                )
            names.add(adapter_name)
        return self.select_names(names)

    def capable(self, capability: AdapterCapability) -> tuple[Adapter, ...]:
        if not isinstance(capability, AdapterCapability):
            raise AdapterRegistryError("Capability lookup requires AdapterCapability.")
        return tuple(
            adapter for adapter in self.all() if capability in adapter.capabilities
        )

    def structured_key_allowlist(
        self,
        context: ProjectContext,
        adapters: Iterable[Adapter] | None = None,
    ) -> dict[str, frozenset[str]]:
        """Return the exact declared structured policy for a selection."""

        selected = self._selection(adapters)
        by_path: dict[str, set[str]] = {}
        canonical_paths: dict[str, str] = {}
        owners: dict[tuple[str, str], str] = {}
        for adapter in selected:
            policies = adapter.structured_key_allowlist(context)
            if not isinstance(policies, dict):
                raise AdapterRegistryError(
                    f"Adapter {adapter.name!r} returned an invalid structured allowlist."
                )
            for path, keys in policies.items():
                if not isinstance(path, str):
                    raise AdapterRegistryError(
                        f"Adapter {adapter.name!r} returned a non-text policy path."
                    )
                try:
                    normalized_path = safe_relative_path(path)
                except FilesystemSafetyError as exc:
                    raise AdapterRegistryError(
                        f"Adapter {adapter.name!r} returned an unsafe policy path."
                    ) from exc
                if normalized_path != path:
                    raise AdapterRegistryError(
                        f"Adapter {adapter.name!r} returned a non-canonical policy path."
                    )
                collision_key = path.casefold()
                canonical = canonical_paths.setdefault(collision_key, path)
                if canonical != path:
                    raise AdapterRegistryError(
                        "Selected adapters declared case-colliding structured paths: "
                        f"{canonical!r} and {path!r}."
                    )
                if (
                    not isinstance(keys, frozenset)
                    or not keys
                    or any(
                        not isinstance(key, str)
                        or not key
                        or any(not part for part in key.split("."))
                        for key in keys
                    )
                ):
                    raise AdapterRegistryError(
                        f"Adapter {adapter.name!r} returned invalid keys for {path}."
                    )
                for key in keys:
                    overlap = next(
                        (
                            (claimed_path, claimed_owner)
                            for (
                                claimed_path_key,
                                claimed_path,
                            ), claimed_owner in owners.items()
                            if claimed_path_key == collision_key
                            and _dotted_keys_overlap(key, claimed_path)
                        ),
                        None,
                    )
                    if overlap is not None:
                        claimed_path, previous = overlap
                        raise AdapterRegistryError(
                            f"Structured keys {key!r} and {claimed_path!r} at {path!r} "
                            f"are claimed by both {previous!r} and {adapter.name!r}."
                        )
                    owner_key = (collision_key, key)
                    previous = owners.get(owner_key)
                    if previous is not None:
                        raise AdapterRegistryError(
                            f"Structured key {key!r} at {path!r} is claimed by "
                            f"both {previous!r} and {adapter.name!r}."
                        )
                    owners[owner_key] = adapter.name
                by_path.setdefault(path, set()).update(keys)
        return {path: frozenset(by_path[path]) for path in sorted(by_path)}

    def detect(
        self,
        context: ProjectContext,
        adapters: Iterable[Adapter] | None = None,
    ) -> tuple[AdapterDetection, ...]:
        selected = self._selection(adapters)
        return tuple(adapter.detect(context) for adapter in selected)

    def plan(
        self,
        context: ProjectContext,
        desired_state: AdapterDesiredState | DesiredProfile | ProjectProfile,
        adapters: Iterable[Adapter] | None = None,
    ) -> IntegrationPlan:
        desired = AdapterDesiredState.from_profile(desired_state)
        selected = (
            self.select_for_features(desired.features)
            if adapters is None
            else self._selection(adapters)
        )
        plans = tuple(adapter.plan(context, desired) for adapter in selected)
        operations = _merge_disjoint_patch_operations(
            tuple(operation for plan in plans for operation in plan.operations)
        )
        conflicts = tuple(
            sorted(
                (conflict for plan in plans for conflict in plan.conflicts),
                key=lambda item: (item.path, item.code, item.reason),
            )
        )
        duplicate_conflicts = _duplicate(
            (item.path.casefold(), item.code, item.reason) for item in conflicts
        )
        if duplicate_conflicts is not None:
            conflicts = _deduplicate_conflicts(conflicts)
        return IntegrationPlan(
            profile=desired.profile,
            desired_features=desired.features,
            operations=operations,
            conflicts=conflicts,
        )

    def apply(
        self,
        context: ProjectContext,
        plan_or_operations: IntegrationPlan | Iterable[Operation],
    ) -> IntegrationResult:
        """Submit one combined plan through the registry's shared boundary."""

        if self._transaction_boundary is None:
            raise AdapterRegistryError(
                "Adapter registry has no shared transaction boundary."
            )
        if isinstance(plan_or_operations, IntegrationPlan):
            plan = plan_or_operations
        else:
            operations = tuple(plan_or_operations)
            if any(not isinstance(item, Operation) for item in operations):
                raise AdapterRegistryError(
                    "Adapter registry may apply only typed Operation objects."
                )
            plan = IntegrationPlan(
                profile=context.config.profile,
                desired_features=tuple(sorted(context.config.optional_features)),
                operations=tuple(
                    sorted(
                        operations,
                        key=lambda item: (
                            item.path,
                            str(item.kind),
                            item.source_path or "",
                        ),
                    )
                ),
            )
        if plan.conflicts:
            raise AdapterRegistryError(
                "Refusing to submit an adapter plan that contains conflicts."
            )
        if any(item.ownership is Ownership.PROJECT for item in plan.operations):
            raise AdapterRegistryError("Refusing to submit a project-owned write.")
        normalized_operations = _merge_disjoint_patch_operations(plan.operations)
        if normalized_operations != plan.operations:
            plan = IntegrationPlan(
                profile=plan.profile,
                desired_features=plan.desired_features,
                operations=normalized_operations,
                conflicts=plan.conflicts,
            )
        return self._transaction_boundary.submit(
            context,
            plan,
            source="adapter-registry",
        )

    def verify(
        self,
        context: ProjectContext,
        adapters: Iterable[Adapter] | None = None,
    ) -> VerificationResult:
        return verify_adapters(context, self._selection(adapters))

    def _selection(
        self,
        adapters: Iterable[Adapter] | None,
    ) -> tuple[Adapter, ...]:
        if adapters is None:
            return self.all()
        selected = tuple(adapters)
        names = [adapter.name for adapter in selected]
        if len(names) != len(set(names)):
            raise AdapterRegistryError("Adapter selection contains duplicate names.")
        for adapter in selected:
            registered = self.get(adapter.name)
            if registered is not adapter:
                raise AdapterRegistryError(
                    f"Adapter selection contains an unregistered instance: {adapter.name!r}."
                )
        return tuple(sorted(selected, key=lambda adapter: adapter.name))


def _duplicate(values: Iterable[object]) -> object | None:
    seen: set[object] = set()
    for value in values:
        if value in seen:
            return value
        seen.add(value)
    return None


def _deduplicate_conflicts(conflicts: tuple[Conflict, ...]) -> tuple[Conflict, ...]:
    selected: dict[tuple[str, str, str], Conflict] = {}
    for conflict in conflicts:
        selected.setdefault(
            (conflict.path.casefold(), conflict.code, conflict.reason),
            conflict,
        )
    return tuple(
        sorted(selected.values(), key=lambda item: (item.path, item.code, item.reason))
    )


def _merge_disjoint_patch_operations(
    operations: Iterable[Operation],
) -> tuple[Operation, ...]:
    """Merge only compatible, key-disjoint PATCHes that share one exact path."""

    by_path: dict[str, list[Operation]] = {}
    canonical_paths: dict[str, str] = {}
    for operation in operations:
        collision_key = operation.path.casefold()
        canonical = canonical_paths.setdefault(collision_key, operation.path)
        if canonical != operation.path:
            raise AdapterRegistryError(
                "Selected adapters produced case-colliding operation paths: "
                f"{canonical!r} and {operation.path!r}."
            )
        by_path.setdefault(operation.path, []).append(operation)

    merged: list[Operation] = []
    for path in sorted(by_path):
        items = by_path[path]
        if len(items) == 1:
            merged.append(items[0])
            continue
        if any(
            item.kind is not OperationKind.PATCH
            or item.ownership is not Ownership.STRUCTURED
            or item.content is not None
            or item.source_path is not None
            for item in items
        ):
            raise AdapterRegistryError(
                f"Selected adapters produced overlapping operations: {path.casefold()}."
            )
        preimages = {item.expected_sha256 for item in items}
        if len(preimages) != 1 or None in preimages:
            raise AdapterRegistryError(
                f"Structured PATCHes disagree on the preimage at {path}."
            )
        changes: list[StructuredChange] = []
        claimed: set[str] = set()
        for item in items:
            for change in item.structured_changes:
                overlap = next(
                    (key for key in claimed if _dotted_keys_overlap(change.key, key)),
                    None,
                )
                if overlap is not None:
                    raise AdapterRegistryError(
                        f"Structured PATCHes overlap at {path}: "
                        f"{overlap!r} and {change.key!r}."
                    )
                claimed.add(change.key)
                changes.append(change)
        reasons = sorted({item.reason for item in items if item.reason})
        merged.append(
            Operation(
                OperationKind.PATCH,
                path,
                Ownership.STRUCTURED,
                expected_sha256=items[0].expected_sha256,
                reason="; ".join(reasons),
                structured_changes=tuple(
                    sorted(changes, key=lambda change: change.key)
                ),
            )
        )
    return tuple(
        sorted(
            merged,
            key=lambda item: (item.path, str(item.kind), item.source_path or ""),
        )
    )


def _dotted_keys_overlap(left: str, right: str) -> bool:
    return left == right or left.startswith(f"{right}.") or right.startswith(f"{left}.")


__all__ = [
    "AdapterRegistry",
    "AdapterRegistryError",
    "UnknownAdapterError",
]

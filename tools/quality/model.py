from __future__ import annotations

from dataclasses import dataclass, field, replace
from enum import IntEnum
from pathlib import Path
from typing import Any


class Severity(IntEnum):
    INFO = 0
    WARNING = 1
    STRONG_WARNING = 2
    ERROR = 3

    @property
    def label(self) -> str:
        return self.name


@dataclass(frozen=True, slots=True)
class Rule:
    rule_id: str
    name: str
    default_action: str


RULES: dict[str, Rule] = {
    "CQ001": Rule("CQ001", "FILE_CODE_LINES", "Split the file into smaller modules with clear responsibilities."),
    "CQ002": Rule(
        "CQ002",
        "FILE_PHYSICAL_LINES",
        "Reduce non-code bulk or split the file so it remains practical to review.",
    ),
    "CQ101": Rule(
        "CQ101",
        "FUNCTION_LINES",
        "Extract cohesive operations and keep the function focused on one responsibility.",
    ),
    "CQ102": Rule(
        "CQ102",
        "FUNCTION_COMPLEXITY",
        "Simplify control flow and extract independently testable decisions.",
    ),
    "CQ103": Rule(
        "CQ103",
        "FUNCTION_NESTING",
        "Use guard clauses or extracted operations to flatten nested control flow.",
    ),
    "CQ104": Rule(
        "CQ104",
        "FUNCTION_PARAMETERS",
        "Introduce a request, configuration, DTO, or domain object for related values.",
    ),
    "CQ201": Rule(
        "CQ201",
        "CLASS_LINES",
        "Split the class along cohesive responsibilities and explicit interfaces.",
    ),
    "AR001": Rule(
        "AR001",
        "INVALID_LAYER_DEPENDENCY",
        "Depend in the documented layer direction or introduce an appropriate boundary.",
    ),
    "AR002": Rule(
        "AR002",
        "DOMAIN_FRAMEWORK_DEPENDENCY",
        "Move framework integration outside the domain and depend on a domain-owned contract.",
    ),
    "AR003": Rule(
        "AR003",
        "CROSS_FEATURE_INTERNAL_IMPORT",
        "Import the other feature through its public index or move shared code to a shared module.",
    ),
    "AR004": Rule(
        "AR004",
        "ROUTER_BUSINESS_LOGIC",
        "Move database work or orchestration into an application service and keep the handler thin.",
    ),
    "EX001": Rule(
        "EX001",
        "INVALID_EXCEPTION",
        "Correct or remove the invalid exception entry in config/code-quality.toml.",
    ),
    "EX002": Rule(
        "EX002",
        "EXPIRED_EXCEPTION",
        "Resolve the violation or renew the exception with a reviewed architectural reason.",
    ),
}

EXCEPTION_RULE_IDS = frozenset(rule_id for rule_id in RULES if rule_id.startswith(("CQ", "AR")))


@dataclass(frozen=True, slots=True)
class Finding:
    rule: Rule
    severity: Severity
    path: str
    message: str
    actual: int | str | None = None
    threshold: int | str | None = None
    symbol: str | None = None
    action: str | None = None
    line: int | None = None
    suppressed_reason: str | None = None

    @property
    def suppressed(self) -> bool:
        return self.suppressed_reason is not None

    def suppress(self, reason: str) -> Finding:
        return replace(self, suppressed_reason=reason)

    def to_dict(self) -> dict[str, Any]:
        return {
            "rule_id": self.rule.rule_id,
            "rule": self.rule.name,
            "severity": self.severity.label,
            "path": self.path,
            "line": self.line,
            "symbol": self.symbol,
            "actual": self.actual,
            "threshold": self.threshold,
            "message": self.message,
            "required_action": self.action or self.rule.default_action,
            "suppressed": self.suppressed,
            "suppressed_reason": self.suppressed_reason,
        }


@dataclass(frozen=True, slots=True)
class ExceptionEntry:
    rule_id: str
    path: str
    reason: str
    expires: str
    symbol: str | None = None


@dataclass(frozen=True, slots=True)
class SourceConfig:
    extensions: tuple[str, ...]
    exclude_directories: frozenset[str]
    exclude_files: frozenset[str]
    exclude_paths: tuple[str, ...]


@dataclass(frozen=True, slots=True)
class FileLimits:
    warning: int
    strong_warning: int
    maximum: int
    physical_warning: int


@dataclass(frozen=True, slots=True)
class ScopeLimits:
    warning: int
    strong_warning: int
    maximum: int
    warning_inclusive: bool = False
    strong_warning_inclusive: bool = False

    def classify(self, actual: int) -> Severity | None:
        if actual > self.maximum:
            return Severity.ERROR
        strong = actual >= self.strong_warning if self.strong_warning_inclusive else actual > self.strong_warning
        if strong:
            return Severity.STRONG_WARNING
        warning = actual >= self.warning if self.warning_inclusive else actual > self.warning
        if warning:
            return Severity.WARNING
        return None


@dataclass(frozen=True, slots=True)
class BackendArchitectureConfig:
    root: Path
    package: str
    api_layers: frozenset[str]
    application_layers: frozenset[str]
    domain_layers: frozenset[str]
    infrastructure_layers: frozenset[str]
    support_directories: frozenset[str]
    composition_files: frozenset[str]
    forbidden_dependencies: frozenset[tuple[str, str]]
    domain_forbidden_imports: tuple[str, ...]
    router_business_imports: tuple[str, ...]
    router_handler_max_lines: int


@dataclass(frozen=True, slots=True)
class FrontendArchitectureConfig:
    root: Path
    api_directories: frozenset[str]
    feature_directories: frozenset[str]
    shared_directories: frozenset[str]
    ui_directories: frozenset[str]
    public_module_names: frozenset[str]


@dataclass(frozen=True, slots=True)
class QualityConfig:
    source: SourceConfig
    file: FileLimits
    function: ScopeLimits
    class_: ScopeLimits
    complexity: ScopeLimits
    nesting: ScopeLimits
    parameters: ScopeLimits
    backend_architecture: BackendArchitectureConfig
    frontend_architecture: FrontendArchitectureConfig
    exceptions: tuple[ExceptionEntry, ...]


@dataclass(slots=True)
class CheckResult:
    name: str
    findings: list[Finding] = field(default_factory=list)
    passed: bool = True
    detail: str = ""
    output: str = ""
    files_checked: int = 0

    @property
    def errors(self) -> int:
        return sum(finding.severity is Severity.ERROR and not finding.suppressed for finding in self.findings)

    @property
    def status(self) -> str:
        return "PASS" if self.passed and self.errors == 0 else "FAIL"

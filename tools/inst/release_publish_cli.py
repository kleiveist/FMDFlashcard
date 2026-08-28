from __future__ import annotations

import argparse
import os
from pathlib import Path

from tools.inst import release_publish, release_publish_bundle


def _add_identity_arguments(command: argparse.ArgumentParser) -> None:
    command.add_argument("--repository", required=True)
    command.add_argument("--tag", required=True)
    command.add_argument("--sha", required=True)
    command.add_argument("--release-run-id", required=True, type=int)
    command.add_argument("--release-run-attempt", required=True, type=int)


def _add_bundle_arguments(command: argparse.ArgumentParser) -> None:
    command.add_argument("--output-dir", required=True, type=Path)
    command.add_argument("--notes-file", required=True, type=Path)


def _add_api_argument(command: argparse.ArgumentParser) -> None:
    command.add_argument("--api-url", default="https://api.github.com")


def _parser() -> argparse.ArgumentParser:
    parser = argparse.ArgumentParser(description="Govern exact-SHA GitHub Release publication.")
    commands = parser.add_subparsers(dest="command", required=True)

    prepare = commands.add_parser("prepare", help="Verify evidence and prepare the release bundle")
    _add_identity_arguments(prepare)
    prepare.add_argument("--input-dir", required=True, type=Path)
    prepare.add_argument("--output-dir", required=True, type=Path)
    prepare.add_argument("--root", required=True, type=Path)
    _add_api_argument(prepare)

    for name, help_text in (
        ("verify-bundle", "Verify the prepared same-run artifact"),
        ("verify-remote-tag", "Recheck the remote annotated tag"),
        ("publication-state", "Inspect an absent or exact immutable release"),
        (
            "verify-governance",
            "Verify immutable-release and release-tag repository rules",
        ),
    ):
        command = commands.add_parser(name, help=help_text)
        _add_identity_arguments(command)
        _add_bundle_arguments(command)
        if name != "verify-bundle":
            _add_api_argument(command)

    verify_release = commands.add_parser("verify-release", help="Verify draft or immutable release state")
    _add_identity_arguments(verify_release)
    _add_bundle_arguments(verify_release)
    verify_release.add_argument("--state", required=True, choices=("draft", "published"))
    _add_api_argument(verify_release)
    return parser


def _request(args: argparse.Namespace) -> release_publish.ReleaseRequest:
    return release_publish.ReleaseRequest(
        args.repository,
        args.tag,
        args.sha,
        args.release_run_id,
        args.release_run_attempt,
    )


def _bundle(args: argparse.Namespace) -> release_publish.PreparedBundle:
    return release_publish.PreparedBundle(args.output_dir.resolve(), args.notes_file.resolve())


def _prepared_identity(args: argparse.Namespace) -> release_publish.ReleaseIdentity:
    return release_publish_bundle.verify_prepared_bundle(_bundle(args), _request(args))


def _required_token(variable: str, purpose: str) -> str:
    token = os.environ.get(variable, "")
    if not token:
        raise release_publish.ReleasePublishError(f"{variable} is required {purpose}")
    return token


def _github_token() -> str:
    return _required_token("GITHUB_TOKEN", "for GitHub release governance")


def _governance_token() -> str:
    return _required_token(
        "GOVERNANCE_TOKEN",
        "to inspect immutable-release settings and tag-ruleset bypass actors",
    )


def _prepare(args: argparse.Namespace) -> release_publish.ReleaseIdentity:
    token = _github_token()
    root = args.root.resolve()
    identity = release_publish.validate_release_identity(root, _request(args))
    release_publish.verify_remote_tag_identity(identity, token=token, api_url=args.api_url)
    workflows = release_publish.collect_workflow_evidence(identity, token=token, api_url=args.api_url)
    release_publish_bundle.build_release_bundle(
        root,
        args.input_dir.resolve(),
        args.output_dir.resolve(),
        identity,
        workflows,
    )
    return identity


def _verify_governance(args: argparse.Namespace, identity: release_publish.ReleaseIdentity) -> None:
    token = _governance_token()
    release_publish.ensure_immutable_releases_enabled(identity.repository, token=token, api_url=args.api_url)
    release_publish.ensure_release_tag_ruleset(identity, token=token, api_url=args.api_url)


def _handle_remote_command(args: argparse.Namespace, identity: release_publish.ReleaseIdentity) -> str:
    token = _github_token()
    if args.command == "verify-remote-tag":
        release_publish.verify_remote_tag_identity(identity, token=token, api_url=args.api_url)
        return f"Verified remote annotated tag {identity.tag} at {identity.sha}"
    if args.command == "publication-state":
        return release_publish_bundle.publication_state(
            identity,
            _bundle(args),
            token=token,
            api_url=args.api_url,
        )
    if args.command == "verify-release":
        release_publish_bundle.verify_github_release(
            identity,
            _bundle(args),
            token=token,
            state=args.state,
            api_url=args.api_url,
        )
        return f"Verified {args.state} GitHub Release {identity.tag} at {identity.sha}"
    raise release_publish.ReleasePublishError(f"unsupported remote publisher command: {args.command}")


def main(argv: list[str] | None = None) -> int:
    args = _parser().parse_args(argv)
    if args.command == "prepare":
        identity = _prepare(args)
        print(f"Prepared exact-SHA release bundle for {identity.tag} at {identity.sha}")
        return 0
    identity = _prepared_identity(args)
    if args.command == "verify-bundle":
        print(f"Verified prepared release bundle for {identity.tag} at {identity.sha}")
        return 0
    if args.command == "verify-governance":
        _verify_governance(args, identity)
        print(f"Verified immutable publication governance for {identity.repository}")
        return 0
    print(_handle_remote_command(args, identity))
    return 0


if __name__ == "__main__":
    raise SystemExit(main())

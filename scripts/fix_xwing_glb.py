#!/usr/bin/env python3
"""GLB fixer and tuner for Star Cleaver ship assets.

Features:
- Safe GLB parsing/writing (JSON + BIN chunks, 4-byte alignment)
- Root-node scale correction to canonical target length
- Material PBR upgrades for hull-like materials
- Engine emissive remap to hot plasma profile
- Dry-run mode with a detailed change summary
- Optional in-place editing with backup file creation

Example:
  python scripts/fix_xwing_glb.py public/models/xwing.glb \
    --output public/models/xwing_fixed.glb

  python scripts/fix_xwing_glb.py public/models/xwing.glb \
    --in-place --backup
"""

from __future__ import annotations

import argparse
import json
import shutil
import struct
from dataclasses import dataclass, field
from pathlib import Path
from typing import Any, Dict, List, Optional, Sequence, Tuple

GLB_MAGIC = b"glTF"
JSON_CHUNK = b"JSON"
BIN_CHUNK = b"BIN\x00"


@dataclass
class FixConfig:
    target_length_m: float = 13.4
    source_length_m: float = 5.02
    explicit_scale: Optional[float] = None
    root_name_keywords: Tuple[str, ...] = ("xwing", "x-wing", "sketchfab", "root")

    hull_keywords: Tuple[str, ...] = (
        "hull",
        "body",
        "wing",
        "fuselage",
        "panel",
        "chassis",
        "frame",
        "armor",
    )
    engine_keywords: Tuple[str, ...] = (
        "engine",
        "thruster",
        "exhaust",
        "nozzle",
        "blinn5",
    )

    metallic_factor: float = 0.65
    roughness_factor: float = 0.45
    emissive_factor: Tuple[float, float, float] = (1.0, 0.18, 0.04)
    force_pbr_all: bool = False

    dry_run: bool = False
    verbose: bool = True


@dataclass
class FixReport:
    scale_factor: float
    root_nodes_scaled: List[str] = field(default_factory=list)
    materials_pbr_upgraded: List[str] = field(default_factory=list)
    materials_emissive_updated: List[str] = field(default_factory=list)
    warnings: List[str] = field(default_factory=list)

    def to_json(self) -> str:
        return json.dumps(
            {
                "scale_factor": self.scale_factor,
                "root_nodes_scaled": self.root_nodes_scaled,
                "materials_pbr_upgraded": self.materials_pbr_upgraded,
                "materials_emissive_updated": self.materials_emissive_updated,
                "warnings": self.warnings,
            },
            indent=2,
        )


class GLBFormatError(ValueError):
    pass


def _align4(data: bytes, pad_byte: bytes = b"\x20") -> bytes:
    pad = (-len(data)) % 4
    return data if pad == 0 else data + pad_byte * pad


def _read_exact(fh, n: int) -> bytes:
    data = fh.read(n)
    if len(data) != n:
        raise GLBFormatError("Unexpected end of file while reading GLB")
    return data


def read_glb(path: Path) -> Tuple[int, Dict[str, Any], bytes, List[Tuple[bytes, bytes]]]:
    with path.open("rb") as fh:
        magic = _read_exact(fh, 4)
        if magic != GLB_MAGIC:
            raise GLBFormatError("Not a valid GLB file (missing glTF magic)")

        version = struct.unpack("<I", _read_exact(fh, 4))[0]
        total_len = struct.unpack("<I", _read_exact(fh, 4))[0]

        if version != 2:
            raise GLBFormatError(f"Unsupported GLB version: {version}. Expected 2.")

        # Read all chunks until EOF or declared length reached.
        json_dict: Optional[Dict[str, Any]] = None
        bin_chunk = b""
        other_chunks: List[Tuple[bytes, bytes]] = []

        consumed = 12
        while consumed < total_len:
            chunk_len = struct.unpack("<I", _read_exact(fh, 4))[0]
            chunk_type = _read_exact(fh, 4)
            chunk_data = _read_exact(fh, chunk_len)
            consumed += 8 + chunk_len

            if chunk_type == JSON_CHUNK:
                if json_dict is not None:
                    raise GLBFormatError("GLB contains more than one JSON chunk")
                try:
                    json_dict = json.loads(chunk_data.decode("utf-8"))
                except json.JSONDecodeError as exc:
                    raise GLBFormatError(f"Invalid JSON chunk: {exc}") from exc
            elif chunk_type == BIN_CHUNK:
                # Keep only first BIN chunk as primary binary payload.
                if not bin_chunk:
                    bin_chunk = chunk_data
                else:
                    other_chunks.append((chunk_type, chunk_data))
            else:
                other_chunks.append((chunk_type, chunk_data))

        if json_dict is None:
            raise GLBFormatError("GLB is missing required JSON chunk")

        return version, json_dict, bin_chunk, other_chunks


def write_glb(path: Path, version: int, gltf: Dict[str, Any], bin_chunk: bytes, other_chunks: List[Tuple[bytes, bytes]]) -> None:
    json_bytes = json.dumps(gltf, separators=(",", ":")).encode("utf-8")
    json_bytes = _align4(json_bytes, pad_byte=b" ")

    chunks: List[Tuple[bytes, bytes]] = [(JSON_CHUNK, json_bytes)]
    if bin_chunk:
        chunks.append((BIN_CHUNK, _align4(bin_chunk, pad_byte=b"\x00")))
    for ctype, cdata in other_chunks:
        chunks.append((ctype, _align4(cdata, pad_byte=b"\x00")))

    total_len = 12 + sum(8 + len(data) for _, data in chunks)

    with path.open("wb") as fh:
        fh.write(GLB_MAGIC)
        fh.write(struct.pack("<I", version))
        fh.write(struct.pack("<I", total_len))

        for ctype, cdata in chunks:
            fh.write(struct.pack("<I", len(cdata)))
            fh.write(ctype)
            fh.write(cdata)


def _contains_any(name: str, needles: Sequence[str]) -> bool:
    s = (name or "").lower()
    return any(n in s for n in needles)


def _find_scene_roots(gltf: Dict[str, Any]) -> List[int]:
    scenes = gltf.get("scenes", [])
    if not scenes:
        return []
    scene_idx = gltf.get("scene", 0)
    try:
        scene = scenes[scene_idx]
    except Exception:
        scene = scenes[0]
    roots = scene.get("nodes", [])
    return [n for n in roots if isinstance(n, int)]


def _effective_scale(config: FixConfig) -> float:
    if config.explicit_scale is not None:
        return config.explicit_scale
    if config.source_length_m <= 0:
        raise ValueError("source_length_m must be > 0")
    return config.target_length_m / config.source_length_m


def apply_fixes(gltf: Dict[str, Any], config: FixConfig) -> FixReport:
    scale_factor = _effective_scale(config)
    report = FixReport(scale_factor=scale_factor)

    nodes = gltf.get("nodes", [])
    root_candidates = _find_scene_roots(gltf)

    if not nodes:
        report.warnings.append("No nodes found in glTF; skipping scale correction")
    else:
        # Prefer scene roots; fallback to first named root-like node.
        candidates = root_candidates or list(range(min(4, len(nodes))))
        scaled_any = False

        for idx in candidates:
            if idx < 0 or idx >= len(nodes):
                continue
            node = nodes[idx]
            name = str(node.get("name", f"node_{idx}"))

            should_scale = False
            if root_candidates:
                should_scale = True
            elif _contains_any(name, config.root_name_keywords):
                should_scale = True

            if not should_scale:
                continue

            existing = node.get("scale", [1.0, 1.0, 1.0])
            if len(existing) != 3:
                existing = [1.0, 1.0, 1.0]

            node["scale"] = [round(float(s) * scale_factor, 6) for s in existing]
            report.root_nodes_scaled.append(name)
            scaled_any = True

        if not scaled_any:
            # Last resort: apply to first node.
            node = nodes[0]
            name = str(node.get("name", "node_0"))
            existing = node.get("scale", [1.0, 1.0, 1.0])
            if len(existing) != 3:
                existing = [1.0, 1.0, 1.0]
            node["scale"] = [round(float(s) * scale_factor, 6) for s in existing]
            report.root_nodes_scaled.append(name)
            report.warnings.append("No explicit root matched; scaled first node as fallback")

    materials = gltf.get("materials", [])
    if not materials:
        report.warnings.append("No materials found in glTF; skipping material tuning")
        return report

    for i, mat in enumerate(materials):
        name = str(mat.get("name", f"material_{i}"))
        lower_name = name.lower()

        # Ensure PBR block exists.
        pbr = mat.setdefault("pbrMetallicRoughness", {})

        # Hull-like materials: raise metallic and tune roughness.
        if config.force_pbr_all or _contains_any(lower_name, config.hull_keywords) or not mat.get("name"):
            changed = False
            prev_metal = float(pbr.get("metallicFactor", 0.0))
            prev_rough = float(pbr.get("roughnessFactor", 1.0))

            if prev_metal < config.metallic_factor:
                pbr["metallicFactor"] = config.metallic_factor
                changed = True
            if prev_rough > config.roughness_factor:
                pbr["roughnessFactor"] = config.roughness_factor
                changed = True

            if changed:
                report.materials_pbr_upgraded.append(name)

        # Engine-like materials: emissive plasma remap.
        is_engine = _contains_any(lower_name, config.engine_keywords)
        if is_engine:
            mat["emissiveFactor"] = [
                float(config.emissive_factor[0]),
                float(config.emissive_factor[1]),
                float(config.emissive_factor[2]),
            ]
            report.materials_emissive_updated.append(name)

    if not report.materials_emissive_updated and materials:
        # Fallback: apply emissive to last material if engine could not be identified.
        fallback = materials[-1]
        fallback_name = str(fallback.get("name", f"material_{len(materials)-1}"))
        fallback["emissiveFactor"] = [
            float(config.emissive_factor[0]),
            float(config.emissive_factor[1]),
            float(config.emissive_factor[2]),
        ]
        report.materials_emissive_updated.append(fallback_name)
        report.warnings.append("No engine material match; emissive applied to last material")

    return report


def _print_report(report: FixReport) -> None:
    print("\nFix summary")
    print("-----------")
    print(f"Scale factor: {report.scale_factor:.6f}")
    print(f"Root nodes scaled: {len(report.root_nodes_scaled)}")
    for n in report.root_nodes_scaled:
        print(f"  - {n}")

    print(f"PBR upgraded materials: {len(report.materials_pbr_upgraded)}")
    for n in report.materials_pbr_upgraded:
        print(f"  - {n}")

    print(f"Engine emissive updated: {len(report.materials_emissive_updated)}")
    for n in report.materials_emissive_updated:
        print(f"  - {n}")

    if report.warnings:
        print("Warnings:")
        for w in report.warnings:
            print(f"  - {w}")


def _matches_any(path: Path, patterns: Sequence[str]) -> bool:
    return any(path.match(pat) for pat in patterns)


def _discover_input_files(
    input_path: Path,
    batch_mode: bool,
    recursive: bool,
    include: Sequence[str],
    exclude: Sequence[str],
) -> List[Path]:
    if input_path.is_file():
        files = [input_path]
    elif input_path.is_dir() or batch_mode:
        if not input_path.is_dir():
            raise ValueError("Batch mode expects an input directory or a single .glb file")
        candidates: List[Path] = []
        walker = input_path.rglob if recursive else input_path.glob
        for pattern in include:
            candidates.extend([p for p in walker(pattern) if p.is_file()])
        # Stable de-duplication.
        files = sorted(set(candidates))
    else:
        files = [input_path]

    files = [p for p in files if p.suffix.lower() == ".glb"]
    if exclude:
        files = [p for p in files if not _matches_any(p, exclude)]
    return files


def _build_output_path(
    in_path: Path,
    args: argparse.Namespace,
    root_dir: Optional[Path],
) -> Path:
    if args.in_place:
        return in_path

    # Single-file explicit output has highest priority.
    if args.output and (not args.batch) and in_path == args.input:
        return args.output

    out_dir: Optional[Path] = args.output_dir
    if out_dir:
        if root_dir and root_dir.is_dir():
            rel = in_path.relative_to(root_dir)
            return out_dir / rel.with_name(f"{rel.stem}_fixed{rel.suffix}")
        return out_dir / f"{in_path.stem}_fixed{in_path.suffix}"

    return in_path.with_name(f"{in_path.stem}_fixed{in_path.suffix}")


def _process_one_file(
    in_path: Path,
    out_path: Path,
    config: FixConfig,
    create_backup: bool,
) -> FixReport:
    version, gltf, bin_chunk, other_chunks = read_glb(in_path)
    report = apply_fixes(gltf, config)

    if config.dry_run:
        return report

    out_path.parent.mkdir(parents=True, exist_ok=True)

    if create_backup and in_path == out_path:
        backup_path = in_path.with_suffix(in_path.suffix + ".bak")
        shutil.copy2(in_path, backup_path)
        print(f"Backup created: {backup_path}")

    write_glb(out_path, version, gltf, bin_chunk, other_chunks)
    return report


def parse_args() -> argparse.Namespace:
    p = argparse.ArgumentParser(description="Fix and tune X-wing GLB files for Star Cleaver")
    p.add_argument("input", type=Path, help="Input GLB file path or directory")
    p.add_argument("--output", type=Path, help="Output GLB file path")
    p.add_argument("--output-dir", type=Path, help="Output directory for batch runs")
    p.add_argument("--in-place", action="store_true", help="Write changes back to the input file")
    p.add_argument("--backup", action="store_true", help="Create .bak backup when using --in-place")
    p.add_argument("--dry-run", action="store_true", help="Print changes without writing output")
    p.add_argument("--batch", action="store_true", help="Process multiple GLB files from a directory")
    p.add_argument("--recursive", action="store_true", help="Recursively scan input directory in batch mode")
    p.add_argument("--include", nargs="*", default=["*.glb"], help="Glob patterns to include in batch mode")
    p.add_argument(
        "--exclude",
        nargs="*",
        default=["*_fixed.glb", "*.glb.bak", "*.bak.glb"],
        help="Glob patterns to exclude in batch mode",
    )
    p.add_argument("--fail-fast", action="store_true", help="Stop batch processing on first file error")

    p.add_argument("--target-length", type=float, default=13.4, help="Target ship length in meters")
    p.add_argument("--source-length", type=float, default=5.02, help="Current model length in meters")
    p.add_argument("--scale", type=float, default=None, help="Explicit scale factor override")

    p.add_argument("--metallic", type=float, default=0.65, help="Hull metallic factor")
    p.add_argument("--roughness", type=float, default=0.45, help="Hull roughness factor")
    p.add_argument("--force-pbr-all", action="store_true", help="Apply PBR tuning to all materials")
    p.add_argument(
        "--emissive",
        type=float,
        nargs=3,
        metavar=("R", "G", "B"),
        default=(1.0, 0.18, 0.04),
        help="Engine emissive factor triplet",
    )

    p.add_argument("--json-report", action="store_true", help="Output report as JSON")
    return p.parse_args()


def main() -> int:
    args = parse_args()

    input_path: Path = args.input
    if not input_path.exists():
        print(f"Input file not found: {input_path}")
        return 2

    if args.in_place and args.output:
        print("Use either --in-place or --output, not both")
        return 2

    if args.output and args.batch:
        print("Use --output only for single-file runs. For batch mode, use --output-dir.")
        return 2

    config = FixConfig(
        target_length_m=args.target_length,
        source_length_m=args.source_length,
        explicit_scale=args.scale,
        metallic_factor=args.metallic,
        roughness_factor=args.roughness,
        emissive_factor=tuple(float(x) for x in args.emissive),
        force_pbr_all=bool(args.force_pbr_all),
        dry_run=args.dry_run,
    )

    try:
        files = _discover_input_files(
            input_path=input_path,
            batch_mode=args.batch,
            recursive=args.recursive,
            include=args.include,
            exclude=args.exclude,
        )
    except ValueError as exc:
        print(f"Failed: {exc}")
        return 1

    if not files:
        print("No matching .glb files found for processing.")
        return 1

    root_dir = input_path if input_path.is_dir() else input_path.parent

    reports: List[Tuple[Path, FixReport]] = []
    errors: List[Tuple[Path, str]] = []

    for in_file in files:
        out_file = _build_output_path(in_file, args, root_dir)
        print(f"\nProcessing: {in_file}")
        try:
            report = _process_one_file(
                in_path=in_file,
                out_path=out_file,
                config=config,
                create_backup=bool(args.in_place and args.backup),
            )
            reports.append((in_file, report))

            if args.json_report:
                print(
                    json.dumps(
                        {
                            "input": str(in_file),
                            "output": str(out_file),
                            "report": json.loads(report.to_json()),
                        },
                        indent=2,
                    )
                )
            else:
                _print_report(report)
                if config.dry_run:
                    print("Dry run enabled. No file written.")
                else:
                    print(f"Success: wrote fixed GLB to {out_file}")

        except (GLBFormatError, ValueError) as exc:
            msg = str(exc)
            errors.append((in_file, msg))
            print(f"Failed: {in_file} -> {msg}")
            if args.fail_fast:
                break

    print("\nRun summary")
    print("-----------")
    print(f"Total files matched: {len(files)}")
    print(f"Processed successfully: {len(reports)}")
    print(f"Failed: {len(errors)}")

    if errors:
        for fpath, msg in errors:
            print(f"  - {fpath}: {msg}")
        return 1

    return 0


if __name__ == "__main__":
    raise SystemExit(main())

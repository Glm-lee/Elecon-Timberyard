from __future__ import annotations

import argparse
import sys
from pathlib import Path

from PIL import Image


ROOT = Path(__file__).resolve().parents[1]
DEFAULT_DARK = ROOT / "branding" / "final" / "elecon-logo-dark.png"
DEFAULT_LIGHT = ROOT / "branding" / "final" / "elecon-logo-light.png"

TARGET_DARK = [
    ROOT / "frontend" / "public" / "elecon-logo-dark.png",
    ROOT / "backend" / "app" / "assets" / "elecon-logo-dark.png",
]
TARGET_LIGHT = [
    ROOT / "frontend" / "public" / "elecon-logo-light.png",
    ROOT / "backend" / "app" / "assets" / "elecon-logo-light.png",
]


def normalize_and_write(src: Path, targets: list[Path]) -> tuple[int, int]:
    img = Image.open(src).convert("RGBA")
    size = img.size
    for target in targets:
        target.parent.mkdir(parents=True, exist_ok=True)
        img.save(target, format="PNG")
    return size


def main() -> int:
    parser = argparse.ArgumentParser(
        description="Swap Elecon logo assets across frontend and backend while keeping filenames unchanged."
    )
    parser.add_argument(
        "--dark",
        type=Path,
        default=DEFAULT_DARK,
        help=f"Path to dark logo source PNG. Default: {DEFAULT_DARK}",
    )
    parser.add_argument(
        "--light",
        type=Path,
        default=DEFAULT_LIGHT,
        help=f"Path to light logo source PNG. Default: {DEFAULT_LIGHT}",
    )
    args = parser.parse_args()

    dark_src = args.dark
    light_src = args.light

    missing = [str(p) for p in [dark_src, light_src] if not p.exists()]
    if missing:
        print("Missing source file(s):")
        for item in missing:
            print(f"  - {item}")
        print("")
        print("Place your final files at:")
        print(f"  - {DEFAULT_DARK}")
        print(f"  - {DEFAULT_LIGHT}")
        print("Or pass explicit paths with --dark and --light.")
        return 1

    dark_size = normalize_and_write(dark_src, TARGET_DARK)
    light_size = normalize_and_write(light_src, TARGET_LIGHT)

    print("Logo swap completed.")
    print(f"Dark source:  {dark_src} ({dark_size[0]}x{dark_size[1]})")
    print(f"Light source: {light_src} ({light_size[0]}x{light_size[1]})")
    print("Updated targets:")
    for p in TARGET_DARK + TARGET_LIGHT:
        print(f"  - {p}")
    return 0


if __name__ == "__main__":
    raise SystemExit(main())


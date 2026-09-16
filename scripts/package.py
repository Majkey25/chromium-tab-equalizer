#!/usr/bin/env python3
from __future__ import annotations

import hashlib
import json
import shutil
import zipfile
from pathlib import Path

ROOT = Path(__file__).resolve().parents[1]
EXTENSION = ROOT / "extension"
DIST = ROOT / "dist"
FIXED_TIME = (2026, 1, 1, 0, 0, 0)

manifest = json.loads((EXTENSION / "manifest.json").read_text(encoding="utf-8"))
version = manifest["version"]
archive_name = f"chromium-tab-equalizer-{version}.zip"
archive_path = DIST / archive_name

runtime_files = sorted(path for path in EXTENSION.rglob("*") if path.is_file())
root_files = [ROOT / "README.md", ROOT / "LICENSE", ROOT / "CHANGELOG.md"]
for path in root_files:
    if not path.exists():
        raise SystemExit(f"Missing release file: {path.name}")

DIST.mkdir(exist_ok=True)
for old in DIST.iterdir():
    if old.is_file():
        old.unlink()
    elif old.is_dir():
        shutil.rmtree(old)

with zipfile.ZipFile(archive_path, "w", compression=zipfile.ZIP_DEFLATED, compresslevel=9) as archive:
    entries: list[tuple[Path, str]] = []
    for path in runtime_files:
        entries.append((path, path.relative_to(EXTENSION).as_posix()))
    for path in root_files:
        entries.append((path, path.name))

    for source, destination in sorted(entries, key=lambda item: item[1]):
        info = zipfile.ZipInfo(destination, FIXED_TIME)
        info.compress_type = zipfile.ZIP_DEFLATED
        info.external_attr = 0o100644 << 16
        archive.writestr(info, source.read_bytes(), compress_type=zipfile.ZIP_DEFLATED, compresslevel=9)

digest = hashlib.sha256(archive_path.read_bytes()).hexdigest()
(DIST / "SHA256SUMS.txt").write_text(f"{digest}  {archive_name}\n", encoding="utf-8", newline="\n")
print(archive_path)
print(f"sha256 {digest}")

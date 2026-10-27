#!/usr/bin/env python3
"""Inventory per-component metadata licenses in the exact AppStream build output."""

from __future__ import annotations

import gzip
import sys
import xml.etree.ElementTree as ET
from pathlib import Path


def local_name(tag: str) -> str:
    return tag.rsplit("}", 1)[-1]


def direct_child_text(element: ET.Element, wanted: str) -> str:
    for child in element:
        if local_name(child.tag) == wanted:
            return (child.text or "").strip()
    return ""


def main() -> int:
    if len(sys.argv) != 3:
        print(
            "usage: generate-appstream-license-report.py APPSTREAM_DATA OUTPUT_TSV",
            file=sys.stderr,
        )
        return 2

    data_root = Path(sys.argv[1]) / "share" / "swcatalog"
    xml_dir = data_root / "xml"
    output_path = Path(sys.argv[2])
    xml_files = sorted(xml_dir.glob("*.xml.gz"))
    if not xml_files:
        print(f"no AppStream XML files found under {xml_dir}", file=sys.stderr)
        return 1

    records = 0
    output_path.parent.mkdir(parents=True, exist_ok=True)
    with output_path.open("w", encoding="utf-8", newline="\n") as output:
        output.write("# Inventory from the pinned nixos-appstream-data output; not a clearance verdict.\n")
        output.write("catalog\tcomponent_id\tmetadata_license\n")

        for xml_path in xml_files:
            with gzip.open(xml_path, "rb") as stream:
                for _event, element in ET.iterparse(stream, events=("end",)):
                    if local_name(element.tag) != "component":
                        continue
                    component_id = direct_child_text(element, "id") or "MISSING_ID"
                    license_id = direct_child_text(element, "metadata_license") or "UNDECLARED"
                    safe_id = component_id.replace("\t", " ").replace("\r", " ").replace("\n", " ")
                    safe_license = license_id.replace("\t", " ").replace("\r", " ").replace("\n", " ")
                    output.write(f"{xml_path.name}\t{safe_id}\t{safe_license}\n")
                    records += 1
                    element.clear()

    if records == 0:
        print(f"no AppStream components found in {xml_dir}", file=sys.stderr)
        output_path.unlink(missing_ok=True)
        return 1

    print(f"wrote {records} component license records to {output_path}")
    return 0


if __name__ == "__main__":
    raise SystemExit(main())

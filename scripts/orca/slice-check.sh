#!/usr/bin/env bash
# Slices an exported 3MF with the OrcaSlicer CLI and reports where each
# filament swap landed. The exported 3MF deliberately carries no settings, so
# a full project_settings.config is borrowed from any OrcaSlicer project
# saved with your printer (e.g. one of your own .3mf projects).
#
#   scripts/orca/slice-check.sh export.3mf reference-project.3mf [layer_h] [first_layer_h]
set -euo pipefail
in="$1"; ref="$2"; lh="${3:-0.2}"; flh="${4:-0.2}"
orca="${ORCA:-/Applications/OrcaSlicer.app/Contents/MacOS/OrcaSlicer}"
dir="$(dirname "$0")"
work="$(mktemp -d)"
python3 -I "$dir/with_settings.py" "$in" "$ref" "$work/test.3mf" "$lh" "$flh"
"$orca" --slice 0 --outputdir "$work" "$work/test.3mf" >/dev/null
python3 -I "$dir/check_swaps.py" "$work/plate_1.gcode" "$work/test.3mf"
grep -m2 -E "^; (filament used \[g\]|estimated printing time)" "$work/plate_1.gcode" || true
echo "G-code: $work/plate_1.gcode"

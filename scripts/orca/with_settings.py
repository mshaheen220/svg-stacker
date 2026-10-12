# Test helper: copy an exported 3MF and add a project_settings.config taken
# from a reference Orca project, with layer heights overridden.
import json, sys, zipfile
src, ref, out, lh, flh = sys.argv[1:6]
with zipfile.ZipFile(ref) as z:
    cfg = json.loads(z.read("Metadata/project_settings.config"))
cfg["layer_height"] = lh
cfg["initial_layer_print_height"] = flh
with zipfile.ZipFile(src) as zin, zipfile.ZipFile(out, "w", zipfile.ZIP_DEFLATED) as zout:
    for item in zin.infolist():
        zout.writestr(item, zin.read(item.filename))
    zout.writestr("Metadata/project_settings.config", json.dumps(cfg, indent=4))

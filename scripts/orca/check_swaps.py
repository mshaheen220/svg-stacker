# Test helper: report where each M600/M25/M117 lands in Orca G-code, by layer,
# next to the top_z values the 3MF asked for.
import re, sys, zipfile
gcode, threemf = sys.argv[1:3]
with zipfile.ZipFile(threemf) as z:
    wanted = re.findall(r'top_z="([\d.]+)"', z.read("Metadata/custom_gcode_per_layer.xml").decode())
    names = re.findall(r'key="name" value="([^"]+)"', z.read("Metadata/model_settings.config").decode())
layer, z, events, maxz = 0, None, [], 0.0
pending_layer_change = False
with open(gcode) as f:
    for line in f:
        if line.startswith(";LAYER_CHANGE"):
            layer += 1; pending_layer_change = True
        elif pending_layer_change and line.startswith(";Z:"):
            z = float(line[3:]); maxz = max(maxz, z); pending_layer_change = False
        elif re.match(r"^(M600|M25|M117)\b", line):
            events.append((layer, z, line.strip()))
print("object/parts:", names)
print("layers:", layer, "max Z:", maxz)
print("3MF top_z:", wanted)
for e in events: print("  layer %3d  Z=%s  %s" % e)

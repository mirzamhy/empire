# Map 5 "Teluk Naga": traces the biome grid from the third reference picture.
# Run: python tools/trace-map5.py [--preview out.png]   -> writes game/src/sim/mapdata5.ts
#
# Same method as map 4 (its helpers are reused), with the picture cropped to the island. The picture
# is an oblique view, so squeezing it into the 4:3 grid also brings its proportions back. Thin land
# that joins the parts of the island is protected, because only the connected land can hold castles.
# Needs Pillow. Everything is deterministic.
import importlib.util
import os
import sys
from collections import Counter, deque
from PIL import Image

HERE = os.path.dirname(os.path.abspath(__file__))
spec = importlib.util.spec_from_file_location("trace_map4", os.path.join(HERE, "trace-map4.py"))
t4 = importlib.util.module_from_spec(spec)
spec.loader.exec_module(t4)
W, H, SAMPLES, CLOUD = t4.W, t4.H, t4.SAMPLES, t4.CLOUD
nbs, components, majority, fill, distance, vnoise = t4.nbs, t4.components, t4.majority, t4.fill, t4.distance, t4.vnoise

REF = os.path.join(HERE, "..", "notes", "attachments", "peta5-referensi.jpg")
OUT = os.path.join(HERE, "..", "game", "src", "sim", "mapdata5.ts")
CROP = (60, 10, 1930, 1095)
MIN_LAKE = 70
#: the parts of the island that must stay joined to the main land
MIN_PART = 500
#: how much of a massif opens into valleys (noise level, higher = more valleys)
VALLEY = 0.3
#: centre (-1..1) and radii (cells) of the marsh pools
MARSHES = ((0.6, 0.57, 15, 9), (0.73, 0.4, 8, 6))


def in_snow(nx, ny):
    return 0.33 < nx < 0.8 and ny < 0.3


def in_desert(nx, ny):
    return nx > 0.68 and 0.17 < ny < 0.62


def classify(r, g, b, nx, ny):
    hi, lo = max(r, g, b), min(r, g, b)
    sat = (hi - lo) / (hi + 1)
    lum = (r + g + b) / 3
    # sea and lakes are clearly teal; the blue shadows between the peaks have little green in them
    if b > r + 45 and g > r + 28:
        return "~"
    if lo > 150 and sat < 0.2:
        return "n" if in_snow(nx, ny) else CLOUD
    if b > g + 6 and b > r:
        return "n" if in_snow(nx, ny) and lum > 100 else "m"
    if r > g * 1.33 and r > b * 1.5 and r > 95:
        return "r"
    if r > 150 and g > 118 and r > g * 1.08 and b < g * 0.92:
        return "d" if in_desert(nx, ny) else "b"
    if sat < 0.2 and lum > 52:
        return "m"
    if r > g * 1.04 and lum > 48:
        return "m"
    if g >= r and lum < 72:
        return "f"
    if g >= r:
        return "s"
    return "f" if lum < 60 else "m"


def join_parts(grid):
    """Every big piece of land gets a strip of ground to the main land, along the shortest crossing."""
    while True:
        parts = sorted(components(grid, lambda c: c != "~"), key=len, reverse=True)
        loose = [p for p in parts[1:] if len(p) >= MIN_PART]
        if not loose:
            return
        main = set(parts[0])
        part = loose[0]
        prev = {i: -1 for i in part}
        q = deque(part)
        end = -1
        while q and end < 0:
            c = q.popleft()
            for n in nbs(c):
                if n in prev:
                    continue
                prev[n] = c
                if n in main:
                    end = n
                    break
                q.append(n)
        print("bridge for", len(part))
        c = end
        while c != -1:
            for k in [c, *nbs(c)]:
                if grid[k] == "~":
                    grid[k] = "s"
            c = prev[c]


def main():
    img = Image.open(REF).convert("RGB").crop(CROP).resize((W * SAMPLES, H * SAMPLES), Image.BOX)
    px = img.load()
    grid = []
    for y in range(H):
        for x in range(W):
            votes = Counter()
            for sy in range(SAMPLES):
                for sx in range(SAMPLES):
                    a, b = x * SAMPLES + sx, y * SAMPLES + sy
                    votes[classify(*px[a, b], a / (W * SAMPLES), b / (H * SAMPLES))] += 1
            grid.append(votes.most_common(1)[0][0])
    fill(grid, CLOUD)

    # thin water closes up (rivers are drawn by sim/rivers.ts), specks of sea disappear
    dland = distance(grid, lambda c: c != "~")
    core = ["~" if d > 1 else "." for d in dland]
    dcore = distance(core, lambda c: c == "~")
    for i in range(W * H):
        if grid[i] == "~" and dcore[i] > 2:
            grid[i] = "?"
    fill(grid, "?")
    for cells in list(components(grid, lambda c: c == "~")):
        edge = any(i % W in (0, W - 1) or i // W in (0, H - 1) for i in cells)
        if not edge:
            cx, cy = sum(i % W for i in cells) / len(cells), sum(i // W for i in cells) / len(cells)
            print("lake", len(cells), round(cx / W * 2 - 1, 2), round(cy / H * 2 - 1, 2))
            if len(cells) < MIN_LAKE:
                for i in cells:
                    grid[i] = "?"
    fill(grid, "?")

    # the realms: rock in the east is red rock or sand, the far north is snow between bare ridges
    for i in range(W * H):
        nx, ny = (i % W) / W, (i // W) / H
        wob = vnoise(nx * 22, ny * 22) * 0.05 + vnoise(nx * 60 + 9, ny * 60) * 0.02
        if in_desert(nx + wob - 0.03, ny - wob) and grid[i] in "mf":
            grid[i] = "r" if vnoise(nx * 24 + 40, ny * 24) > 0.42 else "d"
        if in_desert(nx, ny - wob) and grid[i] == "b":
            grid[i] = "d"

    grid = majority(grid, keep=("~",), passes=2)
    for letter, least in (("m", 20), ("r", 16), ("f", 12), ("s", 12), ("d", 18), ("n", 24), ("b", 400)):
        for cells in list(components(grid, lambda c: c == letter)):
            if len(cells) < least:
                for i in cells:
                    grid[i] = "?"
        fill(grid, "?")
    for i in range(W * H):
        if grid[i] == "b":
            grid[i] = "s"

    join_parts(grid)
    for cells in list(components(grid, lambda c: c != "~")):
        if len(cells) < 20:
            for i in cells:
                grid[i] = "~"

    # the picture's massifs are cut by valleys: open some, so ranges stay ridges and not plateaus
    drock = distance(grid, lambda c: c != "m")
    for i in range(W * H):
        x, y = i % W, i // W
        if grid[i] == "m" and drock[i] > 2 and vnoise(x / 13 + 7, y / 13 + 3) + vnoise(x / 5, y / 5 + 11) * 0.18 < VALLEY:
            grid[i] = "f" if vnoise(x / 9 + 21, y / 9) > 0.5 else "s"

    # what is left of a range must have some body: thin rock lines around the valleys go
    drock = distance(grid, lambda c: c != "m")
    near = distance(["m" if d >= 3 else "." for d in drock], lambda c: c == "m")
    for i in range(W * H):
        if grid[i] == "m" and near[i] > 3:
            grid[i] = "?"
    fill(grid, "?")

    # ranges gain width, because only a wide range can grow tall; never over the last land of a spit
    dw = distance(grid, lambda c: c == "~")
    for _ in range(2):
        out = grid[:]
        for i in range(W * H):
            if grid[i] in "fs" and dw[i] > 4 and any(grid[n] == "m" for n in nbs(i)):
                out[i] = "m"
        grid = out

    # the glacier is a mountain range under ice: its heart rises, the snowy skirts stay low.
    # The renderer whitens high rock in the north by itself.
    dsnow = distance(grid, lambda c: c not in "nm")
    for i in range(W * H):
        x, y = i % W, i // W
        if grid[i] == "n" and dsnow[i] > 5 and vnoise(x / 11 + 33, y / 11 + 8) > 0.3:
            grid[i] = "m"

    # the marshes of the south-east are too overgrown to trace: open pools among the reeds
    for nx, ny, rx, ry in MARSHES:
        cx, cy = (nx + 1) / 2 * W, (ny + 1) / 2 * H
        for i in range(W * H):
            x, y = i % W, i // W
            d = ((x - cx) / rx) ** 2 + ((y - cy) / ry) ** 2
            if d < 0.45 + vnoise(x / 6 + 50, y / 6) * 0.75 and grid[i] != "~":
                grid[i] = "~"
    join_parts(grid)

    # beaches along the open coast, not below rock or snow
    dw = distance(grid, lambda c: c == "~")
    for i in range(W * H):
        if grid[i] in "sfd" and dw[i] <= 1 + int(vnoise((i % W) / 9, (i // W) / 9) * 2.2):
            grid[i] = "b"

    rows = ["".join(grid[y * W : (y + 1) * W]) for y in range(H)]
    with open(OUT, "w", encoding="utf-8", newline="\n") as f:
        f.write("// Generated by tools/trace-map5.py from notes/attachments/peta5-referensi.jpg. Do not edit.\n")
        f.write("// ~ water, b beach, s plains, f forest, d desert, r red rock, m mountain, n snowfield\n")
        f.write(f"export const MAP_W = {W};\nexport const MAP_H = {H};\nexport const MAP_ROWS: readonly string[] = [\n")
        for r in rows:
            f.write(f'  "{r}",\n')
        f.write("];\n")

    count = Counter(grid)
    land = W * H - count["~"]
    print("land %.1f%%" % (100 * land / (W * H)), {k: "%.1f%%" % (100 * v / land) for k, v in sorted(count.items()) if k != "~"})
    print("land masses", sorted((len(c) for c in components(grid, lambda c: c != "~")), reverse=True)[:14])

    if "--preview" in sys.argv:
        col = {"~": (28, 66, 120), "b": (226, 210, 160), "s": (130, 170, 70), "f": (36, 90, 44), "d": (226, 190, 120), "r": (186, 84, 56), "m": (120, 108, 100), "n": (240, 244, 248)}
        im = Image.new("RGB", (W, H))
        im.putdata([col[c] for c in grid])
        im.resize((W * 3, H * 3), Image.NEAREST).save(sys.argv[sys.argv.index("--preview") + 1])


if __name__ == "__main__":
    main()

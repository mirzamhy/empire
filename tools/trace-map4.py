# Map 4 "Tiga Alam": traces the biome grid from the reference picture.
# Run: python tools/trace-map4.py [--preview out.png]   -> writes game/src/sim/mapdata4.ts
#
# The picture is squeezed into the 384 x 288 grid of maps 2 and 3, so the island suits the portrait
# stream and the cameras need no change. Each cell takes the most common class of its nine samples;
# after that the grid is cleaned: clouds are filled from their neighbours, thin water (the rivers,
# which sim/rivers.ts draws itself) closes up, specks disappear, and land that runs off the picture
# gets a coast of its own. Needs Pillow. Everything is deterministic.
import math
import os
import sys
from collections import Counter, deque
from PIL import Image

W, H = 384, 288
HERE = os.path.dirname(os.path.abspath(__file__))
REF = os.path.join(HERE, "..", "notes", "attachments", "peta4-referensi.jpg")
OUT = os.path.join(HERE, "..", "game", "src", "sim", "mapdata4.ts")
SAMPLES = 3
CLOUD = "?"
MIN_LAKE = 150


def classify(r, g, b, nx, ny):
    """One sample of the picture -> grid letter. nx, ny are 0..1 across the picture."""
    hi, lo = max(r, g, b), min(r, g, b)
    sat = (hi - lo) / (hi + 1)
    lum = (r + g + b) / 3
    if b > r + 14 and b >= g - 4:
        return "~"
    if lo > 165 and sat < 0.17:
        # white: the snowfields in the far north, a cloud or a snow cap anywhere else
        return "n" if ny < 0.2 and nx < 0.74 else CLOUD
    if r > g * 1.33 and r > b * 1.5 and r > 105:
        return "r"  # red rock
    if r > 150 and g > 118 and r > g * 1.08 and b < g * 0.92:
        return "d"  # sand
    if sat < 0.2 and lum > 52:
        return "m"  # bare grey rock
    if r > g * 1.04 and lum > 48:
        return "m"  # brown rock
    if g >= r and lum < 72:
        return "f"
    if g >= r:
        return "s"
    return "f" if lum < 60 else "m"


def hash2(x, y):
    h = (x * 374761393 + y * 668265263 + 20261118) & 0xFFFFFFFF
    h = ((h ^ (h >> 13)) * 1274126177) & 0xFFFFFFFF
    return (h ^ (h >> 16)) / 0xFFFFFFFF


def vnoise(x, y):
    xi, yi = math.floor(x), math.floor(y)
    fx, fy = x - xi, y - yi
    u, v = fx * fx * (3 - 2 * fx), fy * fy * (3 - 2 * fy)
    a, b, c, d = hash2(xi, yi), hash2(xi + 1, yi), hash2(xi, yi + 1), hash2(xi + 1, yi + 1)
    return a + (b - a) * u + (c - a) * v + (a - b - c + d) * u * v


def nbs(i, r8=False):
    x, y = i % W, i // W
    for dy in (-1, 0, 1):
        for dx in (-1, 0, 1):
            if (dx or dy) and (r8 or not (dx and dy)) and 0 <= x + dx < W and 0 <= y + dy < H:
                yield (y + dy) * W + x + dx


def components(grid, test):
    seen = bytearray(W * H)
    for i in range(W * H):
        if seen[i] or not test(grid[i]):
            continue
        seen[i] = 1
        cells, q = [], deque([i])
        while q:
            c = q.popleft()
            cells.append(c)
            for n in nbs(c):
                if not seen[n] and test(grid[n]):
                    seen[n] = 1
                    q.append(n)
        yield cells


def majority(grid, keep=(), passes=1, need=5):
    for _ in range(passes):
        out = grid[:]
        for i in range(W * H):
            if grid[i] in keep:
                continue
            best, count = Counter(grid[n] for n in nbs(i, True)).most_common(1)[0]
            if count >= need:
                out[i] = best
        grid = out
    return grid


def fill(grid, target):
    """Replace every `target` cell with the nearest other class."""
    q = deque(i for i in range(W * H) if grid[i] != target)
    while q:
        c = q.popleft()
        for n in nbs(c):
            if grid[n] == target:
                grid[n] = grid[c]
                q.append(n)


def distance(grid, source):
    d = [65535] * (W * H)
    q = deque()
    for i in range(W * H):
        if source(grid[i]):
            d[i] = 0
            q.append(i)
    while q:
        c = q.popleft()
        for n in nbs(c):
            if d[n] == 65535:
                d[n] = d[c] + 1
                q.append(n)
    return d


def main():
    img = Image.open(REF).convert("RGB").resize((W * SAMPLES, H * SAMPLES), Image.BOX)
    px = img.load()
    grid = []
    for y in range(H):
        for x in range(W):
            votes = Counter()
            for sy in range(SAMPLES):
                for sx in range(SAMPLES):
                    px_x, px_y = x * SAMPLES + sx, y * SAMPLES + sy
                    votes[classify(*px[px_x, px_y], px_x / (W * SAMPLES), px_y / (H * SAMPLES))] += 1
            grid.append(votes.most_common(1)[0][0])

    fill(grid, CLOUD)

    # thin water closes up: only cells at least 2 away from land survive, then grow back by 2
    dland = distance(grid, lambda c: c != "~")
    core = ["~" if d > 2 else "." for d in dland]
    dcore = distance(core, lambda c: c == "~")
    for i in range(W * H):
        if grid[i] == "~" and dcore[i] > 3:
            grid[i] = "?"
    fill(grid, "?")
    for cells in list(components(grid, lambda c: c == "~")):
        if len(cells) < 60:
            for i in cells:
                grid[i] = "?"
    fill(grid, "?")

    # inland water: shadows between peaks read as blue, so only real lakes stay
    for cells in list(components(grid, lambda c: c == "~")):
        touches_edge = any(i % W in (0, W - 1) or i // W in (0, H - 1) for i in cells)
        if not touches_edge:
            cx, cy = sum(i % W for i in cells) / len(cells), sum(i // W for i in cells) / len(cells)
            print("lake", len(cells), round(cx / W * 2 - 1, 2), round(cy / H * 2 - 1, 2))
            if len(cells) < MIN_LAKE or cy < H * 0.2:
                for i in cells:
                    grid[i] = "?"
    fill(grid, "?")

    # the three realms: the far north lies under snow, rock in the far east is red
    for i in range(W * H):
        nx, ny = (i % W) / W, (i // W) / H
        wob = vnoise(nx * 22, ny * 22) * 0.06 + vnoise(nx * 60 + 9, ny * 60) * 0.025
        if ny + wob < 0.235 - 0.05 * abs(nx - 0.5) / 0.25 and 0.24 < nx - wob * 0.5 < 0.72 and grid[i] in "fsdb":
            grid[i] = "n"
        if nx + wob > 0.74 and ny - wob < 0.38 and grid[i] == "m":
            # desert rock: scattered mesas, the rest is open sand
            grid[i] = "r" if vnoise(nx * 26 + 40, ny * 26) > 0.56 else "d"

    # land that runs off the picture gets a ragged coast of its own
    for y in range(H):
        for x in range(W):
            edge = min(y + 2, W - x + 2, x + 8, H - y + 8)
            n = vnoise(x / 17, y / 17) * 13 + vnoise(x / 6 + 30, y / 6) * 5
            if edge < 5 + n:
                grid[y * W + x] = "~"

    grid = majority(grid, keep=("~",), passes=3)
    for letter, least in (("m", 26), ("r", 18), ("f", 14), ("s", 14), ("d", 20), ("n", 30)):
        for cells in list(components(grid, lambda c: c == letter)):
            if len(cells) < least:
                for i in cells:
                    grid[i] = "?"
        fill(grid, "?")

    # small rocks in the sea are dropped, islands of a fair size stay
    for cells in list(components(grid, lambda c: c != "~")):
        if len(cells) < 24:
            for i in cells:
                grid[i] = "~"

    # ranges are narrow in the picture: widen them by one cell so they can gain height
    out = grid[:]
    for i in range(W * H):
        if grid[i] in "fsdn" and any(grid[n] == "m" for n in nbs(i)):
            out[i] = "m"
        elif grid[i] == "d" and any(grid[n] == "r" for n in nbs(i)):
            out[i] = "r"
    grid = out

    # beaches: a ragged strip along the open coast, not below rock or snow
    dw = distance(grid, lambda c: c == "~")
    for i in range(W * H):
        if grid[i] in "sfd" and dw[i] <= 1 + int(vnoise((i % W) / 9, (i // W) / 9) * 2.6):
            grid[i] = "b"

    rows = ["".join(grid[y * W : (y + 1) * W]) for y in range(H)]
    with open(OUT, "w", encoding="utf-8", newline="\n") as f:
        f.write("// Generated by tools/trace-map4.py from notes/attachments/peta4-referensi.jpg. Do not edit.\n")
        f.write("// ~ water, b beach, s plains, f forest, d desert, r red rock, m mountain, n snowfield\n")
        f.write(f"export const MAP_W = {W};\nexport const MAP_H = {H};\nexport const MAP_ROWS: readonly string[] = [\n")
        for r in rows:
            f.write(f'  "{r}",\n')
        f.write("];\n")

    count = Counter(grid)
    land = W * H - count["~"]
    print("land %.1f%%" % (100 * land / (W * H)), {k: "%.1f%%" % (100 * v / land) for k, v in sorted(count.items()) if k != "~"})
    print("land masses", sorted((len(c) for c in components(grid, lambda c: c != "~")), reverse=True)[:12])

    if "--preview" in sys.argv:
        col = {"~": (28, 66, 120), "b": (226, 210, 160), "s": (130, 170, 70), "f": (36, 90, 44), "d": (226, 190, 120), "r": (186, 84, 56), "m": (120, 108, 100), "n": (240, 244, 248)}
        im = Image.new("RGB", (W, H))
        im.putdata([col[c] for c in grid])
        im.resize((W * 3, H * 3), Image.NEAREST).save(sys.argv[sys.argv.index("--preview") + 1])


if __name__ == "__main__":
    main()

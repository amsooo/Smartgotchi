# Pikselowy awatar Smartgotchi: stworek wykluwający się z jajka (32x32 → 640x640)
import sys, math
from PIL import Image
N, SCALE = 32, 20
BG1, BG2 = (196, 236, 222), (160, 220, 200)
OUT = (59, 47, 47)
Y, Y_D, Y_L = (255, 213, 74), (240, 178, 48), (255, 241, 168)
SHELL, SHELL_D, DOT = (255, 248, 231), (232, 220, 196), (154, 208, 236)
PINK, BEAK, BEAK_D, WHITE, SHADOW = (255, 154, 162), (255, 140, 66), (222, 102, 40), (255, 255, 255), (138, 200, 180)

px = [[None]*N for _ in range(N)]
cx = 15.5
body = lambda x, y: (x-cx)**2 + (y-14.5)**2 <= 8.6**2
def shell_top(x): return 19 + (1 if (x % 4) in (2, 3) else 0)
shell = lambda x, y: y >= shell_top(x) and ((x-cx)/10.2)**2 + ((y-19.5)/7.6)**2 <= 1
tuft = {(15,5),(16,5),(16,4),(17,4),(17,3)}
mask = lambda x, y: 0 <= x < N and 0 <= y < N and (body(x,y) or shell(x,y) or (x,y) in tuft)

# tło: łagodny gradient + cień pod jajkiem + iskierki
for y in range(N):
    for x in range(N):
        t = math.hypot(x-cx, y-13)/22
        px[y][x] = tuple(int(BG1[i]*(1-t)+BG2[i]*t) for i in range(3))
        if ((x-cx)/9)**2 + ((y-28)/1.6)**2 <= 1: px[y][x] = SHADOW
for (sx, sy) in [(6,8),(26,9),(26,24),(4,18)]:
    for dx, dy in [(0,0),(1,0),(-1,0),(0,1),(0,-1)]:
        px[sy+dy][sx+dx] = WHITE

for y in range(N):
    for x in range(N):
        if shell(x,y):
            px[y][x] = SHELL_D if (x-cx) > 5 or y >= 25 else SHELL
        elif body(x,y) or (x,y) in tuft:
            d = (x-cx) + (y-14.5)
            px[y][x] = Y_L if d < -8 else (Y_D if d > 7 else Y)
# kontur
for y in range(N):
    for x in range(N):
        if not mask(x,y) and any(mask(x+dx,y+dy) for dx,dy in [(1,0),(-1,0),(0,1),(0,-1)]):
            px[y][x] = OUT
        elif shell(x,y) and mask(x,y-1) and not shell(x,y-1):
            px[y][x] = OUT  # ząbkowana krawędź skorupki
# kropki na skorupce
for p in [(10,23),(11,23),(20,22),(21,22),(15,25),(16,25),(23,24)]:
    if shell(*p): px[p[1]][p[0]] = DOT
# oczy z błyskiem
for ex in (11, 19):
    for dy in range(3):
        for dx in range(2):
            px[12+dy][ex+dx] = OUT
    px[12][ex] = WHITE
# policzki i dzióbek
for p in [(8,16),(9,16),(22,16),(23,16)]: px[p[1]][p[0]] = PINK
for p in [(15,15),(16,15)]: px[p[1]][p[0]] = BEAK
for p in [(15,16),(16,16)]: px[p[1]][p[0]] = BEAK_D

img = Image.new("RGB", (N, N))
for y in range(N):
    for x in range(N): img.putpixel((x, y), px[y][x])
img.resize((N*SCALE, N*SCALE), Image.NEAREST).save(sys.argv[1])

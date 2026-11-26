# Room build pipeline (Blender → web)

Source files live in `art-source/` (git-ignored). These scripts turn `art-source/mayne-room_bake.blend` into the files in `assets/models/`.

| Step | Command | Output |
|---|---|---|
| Bake | `bash run_bake.sh` (one Blender process per piece; skips finished pieces) | `art-source/bake/*_alb/rough/metal/nrm.png`, `*_lm_<layer>.exr`, plant vertex lighting saved in the .blend |
| Export | `blender -b mayne-room_bake.blend --python export_room.py -- <bake_dir> room_raw.glb` | raw GLB (~190 MB) + `mayne-room_export.blend` |
| Lightmaps | `blender -b --factory-startup --python lm_convert.py -- <bake_dir> <lm_png_dir>` | 8-bit PNG lightmaps + `manifest.json` |
| Compress | `node compress.mjs desktop\|mobile room_raw.glb <out.glb> <lm_png_dir> <lm_out_dir>` | `room.glb` / `room-mobile.glb`, KTX2 lightmaps |
| Check | `node inspect.mjs <file.glb>` | draw calls, triangles, texture memory, hotspot names |

## What is in `assets/models/`

- `room.glb`: desktop. 2K colour atlases, 390k triangles.
- `room-mobile.glb`: phones. 1K atlases, 282k triangles.
- Both have:
  - 131 draw calls, no live lights, no normal maps;
  - KTX2 textures (`KHR_texture_basisu`) and meshopt geometry (`EXT_meshopt_compression`).
- `lightmaps/desktop/`: 1024 px. `lightmaps/mobile/`: 512 px.
  - 13 areas × 4 lighting layers: `night`, `practical` (floor lamp + LED + fairy lights), `desklamp`, `day`.
  - Outdoor has no practical or desklamp layer.

## Rules for the site code (Step 6)

1. **Loaders.**
   - GLTFLoader + `KTX2Loader` (basis transcoder) + `MeshoptDecoder`.
   - Pick `room-mobile.glb` on phones and low-memory devices.
2. **Which lightmap a mesh uses.**
   - Read `userData.lm_group`. For multi-material objects it sits on the **parent** Group, so walk up the parents.
   - Look up the group in `lightmaps/<profile>/manifest.json` → `groups[group][layer] = {file, scale}`.
3. **Lightmap decode.**
   - The files are linear-flagged KTX2 storing `(irradiance/scale)^(1/2.2)`.
   - Simplest: set `texture.colorSpace = SRGBColorSpace`, `texture.channel = 1`, `texture.flipY = false`, and `lightMapIntensity = scale * Math.PI`.
   - Exact: decode `pow(texel, 2.2) * scale` in the shader.
4. **Mixing layers.** Final irradiance = `night + practical·a + desklamp·b`, with `day` used on its own. Do it in one `onBeforeCompile` shader that samples the layers on UV1.
5. **Plants** (`plant_corner`, `plant_left`, `shelf_succulent`) have no UV lightmap.
   - Their lighting is in vertex attributes `_lm_night/_lm_practical/_lm_desklamp/_lm_day`: normalized uint8, gamma 2.2.
   - The scales are in the GLB root extras, `vertexLightmapScale`.
   - Radiance = albedo × `pow(attr, 2.2)` × scale.
6. **Performance rules** (measured in `check.html`):
   - **No transmission glass:** it re-renders the whole scene every frame.
   - **No real-time lights or shadows:** all lighting is baked.
   - Leaves use alpha cutout (`MASK`), not blending.
   - Cap `renderer.setPixelRatio(Math.min(devicePixelRatio, 2))`, or 1.5 on mobile.
   - Load the `practical`, `desklamp` and `day` lightmaps after the first frame.
7. Cables have no lightmap. Give them a small constant ambient or emissive so they don't render pure black.
8. Hidden collision boxes are `col_*`; hotspot anchors are `spot_<name>` empties.

## The site renderer (Step 6)

Source: `tools/room-site/room.src.js` (three.js 0.170). Build: `cd tools/room-site && npm install && npm run build`. That writes `assets/js/room.js` and copies the KTX2 transcoder into `assets/vendor/basis/`.

What it does to run smoothly. Each item was measured on Intel Iris Xe:

- **Unlit materials.** Every non-glowing material becomes `MeshBasicMaterial` (albedo × baked light). No reflections; the PBR shader doubled the per-pixel cost.
- **Pre-mixed light.** The four lightmap layers are mixed once into a half-float texture per area, and only when the light weights change. Each pixel then reads one lightmap.
- **Draw order.** The outdoor scenery and moon draw last, and the walls and floor after the furniture. The outdoor's 170 m bounds made three.js draw it first, which cost 3 ms a frame.
- **Front faces only** for opaque materials.
- **Low-power GPUs** (Intel, Mali, Adreno, PowerVR):
  - no MSAA, and a pixel ratio of at most 1.0 on laptops or 1.5 on phones;
  - adds `html.low-gpu`, which swaps frosted-glass panels for solid ones;
  - dynamic resolution while moving only, so the frame you stop on is sharp.
- **On-demand rendering.** Nothing draws while the view is still.

Debug switches (URL query):

| Switch | Effect |
|---|---|
| `?debug` | Exposes `window.__room` |
| `?room=mobile\|desktop` | Picks the model profile |
| `?gpu=low\|high` | Overrides the GPU detection |
| `?aa=0\|1` | Turns MSAA off or on |
| `?side=double` | Draws both faces of opaque materials |
| `?combine=0` | Mixes light per pixel instead of pre-mixing |

`Room.bench(seconds)` returns measured frame times.

"""blender -b --factory-startup --python lm_convert.py -- <bake_dir> <out_dir>
EXR irradiance -> 8-bit PNG:  png = (L / scale) ^ (1/2.2),  scale = 99.8th percentile of the brightest channel.
The site decodes with  L = png_linear * scale  (three.js: lightMap in sRGB-ish gamma 2.2, lightMapIntensity = scale * PI).
Writes manifest.json {group: {layer: {file, scale, clipped}}}."""
import bpy, sys, os, glob, json, numpy as np
argv = sys.argv[sys.argv.index('--') + 1:]
BAKE, OUT = argv[0], argv[1]
os.makedirs(OUT, exist_ok=True)
man = {}
for p in sorted(glob.glob(os.path.join(BAKE, '*_lm_*.exr'))):
    name = os.path.basename(p)[:-4]; g, layer = name.split('_lm_')
    im = bpy.data.images.load(p); w, h = im.size
    a = np.array(im.pixels[:], dtype=np.float32).reshape(h, w, 4)[..., :3]
    a = np.nan_to_num(np.clip(a, 0, None))
    mx = a.max(axis=2); lit = mx[mx > 1e-6]
    scale = float(np.percentile(lit, 99.8)) if lit.size else 1.0
    scale = max(scale, 1e-4)
    enc = np.power(np.clip(a / scale, 0, 1), 1 / 2.2)
    rgba = np.concatenate([enc, np.ones((h, w, 1), np.float32)], axis=2)
    o = bpy.data.images.new(name, w, h, alpha=False); o.colorspace_settings.name = 'Non-Color'
    o.pixels = rgba.ravel(); o.filepath_raw = os.path.join(OUT, name + '.png'); o.file_format = 'PNG'; o.save()
    man.setdefault(g, {})[layer] = {'file': name + '.png', 'scale': round(scale, 6),
                                    'clipped': round(float((mx > scale).mean()), 5), 'size': w}
    bpy.data.images.remove(im); bpy.data.images.remove(o)
    print('LM', name, w, 'scale %.5f' % scale, flush=True)
json.dump({'encoding': 'png = (irradiance/scale)^(1/2.2); irradiance = png_linear*scale', 'groups': man},
          open(os.path.join(OUT, 'manifest.json'), 'w'), indent=1)
print('LM_DONE', len(glob.glob(os.path.join(OUT, '*.png'))), flush=True)

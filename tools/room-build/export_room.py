"""blender -b mayne-room_bake.blend --python export_room.py -- <bake_dir> <out_glb>
Swaps every atlased material for its group atlas material, keeps artwork / plants / books / glass / glow materials,
orders UVs as [UV0 = surface, UV1 = lightmap], joins static meshes per group, exports a raw GLB (compression is done
afterwards with gltf-transform). Saves the result as mayne-room_export.blend for inspection."""
import bpy, sys, os, numpy as np
argv = sys.argv[sys.argv.index('--') + 1:]
BAKE, OUT_GLB = argv[0], argv[1]
exec(bpy.data.texts['mr_step5.py'].as_string())

HOTSPOTS = {'monitor', 'laptop', 'paper', 'lamp', 'calendar', 'qr', 'books', 'diploma', 'cap', 'frames', 'f0', 'f1', 'f2',
            'f3', 'f4', 'portrait', 'phone', 'window', 'bag'}
KEEP_SEPARATE = HOTSPOTS | {'clock', 'clock_hand_hour', 'clock_hand_minute', 'clock_hand_second', 'clock_hub', 'ceiling_fan',
                            'door', 'fairy_bulbs', 'lamp_bulb', 'floor_lamp_bulb', 'led_strip', 'console_light', 'lava_glass',
                            'lava_wax', 'lava_wax.001', 'lava_wax.002', 'lava_wax.003', 'record_player', 'records', 'moon',
                            'ceiling_light', 'library_books_ph'} | VLIT
GLOW = {'lampshade_linen': 1.6, 'lamp_inner': 4.0}

def load(name, color):
    p = os.path.join(BAKE, name)
    im = bpy.data.images.get(name) or bpy.data.images.load(p, check_existing=True)
    im.colorspace_settings.name = color
    return im

def orm_image(g):
    """pack R = 1 (no AO), G = roughness, B = metallic -> one glTF metallicRoughness texture"""
    r = load('%s_rough.png' % g, 'Non-Color'); m = load('%s_metal.png' % g, 'Non-Color')
    w, h = r.size
    R = np.array(r.pixels[:], dtype=np.float32).reshape(-1, 4); M = np.array(m.pixels[:], dtype=np.float32).reshape(-1, 4)
    o = np.ones_like(R); o[:, 1] = R[:, 0]; o[:, 2] = np.where(M[:, 0] > .5, 1.0, M[:, 0])
    im = bpy.data.images.new('%s_orm' % g, w, h, alpha=False); im.colorspace_settings.name = 'Non-Color'
    im.pixels = o.ravel(); im.filepath_raw = os.path.join(BAKE, '%s_orm.png' % g); im.file_format = 'PNG'; im.save()
    return im

def atlas_material(g, glow=0.0):
    name = 'G_%s%s' % (g, '_glow' if glow else '')
    m = bpy.data.materials.get(name)
    if m: return m
    m = bpy.data.materials.new(name); m.use_nodes = True; nt = m.node_tree; nt.nodes.clear()
    out = nt.nodes.new('ShaderNodeOutputMaterial'); p = nt.nodes.new('ShaderNodeBsdfPrincipled')
    nt.links.new(p.outputs[0], out.inputs['Surface'])
    uv = nt.nodes.new('ShaderNodeUVMap'); uv.uv_map = 'UV0'
    def tex(im):
        t = nt.nodes.new('ShaderNodeTexImage'); t.image = im; nt.links.new(uv.outputs[0], t.inputs[0]); return t
    a = tex(load('%s_alb.png' % g, 'sRGB')); nt.links.new(a.outputs['Color'], p.inputs['Base Color'])
    orm = tex(bpy.data.images.get('%s_orm' % g) or orm_image(g))
    sep = nt.nodes.new('ShaderNodeSeparateColor'); nt.links.new(orm.outputs['Color'], sep.inputs[0])
    nt.links.new(sep.outputs['Green'], p.inputs['Roughness']); nt.links.new(sep.outputs['Blue'], p.inputs['Metallic'])
    n = tex(load('%s_nrm.png' % g, 'Non-Color')); nm = nt.nodes.new('ShaderNodeNormalMap'); nm.uv_map = 'UV0'
    nt.links.new(n.outputs['Color'], nm.inputs['Color']); nt.links.new(nm.outputs[0], p.inputs['Normal'])
    if glow:
        nt.links.new(a.outputs['Color'], p.inputs['Emission Color']); p.inputs['Emission Strength'].default_value = glow
    m['lm_group'] = g
    return m

def simplify_keep(m):
    """rebuild a keep-material as plain Principled + image nodes the glTF exporter understands"""
    if m.get('_simplified') or not m.use_nodes: return
    nt = m.node_tree; p = principled(m)
    imgs = {}
    for t in [n for n in nt.nodes if n.type == 'TEX_IMAGE' and n.image]:
        k = t.image.name.lower()
        role = 'nrm' if ('nor' in k or 'nrm' in k) else 'rough' if 'rough' in k else 'alpha' if 'alpha' in k else 'col'
        imgs.setdefault(role, t.image)
    if not imgs or is_glass(m): m['_simplified'] = 1; return
    emis = p.inputs['Emission Strength'].default_value if p else 0
    rough = p.inputs['Roughness'].default_value if (p and not p.inputs['Roughness'].is_linked) else .6
    screen = m.name.startswith('screen_') or m.name == 'phone_screen'
    nt.nodes.clear()
    out = nt.nodes.new('ShaderNodeOutputMaterial'); q = nt.nodes.new('ShaderNodeBsdfPrincipled'); nt.links.new(q.outputs[0], out.inputs['Surface'])
    uv = nt.nodes.new('ShaderNodeUVMap'); uv.uv_map = 'UV0'
    def tex(im, cs):
        im.colorspace_settings.name = cs; t = nt.nodes.new('ShaderNodeTexImage'); t.image = im; nt.links.new(uv.outputs[0], t.inputs[0]); return t
    c = tex(imgs['col'], 'sRGB') if 'col' in imgs else None
    if c: nt.links.new(c.outputs['Color'], q.inputs['Base Color'])
    if 'rough' in imgs: nt.links.new(tex(imgs['rough'], 'Non-Color').outputs['Color'], q.inputs['Roughness'])
    else: q.inputs['Roughness'].default_value = rough
    if 'nrm' in imgs:
        nm = nt.nodes.new('ShaderNodeNormalMap'); nm.uv_map = 'UV0'
        nt.links.new(tex(imgs['nrm'], 'Non-Color').outputs['Color'], nm.inputs['Color']); nt.links.new(nm.outputs[0], q.inputs['Normal'])
    if 'alpha' in imgs:
        nt.links.new(tex(imgs['alpha'], 'Non-Color').outputs['Color'], q.inputs['Alpha'])
        try: m.surface_render_method = 'DITHERED'
        except Exception: pass
    ec = p.inputs['Emission Color'] if p else None   # strength > 0 with a black colour is not a glow
    glows = bool(ec) and emis > 0 and (ec.is_linked or max(ec.default_value[:3]) > 0.001)
    if c and (screen or glows):
        nt.links.new(c.outputs['Color'], q.inputs['Emission Color']); q.inputs['Emission Strength'].default_value = max(emis, 1.0)
    m['_simplified'] = 1

def set_uvs(o):
    me = o.data
    def grab(name):
        l = me.uv_layers.get(name)
        if not l: return None
        a = np.zeros(len(me.loops) * 2, dtype=np.float32); l.data.foreach_get('uv', a); return a
    uv0 = grab('UVout')
    if uv0 is None:
        first = next((l.name for l in me.uv_layers if l.active_render), None) or (me.uv_layers[0].name if me.uv_layers else None)
        uv0 = grab(first) if first else None
    uv1 = grab('LM')
    while me.uv_layers: me.uv_layers.remove(me.uv_layers[0])
    if uv0 is not None: me.uv_layers.new(name='UV0').data.foreach_set('uv', uv0)
    if uv1 is not None: me.uv_layers.new(name='UV1').data.foreach_set('uv', uv1)
    if me.uv_layers: me.uv_layers[0].active_render = True

G = lm_objects()
# 1. materials
for g, objs in G.items():
    for o in objs:
        for s in o.material_slots:
            m = s.material
            if m is None: continue
            if is_keep(m): simplify_keep(m)
            elif g not in ('books', 'libbooks'):
                s.material = atlas_material(g, GLOW.get(base(m.name), 0.0))
for o in bpy.context.scene.objects:   # objects outside the lightmap groups (glass, glow, plants)
    if o.type == 'MESH':
        for s in o.material_slots:
            if s.material and is_keep(s.material): simplify_keep(s.material)
# 2. UV order
for o in bpy.context.scene.objects:
    if o.type == 'MESH' and not o.name.startswith('col_'): set_uvs(o)
# 3. join static meshes per group
joined = {}
for g, objs in G.items():
    pool = [o for o in objs if o.name not in KEEP_SEPARATE and not o.children and o.parent is None]
    if len(pool) < 2: continue
    bpy.ops.object.select_all(action='DESELECT')
    for o in pool: o.select_set(True)
    bpy.context.view_layer.objects.active = pool[0]
    bpy.ops.object.join(); j = bpy.context.view_layer.objects.active
    j.name = '%s_static' % g; j['lm_group'] = g; joined[g] = len(pool)
print('JOINED', joined, flush=True)
for o in bpy.context.scene.objects:
    if o.type == 'MESH' and 'lm_group' not in o:
        o['lm_group'] = 'none'
# 4. drop bake helper nodes and unused data
for m in bpy.data.materials:
    if m.use_nodes:
        for n in [n for n in m.node_tree.nodes if n.name in ('_bake_target', '_bake_emit')]: m.node_tree.nodes.remove(n)
for o in bpy.context.scene.objects:
    if o.type == 'MESH':
        for a in [a for a in o.data.attributes if a.name.startswith('_LM_') is False and a.domain == 'CORNER' and a.data_type in ('FLOAT_COLOR', 'BYTE_COLOR')]:
            o.data.attributes.remove(a)
bpy.ops.wm.save_as_mainfile(filepath=bpy.data.filepath.replace('_bake.blend', '_export.blend'))
# 5. export
KW = dict(filepath=OUT_GLB, export_format='GLB', use_visible=False, use_renderable=False,
          export_extras=True, export_cameras=True, export_lights=True, export_apply=True,
          export_attributes=True, export_vertex_color='NONE', export_yup=True,
          export_image_format='AUTO', export_texcoords=True, export_normals=True,
          export_tangents=False, export_materials='EXPORT', export_animations=False)
props = bpy.ops.export_scene.gltf.get_rna_type().properties.keys()
print('DROPPED_KW', [k for k in KW if k not in props], flush=True)
bpy.ops.export_scene.gltf(**{k: v for k, v in KW.items() if k in props})
print('EXPORTED', OUT_GLB, os.path.getsize(OUT_GLB) / 1e6, 'MB', flush=True)

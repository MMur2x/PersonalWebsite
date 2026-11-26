"""Step 5 helpers: lightmap groups, LM/UVout UV layers, bake rewiring. Runs inside mayne-room_bake.blend."""
import bpy, bmesh, math, json

ATLAS = {'floor': 2048, 'walls': 2048, 'desk': 2048, 'deskwall': 1024, 'bed': 2048, 'window': 2048,
         'leftwall': 2048, 'books': 2048, 'libbooks': 2048, 'rightwall': 2048, 'frontwall': 2048,
         'center': 2048, 'outdoor': 1024}
LM_SIZE = 1024
DESKWALL = {'calendar', 'calendar_nail', 'qr', 'qr_tape', 'cork_board', 'note_ship', 'note_leet', 'note_k8s', 'note_todo',
            'note_monitor', 'pin', 'clock', 'clock_hand_hour', 'clock_hand_minute', 'clock_hand_second', 'clock_hub', 'fairy_hook'}
WINDOW = {'window', 'curtain_rod', 'curtain_L', 'curtain_R', 'nightstand', 'portrait', 'phone', 'floating_shelf', 'shelf_succulent'}
COLL = {'Desk_Corner': 'desk', 'Bed_Window': 'bed', 'Left_Wall': 'leftwall', 'Right_Wall': 'rightwall',
        'Front_Wall': 'frontwall', 'Center': 'center', 'Outdoor': 'outdoor'}
VLIT = {'plant_corner', 'plant_left', 'shelf_succulent'}   # leafy: thousands of UV islands, lit through vertex colours instead
NO_LM = {'fairy_bulbs', 'lamp_bulb', 'floor_lamp_bulb', 'led_strip', 'console_light', 'moon', 'ceiling_light', 'lava_glass'}

def base(n): return n.split('.')[0]

def principled(m):
    return next((n for n in m.node_tree.nodes if n.type == 'BSDF_PRINCIPLED'), None) if m and m.use_nodes else None

def is_glass(m):
    p = principled(m); return bool(p) and p.inputs['Transmission Weight'].default_value > .5

def is_keep(m):
    """materials exported with their own textures / flat values instead of the group atlas"""
    if m is None: return True
    n = m.name
    if n.startswith('potted_plant_') or n.endswith('_books_baked') or n.endswith('_baked'): return True
    if is_glass(m): return True
    nodes = m.node_tree.nodes if m.use_nodes else []
    imgs = [x for x in nodes if x.type == 'TEX_IMAGE' and x.image]
    if imgs and len(nodes) <= 4: return True          # plain image artwork / screens
    p = principled(m)
    if not imgs and p and p.inputs['Emission Strength'].default_value > 0 and max(p.inputs['Emission Color'].default_value[:3]) > 0: return True
    if not p and not imgs: return True               # pure emission shaders
    return False

def group_of(o):
    c = o.users_collection[0].name; b = base(o.name)
    if c == 'Shell': return 'floor' if (b == 'floor' or b.startswith('baseboard')) else 'walls'
    if o.name == 'books': return 'books'
    if o.name == 'library_books_ph': return 'libbooks'
    if c == 'Desk_Corner': return 'deskwall' if b in DESKWALL else 'desk'
    if c == 'Bed_Window': return 'window' if b in WINDOW else 'bed'
    return COLL.get(c)

def lm_objects():
    out = {}
    for o in bpy.context.scene.objects:
        if o.type != 'MESH' or o.hide_render or o.name.startswith('col_'): continue
        if base(o.name) in NO_LM or o.name.startswith('lava_wax') or o.name in VLIT: continue
        if all(is_glass(s.material) for s in o.material_slots if s.material): continue
        g = group_of(o)
        if g: out.setdefault(g, []).append(o)
    return out

def make_lm(objs, margin):
    vl = bpy.context.view_layer
    if bpy.context.object and bpy.context.object.mode != 'OBJECT': bpy.ops.object.mode_set(mode='OBJECT')
    prebaked = []
    for o in objs:
        me = o.data
        for n in ('LM', 'UVout'):
            if n in me.uv_layers: me.uv_layers.remove(me.uv_layers[n])
        if 'BakeUV' in me.uv_layers:            # books: their atlas UV is already non-overlapping
            me.uv_layers.active = me.uv_layers['BakeUV']; me.uv_layers.new(name='LM'); prebaked.append(o)
        elif len(me.uv_layers) == 0:
            me.uv_layers.new(name='UVMap')
    todo = [o for o in objs if o not in prebaked]
    if not todo: return
    for o in todo:
        lm = o.data.uv_layers.new(name='LM', do_init=False); o.data.uv_layers.active = lm
    bpy.ops.object.select_all(action='DESELECT')
    for o in todo: o.select_set(True)
    vl.objects.active = todo[0]
    ts = bpy.context.scene.tool_settings; ts.use_uv_select_sync = True
    bpy.ops.object.mode_set(mode='EDIT'); bpy.ops.mesh.reveal(); bpy.ops.mesh.select_all(action='SELECT')
    bpy.ops.uv.smart_project(angle_limit=math.radians(66), island_margin=0.0, area_weight=0.0, correct_aspect=True, scale_to_bounds=False)
    bpy.ops.uv.average_islands_scale()
    bpy.ops.uv.pack_islands(rotate=True, margin_method='FRACTION', margin=margin)
    bpy.ops.object.mode_set(mode='OBJECT')

def img_uv_name(m, me):
    """the UV layer a keep-material's image actually samples"""
    for n in m.node_tree.nodes:
        if n.type == 'UVMAP' and n.uv_map: return n.uv_map
    if m.name.endswith('_baked') and 'BakeUV' in me.uv_layers: return 'BakeUV'
    for l in me.uv_layers:
        if l.active_render and l.name not in ('LM', 'UVout'): return l.name
    return next((l.name for l in me.uv_layers if l.name not in ('LM', 'UVout')), 'LM')

def make_uvout(o):
    """UVout = LM on atlas faces, the material's own UV on keep faces"""
    me = o.data
    if 'UVout' in me.uv_layers: me.uv_layers.remove(me.uv_layers['UVout'])
    out = me.uv_layers.new(name='UVout', do_init=False)
    src = {}
    for i, s in enumerate(o.material_slots):
        src[i] = img_uv_name(s.material, me) if (s.material and is_keep(s.material)) else 'LM'
    lm = me.uv_layers['LM'].data if 'LM' in me.uv_layers else None
    for p in me.polygons:
        layer = me.uv_layers.get(src.get(p.material_index, 'LM')) or me.uv_layers.get('LM')
        d = layer.data if layer else lm
        for li in p.loop_indices: out.data[li].uv = d[li].uv

# ---------- baking helpers ----------
def out_node(m):
    outs = [n for n in m.node_tree.nodes if n.type == 'OUTPUT_MATERIAL']
    return next((n for n in outs if n.is_active_output), outs[0] if outs else None)

def set_target(mats, img):
    for m in mats:
        nt = m.node_tree
        t = nt.nodes.get('_bake_target') or nt.nodes.new('ShaderNodeTexImage')
        t.name = '_bake_target'; t.image = img; t.select = True; nt.nodes.active = t

def rewire(mats, socket_name):
    """route a Principled input (Base Color / Metallic) into an emission shader; returns undo list"""
    undo = []
    for m in mats:
        nt = m.node_tree; o = out_node(m); p = principled(m)
        if not o: continue
        prev = o.inputs['Surface'].links[0].from_socket if o.inputs['Surface'].is_linked else None
        e = nt.nodes.new('ShaderNodeEmission'); e.name = '_bake_emit'; e.inputs['Strength'].default_value = 1.0
        if p:
            inp = p.inputs[socket_name]
            if inp.is_linked: nt.links.new(inp.links[0].from_socket, e.inputs['Color'])
            else:
                v = inp.default_value
                e.inputs['Color'].default_value = (v[0], v[1], v[2], 1) if hasattr(v, '__len__') else (v, v, v, 1)
        else:
            e.inputs['Color'].default_value = (0, 0, 0, 1)
        nt.links.new(e.outputs[0], o.inputs['Surface'])
        undo.append((m, prev))
    return undo

def unwire(undo):
    for m, prev in undo:
        nt = m.node_tree; o = out_node(m)
        e = nt.nodes.get('_bake_emit')
        if e: nt.nodes.remove(e)
        if prev: nt.links.new(prev, o.inputs['Surface'])

def select_only(objs, uv='LM'):
    bpy.ops.object.select_all(action='DESELECT')
    for o in objs:
        o.select_set(True)
        if uv in o.data.uv_layers: o.data.uv_layers.active = o.data.uv_layers[uv]
    bpy.context.view_layer.objects.active = objs[0]

def group_mats(objs):
    ms = []
    for o in objs:
        for s in o.material_slots:
            if s.material and s.material not in ms: ms.append(s.material)
    return ms

# ---------- lighting layers ----------
LAYERS = ('night', 'practical', 'desklamp', 'day')
PRACTICAL_LIGHTS = lambda n: n in ('L_floor_lamp', 'L_led_strip') or n.startswith('fairy_light_')
PRACTICAL_EMIT = {'fairy_bulb', 'led_strip', 'lampshade_linen'}
DESK_EMIT = {'lamp_inner'}

def _emit(m, v):
    for n in m.node_tree.nodes:
        if n.type == 'BSDF_PRINCIPLED': n.inputs['Emission Strength'].default_value = v
        if n.type == 'EMISSION': n.inputs['Strength'].default_value = v

def black_world():
    w = bpy.data.worlds.get('World_Black') or bpy.data.worlds.new('World_Black')
    w.use_nodes = True
    bg = next(n for n in w.node_tree.nodes if n.type == 'BACKGROUND'); bg.inputs['Strength'].default_value = 0
    return w

def set_layer(layer):
    exec(bpy.data.texts['mr_mode.py'].as_string(), globals())
    set_mode('day' if layer == 'day' else 'night')
    if layer == 'day': return
    scn = bpy.context.scene
    lights = [o for o in bpy.context.scene.objects if o.type == 'LIGHT' and not o.hide_render]
    emits = {k: v for k, v in NIGHT_EMIT.items()}
    if layer == 'night':
        for o in lights:
            if PRACTICAL_LIGHTS(o.name) or o.name == 'L_desk_lamp': o.hide_render = True
        for k in PRACTICAL_EMIT | DESK_EMIT | {'lamp_bulb'}: emits[k] = 0
    else:
        scn.world = black_world()
        want = PRACTICAL_LIGHTS if layer == 'practical' else (lambda n: n == 'L_desk_lamp')
        keepm = PRACTICAL_EMIT if layer == 'practical' else DESK_EMIT
        for o in lights: o.hide_render = not want(o.name)
        for k in list(emits): emits[k] = emits[k] if k in keepm else 0
        if 'moon' in bpy.data.objects: bpy.data.objects['moon'].hide_render = True
    for k, v in emits.items():
        m = bpy.data.materials.get(k)
        if m: _emit(m, v)

def new_img(name, size, float_=False, color='Non-Color'):
    im = bpy.data.images.get(name)
    if im and (im.size[0] != size or im.is_float != float_): bpy.data.images.remove(im); im = None
    if not im: im = bpy.data.images.new(name, size, size, alpha=False, float_buffer=float_)
    im.colorspace_settings.name = color
    return im

def bake_group(g, objs, kind, size, samples, out_dir, log=print):
    """kind: alb / rough / metal / nrm / lm_<layer>"""
    import time, os
    scn = bpy.context.scene; scn.render.engine = 'CYCLES'; scn.cycles.samples = samples
    scn.render.bake.use_selected_to_active = False
    is_lm = kind.startswith('lm_')
    im = new_img('%s_%s' % (g, kind), size, float_=is_lm, color='sRGB' if kind == 'alb' else 'Non-Color')
    mats = group_mats(objs); set_target(mats, im); select_only(objs, 'LM')
    for o in objs:   # bake through LM, materials still sample their own UVs explicitly or via the render UV
        rl = next((l for l in o.data.uv_layers if l.name not in ('LM', 'UVout')), None)
        if rl: rl.active_render = True
    margin = 6 if size >= 1024 else 3
    t = time.time(); undo = []
    try:
        if kind == 'alb':
            undo = rewire(mats, 'Base Color'); bpy.ops.object.bake(type='EMIT', margin=margin, use_clear=True)
        elif kind == 'metal':
            undo = rewire(mats, 'Metallic'); bpy.ops.object.bake(type='EMIT', margin=margin, use_clear=True)
        elif kind == 'rough':
            bpy.ops.object.bake(type='ROUGHNESS', margin=margin, use_clear=True)
        elif kind == 'nrm':
            bpy.ops.object.bake(type='NORMAL', normal_space='TANGENT', margin=margin, use_clear=True)
        else:
            bpy.ops.object.bake(type='DIFFUSE', pass_filter={'DIRECT', 'INDIRECT'}, margin=margin, use_clear=True)
    finally:
        unwire(undo)
    ext = 'exr' if is_lm else 'png'
    im.filepath_raw = os.path.join(out_dir, '%s_%s.%s' % (g, kind, ext))
    im.file_format = 'OPEN_EXR' if is_lm else 'PNG'
    im.save()
    log('BAKED %s %s %dpx %dspp %.1fs' % (g, kind, size, samples, time.time() - t))
    return im

def bake_vertex(objs, layer, samples, log=print):
    import time
    scn = bpy.context.scene; scn.render.engine = 'CYCLES'; scn.cycles.samples = samples
    for o in objs:
        name = '_LM_' + layer.upper()
        a = o.data.color_attributes.get(name) or o.data.color_attributes.new(name, 'FLOAT_COLOR', 'POINT')
        o.data.color_attributes.active_color = a
    select_only(objs, 'UVMap')
    t = time.time()
    bpy.ops.object.bake(type='DIFFUSE', pass_filter={'DIRECT', 'INDIRECT'}, target='VERTEX_COLORS', use_clear=True)
    log('BAKED vertex %s %.1fs' % (layer, time.time() - t))

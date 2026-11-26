"""blender -b mayne-room_bake.blend --python bake_all.py -- <out_dir> <stage> [stage ...]
stages: mat  (albedo / roughness / metal / normal atlases)
        night practical desklamp day  (lightmap layers, denoised, EXR)"""
import bpy, sys, os, time
argv = sys.argv[sys.argv.index('--') + 1:]
OUT, STAGES = argv[0], argv[1:]
os.makedirs(OUT, exist_ok=True)
LOG = open(os.path.join(OUT, 'bake_log.txt'), 'a')
def log(s):
    line = time.strftime('%H:%M:%S ') + s
    print(line, flush=True); LOG.write(line + '\n'); LOG.flush()

exec(bpy.data.texts['mr_step5.py'].as_string())
scn = bpy.context.scene
scn.cycles.device = 'CPU'; scn.render.use_persistent_data = True
scn.cycles.max_bounces = 6; scn.cycles.diffuse_bounces = 3; scn.cycles.glossy_bounces = 2
scn.cycles.sample_clamp_indirect = 8; scn.cycles.caustics_reflective = False; scn.cycles.caustics_refractive = False
G = lm_objects()
VOBJS = [bpy.data.objects[n] for n in VLIT if n in bpy.data.objects]

def denoise(im, path):
    ng = bpy.data.node_groups.get('_dn') or bpy.data.node_groups.new('_dn', 'CompositorNodeTree')
    ng.nodes.clear()
    if not ng.interface.items_tree: ng.interface.new_socket('Image', in_out='OUTPUT', socket_type='NodeSocketColor')
    ni = ng.nodes.new('CompositorNodeImage'); ni.image = im
    dn = ng.nodes.new('CompositorNodeDenoise'); dn.inputs['HDR'].default_value = True
    go = ng.nodes.new('NodeGroupOutput')
    ng.links.new(ni.outputs['Image'], dn.inputs['Image']); ng.links.new(dn.outputs[0], go.inputs[0])
    scn.compositing_node_group = ng; scn.render.use_compositing = True
    scn.render.resolution_x = im.size[0]; scn.render.resolution_y = im.size[1]; scn.render.resolution_percentage = 100
    vs = scn.view_settings; keep = (vs.view_transform, vs.look, vs.exposure)
    vs.view_transform = 'Standard'; vs.exposure = 0
    s = scn.render.image_settings; s.file_format = 'OPEN_EXR'; s.color_depth = '32'; s.exr_codec = 'ZIP'
    bpy.ops.render.render(); bpy.data.images['Render Result'].save_render(path)
    vs.view_transform, vs.look, vs.exposure = keep

t_all = time.time()
# one process = one stage + one group (or 'vertex'), so memory is released between pieces
ST, GRP = STAGES[0], STAGES[1]
def done(name): return os.path.exists(os.path.join(OUT, name))
if ST == 'mat':
    objs = G[GRP]
    for o in scn.objects:   # surface bakes only need this group's own objects
        if o.type in ('MESH', 'CURVE') and o not in objs: o.hide_render = True
    for kind in ('alb', 'rough', 'metal', 'nrm'):
        if not done('%s_%s.png' % (GRP, kind)): bake_group(GRP, objs, kind, ATLAS[GRP], 4, OUT, log)
else:
    scn.render.use_simplify = True; scn.cycles.texture_limit_render = '512'   # lighting does not need texture detail
    set_layer(ST)
    size, spp = (512, 64) if ST == 'desklamp' else (LM_SIZE, 128)
    if GRP == 'vertex':
        bake_vertex(VOBJS, ST, spp, log); bpy.ops.wm.save_mainfile()
    elif not done('%s_lm_%s.exr' % (GRP, ST)) or os.path.exists(os.path.join(OUT, '%s_lm_%s.raw' % (GRP, ST))):
        im = bake_group(GRP, G[GRP], 'lm_' + ST, size, spp, OUT, log)
        denoise(im, os.path.join(OUT, '%s_lm_%s.exr' % (GRP, ST))); log('DENOISED %s %s' % (GRP, ST))
log('PIECE_DONE %s %s %.1f min' % (ST, GRP, (time.time() - t_all) / 60))

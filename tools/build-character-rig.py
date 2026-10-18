"""Add a small skin rig to a copy of the GLB. Preserve source geometry/UV/images.

Run with the bundled Python (numpy). No Blender installation is needed: the
source already has separate eye surfaces and a continuous, sufficiently dense neck.
"""
import hashlib
import json
import struct
from pathlib import Path
import numpy as np

ROOT = Path(__file__).resolve().parent.parent
SOURCE = ROOT / 'public/models/character.glb'
OUTPUT = ROOT / 'public/models/character-rigged.glb'
raw = SOURCE.read_bytes()
length, kind = struct.unpack_from('<II', raw, 12)
doc = json.loads(raw[20:20 + length])
bin_length, _ = struct.unpack_from('<II', raw, 20 + length)
blob = bytearray(raw[28 + length:28 + length + bin_length])

def accessor(index):
    a = doc['accessors'][index]
    view = doc['bufferViews'][a['bufferView']]
    cols = {'SCALAR': 1, 'VEC2': 2, 'VEC3': 3, 'VEC4': 4, 'MAT4': 16}[a['type']]
    dtype = {5126: '<f4', 5125: '<u4', 5123: '<u2'}[a['componentType']]
    return np.frombuffer(blob, dtype=dtype, count=a['count'] * cols,
                         offset=view.get('byteOffset', 0) + a.get('byteOffset', 0)).reshape(-1, cols).copy()

def append(array, component_type, shape):
    while len(blob) % 4:
        blob.append(0)
    offset = len(blob)
    data = array.tobytes()
    blob.extend(data)
    view = len(doc['bufferViews'])
    doc['bufferViews'].append({'buffer': 0, 'byteOffset': offset, 'byteLength': len(data)})
    index = len(doc['accessors'])
    doc['accessors'].append({'bufferView': view, 'componentType': component_type,
                             'count': len(array), 'type': shape})
    return index

def world(points):
    return np.column_stack([points[:, 0], -points[:, 2], points[:, 1]])

def local(point):
    return [float(point[0]), float(point[2]), float(-point[1])]

def smooth(a, b, values):
    t = np.clip((values - a) / (b - a), 0, 1)
    return t * t * (3 - 2 * t)

# Fit the *existing* curved eyeball fronts, not the eyelid or the flat back.
# The fit gives the physical rotation centers while preserving their original shape.
eye_specs = []
for mesh_id, guess in [(2, (.0585, .5102)), (3, (-.063, .5225))]:
    primitive = doc['meshes'][mesh_id]['primitives'][0]
    vertices = world(accessor(primitive['attributes']['POSITION']))
    normals = world(accessor(primitive['attributes']['NORMAL']))
    ellipse = ((vertices[:, 0] - guess[0]) / .025) ** 2 + ((vertices[:, 1] - guess[1]) / .012) ** 2
    sample = vertices[(normals[:, 2] > .5) & (ellipse < .65)]
    fit = np.linalg.lstsq(np.column_stack([2 * sample, np.ones(len(sample))]),
                          (sample * sample).sum(axis=1), rcond=None)[0]
    center = fit[:3]
    radius = float(np.sqrt(fit[3] + center @ center))
    residual = float(np.sqrt(np.mean((np.linalg.norm(sample - center, axis=1) - radius) ** 2)))
    assert residual / radius < .01, 'Eye surface does not reliably fit a rotation sphere.'
    main = vertices[vertices[:, 0] > 0] if mesh_id == 2 else vertices
    cov = np.cov(main[:, :2].T)
    _, vectors = np.linalg.eigh(cov)
    axis = vectors[:, -1]
    if axis[0] < 0:
        axis = -axis
    eye_specs.append({'mesh': mesh_id, 'center': center.tolist(), 'radius': radius,
                       'fit_rms': residual, 'axis': axis.tolist()})

positions = [np.zeros(3), np.array([0, .275, -.050]), np.array([0, .335, -.035]),
             np.array(eye_specs[0]['center']), np.array(eye_specs[1]['center'])]
base = len(doc['nodes'])
assert base == 4 and not doc.get('skins') and not doc.get('animations')
names = ['CharacterRigRoot', 'Neck', 'Head', 'Eye_L', 'Eye_R']
parents = [-1, 0, 1, 2, 2]
for i, name in enumerate(names):
    node = {'name': name}
    if i == 0:
        node['rotation'] = doc['nodes'][0]['rotation'][:]
    else:
        node['translation'] = local(positions[i] - positions[parents[i]])
    children = [base + j for j, parent in enumerate(parents) if parent == i]
    if children:
        node['children'] = children
    doc['nodes'].append(node)
doc['scenes'][doc.get('scene', 0)]['nodes'].append(base)

inverse_binds = []
for position in positions:
    matrix = np.eye(4, dtype='<f4')
    matrix[:3, 3] = -np.array(local(position))
    inverse_binds.append(matrix.T.reshape(-1))
inverse_accessor = append(np.array(inverse_binds, dtype='<f4'), 5126, 'MAT4')
doc['skins'] = [{'name': 'HeadNeckEyes', 'skeleton': base,
                  'joints': list(range(base, base + 5)), 'inverseBindMatrices': inverse_accessor}]

weight_stats = {}
for mesh_id in [0, 2, 3]:
    primitive = doc['meshes'][mesh_id]['primitives'][0]
    points = world(accessor(primitive['attributes']['POSITION']))
    count = len(points)
    joints = np.zeros((count, 4), dtype='<u2')
    weights = np.zeros((count, 4), dtype='<f4')
    if mesh_id == 0:
        # Fixed neck base -> lower neck -> rigid head. Protect the low, forward
        # jaw/chin from the height-based neck ramp so facial proportions stay rigid.
        neck = smooth(.270, .304, points[:, 1])
        head = smooth(.302, .339, points[:, 1])
        jaw = smooth(.035, .085, points[:, 2]) * smooth(.290, .318, points[:, 1])
        head = np.maximum(head, jaw)
        neck = np.maximum(neck, jaw)
        joints[:, :3] = [0, 1, 2]
        weights[:, 0] = 1 - neck
        weights[:, 1] = neck * (1 - head)
        weights[:, 2] = neck * head
    else:
        # The original lenses include skin/eyelid borders. Bind the curved eye
        # cores to their fitted centers, feathering back to the fixed head at the
        # rim. This retains every source vertex, UV and texel, including eyelids.
        joints[:, :3] = [2, 3, 4]
        influences = []
        for spec in eye_specs:
            delta = points[:, :2] - np.array(spec['center'][:2])
            axis = np.array(spec['axis'])
            u = delta @ axis
            v = delta @ np.array([-axis[1], axis[0]])
            radial = np.sqrt((u / .028) ** 2 + (v / .0123) ** 2)
            influences.append(1 - smooth(.78, .98, radial))
        weights[:, 1] = influences[0]
        weights[:, 2] = influences[1]
        weights[:, 0] = 1 - weights[:, 1] - weights[:, 2]
    assert np.all(weights >= 0) and np.allclose(weights.sum(axis=1), 1, atol=1e-6)
    primitive['attributes']['JOINTS_0'] = append(joints, 5123, 'VEC4')
    primitive['attributes']['WEIGHTS_0'] = append(weights, 5126, 'VEC4')
    doc['nodes'][mesh_id]['skin'] = 0
    weight_stats['part_' + str(mesh_id)] = [int((weights[:, i] > .001).sum()) for i in range(4)]

doc.setdefault('asset', {})['extras'] = {'source_sha256': hashlib.sha256(raw).hexdigest(),
    'rig_method': 'Original geometry and textures; fixed base, blended neck/head, fitted eye cores and fixed eyelid rims.'}
doc['buffers'][0]['byteLength'] = len(blob)
json_bytes = json.dumps(doc, separators=(',', ':'), ensure_ascii=False).encode('utf-8')
json_bytes += b' ' * (-len(json_bytes) % 4)
blob.extend(b'\0' * (-len(blob) % 4))
output = struct.pack('<III', 0x46546c67, 2, 12 + 8 + len(json_bytes) + 8 + len(blob))
output += struct.pack('<II', len(json_bytes), 0x4e4f534a) + json_bytes
output += struct.pack('<II', len(blob), 0x004e4942) + blob
OUTPUT.write_bytes(output)
report = {'source_sha256': hashlib.sha256(raw).hexdigest(), 'output_sha256': hashlib.sha256(output).hexdigest(),
           'output_bytes': len(output), 'eyes': eye_specs, 'weights_nonzero': weight_stats,
           'joints': names, 'base_geometry_unchanged': True, 'materials_and_images_unchanged': True}
(ROOT / 'verification').mkdir(exist_ok=True)
(ROOT / 'verification/rig-build.json').write_text(json.dumps(report, indent=2), encoding='utf-8')
print(json.dumps(report, indent=2))

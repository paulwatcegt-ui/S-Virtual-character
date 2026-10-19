import {Bone, Box3, Float32BufferAttribute, Matrix3, Matrix4, Skeleton, SkinnedMesh, Uint16BufferAttribute, Vector3, Vector4} from 'three';
import {MODEL_CONFIG as config} from './model-config.mjs';

const smooth = (a, b, value) => {
  const t = Math.max(0, Math.min(1, (value - a) / (b - a)));
  return t * t * (3 - 2 * t);
};

// Refit centers and eyelid axes from the NEW decoded surfaces. Configuration
// centers only select a search region, rather than assuming the old eye pivot.
function fitEye(mesh, region, rightSideOnly) {
  const point = new Vector3(), normal = new Vector3();
  const normalMatrix = new Matrix3().getNormalMatrix(mesh.matrixWorld);
  const positions = mesh.geometry.attributes.position, normals = mesh.geometry.attributes.normal;
  const samples = [], outline = [];
  for (let i = 0; i < positions.count; i++) {
    point.fromBufferAttribute(positions, i).applyMatrix4(mesh.matrixWorld);
    normal.fromBufferAttribute(normals, i).applyNormalMatrix(normalMatrix);
    if (!rightSideOnly || point.x > 0) outline.push([point.x, point.y]);
    if (normal.z > .5 && ((point.x - region.center[0]) / .025) ** 2 + ((point.y - region.center[1]) / .012) ** 2 < .65) samples.push(point.clone());
  }
  if (samples.length < 20) throw Error('Not enough eye surface samples');
  const matrix = new Array(16).fill(0), rhs = new Array(4).fill(0);
  for (const p of samples) {
    const row = [2 * p.x, 2 * p.y, 2 * p.z, 1], length = p.lengthSq();
    for (let i = 0; i < 4; i++) {
      rhs[i] += row[i] * length;
      for (let j = 0; j < 4; j++) matrix[i * 4 + j] += row[i] * row[j];
    }
  }
  const fitted = new Vector4(...rhs).applyMatrix4(new Matrix4().fromArray(matrix).invert());
  const center = new Vector3(fitted.x, fitted.y, fitted.z);
  const radius = Math.sqrt(fitted.w + center.lengthSq());
  const rms = Math.sqrt(samples.reduce((sum, p) => sum + (p.distanceTo(center) - radius) ** 2, 0) / samples.length);
  if (!Number.isFinite(radius) || radius < .02 || radius > .04 || rms / radius > .01) throw Error('New eye surface cannot safely use spherical tracking');
  const mean = outline.reduce((sum, p) => [sum[0] + p[0], sum[1] + p[1]], [0, 0]).map(v => v / outline.length);
  let xx = 0, xy = 0, yy = 0;
  for (const p of outline) {const x = p[0] - mean[0], y = p[1] - mean[1]; xx += x * x; xy += x * y; yy += y * y;}
  const angle = .5 * Math.atan2(2 * xy, xx - yy);
  return {center: center.toArray(), axis: [Math.cos(angle), Math.sin(angle)], radius, rms};
}

// Preserve decoded POSITION/NORMAL/UV/index buffers, materials and node transforms.
// Only add skin attributes; inverse binds include each mesh's quantization transform.
export function prepareCharacter(model) {
  if (model.getObjectByName(config.bones[0])) return;
  model.updateMatrixWorld(true);
  const names = [config.nodes.head, config.nodes.body, ...config.nodes.eyes];
  const meshes = names.map(name => model.getObjectByName(name));
  if (!meshes.every(mesh => mesh?.isMesh && !mesh.isSkinnedMesh)) throw Error('Unexpected optimized character structure');
  const bounds = new Box3().setFromObject(model);
  // Inspection confirmed this asset retains the original world-space dimensions.
  if (Math.abs(bounds.min.y) > .01 || Math.abs(bounds.max.y - .84367) > .01) throw Error('Character dimensions differ from the inspected binding');
  const eyes = config.eyes.map((region, i) => fitEye(meshes[i + 2], region, i === 0));
  model.userData.eyeFit = eyes;
  const points = [new Vector3(), new Vector3(...config.neck), new Vector3(...config.head), ...eyes.map(eye => new Vector3(...eye.center))];
  const parents = [-1, 0, 1, 2, 2];
  const bones = points.map((point, i) => {
    const bone = new Bone();
    bone.name = config.bones[i];
    bone.position.copy(point);
    if (parents[i] >= 0) bone.position.sub(points[parents[i]]);
    return bone;
  });
  model.add(bones[0]);
  bones.forEach((bone, i) => {if (parents[i] >= 0) bones[parents[i]].add(bone);});
  model.updateMatrixWorld(true);
  const skeleton = new Skeleton(bones);
  skeleton.calculateInverses();
  const point = new Vector3();
  for (const mesh of [meshes[0], meshes[2], meshes[3]]) {
    const count = mesh.geometry.attributes.position.count;
    const joints = new Uint16Array(count * 4);
    const weights = new Float32Array(count * 4);
    for (let i = 0; i < count; i++) {
      point.fromBufferAttribute(mesh.geometry.attributes.position, i).applyMatrix4(mesh.matrixWorld);
      const j = i * 4;
      if (mesh === meshes[0]) {
        const jaw = smooth(.035, .085, point.z) * smooth(.290, .318, point.y);
        const neck = Math.max(smooth(.270, .304, point.y), jaw);
        const head = Math.max(smooth(.302, .339, point.y), jaw);
        joints.set([0, 1, 2, 0], j);
        weights.set([1 - neck, neck * (1 - head), neck * head, 0], j);
      } else {
        let sum = 0;
        eyes.forEach((eye, e) => {
          const dx = point.x - eye.center[0], dy = point.y - eye.center[1];
          const u = dx * eye.axis[0] + dy * eye.axis[1];
          const v = -dx * eye.axis[1] + dy * eye.axis[0];
          const influence = 1 - smooth(.78, .98, Math.hypot(u / .028, v / .0123));
          weights[j + 1 + e] = influence;
          sum += influence;
        });
        joints.set([2, 3, 4, 0], j);
        weights[j] = 1 - sum;
      }
    }
    mesh.geometry.setAttribute('skinIndex', new Uint16BufferAttribute(joints, 4));
    mesh.geometry.setAttribute('skinWeight', new Float32BufferAttribute(weights, 4));
    const replacement = new SkinnedMesh(mesh.geometry, mesh.material);
    replacement.name = mesh.name;
    replacement.position.copy(mesh.position);
    replacement.quaternion.copy(mesh.quaternion);
    replacement.scale.copy(mesh.scale);
    replacement.userData = mesh.userData;
    replacement.castShadow = mesh.castShadow;
    replacement.receiveShadow = mesh.receiveShadow;
    const parent = mesh.parent;
    parent.remove(mesh);
    parent.add(replacement);
    replacement.updateMatrixWorld(true);
    replacement.bind(skeleton, replacement.matrixWorld);
    replacement.frustumCulled = false;
  }
}

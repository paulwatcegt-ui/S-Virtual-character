import {test} from 'node:test';
import assert from 'node:assert/strict';
import {readFile} from 'node:fs/promises';
import {createHash} from 'node:crypto';
import * as THREE from 'three';
import {GLTFLoader} from 'three/addons/loaders/GLTFLoader.js';
import {createHeadRig, applyHeadPose, updateHeadRig} from '../src/character-rig.mjs';
import {LIMITS} from '../src/character-motion.mjs';

const source = await readFile(new URL('../public/models/character.glb', import.meta.url));
const derived = await readFile(new URL('../public/models/character-rigged.glb', import.meta.url));
function parse(bytes) {
  const length = bytes.readUInt32LE(12);
  return {json: JSON.parse(bytes.subarray(20, 20 + length).toString()), binary: bytes.subarray(28 + length)};
}
const loader = new GLTFLoader();
loader.register(() => ({name: 'TestTextureDecoder', loadTexture: () => Promise.resolve(new THREE.Texture())}));
const gltf = await loader.parseAsync(derived.buffer.slice(derived.byteOffset, derived.byteOffset + derived.byteLength), '');
const rig = createHeadRig(gltf.scene);
assert.ok(rig);
const position = (mesh, index, skinned = true) => {
  const point = skinned ? mesh.getVertexPosition(index, new THREE.Vector3()) : new THREE.Vector3().fromBufferAttribute(mesh.geometry.attributes.position, index);
  return point.applyMatrix4(mesh.matrixWorld);
};
function update() {gltf.scene.updateMatrixWorld(true); rig.surfaces.forEach(mesh => mesh.skeleton.update());}

test('source GLB and all original geometry, UVs, materials and images are preserved', () => {
  assert.equal(createHash('sha256').update(source).digest('hex'), '46a2344d8d33661fd4e8ea51bb8e49eb5fca4f9293787ffd7a5a7e5cb1c8f271');
  const a = parse(source), b = parse(derived);
  assert.deepEqual(b.binary.subarray(0, a.binary.length), a.binary);
  assert.deepEqual(b.json.materials, a.json.materials);
  assert.deepEqual(b.json.images, a.json.images);
  assert.equal(b.json.skins.length, 1);
  assert.equal(b.json.skins[0].joints.length, 5);
  assert.equal(gltf.animations.length, 0);
  for (let i = 0; i < 4; i++) {
    const aPrimitive = a.json.meshes[i].primitives[0], bPrimitive = b.json.meshes[i].primitives[0];
    for (const key of Object.keys(aPrimitive.attributes)) assert.equal(bPrimitive.attributes[key], aPrimitive.attributes[key]);
    assert.equal(bPrimitive.indices, aPrimitive.indices);
  }
});

test('bind pose keeps the rendered surface at its original location', () => {
  applyHeadPose(rig, 0, 0); update();
  for (const mesh of rig.surfaces) {
    const weights = mesh.geometry.attributes.skinWeight;
    for (let i = 0; i < weights.count; i += 7) {
      assert.ok(Math.abs(weights.getX(i) + weights.getY(i) + weights.getZ(i) + weights.getW(i) - 1) < 1e-6);
      assert.ok(position(mesh, i).distanceTo(position(mesh, i, false)) < 5e-7);
    }
  }
});

test('nine extreme poses: torso and neck base stay fixed, face remains rigid, bone positions never slide', () => {
  applyHeadPose(rig, 0, 0); update();
  const body = rig.body.matrixWorld.clone();
  const bones = [rig.root, rig.neck, rig.head, ...rig.eyes];
  const bindPositions = bones.map(bone => bone.position.clone());
  const mesh = rig.surfaces[0], joints = mesh.geometry.attributes.skinIndex, weights = mesh.geometry.attributes.skinWeight;
  const anchored = [], face = [];
  for (let i = 0; i < weights.count; i += 11) {
    if (joints.getX(i) === 0 && weights.getX(i) > .999999) anchored.push([i, position(mesh, i)]);
    if (weights.getZ(i) > .999999 && face.length < 80) face.push([i, position(mesh, i)]);
  }
  assert.ok(anchored.length > 500 && face.length > 30);
  for (const yaw of [-LIMITS.yaw, 0, LIMITS.yaw]) for (const pitch of [-LIMITS.pitch, 0, LIMITS.pitch]) {
    applyHeadPose(rig, yaw, pitch); update();
    assert.deepEqual(rig.body.matrixWorld.elements, body.elements);
    bones.forEach((bone, i) => assert.ok(bone.position.distanceTo(bindPositions[i]) < 1e-12));
    for (const [i, original] of anchored) assert.ok(position(mesh, i).distanceTo(original) < 5e-7);
    for (let i = 1; i < face.length; i++) {
      const restDistance = face[0][1].distanceTo(face[i][1]);
      assert.ok(Math.abs(position(mesh, face[0][0]).distanceTo(position(mesh, face[i][0])) - restDistance) < 5e-7);
    }
  }
});

test('eye cores move independently while eyelid rims remain fixed to the head', () => {
  applyHeadPose(rig, 0, 0); update();
  const samples = rig.surfaces.slice(1).map(mesh => {
    const w = mesh.geometry.attributes.skinWeight, rim = [], core = [];
    for (let i = 0; i < w.count; i += 5) {
      if (w.getX(i) > .999999) rim.push([i, position(mesh, i)]);
      if (w.getY(i) + w.getZ(i) > .999999) core.push([i, position(mesh, i)]);
    }
    assert.ok(rim.length > 300 && core.length > 200);
    return {mesh, rim, core};
  });
  for (const yaw of [-LIMITS.eyeYaw, LIMITS.eyeYaw]) for (const pitch of [-LIMITS.eyePitch, LIMITS.eyePitch]) {
    applyHeadPose(rig, 0, 0, yaw, pitch); update();
    for (const {mesh, rim, core} of samples) {
      for (const [i, original] of rim) assert.ok(position(mesh, i).distanceTo(original) < 5e-7);
      assert.ok(core.some(([i, original]) => position(mesh, i).distanceTo(original) > .001));
    }
    assert.ok(rig.eyes[0].quaternion.angleTo(rig.eyes[1].quaternion) < 1e-7);
  }
});

test('eyes lead the head, rapid reversals remain bounded, and all joints return smoothly', () => {
  applyHeadPose(rig, 0, 0);
  let pose;
  for (let i = 0; i < 6; i++) pose = updateHeadRig(rig, {yaw: LIMITS.yaw, pitch: 0}, 1 / 60);
  assert.ok(pose.eyeYaw / LIMITS.eyeYaw > pose.yaw / LIMITS.yaw);
  for (let i = 0; i < 600; i++) {
    const sign = Math.floor(i / 5) % 2 ? -1 : 1;
    pose = updateHeadRig(rig, {yaw: sign * LIMITS.yaw, pitch: sign * LIMITS.pitch}, 1 / 60);
    assert.ok(Math.abs(pose.yaw) <= LIMITS.yaw + .0005);
    assert.ok(Math.abs(pose.pitch) <= LIMITS.pitch + .0005);
    assert.ok(Math.abs(pose.eyeYaw) <= LIMITS.eyeYaw + .0005);
    assert.ok(Math.abs(pose.eyePitch) <= LIMITS.eyePitch + .0005);
    for (const bone of [rig.neck, rig.head, ...rig.eyes]) assert.ok(Math.abs(bone.quaternion.length() - 1) < 1e-10);
  }
  for (let i = 0; i < 300; i++) pose = updateHeadRig(rig, {yaw: 0, pitch: 0}, 1 / 60);
  for (const value of Object.values(pose)) assert.ok(Math.abs(value) < .00001);
});

test('head settles promptly after a step and stopped input, with slower page-exit return', () => {
  applyHeadPose(rig, 0, 0);
  let pose;
  for (let i = 0; i < 20; i++) pose = updateHeadRig(rig, {yaw: LIMITS.yaw, pitch: 0}, 1 / 60);
  assert.ok(pose.yaw >= LIMITS.yaw * .9, '90% step response must take no more than 1/3 second');
  for (let i = 0; i < 60; i++) pose = updateHeadRig(rig, {yaw: LIMITS.yaw, pitch: 0}, 1 / 60);
  assert.ok(Math.abs(pose.yaw - LIMITS.yaw) < .0001);
  applyHeadPose(rig, LIMITS.yaw, 0);
  const activeReturn = updateHeadRig(rig, {yaw: 0, pitch: 0}, 1 / 60, true).yaw;
  applyHeadPose(rig, LIMITS.yaw, 0);
  const exitReturn = updateHeadRig(rig, {yaw: 0, pitch: 0}, 1 / 60, false).yaw;
  assert.ok(exitReturn > activeReturn && exitReturn < LIMITS.yaw);
  for (let i = 0; i < 300; i++) pose = updateHeadRig(rig, {yaw: 0, pitch: 0}, 1 / 60, false);
  assert.ok(Math.abs(pose.yaw) < .00001);
});

test('head/neck step response is independent of display refresh rate', () => {
  const simulate = fps => {
    applyHeadPose(rig, 0, 0);
    let pose;
    for (let i = 0; i < fps / 2; i++) pose = updateHeadRig(rig, {yaw: LIMITS.yaw, pitch: LIMITS.pitch}, 1 / fps);
    return pose;
  };
  const low = simulate(30), high = simulate(144);
  // Quaternion.slerp uses a normalized linear fallback for very small angles.
  // One microradian is well below a visible/pixel-scale difference here.
  assert.ok(Math.abs(low.yaw - high.yaw) < 1e-6);
  assert.ok(Math.abs(low.pitch - high.pitch) < 1e-6);
  assert.ok(Math.abs(low.eyeYaw - high.eyeYaw) < .003);
});

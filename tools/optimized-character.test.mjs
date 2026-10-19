import {test} from 'node:test';
import assert from 'node:assert/strict';
import {readFile} from 'node:fs/promises';
import {createHash} from 'node:crypto';
import * as THREE from 'three';
import {GLTFLoader} from 'three/addons/loaders/GLTFLoader.js';
import {MeshoptDecoder} from 'three/addons/libs/meshopt_decoder.module.js';
import {prepareCharacter} from '../src/prepare-character.mjs';
import {createHeadRig, applyHeadPose, updateHeadRig} from '../src/character-rig.mjs';
import {MODEL_CONFIG} from '../src/model-config.mjs';
import {LIMITS} from '../src/character-motion.mjs';

const bytes = await readFile(`public/models/${MODEL_CONFIG.file}`);
const loader = new GLTFLoader().setMeshoptDecoder(MeshoptDecoder);
// Node tests inspect geometry; real WebP decoding is covered in Chrome.
loader.register(parser => {
  parser.loadTextureImage = () => Promise.resolve(new THREE.Texture());
  return {name: 'TestTextureDecoder'};
});
const gltf = await loader.parseAsync(bytes.buffer.slice(bytes.byteOffset, bytes.byteOffset + bytes.byteLength), '');
gltf.scene.updateMatrixWorld(true);
const original = new Map();
gltf.scene.traverse(mesh => {
  if (!mesh.isMesh) return;
  original.set(mesh.name, {geometry: mesh.geometry, material: mesh.material, matrix: mesh.matrixWorld.clone(),
    attributes: {...mesh.geometry.attributes}, index: mesh.geometry.index});
});
prepareCharacter(gltf.scene);
const rig = createHeadRig(gltf.scene);
assert.ok(rig);
const update = () => {gltf.scene.updateMatrixWorld(true); rig.surfaces[0].skeleton.update();};
const world = (mesh, i) => mesh.getVertexPosition(i, new THREE.Vector3()).applyMatrix4(mesh.matrixWorld);

test('new compressed GLB remains byte-identical; decoded geometry, transforms and materials stay intact', () => {
  assert.equal(createHash('sha256').update(bytes).digest('hex'), '3f00472ff065feb1f3ee7533d13fb0f9e932ccd15357fdd19b001c29ef958724');
  assert.equal(gltf.animations.length, 0);
  applyHeadPose(rig, 0, 0); update();
  for (const [name, old] of original) {
    const mesh = gltf.scene.getObjectByName(name);
    assert.equal(mesh.material, old.material);
    assert.equal(mesh.geometry.index, old.index);
    assert.deepEqual(mesh.matrixWorld.elements, old.matrix.elements);
    for (const [key, attribute] of Object.entries(old.attributes)) assert.equal(mesh.geometry.attributes[key], attribute);
    for (let i = 0; i < old.attributes.position.count; i += 37) {
      const rest = new THREE.Vector3().fromBufferAttribute(old.attributes.position, i).applyMatrix4(old.matrix);
      assert.ok(world(mesh, i).distanceTo(rest) < 1e-6, `${name} bind pose`);
    }
  }
});

test('nine extreme poses preserve torso, neck base, rigid face and bone translations', () => {
  applyHeadPose(rig, 0, 0); update();
  const mesh = rig.surfaces[0], attr = mesh.geometry.attributes;
  const anchored = [], face = [];
  for (let i = 0; i < attr.position.count; i += 17) {
    if (attr.skinWeight.getX(i) > .99999) anchored.push([i, world(mesh, i)]);
    if (attr.skinWeight.getZ(i) > .99999 && face.length < 80) face.push([i, world(mesh, i)]);
  }
  assert.ok(anchored.length > 50 && face.length > 30);
  const body = rig.body.matrixWorld.clone();
  const bones = [rig.root, rig.neck, rig.head, ...rig.eyes];
  const translations = bones.map(b => b.position.clone());
  for (const yaw of [-LIMITS.yaw, 0, LIMITS.yaw]) for (const pitch of [-LIMITS.pitch, 0, LIMITS.pitch]) {
    applyHeadPose(rig, yaw, pitch); update();
    assert.deepEqual(rig.body.matrixWorld.elements, body.elements);
    bones.forEach((b, i) => assert.ok(b.position.distanceTo(translations[i]) < 1e-12));
    for (const [i, rest] of anchored) assert.ok(world(mesh, i).distanceTo(rest) < 1e-6);
    for (const [i, rest] of face) assert.ok(Math.abs(world(mesh, i).distanceTo(world(mesh, face[0][0])) - rest.distanceTo(face[0][1])) < 1e-6);
  }
});

test('both eyes move while eyelid rims remain still; rapid input stays bounded and returns to rest', () => {
  applyHeadPose(rig, 0, 0); update();
  const eyes = rig.surfaces.slice(1).map(mesh => {
    const core = [], rim = [], w = mesh.geometry.attributes.skinWeight;
    for (let i = 0; i < w.count; i += 7) {
      if (w.getX(i) > .99999) rim.push([i, world(mesh, i)]);
      if (w.getY(i) + w.getZ(i) > .99999) core.push([i, world(mesh, i)]);
    }
    assert.ok(core.length > 20 && rim.length > 20);
    return {mesh, core, rim};
  });
  for (const yaw of [-LIMITS.eyeYaw, LIMITS.eyeYaw]) for (const pitch of [-LIMITS.eyePitch, LIMITS.eyePitch]) {
    applyHeadPose(rig, 0, 0, yaw, pitch); update();
    for (const {mesh, core, rim} of eyes) {
      assert.ok(core.some(([i, rest]) => world(mesh, i).distanceTo(rest) > .001));
      rim.forEach(([i, rest]) => assert.ok(world(mesh, i).distanceTo(rest) < 1e-6));
    }
  }
  applyHeadPose(rig, 0, 0);
  for (let i = 0; i < 6; i++) updateHeadRig(rig, {yaw: LIMITS.yaw, pitch: 0}, 1 / 60);
  assert.ok(rig.pose.eyeYaw / LIMITS.eyeYaw > rig.pose.yaw / LIMITS.yaw);
  for (let i = 0; i < 600; i++) {
    const sign = i % 10 < 5 ? -1 : 1;
    const pose = updateHeadRig(rig, {yaw: sign * LIMITS.yaw, pitch: sign * LIMITS.pitch}, 1 / 60);
    for (const key of ['yaw', 'pitch', 'eyeYaw', 'eyePitch']) assert.ok(Math.abs(pose[key]) <= LIMITS[key] + .0005);
  }
  for (let i = 0; i < 360; i++) updateHeadRig(rig, {yaw: 0, pitch: 0}, 1 / 60, false);
  Object.values(rig.pose).forEach(value => assert.ok(Math.abs(value) < .00001));
});

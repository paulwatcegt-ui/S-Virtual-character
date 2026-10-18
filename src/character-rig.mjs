import {Euler, MathUtils, Quaternion} from 'three';
import {FOLLOW_CONFIG, LIMITS, dampingAlpha} from './character-motion.mjs';

const IDENTITY = new Quaternion();

export function createHeadRig(model) {
  const names = ['CharacterRigRoot', 'Neck', 'Head', 'Eye_L', 'Eye_R'];
  const [root, neck, head, leftEye, rightEye] = names.map(name => model.getObjectByName(name));
  const body = model.getObjectByName('part_1');
  if (![root, neck, head, leftEye, rightEye].every(bone => bone?.isBone) || !body) return null;
  const surfaces = ['part_0', 'part_2', 'part_3'].map(name => model.getObjectByName(name));
  if (!surfaces.every(mesh => mesh?.isSkinnedMesh)) return null;
  surfaces.forEach(mesh => {mesh.frustumCulled = false;});
  // The +90 degree X import basis maps local -Z to world up.
  const frame = root.quaternion.clone().normalize();
  return {model, root, neck, head, eyes: [leftEye, rightEye], surfaces, body,
    frame, inverseFrame: frame.clone().invert(),
    scratch: {full: new Quaternion(), fraction: new Quaternion(), local: new Quaternion(),
      headWorld: new Quaternion(), gaze: new Quaternion(), relative: new Quaternion(),
      euler: new Euler(0, 0, 0, 'YXZ')}};
}

function toLocal(rig, rotation, result) {
  return result.copy(rig.inverseFrame).multiply(rotation).multiply(rig.frame);
}

// Deterministic inspection/test entry point. Bone translations retain bind values.
export function applyHeadPose(rig, yaw, pitch, eyeYaw = 0, eyePitch = 0) {
  const {full, fraction, local, euler} = rig.scratch;
  full.setFromEuler(euler.set(pitch, yaw, 0, 'YXZ'));
  fraction.copy(IDENTITY).slerp(full, .3);
  rig.neck.quaternion.copy(toLocal(rig, fraction, local));
  fraction.copy(IDENTITY).slerp(full, .7);
  rig.head.quaternion.copy(toLocal(rig, fraction, local));
  full.setFromEuler(euler.set(eyePitch, eyeYaw, 0, 'YXZ'));
  toLocal(rig, full, local);
  rig.eyes.forEach(eye => eye.quaternion.copy(local));
}

export function updateHeadRig(rig, target, delta, active = true) {
  const {full, fraction, local, headWorld, gaze, relative, euler} = rig.scratch;
  const tau = active ? FOLLOW_CONFIG.tau : FOLLOW_CONFIG.returnTau;
  // Read the newest target directly: exactly one time-based damping stage per joint.
  full.setFromEuler(euler.set(target.pitch, target.yaw, 0, 'YXZ'));
  fraction.copy(IDENTITY).slerp(full, .3);
  rig.neck.quaternion.slerp(toLocal(rig, fraction, local), dampingAlpha(delta, tau.neck)).normalize();
  fraction.copy(IDENTITY).slerp(full, .7);
  rig.head.quaternion.slerp(toLocal(rig, fraction, local), dampingAlpha(delta, tau.head)).normalize();
  headWorld.copy(rig.frame).multiply(rig.neck.quaternion).multiply(rig.head.quaternion).multiply(rig.inverseFrame);
  // Subtract the current head pose so gaze is not applied twice as the head catches up.
  gaze.setFromEuler(euler.set(target.pitch * 1.12, target.yaw * 1.12, 0, 'YXZ'));
  relative.copy(headWorld).invert().multiply(gaze);
  euler.setFromQuaternion(relative, 'YXZ');
  const eyePitch = MathUtils.clamp(euler.x, -LIMITS.eyePitch, LIMITS.eyePitch);
  const eyeYaw = MathUtils.clamp(euler.y, -LIMITS.eyeYaw, LIMITS.eyeYaw);
  full.setFromEuler(euler.set(eyePitch, eyeYaw, 0, 'YXZ'));
  toLocal(rig, full, local);
  rig.eyes.forEach(eye => eye.quaternion.slerp(local, dampingAlpha(delta, tau.eyes)).normalize());
  euler.setFromQuaternion(headWorld, 'YXZ');
  const pose = {yaw: euler.y, pitch: euler.x};
  relative.copy(rig.frame).multiply(rig.eyes[0].quaternion).multiply(rig.inverseFrame);
  euler.setFromQuaternion(relative, 'YXZ');
  return {...pose, eyeYaw: euler.y, eyePitch: euler.x};
}

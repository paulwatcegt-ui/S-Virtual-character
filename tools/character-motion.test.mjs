import {test} from 'node:test';
import assert from 'node:assert/strict';
import {FOLLOW_CONFIG, LIMITS, dampAngle, targetAngles} from '../src/character-motion.mjs';

test('pointer direction, limits, and leaving the interaction region', () => {
  assert.deepEqual(targetAngles(0, 0, true), {yaw: 0, pitch: 0});
  assert.deepEqual(targetAngles(10, -10, true), {yaw: LIMITS.yaw, pitch: -LIMITS.pitch});
  assert.deepEqual(targetAngles(-10, 10, true), {yaw: -LIMITS.yaw, pitch: LIMITS.pitch});
  assert.deepEqual(targetAngles(1, 1, false), {yaw: 0, pitch: 0});
});

test('small inputs receive higher gain with no dead zone or early saturation', () => {
  assert.equal(FOLLOW_CONFIG.deadZone, 0);
  const gain = targetAngles(.001, 0, true).yaw / (LIMITS.yaw * .001);
  assert.ok(gain >= 1.5 && gain <= 2);
  let previous = -Infinity;
  for (const x of [-1, -.9, -.5, -.01, -.001, 0, .001, .01, .5, .9, .99, 1]) {
    const value = targetAngles(x, 0, true).yaw;
    assert.ok(value > previous);
    assert.ok(Math.abs(value) <= LIMITS.yaw);
    assert.ok(Math.abs(value + targetAngles(-x, 0, true).yaw) < 1e-12);
    previous = value;
  }
});

test('damping is smooth, bounded, frame-rate independent, and returns to rest', () => {
  const simulate = fps => {
    let angle = 0;
    for (let i = 0; i < fps; i++) {
      const next = dampAngle(angle, LIMITS.yaw, 1 / fps);
      assert.ok(next > angle && next < LIMITS.yaw);
      angle = next;
    }
    return angle;
  };
  assert.ok(Math.abs(simulate(30) - simulate(144)) < 1e-10);
  assert.ok(dampAngle(0, LIMITS.yaw, 1 / 60) < LIMITS.yaw / 10);
  let angle = LIMITS.yaw;
  for (let i = 0; i < 180; i++) angle = dampAngle(angle, 0, 1 / 60);
  assert.ok(Math.abs(angle) < 0.00001);
  assert.ok(dampAngle(0, LIMITS.yaw, 10) < LIMITS.yaw / 5);
});

// Central tuning parameters. Time constants are seconds (smaller = faster).
// These are code defaults; production does not display a tuning panel.
export const FOLLOW_CONFIG = Object.freeze({
  sensitivity: 1.75,
  deadZone: 0, // Normalized pointer distance, 0 disables the dead zone.
  tau: Object.freeze({eyes: 0.08, head: 0.12, neck: 0.18}),
  returnTau: Object.freeze({eyes: 0.24, head: 0.38, neck: 0.46}),
  maxDegrees: Object.freeze({yaw: 15, pitch: 8, eyeYaw: 6, eyePitch: 4}),
  maxFrameDelta: 0.05,
});
export const LIMITS = Object.freeze(Object.fromEntries(
  Object.entries(FOLLOW_CONFIG.maxDegrees).map(([name, degrees]) => [name, degrees * Math.PI / 180]),
));

export function dampingAlpha(delta, tau) {
  return -Math.expm1(-Math.max(0, Math.min(delta, FOLLOW_CONFIG.maxFrameDelta)) / tau);
}

// Exponential damping uses elapsed seconds, so motion feels the same at any FPS.
export function dampAngle(current, target, delta, response = 3.6) {
  return current + (target - current) * dampingAlpha(delta, 1 / response);
}

export function targetAngles(x, y, active) {
  const clamp = value => Math.max(-1, Math.min(1, value));
  const map = value => {
    const magnitude = Math.abs(clamp(value));
    if (magnitude <= FOLLOW_CONFIG.deadZone) return 0;
    const normalized = (magnitude - FOLLOW_CONFIG.deadZone) / (1 - FOLLOW_CONFIG.deadZone);
    // Smooth gain avoids an early hard-clamp plateau with no response near edges.
    return Math.sign(value) * Math.tanh(FOLLOW_CONFIG.sensitivity * normalized) / Math.tanh(FOLLOW_CONFIG.sensitivity);
  };
  return active
    ? {yaw: map(x) * LIMITS.yaw, pitch: map(y) * LIMITS.pitch}
    : {yaw: 0, pitch: 0};
}

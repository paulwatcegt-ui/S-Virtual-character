// This binding is for the inspected optimized GLB, not arbitrary humanoids.
export const MODEL_CONFIG = Object.freeze({
  file: 'character-optimized.glb',
  nodes: {head: 'part_0', body: 'part_1', eyes: ['part_2', 'part_3']},
  bones: ['CharacterRigRoot', 'Neck', 'Head', 'Eye_L', 'Eye_R'],
  framing: {heightRatio: .88 / .843648, centerRatio: .45 / .843648, desktopX: .70, mobileX: .65},
  neck: [0, .275, -.05], head: [0, .335, -.035],
  eyes: [
    {center: [.0573868366, .5100356841, .1332360258], axis: [1, 0]},
    {center: [-.0623485841, .5214974431, .1358288139], axis: [1, 0]},
  ],
});

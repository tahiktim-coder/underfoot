// UNDERFOOT — looks. The same town, giant and lantern under different treatments: palette (up to 8 neutral
// steps and 4 hue ramps), how the snap dithers, the light and fog, how dark it gets when the cloud comes,
// sky details (stars, a bigger sun or moon), snow, particles, bloom and post. game.setLook(name) applies one.
const nrm = (a) => { const l = Math.hypot(a[0], a[1], a[2]); return [a[0] / l, a[1] / l, a[2] / l]; };

const BASE_DIM = { sun: 0.8, sky: 0.25, gnd: 0.6, fog: 0.36, fogSun: 0.15, exp: 0.22 };

export const LOOKS = {
  // the reference: Volume 16 as published
  ashwake: {
    name: 'Ashwake grey', short: 'Ashwake grey',
    note: 'The Volume 16 look: warm greys, four dull ramps, one warm light. Dust-pale ground, dark roofs.',
    light: { sun: nrm([-0.94, 0.2, -0.27]), sunCol: [2.5, 2.15, 1.75], skyCol: [0.4, 0.43, 0.5], gndCol: [0.25, 0.23, 0.2], fogCol: [0.47, 0.49, 0.53], fogSunCol: [0.9, 0.8, 0.66], fogA: 1 / 9000, fogB: 1 / 1300, exposure: 1.2, lanCol: [1.0, 0.7, 0.4] },
    dimK: BASE_DIM,
    palette: {
      greys: ['#0f0e10', '#1f1d20', '#34313a', '#4d494c', '#6b6667', '#8e8884', '#b5aea6', '#dfd9cf'],
      hues: [['#2a2118', '#4b3b29', '#725b3d', '#9f8151', '#cfaa69'], ['#1d231c', '#303a2c', '#4a5741', '#6a7757', '#8f9a74'], ['#1a2028', '#2d3542', '#465161', '#697482', '#919ba7'], ['#281917', '#442824', '#653e34', '#88584a', '#ab7966']],
    },
    chroma: [0.05, 0.14], contrast: 1.05, dither: 0, bloom: 0, stars: 0, sunSize: 1, sunDisc: 1.4, snow: 0,
    ash: { amount: 0.45, lum: 0.7, fall: 1 }, grain: 0.045, vignette: 0.4, tilt: 0, winMin: 0, lanI: 1.5, cloudCov: 0,
    player: { coat: [0.16, 0.16, 0.18], hood: [0.14, 0.14, 0.16], scarf: [0.55, 0.2, 0.13] },
    ui: { text: '#dfd9cf', dim: '#b5aea6', accent: '#cfaa69', title: '#1f1d20', sub: '#34313a', plate: 'rgba(15,14,16,0.82)', edge: '#6b6667' },
  },

  // night: the moon low behind it, the lantern and a few windows the only warm light
  night: {
    name: 'Night lantern', short: 'Night',
    note: 'Moonlit blue-blacks. The lantern and the windows are the only warm colour, so light and shadow read at a glance; the giant is a silhouette with a cold rim.',
    light: { sun: nrm([-0.94, 0.36, -0.27]), sunCol: [0.7, 0.8, 1.15], skyCol: [0.08, 0.1, 0.17], gndCol: [0.03, 0.035, 0.05], fogCol: [0.05, 0.062, 0.1], fogSunCol: [0.2, 0.25, 0.38], fogA: 1 / 7000, fogB: 1 / 1100, exposure: 2.2, lanCol: [1.0, 0.62, 0.3] },
    dimK: { sun: 0.35, sky: 0.15, gnd: 0.2, fog: 0.15, fogSun: 0.1, exp: 0.1 },
    palette: {
      greys: ['#06070b', '#0d111b', '#171e2c', '#232d40', '#334058', '#4a5872', '#6d7b94', '#a9b4c6'],
      hues: [['#2a1a0c', '#57361a', '#8a5522', '#c4842e', '#f2bd62'], ['#0e1612', '#18241d', '#26372c', '#3a4f40', '#55705b'], ['#0f1726', '#1b2a42', '#2b4163', '#456189', '#7290b6'], ['#1f0f0e', '#3d1915', '#62261c', '#8c3a27', '#b8583a']],
    },
    chroma: [0.035, 0.1], contrast: 1.15, dither: 0, bloom: 0.55, stars: 1, sunSize: 3.2, sunDisc: 2.4, snow: 0,
    ash: { amount: 0.35, lum: 0.12, fall: 0.7 }, grain: 0.03, vignette: 0.35, tilt: 0, winMin: 0, lanI: 2.1, cloudCov: -0.04,
    player: { coat: [0.55, 0.58, 0.66], hood: [0.42, 0.45, 0.54], scarf: [0.95, 0.48, 0.18], fill: 0.32 },
    streetAlb: 0.82, winPool: 1,
    ui: { text: '#a9b4c6', dim: '#6d7b94', accent: '#f2bd62', title: '#a9b4c6', sub: '#a9b4c6', plate: 'rgba(6,7,11,0.85)', edge: '#334058' },
  },

  // a huge red sun low behind it, ash falling, the lantern a pale bone-white light
  blood: {
    name: 'Ash and blood', short: 'Ash and blood',
    note: 'Warm blacks to bone, one blood-red ramp, a huge low red sun behind the giant and ash falling. The lantern is pale bone-white, the only cold-looking light.',
    light: { sun: nrm([-0.94, 0.13, -0.27]), sunCol: [2.3, 0.9, 0.5], skyCol: [0.12, 0.07, 0.07], gndCol: [0.1, 0.065, 0.06], fogCol: [0.15, 0.095, 0.09], fogSunCol: [0.55, 0.18, 0.11], fogA: 1 / 9000, fogB: 1 / 1200, exposure: 1.2, lanCol: [1.0, 0.93, 0.8] },
    dimK: { sun: 0.55, sky: 0.2, gnd: 0.4, fog: 0.2, fogSun: 0.05, exp: 0.15 },
    palette: {
      greys: ['#0b0807', '#18100e', '#271a17', '#3a2622', '#533731', '#744f44', '#9c745f', '#cfb798'],
      hues: [['#260908', '#470e0b', '#741812', '#a5261a', '#d8452a'], ['#2a170b', '#53301a', '#83502a', '#b8803f', '#e9b866'], ['#141410', '#24241b', '#38372a', '#504e3c', '#6d6a52'], ['#141518', '#25272d', '#3a3d46', '#545964', '#767c89']],
    },
    chroma: [0.07, 0.16], contrast: 1.1, dither: 0, bloom: 0.25, stars: 0, sunSize: 5.5, sunDisc: 1.1, snow: 0,
    ash: { amount: 1, lum: 0.3, fall: 0.8 }, grain: 0.06, vignette: 0.55, tilt: 0, winMin: 0, lanI: 1.5, cloudCov: 0,
    player: { coat: [0.6, 0.55, 0.45], hood: [0.5, 0.45, 0.36], scarf: [0.7, 0.15, 0.1], fill: 0.12 },
    ui: { text: '#cfb798', dim: '#9c745f', accent: '#d8452a', title: '#cfb798', sub: '#cfb798', plate: 'rgba(11,8,7,0.85)', edge: '#533731' },
  },

  // white fog: the town clear round you, everything else going pale; its legs in the fog, its body above it
  fog: {
    name: 'White fog', short: 'Fog',
    note: 'Cool greys into a white fog that lies low. Round you the town is clear; beyond it everything dissolves. Its legs stand in the fog and its body comes out above it.',
    light: { sun: nrm([-0.7, 0.5, -0.4]), sunCol: [1.1, 1.08, 1.04], skyCol: [0.6, 0.62, 0.65], gndCol: [0.4, 0.4, 0.4], fogCol: [0.78, 0.79, 0.8], fogSunCol: [0.9, 0.89, 0.87], fogA: 1 / 900, fogB: 1 / 220, exposure: 1.1, lanCol: [1.0, 0.72, 0.42] },
    dimK: { sun: 0.75, sky: 0.45, gnd: 0.5, fog: 0.5, fogSun: 0.45, exp: 0.1 },
    palette: {
      greys: ['#141517', '#2a2c30', '#44474c', '#62666c', '#858990', '#a9adb2', '#cdd0d3', '#edefee'],
      hues: [['#2b2016', '#55402a', '#82643f', '#b28d5c', '#ddb67f'], ['#1a1f1b', '#2d362f', '#465249', '#667468', '#8e9a8f'], ['#1b2027', '#2f3743', '#4a5462', '#6b7686', '#95a0ae'], ['#2a1c19', '#4c322c', '#744c42', '#9c6a5c', '#c28e7e']],
    },
    chroma: [0.06, 0.16], contrast: 1.05, dither: 0, bloom: 0, stars: 0, sunSize: 0, sunDisc: 0, snow: 0,
    ash: { amount: 0.3, lum: 0.85, fall: 0.25 }, grain: 0.04, vignette: 0.3, tilt: 0, winMin: 0, lanI: 2.2, cloudCov: 0.12,
    player: { coat: [0.13, 0.13, 0.15], hood: [0.11, 0.11, 0.13], scarf: [0.55, 0.2, 0.13] },
    ui: { text: '#edefee', dim: '#cdd0d3', accent: '#ddb67f', title: '#2a2c30', sub: '#44474c', plate: 'rgba(20,21,23,0.8)', edge: '#62666c' },
  },

  // Ashwake's own winter: snow on the ground, the roofs and the giant's shoulders; black timber; red accents
  winter: {
    name: 'Winter village', short: 'Winter',
    note: "Ashwake's first look: snow on every upward face, black timber and dark walls, a red ramp for small accents. Snow falls. The highest contrast of the set.",
    light: { sun: nrm([-0.9, 0.27, -0.33]), sunCol: [2.1, 2.0, 1.92], skyCol: [0.5, 0.56, 0.66], gndCol: [0.5, 0.52, 0.56], fogCol: [0.72, 0.75, 0.8], fogSunCol: [0.95, 0.92, 0.88], fogA: 1 / 7000, fogB: 1 / 1300, exposure: 1.0, lanCol: [1.0, 0.66, 0.35] },
    dimK: { sun: 0.75, sky: 0.25, gnd: 0.45, fog: 0.3, fogSun: 0.15, exp: 0.18 },
    palette: {
      greys: ['#0e0e11', '#1c1c21', '#2f2f36', '#4b4b53', '#71717a', '#9c9ca4', '#cbcbd0', '#f3f2ef'],
      hues: [['#2a0b0b', '#52130f', '#861c15', '#bd281d', '#e44a35'], ['#2b1e10', '#57391b', '#8a5b2a', '#c38d43', '#efc070'], ['#151b24', '#263142', '#3c4b62', '#5b6d86', '#8597b0'], ['#0f1612', '#1b261e', '#2b3a2e', '#3f5443', '#5a735d']],
    },
    chroma: [0.05, 0.14], contrast: 1.08, dither: 0, bloom: 0, stars: 0, sunSize: 1, sunDisc: 1.2, snow: 1,
    ash: { amount: 0.8, lum: 0.97, fall: 0.6 }, grain: 0.04, vignette: 0.4, tilt: 0, winMin: 0, lanI: 1.45, cloudCov: 0,
    player: { coat: [0.1, 0.1, 0.12], hood: [0.08, 0.08, 0.1], scarf: [0.7, 0.12, 0.1] },
    ui: { text: '#f3f2ef', dim: '#cbcbd0', accent: '#e44a35', title: '#1c1c21', sub: '#2f2f36', plate: 'rgba(14,14,17,0.82)', edge: '#4b4b53' },
  },

  // bright, bleached daylight with bloom, the sky blown out: the long-shadowed epic of a colossus game
  colossus: {
    name: 'Sunlit colossus', short: 'Sunlit',
    note: 'Bleached daylight: a blown-out sky, bloom round everything bright, desaturated sage, sand, sky and terracotta. The giant reads by its shadow side. The most epic, the least dread.',
    light: { sun: nrm([0.25, 0.62, 0.75]), sunCol: [2.6, 2.45, 2.2], skyCol: [0.5, 0.58, 0.72], gndCol: [0.33, 0.32, 0.29], fogCol: [0.68, 0.72, 0.78], fogSunCol: [1.1, 1.04, 0.92], fogA: 1 / 8000, fogB: 1 / 1500, exposure: 1.1, lanCol: [1.0, 0.8, 0.55] },
    dimK: { sun: 0.7, sky: 0.3, gnd: 0.5, fog: 0.3, fogSun: 0.25, exp: 0.15 },
    palette: {
      greys: ['#131312', '#292824', '#45433d', '#66625a', '#8c877c', '#b2ac9f', '#d8d1c2', '#fbf6ea'],
      hues: [['#1a1f17', '#30392b', '#4b5843', '#6c7b60', '#939f84'], ['#2a2318', '#51432d', '#7e6a49', '#ab926a', '#d4bc93'], ['#1a2129', '#2e3a48', '#4a5a6c', '#6d8094', '#98a9ba'], ['#261a17', '#47302a', '#6b4a3f', '#906656', '#b48a77']],
    },
    chroma: [0.04, 0.12], contrast: 1.0, dither: 0, bloom: 0.45, stars: 0, sunSize: 1.5, sunDisc: 2.0, snow: 0,
    ash: { amount: 0.25, lum: 0.9, fall: 0.3 }, grain: 0.07, vignette: 0.45, tilt: 0, winMin: 0, lanI: 2.8, cloudCov: 0.02,
    player: { coat: [0.14, 0.14, 0.15], hood: [0.12, 0.12, 0.13], scarf: [0.55, 0.3, 0.15] },
    ui: { text: '#fbf6ea', dim: '#d8d1c2', accent: '#d4bc93', title: '#292824', sub: '#45433d', plate: 'rgba(19,19,18,0.78)', edge: '#66625a' },
  },

  // two colours, ordered dither all the way
  onebit: {
    name: 'One bit', short: 'One bit',
    note: 'Black and paper, nothing else: three flat levels, ink, a 50% screen and paper. The scene is lit with more fill so the dark sides still read.',
    light: { sun: nrm([-0.94, 0.22, -0.27]), sunCol: [2.3, 2.3, 2.3], skyCol: [0.62, 0.62, 0.62], gndCol: [0.32, 0.32, 0.32], fogCol: [0.55, 0.55, 0.55], fogSunCol: [0.85, 0.85, 0.85], fogA: 1 / 9000, fogB: 1 / 1300, exposure: 1.05, lanCol: [1.0, 1.0, 1.0] },
    dimK: { sun: 0.75, sky: 0.15, gnd: 0.3, fog: 0.3, fogSun: 0.15, exp: 0.2 },
    palette: { greys: ['#0c0c0e', '#ece8df'], hues: [] },
    chroma: [9, 10], contrast: 1.15, dither: 2, bloom: 0, stars: 0, sunSize: 1, sunDisc: 1.4, snow: 0,
    ash: { amount: 0.4, lum: 0.9, fall: 1 }, grain: 0, vignette: 0.2, tilt: 0, winMin: 0, lanI: 1.8, cloudCov: 0,
    player: { coat: [0.08, 0.08, 0.08], hood: [0.06, 0.06, 0.06], scarf: [0.9, 0.9, 0.9] },
    ui: { text: '#ece8df', dim: '#ece8df', accent: '#ece8df', title: '#0c0c0e', sub: '#0c0c0e', plate: 'rgba(12,12,14,0.92)', edge: '#ece8df' },
  },

};
export const LOOK_ORDER = ['ashwake', 'night', 'blood', 'fog', 'winter', 'colossus', 'onebit'];

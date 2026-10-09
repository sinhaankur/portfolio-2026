// Vera's limbic neural network — THE REAL ONE, running in your browser.
//
// These are the exact weights trained with backprop in the Human Brain Engine
// (brain/regions/affect_net.py), exported verbatim. The forward pass below is the
// same maths as the engine's pure-Python path, so what you see here is the real
// amygdala reading a feeling — not a re-creation, the actual trained net.
//
// Retrain in the engine (`python -m brain.regions.train_affect`) and re-export to
// refresh these numbers; the architecture is a tiny MLP: 43 input cues → 8 hidden
// ReLU neurons → (valence via tanh, arousal via sigmoid).

export const FEATURES = ["sad","tired","exhausted","worried","anxious","lonely","angry","frustrated","stuck","afraid","hurt","lost","hard","hate","fail","alone","cry","overwhelmed","empty","scared","happy","glad","excited","proud","love","great","good","thanks","win","shipped","works","finally","haha","lol","nice","better","grateful","hope","calm","rest","_exclaim","_question","_negation"] as const

const W1 = [[-0.05409,0.10811,-0.0478,-0.0666,-0.1966,-0.04509,0.23505,0.08966],[0.17167,0.25077,-0.17702,0.26435,-0.3522,-0.00607,0.0253,0.34676],[-0.34994,-0.36865,-0.33691,0.35846,0.02127,-0.00971,0.29906,-0.13577],[0.06526,0.08332,-0.13976,0.36308,0.11766,0.25304,-0.13114,-0.15633],[-0.16164,-0.18662,0.0499,-0.25646,-0.09457,-0.20229,-0.11005,0.69466],[-0.22824,0.16629,-0.16,-0.21334,0.01025,0.11046,-0.42583,0.17667],[-0.02244,-0.17276,0.10515,-0.01317,-0.30962,0.175,0.14149,0.19995],[0.30454,0.07658,0.02521,-0.27464,0.1301,-0.12932,-0.0957,-0.26737],[-0.23402,-0.17295,0.06665,-0.48085,-0.30815,0.04446,0.55882,0.44042],[-0.40164,-0.53234,0.07555,-0.15564,-0.23672,0.20661,0.23291,0.03324],[0.05196,0.09182,0.33696,0.13086,0.10964,0.11579,-0.33153,0.27095],[0.22063,0.17367,-0.41727,-0.08176,0.13632,-0.38288,-0.0389,0.16039],[-0.27718,0.22375,0.06704,-0.20591,0.06868,0.03773,0.23482,0.43373],[-0.13985,-0.20429,0.17056,-0.1685,-0.18613,0.10044,0.51917,0.09751],[-0.31894,-0.15336,-0.20735,-0.19716,0.13738,-0.21709,0.63079,-0.26812],[-0.19231,0.22139,-0.09677,0.40581,0.02415,0.0258,0.08596,0.37183],[-0.03725,0.05865,0.12107,0.00018,0.1615,0.11962,0.42504,0.06869],[-0.17395,-0.18663,-0.01218,-0.12965,-0.07115,0.05587,0.85692,-0.54216],[-0.28178,0.2299,-0.33693,0.52993,-0.09114,0.08881,0.17771,-0.11036],[0.40651,-0.21356,-0.11716,-0.26058,-0.07435,-0.07639,-0.5767,0.17779],[0.21321,-0.27493,0.01397,0.16428,0.18099,0.33098,-0.37371,-0.05403],[-0.07208,0.13176,0.2308,-0.56714,0.23014,-0.306,0.14441,-0.31543],[0.1259,0.05441,0.33941,-0.32303,0.60222,0.03857,-0.05994,-0.07512],[0.22301,-0.06582,0.6172,-0.24088,0.22898,-0.05617,0.02576,0.1152],[0.05059,-0.00005,-0.25378,-0.38312,0.13,-0.20361,-0.21703,-0.31078],[0.32197,0.06277,0.64976,-0.26648,0.00156,-0.24106,0.11961,0.09102],[-0.18458,0.18974,0.65478,-0.17435,-0.41686,0.29736,-0.11682,-0.12743],[0.11235,0.2285,0.25876,-0.10761,0.22611,0.36427,0.30201,-0.01504],[-0.15728,0.21532,0.02435,0.02625,0.30107,-0.05569,-0.48552,-0.08185],[-0.39191,0.14519,0.09509,-0.1665,-0.00203,0.1918,0.00265,0.30109],[-0.01296,0.08861,0.09305,0.27631,-0.14202,0.04285,-0.40743,-0.23763],[-0.38815,0.1645,-0.40793,-0.08485,-0.04064,0.38798,-0.14766,0.05227],[0.38227,-0.1257,0.18133,0.14749,-0.04185,-0.26629,-0.11741,0.22695],[-0.348,-0.12638,0.21296,0.16758,0.00161,0.17022,0.03509,-0.24922],[-0.30273,0.00676,0.13713,-0.01151,-0.20484,-0.11313,-0.3288,-0.00165],[-0.24936,0.07193,-0.12208,-0.00345,-0.13563,-0.41056,0.05673,-0.05824],[-0.42318,-0.18498,0.18828,0.03386,0.16488,0.34563,-0.12912,0.01892],[0.28194,0.13949,0.09539,-0.44054,0.18953,0.27681,-0.06276,-0.09925],[0.45841,-0.37166,0.22587,0.64317,-0.19609,0.33337,0.12882,-0.07554],[0.14541,0.26095,-0.19147,-0.01312,0.06189,0.66582,-0.0073,-0.05228],[-0.10099,-0.23509,0.90737,-0.46423,-0.18033,-0.30529,0.25915,-0.00005],[0.13474,-0.54813,0.13138,0.10162,0.35601,0.09043,-0.01427,0.11044],[-0.49946,0.03283,-0.33073,-0.29104,0.06345,0.08335,-0.29646,0.39878]]
const B1 = [0.31464,0.14202,0.2566,0.41977,-0.01621,-0.04254,0.00002,-0.00012]
const W2 = [[0.44891,0.04367],[0.00045,-0.65239],[1.47261,0.93506],[-0.66904,-1.34534],[0.84215,0.63812],[1.20898,0.10255],[-0.8391,0.75211],[-1.42655,0.28615]]
const B2 = [-0.26423,0.06162]

const WORD_IDX = new Map<string, number>()
FEATURES.forEach((f, i) => { if (!f.startsWith("_")) WORD_IDX.set(f, i) })
const IDX_EXCLAIM = FEATURES.indexOf("_exclaim")
const IDX_QUESTION = FEATURES.indexOf("_question")
const IDX_NEGATION = FEATURES.indexOf("_negation")
const NEG = new Set(["not","no","never","don't","dont","cant","can't","won't","wont"])

const sigmoid = (x: number) => (x >= 0 ? 1 / (1 + Math.exp(-x)) : Math.exp(x) / (1 + Math.exp(x)))

/** Turn a phrase into the input layer — a bag of affect cues, lightly saturated.
 *  Each entry is exactly one known cue firing; this is what the net "sees". */
export function featurize(text: string): number[] {
  const vec = new Array(FEATURES.length).fill(0)
  const words = (text.toLowerCase().match(/[a-z']+/g) || [])
  for (const w of words) {
    const idx = WORD_IDX.get(w)
    if (idx !== undefined) vec[idx] += 1
    if (NEG.has(w)) vec[IDX_NEGATION] += 1
  }
  vec[IDX_EXCLAIM] = (text.match(/!/g) || []).length
  vec[IDX_QUESTION] = (text.match(/\?/g) || []).length
  return vec.map((v) => Math.tanh(v))
}

export type NetReading = {
  input: number[]       // the input cues that fired (43)
  hidden: number[]      // the 8 hidden-neuron activations (post-ReLU)
  valence: number       // -1 (heavy) .. +1 (glad)
  arousal: number       // 0 (calm) .. 1 (lit)
  firedCues: { feature: string; value: number }[]  // which input cues lit up
}

/** One real forward pass of Vera's limbic net. Identical maths to the engine. */
export function readFeeling(text: string): NetReading {
  const input = featurize(text)
  const hidden: number[] = []
  for (let j = 0; j < B1.length; j++) {
    let z = B1[j]
    for (let i = 0; i < input.length; i++) z += input[i] * W1[i][j]
    hidden.push(Math.max(0, z))   // ReLU
  }
  const out: number[] = []
  for (let k = 0; k < B2.length; k++) {
    let z = B2[k]
    for (let j = 0; j < hidden.length; j++) z += hidden[j] * W2[j][k]
    out.push(z)
  }
  const firedCues = input
    .map((v, i) => ({ feature: FEATURES[i], value: v }))
    .filter((c) => c.value > 0.001 && !c.feature.startsWith("_"))
    .sort((a, b) => b.value - a.value)
  return { input, hidden, valence: Math.tanh(out[0]), arousal: sigmoid(out[1]), firedCues }
}

export function feelingLabel(valence: number): string {
  if (valence >= 0.5) return "bright"
  if (valence >= 0.3) return "warm"
  if (valence >= 0.15) return "easy"
  if (valence >= -0.15) return "steady"
  if (valence >= -0.4) return "tender"
  return "heavy"
}

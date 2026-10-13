// Rebuilds dave/ritam-all.js (the single-file bundle the game page loads).
// Run from the project tooling: levels are run-length encoded, comments and indentation stripped.
const lvs = await readFile('dave/levels-ritam.js');
const a = lvs.indexOf('export const LEVELS = [') + 'export const LEVELS = '.length, b = lvs.indexOf(';\n\nexport const HINTS', a);
const LEVELS = JSON.parse(lvs.slice(a, b));
const enc = (row) => row.replace(/(.)\1{2,}/g, (m0, c) => c + m0.length);
const lvBundle = lvs.slice(0, a - 'export const LEVELS = '.length) + 'const RLE = ' + JSON.stringify(LEVELS.map((rows) => rows.map(enc))) + ';\nexport const LEVELS = RLE.map((rows) => rows.map((row) => row.replace(/(\\D)(\\d+)/g, (m, c, n) => c.repeat(+n))));' + lvs.slice(b);
const strip = (code) => code.split('\n').filter((l) => !/^\s*\/\/[^\n]*$/.test(l)).map((l) => l.replace(/^\s+/, '')).join('\n');
let out = '';
for (const [ns, f] of [['eng', 'dave/engine.js'], ['inp', 'dave/input.js'], ['lv', null], ['r3', 'dave/renderer-3d.js'], ['gen', 'dave/levelgen.js'], ['mus', 'dave/music.js']]) {
  let m0 = f ? await readFile(f) : lvBundle;
  const imports = [];
  m0 = m0.replace(/^import\s*\{([^}]*)\}\s*from\s*['"]\.\/engine\.js['"];?\s*$/gm, (x, names) => { imports.push(names.trim()); return ''; });
  m0 = m0.replace(/^export default .*$/gm, '');
  const names = [];
  m0 = m0.replace(/^export (const|let|class|function) ([A-Za-z_$][\w$]*)/gm, (x, kw, nm) => { names.push(nm); return kw + ' ' + nm; });
  out += 'const __' + ns + ' = (() => {\n' + imports.map((nm) => 'const { ' + nm + ' } = __eng;\n').join('') + strip(m0) + '\nreturn { ' + names.join(', ') + ' };\n})();\n';
}
out = '// Ritam 3D — all game modules in one file (comments and indentation stripped; edit the sources in dave/).\n' + out + 'export const eng = __eng, inp = __inp, lv = __lv, r3 = __r3, gen = __gen, mus = __mus;\n';
new Function(out.replace(/^export const .*$/m, ''));
await saveFile('dave/ritam-all.js', out);
let d = await readFile('Ritam 3D standalone.dc.html');
d = d.replace(/ritam-all\.js\?v=(\d+)'/, (m, v) => "ritam-all.js?v=" + (+v + 1) + "'");
await saveFile('Ritam 3D standalone.dc.html', d);
return out.length;

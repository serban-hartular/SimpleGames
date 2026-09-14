const fs = require('node:fs'), vm = require('node:vm'), path = require('node:path');
const ts = require('typescript'), assert = require('node:assert/strict');
const cache = new Map(), saved = new Map();
const document = { documentElement: { lang: '' }, title: '' };
function load(file) {
    file = path.resolve(file); if (!fs.existsSync(file)) file = file.replace(/\.ts$/, '/index.ts');
    if (cache.has(file)) return cache.get(file);
    const exports = {}; cache.set(file, exports);
    vm.runInNewContext(ts.transpileModule(fs.readFileSync(file, 'utf8'), {
        compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2020 }
    }).outputText, { exports, document, localStorage: { getItem: k => saved.get(k), setItem: (k,v) => saved.set(k,v) }, require: p => load(path.resolve(path.dirname(file), p + '.ts')) });
    return exports;
}
const i18n = load('src/game/i18n/index.ts');
assert.deepEqual(Object.keys(i18n.languages.ro.messages).sort(), Object.keys(i18n.languages.en.messages).sort());
i18n.loadLanguage(); assert.equal(document.documentElement.lang, 'ro'); assert.equal(i18n.t('MENU'), 'MENIU');
assert.equal(i18n.t('Apples eaten: {0}', 7), 'Mere mâncate: 7');
i18n.setLanguage('en'); assert.equal(i18n.t('Timp: {0} s', '3.2'), 'Time: 3.2 s');
assert.equal(i18n.t('Sparge baloanele cu numere divizibile la {0}', 5), 'Pop balloons with numbers divisible by 5');
i18n.setLanguage('ro'); i18n.loadLanguage(); assert.equal(document.documentElement.lang, 'ro');
assert.throws(() => i18n.setLanguage('bad'));
for (const dir of ['src/game/scenes','src/game/settings']) for (const file of fs.readdirSync(dir).filter(f=>f.endsWith('.ts'))) {
    const source = ts.createSourceFile(file, fs.readFileSync(`${dir}/${file}`, 'utf8'), ts.ScriptTarget.Latest, true);
    function walk(node) { if (ts.isCallExpression(node) && node.expression.getText(source) === 't' && ts.isStringLiteral(node.arguments[0])) {
        assert(node.arguments[0].text in i18n.languages.ro.messages, `Missing translation ${node.arguments[0].text}`);
    } ts.forEachChild(node, walk); } walk(source);
}
console.log('Language tests passed: matching catalogs, Romanian default, interpolation, persistence, switching and translated call coverage.');

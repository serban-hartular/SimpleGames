const fs = require('node:fs'), path = require('node:path'), vm = require('node:vm');
const assert = require('node:assert/strict'), ts = require('typescript');
const exportsObject = {};
vm.runInNewContext(ts.transpileModule(fs.readFileSync('src/game/logic/MonsterWords.ts', 'utf8'), {
    compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2020 }
}).outputText, { exports: exportsObject });
const { parseWordPrompts, WordDataError, wordChallenge, MonsterWordBoard, WordDeck, letterKey, WORD_ALPHABET } = exportsObject;
const entries = parseWordPrompts(fs.readFileSync('public/data/monster-words.tsv', 'utf8'));
assert(entries.length >= 10);
assert.equal(entries[0].answer, 'REPAOS');
assert.equal(wordChallenge('REPAOS', 3).mistakesAllowed, 6);
assert.deepEqual([...wordChallenge('REPAOS', 3).revealed], ['P']);

// Plain UTF-8, spreadsheet quoting, blank/comment lines, CRLF, BOM and embedded tabs/newlines.
const quoted = parseWordPrompts('\uFEFF# Notes\r\n\r\nprompt\tanswer\r\n"A \"\"quoted\"\" clue\twith a tab\nand a newline"\t"șţ a"\r\n');
assert.equal(quoted[0].prompt, 'A "quoted" clue with a tab and a newline');
assert.equal(quoted[0].answer, 'ȘȚ A');
assert.equal(parseWordPrompts('prompt\tanswer\nQuestion\t  Repaos  \n')[0].answer, 'REPAOS');
assert.equal(parseWordPrompts('prompt\tanswer\nQuestion\tÎN-AFARĂ')[0].answer, 'ÎN-AFARĂ');
for (const [source, line] of [
    ['', 1], ['question\tanswer\nClue\tWORD', 1], ['prompt\tanswer\n', 1],
    ['prompt\tanswer\nNo tab', 2], ['prompt\tanswer\nClue\tWORD\textra', 2],
    ['prompt\tanswer\n\tWORD', 2], ['prompt\tanswer\nClue\t123', 2],
    ['prompt\tanswer\nClue\t😀', 2], ['prompt\tanswer\nClue\t' + 'A'.repeat(33), 2],
    ['prompt\tanswer\n' + 'X'.repeat(221) + '\tWORD', 2],
    ['prompt\tanswer\n"Unclosed\tWORD', 2], ['prompt\tanswer\n"Quoted"oops\tWORD', 2],
    ['# note\nprompt\tanswer\n\nGood\tWORD\nBad\t💥', 5]
]) assert.throws(() => parseWordPrompts(source), error => error instanceof WordDataError && error.line === line, source);

for (const [input, expected] of [['a','A'], ['ă','A'], ['Â','A'], ['î','I'], ['ș','S'], ['Ş','S'], ['ț','T'], ['é','E']]) {
    assert.equal(letterKey(input), expected);
}
for (const input of ['Enter', ' ', '-', '3', '😀', 'ß']) assert.equal(letterKey(input), undefined);

const b = new MonsterWordBoard(entries[0], 3);
assert.equal([...b.answer].map(char => b.visible(char) ? char : '_').join(''), '__P___');
assert.equal(b.guess('p'), 'ignored', 'Pre-revealed groups cannot be guessed again');
assert.equal(b.guess('r'), 'correct'); assert.equal(b.guess('R'), 'ignored');
assert.equal(b.guess('x'), 'wrong'); assert.equal(b.mistakes, 1);
assert.equal(b.guess('X'), 'ignored'); assert.equal(b.mistakes, 1);
for (const key of ['E','A','O']) assert.equal(b.guess(key), 'correct');
assert.equal(b.guess('S'), 'won'); assert.equal(b.result, 'won');
assert.equal(b.guess('Z'), 'ignored'); assert.equal(b.mistakes, 1);

const accents = new MonsterWordBoard({ prompt: 'Accents', answer: 'Ă A Â Î I Ș Ş Ț Ţ' }, 5);
assert.equal(accents.guess('ă'), 'correct');
for (const char of ['Ă','A','Â']) assert(accents.visible(char));
assert.equal(accents.guess('I'), 'correct'); assert(accents.visible('Î'));
assert.equal(accents.guess('ș'), 'correct'); assert(accents.visible('Ș'));
assert.equal(accents.guess('T'), 'won');
const repeated = new MonsterWordBoard({ prompt: 'Repeated', answer: 'BANANA' }, 5);
assert.equal(repeated.guess('a'), 'correct');
assert.equal([...repeated.answer].map(char => repeated.visible(char) ? char : '_').join(''), '_A_A_A');

// Independent invariants across the shipped bank and varied letter distributions.
let state = 2918;
const random = n => { state = (Math.imul(state, 1664525) + 1013904223) >>> 0; return state % n; };
const words = [...Array.from(entries, entry => entry.answer), 'A', 'AAAAA', 'ABABABABAB', WORD_ALPHABET, 'ÎN-AFARĂ'];
for (let i = 0; i < 200; i++) words.push(Array.from({ length: 1 + random(32) }, () => WORD_ALPHABET[random(26)]).join(''));
for (const answer of words) {
    let previousHints, previousMoves;
    for (let difficulty = 1; difficulty <= 5; difficulty++) {
        const challenge = wordChallenge(answer, difficulty), board = new MonsterWordBoard({ prompt: 'Test', answer }, difficulty);
        const unique = new Set([...answer].map(letterKey).filter(Boolean));
        assert(challenge.mistakesAllowed >= 3 && challenge.mistakesAllowed <= 10);
        assert(challenge.revealed.length < unique.size, 'At least one letter group stays hidden');
        if (previousHints) {
            assert(challenge.revealed.every(key => previousHints.includes(key)), 'Harder difficulties only remove hints');
            assert(challenge.mistakesAllowed <= previousMoves, 'Harder difficulties never allow more mistakes');
        }
        previousHints = [...challenge.revealed]; previousMoves = challenge.mistakesAllowed;
        if (difficulty === 5) assert.equal(challenge.revealed.length, 0);
        for (const key of unique) board.guess(key);
        assert.equal(board.result, 'won'); assert.equal(board.mistakes, 0);
        assert([...board.answer].every(char => board.visible(char)));

        const loser = new MonsterWordBoard({ prompt: 'Test', answer }, difficulty);
        const wrong = [...WORD_ALPHABET].filter(key => !unique.has(key));
        for (let i = 0; i < Math.min(wrong.length, loser.mistakesAllowed); i++) {
            assert.equal(loser.guess(wrong[i]), i + 1 === loser.mistakesAllowed ? 'lost' : 'wrong');
            assert.equal(loser.mistakes, i + 1, 'Every wrong guess advances exactly one square');
        }
        if (wrong.length >= loser.mistakesAllowed) {
            assert.equal(loser.result, 'lost');
            assert([...loser.answer].every(char => loser.visible(char)), 'The answer is revealed after defeat');
            assert.equal(loser.guess('A'), 'ignored');
        }
    }
}
for (const difficulty of [0, 6, 2.5, NaN, Infinity, '3']) assert.throws(() => wordChallenge('TEST', difficulty));
assert.throws(() => wordChallenge('---', 3));
const deck = new WordDeck(Array.from(entries), () => random(10000) / 10000);
let last;
for (let cycle = 0; cycle < 6; cycle++) {
    const seen = new Set();
    for (let i = 0; i < entries.length; i++) {
        const entry = deck.next(); assert.notEqual(entry, last); assert(!seen.has(entry)); seen.add(entry); last = entry;
    }
    assert.equal(seen.size, entries.length);
}
const single = new WordDeck([entries[0]]); assert.equal(single.next(), single.next());
assert.throws(() => new WordDeck([]));
console.log('Monster word checks passed: TSV parsing/line errors, shipped prompts, difficulty monotonicity, deterministic hints, repeated/diacritic groups, exact mistake budgets, win/loss/duplicate locks and shuffled rounds.');

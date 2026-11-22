import type { MonsterConfig } from '../config/monster';

export const WORD_ALPHABET = 'ABCDEFGHIJKLMNOPQRSTUVWXYZ';
export type WordPrompt = { prompt: string; answer: string };
export type WordResult = 'playing' | 'won' | 'lost';
export type GuessResult = 'correct' | 'wrong' | 'ignored' | 'won' | 'lost';

export class WordDataError extends Error {
    constructor(readonly line: number, readonly reason: string) {
        super(`TSV line ${line}: ${reason}`);
    }
}

/** Accented letters share a keyboard key; the original spelling is displayed. */
export function letterKey(value: string): string | undefined {
    if ([...value].length !== 1) return undefined;
    const key = value.normalize('NFD').replace(/[\u0300-\u036f]/g, '').toUpperCase();
    return /^[A-Z]$/.test(key) ? key : undefined;
}

function normalizeAnswer(value: string): string {
    return value.normalize('NFC').toUpperCase().replace(/Ş/g, 'Ș').replace(/Ţ/g, 'Ț').replace(/\s+/g, ' ').trim();
}

export function validateMonsterConfig(config: MonsterConfig): void {
    if (!Number.isInteger(config.difficulty) || config.difficulty < 1 || config.difficulty > 5) {
        throw new Error('Word difficulty must be a whole number from 1 to 5.');
    }
}

/** TSV with optional spreadsheet-style quoting, BOM, CRLF and comment lines. */
export function parseWordPrompts(source: string): WordPrompt[] {
    const records: { cells: string[]; line: number }[] = [];
    const text = source.replace(/^\uFEFF/, '').replace(/\r\n?/g, '\n');
    let cells: string[] = [], field = '', quoted = false, closed = false, line = 1, startLine = 1;
    const pushField = () => { cells.push(field); field = ''; closed = false; };
    for (let i = 0; i <= text.length; i++) {
        const char = text[i];
        if (quoted) {
            if (char === undefined) throw new WordDataError(startLine, 'Unclosed quoted field.');
            if (char === '"') {
                if (text[i + 1] === '"') { field += '"'; i++; }
                else { quoted = false; closed = true; }
            } else { field += char; if (char === '\n') line++; }
        } else if (char === '\t') pushField();
        else if (char === '\n' || char === undefined) {
            pushField(); records.push({ cells, line: startLine }); cells = [];
            if (char === '\n') { line++; startLine = line; }
        } else if (char === '"' && field === '' && !closed) quoted = true;
        else {
            if (closed) throw new WordDataError(line, 'Unexpected text after a quoted field.');
            field += char;
        }
    }
    const rows = records.filter(row => row.cells.some(cell => cell.trim()) && !row.cells[0].trim().startsWith('#'));
    const header = rows.shift();
    if (!header || header.cells.length !== 2 || header.cells[0].trim().toLowerCase() !== 'prompt'
        || header.cells[1].trim().toLowerCase() !== 'answer') {
        throw new WordDataError(header?.line ?? 1, 'Expected the header prompt<TAB>answer.');
    }
    const prompts = rows.map(row => {
        if (row.cells.length !== 2) throw new WordDataError(row.line, 'Each row needs exactly two tab-separated fields.');
        const prompt = row.cells[0].replace(/\s+/g, ' ').trim(), answer = normalizeAnswer(row.cells[1]);
        if (!prompt || prompt.length > 220) throw new WordDataError(row.line, 'Use a prompt of 1–220 characters.');
        const chars = [...answer];
        if (chars.length < 1 || chars.length > 32 || !chars.some(char => letterKey(char))
            || chars.some(char => !letterKey(char) && !" -'’".includes(char))) {
            throw new WordDataError(row.line, 'Answers need 1–32 characters: Latin letters, spaces, hyphens or apostrophes.');
        }
        return { prompt, answer };
    });
    if (!prompts.length) throw new WordDataError(1, 'Add at least one prompt and answer.');
    return prompts;
}

/** Deterministic hints: rarer letter groups first, then nearest the word's centre. */
export function wordChallenge(answer: string, difficulty: number): { revealed: string[]; mistakesAllowed: number } {
    validateMonsterConfig({ difficulty });
    const chars = [...normalizeAnswer(answer)];
    const groups = new Map<string, { count: number; first: number }>();
    chars.forEach((char, index) => {
        const key = letterKey(char);
        if (!key) return;
        const previous = groups.get(key);
        if (previous) previous.count++;
        else groups.set(key, { count: 1, first: index });
    });
    const unique = groups.size;
    if (!unique) throw new Error('An answer must contain a guessable letter.');
    const hintCount = Math.min(unique - 1, Math.floor(unique * (5 - difficulty) / 8));
    const middle = (chars.length - 1) / 2;
    const ranked = [...groups].sort(([, a], [, b]) => a.count - b.count
        || Math.abs(a.first - middle) - Math.abs(b.first - middle) || a.first - b.first);
    return {
        revealed: ranked.slice(0, hintCount).map(([key]) => key),
        mistakesAllowed: Math.max(3, Math.min(10, 7 - difficulty + Math.ceil(unique / 4)))
    };
}

export class MonsterWordBoard {
    readonly answer: string;
    readonly revealed: Set<string>;
    readonly guessed = new Set<string>();
    readonly mistakesAllowed: number;
    mistakes = 0;
    result: WordResult = 'playing';

    constructor(readonly entry: WordPrompt, difficulty: number) {
        this.answer = normalizeAnswer(entry.answer);
        const challenge = wordChallenge(this.answer, difficulty);
        this.revealed = new Set(challenge.revealed);
        this.mistakesAllowed = challenge.mistakesAllowed;
    }

    visible(char: string): boolean {
        const key = letterKey(char);
        return !key || this.revealed.has(key) || this.guessed.has(key) || this.result === 'lost';
    }

    guess(value: string): GuessResult {
        const key = letterKey(value);
        if (!key || this.result !== 'playing' || this.guessed.has(key) || this.revealed.has(key)) return 'ignored';
        this.guessed.add(key);
        if ([...this.answer].some(char => letterKey(char) === key)) {
            if ([...this.answer].every(char => this.visible(char))) this.result = 'won';
            return this.result === 'won' ? 'won' : 'correct';
        }
        if (++this.mistakes === this.mistakesAllowed) this.result = 'lost';
        return this.result === 'lost' ? 'lost' : 'wrong';
    }
}

/** Shuffle bag: every entry once per cycle, with no immediate repeat across cycles. */
export class WordDeck {
    private remaining: WordPrompt[] = [];
    private previous?: WordPrompt;
    constructor(private readonly entries: WordPrompt[], private readonly random = Math.random) {
        if (!entries.length) throw new Error('A word deck cannot be empty.');
    }
    next(): WordPrompt {
        if (!this.remaining.length) {
            this.remaining = [...this.entries];
            for (let i = this.remaining.length - 1; i > 0; i--) {
                const j = Math.floor(this.random() * (i + 1));
                [this.remaining[i], this.remaining[j]] = [this.remaining[j], this.remaining[i]];
            }
            const last = this.remaining.length - 1;
            if (last > 0 && this.remaining[last] === this.previous) {
                [this.remaining[0], this.remaining[last]] = [this.remaining[last], this.remaining[0]];
            }
        }
        this.previous = this.remaining.pop()!;
        return this.previous;
    }
}

import { Scene, GameObjects } from 'phaser';
import { monsterConfig } from '../config/monster';
import { MonsterWordBoard, WordDeck, WordDataError, parseWordPrompts, letterKey, WORD_ALPHABET, type WordPrompt } from '../logic/MonsterWords';
import { drawMonster, drawYellowFriend } from '../visuals/MonsterFigures';
import { MonsterSounds } from '../audio/MonsterSounds';
import { installSettings } from '../settings/dialog';
import { t } from '../i18n';

const DATA_KEY = 'monster-word-prompts';

export class MonsterGame extends Scene {
    private board!: MonsterWordBoard;
    private deck!: WordDeck;
    private sounds!: MonsterSounds;
    private round!: GameObjects.Container;
    private letters!: GameObjects.Container;
    private actions!: GameObjects.Container;
    private monster!: GameObjects.Graphics;
    private friend!: GameObjects.Graphics;
    private status!: GameObjects.Text;
    private counter!: GameObjects.Text;
    private busy = false;
    private ready = false;
    private cell = 70;
    private pathLeft = 100;

    constructor() { super('MonsterGame'); }

    preload(): void {
        // Re-entering from the menu also picks up edits to the TSV file.
        this.cache.text.remove(DATA_KEY);
        this.load.text(DATA_KEY, `${import.meta.env.BASE_URL}data/monster-words.tsv`);
    }

    create(): void {
        this.busy = false; this.ready = false;
        this.sounds = new MonsterSounds();
        this.cameras.main.setBackgroundColor('#182c42');
        this.add.text(40, 24, t('MONSTER WORDS'), { fontFamily: 'Arial', fontSize: '34px', color: '#fff0ce' });
        this.add.text(40, 69, t('Guess the word. Each wrong letter brings the monster one square closer.'), {
            fontFamily: 'Arial', fontSize: '18px', color: '#b9cbd7', wordWrap: { width: 920 }
        });
        const menu = this.add.container();
        this.button(menu, 854, 43, 120, 36, t('MENU'), () => this.scene.start('MainMenu'));
        this.round = this.add.container(); this.letters = this.add.container(); this.actions = this.add.container();
        this.status = this.add.text(512, 521, '', { fontFamily: 'Arial', fontSize: '20px', color: '#d3e8dd',
            align: 'center', wordWrap: { width: 944 } }).setOrigin(0.5, 0);
        const onKey = (event: KeyboardEvent) => {
            if (event.repeat || event.ctrlKey || event.metaKey || event.altKey) return;
            const key = letterKey(event.key);
            if (key) this.guess(key);
        };
        this.input.keyboard?.on('keydown', onKey);
        this.events.once('shutdown', () => {
            this.input.keyboard?.off('keydown', onKey);
            this.time.removeAllEvents(); this.tweens.killAll(); this.sounds.destroy();
        });
        installSettings(this, 'MonsterGame', this.sounds);
        try {
            const source = this.cache.text.get(DATA_KEY);
            if (typeof source !== 'string') throw new Error('Could not load data/monster-words.tsv.');
            this.deck = new WordDeck(parseWordPrompts(source));
            this.startRound(this.deck.next());
        } catch (error) {
            const message = error instanceof WordDataError ? t('TSV line {0}: {1}', error.line, t(error.reason))
                : t(error instanceof Error ? error.message : String(error));
            this.add.text(64, 150, t('Check the word file, then reload.\n{0}', message), {
                fontFamily: 'Arial', fontSize: '24px', color: '#ffb4a2', wordWrap: { width: 896 }, lineSpacing: 12
            });
            this.button(this.actions, 512, 350, 220, 50, t('RELOAD WORDS'), () => this.scene.restart());
        }
    }

    private button(parent: GameObjects.Container, x: number, y: number, width: number, height: number,
        label: string, action: () => void, enabled = true, color = 0x355773): void {
        const background = this.add.rectangle(x, y, width, height, color).setStrokeStyle(1, 0x7593a6).setAlpha(enabled ? 1 : 0.4);
        const text = this.add.text(x, y, label, { fontFamily: 'Arial', fontSize: '18px', color: '#fff0ce', align: 'center',
            wordWrap: { width: width - 8 } }).setOrigin(0.5).setAlpha(enabled ? 1 : 0.55);
        parent.add([background, text]);
        if (enabled) background.setInteractive({ useHandCursor: true }).on('pointerdown', () => {
            this.sounds.unlock(); action();
        });
    }

    private startRound(entry: WordPrompt): void {
        this.time.removeAllEvents(); this.tweens.killAll(); this.sounds.stop(); this.busy = false;
        this.round.removeAll(true); this.letters.removeAll(true);
        this.board = new MonsterWordBoard(entry, monsterConfig.difficulty); this.ready = true;
        this.round.add(this.add.rectangle(512, 147, 944, 100, 0x203950).setStrokeStyle(1, 0x54728a));
        this.round.add(this.add.text(64, 109, entry.prompt, { fontFamily: 'Arial', fontSize: '23px', color: '#fff0ce',
            wordWrap: { width: 896 }, lineSpacing: 5 }));
        this.round.add(this.add.rectangle(512, 412, 944, 188, 0x23464a).setStrokeStyle(1, 0x65847d));
        this.cell = Math.min(78, 864 / (this.board.mistakesAllowed + 1));
        this.pathLeft = 512 - this.cell * this.board.mistakesAllowed / 2;
        for (let i = 0; i <= this.board.mistakesAllowed; i++) {
            const x = this.pathLeft + i * this.cell;
            this.round.add(this.add.rectangle(x, 452, this.cell - 3, this.cell - 3,
                i === this.board.mistakesAllowed ? 0x55745b : 0x30565d).setStrokeStyle(1, 0x759b9b));
            this.round.add(this.add.text(x, 477, String(i), { fontFamily: 'Arial', fontSize: '12px', color: '#bed3d2' }).setOrigin(0.5));
        }
        this.counter = this.add.text(512, 330, '', { fontFamily: 'Arial', fontSize: '18px', color: '#d1e5df' }).setOrigin(0.5, 0);
        this.monster = this.add.graphics().setPosition(this.pathLeft, 448); drawMonster(this.monster, this.cell * 0.94);
        this.friend = this.add.graphics().setPosition(this.pathLeft + this.board.mistakesAllowed * this.cell, 448);
        drawYellowFriend(this.friend, this.cell * 0.9);
        this.round.add([this.counter, this.monster, this.friend]);
        this.renderLetters(); this.renderActions(); this.updateCounter();
        this.status.setText(t('Pick a letter with the buttons or your keyboard.')).setColor('#d3e8dd');
    }

    private renderLetters(): void {
        this.letters.removeAll(true);
        const chars = [...this.board.answer], rows = Math.ceil(chars.length / 16);
        for (let index = 0; index < chars.length; index++) {
            const char = chars[index], row = Math.floor(index / 16), count = Math.min(16, chars.length - row * 16);
            const x = 512 + (index % 16 - (count - 1) / 2) * 48, y = rows === 1 ? 252 : 229 + row * 48;
            const key = letterKey(char), visible = this.board.visible(char);
            if (key) {
                this.letters.add(this.add.rectangle(x, y, 40, 42, visible ? 0x395d60 : 0x203950)
                    .setStrokeStyle(2, this.board.result === 'lost' && !this.board.guessed.has(key) && !this.board.revealed.has(key) ? 0xf3a395 : 0x7eaaa4));
            }
            this.letters.add(this.add.text(x, y, visible ? char : '_', { fontFamily: 'Arial', fontSize: '26px',
                fontStyle: 'bold', color: this.board.result === 'lost' ? '#ffd1c4' : '#fff0ce' }).setOrigin(0.5));
        }
    }

    private renderActions(): void {
        this.actions.removeAll(true);
        const rows = [WORD_ALPHABET.slice(0, 9), WORD_ALPHABET.slice(9, 18), WORD_ALPHABET.slice(18)];
        rows.forEach((row, y) => [...row].forEach((key, x) => {
            const used = this.board.guessed.has(key) || this.board.revealed.has(key);
            const correct = [...this.board.answer].some(char => letterKey(char) === key);
            this.button(this.actions, 512 + (x - (row.length - 1) / 2) * 58, 577 + y * 52, 48, 42, key,
                () => this.guess(key), !used && !this.busy && this.board.result === 'playing', used ? correct ? 0x427363 : 0x904e55 : 0x355773);
        }));
        this.actions.add(this.add.text(40, 729, t('A = A/Ă/Â · I = I/Î · S = S/Ș · T = T/Ț'), {
            fontFamily: 'Arial', fontSize: '15px', color: '#a9c8cf', wordWrap: { width: 560 }
        }));
        this.button(this.actions, 766, 741, 160, 38, t('RETRY WORD'), () => this.startRound(this.board.entry), !this.busy);
        this.button(this.actions, 943, 741, 142, 38, t('NEXT WORD'), () => this.startRound(this.deck.next()), !this.busy);
    }

    private updateCounter(): void {
        this.counter.setText(t('Wrong guesses: {0}/{1} · Difficulty: {2}/5', this.board.mistakes, this.board.mistakesAllowed, monsterConfig.difficulty));
    }

    private guess(key: string): void {
        if (!this.ready || this.busy) return;
        this.sounds.unlock();
        const result = this.board.guess(key);
        if (result === 'ignored') return;
        this.updateCounter();
        if (result === 'correct' || result === 'won') {
            this.renderLetters();
            if (result === 'won') {
                this.sounds.victory(); drawYellowFriend(this.friend.clear(), this.cell * 0.9, true);
                this.status.setText(t('SAVED! You guessed the word!')).setColor('#b7efaa');
                this.tweens.add({ targets: this.friend, y: this.friend.y - 22, duration: 240, yoyo: true, repeat: 2, ease: 'Sine.easeOut' });
                this.tweens.add({ targets: this.monster, x: this.monster.x - this.cell * 0.3, alpha: 0.4, duration: 650 });
            } else {
                this.sounds.correct(); this.status.setText(t('Good guess! Keep going.')).setColor('#b7efaa');
            }
            this.renderActions();
            return;
        }
        this.busy = true; this.sounds.wrong(); this.renderActions();
        this.status.setText(t('Wrong letter! The monster moves one square.')).setColor('#ffd199');
        this.tweens.add({ targets: this.monster, x: this.pathLeft + this.board.mistakes * this.cell,
            duration: 380, ease: 'Sine.easeInOut' });
        this.tweens.add({ targets: this.monster, scaleY: 0.88, duration: 190, yoyo: true });
        this.time.delayedCall(420, () => {
            if (result !== 'lost') {
                this.busy = false; this.renderActions();
                this.status.setText(t('Try another letter. {0} mistakes left.', this.board.mistakesAllowed - this.board.mistakes));
                return;
            }
            drawMonster(this.monster.clear(), this.cell * 0.94, true); this.sounds.gulp();
            this.tweens.add({ targets: this.friend, x: this.monster.x + this.cell * 0.18,
                y: this.monster.y - this.cell * 0.25, scale: 0, alpha: 0, angle: -35, duration: 480, ease: 'Sine.easeIn' });
            this.time.delayedCall(520, () => {
                this.busy = false; this.sounds.sad(); this.renderLetters(); this.renderActions();
                this.status.setText(t('Oh no! The monster ate the little friend. Try again!')).setColor('#ffb4a2');
                this.tweens.add({ targets: this.monster, scaleX: 1.15, scaleY: 0.88, duration: 160, yoyo: true });
            });
        });
    }
}

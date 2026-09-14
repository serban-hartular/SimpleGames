import { Scene, Sound } from 'phaser';
import { foxConfig, FoxSound } from '../config/fox';

export class FoxSounds {
    private context?: AudioContext;
    private disposed = false;
    private files: Sound.BaseSound[] = [];
    constructor(private readonly scene: Scene) {}

    static preload(scene: Scene): void {
        for (const [name, url] of Object.entries(foxConfig.sounds)) {
            if (scene.cache.audio.exists(`fox-sound-${name}`)) scene.cache.audio.remove(`fox-sound-${name}`);
            if (url) scene.load.audio(`fox-sound-${name}`, url);
        }
    }

    unlock(): void {
        if (this.disposed || typeof window.AudioContext === 'undefined') return;
        try {
            this.context ??= new AudioContext();
            if (this.context.state === 'suspended') void this.context.resume().catch(() => {});
        } catch { /* Keep the game playable without audio. */ }
    }

    play(name: FoxSound): void {
        if (this.disposed) return;
        const key = `fox-sound-${name}`;
        if (foxConfig.sounds[name] && this.scene.cache.audio.exists(key)) {
            const sound = this.scene.sound.add(key, { volume: 0.45 });
            this.files.push(sound);
            sound.once('complete', () => { this.files = this.files.filter(s => s !== sound); sound.destroy(); });
            sound.play();
            return;
        }
        const c = this.context;
        if (!c || c.state !== 'running') return;
        const now = c.currentTime;
        if (name === 'eatPie') {
            this.note(now, 0.09, 240, 80, 'triangle', 0.16);
            this.note(now + 0.09, 0.08, 190, 65, 'triangle', 0.12);
        } else if (name === 'catchChicken') {
            this.note(now, 0.12, 650, 900, 'sine', 0.13);
            this.note(now + 0.1, 0.18, 900, 1250, 'sine', 0.1);
        } else if (name === 'chickenAlert') {
            this.note(now, 0.15, 1100, 480, 'sawtooth', 0.045);
            this.note(now + 0.17, 0.1, 900, 550, 'sawtooth', 0.035);
        } else {
            this.note(now, 0.13, 210, 75, 'sawtooth', 0.09);
            this.note(now + 0.18, 0.15, 170, 60, 'sawtooth', 0.08);
        }
    }

    private note(start: number, duration: number, from: number, to: number, type: OscillatorType, volume: number): void {
        const c = this.context!;
        const oscillator = c.createOscillator(), gain = c.createGain();
        oscillator.type = type;
        oscillator.frequency.setValueAtTime(from, start);
        oscillator.frequency.exponentialRampToValueAtTime(to, start + duration);
        gain.gain.setValueAtTime(0, start);
        gain.gain.linearRampToValueAtTime(volume, start + 0.008);
        gain.gain.exponentialRampToValueAtTime(0.001, start + duration);
        oscillator.connect(gain); gain.connect(c.destination);
        oscillator.onended = () => { oscillator.disconnect(); gain.disconnect(); };
        oscillator.start(start); oscillator.stop(start + duration + 0.01);
    }

    pause(): void {
        if (this.context?.state === 'running') void this.context.suspend().catch(() => {});
    }

    resume(): void {
        if (!this.disposed && this.context?.state === 'suspended') void this.context.resume().catch(() => {});
    }

    destroy(): void {
        this.disposed = true;
        this.files.forEach(sound => sound.destroy()); this.files = [];
        if (this.context && this.context.state !== 'closed') void this.context.close().catch(() => {});
        this.context = undefined;
    }
}

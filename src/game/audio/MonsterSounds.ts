/** Short generated letter chimes, a monster growl, a gulp and round-ending melodies. */
export class MonsterSounds {
    private context?: AudioContext;
    private readonly voices = new Set<OscillatorNode>();
    private disposed = false;

    unlock(): void {
        if (this.disposed || typeof window.AudioContext === 'undefined') return;
        try {
            this.context ??= new AudioContext();
            if (this.context.state === 'suspended') void this.context.resume().catch(() => {});
        } catch { /* Sound is optional. */ }
    }
    correct(): void { this.tone(660, 880, 0.14); }
    wrong(): void { this.tone(135, 72, 0.26, 0, 'triangle'); }
    gulp(): void { this.tone(270, 60, 0.3, 0, 'triangle'); this.tone(90, 170, 0.16, 0.31); }
    victory(): void { [523, 659, 784, 1047].forEach((note, i) => this.tone(note, note, i === 3 ? 0.5 : 0.17, i * 0.17)); }
    sad(): void { [392, 330, 262, 196].forEach((note, i) => this.tone(note, note * 0.95, i === 3 ? 0.45 : 0.2, i * 0.24)); }

    private tone(from: number, to: number, duration: number, delay = 0, type: OscillatorType = 'sine'): void {
        const context = this.context;
        if (!context || this.disposed || context.state !== 'running') return;
        const start = context.currentTime + delay, voice = context.createOscillator(), gain = context.createGain();
        voice.type = type; voice.frequency.setValueAtTime(from, start);
        voice.frequency.exponentialRampToValueAtTime(to, start + duration);
        gain.gain.setValueAtTime(0, start); gain.gain.linearRampToValueAtTime(0.065, start + 0.015);
        gain.gain.exponentialRampToValueAtTime(0.001, start + duration);
        voice.connect(gain); gain.connect(context.destination); this.voices.add(voice);
        voice.onended = () => { this.voices.delete(voice); voice.disconnect(); gain.disconnect(); };
        voice.start(start); voice.stop(start + duration);
    }
    pause(): void { if (this.context?.state === 'running') void this.context.suspend().catch(() => {}); }
    resume(): void { if (!this.disposed && this.context?.state === 'suspended') void this.context.resume().catch(() => {}); }
    stop(): void { for (const voice of this.voices) voice.stop(); this.voices.clear(); }
    destroy(): void {
        this.disposed = true; this.stop();
        if (this.context && this.context.state !== 'closed') void this.context.close().catch(() => {});
        this.context = undefined;
    }
}

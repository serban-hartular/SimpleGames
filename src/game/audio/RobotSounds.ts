/** Synthesized motor tones, a bump, a descending sad phrase and a victory fanfare. */
export class RobotSounds {
    private context?: AudioContext;
    private disposed = false;
    private readonly voices = new Set<OscillatorNode>();

    unlock(): void {
        if (this.disposed || typeof window.AudioContext === 'undefined') return;
        try {
            this.context ??= new AudioContext();
            if (this.context.state === 'suspended') void this.context.resume().catch(() => {});
        } catch { /* Audio is optional. */ }
    }

    move(): void { this.tone(180, 260, 0.16, 0, 'triangle'); }
    turn(): void { this.tone(340, 480, 0.12, 0, 'sine'); }
    bump(): void { this.tone(140, 55, 0.24, 0, 'sawtooth'); }
    miss(): void {
        this.tone(392, 392, 0.2, 0, 'triangle');
        this.tone(349.23, 349.23, 0.22, 0.23, 'triangle');
        this.tone(311.13, 311.13, 0.24, 0.49, 'triangle');
        this.tone(261.63, 196, 0.55, 0.77, 'triangle');
    }
    victory(): void {
        [523.25, 659.25, 783.99, 1046.5].forEach((frequency, i) => this.tone(frequency, frequency, i === 3 ? 0.6 : 0.18, i * 0.17));
    }

    private tone(from: number, to: number, duration: number, delay = 0, type: OscillatorType = 'sine'): void {
        const context = this.context;
        if (!context || this.disposed || context.state !== 'running') return;
        const oscillator = context.createOscillator(), gain = context.createGain();
        const start = context.currentTime + delay;
        oscillator.type = type;
        oscillator.frequency.setValueAtTime(from, start);
        oscillator.frequency.exponentialRampToValueAtTime(to, start + duration);
        gain.gain.setValueAtTime(0, start);
        gain.gain.linearRampToValueAtTime(0.07, start + 0.015);
        gain.gain.exponentialRampToValueAtTime(0.001, start + duration);
        oscillator.connect(gain); gain.connect(context.destination);
        this.voices.add(oscillator);
        oscillator.onended = () => { this.voices.delete(oscillator); oscillator.disconnect(); gain.disconnect(); };
        oscillator.start(start); oscillator.stop(start + duration);
    }

    pause(): void { if (this.context?.state === 'running') void this.context.suspend().catch(() => {}); }
    resume(): void { if (!this.disposed && this.context?.state === 'suspended') void this.context.resume().catch(() => {}); }
    stop(): void {
        for (const voice of this.voices) voice.stop();
        this.voices.clear();
    }
    destroy(): void {
        this.disposed = true;
        this.stop();
        if (this.context && this.context.state !== 'closed') void this.context.close().catch(() => {});
        this.context = undefined;
    }
}

/** Synthesized cannon effects, with a flight whistle that lasts until impact. */
export class ArtillerySounds {
    private context?: AudioContext;
    private whistle?: { oscillator: OscillatorNode; gain: GainNode };
    private flying = false;
    private disposed = false;

    fire(): void {
        this.stopWhistle();
        this.flying = true;
        this.play(context => {
            if (!this.flying) return;
            this.noise(context, 0.22, 1600, 0.28);
            this.tone(context, 170, 45, 0.24, 0.3);
            const oscillator = context.createOscillator();
            const gain = context.createGain();
            const now = context.currentTime;
            oscillator.type = 'sine';
            oscillator.frequency.setValueAtTime(1500, now);
            oscillator.frequency.exponentialRampToValueAtTime(550, now + 3);
            gain.gain.setValueAtTime(0, now);
            gain.gain.linearRampToValueAtTime(0.035, now + 0.25);
            oscillator.connect(gain);
            gain.connect(context.destination);
            oscillator.onended = () => { oscillator.disconnect(); gain.disconnect(); };
            oscillator.start();
            this.whistle = { oscillator, gain };
        });
    }

    land(hit: boolean): void {
        this.stopWhistle();
        this.play(context => {
            if (hit) {
                this.noise(context, 1.1, 950, 0.45);
                this.tone(context, 110, 28, 0.85, 0.36);
            } else {
                this.noise(context, 0.15, 450, 0.12);
                this.tone(context, 95, 35, 0.22, 0.24);
            }
        });
    }

    private stopWhistle(): void {
        this.flying = false;
        if (!this.whistle || !this.context) return;
        const { oscillator, gain } = this.whistle;
        const now = this.context.currentTime;
        gain.gain.cancelScheduledValues(now);
        gain.gain.setValueAtTime(gain.gain.value, now);
        gain.gain.linearRampToValueAtTime(0, now + 0.03);
        oscillator.stop(now + 0.04);
        this.whistle = undefined;
    }

    private play(effect: (context: AudioContext) => void): void {
        if (this.disposed || typeof window.AudioContext === 'undefined') return;
        try {
            const context = this.context ??= new AudioContext();
            if (context.state === 'running') effect(context);
            else void context.resume().then(() => {
                if (!this.disposed && context.state === 'running') effect(context);
            }).catch(() => {});
        } catch {
            // Audio availability must not prevent playing the game.
        }
    }

    private envelope(context: AudioContext, duration: number, volume: number): GainNode {
        const gain = context.createGain();
        const now = context.currentTime;
        gain.gain.setValueAtTime(0, now);
        gain.gain.linearRampToValueAtTime(volume, now + 0.005);
        gain.gain.exponentialRampToValueAtTime(0.001, now + duration);
        gain.connect(context.destination);
        return gain;
    }

    private tone(context: AudioContext, from: number, to: number, duration: number, volume: number): void {
        const oscillator = context.createOscillator();
        const gain = this.envelope(context, duration, volume);
        oscillator.frequency.setValueAtTime(from, context.currentTime);
        oscillator.frequency.exponentialRampToValueAtTime(to, context.currentTime + duration);
        oscillator.connect(gain);
        oscillator.onended = () => { oscillator.disconnect(); gain.disconnect(); };
        oscillator.start();
        oscillator.stop(context.currentTime + duration + 0.01);
    }

    private noise(context: AudioContext, duration: number, cutoff: number, volume: number): void {
        const buffer = context.createBuffer(1, Math.ceil(context.sampleRate * duration), context.sampleRate);
        const data = buffer.getChannelData(0);
        for (let i = 0; i < data.length; i++) data[i] = Math.random() * 2 - 1;
        const source = context.createBufferSource();
        source.buffer = buffer;
        const filter = context.createBiquadFilter();
        filter.type = 'lowpass';
        filter.frequency.setValueAtTime(cutoff, context.currentTime);
        const gain = this.envelope(context, duration, volume);
        source.connect(filter);
        filter.connect(gain);
        source.onended = () => { source.disconnect(); filter.disconnect(); gain.disconnect(); };
        source.start();
    }

    pause(): void {
        if (this.context?.state === 'running') void this.context.suspend().catch(() => {});
    }

    resume(): void {
        if (!this.disposed && this.context?.state === 'suspended') void this.context.resume().catch(() => {});
    }

    destroy(): void {
        this.stopWhistle();
        this.disposed = true;
        if (this.context && this.context.state !== 'closed') void this.context.close().catch(() => {});
        this.context = undefined;
    }
}

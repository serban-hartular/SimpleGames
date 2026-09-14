/** Small synthesized effects; no audio assets or downloads required. */
export class DivisibilitySounds {
    private context?: AudioContext;
    private disposed = false;

    pop(): void {
        this.play(context => {
            this.tone(context, context.currentTime, 0.12, 650, 90, 'sine', 0.22);
        });
    }

    wrong(): void {
        this.play(context => {
            this.tone(context, context.currentTime, 0.24, 145, 85, 'sawtooth', 0.07);
        });
    }

    victory(): void {
        this.play(context => {
            // A rising C-major fanfare, slightly delayed after the final pop.
            const start = context.currentTime + 0.14;
            [523.25, 659.25, 783.99, 1046.5].forEach((frequency, index) => {
                this.tone(context, start + index * 0.14, index === 3 ? 0.5 : 0.19,
                    frequency, frequency, 'triangle', 0.13);
            });
        });
    }

    private play(effect: (context: AudioContext) => void): void {
        if (this.disposed || typeof window.AudioContext === 'undefined') return;
        try {
            // Created from the balloon click so browser audio unlocking can succeed.
            const context = this.context ??= new AudioContext();
            if (context.state === 'running') effect(context);
            else {
                void context.resume().then(() => {
                    if (!this.disposed && context.state === 'running') effect(context);
                }).catch(() => { /* Audio being unavailable must not interrupt play. */ });
            }
        } catch {
            // Keep the game playable on devices without an available audio output.
        }
    }

    private tone(context: AudioContext, start: number, duration: number,
        from: number, to: number, type: OscillatorType, volume: number): void {
        const oscillator = context.createOscillator();
        const envelope = context.createGain();
        oscillator.type = type;
        oscillator.frequency.setValueAtTime(from, start);
        oscillator.frequency.exponentialRampToValueAtTime(to, start + duration);
        envelope.gain.setValueAtTime(0, start);
        envelope.gain.linearRampToValueAtTime(volume, start + 0.008);
        envelope.gain.exponentialRampToValueAtTime(0.001, start + duration);
        oscillator.connect(envelope);
        envelope.connect(context.destination);
        oscillator.onended = () => {
            oscillator.disconnect();
            envelope.disconnect();
        };
        oscillator.start(start);
        oscillator.stop(start + duration + 0.01);
    }

    pause(): void {
        if (this.context?.state === 'running') void this.context.suspend().catch(() => {});
    }

    resume(): void {
        if (!this.disposed && this.context?.state === 'suspended') void this.context.resume().catch(() => {});
    }

    destroy(): void {
        this.disposed = true;
        if (this.context && this.context.state !== 'closed') void this.context.close().catch(() => {});
        this.context = undefined;
    }
}

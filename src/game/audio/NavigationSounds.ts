/** Small synthesized effects; no audio assets or downloads required. */
export class NavigationSounds {
    private context?: AudioContext;
    private disposed = false;

    unlock(): void {
        this.play(() => {});
    }

    victory(): void {
        this.play(context => {
            // A rising C-major fanfare celebrates arrival.
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
            // Unlock from a user interaction before an automatic arrival event.
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

    destroy(): void {
        this.disposed = true;
        if (this.context && this.context.state !== 'closed') void this.context.close().catch(() => {});
        this.context = undefined;
    }
}

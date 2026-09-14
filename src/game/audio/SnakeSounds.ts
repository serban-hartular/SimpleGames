/** Procedural noise effects: a crisp bite and a soft swept swish. */
export class SnakeSounds {
    private context?: AudioContext;
    private disposed = false;

    unlock(): void {
        if (this.disposed || typeof window.AudioContext === 'undefined') return;
        try {
            this.context ??= new AudioContext();
            if (this.context.state === 'suspended') void this.context.resume().catch(() => {});
        } catch {
            // Audio is optional; continue playing if the device cannot provide it.
        }
    }

    crunch(): void {
        // Three tight crackles give the bite a crunchy texture.
        this.noise(0, 0.075, 2400, 900, 0.18, 'highpass');
        this.noise(0.045, 0.08, 1800, 700, 0.13, 'highpass');
        this.noise(0.095, 0.09, 1200, 500, 0.09, 'highpass');
    }

    swish(): void {
        this.noise(0, 0.16, 2600, 450, 0.12, 'bandpass');
    }

    private noise(delay: number, duration: number, from: number, to: number,
        volume: number, type: BiquadFilterType): void {
        const context = this.context;
        if (this.disposed || !context || context.state !== 'running') return;
        const start = context.currentTime + delay;
        const buffer = context.createBuffer(1, Math.ceil(context.sampleRate * duration), context.sampleRate);
        const data = buffer.getChannelData(0);
        for (let i = 0; i < data.length; i++) data[i] = Math.random() * 2 - 1;
        const source = context.createBufferSource();
        source.buffer = buffer;
        const filter = context.createBiquadFilter();
        filter.type = type;
        filter.Q.value = 0.7;
        filter.frequency.setValueAtTime(from, start);
        filter.frequency.exponentialRampToValueAtTime(to, start + duration);
        const gain = context.createGain();
        gain.gain.setValueAtTime(0, start);
        gain.gain.linearRampToValueAtTime(volume, start + (type === 'bandpass' ? 0.035 : 0.004));
        gain.gain.exponentialRampToValueAtTime(0.001, start + duration);
        source.connect(filter);
        filter.connect(gain);
        gain.connect(context.destination);
        source.onended = () => { source.disconnect(); filter.disconnect(); gain.disconnect(); };
        source.start(start);
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

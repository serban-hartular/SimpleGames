import { languageField } from '../i18n/selector';
import { t, setLanguage } from '../i18n';
import { Scene } from 'phaser';
import { configs, defaults, clone, applySettings, SettingsKey } from './store';

type AudioControls = { pause?: () => void; resume?: () => void };
const label = (key: string) => t(key.replace(/([A-Z])/g, ' $1').toLowerCase().replace(/^./, c => c.toUpperCase()).replace(/ ([xy])$/, (_, axis: string) => ' ' + axis.toUpperCase()));

export function installSettings(scene: Scene, key: SettingsKey, audio?: AudioControls): void {
    if (!document.getElementById('game-settings-style')) {
        const style = document.createElement('style'); style.id = 'game-settings-style';
        style.textContent = `
.game-settings-button{position:fixed;top:8px;right:8px;z-index:50;padding:8px 14px;border:1px solid #8ca5b7;border-radius:6px;background:#213e55;color:white;cursor:pointer}
.game-settings{width:min(680px,90vw);max-height:85vh;box-sizing:border-box;overflow:auto;border:2px solid #ffd166;border-radius:12px;background:#182c42;color:#fff0ce;padding:24px;font:16px Arial,sans-serif;z-index:100}
.game-settings::backdrop{background:#0009}.game-settings h2{margin-top:0}.game-settings p{line-height:1.45}.game-settings fieldset{border:1px solid #54728a;margin:12px 0;padding:12px}.game-settings label{display:block;margin:12px 0}.game-settings input,.game-settings select,.game-settings textarea{display:block;width:100%;box-sizing:border-box;margin-top:6px;padding:8px;background:#102438;color:white;border:1px solid #8ca5b7;border-radius:4px;font:inherit}.game-settings textarea{min-height:125px;font-family:monospace}.game-settings button{padding:9px 12px;margin:5px;border:1px solid #8ca5b7;border-radius:4px;background:#355773;color:white;cursor:pointer}.game-settings button[type=submit]{background:#ffe09a;color:#182c42}.game-settings-error{color:#ffb8b8;white-space:pre-wrap}.game-settings-actions{position:sticky;bottom:-24px;padding:12px 0;background:#182c42}.game-settings small{color:#b9cbd7}
.game-settings input[type=checkbox]{display:inline-block;width:auto;margin:0 0 0 12px;vertical-align:middle}
`; document.head.append(style);
    }
    const open = document.createElement('button'); open.className = 'game-settings-button'; open.textContent = t("⚙ Settings");
    document.body.append(open);
    let dialog: HTMLDialogElement | undefined;
    const cleanup = () => { dialog?.remove(); dialog = undefined; open.remove(); };
    scene.events.once('shutdown', cleanup);
    open.onclick = () => {
        if (dialog) return;
        scene.input.emit('pointerup'); // release held artillery buttons before pausing
        scene.scene.pause();
        const keyboardEnabled = scene.input.keyboard?.enabled;
        if (scene.input.keyboard) scene.input.keyboard.enabled = false;
        scene.sound.pauseAll(); audio?.pause?.();
        const restore = () => {
            if (scene.input.keyboard) scene.input.keyboard.enabled = keyboardEnabled ?? true;
            scene.scene.resume(); scene.sound.resumeAll(); audio?.resume?.();
        };
        const close = () => { dialog?.remove(); dialog = undefined; restore(); open.focus(); };
        dialog = document.createElement('dialog'); dialog.className = 'game-settings'; dialog.setAttribute('aria-label', t("Game settings"));
        const title = document.createElement('h2'); title.textContent = t("{0} settings", t(({ ArtilleryGame: 'Artillery', DivisibilityGame: 'Divisibility Game', SnakeGame: 'Snake', NavigationGame: 'Caravel', FoxGame: 'Fox Raid', StreetsGame: 'Street Driver', RobotGame: 'Robot Route' })[key]));
        const help = document.createElement('p'); help.textContent = t("The game is paused. Apply restarts this game. Changes are saved in this browser; TypeScript defaults are unchanged.");
        const form = document.createElement('form');
        const language = languageField();
        const fields = document.createElement('div'); const error = document.createElement('p'); error.className = 'game-settings-error'; error.setAttribute('role', 'alert');
        let read: () => unknown;
        const render = (value: unknown) => { fields.replaceChildren(); read = editor(fields, value, defaults[key], ''); };
        render(clone(configs[key]));
        const actions = document.createElement('div'); actions.className = 'game-settings-actions';
        const button = (text: string, action: () => void) => { const b = document.createElement('button'); b.type = 'button'; b.textContent = text; b.onclick = action; actions.append(b); return b; };
        button(t("Restore Defaults"), () => { render(clone(defaults[key])); error.textContent = ''; });
        button(t("Export JSON"), () => {
            try { const blob = new Blob([JSON.stringify(read(), null, 2)], { type: 'application/json' }); const url = URL.createObjectURL(blob);
                const a = document.createElement('a'); a.href = url; a.download = `${key}-settings.json`; a.click(); URL.revokeObjectURL(url);
            } catch (e) { error.textContent = e instanceof SyntaxError ? t('{0}: enter valid JSON.', 'JSON') : t(e instanceof Error ? e.message : String(e)); }
        });
        const file = document.createElement('input'); file.type = 'file'; file.accept = '.json,application/json'; file.hidden = true;
        file.onchange = async () => {
            try { if (file.files?.[0]) { const value = JSON.parse(await file.files[0].text());
                const { validate } = await import('./store'); validate(key, value); render(value); error.textContent = '';
            } } catch (e) { error.textContent = e instanceof SyntaxError ? t('{0}: enter valid JSON.', 'JSON') : t(e instanceof Error ? e.message : String(e)); } finally { file.value = ''; }
        };
        button(t("Import JSON"), () => file.click()); button(t("Cancel"), close);
        const apply = document.createElement('button'); apply.type = 'submit'; apply.textContent = t("Apply & Restart"); actions.append(apply);
        form.append(language.element, fields, error, actions, file); dialog.append(title, help, form); document.body.append(dialog);
        // Keep game key handlers and Phaser's arrow-key capture away from form controls.
        dialog.addEventListener('keydown', event => event.stopPropagation());
        dialog.addEventListener('keyup', event => event.stopPropagation());
        dialog.addEventListener('cancel', event => { event.preventDefault(); close(); });
        form.onsubmit = event => {
            event.preventDefault();
            try {
                const persisted = applySettings(key, read());
                setLanguage(language.select.value);
                dialog?.remove(); dialog = undefined;
                if (scene.input.keyboard) scene.input.keyboard.enabled = keyboardEnabled ?? true;
                scene.scene.resume(); scene.scene.restart();
                if (!persisted) {
                    const notice = document.createElement('div'); notice.className = 'game-settings-button'; notice.textContent = t("Applied for this session; browser storage is unavailable.");
                    document.body.append(notice); window.setTimeout(() => notice.remove(), 6000);
                }
            } catch (e) { error.textContent = t(e instanceof Error ? e.message : String(e)); }
        };
        dialog.showModal();
    };
}

function editor(parent: HTMLElement, value: unknown, template: unknown, name: string): () => unknown {
    if (Array.isArray(value)) {
        const group = document.createElement('fieldset'), legend = document.createElement('legend'); legend.textContent = label(name); group.append(legend); parent.append(group);
        let values = clone(value); let readers: (() => unknown)[] = [];
        const list = document.createElement('div'); group.append(list);
        const draw = () => {
            list.replaceChildren(); readers = [];
            values.forEach((item, index) => {
                const row = document.createElement('fieldset'); list.append(row);
                readers.push(editor(row, item, (template as unknown[])[0], `${index + 1}`));
                for (const [text, offset] of [['↑', -1], ['↓', 1], [t("Remove"), 0]] as const) {
                    const b = document.createElement('button'); b.type = 'button'; b.textContent = text;
                    b.onclick = () => { try { values = readers.map(r => r()); if (offset === 0) values.splice(index, 1);
                        else if (index + offset >= 0 && index + offset < values.length) [values[index], values[index + offset]] = [values[index + offset], values[index]]; draw();
                    } catch { /* Keep invalid fields visible for correction. */ } }; row.append(b);
                }
            });
        }; draw();
        const add = document.createElement('button'); add.type = 'button'; add.textContent = t("Add entry");
        add.onclick = () => { try { values = readers.map(r => r()); values.push(clone((template as unknown[])[0])); draw(); } catch { /* correct field first */ } }; group.append(add);
        return () => readers.map(r => r());
    }
    if (value !== null && typeof value === 'object') {
        const obj = value as Record<string, unknown>, source = template as Record<string, unknown>;
        if (name === 'assets' || name === 'sounds') {
            const details = document.createElement('details'), summary = document.createElement('summary'); summary.textContent = t("Advanced: {0} (JSON)", label(name));
            const hint = document.createElement('p'); hint.textContent = name === 'sounds'
                ? t("Keys: eatPie, catchChicken, chickenAlert, dogAlert. Values are audio URLs; omit entries for generated sounds.")
                : t("Keys: fox, chicken, dog, pie. Each entry: {\"url\":\"/assets/fox.png\"}. Spritesheets also accept frameWidth, frameHeight, animation: {start, end, frameRate}.");
            const text = document.createElement('textarea'); text.value = JSON.stringify(obj, null, 2); text.setAttribute('aria-label', name); details.append(summary, hint, text); parent.append(details);
            return () => { try { return JSON.parse(text.value); } catch { throw new Error(t("{0}: enter valid JSON.", name)); } };
        }
        const group = name ? document.createElement('fieldset') : document.createElement('div');
        if (name) { const legend = document.createElement('legend'); legend.textContent = label(name); group.append(legend); } parent.append(group);
        const readers = Object.entries(obj).map(([k, v]) => [k, editor(group, v, source[k], k)] as const);
        return () => Object.fromEntries(readers.map(([k, r]) => [k, r()]));
    }
    const wrapper = document.createElement('label'); wrapper.append(document.createTextNode(label(name))); parent.append(wrapper);
    if (typeof value === 'boolean') {
        const input = document.createElement('input'); input.type = 'checkbox'; input.checked = value; wrapper.append(input);
        return () => input.checked;
    }
    if (name === 'direction') {
        const select = document.createElement('select'); for (const v of ['clockwise', 'anticlockwise']) { const o = new Option(t(v), v); select.add(o); } select.value = String(value); wrapper.append(select); return () => select.value;
    }
    const input = document.createElement('input'); input.type = 'number'; input.step = 'any'; input.value = value === null || value === 'auto' ? '' : String(value); wrapper.append(input);
    if (name === 'columns' || name === 'rows') { input.min = '2'; input.max = '20'; input.step = '1'; }
    if (name === 'stepDuration') { input.min = '200'; input.max = '2000'; input.step = 'any'; }
    if (name === 'difficulty') { input.min = '1'; input.max = '5'; input.step = '1'; }
    if (name === 'seed' || ['chickens', 'pies', 'dogs'].includes(name)) {
        const select = document.createElement('select'), automatic = name === 'seed' ? t("Random") : t("Auto");
        select.add(new Option(automatic, 'auto')); select.add(new Option(t("Number"), 'number'));
        select.value = value === null || value === 'auto' ? 'auto' : 'number'; wrapper.insertBefore(select, input);
        const sync = () => { input.disabled = select.value === 'auto'; }; select.onchange = sync; sync();
        return () => select.value === 'auto' ? (name === 'seed' ? null : 'auto') : numeric();
    }
    function numeric(): number { if (!input.value.trim() || !Number.isFinite(Number(input.value))) throw new Error(t("{0}: enter a number.", label(name))); return Number(input.value); }
    const hints: Record<string, string> = { columns: t("2–20 squares."), rows: t("2–20 squares."), stepDuration: t("200–2000 milliseconds per instruction."), speed: t("Squares per second."), appleCount: t("1–320 simultaneous apples."), landFineness: t("1–30 terrain tiles per wind-square side."), offshoreStrength: t("0–1; 0 disables offshore correction."), coastalInfluenceDistance: t("Distance in wind squares."), fullSpeed: t("Pixels per second at wind magnitude 1."), crosswindSpeedFactor: t("Fraction of full speed at 90° to the wind (0–1)."), leeway: t("Fraction of full speed when drifting upwind (0–1)."), initialAngle: t("10–80 degrees."), launchSpeed: t("Pixels per second."), gravity: t("Pixels per second squared."), hitRadius: t("Pixels from the target that count as a hit.") };
    if (hints[name]) { const help = document.createElement('small'); help.textContent = hints[name]; wrapper.append(help); }
    if (name === 'zoom') { const help = document.createElement('small'); help.textContent = t("1–10. Height = 7 + 2 × zoom; larger values mean more, smaller squares."); wrapper.append(help); }
    if (name === 'difficulty') { const help = document.createElement('small'); help.textContent = t('1–5. Higher levels add deeper branches and more misleading distances. Multiple routes remain open.'); wrapper.append(help); }
    return numeric;
}

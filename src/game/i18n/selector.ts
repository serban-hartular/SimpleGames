import { Scene } from 'phaser';
import { globalConfig } from '../config/global';
import { languages, setLanguage, t } from './index';

export function languageField(): { element: HTMLLabelElement; select: HTMLSelectElement } {
    const element = document.createElement('label'); element.append(document.createTextNode(`${t('Language')} — ${t('Global settings')}`));
    const select = document.createElement('select');
    for (const [code, language] of Object.entries(languages)) select.add(new Option(language.name, code));
    select.value = globalConfig.language; element.append(select);
    return { element, select };
}
export function installMenuLanguage(scene: Scene): void {
    const { element, select } = languageField();
    element.style.cssText = 'position:fixed;top:12px;right:12px;z-index:50;background:#182c42;color:#fff0ce;padding:10px;font:16px Arial;border:1px solid #8ca5b7;border-radius:6px';
    select.style.cssText = 'margin-left:8px;padding:6px;background:#355773;color:white';
    document.body.append(element);
    select.onchange = () => { setLanguage(select.value); scene.scene.restart(); };
    scene.events.once('shutdown', () => element.remove());
}

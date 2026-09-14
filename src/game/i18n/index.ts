import { globalConfig } from '../config/global';
import { ro } from './ro';
import { en } from './en';
export const languages = { ro: { name: 'Română', messages: ro }, en: { name: 'English', messages: en } };
export function t(key: string, ...values: unknown[]): string {
    const language = languages[globalConfig.language as keyof typeof languages] ?? languages.ro;
    return (language.messages[key] ?? en[key] ?? key).replace(/\{(\d+)\}/g, (_, i: string) => String(values[Number(i)] ?? ''));
}
export function setLanguage(language: string): void {
    if (!(language in languages)) throw new Error('Unsupported language');
    globalConfig.language = language;
    document.documentElement.lang = language;
    document.title = t('SIMPLE GAMES');
    try { localStorage.setItem('simple-games.global.language', language); } catch { /* Session only. */ }
}
export function loadLanguage(): void {
    try { const saved = localStorage.getItem('simple-games.global.language'); if (saved && saved in languages) globalConfig.language = saved; } catch { /* Use source default. */ }
    if (!(globalConfig.language in languages)) globalConfig.language = 'ro';
    document.documentElement.lang = globalConfig.language;
    document.title = t('SIMPLE GAMES');
}

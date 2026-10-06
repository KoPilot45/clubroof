import { describe, expect, it } from 'vitest';
import { LOCALES, dictionaryKeys, localeFromTag, translate } from './i18n';

describe('Mehrsprachigkeit', () => {
  it('erkennt die Sprache aus Gerätekennungen, sonst Deutsch', () => {
    expect(localeFromTag('en-US')).toBe('en');
    expect(localeFromTag('de_AT')).toBe('de');
    expect(localeFromTag('fr-FR')).toBe('de');
    expect(localeFromTag(undefined)).toBe('de');
  });

  it('Deutsch bleibt unverändert; Englisch übersetzt bekannte Texte', () => {
    expect(translate('Abmelden', 'de')).toBe('Abmelden');
    expect(translate('Abmelden', 'en')).not.toBe('Abmelden');
    expect(translate('Dieser Text steht in keinem Wörterbuch', 'en')).toBe(
      'Dieser Text steht in keinem Wörterbuch',
    );
  });

  it('erkennt Muster mit Platzhaltern und übersetzt zusammengesetzte Texte', () => {
    expect(translate('Kassenwart: Max Muster', 'en')).toBe('Treasurer: Max Muster');
    // Teile eines Textes mit „ · “ werden einzeln übersetzt, Unbekanntes bleibt
    expect(translate('Abmelden · Max Muster', 'en')).toBe(
      `${translate('Abmelden', 'en')} · Max Muster`,
    );
    // Fremde Texte mit Komma werden nicht halb übersetzt
    expect(translate('Max Muster, Einrichten und mehr', 'en')).toBe(
      'Max Muster, Einrichten und mehr',
    );
  });

  it('Platzhalter bleiben in allen Übersetzungen erhalten', () => {
    for (const l of LOCALES.filter((x) => x.code !== 'de')) {
      for (const key of dictionaryKeys(l.code)) {
        const value = translate(key, l.code);
        const a = (key.match(/\{\d+\}/g) ?? []).sort().join();
        const b = (value.match(/\{\d+\}/g) ?? []).sort().join();
        expect(b, key).toBe(a);
      }
    }
  });
});

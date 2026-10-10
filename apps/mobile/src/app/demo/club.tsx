import { MODULES, type ClubColorKey } from '@clubroof/core';
import { useState } from 'react';
import { ClubColorPicker } from '@/components/club-color';
import { DemoWizard, SummaryRow, type DemoStep } from '@/components/demo-wizard';
import { ChoiceChips, T, TextField } from '@/components/ui';
import { ThemeProvider } from '@/lib/theme';

const UNITS = ['Senioren', 'Jugend', 'Frauen & Mädchen', 'Alte Herren'];
const OPTIONAL_MODULES = MODULES.filter((m) => !('core' in m && m.core)).map((m) => ({
  value: m.key as string,
  label: m.name,
}));

/** Vorführung der Vereinseinrichtung (ohne Funktion), erreichbar bei den Demo-Zugängen der Anmeldeseite. */
export default function DemoClubSetupScreen() {
  const [color, setColor] = useState<ClubColorKey>('green');
  return (
    <ThemeProvider clubColor={color}>
      <Wizard color={color} setColor={setColor} />
    </ThemeProvider>
  );
}

function Wizard({ color, setColor }: { color: ClubColorKey; setColor: (c: ClubColorKey) => void }) {
  const [name, setName] = useState('SV Beispiel 1921 e. V.');
  const [shortName, setShortName] = useState('SV Beispiel');
  const [units, setUnits] = useState<string[]>(['Senioren', 'Jugend']);
  const [modules, setModules] = useState<string[]>(
    OPTIONAL_MODULES.slice(0, 5).map((m) => m.value),
  );
  const toggle = (list: string[], set: (l: string[]) => void) => (v: string) =>
    set(list.includes(v) ? list.filter((x) => x !== v) : [...list, v]);

  const steps: DemoStep[] = [
    {
      title: 'Verein',
      content: (
        <>
          <TextField label="Vereinsname" value={name} onChangeText={setName} maxLength={100} />
          <TextField
            label="Kurzname"
            value={shortName}
            onChangeText={setShortName}
            maxLength={40}
          />
          <ClubColorPicker value={color} onChange={setColor} />
          <T variant="caption">
            Logo und Darstellung änderst du später unter Verwaltung → Verein & Design.
          </T>
        </>
      ),
    },
    {
      title: 'Bereiche',
      content: (
        <>
          <T>
            Welche Bereiche hat dein Verein? Mannschaften werden später einem Bereich zugeordnet.
          </T>
          <ChoiceChips
            options={UNITS.map((u) => ({ value: u, label: u }))}
            selected={units}
            onToggle={toggle(units, setUnits)}
          />
        </>
      ),
    },
    {
      title: 'Funktionen',
      content: (
        <>
          <T>Welche Funktionen soll die App haben? Das lässt sich später jederzeit ändern.</T>
          <ChoiceChips
            options={OPTIONAL_MODULES}
            selected={modules}
            onToggle={toggle(modules, setModules)}
          />
        </>
      ),
    },
    {
      title: 'Dein Konto',
      content: (
        <>
          <T>Dein Konto wird die Vereinsadministration mit allen Rechten.</T>
          <TextField label="Vorname" value="Max" onChangeText={() => undefined} />
          <TextField label="Nachname" value="Mustermann" onChangeText={() => undefined} />
          <TextField
            label="E-Mail-Adresse"
            kind="email"
            value="max@sv-beispiel.example"
            onChangeText={() => undefined}
          />
        </>
      ),
    },
    {
      title: 'Zusammenfassung',
      content: (
        <>
          <SummaryRow label="Verein" value={name} />
          <SummaryRow label="Kurzname" value={shortName} />
          <SummaryRow label="Bereiche" value={units.join(', ')} />
          <SummaryRow
            label="Funktionen"
            value={modules
              .map((k) => OPTIONAL_MODULES.find((m) => m.value === k)?.label ?? k)
              .join(', ')}
          />
        </>
      ),
    },
  ];
  return (
    <DemoWizard
      title="Verein einrichten (Demo)"
      steps={steps}
      club={{ shortName, logoUrl: null }}
    />
  );
}

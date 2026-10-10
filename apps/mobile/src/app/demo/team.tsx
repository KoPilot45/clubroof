import { TEAM_TEMPLATE_INFO, type ParticipationMode, type TeamTemplate } from '@clubroof/core';
import { useState } from 'react';
import { DemoWizard, SummaryRow, type DemoStep } from '@/components/demo-wizard';
import { ChoiceChips, T, TextField } from '@/components/ui';
import { PARTICIPATION_OPTIONS } from '@/lib/team-labels';

const UNITS = ['Senioren', 'Jugend', 'Frauen & Mädchen'];
const DEADLINES = [
  { value: 'none', label: 'Keine Frist' },
  { value: '3', label: '3 Std. vorher' },
  { value: '24', label: '24 Std. vorher' },
  { value: '48', label: '48 Std. vorher' },
];
const FEATURES = [
  { value: 'statistics', label: 'Statistik' },
  { value: 'team_cash', label: 'Mannschaftskasse' },
  { value: 'fines', label: 'Strafenkatalog' },
  { value: 'tasks', label: 'Aufgaben' },
  { value: 'polls', label: 'Umfragen' },
  { value: 'documents', label: 'Dokumente' },
];

/** Vorführung der Mannschaftseinrichtung (ohne Funktion), erreichbar bei den Demo-Zugängen der Anmeldeseite. */
export default function DemoTeamSetupScreen() {
  const [name, setName] = useState('B-Jugend II');
  const [badge, setBadge] = useState('B2');
  const [ageGroup, setAgeGroup] = useState('U17');
  const [league, setLeague] = useState('Kreisliga');
  const [unit, setUnit] = useState('Jugend');
  const [template, setTemplate] = useState<TeamTemplate>('youth');
  const [mode, setMode] = useState<ParticipationMode>('active_response');
  const [deadline, setDeadline] = useState('24');
  const [features, setFeatures] = useState<string[]>(['statistics', 'tasks', 'polls']);
  const [coach, setCoach] = useState('Thomas Becker');

  const label = (list: { value: string; label: string }[], v: string) =>
    list.find((x) => x.value === v)?.label ?? v;

  const steps: DemoStep[] = [
    {
      title: 'Mannschaft',
      content: (
        <>
          <TextField label="Name" value={name} onChangeText={setName} maxLength={60} />
          <TextField label="Kürzel" value={badge} onChangeText={setBadge} maxLength={6} />
          <TextField
            label="Altersklasse (optional)"
            value={ageGroup}
            onChangeText={setAgeGroup}
            maxLength={30}
          />
          <TextField
            label="Liga (optional)"
            value={league}
            onChangeText={setLeague}
            maxLength={80}
          />
          <ChoiceChips
            label="Bereich"
            options={UNITS.map((u) => ({ value: u, label: u }))}
            selected={[unit]}
            onToggle={setUnit}
          />
        </>
      ),
    },
    {
      title: 'Vorlage & Teilnahme',
      content: (
        <>
          <ChoiceChips
            label="Vorlage"
            options={(Object.keys(TEAM_TEMPLATE_INFO) as TeamTemplate[]).map((k) => ({
              value: k,
              label: TEAM_TEMPLATE_INFO[k].name,
            }))}
            selected={[template]}
            onToggle={setTemplate}
          />
          <T variant="caption">{TEAM_TEMPLATE_INFO[template].description}</T>
          <ChoiceChips
            label="Teilnahme an Terminen"
            options={PARTICIPATION_OPTIONS}
            selected={[mode]}
            onToggle={setMode}
          />
          <ChoiceChips
            label="Absagefrist"
            options={DEADLINES}
            selected={[deadline]}
            onToggle={setDeadline}
          />
        </>
      ),
    },
    {
      title: 'Funktionen',
      content: (
        <>
          <T>Welche Funktionen soll die Mannschaft nutzen? Das ändern Trainer später selbst.</T>
          <ChoiceChips
            options={FEATURES}
            selected={features}
            onToggle={(v) =>
              setFeatures(features.includes(v) ? features.filter((x) => x !== v) : [...features, v])
            }
          />
        </>
      ),
    },
    {
      title: 'Trainerteam & Kader',
      content: (
        <>
          <TextField label="Trainer" value={coach} onChangeText={setCoach} maxLength={60} />
          <T>
            Spieler und Eltern lädst du später per E-Mail oder mit einem Mannschafts-Link bzw.
            QR-Code ein. Neue Anfragen gibst du frei, bevor jemand die App nutzen kann.
          </T>
        </>
      ),
    },
    {
      title: 'Zusammenfassung',
      content: (
        <>
          <SummaryRow label="Mannschaft" value={`${badge} · ${name}`} />
          <SummaryRow
            label="Altersklasse und Liga"
            value={[ageGroup, league].filter(Boolean).join(' · ')}
          />
          <SummaryRow label="Bereich" value={unit} />
          <SummaryRow label="Vorlage" value={TEAM_TEMPLATE_INFO[template].name} />
          <SummaryRow label="Teilnahme" value={label(PARTICIPATION_OPTIONS, mode)} />
          <SummaryRow label="Absagefrist" value={label(DEADLINES, deadline)} />
          <SummaryRow
            label="Funktionen"
            value={features.map((f) => label(FEATURES, f)).join(', ')}
          />
          <SummaryRow label="Trainer" value={coach} />
        </>
      ),
    },
  ];
  return <DemoWizard title="Mannschaft einrichten (Demo)" steps={steps} />;
}

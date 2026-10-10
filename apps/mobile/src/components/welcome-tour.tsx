import type { MeResponse } from '@clubroof/core';
import { Ionicons } from '@expo/vector-icons';
import { useState } from 'react';
import { Modal, View } from 'react-native';
import { Button, T, type IconName } from '@/components/ui';
import { useTheme } from '@/lib/theme';

type Step = { icon: IconName; title: string; text: string };

/** Schritte der Willkommens-Tour; je nach Aufgabe kommen eigene Karten dazu. */
export function tourSteps(me: MeResponse): Step[] {
  const isCoach = me.teams.some((t) => t.functions.some((f) => f !== 'player'));
  const hasChildren = me.managedPersons.some((p) => p.relation === 'child');
  const steps: Step[] = [
    {
      icon: 'hand-right-outline',
      title: `Willkommen bei ${me.club.shortName}`,
      text: 'Hier siehst du auf einen Blick, was als Nächstes ansteht: Termine, Neuigkeiten und was noch zu tun ist.',
    },
    {
      icon: 'checkmark-circle-outline',
      title: 'Zu- und Absagen mit einem Tipp',
      text: 'Auf Home und unter Termine sagst du zu oder ab. Mit „Rückgängig“ nimmst du es gleich wieder zurück.',
    },
    {
      icon: 'grid-outline',
      title: 'Alles in Kacheln',
      text: 'Unter Team, Verein und Mehr findest du die Funktionen als Kacheln. Die kleine Zeile darunter zeigt, was für dich wichtig ist.',
    },
    {
      icon: 'notifications-outline',
      title: 'Benachrichtigungen',
      text: 'Unter Mehr stellst du ein, wann du Push bekommst. Dringendes kommt immer an.',
    },
  ];
  if (hasChildren)
    steps.push({
      icon: 'people-outline',
      title: 'Deine Kinder',
      text: 'Bei Terminen siehst du die Antwort für jede Person. Zu- und Absagen gelten je Kind.',
    });
  if (isCoach)
    steps.push({
      icon: 'clipboard-outline',
      title: 'Für Trainer',
      text: 'Im Team-Menü legst du Termine an und verwaltest Kader, Aufstellung, Kasse und Funktionen deiner Mannschaft.',
    });
  if (me.canAdminister)
    steps.push({
      icon: 'shield-checkmark-outline',
      title: 'Verwaltung',
      text: 'Über Mehr → Verwaltung erreichst du Mitglieder, Rollen und Module.',
    });
  steps.push({
    icon: 'help-circle-outline',
    title: 'Hilfe jederzeit',
    text: 'Unter Mehr → Hilfe & Anleitung findest du Antworten und kannst diese Tour wiederholen.',
  });
  return steps;
}

/** Kurze Einführung beim ersten Start: wenige Karten, jederzeit überspringbar. */
export function WelcomeTour({
  me,
  visible,
  onClose,
}: {
  me: MeResponse;
  visible: boolean;
  onClose: () => void;
}) {
  const { colors, radii } = useTheme();
  const steps = tourSteps(me);
  const [index, setIndex] = useState(0);
  const step = steps[Math.min(index, steps.length - 1)]!;
  const last = index >= steps.length - 1;
  const close = () => {
    setIndex(0);
    onClose();
  };
  return (
    <Modal transparent visible={visible} animationType="fade" onRequestClose={close}>
      <View
        style={{
          flex: 1,
          justifyContent: 'center',
          padding: 24,
          backgroundColor: 'rgba(0,0,0,0.45)',
        }}
      >
        <View
          accessibilityViewIsModal
          style={{
            gap: 16,
            padding: 24,
            borderRadius: radii.lg,
            backgroundColor: colors.surface,
          }}
        >
          <View
            style={{
              alignSelf: 'center',
              width: 72,
              height: 72,
              borderRadius: 36,
              alignItems: 'center',
              justifyContent: 'center',
              backgroundColor: colors.primaryContainer,
            }}
          >
            <Ionicons name={step.icon} size={34} color={colors.onPrimaryContainer} />
          </View>
          <T variant="title" style={{ textAlign: 'center' }}>
            {step.title}
          </T>
          <T style={{ textAlign: 'center' }}>{step.text}</T>
          <View style={{ flexDirection: 'row', justifyContent: 'center', gap: 6 }}>
            {steps.map((_, i) => (
              <View
                key={i}
                style={{
                  width: i === index ? 22 : 8,
                  height: 8,
                  borderRadius: 4,
                  backgroundColor: i === index ? colors.primary : colors.border,
                }}
              />
            ))}
          </View>
          <View style={{ flexDirection: 'row', gap: 8 }}>
            {!last ? (
              <Button style={{ flex: 1 }} label="Überspringen" variant="outline" onPress={close} />
            ) : null}
            <Button
              style={{ flex: 1 }}
              label={last ? 'Los geht’s' : 'Weiter'}
              onPress={last ? close : () => setIndex(index + 1)}
            />
          </View>
        </View>
      </View>
    </Modal>
  );
}

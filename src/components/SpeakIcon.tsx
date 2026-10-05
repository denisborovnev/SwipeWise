import Ionicons from '@expo/vector-icons/Ionicons';
import { ActivityIndicator, StyleSheet, View } from 'react-native';

import { useThemeColors } from '@/constants/theme';
import type { SpeechState } from '@/speech/pronounce';

/**
 * The 🔊 icon with feedback: a spinner around it from the tap until the voice starts (that can take a few
 * seconds), a filled icon while it speaks.
 */
export function SpeakIcon({ phase, size }: { phase: SpeechState['phase']; size: number }) {
  const colors = useThemeColors();
  return (
    <View style={[styles.box, { width: size * 1.7, height: size * 1.7 }]}>
      <Ionicons
        name={phase === 'speaking' ? 'volume-high' : 'volume-high-outline'}
        size={size}
        color={colors.primary}
        style={{ opacity: phase === 'starting' ? 0.5 : 1 }}
      />
      {phase === 'starting' && (
        <ActivityIndicator
          style={StyleSheet.absoluteFill}
          size={size >= 24 ? 'large' : 'small'}
          color={colors.primary}
          accessibilityLabel="Starting the voice"
        />
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  box: { alignItems: 'center', justifyContent: 'center' },
});

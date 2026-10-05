import Ionicons from '@expo/vector-icons/Ionicons';
import { useImperativeHandle, useState, type Ref } from 'react';
import { StyleSheet, Text, useWindowDimensions, View } from 'react-native';
import { Gesture, GestureDetector } from 'react-native-gesture-handler';
import Animated, {
  Extrapolation,
  interpolate,
  useAnimatedStyle,
  useSharedValue,
  withSpring,
  withTiming,
} from 'react-native-reanimated';
import { scheduleOnRN } from 'react-native-worklets';

import { Spacing, useThemeColors } from '@/constants/theme';
import type { Answer, Word } from '@/model/types';

/** Horizontal distance after which releasing the card counts as an answer. */
const SWIPE_THRESHOLD = 110;
/** A fast flick counts even if the card didn't travel far. */
const FLICK_VELOCITY = 900;

export interface FlashCardHandle {
  /** Animates the card off screen as if swiped, then calls onAnswer. */
  answer(answer: Answer): void;
}

interface FlashCardProps {
  word: Word;
  onAnswer: (answer: Answer) => void;
  onFlip?: (showingBack: boolean) => void;
  /** Reads the word aloud; shows a 🔊 button on the back when set. */
  onSpeak?: () => void;
  ref?: Ref<FlashCardHandle>;
}

/**
 * Tap to flip between front and back. Once the back is shown, swipe right = "I remembered it",
 * swipe left = "I didn't". Render with `key={word.id}` so every word starts on the front.
 */
export function FlashCard({ word, onAnswer, onFlip, onSpeak, ref }: FlashCardProps) {
  const colors = useThemeColors();
  const { width } = useWindowDimensions();
  const [showingBack, setShowingBack] = useState(false);
  const [answered, setAnswered] = useState(false);

  const rotation = useSharedValue(0); // 0 = front, 180 = back
  const translateX = useSharedValue(0);
  const translateY = useSharedValue(0);

  const flip = () => {
    const next = !showingBack;
    setShowingBack(next);
    onFlip?.(next);
    rotation.set(withTiming(next ? 180 : 0, { duration: 300 }));
  };

  const finish = (answer: Answer) => onAnswer(answer);

  const flyOff = (answer: Answer) => {
    'worklet';
    const direction = answer === 'yes' ? 1 : -1;
    translateX.set(
      withTiming(direction * width * 1.5, { duration: 250 }, (done) => {
        if (done) {
          scheduleOnRN(finish, answer);
        }
      }),
    );
  };

  useImperativeHandle(ref, () => ({
    answer(answer: Answer) {
      if (answered) {
        return;
      }
      setAnswered(true);
      flyOff(answer);
    },
  }));

  const markAnswered = () => setAnswered(true);

  const pan = Gesture.Pan()
    .enabled(showingBack && !answered)
    .activeOffsetX([-12, 12])
    .onUpdate((e) => {
      translateX.set(e.translationX);
      translateY.set(e.translationY * 0.2);
    })
    .onEnd((e) => {
      const goesRight = translateX.get() > SWIPE_THRESHOLD || e.velocityX > FLICK_VELOCITY;
      const goesLeft = translateX.get() < -SWIPE_THRESHOLD || e.velocityX < -FLICK_VELOCITY;
      if (goesRight || goesLeft) {
        scheduleOnRN(markAnswered);
        flyOff(goesRight ? 'yes' : 'no');
      } else {
        translateX.set(withSpring(0));
        translateY.set(withSpring(0));
      }
    });

  // The 🔊 button has its own tap; the card's tap waits for it to fail, so pressing 🔊 doesn't flip.
  const speakTap = Gesture.Tap()
    .enabled(showingBack && !!onSpeak)
    .maxDistance(10)
    .onEnd(() => {
      if (onSpeak) {
        scheduleOnRN(onSpeak);
      }
    });

  const tap = Gesture.Tap()
    .enabled(!answered)
    .requireExternalGestureToFail(speakTap)
    // A drag is not a tap (otherwise swiping the front side would flip the card).
    .maxDistance(10)
    .onEnd(() => {
      scheduleOnRN(flip);
    });

  const cardStyle = useAnimatedStyle(() => ({
    transform: [
      { translateX: translateX.get() },
      { translateY: translateY.get() },
      { rotateZ: `${translateX.get() / 25}deg` },
    ],
  }));

  // Both faces rotate together; each is hidden while it faces away (opacity is a fallback for
  // Android, where backfaceVisibility is unreliable).
  const frontStyle = useAnimatedStyle(() => ({
    transform: [{ perspective: 1200 }, { rotateY: `${rotation.get()}deg` }],
    opacity: rotation.get() < 90 ? 1 : 0,
  }));
  const backStyle = useAnimatedStyle(() => ({
    transform: [{ perspective: 1200 }, { rotateY: `${rotation.get() - 180}deg` }],
    opacity: rotation.get() >= 90 ? 1 : 0,
  }));

  const rememberedOverlay = useAnimatedStyle(() => ({
    opacity: interpolate(translateX.get(), [0, SWIPE_THRESHOLD], [0, 0.85], Extrapolation.CLAMP),
  }));
  const forgottenOverlay = useAnimatedStyle(() => ({
    opacity: interpolate(translateX.get(), [-SWIPE_THRESHOLD, 0], [0.85, 0], Extrapolation.CLAMP),
  }));

  const face = [styles.face, { backgroundColor: colors.card, borderColor: colors.border }];

  return (
    <GestureDetector gesture={Gesture.Race(pan, tap)}>
      <Animated.View style={[styles.card, cardStyle]} accessibilityRole="button" accessibilityHint="Tap to flip">
        <Animated.View style={[face, frontStyle]} pointerEvents={showingBack ? 'none' : 'auto'}>
          <Text style={[styles.mainText, { color: colors.text }]}>{word.front}</Text>
        </Animated.View>

        <Animated.View style={[face, backStyle]} pointerEvents={showingBack ? 'auto' : 'none'}>
          <Text style={[styles.smallText, { color: colors.textSecondary }]}>{word.front}</Text>
          <Text style={[styles.mainText, { color: colors.text }]}>{word.back}</Text>
          {onSpeak && (
            <GestureDetector gesture={speakTap}>
              <View
                style={[styles.speak, { borderColor: colors.border }]}
                accessible
                accessibilityRole="button"
                accessibilityLabel={`Pronounce ${word.back}`}
                accessibilityActions={[{ name: 'activate' }]}
                onAccessibilityAction={() => onSpeak()}>
                <Ionicons name="volume-high-outline" size={26} color={colors.primary} />
              </View>
            </GestureDetector>
          )}
          {word.examples.length > 0 && (
            <View style={styles.examples}>
              {word.examples.map((example, i) => (
                <Text key={i} style={[styles.example, { color: colors.text }]}>
                  {example}
                </Text>
              ))}
            </View>
          )}
          <Animated.View
            style={[styles.overlay, { backgroundColor: colors.success }, rememberedOverlay]}
            pointerEvents="none">
            <Text style={styles.overlayText}>Knew it ✓</Text>
          </Animated.View>
          <Animated.View
            style={[styles.overlay, { backgroundColor: colors.danger }, forgottenOverlay]}
            pointerEvents="none">
            <Text style={styles.overlayText}>Didn&apos;t know ✗</Text>
          </Animated.View>
        </Animated.View>
      </Animated.View>
    </GestureDetector>
  );
}

const styles = StyleSheet.create({
  card: { flex: 1 },
  face: {
    ...StyleSheet.absoluteFill,
    alignItems: 'center',
    justifyContent: 'center',
    padding: Spacing.lg,
    gap: Spacing.md,
    borderRadius: 24,
    borderWidth: StyleSheet.hairlineWidth,
    overflow: 'hidden',
    backfaceVisibility: 'hidden',
  },
  mainText: { fontSize: 36, fontWeight: '700', textAlign: 'center' },
  smallText: { fontSize: 18, textAlign: 'center' },
  examples: { gap: Spacing.sm, marginTop: Spacing.sm },
  speak: {
    width: 52,
    height: 52,
    borderRadius: 26,
    borderWidth: StyleSheet.hairlineWidth,
    alignItems: 'center',
    justifyContent: 'center',
  },
  example: { fontSize: 17, fontStyle: 'italic', textAlign: 'center' },
  overlay: {
    ...StyleSheet.absoluteFill,
    alignItems: 'center',
    justifyContent: 'flex-start',
    paddingTop: Spacing.xl,
    opacity: 0,
  },
  overlayText: { color: '#FFFFFF', fontSize: 30, fontWeight: '800' },
});

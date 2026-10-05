import Ionicons from '@expo/vector-icons/Ionicons';
import { useEffect, useImperativeHandle, useState, type Ref } from 'react';
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
import type { SpeechState } from '@/speech/pronounce';

import { SpeakIcon } from './SpeakIcon';

/** Horizontal distance after which releasing the card counts as an answer (or, on the front, as browsing). */
const SWIPE_THRESHOLD = 110;
/** A fast flick counts even if the card didn't travel far. */
const FLICK_VELOCITY = 900;

export interface FlashCardHandle {
  /** Animates the card off screen as if swiped, then calls onAnswer. */
  answer(answer: Answer): void;
}

/** -1 = previous card, 1 = next card. */
export type BrowseDirection = -1 | 1;

interface FlashCardProps {
  word: Word;
  onAnswer: (answer: Answer) => void;
  onFlip?: (showingBack: boolean) => void;
  /** Reads the word aloud; shows a 🔊 button on the back when set. */
  onSpeak?: () => void;
  /** Phase of the speech started by the 🔊 button (a spinner until the voice starts). */
  speechPhase?: SpeechState['phase'];
  /** Shows a ✏️ button in the top-right corner. */
  onEdit?: () => void;
  /** Swiping the front side: left = next card, right = previous card (like turning pages), without answering. */
  onBrowse?: (direction: BrowseDirection) => void;
  /** Whether there is a previous / next card (otherwise the card bounces back). */
  canBrowse?: { previous: boolean; next: boolean };
  /** The answer given to this word earlier in the session (the user went back to it). */
  earlierAnswer?: Answer;
  /** The side the card slides in from when it appears (after browsing). */
  enterFrom?: BrowseDirection;
  ref?: Ref<FlashCardHandle>;
}

/**
 * Tap to flip between front and back. On the back, swipe right = "I remembered it", swipe left = "I didn't".
 * On the front, swipe left / right goes to the next / previous card without answering (like turning pages).
 * Render with a `key` per card so every card starts on the front.
 */
export function FlashCard({
  word,
  onAnswer,
  onFlip,
  onSpeak,
  speechPhase = 'idle',
  onEdit,
  onBrowse,
  canBrowse = { previous: false, next: false },
  earlierAnswer,
  enterFrom,
  ref,
}: FlashCardProps) {
  const colors = useThemeColors();
  const { width } = useWindowDimensions();
  const [showingBack, setShowingBack] = useState(false);
  // Answered or browsed away: the card is leaving and ignores further gestures.
  const [leaving, setLeaving] = useState(false);

  const rotation = useSharedValue(0); // 0 = front, 180 = back
  const translateX = useSharedValue(enterFrom ? enterFrom * width : 0);
  const translateY = useSharedValue(0);

  useEffect(() => {
    // Slide in after browsing (no-op otherwise).
    translateX.set(withTiming(0, { duration: 200 }));
  }, [translateX]);

  const flip = () => {
    const next = !showingBack;
    setShowingBack(next);
    onFlip?.(next);
    rotation.set(withTiming(next ? 180 : 0, { duration: 300 }));
  };

  const finish = (answer: Answer) => onAnswer(answer);
  const browse = (direction: BrowseDirection) => onBrowse?.(direction);
  const markLeaving = () => setLeaving(true);

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

  /** Slides the card out to the side it was swiped to, then shows the previous / next card. */
  const slideOff = (direction: BrowseDirection) => {
    'worklet';
    // Swipe left = next card, so the card leaves to the left (and to the right for the previous one).
    translateX.set(
      withTiming(-direction * width * 1.2, { duration: 180 }, (done) => {
        if (done) {
          scheduleOnRN(browse, direction);
        }
      }),
    );
  };

  useImperativeHandle(ref, () => ({
    answer(answer: Answer) {
      if (leaving) {
        return;
      }
      setLeaving(true);
      flyOff(answer);
    },
  }));

  const backSide = showingBack;
  const { previous: hasPrevious, next: hasNext } = canBrowse;

  const pan = Gesture.Pan()
    .enabled(!leaving && (backSide || !!onBrowse))
    .activeOffsetX([-12, 12])
    .onUpdate((e) => {
      translateX.set(e.translationX);
      translateY.set(backSide ? e.translationY * 0.2 : 0);
    })
    .onEnd((e) => {
      const goesRight = translateX.get() > SWIPE_THRESHOLD || e.velocityX > FLICK_VELOCITY;
      const goesLeft = translateX.get() < -SWIPE_THRESHOLD || e.velocityX < -FLICK_VELOCITY;
      if (backSide && (goesRight || goesLeft)) {
        scheduleOnRN(markLeaving);
        flyOff(goesRight ? 'yes' : 'no');
      } else if (!backSide && goesLeft && hasNext) {
        scheduleOnRN(markLeaving);
        slideOff(1);
      } else if (!backSide && goesRight && hasPrevious) {
        scheduleOnRN(markLeaving);
        slideOff(-1);
      } else {
        // Not far enough – or the first / last card: bounce back.
        translateX.set(withSpring(0));
        translateY.set(withSpring(0));
      }
    });

  // The 🔊 and ✏️ buttons have their own taps; the card's tap waits for them to fail, so they don't flip it.
  const speakTap = Gesture.Tap()
    .enabled(showingBack && !!onSpeak)
    .maxDistance(10)
    .onEnd(() => {
      if (onSpeak) {
        scheduleOnRN(onSpeak);
      }
    });

  const editTap = Gesture.Tap()
    .enabled(!!onEdit && !leaving)
    .maxDistance(10)
    .onEnd(() => {
      if (onEdit) {
        scheduleOnRN(onEdit);
      }
    });

  const tap = Gesture.Tap()
    .enabled(!leaving)
    .requireExternalGestureToFail(speakTap, editTap)
    // A drag is not a tap (otherwise swiping would flip the card).
    .maxDistance(10)
    .onEnd(() => {
      scheduleOnRN(flip);
    });

  const cardStyle = useAnimatedStyle(() => ({
    transform: [
      { translateX: translateX.get() },
      { translateY: translateY.get() },
      // Answer swipes (back side) tilt the card; browsing (front side) just slides it.
      { rotateZ: `${rotation.get() >= 90 ? translateX.get() / 25 : 0}deg` },
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

  // Dragging left reveals "Next ›" on the right, dragging right "‹ Previous" on the left.
  const nextHint = useAnimatedStyle(() => ({
    opacity: interpolate(translateX.get(), [-SWIPE_THRESHOLD, 0], [1, 0], Extrapolation.CLAMP),
  }));
  const previousHint = useAnimatedStyle(() => ({
    opacity: interpolate(translateX.get(), [0, SWIPE_THRESHOLD], [0, 1], Extrapolation.CLAMP),
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
          {earlierAnswer && (
            <Text style={[styles.earlier, { color: earlierAnswer === 'yes' ? colors.success : colors.danger }]}>
              {earlierAnswer === 'yes' ? '✓ Knew it' : '✗ Didn’t know'}
            </Text>
          )}
          <Text style={[styles.mainText, { color: colors.text }]}>{word.front}</Text>
          {hasPrevious && (
            <Animated.Text style={[styles.browseHint, styles.hintLeft, { color: colors.primary }, previousHint]}>
              ‹ Previous
            </Animated.Text>
          )}
          {hasNext && (
            <Animated.Text style={[styles.browseHint, styles.hintRight, { color: colors.primary }, nextHint]}>
              Next ›
            </Animated.Text>
          )}
        </Animated.View>

        <Animated.View style={[face, backStyle]} pointerEvents={showingBack ? 'auto' : 'none'}>
          <Text style={[styles.smallText, { color: colors.textSecondary }]}>{word.front}</Text>
          <Text style={[styles.mainText, { color: colors.text }]}>{word.back}</Text>
          {onSpeak && (
            <GestureDetector gesture={speakTap}>
              <View
                style={[styles.speak, { borderColor: speechPhase === 'idle' ? colors.border : colors.primary }]}
                accessible
                accessibilityRole="button"
                accessibilityLabel={`Pronounce ${word.back}`}
                accessibilityActions={[{ name: 'activate' }]}
                onAccessibilityAction={() => onSpeak()}>
                <SpeakIcon phase={speechPhase} size={26} />
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

        {onEdit && (
          <GestureDetector gesture={editTap}>
            <View
              style={styles.edit}
              accessible
              accessibilityRole="button"
              accessibilityLabel={`Edit ${word.front}`}
              accessibilityActions={[{ name: 'activate' }]}
              onAccessibilityAction={() => onEdit()}>
              <Ionicons name="create-outline" size={24} color={colors.textSecondary} />
            </View>
          </GestureDetector>
        )}
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
  edit: { position: 'absolute', top: Spacing.sm, right: Spacing.sm, padding: Spacing.sm },
  earlier: { position: 'absolute', top: Spacing.md, left: Spacing.lg, fontSize: 15, fontWeight: '600' },
  browseHint: { position: 'absolute', bottom: Spacing.lg, fontSize: 17, fontWeight: '600' },
  hintLeft: { left: Spacing.lg },
  hintRight: { right: Spacing.lg },
  overlay: {
    ...StyleSheet.absoluteFill,
    alignItems: 'center',
    justifyContent: 'flex-start',
    paddingTop: Spacing.xl,
    opacity: 0,
  },
  overlayText: { color: '#FFFFFF', fontSize: 30, fontWeight: '800' },
});

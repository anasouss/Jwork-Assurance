import { useEffect, useRef, useState, type ComponentProps } from 'react';
import { AccessibilityInfo, Animated, Pressable } from 'react-native';

export function useReducedMotion() {
  const [reduced, setReduced] = useState(true);
  useEffect(() => {
    let active = true;
    void AccessibilityInfo.isReduceMotionEnabled().then((value) => { if (active) setReduced(value); }).catch(() => {});
    const listener = AccessibilityInfo.addEventListener('reduceMotionChanged', setReduced);
    return () => { active = false; listener.remove(); };
  }, []);
  return reduced;
}

const AnimatedPressable = Animated.createAnimatedComponent(Pressable);

// Only transform is animated; layout and text measurements remain unchanged.
export function Touch({ style, ...props }: ComponentProps<typeof Pressable>) {
  const [pressed, setPressed] = useState(false);
  const scale = useRef(new Animated.Value(1)).current;
  const reduced = useReducedMotion();
  function move(value: number) {
    scale.stopAnimation();
    Animated.timing(scale, { toValue: reduced ? 1 : value, duration: 120, useNativeDriver: true }).start();
  }
  return <AnimatedPressable {...props}
    onPressIn={(event) => { setPressed(true); move(0.98); props.onPressIn?.(event); }}
    onPressOut={(event) => { setPressed(false); move(1); props.onPressOut?.(event); }}
    style={[typeof style === 'function' ? style({ pressed }) : style, { transform: [{ scale }] }]} />;
}

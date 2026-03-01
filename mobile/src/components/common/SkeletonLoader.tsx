import React, { useEffect, useRef } from 'react';
import { Animated, StyleSheet, View, ViewStyle } from 'react-native';
import { theme } from '../../theme';

interface Props {
  width?: number | string;
  height?: number;
  borderRadius?: number;
  style?: ViewStyle;
}

export default function SkeletonLoader({
  width = '100%',
  height = 16,
  borderRadius = theme.radius.sm,
  style,
}: Props) {
  const anim = useRef(new Animated.Value(0)).current;

  useEffect(() => {
    Animated.loop(
      Animated.sequence([
        Animated.timing(anim, { toValue: 1, duration: 900, useNativeDriver: false }),
        Animated.timing(anim, { toValue: 0, duration: 900, useNativeDriver: false }),
      ]),
    ).start();
  }, []);

  const bg = anim.interpolate({
    inputRange: [0, 1],
    outputRange: [theme.colors.card, theme.colors.cardElevated],
  });

  return (
    <Animated.View
      style={[
        {
          width: width as number,
          height,
          borderRadius,
          backgroundColor: bg,
        },
        style,
      ]}
    />
  );
}

export function SkeletonCard({ style }: { style?: ViewStyle }) {
  return (
    <View style={[styles.card, style]}>
      <View style={styles.row}>
        <SkeletonLoader width={80} height={14} />
        <SkeletonLoader width={60} height={14} />
      </View>
      <SkeletonLoader width="100%" height={40} style={{ marginTop: 10 }} />
      <View style={[styles.row, { marginTop: 10 }]}>
        <SkeletonLoader width="48%" height={12} />
        <SkeletonLoader width="48%" height={12} />
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  card: {
    backgroundColor: theme.colors.card,
    borderRadius: theme.radius.md,
    padding: theme.spacing.lg,
    marginBottom: theme.spacing.md,
  },
  row: {
    flexDirection: 'row',
    justifyContent: 'space-between',
  },
});

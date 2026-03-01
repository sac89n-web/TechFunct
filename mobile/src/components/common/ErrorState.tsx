import React from 'react';
import { View, Text, TouchableOpacity, StyleSheet } from 'react-native';
import { theme } from '../../theme';

interface Props {
  message?: string;
  onRetry?: () => void;
}

export default function ErrorState({
  message = 'Something went wrong',
  onRetry,
}: Props) {
  return (
    <View style={styles.container}>
      <Text style={styles.icon}>⚠️</Text>
      <Text style={styles.message}>{message}</Text>
      {onRetry && (
        <TouchableOpacity style={styles.retryBtn} onPress={onRetry} activeOpacity={0.7}>
          <Text style={styles.retryText}>Retry</Text>
        </TouchableOpacity>
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    padding: theme.spacing.xxxl,
  },
  icon: { fontSize: 40, marginBottom: theme.spacing.lg },
  message: {
    color: theme.colors.textSecondary,
    fontSize: theme.typography.base,
    textAlign: 'center',
    marginBottom: theme.spacing.xl,
  },
  retryBtn: {
    paddingHorizontal: theme.spacing.xxl,
    paddingVertical: theme.spacing.md,
    borderRadius: theme.radius.full,
    backgroundColor: theme.colors.primary,
  },
  retryText: {
    color: '#fff',
    fontWeight: theme.typography.semibold,
    fontSize: theme.typography.base,
  },
});

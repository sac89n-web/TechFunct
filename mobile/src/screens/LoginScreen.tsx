import React, { useState } from 'react';
import {
  View,
  Text,
  TouchableOpacity,
  StyleSheet,
  ActivityIndicator,
  Alert,
  Linking,
} from 'react-native';
import { useNavigation } from '@react-navigation/native';
import type { NativeStackNavigationProp } from '@react-navigation/native-stack';
import { authService } from '../api/authService';
import { theme } from '../theme';
import type { AuthStackParamList } from '../types/navigation';

type Nav = NativeStackNavigationProp<AuthStackParamList, 'Login'>;

export default function LoginScreen() {
  const navigation = useNavigation<Nav>();
  const [loading, setLoading] = useState(false);

  const handleLogin = async () => {
    setLoading(true);
    try {
      const loginUrl = await authService.getLoginUrl();
      // Open Kite auth in in-app WebView
      navigation.navigate('KiteWebAuth', { loginUrl });
    } catch {
      Alert.alert(
        'Connection Error',
        'Cannot reach TechFunct server. Please check your internet connection.',
      );
    } finally {
      setLoading(false);
    }
  };

  return (
    <View style={styles.container}>
      {/* Logo / Brand */}
      <View style={styles.brand}>
        <View style={styles.logoCircle}>
          <Text style={styles.logoText}>TF</Text>
        </View>
        <Text style={styles.appName}>TechFunct</Text>
        <Text style={styles.tagline}>Professional Market Analytics</Text>
      </View>

      {/* Feature list */}
      <View style={styles.features}>
        {[
          '📊 Real-time Market Heatmap & Radar',
          '🔬 47-Factor Strategy Scoring',
          '📈 Live Options Chain & Greeks',
          '🤖 AI Trading Assistant',
        ].map((f, i) => (
          <View key={i} style={styles.featureRow}>
            <Text style={styles.featureText}>{f}</Text>
          </View>
        ))}
      </View>

      {/* Login button */}
      <TouchableOpacity
        style={[styles.loginBtn, loading && styles.loginBtnDisabled]}
        onPress={handleLogin}
        disabled={loading}
        activeOpacity={0.85}>
        {loading ? (
          <ActivityIndicator color="#fff" />
        ) : (
          <Text style={styles.loginBtnText}>Login with Kite Connect</Text>
        )}
      </TouchableOpacity>

      <Text style={styles.disclaimer}>
        Powered by Zerodha Kite Connect API.{'\n'}
        Market data is for information only. Not financial advice.
      </Text>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: theme.colors.background,
    justifyContent: 'center',
    padding: theme.spacing.xxxl,
  },
  brand: { alignItems: 'center', marginBottom: 48 },
  logoCircle: {
    width: 80,
    height: 80,
    borderRadius: 40,
    backgroundColor: theme.colors.primary,
    justifyContent: 'center',
    alignItems: 'center',
    marginBottom: 16,
    shadowColor: theme.colors.primary,
    shadowOffset: { width: 0, height: 6 },
    shadowOpacity: 0.6,
    shadowRadius: 12,
    elevation: 10,
  },
  logoText: { color: '#fff', fontSize: 28, fontWeight: '800' },
  appName: {
    color: theme.colors.textPrimary,
    fontSize: theme.typography.xxxl,
    fontWeight: theme.typography.extrabold,
  },
  tagline: {
    color: theme.colors.textSecondary,
    fontSize: theme.typography.base,
    marginTop: 6,
  },
  features: { marginBottom: 40, gap: 12 },
  featureRow: {
    backgroundColor: theme.colors.card,
    borderRadius: theme.radius.md,
    padding: theme.spacing.md,
    borderWidth: 1,
    borderColor: theme.colors.border,
  },
  featureText: {
    color: theme.colors.textSecondary,
    fontSize: theme.typography.base,
  },
  loginBtn: {
    backgroundColor: theme.colors.primary,
    borderRadius: theme.radius.full,
    paddingVertical: 16,
    alignItems: 'center',
    shadowColor: theme.colors.primary,
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.5,
    shadowRadius: 8,
    elevation: 8,
  },
  loginBtnDisabled: { opacity: 0.7 },
  loginBtnText: {
    color: '#fff',
    fontSize: theme.typography.lg,
    fontWeight: theme.typography.bold,
  },
  disclaimer: {
    marginTop: 24,
    color: theme.colors.textMuted,
    fontSize: theme.typography.xs,
    textAlign: 'center',
    lineHeight: 18,
  },
});

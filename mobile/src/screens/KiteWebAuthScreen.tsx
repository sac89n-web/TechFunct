/**
 * In-app WebView for Kite OAuth.
 * Opens the Kite login URL and intercepts the redirect back to the backend.
 * The backend callback saves the session and redirects to /?auth=success.
 * We detect this redirect and set the user as authenticated.
 */
import React, { useCallback } from 'react';
import { StyleSheet, View, ActivityIndicator } from 'react-native';
import { WebView, WebViewNavigation } from 'react-native-webview';
import { useNavigation, useRoute } from '@react-navigation/native';
import { useAuthStore } from '../store/authStore';
import { theme } from '../theme';
import { Config } from '../config';
import type { KiteWebAuthScreenProps } from '../types/navigation';

export default function KiteWebAuthScreen() {
  const route = useRoute<KiteWebAuthScreenProps['route']>();
  const navigation = useNavigation();
  const { setAuthenticated, checkSession } = useAuthStore();
  const { loginUrl } = route.params;

  const handleNavChange = useCallback(
    async (event: WebViewNavigation) => {
      const url = event.url;
      // Kite redirects to the backend callback → backend saves session →
      // backend redirects to FrontendUrl/?auth=success
      // For mobile, we detect any URL containing "auth=success"
      if (url.includes('auth=success') || url.includes('/?auth=success')) {
        await checkSession();
        navigation.goBack();
      }
      if (url.includes('error=')) {
        navigation.goBack();
      }
    },
    [checkSession, navigation],
  );

  return (
    <View style={styles.container}>
      <WebView
        source={{ uri: loginUrl }}
        onNavigationStateChange={handleNavChange}
        startInLoadingState
        renderLoading={() => (
          <View style={styles.loading}>
            <ActivityIndicator size="large" color={theme.colors.primary} />
          </View>
        )}
        style={styles.webview}
      />
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: theme.colors.background },
  webview: { flex: 1 },
  loading: {
    ...StyleSheet.absoluteFillObject,
    justifyContent: 'center',
    alignItems: 'center',
    backgroundColor: theme.colors.background,
  },
});

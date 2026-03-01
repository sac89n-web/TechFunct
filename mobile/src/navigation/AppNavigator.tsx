import React, { useEffect } from 'react';
import { View, ActivityIndicator } from 'react-native';
import { NavigationContainer } from '@react-navigation/native';
import { createNativeStackNavigator } from '@react-navigation/native-stack';
import { useAuthStore } from '../store/authStore';
import { theme } from '../theme';
import TabNavigator from './TabNavigator';
import AuthNavigator from './AuthNavigator';
import AIAssistantScreen from '../screens/AIAssistantScreen';
import type { RootStackParamList } from '../types/navigation';

const Stack = createNativeStackNavigator<RootStackParamList>();

const linking = {
  prefixes: ['techfunct://', 'https://api.techfunctn.com'],
  config: {
    screens: {
      Main: '',
    },
  },
};

export default function AppNavigator() {
  const { isAuthenticated, isChecking, checkSession } = useAuthStore();

  useEffect(() => {
    checkSession();
  }, []);

  if (isChecking) {
    return (
      <View
        style={{
          flex: 1,
          backgroundColor: theme.colors.background,
          justifyContent: 'center',
          alignItems: 'center',
        }}>
        <ActivityIndicator size="large" color={theme.colors.primary} />
      </View>
    );
  }

  return (
    <NavigationContainer linking={linking}>
      <Stack.Navigator
        screenOptions={{
          headerShown: false,
          contentStyle: { backgroundColor: theme.colors.background },
          animation: 'fade',
        }}>
        {isAuthenticated ? (
          <>
            <Stack.Screen name="Main" component={TabNavigator} />
            <Stack.Screen
              name="AIAssistant"
              component={AIAssistantScreen}
              options={{
                headerShown: true,
                title: 'AI Trading Assistant',
                headerStyle: { backgroundColor: theme.colors.surface },
                headerTintColor: theme.colors.textPrimary,
                presentation: 'modal',
                animation: 'slide_from_bottom',
              }}
            />
          </>
        ) : (
          <Stack.Screen name="Auth" component={AuthNavigator} />
        )}
      </Stack.Navigator>
    </NavigationContainer>
  );
}

import React from 'react';
import { createNativeStackNavigator } from '@react-navigation/native-stack';
import LoginScreen from '../screens/LoginScreen';
import KiteWebAuthScreen from '../screens/KiteWebAuthScreen';
import type { AuthStackParamList } from '../types/navigation';
import { theme } from '../theme';

const Stack = createNativeStackNavigator<AuthStackParamList>();

export default function AuthNavigator() {
  return (
    <Stack.Navigator
      screenOptions={{
        headerShown: false,
        contentStyle: { backgroundColor: theme.colors.background },
      }}>
      <Stack.Screen name="Login" component={LoginScreen} />
      <Stack.Screen
        name="KiteWebAuth"
        component={KiteWebAuthScreen}
        options={{
          headerShown: true,
          title: 'Kite Login',
          headerStyle: { backgroundColor: theme.colors.surface },
          headerTintColor: theme.colors.textPrimary,
        }}
      />
    </Stack.Navigator>
  );
}

import React from 'react';
import { View, TouchableOpacity, StyleSheet, Text } from 'react-native';
import { createBottomTabNavigator } from '@react-navigation/bottom-tabs';
import { useNavigation } from '@react-navigation/native';
import type { NativeStackNavigationProp } from '@react-navigation/native-stack';
import DashboardScreen from '../screens/DashboardScreen';
import MarketRadarScreen from '../screens/MarketRadarScreen';
import StockAnalyzerScreen from '../screens/StockAnalyzerScreen';
import StrategiesScreen from '../screens/StrategiesScreen';
import OptionsScreen from '../screens/OptionsScreen';
import { theme } from '../theme';
import type { MainTabParamList, RootStackParamList } from '../types/navigation';

const Tab = createBottomTabNavigator<MainTabParamList>();

// Simple icon renderer using unicode/text (replace with react-native-vector-icons if installed)
function TabIcon({ label, focused }: { label: string; focused: boolean }) {
  const icons: Record<string, string> = {
    Dashboard: '⊞',
    MarketRadar: '◈',
    StockAnalyzer: '◉',
    Strategies: '★',
    Options: 'Ω',
  };
  return (
    <Text
      style={{
        fontSize: 18,
        color: focused ? theme.colors.primary : theme.colors.textMuted,
      }}>
      {icons[label] ?? '●'}
    </Text>
  );
}

// Floating AI button in tab bar
function AIFloatingButton() {
  const navigation = useNavigation<NativeStackNavigationProp<RootStackParamList>>();
  return (
    <View style={styles.aiButtonContainer}>
      <TouchableOpacity
        style={styles.aiButton}
        onPress={() => navigation.navigate('AIAssistant', {})}
        activeOpacity={0.85}>
        <Text style={styles.aiButtonText}>AI</Text>
      </TouchableOpacity>
    </View>
  );
}

export default function TabNavigator() {
  return (
    <Tab.Navigator
      screenOptions={({ route }) => ({
        headerShown: false,
        tabBarStyle: styles.tabBar,
        tabBarActiveTintColor: theme.colors.primary,
        tabBarInactiveTintColor: theme.colors.textMuted,
        tabBarLabelStyle: styles.tabLabel,
        tabBarIcon: ({ focused }) => <TabIcon label={route.name} focused={focused} />,
      })}>
      <Tab.Screen
        name="Dashboard"
        component={DashboardScreen}
        options={{ title: 'Home' }}
      />
      <Tab.Screen
        name="MarketRadar"
        component={MarketRadarScreen}
        options={{ title: 'Radar' }}
      />
      <Tab.Screen
        name="StockAnalyzer"
        component={StockAnalyzerScreen}
        options={{
          title: 'Analyze',
          tabBarButton: props => (
            <>
              {/* @ts-ignore */}
              <TouchableOpacity {...props} />
              <AIFloatingButton />
            </>
          ),
        }}
      />
      <Tab.Screen
        name="Strategies"
        component={StrategiesScreen}
        options={{ title: 'Top 10' }}
      />
      <Tab.Screen
        name="Options"
        component={OptionsScreen}
        options={{ title: 'Options' }}
      />
    </Tab.Navigator>
  );
}

const styles = StyleSheet.create({
  tabBar: {
    backgroundColor: theme.colors.surface,
    borderTopColor: theme.colors.border,
    borderTopWidth: 1,
    height: 60,
    paddingBottom: 6,
    paddingTop: 4,
  },
  tabLabel: {
    fontSize: theme.typography.xs,
    fontWeight: theme.typography.medium,
  },
  aiButtonContainer: {
    position: 'absolute',
    bottom: 50,
    left: '50%',
    transform: [{ translateX: -28 }],
    zIndex: 999,
  },
  aiButton: {
    width: 56,
    height: 56,
    borderRadius: 28,
    backgroundColor: theme.colors.primary,
    justifyContent: 'center',
    alignItems: 'center',
    shadowColor: theme.colors.primary,
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.6,
    shadowRadius: 8,
    elevation: 12,
  },
  aiButtonText: {
    color: '#fff',
    fontSize: 14,
    fontWeight: '700',
  },
});

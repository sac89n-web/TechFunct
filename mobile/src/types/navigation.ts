import type { NativeStackScreenProps } from '@react-navigation/native-stack';
import type { BottomTabScreenProps } from '@react-navigation/bottom-tabs';
import type { CompositeScreenProps } from '@react-navigation/native';

// Auth stack
export type AuthStackParamList = {
  Login: undefined;
  KiteWebAuth: { loginUrl: string };
};

// Main tab navigator
export type MainTabParamList = {
  Dashboard: undefined;
  MarketRadar: undefined;
  StockAnalyzer: { symbol?: string };
  Strategies: undefined;
  Options: undefined;
};

// Root stack (wraps everything)
export type RootStackParamList = {
  Auth: undefined;
  Main: undefined;
  AIAssistant: { context?: import('./index').AIContext };
  StrategyDetail: { strategyId: string };
  StockDetail: { symbol: string };
};

// Screen prop types
export type LoginScreenProps = NativeStackScreenProps<AuthStackParamList, 'Login'>;
export type KiteWebAuthScreenProps = NativeStackScreenProps<AuthStackParamList, 'KiteWebAuth'>;

export type DashboardScreenProps = CompositeScreenProps<
  BottomTabScreenProps<MainTabParamList, 'Dashboard'>,
  NativeStackScreenProps<RootStackParamList>
>;

export type MarketRadarScreenProps = CompositeScreenProps<
  BottomTabScreenProps<MainTabParamList, 'MarketRadar'>,
  NativeStackScreenProps<RootStackParamList>
>;

export type StockAnalyzerScreenProps = CompositeScreenProps<
  BottomTabScreenProps<MainTabParamList, 'StockAnalyzer'>,
  NativeStackScreenProps<RootStackParamList>
>;

export type StrategiesScreenProps = CompositeScreenProps<
  BottomTabScreenProps<MainTabParamList, 'Strategies'>,
  NativeStackScreenProps<RootStackParamList>
>;

export type OptionsScreenProps = CompositeScreenProps<
  BottomTabScreenProps<MainTabParamList, 'Options'>,
  NativeStackScreenProps<RootStackParamList>
>;

export type AIAssistantScreenProps = NativeStackScreenProps<RootStackParamList, 'AIAssistant'>;

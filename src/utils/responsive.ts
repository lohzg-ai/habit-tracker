import { Platform } from 'react-native';

export const isWeb = Platform.OS === 'web';
export const WEB_MAX_WIDTH = 520;

export const webOuter = isWeb
  ? ({ flex: 1, alignItems: 'center' as const })
  : ({ flex: 1 });

export const webInner = isWeb
  ? ({ flex: 1, width: '100%' as const, maxWidth: WEB_MAX_WIDTH })
  : ({ flex: 1, width: '100%' as const });

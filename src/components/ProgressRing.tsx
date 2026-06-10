import React from 'react';
import { View, Text, StyleSheet } from 'react-native';
import Svg, { Circle } from 'react-native-svg';

type Props = {
  progress: number; // 0–1
  size?: number;
  strokeWidth?: number;
  color?: string;
  label?: string;
  sublabel?: string;
};

export const ProgressRing: React.FC<Props> = ({
  progress,
  size = 80,
  strokeWidth = 6,
  color = '#6C63FF',
  label,
  sublabel,
}) => {
  const r = (size - strokeWidth) / 2;
  const circumference = 2 * Math.PI * r;
  const filled = circumference * Math.min(Math.max(progress, 0), 1);
  const cx = size / 2;

  return (
    <View style={{ width: size, height: size, alignItems: 'center', justifyContent: 'center' }}>
      <Svg width={size} height={size} style={StyleSheet.absoluteFill}>
        <Circle
          cx={cx}
          cy={cx}
          r={r}
          stroke="rgba(255,255,255,0.15)"
          strokeWidth={strokeWidth}
          fill="none"
        />
        <Circle
          cx={cx}
          cy={cx}
          r={r}
          stroke={color}
          strokeWidth={strokeWidth}
          fill="none"
          strokeDasharray={`${filled} ${circumference}`}
          strokeLinecap="round"
          rotation="-90"
          origin={`${cx}, ${cx}`}
        />
      </Svg>
      {label !== undefined && (
        <View style={{ alignItems: 'center' }}>
          <Text style={{ color: '#fff', fontSize: size * 0.22, fontWeight: '700' }}>{label}</Text>
          {sublabel && (
            <Text style={{ color: 'rgba(255,255,255,0.7)', fontSize: size * 0.13 }}>{sublabel}</Text>
          )}
        </View>
      )}
    </View>
  );
};

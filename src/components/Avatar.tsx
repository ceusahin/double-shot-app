import React, { useEffect, useState } from 'react';
import { View, Image, Text, StyleSheet, ViewStyle } from 'react-native';
import { colors, typography } from '../utils/theme';

interface AvatarProps {
  source?: string | null;
  name?: string;
  size?: number;
  style?: ViewStyle;
}

function getInitials(name: string): string {
  return name
    .split(' ')
    .map((n) => n[0])
    .join('')
    .toUpperCase()
    .slice(0, 2);
}

export function Avatar({ source, name = '', size = 48, style }: AvatarProps) {
  const [imageFailed, setImageFailed] = useState(false);

  useEffect(() => {
    setImageFailed(false);
  }, [source]);

  const containerStyle = [
    styles.container,
    { width: size, height: size, borderRadius: size / 2 },
    style,
  ];

  if (source && !imageFailed) {
    return (
      <Image
        source={{ uri: source, cache: 'reload' }}
        style={containerStyle}
        resizeMode="cover"
        onError={() => setImageFailed(true)}
      />
    );
  }

  return (
    <View style={[containerStyle, styles.placeholder]}>
      <Text style={[styles.initials, { fontSize: size * 0.4 }]}>
        {getInitials(name)}
      </Text>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    overflow: 'hidden',
    backgroundColor: colors.secondary,
  },
  placeholder: {
    alignItems: 'center',
    justifyContent: 'center',
  },
  initials: {
    ...typography.subtitle,
    color: colors.white,
    fontWeight: '700',
  },
});

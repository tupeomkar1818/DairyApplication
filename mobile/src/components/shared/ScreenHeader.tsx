import MaterialCommunityIcons from '@expo/vector-icons/MaterialCommunityIcons';
import { ReactNode } from 'react';
import {
  Pressable,
  StyleSheet,
  Text,
  View,
  type StyleProp,
  type TextStyle,
  type ViewStyle,
} from 'react-native';

import { amraleColors, amraleRadius, amraleSpacing, amraleTypography } from '@/src/theme/dairyTactile';

export type ScreenHeaderProps = {
  title: string;
  onBack?: () => void;
  right?: ReactNode;
  paddingTop?: number;
  titleColor?: string;
  backIconColor?: string;
  backVariant?: 'plain' | 'pill';
  titleSize?: 'md' | 'lg';
  showBorder?: boolean;
  showDivider?: boolean;
  backgroundColor?: string;
  style?: StyleProp<ViewStyle>;
  titleStyle?: StyleProp<TextStyle>;
};

export function ScreenHeader({
  title,
  onBack,
  right,
  paddingTop,
  titleColor = amraleColors.blue,
  backIconColor,
  backVariant = 'plain',
  titleSize = 'lg',
  showBorder = true,
  showDivider = false,
  backgroundColor = amraleColors.surface,
  style,
  titleStyle,
}: ScreenHeaderProps) {
  const iconColor = backIconColor ?? titleColor;

  return (
    <>
      <View
        style={[
          styles.header,
          { backgroundColor },
          showBorder && styles.headerBorder,
          paddingTop != null && { paddingTop },
          style,
        ]}
      >
        <View style={styles.row}>
          {onBack ? (
            <Pressable
              onPress={onBack}
              style={({ pressed }) => [
                backVariant === 'pill' ? styles.backBtnPill : styles.backBtn,
                pressed && styles.pressed,
              ]}
              accessibilityRole="button"
              accessibilityLabel="Go back"
            >
              <MaterialCommunityIcons
                name="arrow-left"
                size={backVariant === 'pill' ? 22 : 24}
                color={backVariant === 'pill' ? amraleColors.text : iconColor}
              />
            </Pressable>
          ) : null}
          <Text
            style={[
              styles.title,
              titleSize === 'lg' ? styles.titleLg : styles.titleMd,
              { color: titleColor },
              titleStyle,
            ]}
            numberOfLines={2}
          >
            {title}
          </Text>
          {right ? <View style={styles.rightSlot}>{right}</View> : null}
        </View>
      </View>
      {showDivider ? <View style={styles.divider} /> : null}
    </>
  );
}

const styles = StyleSheet.create({
  header: {
    paddingHorizontal: amraleSpacing.md,
    paddingBottom: amraleSpacing.sm,
  },
  headerBorder: {
    borderBottomWidth: 1,
    borderBottomColor: amraleColors.inputBorderLight,
  },
  row: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: amraleSpacing.sm,
  },
  backBtn: {
    width: 40,
    height: 40,
    alignItems: 'center',
    justifyContent: 'center',
  },
  backBtnPill: {
    width: 40,
    height: 40,
    borderRadius: 20,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: amraleColors.white,
    borderWidth: 1,
    borderColor: amraleColors.inputBorderLight,
  },
  title: {
    flex: 1,
    minWidth: 0,
    textAlign: 'left',
    fontFamily: amraleTypography.fontFamily.bold,
  },
  titleLg: {
    fontSize: 22,
  },
  titleMd: {
    fontSize: 18,
  },
  rightSlot: {
    flexShrink: 0,
  },
  divider: {
    height: 1,
    backgroundColor: amraleColors.inputBorderLight,
  },
  pressed: { opacity: 0.85 },
});

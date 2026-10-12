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
import { useStrings } from '@/src/i18n/useStrings';

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
  /**
   * Caps and centers the title row (the header background and border stay full-bleed) so the title lines up with
   * centered page content on tablets/desktops. Omit for the default full-width row.
   */
  contentMaxWidth?: number;
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
  contentMaxWidth,
}: ScreenHeaderProps) {
  const t = useStrings('common');
  const iconColor = backIconColor ?? titleColor;
  const icon = (
    <MaterialCommunityIcons
      name="arrow-left"
      size={backVariant === 'pill' ? 22 : 24}
      color={backVariant === 'pill' ? amraleColors.text : iconColor}
    />
  );

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
        <View style={[styles.row, contentMaxWidth != null && [styles.rowCentered, { maxWidth: contentMaxWidth }]]}>
          {onBack ? (
            <Pressable
              onPress={onBack}
              style={({ pressed }) => [styles.backBtn, pressed && styles.pressed]}
              hitSlop={4}
              accessibilityRole="button"
              accessibilityLabel={t.a11y.goBack}
            >
              {backVariant === 'pill' ? <View style={styles.backBtnPill}>{icon}</View> : icon}
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
  rowCentered: {
    width: '100%',
    alignSelf: 'center',
  },
  /** 44px touch target (web ignores hitSlop); the -2 margin keeps the original 40px layout footprint. */
  backBtn: {
    width: 44,
    height: 44,
    margin: -2,
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

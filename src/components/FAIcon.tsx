import { Stack, SxProps } from '@mui/material';
import { Bot, Calendar, FileCheck, Receipt, Truck } from 'lucide-react';
import type { ComponentType, CSSProperties } from 'react';

// ----------------------------------------------------------------------

export type AppIconProps = {
  size?: number | string;
  color?: string;
  strokeWidth?: number | string;
  style?: CSSProperties;
  className?: string;
};

export type AppIcon = ComponentType<AppIconProps>;

// ----------------------------------------------------------------------

const iconMap = {
  nfe: Receipt,
  calendar: Calendar,
  truck: Truck,
  bot: Bot,
  cte: FileCheck,
};

export type FAIconName = keyof typeof iconMap;

// ----------------------------------------------------------------------

export function FAIcon({
  icon,
  color,
  fontSize = 14,
  strokeWidth = 1.8,
  sx,
}: {
  icon: FAIconName | AppIcon;
  color?: string;
  fontSize?: number;
  strokeWidth?: number;
  sx?: SxProps;
}) {
  const Icon = typeof icon === 'string' ? iconMap[icon] : icon;

  return (
    <Stack
      sx={{
        alignItems: 'center',
        justifyContent: 'center',
        width: fontSize,
        height: fontSize,
        ...sx,
      }}
    >
      <Icon color={color} size={fontSize} strokeWidth={strokeWidth} />
    </Stack>
  );
}

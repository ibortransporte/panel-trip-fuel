import { Button, Stack, SxProps, useTheme } from '@mui/material';
import { FAIcon, type FAIconName } from 'src/components/FAIcon';

// ----------------------------------------------------------------------

export type SegmentedTabOption<T extends string> = {
  value: T;
  label: string;
  icon?: FAIconName;
};

export function SegmentedTabs<T extends string>({
  value,
  onChange,
  options,
  fullWidth,
  sx,
}: {
  value: T;
  onChange: (value: T) => void;
  options: SegmentedTabOption<T>[];
  fullWidth?: boolean;
  sx?: SxProps;
}) {
  const theme = useTheme();

  return (
    <Stack
      sx={{
        flexShrink: 0,
        alignSelf: 'start',
        flexDirection: 'row',
        overflow: 'hidden',
        border: theme.base.styles.border,
        borderRadius: theme.base.styles.radius,
        height: 28,
        // a long set scrolls sideways instead of breaking the labels
        maxWidth: '100%',
        overflowX: 'auto',
        '& .MuiButton-root': { flexShrink: 0, whiteSpace: 'nowrap' },
        ...(fullWidth && { width: '100%' }),
        ...sx,
      }}
    >
      {options.map((option) => (
        <Button
          key={option.value}
          variant={value === option.value ? 'contained' : undefined}
          color="inherit"
          size="small"
          startIcon={option.icon ? <FAIcon icon={option.icon} /> : undefined}
          onClick={() => onChange(option.value)}
          sx={{
            borderRadius: 0,
            px: 1.5,
            height: 28,
            paddingTop: 0,
            paddingBottom: '1px',
            ...(fullWidth && { flex: 1 }),
          }}
        >
          {option.label}
        </Button>
      ))}
    </Stack>
  );
}

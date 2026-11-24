import { TextOverflow, toast } from '@fluxu-labs/lib';
import { Stack, SxProps, Typography } from '@mui/material';

// ----------------------------------------------------------------------

const copiar = (texto: string) => {
  void navigator.clipboard.writeText(texto);
  toast.info('Dado copiado!', { id: 'clipboard', duration: 1000 });
};

/** A field that copies its value when clicked, as on the CT-e panel. */
export function DataItem({
  label,
  value,
  sx,
}: {
  label: string;
  value: string | number | null;
  sx?: SxProps;
}) {
  return (
    <Stack
      onClick={() => copiar(String(value || ''))}
      // minWidth 0: side by side in a row, a long value is cut instead of
      // pushing the other one out
      sx={{ gap: 0.25, cursor: 'pointer', minWidth: 0, ...sx }}
    >
      <Typography sx={{ color: 'text.secondary' }}>{label}</Typography>
      <TextOverflow>{String(value || '-')}</TextOverflow>
    </Stack>
  );
}

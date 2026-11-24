// ----------------------------------------------------------------------

export const formatCurrency = (value: number | null | undefined): string => {
  if (value === null || value === undefined) return 'R$ -';
  return value.toLocaleString('pt-br', {
    style: 'currency',
    currency: 'BRL',
  });
};

export const formatWeight = (
  value: number | null | undefined,
  { hideSymbol }: { hideSymbol?: boolean } = {},
): string => {
  if (value === null || value === undefined) return '-t';
  const formatted = value
    .toLocaleString('pt-br', {
      maximumFractionDigits: 1,
      minimumFractionDigits: 1,
    })
    .replaceAll('.', '')
    .replace(',', '.');
  if (hideSymbol) return formatted;
  return formatted + ' kg';
};

export const formatCnpj = (value: string): string => {
  const digits = value.replace(/\D/g, '');
  if (digits.length !== 14) return value;
  return digits.replace(
    /^(\d{2})(\d{3})(\d{3})(\d{4})(\d{2})$/,
    '$1.$2.$3/$4-$5',
  );
};

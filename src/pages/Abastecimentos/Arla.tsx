import { useQuery } from '@apollo/client/react';
import {
  Chip,
  DateRange,
  DateRangePicker,
  Filters,
  PanelBase,
} from '@fluxu-labs/lib';
import { Stack, Typography, useTheme } from '@mui/material';
import { format } from 'date-fns';
import { ReactNode, useMemo, useState } from 'react';
import {
  GetLiberacoesArlaDocument,
  GetVinculosArlaDocument,
} from 'src/@types/generated/types';
import { FAIcon } from 'src/components/FAIcon';
import { SegmentedTabs } from 'src/components/SegmentedTabs';
import { ArlaView } from './ArlaView';
import {
  Arla as ArlaType,
  Decisao,
  DECISAO_COLORS,
  DECISAO_LABELS,
  Filtro,
  FILTRO_LABELS,
  formatMoeda,
  formatNumero,
  gravadoComAlerta,
  LIBERACAO_COLORS,
  LIBERACAO_LABELS,
  LiberacaoArla,
  LiberacaoStatus,
  MODO_OBSERVACAO,
  MOTIVO_ARLA_LABELS,
  podeLiberarArla,
  POLL_MS,
  ultimos7Dias,
} from './utils';

// ----------------------------------------------------------------------

export function Arla({ abas }: { abas: ReactNode }) {
  const theme = useTheme();
  const [range, setRange] = useState<DateRange>(ultimos7Dias);

  // the dates are the SQL Server's local time, with no offset
  const { data, loading } = useQuery(GetVinculosArlaDocument, {
    variables: { desde: format(range.start, "yyyy-MM-dd'T'HH:mm:ss") },
    pollInterval: POLL_MS,
  });

  const arlas = useMemo(
    () =>
      (data?.trip_fuel_vinculo_arla ?? []).filter(
        (arla) => new Date(arla.verificado_em) <= range.end,
      ),
    [data, range.end],
  );

  const ids = useMemo(() => arlas.map((arla) => arla.id_abaposto), [arlas]);
  const { data: liberacoesData, refetch: refetchLiberacoes } = useQuery(
    GetLiberacoesArlaDocument,
    { variables: { ids }, skip: ids.length === 0, pollInterval: POLL_MS },
  );
  const liberacoes = useMemo(
    () =>
      new Map(
        (liberacoesData?.trip_fuel_arla_liberado ?? []).map((liberacao) => [
          liberacao.id_abaposto,
          liberacao,
        ]),
      ),
    [liberacoesData],
  );

  // ----------------------------------------------------------------------

  const [searchString, setSearchString] = useState('');
  const [searchOrder, setSearchOrder] = useState<'asc' | 'desc'>('desc');
  const [filtro, setFiltro] = useState<Filtro>('para_liberar');

  const contagem = useMemo(
    () =>
      Object.fromEntries(
        (Object.keys(FILTRO_LABELS) as Filtro[]).map((f) => [
          f,
          arlas.filter((a) => noFiltro(a, f, liberacoes)).length,
        ]),
      ) as Record<Filtro, number>,
    [arlas, liberacoes],
  );

  const alertas = [...liberacoes.values()].filter(gravadoComAlerta).length;

  const lista = useMemo(() => {
    const busca = searchString.trim().toLowerCase();
    return Array.from(arlas)
      .filter(
        (arla) =>
          !busca ||
          arla.placa.toLowerCase().includes(busca) ||
          arla.numviag.includes(busca) ||
          (arla.codposto ?? '').toLowerCase().includes(busca),
      )
      .filter((arla) => noFiltro(arla, filtro, liberacoes))
      .sort((a, b) => {
        const diff =
          new Date(a.data_abastecimento).getTime() -
          new Date(b.data_abastecimento).getTime();
        return searchOrder === 'asc' ? diff : -diff;
      });
  }, [arlas, liberacoes, searchString, searchOrder, filtro]);

  // ----------------------------------------------------------------------

  const [abertoId, setAbertoId] = useState<number | null>(null);
  // looked up on every render, so the open one follows the polling
  const aberto = arlas.find((arla) => arla.id_abaposto === abertoId) ?? null;

  return (
    <PanelBase.Root floating>
      <PanelBase.Container floating size="xl">
        <PanelBase.Header
          content="Vínculo de abastecimentos"
          actions={
            <Stack sx={{ flexDirection: 'row', gap: 1, alignItems: 'center' }}>
              {MODO_OBSERVACAO && (
                <Chip dense color={theme.palette.info.main}>
                  Observação
                </Chip>
              )}
              <DateRangePicker
                range={range}
                onChange={(novo) => setRange(novo)}
              />
            </Stack>
          }
          bottomComponent={
            <Stack sx={{ gap: 1 }}>
              {abas}
              {alertas > 0 && (
                <Typography sx={{ color: theme.palette.error.main }}>
                  {alertas} ARLA gravado(s) pelo bot mudaram no sistema legado.
                  Veja em Liberados.
                </Typography>
              )}
              <SegmentedTabs
                value={filtro}
                onChange={setFiltro}
                options={(Object.keys(FILTRO_LABELS) as Filtro[]).map(
                  (value) => ({
                    value,
                    label:
                      value === 'todos'
                        ? FILTRO_LABELS[value]
                        : `${FILTRO_LABELS[value]} (${contagem[value]})`,
                  }),
                )}
              />
              <Filters.SearchAndSort
                searchString={searchString}
                setSearchString={setSearchString}
                searchOrder={searchOrder}
                setSearchOrder={setSearchOrder}
                sx={{ p: 0, border: 'none' }}
              />
            </Stack>
          }
        />

        <PanelBase.VirtualLazyList
          items={loading && !data ? [] : lista}
          loading={loading && !data}
          estimateSize={70}
          renderItem={({ item }) => (
            <ArlaRow
              arla={item}
              liberacao={liberacoes.get(item.id_abaposto)}
              selected={item.id_abaposto === abertoId}
              onClick={() => setAbertoId(item.id_abaposto)}
            />
          )}
        />
      </PanelBase.Container>

      {!!aberto && (
        <ArlaView
          key={aberto.id_abaposto}
          arla={aberto}
          liberacao={liberacoes.get(aberto.id_abaposto)}
          onChanged={() => void refetchLiberacoes()}
          onClose={() => setAbertoId(null)}
        />
      )}
    </PanelBase.Root>
  );
}

// ----------------------------------------------------------------------

function ArlaRow({
  arla,
  liberacao,
  selected,
  onClick,
}: {
  arla: ArlaType;
  liberacao: LiberacaoArla | undefined;
  selected: boolean;
  onClick: () => void;
}) {
  const theme = useTheme();
  const decisao = arla.decisao as Decisao;

  return (
    <PanelBase.ListItem
      onClick={onClick}
      selected={selected}
      sx={{ p: 1, gap: 1 }}
    >
      <Stack
        sx={{
          flexDirection: 'row',
          gap: 2,
          alignItems: 'center',
          justifyContent: 'space-between',
        }}
      >
        <Stack
          sx={{
            flexDirection: 'row',
            gap: 0.5,
            alignItems: 'center',
            minWidth: 0,
          }}
        >
          <FAIcon icon="truck" />
          <Typography noWrap>
            {arla.placa} · Viagem {arla.numviag}
          </Typography>
        </Stack>

        <Stack
          sx={{
            flexDirection: 'row',
            gap: 0.5,
            alignItems: 'center',
            flexShrink: 0,
          }}
        >
          <FAIcon icon="calendar" />
          <Typography noWrap>
            {format(new Date(arla.data_abastecimento), 'dd/MM/yyyy HH:mm')}
          </Typography>
        </Stack>
      </Stack>

      <Stack
        sx={{
          flexDirection: 'row',
          gap: 1,
          alignItems: 'center',
          justifyContent: 'space-between',
        }}
      >
        <Typography noWrap sx={{ color: 'text.secondary', minWidth: 0 }}>
          {arla.codposto ? `Posto ${arla.codposto}` : 'Posto não informado'} ·{' '}
          {formatNumero(arla.litros, 'L')} · {formatNumero(arla.odometro, 'km')}{' '}
          · {formatMoeda(arla.valor)} ·{' '}
          {formatNumero(arla.percentual, '% do diesel')}
        </Typography>

        <Stack
          sx={{
            flexDirection: 'row',
            gap: 0.75,
            alignItems: 'center',
            flexShrink: 0,
          }}
        >
          {gravadoComAlerta(liberacao) ? (
            <Chip dense color={theme.palette.error.main}>
              Gravado com alerta
            </Chip>
          ) : liberacao ? (
            <Chip
              dense
              color={
                theme.palette[
                  LIBERACAO_COLORS[liberacao.status as LiberacaoStatus]
                ].main
              }
            >
              {LIBERACAO_LABELS[liberacao.status as LiberacaoStatus]}
            </Chip>
          ) : (
            <Chip dense color={theme.palette[DECISAO_COLORS[decisao]].main}>
              {DECISAO_LABELS[decisao]}
            </Chip>
          )}
        </Stack>
      </Stack>

      {!!arla.motivo && (
        <Typography noWrap sx={{ color: 'text.secondary' }}>
          {MOTIVO_ARLA_LABELS[arla.motivo] ?? arla.motivo}
        </Typography>
      )}
    </PanelBase.ListItem>
  );
}

// ----------------------------------------------------------------------

/** Whether an ARLA is in the filter picked. */
function noFiltro(
  arla: ArlaType,
  filtro: Filtro,
  liberacoes: Map<number, LiberacaoArla>,
): boolean {
  const liberacao = liberacoes.get(arla.id_abaposto);
  switch (filtro) {
    case 'para_liberar':
      return podeLiberarArla(arla, liberacao);
    case 'excecoes':
      return arla.decisao === 'excecao';
    case 'liberados':
      return !!liberacao;
    case 'todos':
      return true;
  }
}

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
  GetLiberacoesDocument,
  GetVinculosAbastecimentoDocument,
} from 'src/@types/generated/types';
import { FAIcon } from 'src/components/FAIcon';
import { SegmentedTabs } from 'src/components/SegmentedTabs';
import { Arla } from './Arla';
import {
  Comparacao,
  COMPARACAO_COLORS,
  COMPARACAO_LABELS,
  Decisao,
  DECISAO_COLORS,
  DECISAO_LABELS,
  Filtro,
  FILTRO_LABELS,
  formatNumero,
  gravadoComAlerta,
  Liberacao,
  LIBERACAO_COLORS,
  LIBERACAO_LABELS,
  LiberacaoStatus,
  MODO_OBSERVACAO,
  podeLiberar,
  POLL_MS,
  ultimos7Dias,
  Vinculo,
} from './utils';
import { VinculoView } from './VinculoView';

// ----------------------------------------------------------------------

/** Which fuelings the page shows: each has its own bot decisions. */
type Aba = 'diesel' | 'arla';

const ABA_LABELS: Record<Aba, string> = {
  diesel: 'Diesel',
  arla: 'ARLA',
};

export default function Abastecimentos() {
  const [aba, setAba] = useState<Aba>('diesel');

  const abas = (
    <SegmentedTabs
      fullWidth
      value={aba}
      onChange={setAba}
      options={(Object.keys(ABA_LABELS) as Aba[]).map((value) => ({
        value,
        label: ABA_LABELS[value],
      }))}
    />
  );

  return aba === 'diesel' ? <Diesel abas={abas} /> : <Arla abas={abas} />;
}

// ----------------------------------------------------------------------

function Diesel({ abas }: { abas: ReactNode }) {
  const theme = useTheme();
  const [range, setRange] = useState<DateRange>(ultimos7Dias);

  // the view's dates are the SQL Server's local time, with no offset
  const { data, loading } = useQuery(GetVinculosAbastecimentoDocument, {
    variables: { desde: format(range.start, "yyyy-MM-dd'T'HH:mm:ss") },
    pollInterval: POLL_MS,
  });

  const vinculos = useMemo(
    () =>
      (data?.trip_fuel_view_vinculos ?? []).filter(
        (vinculo) => new Date(vinculo.verificado_em) <= range.end,
      ),
    [data, range.end],
  );

  const ids = useMemo(
    () => vinculos.map((vinculo) => vinculo.viagem_abastecimento_id),
    [vinculos],
  );
  const { data: liberacoesData, refetch: refetchLiberacoes } = useQuery(
    GetLiberacoesDocument,
    { variables: { ids }, skip: ids.length === 0, pollInterval: POLL_MS },
  );
  const liberacoes = useMemo(
    () =>
      new Map(
        (liberacoesData?.trip_fuel_vinculo_liberado ?? []).map((liberacao) => [
          liberacao.viagem_abastecimento_id,
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
          vinculos.filter((v) => noFiltro(v, f, liberacoes)).length,
        ]),
      ) as Record<Filtro, number>,
    [vinculos, liberacoes],
  );

  const alertas = [...liberacoes.values()].filter(gravadoComAlerta).length;

  const lista = useMemo(() => {
    const busca = searchString.trim().toLowerCase();
    return Array.from(vinculos)
      .filter(
        (vinculo) =>
          !busca ||
          vinculo.placa.toLowerCase().includes(busca) ||
          vinculo.numviag.includes(busca) ||
          (vinculo.nome_posto ?? '').toLowerCase().includes(busca),
      )
      .filter((vinculo) => noFiltro(vinculo, filtro, liberacoes))
      .sort((a, b) => {
        const diff =
          new Date(a.verificado_em).getTime() -
          new Date(b.verificado_em).getTime();
        return searchOrder === 'asc' ? diff : -diff;
      });
  }, [vinculos, liberacoes, searchString, searchOrder, filtro]);

  // ----------------------------------------------------------------------

  const [abertoId, setAbertoId] = useState<number | null>(null);
  // looked up on every render, so the open one follows the polling
  const aberto =
    vinculos.find((vinculo) => vinculo.viagem_abastecimento_id === abertoId) ??
    null;

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
                  {alertas} vínculo(s) gravado(s) pelo bot mudaram no sistema
                  legado. Veja em Liberados.
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
            <VinculoRow
              vinculo={item}
              liberacao={liberacoes.get(item.viagem_abastecimento_id)}
              selected={item.viagem_abastecimento_id === abertoId}
              onClick={() => setAbertoId(item.viagem_abastecimento_id)}
            />
          )}
        />
      </PanelBase.Container>

      {!!aberto && (
        <VinculoView
          key={aberto.viagem_abastecimento_id}
          vinculo={aberto}
          liberacao={liberacoes.get(aberto.viagem_abastecimento_id)}
          onChanged={() => void refetchLiberacoes()}
          onClose={() => setAbertoId(null)}
        />
      )}
    </PanelBase.Root>
  );
}

// ----------------------------------------------------------------------

function VinculoRow({
  vinculo,
  liberacao,
  selected,
  onClick,
}: {
  vinculo: Vinculo;
  liberacao: Liberacao | undefined;
  selected: boolean;
  onClick: () => void;
}) {
  const theme = useTheme();
  const decisao = vinculo.decisao as Decisao;
  const comparacao = vinculo.comparacao as Comparacao;

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
            {vinculo.placa} · Viagem {vinculo.numviag}
            {vinculo.sequencia !== null && ` · ${vinculo.sequencia}º previsto`}
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
            {format(new Date(vinculo.verificado_em), 'dd/MM/yyyy HH:mm')}
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
          {vinculo.nome_posto ?? 'Posto não informado'} ·{' '}
          {formatNumero(vinculo.litros_previsto, 'L')}
          {vinculo.id_abaposto !== null &&
            ` · ${formatNumero(vinculo.dif_km, 'km', { sinal: true })}, ${formatNumero(vinculo.dif_litros, 'L', { sinal: true })}`}
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
          {/* how the bot did, once the operator linked it */}
          {comparacao !== 'pendente' && (
            <Chip
              dense
              color={theme.palette[COMPARACAO_COLORS[comparacao]].main}
            >
              {COMPARACAO_LABELS[comparacao]}
            </Chip>
          )}
        </Stack>
      </Stack>
    </PanelBase.ListItem>
  );
}

// ----------------------------------------------------------------------

/** Whether a link is in the filter picked. */
function noFiltro(
  vinculo: Vinculo,
  filtro: Filtro,
  liberacoes: Map<number, Liberacao>,
): boolean {
  const liberacao = liberacoes.get(vinculo.viagem_abastecimento_id);
  switch (filtro) {
    case 'para_liberar':
      return podeLiberar(vinculo, liberacao);
    // what is still for the operator, as trip_fuel.view_excecoes
    case 'excecoes':
      return vinculo.decisao === 'excecao' && vinculo.comparacao === 'pendente';
    case 'liberados':
      return !!liberacao;
    case 'todos':
      return true;
  }
}

import { DateRange } from '@fluxu-labs/lib';
import { endOfDay, startOfDay, subDays } from 'date-fns';
import {
  DeleteLiberacaoArlaDocument,
  DeleteLiberacaoArlaMutation,
  DeleteLiberacaoArlaMutationVariables,
  DeleteLiberacaoDocument,
  DeleteLiberacaoMutation,
  DeleteLiberacaoMutationVariables,
  GetLiberacoesArlaQuery,
  GetLiberacoesQuery,
  GetVinculosAbastecimentoQuery,
  GetVinculosArlaQuery,
  InsertLiberacaoArlaDocument,
  InsertLiberacaoArlaMutation,
  InsertLiberacaoArlaMutationVariables,
  InsertLiberacaoDocument,
  InsertLiberacaoMutation,
  InsertLiberacaoMutationVariables,
} from 'src/@types/generated/types';
import { apolloClient } from 'src/utils/apollo';

// ----------------------------------------------------------------------

// the bot runs every 15 min: a minute is enough to follow it
export const POLL_MS = 60_000;

/** What the person has to look at, first. */
export type Filtro = 'para_liberar' | 'excecoes' | 'liberados' | 'todos';

export const FILTRO_LABELS: Record<Filtro, string> = {
  para_liberar: 'Para liberar',
  excecoes: 'Exceções',
  liberados: 'Liberados',
  todos: 'Todos',
};

export const ultimos7Dias = (): DateRange => ({
  start: startOfDay(subDays(new Date(), 6)),
  end: endOfDay(new Date()),
});

// ----------------------------------------------------------------------

export type Vinculo =
  GetVinculosAbastecimentoQuery['trip_fuel_view_vinculos'][number];

export type Liberacao =
  GetLiberacoesQuery['trip_fuel_vinculo_liberado'][number];

export type Decisao = 'vincular' | 'excecao' | 'aguardando';

/** The bot's decision against what the operator did (view_vinculos). */
export type Comparacao = 'acertou' | 'errou' | 'operador_vinculou' | 'pendente';

type Cor = 'success' | 'warning' | 'error' | 'info';

export const DECISAO_LABELS: Record<Decisao, string> = {
  vincular: 'Vincular',
  excecao: 'Exceção',
  aguardando: 'Aguardando',
};

export const DECISAO_COLORS: Record<Decisao, Cor> = {
  vincular: 'success',
  excecao: 'warning',
  aguardando: 'info',
};

export const COMPARACAO_LABELS: Record<Comparacao, string> = {
  acertou: 'Confere',
  errou: 'Errou',
  operador_vinculou: 'Operador',
  pendente: 'Pendente',
};

export const COMPARACAO_COLORS: Record<Comparacao, Cor> = {
  acertou: 'success',
  errou: 'error',
  operador_vinculou: 'info',
  pendente: 'warning',
};

// the same texts as frota-automacao-api/sql/view_excecoes.sql, plus the
// reasons to wait
export const MOTIVO_LABELS: Record<string, string> = {
  litros_acima:
    'Diferença de litros acima da tolerância: precisa de justificativa',
  acima_tanque: 'Litros acima da capacidade do tanque do veículo',
  odometro_fora:
    'Abastecimento no posto previsto, mas odômetro fora da tolerância',
  posto_diferente: 'Abastecimento com odômetro compatível em outro posto',
  varios_candidatos: 'Mais de um abastecimento compatível (venda duplicada?)',
  sem_odometro_previsto: 'Previsto sem odômetro',
  sem_abastecimento: 'O abastecimento ainda não aconteceu',
  viagem_anterior_aberta: 'A placa tem uma viagem aberta mais antiga',
};

/** trip_fuel.vinculo_liberado.status, set by the bot. */
export type LiberacaoStatus =
  | 'liberado'
  | 'gravado'
  | 'recusado'
  | 'erro'
  | 'desfeito';

export const LIBERACAO_LABELS: Record<LiberacaoStatus, string> = {
  liberado: 'Liberado',
  gravado: 'Gravado',
  recusado: 'Recusado',
  erro: 'Erro',
  desfeito: 'Desfeito',
};

export const LIBERACAO_COLORS: Record<LiberacaoStatus, Cor> = {
  liberado: 'info',
  gravado: 'success',
  recusado: 'warning',
  erro: 'error',
  desfeito: 'warning',
};

/**
 * Whether the bot writes to the legacy system (BOT_DRY_RUN in the bot's
 * compose). The panel cannot read it: switch it by hand with the bot.
 */
export const MODO_OBSERVACAO = true;

/**
 * Written, but the bot's check after the run found it changed in the legacy
 * system (e.g. linked again through the screen: a double expense, which the
 * Protheus does not undo). The bot keeps the alert in `erro`.
 */
export const gravadoComAlerta = (
  liberacao: Pick<Liberacao, 'status' | 'erro'> | undefined,
) => liberacao?.status === 'gravado' && !!liberacao.erro;

/** A release that ended without writing, and can be made again. */
export const liberacaoEncerrada = (
  liberacao: Pick<Liberacao, 'status'> | undefined,
) => liberacao?.status === 'erro' || liberacao?.status === 'recusado';

/** A link the bot would write and nobody released yet (or again). */
export const podeLiberar = (
  vinculo: Vinculo,
  liberacao: Liberacao | undefined,
): boolean =>
  (!liberacao || liberacaoEncerrada(liberacao)) &&
  vinculo.decisao === 'vincular' &&
  vinculo.comparacao === 'pendente' &&
  vinculo.id_abaposto !== null;

// ----------------------------------------------------------------------

export const liberacaoService = {
  /** the fueling shown is what the bot may write: it checks it again */
  liberar: async ({
    vinculo,
    user_name,
  }: {
    vinculo: Vinculo;
    user_name: string;
  }) => {
    if (vinculo.id_abaposto === null) throw new Error();
    // status and liberado_em take the table's defaults, and user_uuid is set
    // by Hasura from the session
    await apolloClient.mutate<
      InsertLiberacaoMutation,
      InsertLiberacaoMutationVariables
    >({
      mutation: InsertLiberacaoDocument,
      variables: {
        data: {
          viagem_abastecimento_id: vinculo.viagem_abastecimento_id,
          id_abaposto: vinculo.id_abaposto,
          user_name,
        },
      },
    });
  },

  cancelar: async (viagem_abastecimento_id: number) => {
    const result = await apolloClient.mutate<
      DeleteLiberacaoMutation,
      DeleteLiberacaoMutationVariables
    >({
      mutation: DeleteLiberacaoDocument,
      variables: { id: viagem_abastecimento_id, status: ['liberado'] },
    });
    // the bot took it in between
    if (!result.data?.delete_trip_fuel_vinculo_liberado?.affected_rows) {
      throw new Error('O bot já processou esta liberação.');
    }
  },

  /** drops the release that ended in error or refused, and makes a new one */
  liberarDeNovo: async ({
    vinculo,
    user_name,
  }: {
    vinculo: Vinculo;
    user_name: string;
  }) => {
    await apolloClient.mutate<
      DeleteLiberacaoMutation,
      DeleteLiberacaoMutationVariables
    >({
      mutation: DeleteLiberacaoDocument,
      variables: {
        id: vinculo.viagem_abastecimento_id,
        status: ['erro', 'recusado'],
      },
    });
    await liberacaoService.liberar({ vinculo, user_name });
  },
};

// ----------------------------------------------------------------------

export type Arla = GetVinculosArlaQuery['trip_fuel_vinculo_arla'][number];

export type LiberacaoArla =
  GetLiberacoesArlaQuery['trip_fuel_arla_liberado'][number];

// the bot's reasons to wait or to leave an ARLA to the operator
export const MOTIVO_ARLA_LABELS: Record<string, string> = {
  diesel_pendente: 'Aguardando o diesel da mesma parada ser vinculado',
  sem_diesel_mesma_parada: 'Nenhum diesel com o mesmo odômetro',
  odometro_menor: 'Odômetro menor que o do último abastecimento vinculado',
  varios_arla: 'Mais de um ARLA no mesmo odômetro (venda duplicada?)',
  sem_odometro: 'Abastecimento sem odômetro',
  sem_valor: 'Abastecimento sem valor',
};

/** An ARLA the bot would write and nobody released yet (or again). */
export const podeLiberarArla = (
  arla: Arla,
  liberacao: LiberacaoArla | undefined,
): boolean =>
  (!liberacao || liberacaoEncerrada(liberacao)) && arla.decisao === 'vincular';

export const liberacaoArlaService = {
  // status and liberado_em take the table's defaults, and user_uuid is set by
  // Hasura from the session
  liberar: async ({ arla, user_name }: { arla: Arla; user_name: string }) => {
    await apolloClient.mutate<
      InsertLiberacaoArlaMutation,
      InsertLiberacaoArlaMutationVariables
    >({
      mutation: InsertLiberacaoArlaDocument,
      variables: { data: { id_abaposto: arla.id_abaposto, user_name } },
    });
  },

  cancelar: async (id_abaposto: number) => {
    const result = await apolloClient.mutate<
      DeleteLiberacaoArlaMutation,
      DeleteLiberacaoArlaMutationVariables
    >({
      mutation: DeleteLiberacaoArlaDocument,
      variables: { id: id_abaposto, status: ['liberado'] },
    });
    // the bot took it in between
    if (!result.data?.delete_trip_fuel_arla_liberado?.affected_rows) {
      throw new Error('O bot já processou esta liberação.');
    }
  },

  /** drops the release that ended in error or refused, and makes a new one */
  liberarDeNovo: async ({
    arla,
    user_name,
  }: {
    arla: Arla;
    user_name: string;
  }) => {
    await apolloClient.mutate<
      DeleteLiberacaoArlaMutation,
      DeleteLiberacaoArlaMutationVariables
    >({
      mutation: DeleteLiberacaoArlaDocument,
      variables: { id: arla.id_abaposto, status: ['erro', 'recusado'] },
    });
    await liberacaoArlaService.liberar({ arla, user_name });
  },
};

// ----------------------------------------------------------------------

export const formatNumero = (
  value: number | null | undefined,
  sufixo: string,
  { sinal }: { sinal?: boolean } = {},
): string => {
  if (value === null || value === undefined) return '-';
  const texto = value.toLocaleString('pt-br', { maximumFractionDigits: 1 });
  return `${sinal && value > 0 ? '+' : ''}${texto} ${sufixo}`;
};

export const formatMoeda = (value: number | null | undefined): string =>
  value === null || value === undefined
    ? '-'
    : value.toLocaleString('pt-br', { style: 'currency', currency: 'BRL' });

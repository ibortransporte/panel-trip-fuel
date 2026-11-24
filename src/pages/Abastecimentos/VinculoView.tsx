import {
  Chip,
  errorHandler,
  PanelBase,
  Scrollable,
  toast,
} from '@fluxu-labs/lib';
import {
  Alert,
  AlertTitle,
  Button,
  Stack,
  Typography,
  useTheme,
} from '@mui/material';
import { format } from 'date-fns';
import { useState } from 'react';
import { DataItem } from 'src/components/DataItem';
import { useAuthContext } from 'src/hooks/useAuthContext';
import {
  Comparacao,
  COMPARACAO_COLORS,
  COMPARACAO_LABELS,
  Decisao,
  DECISAO_COLORS,
  DECISAO_LABELS,
  formatNumero,
  gravadoComAlerta,
  Liberacao,
  LIBERACAO_COLORS,
  LIBERACAO_LABELS,
  liberacaoService,
  LiberacaoStatus,
  MOTIVO_LABELS,
  podeLiberar,
  Vinculo,
} from './utils';

// ----------------------------------------------------------------------

const formatData = (value: string | null) =>
  value ? format(new Date(value), 'dd/MM/yyyy HH:mm') : null;

/** The fueling as the operator finds it on the legacy screen (not its id). */
const descreverAbastecimento = (vinculo: Vinculo) =>
  `${formatData(vinculo.data_abastecimento) ?? '-'} · ${formatNumero(vinculo.litros_realizado, 'L')} · odômetro ${formatNumero(vinculo.odometro_realizado, 'km')}`;

// ----------------------------------------------------------------------

export function VinculoView({
  vinculo,
  liberacao,
  onChanged,
  onClose,
}: {
  vinculo: Vinculo;
  liberacao: Liberacao | undefined;
  /** a release was made or cancelled */
  onChanged: () => void;
  onClose: () => void;
}) {
  const theme = useTheme();
  const decisao = vinculo.decisao as Decisao;
  const comparacao = vinculo.comparacao as Comparacao;
  // on an exception the bot points to the closest fueling, not a chosen one
  const tituloRealizado =
    decisao === 'vincular'
      ? 'Abastecimento escolhido pelo bot'
      : 'Abastecimento mais próximo';

  return (
    <PanelBase.Container floating size="lg">
      <PanelBase.Header
        content={`${vinculo.placa} · Viagem ${vinculo.numviag}`}
        bottomComponent={
          <Typography sx={{ color: 'text.secondary' }}>
            Previsto {vinculo.viagem_abastecimento_id}
          </Typography>
        }
        actions={<PanelBase.Button.Close onClick={onClose} />}
      />

      <Scrollable sx={{ p: 1, gap: 1.5, pt: 0 }}>
        {comparacao === 'errou' && (
          <Alert severity="error">
            <AlertTitle>O operador vinculou outro abastecimento</AlertTitle>O
            bot escolheu o {vinculo.id_abaposto} e o operador vinculou o{' '}
            {vinculo.id_abaposto_legado}.
          </Alert>
        )}

        {(!!liberacao || podeLiberar(vinculo, liberacao)) && (
          <LiberacaoSection
            vinculo={vinculo}
            liberacao={liberacao}
            onChanged={onChanged}
          />
        )}

        <PanelBase.Section title="Decisão do bot">
          <Stack sx={{ gap: 1 }}>
            <Stack sx={{ flexDirection: 'row', gap: 1, flexWrap: 'wrap' }}>
              <Chip color={theme.palette[DECISAO_COLORS[decisao]].main}>
                {DECISAO_LABELS[decisao]}
              </Chip>
              <Chip color={theme.palette[COMPARACAO_COLORS[comparacao]].main}>
                {COMPARACAO_LABELS[comparacao]}
              </Chip>
            </Stack>
            {!!vinculo.motivo && (
              <DataItem
                label="Motivo"
                value={MOTIVO_LABELS[vinculo.motivo] ?? vinculo.motivo}
              />
            )}
            <Stack sx={{ flexDirection: 'row', gap: 1 }}>
              <DataItem
                label="Candidatos"
                value={vinculo.candidatos}
                sx={{ flex: 1 }}
              />
              <DataItem
                label="Viagens abertas da placa"
                value={vinculo.viagens_abertas}
                sx={{ flex: 1 }}
              />
            </Stack>
            <Stack sx={{ flexDirection: 'row', gap: 1 }}>
              <DataItem
                label="Primeira verificação"
                value={formatData(vinculo.created_at)}
                sx={{ flex: 1 }}
              />
              <DataItem
                label="Última verificação"
                value={formatData(vinculo.verificado_em)}
                sx={{ flex: 1 }}
              />
            </Stack>
          </Stack>
        </PanelBase.Section>

        <PanelBase.Section title="Previsto">
          <Stack sx={{ gap: 1 }}>
            <DataItem label="Posto" value={vinculo.nome_posto} />
            <Stack sx={{ flexDirection: 'row', gap: 1 }}>
              <DataItem
                label="Litros"
                value={formatNumero(vinculo.litros_previsto, 'L')}
                sx={{ flex: 1 }}
              />
              <DataItem
                label="Sequência"
                value={vinculo.sequencia}
                sx={{ flex: 1 }}
              />
            </Stack>
            <Stack sx={{ flexDirection: 'row', gap: 1 }}>
              <DataItem
                label="Odômetro previsto"
                value={formatNumero(vinculo.odometro_previsto, 'km')}
                sx={{ flex: 1 }}
              />
              <DataItem
                label="Odômetro ajustado"
                value={formatNumero(vinculo.odometro_ajustado, 'km')}
                sx={{ flex: 1 }}
              />
            </Stack>
          </Stack>
        </PanelBase.Section>

        {vinculo.id_abaposto !== null && (
          <PanelBase.Section title={tituloRealizado}>
            <Stack sx={{ gap: 1 }}>
              <Stack sx={{ flexDirection: 'row', gap: 1 }}>
                <DataItem
                  label="Data"
                  value={formatData(vinculo.data_abastecimento)}
                  sx={{ flex: 1 }}
                />
                <DataItem
                  label="Código interno"
                  value={vinculo.id_abaposto}
                  sx={{ flex: 1 }}
                />
              </Stack>
              <Stack sx={{ flexDirection: 'row', gap: 1 }}>
                <DataItem
                  label="Litros"
                  value={formatNumero(vinculo.litros_realizado, 'L')}
                  sx={{ flex: 1 }}
                />
                <DataItem
                  label="Diferença de litros"
                  value={formatNumero(vinculo.dif_litros, 'L', { sinal: true })}
                  sx={{ flex: 1 }}
                />
              </Stack>
              <Stack sx={{ flexDirection: 'row', gap: 1 }}>
                <DataItem
                  label="Odômetro"
                  value={formatNumero(vinculo.odometro_realizado, 'km')}
                  sx={{ flex: 1 }}
                />
                <DataItem
                  label="Diferença de odômetro"
                  value={formatNumero(vinculo.dif_km, 'km', { sinal: true })}
                  sx={{ flex: 1 }}
                />
              </Stack>
              {vinculo.posto_id_realizado !== vinculo.posto_id && (
                <DataItem
                  label="Posto do abastecimento"
                  value={`Outro posto (${vinculo.posto_id_realizado ?? '-'})`}
                />
              )}
            </Stack>
          </PanelBase.Section>
        )}

        <PanelBase.Section title="No sistema legado">
          <Stack sx={{ flexDirection: 'row', gap: 1 }}>
            <DataItem
              label="Situação do previsto"
              value={vinculo.status_legado}
              sx={{ flex: 1 }}
            />
            <DataItem
              label="Abastecimento vinculado"
              value={
                vinculo.id_abaposto_legado !== null &&
                vinculo.id_abaposto_legado === vinculo.id_abaposto
                  ? 'O escolhido pelo bot'
                  : vinculo.id_abaposto_legado
              }
              sx={{ flex: 1 }}
            />
          </Stack>
        </PanelBase.Section>
      </Scrollable>
    </PanelBase.Container>
  );
}

// ----------------------------------------------------------------------

function LiberacaoSection({
  vinculo,
  liberacao,
  onChanged,
}: {
  vinculo: Vinculo;
  liberacao: Liberacao | undefined;
  onChanged: () => void;
}) {
  const theme = useTheme();
  const { user } = useAuthContext();
  const [isProcessing, setIsProcessing] = useState(false);

  const executar = async (acao: () => Promise<void>, mensagem: string) => {
    setIsProcessing(true);
    try {
      await acao();
      toast.success(mensagem);
    } catch (error) {
      errorHandler({ error });
    }
    onChanged();
    setIsProcessing(false);
  };

  const liberar = () =>
    executar(
      () => liberacaoService.liberar({ vinculo, user_name: user?.name ?? '' }),
      'Vínculo liberado para o bot.',
    );

  const liberarDeNovo = () =>
    executar(
      () =>
        liberacaoService.liberarDeNovo({
          vinculo,
          user_name: user?.name ?? '',
        }),
      'Vínculo liberado de novo para o bot.',
    );

  const cancelar = () =>
    executar(
      () => liberacaoService.cancelar(vinculo.viagem_abastecimento_id),
      'Liberação cancelada.',
    );

  if (!liberacao) {
    return (
      <PanelBase.Section title="Liberar para o bot">
        <Stack sx={{ gap: 1, alignItems: 'flex-start' }}>
          <Typography sx={{ color: 'text.secondary' }}>
            O bot vincula o abastecimento de {descreverAbastecimento(vinculo)}.
          </Typography>
          <Button
            variant="contained"
            size="small"
            loading={isProcessing}
            onClick={() => void liberar()}
          >
            Liberar para o bot
          </Button>
        </Stack>
      </PanelBase.Section>
    );
  }

  const status = liberacao.status as LiberacaoStatus;

  return (
    <PanelBase.Section title="Liberação para o bot">
      <Stack sx={{ gap: 1 }}>
        <Stack sx={{ flexDirection: 'row', gap: 1, alignItems: 'center' }}>
          <Chip color={theme.palette[LIBERACAO_COLORS[status]].main}>
            {LIBERACAO_LABELS[status]}
          </Chip>
          {podeLiberar(vinculo, liberacao) && (
            <Button
              variant="contained"
              size="small"
              loading={isProcessing}
              onClick={() => void liberarDeNovo()}
            >
              Liberar de novo
            </Button>
          )}
          {status === 'liberado' && (
            <Button
              variant="contained"
              size="small"
              color="error"
              loading={isProcessing}
              onClick={() => void cancelar()}
            >
              Cancelar liberação
            </Button>
          )}
        </Stack>
        {!!liberacao.erro && (
          <Alert
            severity={
              status === 'erro' || gravadoComAlerta(liberacao)
                ? 'error'
                : 'warning'
            }
          >
            {liberacao.erro}
          </Alert>
        )}
        <Stack sx={{ flexDirection: 'row', gap: 1 }}>
          <DataItem
            label="Liberado por"
            value={liberacao.user_name}
            sx={{ flex: 1 }}
          />
          <DataItem
            label="Liberado em"
            value={formatData(liberacao.liberado_em)}
            sx={{ flex: 1 }}
          />
        </Stack>
        <Stack sx={{ flexDirection: 'row', gap: 1 }}>
          <DataItem
            label="Abastecimento liberado"
            value={
              liberacao.id_abaposto === vinculo.id_abaposto
                ? descreverAbastecimento(vinculo)
                : liberacao.id_abaposto
            }
            sx={{ flex: 1 }}
          />
          <DataItem
            label="Processado em"
            value={formatData(liberacao.processado_em)}
            sx={{ flex: 1 }}
          />
        </Stack>
        {liberacao.lancamento_id !== null && (
          <DataItem label="Lançamento" value={liberacao.lancamento_id} />
        )}
      </Stack>
    </PanelBase.Section>
  );
}

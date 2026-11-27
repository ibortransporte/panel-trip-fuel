import {
  Chip,
  errorHandler,
  PanelBase,
  Scrollable,
  toast,
} from '@fluxu-labs/lib';
import { Alert, Button, Stack, Typography, useTheme } from '@mui/material';
import { format } from 'date-fns';
import { useState } from 'react';
import { DataItem } from 'src/components/DataItem';
import { useAuthContext } from 'src/hooks/useAuthContext';
import {
  Arla,
  Decisao,
  DECISAO_COLORS,
  DECISAO_LABELS,
  formatMoeda,
  formatNumero,
  gravadoComAlerta,
  LIBERACAO_COLORS,
  LIBERACAO_LABELS,
  LiberacaoArla,
  liberacaoArlaService,
  LiberacaoStatus,
  MOTIVO_ARLA_LABELS,
  podeLiberarArla,
} from './utils';

// ----------------------------------------------------------------------

const formatData = (value: string | null) =>
  value ? format(new Date(value), 'dd/MM/yyyy HH:mm') : null;

/** The fueling as the operator finds it on the legacy screen (not its id). */
const descreverArla = (arla: Arla) =>
  `${formatData(arla.data_abastecimento) ?? '-'} · ${formatNumero(arla.litros, 'L')} · ${formatMoeda(arla.valor)}`;

// ----------------------------------------------------------------------

export function ArlaView({
  arla,
  liberacao,
  onChanged,
  onClose,
}: {
  arla: Arla;
  liberacao: LiberacaoArla | undefined;
  /** a release was made or cancelled */
  onChanged: () => void;
  onClose: () => void;
}) {
  const theme = useTheme();
  const decisao = arla.decisao as Decisao;

  return (
    <PanelBase.Container floating size="lg">
      <PanelBase.Header
        content={`${arla.placa} · Viagem ${arla.numviag}`}
        bottomComponent={
          <Typography sx={{ color: 'text.secondary' }}>
            ARLA {arla.id_abaposto}
          </Typography>
        }
        actions={<PanelBase.Button.Close onClick={onClose} />}
      />

      <Scrollable sx={{ p: 1, gap: 1.5, pt: 0 }}>
        {(!!liberacao || podeLiberarArla(arla, liberacao)) && (
          <LiberacaoSection
            arla={arla}
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
            </Stack>
            {!!arla.motivo && (
              <DataItem
                label="Motivo"
                value={MOTIVO_ARLA_LABELS[arla.motivo] ?? arla.motivo}
              />
            )}
            <Stack sx={{ flexDirection: 'row', gap: 1 }}>
              <DataItem
                label="Diesel na mesma parada"
                value={arla.diesel_mesma_parada}
                sx={{ flex: 1 }}
              />
              <DataItem
                label="Diesel vinculado"
                value={arla.diesel_vinculado}
                sx={{ flex: 1 }}
              />
            </Stack>
            <Stack sx={{ flexDirection: 'row', gap: 1 }}>
              <DataItem
                label="Primeira verificação"
                value={formatData(arla.created_at)}
                sx={{ flex: 1 }}
              />
              <DataItem
                label="Última verificação"
                value={formatData(arla.verificado_em)}
                sx={{ flex: 1 }}
              />
            </Stack>
          </Stack>
        </PanelBase.Section>

        <PanelBase.Section title="Abastecimento">
          <Stack sx={{ gap: 1 }}>
            <Stack sx={{ flexDirection: 'row', gap: 1 }}>
              <DataItem
                label="Data"
                value={formatData(arla.data_abastecimento)}
                sx={{ flex: 1 }}
              />
              <DataItem
                label="Código interno"
                value={arla.id_abaposto}
                sx={{ flex: 1 }}
              />
            </Stack>
            <Stack sx={{ flexDirection: 'row', gap: 1 }}>
              <DataItem label="Posto" value={arla.codposto} sx={{ flex: 1 }} />
              <DataItem
                label="Litros"
                value={formatNumero(arla.litros, 'L')}
                sx={{ flex: 1 }}
              />
            </Stack>
            <Stack sx={{ flexDirection: 'row', gap: 1 }}>
              <DataItem
                label="Valor"
                value={formatMoeda(arla.valor)}
                sx={{ flex: 1 }}
              />
              <DataItem
                label="ARLA/diesel"
                value={formatNumero(arla.percentual, '%')}
                sx={{ flex: 1 }}
              />
            </Stack>
            <Stack sx={{ flexDirection: 'row', gap: 1 }}>
              <DataItem
                label="Odômetro"
                value={formatNumero(arla.odometro, 'km')}
                sx={{ flex: 1 }}
              />
              <DataItem
                label="Odômetro do último vinculado"
                value={formatNumero(arla.ultimo_odometro, 'km')}
                sx={{ flex: 1 }}
              />
            </Stack>
          </Stack>
        </PanelBase.Section>
      </Scrollable>
    </PanelBase.Container>
  );
}

// ----------------------------------------------------------------------

function LiberacaoSection({
  arla,
  liberacao,
  onChanged,
}: {
  arla: Arla;
  liberacao: LiberacaoArla | undefined;
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
      () => liberacaoArlaService.liberar({ arla, user_name: user?.name ?? '' }),
      'ARLA liberado para o bot.',
    );

  const liberarDeNovo = () =>
    executar(
      () =>
        liberacaoArlaService.liberarDeNovo({
          arla,
          user_name: user?.name ?? '',
        }),
      'ARLA liberado de novo para o bot.',
    );

  const cancelar = () =>
    executar(
      () => liberacaoArlaService.cancelar(arla.id_abaposto),
      'Liberação cancelada.',
    );

  if (!liberacao) {
    return (
      <PanelBase.Section title="Liberar para o bot">
        <Stack sx={{ gap: 1, alignItems: 'flex-start' }}>
          <Typography sx={{ color: 'text.secondary' }}>
            O bot lança como despesa o ARLA de {descreverArla(arla)}.
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
          {podeLiberarArla(arla, liberacao) && (
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
        <DataItem
          label="Processado em"
          value={formatData(liberacao.processado_em)}
        />
        {!!liberacao.plano && (
          <DataItem label="Plano do bot" value={liberacao.plano} />
        )}
      </Stack>
    </PanelBase.Section>
  );
}

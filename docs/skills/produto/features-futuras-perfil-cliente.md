# Features Futuras — Perfil do Cliente CX

> Documentação de features não implementadas agora, mas planejadas para sprints futuras.

## NPS Histórico & Trend
- **Pré-requisito**: Coleta de NPS consistente (atual é esporádica)
- **Implementação**: Gráfico de linha com scores ao longo do tempo
- **Dados**: Já existe `npsResponses[]` na API — falta volume

## Tags Automáticas de Comportamento  
- **Pré-requisito**: Engine de regras baseada em dados comportamentais
- **Tags possíveis**: `Viajante Corporativo`, `Estudante`, `Pendular`, `Turista Ocasional`
- **Critérios**: Dias da semana, horários, rotas fixas, frequência, antecedência

## Comparativo com Segmento (Peers)
- **Pré-requisito**: Endpoint `/api/clientes/segment-averages` com médias aggregadas
- **Dados**: Ticket médio vs segmento, frequência vs segmento, adesão seguro vs segmento
- **Layout**: Tabela comparativa (cliente × médias do segmento)

## Oportunidades de Receita (Upsell/Cross-sell)
- **Pré-requisito**: Engine de recommendation + dados de upgrade
- **Exemplos**: Seguro viagem, upgrade leito, pacote de viagens
- **Critérios**: Adesão atual, potencial estimado, economia

## Conexões (Viajam Juntos)
- **Pré-requisito**: Dados de assento e compra conjunta no schema
- **Detecção**: Compras simultâneas + assentos adjacentes → relação inferida

---

*Última atualização: 04/03/2026*

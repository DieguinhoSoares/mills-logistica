import { VEICULOS } from './freteCalc'

// ─── MILLS BRAND — Manual da Marca Abril 2021 ────────────────────────────────
// Fonte: IBM Plex Sans — unificada em todo o app (antes dividida entre
// Nunito no login/UI e IBM Plex Sans/Barlow Condensed no resto).
// Laranja: Pantone 021 C | #F37021 | Verde escuro: Pantone 2217 C | #004042

export const T = {
  bg:           '#F9F6F1',
  surface:      '#FFFFFF',
  surfaceAlt:   '#FAF8F5',
  surfaceLow:   '#F0EDE8',
  border:       '#E2DDD6',
  borderMid:    '#CEC8C0',
  text:         '#1A1612',
  textSec:      '#4A3F35',
  textMuted:    '#9E9590',
  laranja:      '#F37021',
  laranjaDeep:  '#C24003',
  laranjaLight: '#FEF0E6',
  laranjaXLight:'#FFF5EE',
  verde:        '#004042',
  verdeDeep:    '#002628',
  verdeLight:   '#E0EEEE',
  verdeMint:    '#6BFAC7',
  amarelo:      '#F5C400',
  amareloLight: '#FFF8E1',
  perigo:       '#D32F2F',
  perigoLight:  '#FFEBEE',
  info:         '#1565C0',
  infoLight:    '#E3F2FD',
  sucesso:      '#2E7D32',
  sucessoLight: '#E8F5E9',
  shadow:   '0 1px 3px rgba(26,22,18,.07), 0 2px 8px rgba(26,22,18,.05)',
  shadowMd: '0 4px 16px rgba(26,22,18,.11)',
  shadowLg: '0 12px 40px rgba(26,22,18,.16)',
  // Padrão visual "enterprise" (mockup 23a/19a/20a/20b) — sombra em duas
  // camadas + borda quase invisível, usado em cards/painéis novos em vez
  // do border colorido a 30% + shadow simples de antes. Fundo frio pra
  // telas onde cards brancos precisam se destacar por cima.
  shadowCard:   '0 1px 2px rgba(26,22,18,.04), 0 8px 24px -8px rgba(26,22,18,.06)',
  borderSubtle: '1px solid rgba(26,22,18,.05)',
  bgCold:       '#F7F5F1',
  r:   10, rSm: 6, rLg: 16, rXl: 24,
}

// Tratamento visual "enterprise" (mockups 17a/18a/19a) — sombra em duas
// camadas e borda quase invisível, para usar no lugar de `border:${color}30`
// + `boxShadow:T.shadow` em cards/painéis.
export const SHADOW_CARD = '0 1px 2px rgba(26,22,18,.04), 0 8px 24px -8px rgba(26,22,18,.06)'
export const BORDER_SUBTLE = '1px solid rgba(26,22,18,.05)'

export const FONT = "'IBM Plex Sans', 'Nunito', sans-serif"

export const CARD_TYPES = {
  guindauto:         { label:'Guindauto / Campo',     color:'#004042', bg:'#E0EEEE', icon:'🏗️', short:'GUINDAUTO'  },
  freteMillsInterno: { label:'Frete Mills (Interno)', color:'#F37021', bg:'#FEF0E6', icon:'🚛', short:'FRETE MILLS'},
  freteCliente:      { label:'Frete Cliente',         color:'#C24003', bg:'#FDEEE9', icon:'📦', short:'FRETE CLI.' },
}

// Subtipos que envolvem movimentação física de ativo/peça e por isso exigem
// confirmação de Nota Fiscal antes do serviço poder ser concluído.
// Responsabilidade de confirmar é do analista (Frotas) — nunca do solicitante.
export const SUBTYPES_NF = [
  'mobilizacao', 'desmobilizacao', 'rollout', 'quebra_contrato',
  'troca_tecnica', 'sinistro', 'garantia',
  'troca_cacamba', 'frete_pecas', 'venda_equipamentos', 'movimentacao',
]

export const CARD_SUBTYPES = {
  guindauto: [
    { value:'guindauto',         label:'🏗️ Guindauto' },
    { value:'troca_cacamba',     label:'🪣 Troca de Caçamba' },
    { value:'apoio_operacional', label:'🔧 Apoio Operacional' },
    { value:'frete_pecas',       label:'📦 Frete de Peças' },
    { value:'outros',            label:'📋 Outros' },
  ],
  freteMillsInterno: [
    { value:'troca_tecnica',      label:'🔄 Troca Técnica' },
    { value:'sinistro',           label:'⚠️ Sinistro' },
    { value:'garantia',           label:'🛡️ Garantia' },
    { value:'mobilizacao',        label:'📤 Mobilização' },
    { value:'desmobilizacao',     label:'📥 Desmobilização' },
    { value:'rollout',            label:'🔁 Rollout' },
    { value:'quebra_contrato',    label:'❌ Quebra de Contrato' },
    { value:'venda_equipamentos', label:'💰 Venda de Equipamentos' },
    { value:'movimentacao',       label:'🏭 Movimentação entre Unidades/Fornecedor' },
  ],
  freteCliente: [
    { value:'mobilizacao',        label:'📤 Mobilização' },
    { value:'desmobilizacao',     label:'📥 Desmobilização' },
    { value:'rollout',            label:'🔁 Rollout' },
    { value:'quebra_contrato',    label:'❌ Quebra de Contrato' },
    { value:'troca_tecnica',      label:'🔄 Troca Técnica' },
    { value:'sinistro',           label:'⚠️ Sinistro' },
    { value:'garantia',           label:'🛡️ Garantia' },
    { value:'venda_equipamentos', label:'💰 Venda de Equipamentos' },
    { value:'outros',             label:'📋 Outros' },
  ],
}

// Lista padronizada de "Motivo" pro formulário de Solicitação de NF — união
// dos rótulos de subtipo (sem duplicar entre Frete Mills/Cliente) que exigem
// NF (SUBTYPES_NF acima). O formulário oferece só essas opções + "Outro"
// pra digitar livre quando nenhuma bate — evita motivo digitado à mão de
// forma inconsistente entre solicitações (ex.: "Desmobilização" vs "desmob").
export const MOTIVO_NF_OPTIONS = Array.from(new Set(
  Object.values(CARD_SUBTYPES).flat()
    .filter(s => SUBTYPES_NF.includes(s.value))
    .map(s => s.label)
))

// Estados da solicitação de NF (ver src/lib/utils.js#nfStatusForCard) — fonte
// única de cor/label usada no badge do card (UI.jsx) e no painel de
// Solicitação de NF (NfRequestsPanel.jsx).
export const NF_STATUS = {
  pendente:   { label:'NF pendente',    short:'📄 NF PENDENTE',    color:T.perigo,   bg:T.perigoLight  },
  solicitada: { label:'NF solicitada',  short:'📄 NF SOLICITADA',  color:'#B8860B',  bg:T.amareloLight },
  emitida:    { label:'NF emitida',     short:'📄 NF EMITIDA',     color:T.sucesso,  bg:T.sucessoLight },
  cancelada:  { label:'NF cancelada',   short:'📄 NF CANCELADA',   color:T.textMuted, bg:T.surfaceLow  },
}

// Cadastro de Veículos (ver useVeiculos em useFirestore.js) — tipo do
// veículo é o MESMO conjunto usado na tabela de preços de frete (VEICULOS,
// em freteCalc.js), pra não ter duas listas de "tipo de veículo" divergindo
// entre a cotação de frete e o cadastro de frota. "frete_rodando" fica de
// fora — não é um veículo de verdade, é a opção "sem embarque" do frete.
const ICONE_TIPO_VEICULO = { '3/4':'🚐', truck:'🚛', bitruck:'🚛', prancha3:'🚚', prancha4:'🚚', bitrem9:'🚚' }
export const TIPO_VEICULO_OPTIONS = [
  ...VEICULOS.filter(v => v.id !== 'frete_rodando').map(v => ({ value:v.id, label:`${ICONE_TIPO_VEICULO[v.id]||'🚚'} ${v.label}` })),
  { value:'outro', label:'📋 Outro' },
]

export const TIPO_DOCUMENTO_VEICULO_OPTIONS = [
  'CRLV (Licenciamento)', 'Seguro', 'ANTT/RNTRC', 'Cronotacógrafo',
  'Inspeção Veicular',
]

// Checklist de Embarque (INS-EMB-01) — planilha da liberação logística +
// ajustes do Edivaldo/Tadeu. `risco` vem da Matriz de Risco (só usado
// internamente pra severidade/relatório — NUNCA aparece no PDF impresso,
// por pedido explícito). `foto`=true sempre exige foto; `fotoSeAplicavel`
// (só o AET) exige foto apenas quando o item não é marcado N/A.
export const EMBARQUE_CHECKLIST_ITENS = [
  { numero:1,  grupo:'Documentação', descricao:'Autorização gerencial formalizada ou contrato assinado', risco:'Documental' },
  { numero:2,  grupo:'Documentação', descricao:'NF emitida e conferida (origem, destino, CNPJ, CFOP)', risco:'Documental' },
  { numero:3,  grupo:'Documentação', descricao:'Placa do cavalo e carreta conferidas', risco:'Documental', foto:true },
  { numero:4,  grupo:'Documentação', descricao:'Nome e documento do motorista validados', risco:'Documental' },
  { numero:5,  grupo:'Documentação', descricao:'Transportadora homologada', risco:'Logístico' },
  { numero:6,  grupo:'Documentação', descricao:'AET — Autorização Especial de Trânsito (quando aplicável)', risco:'Documental', fotoSeAplicavel:true },
  { numero:7,  grupo:'Documentação', descricao:'Seguro de transporte vigente e averbação realizada', risco:'Compliance' },

  { numero:8,  grupo:'Equipamento', descricao:'Equipamento correto (modelo e número de série)', risco:'Operacional' },
  { numero:9,  grupo:'Equipamento', descricao:'Horímetro registrado', risco:'Operacional', foto:true },
  { numero:10, grupo:'Equipamento', descricao:'Combustível conforme padrão — não pode estar na reserva', risco:'Operacional', foto:true },
  { numero:11, grupo:'Equipamento', descricao:'Acessórios listados e conferidos', risco:'Operacional' },
  { numero:12, grupo:'Equipamento', descricao:'Check-list de saída realizado, sem pendências (nº OM)', risco:'Operacional' },
  { numero:13, grupo:'Equipamento', descricao:'Altura e largura do conjunto medidas', risco:'Operacional' },
  { numero:14, grupo:'Equipamento', descricao:'Foto da bateria', risco:'Operacional', foto:true },

  { numero:15, grupo:'Caminhão Prancha', descricao:'Prancha compatível com peso e dimensão', risco:'Segurança' },
  { numero:16, grupo:'Caminhão Prancha', descricao:'Capacidade de carga adequada', risco:'Segurança' },
  { numero:17, grupo:'Caminhão Prancha', descricao:'Documentação do veículo regular', risco:'Documental' },
  { numero:18, grupo:'Caminhão Prancha', descricao:'Condições adequadas (pneus, iluminação, estrutura)', risco:'Segurança', foto:true },
  { numero:19, grupo:'Caminhão Prancha', descricao:'Motorista com EPI adequado', risco:'Segurança', foto:true },
  { numero:20, grupo:'Caminhão Prancha', descricao:'Cintas/correntes de amarração', risco:'Segurança', foto:true },
  { numero:21, grupo:'Caminhão Prancha', descricao:'Pontos de ancoragem / equipamento amarrado', risco:'Segurança', foto:true },
  { numero:22, grupo:'Caminhão Prancha', descricao:'Travamento de implementos realizado', risco:'Segurança', foto:true },
  { numero:23, grupo:'Caminhão Prancha', descricao:'Calços aplicados (quando necessário)', risco:'Segurança', foto:true },
  { numero:24, grupo:'Caminhão Prancha', descricao:'Vídeo de 360° registrado na OM do inspetor', risco:'Segurança', confirmacao:true },
  { numero:25, grupo:'Caminhão Prancha', descricao:'Placa do transporte', risco:'Documental', foto:true },
  { numero:26, grupo:'Caminhão Prancha', descricao:'Documentação física com o motorista', risco:'Documental' },

  { numero:27, grupo:'Rastreabilidade', descricao:'Informações enviadas ao cliente', risco:'Contrato' },
  { numero:28, grupo:'Rastreabilidade', descricao:'Status atualizado no sistema', risco:'Contrato' },
  { numero:29, grupo:'Rastreabilidade', descricao:'Cliente informado da saída', risco:'Contrato' },
  { numero:30, grupo:'Rastreabilidade', descricao:'Previsão de chegada registrada', risco:'Contrato' },
  { numero:31, grupo:'Rastreabilidade', descricao:'Nenhuma pendência aberta', risco:'Contrato' },
]

export const EMBARQUE_GRUPOS = ['Documentação', 'Equipamento', 'Caminhão Prancha', 'Rastreabilidade']

// 4 fotos do equipamento em si (não do transporte) — mesmo padrão de
// ângulos que a Hengel usa nos comprovantes de embarque deles.
export const EMBARQUE_FOTOS_EQUIPAMENTO = [
  { angulo:'frente',            label:'Frente' },
  { angulo:'traseira',          label:'Traseira' },
  { angulo:'lateral_esquerda',  label:'Lateral Esquerda' },
  { angulo:'lateral_direita',   label:'Lateral Direita' },
]

// Filiais Mills (saída de pátio) — lista mais completa que FILIAIS (que é
// só das unidades com Frotas ativo hoje no app); essa vem da planilha de
// liberação logística, cobre todas as unidades que fazem embarque.
export const FILIAIS_EMBARQUE = [
  'Camaçari-BA', 'Fortaleza-CE', 'Brasília-DF', 'Serra-ES', 'Goiânia-GO',
  'Contagem-MG', 'Uberlândia-MG', 'Betim-MG', 'Cuiabá-MT', 'Ananindeua-PA',
  'Parauapebas-PA', 'São José dos Pinhais-PR', 'Rio de Janeiro-RJ',
  'Rio Grande-RS', 'Cachoeirinha-RS', 'Joinville-SC', 'Aracaju-SE',
  'Cotia-SP', 'Osasco-SP', 'Assis-SP', 'Santos-SP', 'Sumaré-SP',
]

// Pesquisa de satisfação (Fase 2 do Checklist de Embarque — confirmação
// do cliente). Foco no REPORTE do processo, não numa avaliação direta do
// analista. Não é obrigatória pro cliente confirmar o recebimento, mas
// aparece sempre — incentivada, não travada.
export const PESQUISA_SATISFACAO_PERGUNTAS = [
  { id:'informacoes_claras',   texto:'Todas as informações sobre o frete foram passadas com clareza?' },
  { id:'duvidas_esclarecidas', texto:'Eventuais dúvidas foram esclarecidas durante o processo?' },
  { id:'condicoes_chegada',    texto:'Condições de chegada do(s) equipamento(s)' },
  { id:'cumprimento_prazos',   texto:'Cumprimento de prazos' },
]

// Janelas de vencimento de documento (dias restantes até a validade) —
// combinado com o usuário: 30d = só aviso, 15d = alerta pedindo ação,
// 7d (ou já vencido) = crítico, exige confirmação de que a renovação foi
// solicitada (ver documentoUrgencia em utils.js).
export const DOC_URGENCIA = {
  aviso:   { label:'Vence em breve',        dias:30, color:T.info,    bg:T.infoLight    },
  alerta:  { label:'Requer ação',           dias:15, color:'#B8860B', bg:T.amareloLight },
  critico: { label:'Urgente — confirme a solicitação de renovação', dias:7, color:T.perigo, bg:T.perigoLight },
}

// Ordenação de urgência para filas de aprovação (crítico primeiro)
export const URGENCY_ORDER = { critico: 0, alto: 1, medio: 2, baixo: 3 }
// Rótulos de SLA exibidos ao usuário (fonte única — não duplicar nas views)
export const URGENCY_SLA = { critico:'até 4h', alto:'até 24h', medio:'até 3 dias', baixo:'até 7 dias' }
// SLA em milissegundos — usado para calcular "vence em Xh" na faixa de atenção
export const URGENCY_SLA_MS = { critico: 4*3600000, alto: 24*3600000, medio: 3*86400000, baixo: 7*86400000 }

// Função centralizada de ordenação por urgência + prazo mais próximo
export function sortByUrgency(items, dateField='desiredDate') {
  return [...items].sort((a, b) => {
    const byUrgency = (URGENCY_ORDER[a.urgency]??99) - (URGENCY_ORDER[b.urgency]??99)
    if (byUrgency !== 0) return byUrgency
    // Datas ausentes ou inválidas vão para o fim, nunca para o topo
    const da = a[dateField] ? new Date(a[dateField]).getTime() : Infinity
    const db = b[dateField] ? new Date(b[dateField]).getTime() : Infinity
    return (isNaN(da) ? Infinity : da) - (isNaN(db) ? Infinity : db)
  })
}

export const URGENCY = {
  critico: { label:'Crítico', color:'#D32F2F', bg:'#FFEBEE', icon:'🔴' },
  alto:    { label:'Alto',    color:'#E65100', bg:'#FFF3E0', icon:'🟠' },
  medio:   { label:'Médio',   color:'#F5C400', bg:'#FFF8E1', icon:'🟡' },
  baixo:   { label:'Baixo',   color:'#2E7D32', bg:'#E8F5E9', icon:'🟢' },
}

export const BR_STATES = [
  {id:'AC',name:'Acre',             x:88,  y:252},{id:'AL',name:'Alagoas',             x:552, y:295},
  {id:'AM',name:'Amazonas',         x:165, y:200},{id:'AP',name:'Amapá',               x:415, y:118},
  {id:'BA',name:'Bahia',            x:492, y:322},{id:'CE',name:'Ceará',               x:522, y:218},
  {id:'DF',name:'Distrito Federal', x:422, y:372},{id:'ES',name:'Espírito Santo',      x:514, y:408},
  {id:'GO',name:'Goiás',            x:385, y:370},{id:'MA',name:'Maranhão',            x:445, y:215},
  {id:'MG',name:'Minas Gerais',     x:466, y:398},{id:'MS',name:'Mato Grosso do Sul',  x:328, y:418},
  {id:'MT',name:'Mato Grosso',      x:285, y:318},{id:'PA',name:'Pará',                x:366, y:196},
  {id:'PB',name:'Paraíba',          x:558, y:248},{id:'PE',name:'Pernambuco',           x:538, y:266},
  {id:'PI',name:'Piauí',            x:484, y:246},{id:'PR',name:'Paraná',              x:356, y:468},
  {id:'RJ',name:'Rio de Janeiro',   x:488, y:428},{id:'RN',name:'Rio Grande do Norte', x:562, y:234},
  {id:'RO',name:'Rondônia',         x:196, y:298},{id:'RR',name:'Roraima',             x:252, y:120},
  {id:'RS',name:'Rio Grande do Sul',x:334, y:528},{id:'SC',name:'Santa Catarina',      x:364, y:498},
  {id:'SE',name:'Sergipe',          x:548, y:296},{id:'SP',name:'São Paulo',           x:410, y:448},
  {id:'TO',name:'Tocantins',        x:424, y:284},
]

export const MUNICIPIOS = [
  {m:'São Paulo',s:'SP'},{m:'Campinas',s:'SP'},{m:'Santos',s:'SP'},{m:'Ribeirão Preto',s:'SP'},
  {m:'São José dos Campos',s:'SP'},{m:'Osasco',s:'SP'},{m:'Sorocaba',s:'SP'},{m:'Assis',s:'SP'},
  {m:'Sumaré',s:'SP'},{m:'Paulínia',s:'SP'},{m:'Piracicaba',s:'SP'},{m:'Jundiaí',s:'SP'},
  {m:'Bauru',s:'SP'},{m:'Guarulhos',s:'SP'},{m:'Santo André',s:'SP'},{m:'São Bernardo do Campo',s:'SP'},
  {m:'Belo Horizonte',s:'MG'},{m:'Contagem',s:'MG'},{m:'Uberlândia',s:'MG'},{m:'Betim',s:'MG'},
  {m:'Juiz de Fora',s:'MG'},{m:'Ipatinga',s:'MG'},{m:'Montes Claros',s:'MG'},
  {m:'Rio de Janeiro',s:'RJ'},{m:'Niterói',s:'RJ'},{m:'Duque de Caxias',s:'RJ'},{m:'Nova Iguaçu',s:'RJ'},
  {m:'Curitiba',s:'PR'},{m:'Londrina',s:'PR'},{m:'Maringá',s:'PR'},{m:'São José dos Pinhais',s:'PR'},
  {m:'Florianópolis',s:'SC'},{m:'Joinville',s:'SC'},{m:'Blumenau',s:'SC'},
  {m:'Porto Alegre',s:'RS'},{m:'Caxias do Sul',s:'RS'},{m:'Canoas',s:'RS'},
  {m:'Salvador',s:'BA'},{m:'Feira de Santana',s:'BA'},{m:'Camaçari',s:'BA'},
  {m:'Goiânia',s:'GO'},{m:'Aparecida de Goiânia',s:'GO'},{m:'Anápolis',s:'GO'},
  {m:'Belém',s:'PA'},{m:'Ananindeua',s:'PA'},{m:'Parauapebas',s:'PA'},{m:'Marabá',s:'PA'},
  {m:'Fortaleza',s:'CE'},{m:'Caucaia',s:'CE'},{m:'Juazeiro do Norte',s:'CE'},
  {m:'Recife',s:'PE'},{m:'Caruaru',s:'PE'},{m:'Petrolina',s:'PE'},
  {m:'Manaus',s:'AM'},{m:'Vitória',s:'ES'},{m:'Vila Velha',s:'ES'},{m:'Serra',s:'ES'},
  {m:'Cuiabá',s:'MT'},{m:'Rondonópolis',s:'MT'},{m:'Campo Grande',s:'MS'},{m:'Dourados',s:'MS'},
  {m:'São Luís',s:'MA'},{m:'Imperatriz',s:'MA'},{m:'Natal',s:'RN'},{m:'Mossoró',s:'RN'},
  {m:'João Pessoa',s:'PB'},{m:'Campina Grande',s:'PB'},{m:'Maceió',s:'AL'},{m:'Aracaju',s:'SE'},
  {m:'Teresina',s:'PI'},{m:'Palmas',s:'TO'},{m:'Araguaína',s:'TO'},
  {m:'Porto Velho',s:'RO'},{m:'Rio Branco',s:'AC'},{m:'Boa Vista',s:'RR'},{m:'Macapá',s:'AP'},
  {m:'Brasília',s:'DF'},
]

export const FILIAIS = [
  'Assis (SP)','Campinas / Paulínia (SP)','Contagem (MG)',
  'Osasco (SP)','Parauapebas (PA)','Santos (SP)',
  'Sumaré (SP)','São José dos Pinhais (PR)',
]

export const MONTH_NAMES = ['Janeiro','Fevereiro','Março','Abril','Maio','Junho','Julho','Agosto','Setembro','Outubro','Novembro','Dezembro']
export const WD_SHORT    = ['Seg','Ter','Qua','Qui','Sex','Sáb','Dom']

export const LS = {
  display:'block', color:'#9E9590', fontSize:10, fontWeight:800,
  letterSpacing:'0.1em', textTransform:'uppercase',
  marginBottom:5, fontFamily:FONT,
}
export const IS = {
  width:'100%', background:'#FAF8F5', border:'1px solid #E2DDD6',
  borderRadius:8, padding:'9px 12px', color:'#1A1612',
  fontSize:13, fontFamily:FONT,
  boxSizing:'border-box', outline:'none',
}
export const BS = {
  padding:'9px 18px', borderRadius:10, border:'none',
  cursor:'pointer', fontSize:12,
  fontFamily:FONT, fontWeight:800,
}
export const NB = {
  background:'#FFFFFF', border:'1px solid #E2DDD6', borderRadius:8,
  color:'#6B6258', padding:'5px 12px', cursor:'pointer',
  fontSize:15, fontFamily:FONT, fontWeight:700,
}

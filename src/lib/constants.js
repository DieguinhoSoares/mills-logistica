// ─── MILLS BRAND — Manual da Marca Abril 2021 ────────────────────────────────
// Fonte: Nunito (Google Fonts) — arredondada, próxima ao lettering mills
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
  r:   10, rSm: 6, rLg: 16, rXl: 24,
}

export const FONT = "'Nunito', 'IBM Plex Sans', sans-serif"

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
  'troca_cacamba', 'frete_pecas', 'venda_equipamentos',
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
  ],
  freteCliente: [
    { value:'mobilizacao',        label:'📤 Mobilização' },
    { value:'desmobilizacao',     label:'📥 Desmobilização' },
    { value:'rollout',            label:'🔁 Rollout' },
    { value:'quebra_contrato',    label:'❌ Quebra de Contrato' },
    { value:'venda_equipamentos', label:'💰 Venda de Equipamentos' },
  ],
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
  marginBottom:5, fontFamily:"'Nunito', sans-serif",
}
export const IS = {
  width:'100%', background:'#FAF8F5', border:'1px solid #E2DDD6',
  borderRadius:8, padding:'9px 12px', color:'#1A1612',
  fontSize:13, fontFamily:"'Nunito', sans-serif",
  boxSizing:'border-box', outline:'none',
}
export const BS = {
  padding:'9px 18px', borderRadius:10, border:'none',
  cursor:'pointer', fontSize:12,
  fontFamily:"'Nunito', sans-serif", fontWeight:800,
}
export const NB = {
  background:'#FFFFFF', border:'1px solid #E2DDD6', borderRadius:8,
  color:'#6B6258', padding:'5px 12px', cursor:'pointer',
  fontSize:15, fontFamily:"'Nunito', sans-serif", fontWeight:700,
}

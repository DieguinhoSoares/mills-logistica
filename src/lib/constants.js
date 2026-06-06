// ─── DESIGN TOKENS ─────────────────────────────────────────────────────────
export const T = {
  bg:          '#F4F1EC',
  surface:     '#FFFFFF',
  surfaceAlt:  '#FAF8F5',
  surfaceLow:  '#F0EDE8',
  border:      '#E2DDD6',
  borderMid:   '#CEC8C0',
  text:        '#1A1612',
  textSec:     '#6B6258',
  textMuted:   '#9E9590',
  laranja:     '#F37021',
  laranjaDeep: '#C24003',
  laranjaLight:'#FEF0E6',
  verde:       '#004042',
  verdeLight:  '#E6F0F0',
  verdeMint:   '#6BFAC7',
  amarelo:     '#F5C400',
  amareloLight:'#FFF8E1',
  perigo:      '#D32F2F',
  perigoLight: '#FFEBEE',
  info:        '#1565C0',
  infoLight:   '#E3F2FD',
  shadow:    '0 1px 3px rgba(26,22,18,.07), 0 2px 8px rgba(26,22,18,.05)',
  shadowMd:  '0 4px 16px rgba(26,22,18,.11)',
  shadowLg:  '0 12px 40px rgba(26,22,18,.16)',
  r:   10,
  rSm:  6,
  rLg: 16,
}

// ─── CARD TYPES ─────────────────────────────────────────────────────────────
export const CARD_TYPES = {
  icamento:          { label: 'Içamento / Campo', color: '#004042', bg: '#E6F0F0', icon: '🏗️', short: 'IÇAMENTO'    },
  freteMillsInterno: { label: 'Frete Mills (Interno)', color: '#F37021', bg: '#FEF0E6', icon: '🚛', short: 'FRETE MILLS' },
  freteCliente:      { label: 'Frete Cliente',    color: '#C24003', bg: '#FDEEE9', icon: '📦', short: 'FRETE CLI.'  },
}

// ─── SUBTYPES POR CARD TYPE ──────────────────────────────────────────────────
export const CARD_SUBTYPES = {
  icamento: [
    { value: 'icamento',          label: '🏗️ Içamento' },
    { value: 'troca_cacamba',     label: '🪣 Troca de Caçamba' },
    { value: 'apoio_operacional', label: '🔧 Apoio Operacional' },
    { value: 'frete_pecas',       label: '📦 Frete de Peças' },
    { value: 'outros',            label: '📋 Outros' },
  ],
  freteMillsInterno: [
    { value: 'troca_tecnica',      label: '🔄 Troca Técnica' },
    { value: 'sinistro',           label: '⚠️ Sinistro' },
    { value: 'garantia',           label: '🛡️ Garantia' },
    { value: 'mobilizacao',        label: '📤 Mobilização' },
    { value: 'desmobilizacao',     label: '📥 Desmobilização' },
    { value: 'rollout',            label: '🔁 Rollout' },
    { value: 'quebra_contrato',    label: '❌ Quebra de Contrato' },
  ],
  freteCliente: [
    { value: 'mobilizacao',        label: '📤 Mobilização' },
    { value: 'desmobilizacao',     label: '📥 Desmobilização' },
    { value: 'rollout',            label: '🔁 Rollout' },
    { value: 'quebra_contrato',    label: '❌ Quebra de Contrato' },
  ],
}

// ─── URGENCY ─────────────────────────────────────────────────────────────────
export const URGENCY = {
  critico: { label: 'Crítico', color: '#D32F2F', bg: '#FFEBEE', icon: '🔴' },
  alto:    { label: 'Alto',    color: '#E65100', bg: '#FFF3E0', icon: '🟠' },
  medio:   { label: 'Médio',   color: '#F5C400', bg: '#FFF8E1', icon: '🟡' },
  baixo:   { label: 'Baixo',   color: '#2E7D32', bg: '#E8F5E9', icon: '🟢' },
}

// ─── BRAZIL STATES ───────────────────────────────────────────────────────────
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

export const FILIAIS = [
  'Assis (SP)', 'Campinas / Paulínia (SP)', 'Contagem (MG)',
  'Osasco (SP)', 'Parauapebas (PA)', 'Santos (SP)',
  'Sumaré (SP)', 'São José dos Pinhais (PR)',
]

export const MONTH_NAMES  = ['Janeiro','Fevereiro','Março','Abril','Maio','Junho','Julho','Agosto','Setembro','Outubro','Novembro','Dezembro']
export const WD_SHORT     = ['Seg','Ter','Qua','Qui','Sex','Sáb','Dom']

// ─── SHARED STYLES ───────────────────────────────────────────────────────────
export const LS = {
  display:'block', color:'#9E9590', fontSize:10, fontWeight:700,
  letterSpacing:'0.08em', textTransform:'uppercase',
  marginBottom:4, fontFamily:'IBM Plex Sans, sans-serif',
}
export const IS = {
  width:'100%', background:'#F4F1EC', border:'1px solid #E2DDD6',
  borderRadius:6, padding:'8px 11px', color:'#1A1612',
  fontSize:13, fontFamily:'IBM Plex Sans, sans-serif',
  boxSizing:'border-box', outline:'none',
}
export const BS = {
  padding:'8px 16px', borderRadius:10, border:'none',
  cursor:'pointer', fontSize:12,
  fontFamily:'IBM Plex Sans, sans-serif', fontWeight:600,
}
export const NB = {
  background:'#FFFFFF', border:'1px solid #E2DDD6', borderRadius:6,
  color:'#6B6258', padding:'4px 10px', cursor:'pointer',
  fontSize:15, fontFamily:'IBM Plex Sans, sans-serif', fontWeight:600,
}

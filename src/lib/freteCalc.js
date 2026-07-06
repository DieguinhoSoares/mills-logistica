// ============================================================
// freteCalc.js — Módulo de cálculo de custo de frete
// Mills Pesados | Divisão Pesados
// Tabela Reajustada 2026 (fator +2,4% sobre tabela anterior)
// Diárias e Escolta: valores negociados 2026
// Distância: Nominatim (coords) + OSRM (rota rodoviária real)
// ============================================================

// ── TABELA DE TARIFAS HENGEL — Reajustada 2026 ──────────────
// Frete ida: valor fixo (≤100km) ou R$/km (>100km)
// Fonte: Planilha Tabela Reajustada — coluna SP
const TABELA = [
  { min:0,    max:50,       fixo:true,  '3/4':739.77,  truck:1143.29, bitruck:1291.23, prancha3:1315.27, prancha4:1587.97 },
  { min:51,   max:100,      fixo:true,  '3/4':1143.29, truck:1681.29, bitruck:2017.56, prancha3:2072.81, prancha4:2479.44 },
  { min:101,  max:250,      fixo:false, '3/4':9.75,    truck:13.04,   bitruck:15.38,   prancha3:17.23,   prancha4:21.32   },
  { min:251,  max:500,      fixo:false, '3/4':8.91,    truck:11.43,   bitruck:14.06,   prancha3:15.94,   prancha4:19.32   },
  { min:501,  max:1000,     fixo:false, '3/4':8.16,    truck:11.01,   bitruck:13.17,   prancha3:15.15,   prancha4:18.42   },
  { min:1001, max:2000,     fixo:false, '3/4':7.97,    truck:10.71,   bitruck:12.89,   prancha3:14.59,   prancha4:17.73   },
  { min:2001, max:3000,     fixo:false, '3/4':7.89,    truck:10.68,   bitruck:12.72,   prancha3:14.48,   prancha4:17.56   },
  { min:3001, max:Infinity, fixo:false, '3/4':7.95,    truck:10.64,   bitruck:12.67,   prancha3:14.41,   prancha4:17.51   },
]

// ── DIÁRIAS — valores 2026 ────────────────────────────────────
export const DIARIAS = {
  '3/4':525.00, truck:607.00, bitruck:714.00, prancha3:840.00, prancha4:972.00,
}

// ── ESCOLTA / BATEDOR — valores 2026 ─────────────────────────
const ESCOLTA = [
  { max:50,       fixo:true,  valor:715.00 },
  { max:100,      fixo:true,  valor:858.00 },
  { max:250,      fixo:false, valor:5.50   },
  { max:500,      fixo:false, valor:4.40   },
  { max:Infinity, fixo:false, valor:3.90   },
]

// ── VEÍCULOS ─────────────────────────────────────────────────
// carga: capacidade útil máxima (t) conforme BID Mills 2024
export const VEICULOS = [
  // larg: largura máxima de carga suportada pelo veículo (m).
  // Truck e 3/4 operam dentro do limite legal sem necessidade de aumento (CONTRAN 882/2021, art.4º: 2,60m).
  // Bitruck e pranchas alargam para 3,20m quando necessário, sempre com AET (padrão Mills em todo transporte pesado).
  { id:'3/4',      label:'Caminhão 3/4',           carga:3.5,  comp:5,  larg:2.30, eixos:2 },
  { id:'truck',    label:'Caminhão Truck',          carga:13,   comp:9,  larg:2.60, eixos:3 },
  { id:'bitruck',  label:'Caminhão Bi-truck',       carga:17,   comp:10, larg:3.20, eixos:4 },
  { id:'prancha3', label:'Carreta Prancha 3 eixos', carga:32,   comp:15, larg:3.20, eixos:6 },
  { id:'prancha4', label:'Carreta Prancha 4 eixos', carga:40.5, comp:17, larg:3.20, eixos:7 },
]

// Motoristas Mills e seus veículos / descontos sobre Hengel
export const MOTORISTAS_MILLS = [
  { id:'valdir', nome:'Valdir', veiculoId:'bitruck',  desconto:0.35, label:'Valdir — Bi-truck (35% abaixo Hengel)'  },
  { id:'bento',  nome:'Bento',  veiculoId:'prancha3', desconto:0.30, label:'Bento — Prancha 3 eixos (30% abaixo Hengel)' },
]

// ── MAPEAMENTO GRUPO DE MODELO → VEÍCULO ─────────────────────
// Baseado na escala de carga útil do BID Mills 2024:
//   ≤ 3,5t → 3/4 | ≤ 13t → truck | ≤ 17t → bitruck
//   ≤ 32t  → prancha3 | ≤ 40,5t → prancha4
const GRUPO_VEICULO = {
  'Carregadeira de Pneus 1 a 2 t':             '3/4',      // 1,5t
  'Carregadeira de Pneus 2 a 3 t':             '3/4',      // 2,5t
  'Carregadeira de Pneus 8 a 9 t':             'truck',    // 8,5t
  'Carregadeira de Pneus 10 a 11 t':           'truck',    // 10,5t
  'Carregadeira de Pneus 12 a 13 t':           'truck',    // 12,5t
  'Carregadeira de Pneus 14 a 16 t':           'bitruck',  // 15,0t
  'Carregadeira de Pneus 17 a 18 t':           'prancha3', // 17,5t
  'Carregadeira de Pneus 19 a 20 t':           'prancha3', // 19,5t
  'Carregadeira de Pneus 21 a 23 t':           'prancha3', // 22,0t
  'Mini Carregadeira 2 a 3 t':                 '3/4',      // 2,5t
  'Mini Carregadeira 4 a 5 t':                 'truck',    // 4,5t
  'Mini Escavadeira 3 t':                      '3/4',      // 3,0t
  'Escavadeira de esteiras 12 a 13 t':         'truck',    // 12,5t
  'Escavadeira de esteiras 14 a 16 t':         'bitruck',  // 15,0t
  'Escavadeira de esteiras 16 t':              'bitruck',  // 16,0t
  'Escavadeira de esteiras 17 a 20 t':         'prancha3', // 18,5t
  'Escavadeira de esteiras 20 a 22 t':         'prancha3', // 21,0t
  'Escavadeira de esteiras 30 a 36 t':         'prancha4', // 33,0t
  'Escavadeira de Pneus 23 a 26 t':            'prancha3', // 24,5t
  'Escavadeira Anfíbia 20t':                   'prancha3', // 20,0t
  'Motoniveladora 14 a 16 t':                  'bitruck',  // 15,0t
  'Motoniveladora 17 a 18 t':                  'prancha3', // 17,5t
  'Motoniveladora 19 a 20 t':                  'prancha3', // 19,5t
  'Retroescavadeira 7 a 9 t':                  'truck',    // 8,0t
  'Trator de Esteiras 14 a 16 t':              'bitruck',  // 15,0t
  'Trator de Esteiras 19 a 20 t':              'prancha3', // 19,5t
  'Trator de Esteiras 21 a 22 t':              'prancha3', // 21,5t
  'Trator de Esteiras 23 a 29 t':              'prancha3', // 26,0t
  'Trator de Esteiras 39 t':                   'prancha4', // 39,0t
  'Compactador Vibratório 10 a 11 t / Liso':   'truck',    // 10,5t
  'Compactador Vibratório 10 a 11 t / Kit PD': 'truck',    // 10,5t
  'Compactador Vibratório 10 a 11 t / PD':     'truck',    // 10,5t
  'Compactador Vibratório 12 a 13 t / Kit PD': 'truck',    // 12,5t
  'Compactador Vibratório 21 t':               'prancha3', // 21,0t
  'Compactador Tandem 10 a 11 t / Liso':       'truck',    // 10,5t
  'Compactador Tandem 7t':                     'truck',    // 7,0t
  'Compactador de Pneus 26 a 28 t / 9 Pneus': 'prancha3', // 27,0t
  'Mini Compactador Tandem 2 a 3 t / Liso':    '3/4',      // 2,5t
  'Mini Compactador 1,5 t':                    '3/4',      // 1,5t
  // Caminhão Basculante — peso VAZIO (viaja embarcado, sem carga, sobre prancha)
  // Nomenclatura corrigida em 2026-07 para bater com "Grupo de modelo" real do
  // SIM (por m³ de caçamba), confirmado via BASE_SIM_06_07.csv — a nomenclatura
  // anterior (por eixos) nunca existiu no SIM, então nenhum destes 95 ativos
  // reais (10+66+5+14) tinha cobertura, mesmo a tabela "parecendo" completa.
  'Caminhão Basculante 6x4 / 14 m³':           'prancha3',
  'Caminhão Basculante 6x4 / 16 m³':           'prancha3',
  'Caminhão Basculante 6x4 / 20 m³':           'prancha3',
  'Caminhão Basculante 8x4 / 22 m³':           'prancha3',
  'Caminhão Comboio 4x2 / 6 m³':               'prancha3',
  'Caminhão Comboio 6x4 / 10 m³':              'prancha3',
  'Caminhão Pipa 6X4 / 20 m³':                 'prancha3',
  'Caminhão Plataforma 6x4 / 11mt':            'prancha3',
  // Trator Agrícola — 3 de 9 faixas confirmadas com ficha técnica real do
  // fabricante (John Deere), 2026-07. Cobre 121 de 158 ativos dessa família.
  'Trator Agrícola 220 a 230 CV':               'truck',    // JD 7M 230: 9,2t
  'Trator Agrícola 250 a 270 CV':               'bitruck',  // JD 8270R: 14,0t
  'Trator Agrícola 140 a 159 CV':               'bitruck',  // JD 6150J: 8,55t mas 2,65m de largura > limite do Truck (2,60m)
}

// ── PESO OPERACIONAL POR GRUPO DE MODELO (t) ─────────────────
const PESO_GRUPO = {
  'Carregadeira de Pneus 1 a 2 t':             1.5,
  'Carregadeira de Pneus 2 a 3 t':             2.5,
  'Carregadeira de Pneus 8 a 9 t':             8.5,
  'Carregadeira de Pneus 10 a 11 t':           10.5,
  'Carregadeira de Pneus 12 a 13 t':           12.5,
  'Carregadeira de Pneus 14 a 16 t':           15.8,  // Fonte: mills.com.br (Cat 938K-SC)
  'Carregadeira de Pneus 17 a 18 t':           17.5,
  'Carregadeira de Pneus 19 a 20 t':           19.5,
  'Carregadeira de Pneus 21 a 23 t':           22.0,
  'Mini Carregadeira 2 a 3 t':                 2.5,
  'Mini Carregadeira 4 a 5 t':                 4.5,
  'Mini Escavadeira 3 t':                      3.0,
  'Escavadeira de esteiras 12 a 13 t':         12.5,
  'Escavadeira de esteiras 14 a 16 t':         15.0,
  'Escavadeira de esteiras 16 t':              16.0,
  'Escavadeira de esteiras 17 a 20 t':         17.2,  // Fonte: Cat Brasil (press release oficial, Cat 318D2L)
  'Escavadeira de esteiras 20 a 22 t':         21.0,
  'Escavadeira de esteiras 30 a 36 t':         33.0,
  'Escavadeira de Pneus 23 a 26 t':            24.5,
  'Escavadeira Anfíbia 20t':                   20.0,
  'Motoniveladora 14 a 16 t':                  15.0,
  'Motoniveladora 17 a 18 t':                  17.5,
  'Motoniveladora 19 a 20 t':                  19.5,
  'Retroescavadeira 7 a 9 t':                  8.0,
  'Trator de Esteiras 14 a 16 t':              15.0,
  'Trator de Esteiras 19 a 20 t':              19.5,
  'Trator de Esteiras 21 a 22 t':              21.5,
  'Trator de Esteiras 23 a 29 t':              29.8,  // Fonte: Cat oficial (comunicado de lançamento Cat D7, peso operacional)
  'Trator de Esteiras 39 t':                   39.0,
  'Compactador Vibratório 10 a 11 t / Liso':   10.5,
  'Compactador Vibratório 10 a 11 t / Kit PD': 10.5,
  'Compactador Vibratório 10 a 11 t / PD':     10.5,
  'Compactador Vibratório 12 a 13 t / Kit PD': 12.5,
  'Compactador Vibratório 21 t':               21.0,
  'Compactador Tandem 10 a 11 t / Liso':       10.5,
  'Compactador Tandem 7t':                     7.0,
  'Compactador de Pneus 26 a 28 t / 9 Pneus': 27.0,
  'Mini Compactador Tandem 2 a 3 t / Liso':    2.5,
  'Mini Compactador 1,5 t':                    1.5,
  // Peso VAZIO (o caminhão viaja embarcado sobre a prancha, sem carga).
  // Âncoras reais Mills: Volvo VM-330 Basculante 13,6t · Mercedes AXOR-4144
  // Basculante 15,5t. As faixas de 14/16/20/22 m³ interpolam entre essas duas
  // âncoras (mais m³ de caçamba → chassi mais robusto → mais pesado vazio) —
  // ainda ESTIMADO por interpolação, não é ficha técnica exata por m³.
  'Caminhão Basculante 6x4 / 14 m³':           13.6,  // = Volvo VM-330 (âncora real)
  'Caminhão Basculante 6x4 / 16 m³':           14.6,  // interpolado (média das 2 âncoras)
  'Caminhão Basculante 6x4 / 20 m³':           15.5,  // = Mercedes AXOR-4144 (âncora real)
  'Caminhão Basculante 8x4 / 22 m³':           17.0,  // estimado — eixo extra (8x4) sobre a âncora AXOR-4144
  'Caminhão Comboio 4x2 / 6 m³':               11.0,  // estimado — chassi menor (4x2) que o Comboio 6x4
  'Caminhão Comboio 6x4 / 10 m³':              13.5,  // Fonte: mills.com.br (Volvo VM-270/VM-290, ambos 13,5t)
  'Caminhão Pipa 6X4 / 20 m³':                 15.3,  // Fonte: mills.com.br (Volvo VM-270 Pipa 15,3t; Mercedes Atego 2730 15,3t — idêntico)
  'Caminhão Plataforma 6x4 / 11mt':            13.6,  // estimado = mesmo chassi do Basculante (Volvo VM-330); sem peso/dimensão publicado
  // Trator Agrícola — Fonte: deere.com.br (ficha técnica oficial do fabricante).
  // Peso "base sem lastro" quando disponível; senão, o lastro máximo informado
  // (ver nota em cada linha) — ainda não é a ficha exata da Mills, mas é dado
  // real do fabricante em vez de uma faixa "chutada" como as outras 6 abaixo.
  'Trator Agrícola 220 a 230 CV':               9.2,   // JD 7M 230 — peso base sem lastro (lastro máx eleva a 12,65t)
  'Trator Agrícola 250 a 270 CV':               14.0,  // JD 8270R — peso de fábrica sem lastro, config. mais pesada (13,1–14,0t)
  'Trator Agrícola 140 a 159 CV':               8.55,  // JD 6150J — lastro máximo informado (peso base sem lastro não publicado)
}

// ── LARGURA DE TRANSPORTE POR GRUPO DE MODELO (m) ─────────────
// Fonte: catálogos de fábrica (Caterpillar, Komatsu, JCB, Bobcat) e fichas técnicas
// publicadas (LECTURA Specs, VeriTread). Onde há divergência entre fontes ou
// variação por configuração (sapata/pneu/lâmina), usado o valor mais largo
// reportado — nunca o mais estreito — para nunca subestimar a necessidade real.
// Motoniveladoras e tratores de esteira: largura considera a lâmina montada,
// que é o que normalmente excede o limite legal de 2,60m mesmo em máquinas leves.
// ⚠️ Revisar com a operação — alguns valores são estimados por interpolação
// entre faixas de peso vizinhas quando não havia modelo de catálogo exato.
const LARGURA_GRUPO = {
  'Carregadeira de Pneus 1 a 2 t':             1.60,  // estimado — classe muito leve
  'Carregadeira de Pneus 2 a 3 t':             1.80,  // estimado, próximo à mini carregadeira
  'Carregadeira de Pneus 8 a 9 t':             1.84,  // Cat 906M
  'Carregadeira de Pneus 10 a 11 t':           2.50,  // Fonte: mills.com.br (Volvo L60F, 11,6t)
  'Carregadeira de Pneus 12 a 13 t':           2.55,  // Fonte: mills.com.br (JD 524K-II/544K-II 2,54m + Cat 930K 13,1t/2,55m — 3 modelos convergindo)
  'Carregadeira de Pneus 14 a 16 t':           3.06,  // Fonte: mills.com.br (Cat 938K-SC, 15,8t) ⚠️ campo largura=altura no cadastro Mills, confirmar visualmente
  'Carregadeira de Pneus 17 a 18 t':           2.70,  // Komatsu WA380-6
  'Carregadeira de Pneus 19 a 20 t':           2.40,  // Cat 950 (modelo mais estreito que a classe abaixo)
  'Carregadeira de Pneus 21 a 23 t':           3.01,  // Cat 966
  'Mini Carregadeira 2 a 3 t':                 1.88,  // Bobcat S650
  'Mini Carregadeira 4 a 5 t':                 1.83,  // Fonte: mills.com.br (Bobcat S650, 3,8t)
  'Mini Escavadeira 3 t':                      1.78,  // Cat 303.5/303.5E CR
  'Escavadeira de esteiras 12 a 13 t':         2.59,  // Cat 312DL 13,7t (revenda+Cat); cross-check Cat 313GC oficial: 2,49m
  'Escavadeira de esteiras 14 a 16 t':         2.60,  // estimado, limiar
  'Escavadeira de esteiras 16 t':              2.60,  // estimado, limiar
  'Escavadeira de esteiras 17 a 20 t':         2.76,  // Fonte: Cat Brasil oficial (Cat 318D2L, 17,2t, largura de transporte)
  'Escavadeira de esteiras 20 a 22 t':         2.98,  // Fonte: mills.com.br (Cat 320GC, 20,5t)
  'Escavadeira de esteiras 30 a 36 t':         3.19,  // Fonte: mills.com.br (Cat 336D, 36,2t)
  'Escavadeira de Pneus 23 a 26 t':            2.85,  // estimado, classe Volvo EW/Cat M
  'Escavadeira Anfíbia 20t':                   2.98,  // base sem pontões (pontões ampliam para 4m+ — transporte em separado)
  // Motoniveladora: a lâmina GIRA (alinha ao sentido de marcha) para transporte —
  // largura considerada já é com a lâmina girada, não a largura de trabalho (3,70m).
  'Motoniveladora 14 a 16 t':                  2.48,  // Fonte: mills.com.br (Cat 140K, 18,4t — corpo, lâmina gira p/ transporte)
  'Motoniveladora 17 a 18 t':                  2.48,  // Fonte: mills.com.br (Cat 140K, 18,4t — corpo, lâmina gira p/ transporte)
  'Motoniveladora 19 a 20 t':                  2.48,  // Fonte: mills.com.br (Cat 140K, 18,4t — corpo, lâmina gira p/ transporte)
  'Retroescavadeira 7 a 9 t':                  2.35,  // Fonte: mills.com.br (JCB 3CX, 8,2t)
  // Trator de Esteiras: largura COM lâmina montada (configuração padrão assumida).
  // A lâmina pode ser DESMONTADA (não gira) para reduzir a largura — ver REQUER_DESMONTAGEM_LAMINA.
  'Trator de Esteiras 14 a 16 t':              2.64,  // Fonte: mills.com.br (Cat D6T-XL, 20,5t, lâmina SU montada)
  'Trator de Esteiras 19 a 20 t':              2.64,  // Fonte: mills.com.br (Cat D6T-XL, 20,5t, lâmina SU montada)
  'Trator de Esteiras 21 a 22 t':              3.29,  // Fonte: catálogo oficial Komatsu D65E/A, com lâmina (cross-check D61EX: 3,86m)
  'Trator de Esteiras 23 a 29 t':              3.70,  // Fonte: Cat oficial — "largura de transporte de 3,7m com lâmina instalada" (Cat D7, 29,8t)
  'Trator de Esteiras 39 t':                   3.93,  // com lâmina SU — Cat D8T (sem lâmina: 3,06m)
  'Compactador Vibratório 10 a 11 t / Liso':   2.30,  // Fonte: mills.com.br (Cat CS54, 10,6t)
  'Compactador Vibratório 10 a 11 t / Kit PD': 2.30,
  'Compactador Vibratório 10 a 11 t / PD':     2.30,
  'Compactador Vibratório 12 a 13 t / Kit PD': 2.33,  // Fonte: LECTURA + VeriTread (Cat CB13, 12,9t — 2 fontes convergindo)
  'Compactador Vibratório 21 t':               2.40,  // Fonte: catálogo oficial Dynapac CA610D (21t), largura de transporte
  'Compactador Tandem 10 a 11 t / Liso':       2.34,  // Cat CB13
  'Compactador Tandem 7t':                     1.98,  // Fonte: VeriTread (Cat CB7, 7t oficial Cat)
  'Compactador de Pneus 26 a 28 t / 9 Pneus': 2.16,  // Fonte: mills.com.br (Cat CW34, peso máx. com lastro 27t — confirma a faixa)
  'Mini Compactador Tandem 2 a 3 t / Liso':    1.30,  // estimado, classe Cat CB2.5
  'Mini Compactador 1,5 t':                    1.30,  // Cat CB1.8
  // Caminhão Basculante — largura padrão de via (todos os portes ficam na faixa legal de 2,60m)
  'Caminhão Basculante 6x4 / 14 m³':           2.55,  // estimado
  'Caminhão Basculante 6x4 / 16 m³':           2.60,  // Fonte: mills.com.br — Volvo VM-330 e Mercedes AXOR-4144 Basculante, ambos 2,60m
  'Caminhão Basculante 6x4 / 20 m³':           2.60,  // idem
  'Caminhão Basculante 8x4 / 22 m³':           2.60,  // estimado (largura de via legal, não muda com m³)
  'Caminhão Comboio 4x2 / 6 m³':               2.60,  // estimado
  'Caminhão Comboio 6x4 / 10 m³':              2.60,  // Fonte: mills.com.br (Volvo VM-270/VM-290)
  'Caminhão Pipa 6X4 / 20 m³':                 2.60,  // Fonte: mills.com.br (Volvo VM-270 Pipa; Mercedes Atego 2730)
  'Caminhão Plataforma 6x4 / 11mt':            2.60,  // estimado = mesmo chassi do Basculante (Volvo VM-330)
  'Trator Agrícola 220 a 230 CV':               2.50,  // JD 7M 230 — largura não publicada, estimado por classe (mesma faixa do 8270R eixo curto)
  'Trator Agrícola 250 a 270 CV':               3.01,  // JD 8270R — Fonte: deere.com.br (eixo traseiro longo, config. mais larga: 2,438–3,010m)
  'Trator Agrícola 140 a 159 CV':               2.65,  // JD 6150J — Fonte: deere.com.br (bitola traseira máxima, usada como proxy de largura total)
}

// Largura SEM a lâmina montada — alternativa mais estreita para tratores de esteira
// quando a lâmina for desmontada para transporte (operação comum nessa categoria).
const LARGURA_SEM_LAMINA_GRUPO = {
  // 14-16t e 19-20t removidos: dado real da Mills (Cat D6T-XL, 2,64m COM lâmina)
  // já cabe em largura normal — não precisa de desmontagem nessa faixa.
  'Trator de Esteiras 21 a 22 t': 3.10,  // estimado — Komatsu D65 (ainda não confirmado na Mills)
  'Trator de Esteiras 23 a 29 t': 3.30,  // estimado — classe Cat D7/Komatsu D85 (ainda não confirmado na Mills)
  'Trator de Esteiras 39 t':      3.06,  // Cat D8T (ainda não confirmado na Mills)
}

// Grupos onde a lâmina precisa ser DESMONTADA (não apenas girada) para reduzir a
// largura de transporte — comum em tratores de esteira de médio/grande porte.
const REQUER_DESMONTAGEM_LAMINA = new Set(Object.keys(LARGURA_SEM_LAMINA_GRUPO))

// ── COMPRIMENTO DE TRANSPORTE POR GRUPO DE MODELO (m) ─────────
// Necessário para saber quantas máquinas cabem juntas no mesmo veículo
// (o comprimento de cada máquina SOMA — elas viajam uma atrás da outra).
// ⚠️ Vários valores estimados por ausência de ficha de catálogo exata —
// revisar com a operação.
const COMPRIMENTO_GRUPO = {
  'Carregadeira de Pneus 1 a 2 t':             3.50,  // estimado
  'Carregadeira de Pneus 2 a 3 t':             4.00,  // estimado
  'Carregadeira de Pneus 8 a 9 t':             5.47,  // Cat 906M
  'Carregadeira de Pneus 10 a 11 t':           7.27,  // Fonte: mills.com.br (Volvo L60F, 11,6t)
  'Carregadeira de Pneus 12 a 13 t':           7.61,  // Fonte: mills.com.br (JD 524K-II/544K-II 7,34-7,43m + Cat 930K 7,61m — 3 modelos convergindo)
  'Carregadeira de Pneus 14 a 16 t':           8.07,  // Fonte: mills.com.br (Cat 938K-SC, 15,8t)
  'Carregadeira de Pneus 17 a 18 t':           6.40,  // estimado, classe Komatsu WA380
  'Carregadeira de Pneus 19 a 20 t':           6.15,  // Cat 950
  'Carregadeira de Pneus 21 a 23 t':           7.29,  // Cat 966 (transporte)
  'Mini Carregadeira 2 a 3 t':                 3.50,  // estimado, Bobcat S650
  'Mini Carregadeira 4 a 5 t':                 3.63,  // Fonte: mills.com.br (Bobcat S650, 3,8t)
  'Mini Escavadeira 3 t':                      4.80,  // Cat 303.5/303.5E CR (transporte)
  'Escavadeira de esteiras 12 a 13 t':         7.62,  // Cat 312DL 13,7t (revenda+Cat); cross-check Cat 313GC oficial: 7,70m
  'Escavadeira de esteiras 14 a 16 t':         8.20,  // estimado
  'Escavadeira de esteiras 16 t':              8.20,  // estimado
  'Escavadeira de esteiras 17 a 20 t':         7.61,  // Fonte: Cat Brasil oficial (Cat 318D2L, 17,2t, comprimento de transporte)
  'Escavadeira de esteiras 20 a 22 t':         9.53,  // Fonte: mills.com.br (Cat 320GC, 20,5t)
  'Escavadeira de esteiras 30 a 36 t':         11.17, // Fonte: mills.com.br (Cat 336D, 36,2t)
  'Escavadeira de Pneus 23 a 26 t':            9.00,  // estimado
  'Escavadeira Anfíbia 20t':                   9.53,  // base sem pontões — pontões somam comprimento separadamente
  'Motoniveladora 14 a 16 t':                  10.01, // Fonte: mills.com.br (Cat 140K, 18,4t)
  'Motoniveladora 17 a 18 t':                  10.01, // Fonte: mills.com.br (Cat 140K, 18,4t)
  'Motoniveladora 19 a 20 t':                  10.01, // Fonte: mills.com.br (Cat 140K, 18,4t)
  'Retroescavadeira 7 a 9 t':                  7.19,  // Fonte: mills.com.br (JCB 3CX, 8,2t)
  'Trator de Esteiras 14 a 16 t':              6.74,  // Fonte: mills.com.br (Cat D6T-XL, 20,5t, com ripper)
  'Trator de Esteiras 19 a 20 t':              6.74,  // Fonte: mills.com.br (Cat D6T-XL, 20,5t, com ripper)
  'Trator de Esteiras 21 a 22 t':              5.43,  // Fonte: catálogo oficial Komatsu D65E/A (19,75t), comprimento total
  'Trator de Esteiras 23 a 29 t':              6.50,  // estimado, sem lâmina — classe Cat D7/Komatsu D85
  'Trator de Esteiras 39 t':                   7.50,  // estimado, sem lâmina — Cat D8T
  'Compactador Vibratório 10 a 11 t / Liso':   5.85,  // Fonte: mills.com.br (Cat CS54, 10,6t)
  'Compactador Vibratório 10 a 11 t / Kit PD': 5.70,
  'Compactador Vibratório 10 a 11 t / PD':     5.70,
  'Compactador Vibratório 12 a 13 t / Kit PD': 4.74,  // Fonte: LECTURA + VeriTread (Cat CB13, 12,9t — 2 fontes convergindo)
  'Compactador Vibratório 21 t':               6.00,  // Fonte: catálogo oficial Dynapac CA610D (21t), comprimento de transporte
  'Compactador Tandem 10 a 11 t / Liso':       4.70,  // Cat CB13
  'Compactador Tandem 7t':                     4.55,  // Fonte: VeriTread (Cat CB7, 7t oficial Cat)
  'Compactador de Pneus 26 a 28 t / 9 Pneus': 5.35,  // Fonte: mills.com.br (Cat CW34, peso máx. com lastro 27t)
  'Mini Compactador Tandem 2 a 3 t / Liso':    3.00,  // estimado
  'Mini Compactador 1,5 t':                    2.80,  // estimado, Cat CB1.8
  'Caminhão Basculante 6x4 / 14 m³':           7.50,  // estimado — Volvo VM-330 (menor âncora)
  'Caminhão Basculante 6x4 / 16 m³':           7.78,  // Fonte: mills.com.br — média Volvo VM-330 (8,00m) + Mercedes AXOR-4144 (7,56m)
  'Caminhão Basculante 6x4 / 20 m³':           7.56,  // Fonte: mills.com.br (Mercedes AXOR-4144)
  'Caminhão Basculante 8x4 / 22 m³':           11.00, // estimado — eixo extra alonga o chassi
  'Caminhão Comboio 4x2 / 6 m³':               8.50,  // estimado
  'Caminhão Comboio 6x4 / 10 m³':              9.95,  // Fonte: mills.com.br (Volvo VM-270/VM-290, ambos 9,95m)
  'Caminhão Pipa 6X4 / 20 m³':                 9.89,  // Fonte: mills.com.br (Volvo VM-270 Pipa 9,89m; Mercedes Atego 2730 9,89m — idêntico)
  'Caminhão Plataforma 6x4 / 11mt':            8.00,  // estimado = mesmo chassi do Basculante (Volvo VM-330)
  'Trator Agrícola 220 a 230 CV':               5.824, // JD 7M 230 — Fonte: deere.com.br (comprimento total)
  'Trator Agrícola 250 a 270 CV':               6.043, // JD 8270R — Fonte: deere.com.br (comprimento total)
  'Trator Agrícola 140 a 159 CV':               4.969, // JD 6150J — Fonte: deere.com.br (comprimento máximo com pesos/contrapesos frontais)
}

// Grupos que SEMPRE embarcam em prancha, independente do que peso/largura/
// comprimento isoladamente sugerissem — caminhão basculante é um veículo
// completo (eixos, cabine) e não se embarca em outro caminhão de porte
// similar; sempre vai de prancha (3 ou 4 eixos, conforme peso/quantidade).
// Categorias sempre rebocadas por cavalo mecânico — nunca embarcadas em cima
// de outro veículo. Ex: Conjunto Canavieiro (é o próprio semirreboque).
// TODO: quando a Mills/Hengel tiver uma tarifa de reboque cadastrada, criar
// um veículo 'cavalo_mecanico' em VEICULOS + coluna na TABELA_HENGEL e
// calcular o frete de verdade em vez de sinalizar "requer cotação manual".
const CATEGORIAS_REBOCADAS = new Set([
  'Conjunto Canavieiro',
])

const FORCA_PRANCHA = new Set([
  'Caminhão Basculante 6x4 / 14 m³',
  'Caminhão Basculante 6x4 / 16 m³',
  'Caminhão Basculante 6x4 / 20 m³',
  'Caminhão Basculante 8x4 / 22 m³',
  'Caminhão Comboio 4x2 / 6 m³',
  'Caminhão Comboio 6x4 / 10 m³',
  'Caminhão Pipa 6X4 / 20 m³',
  'Caminhão Plataforma 6x4 / 11mt',
])

// ── BUSCA GRUPO DE MODELO NO CSV SIM ─────────────────────────
// ── DIMENSÕES POR FABRICANTE + MODELO (exatas, pesquisadas modelo a modelo) ──
// Usadas no lugar da faixa de peso genérica (GRUPO) sempre que o CSV do SIM
// trouxer Fabricante+Modelo e o par existir aqui — mais preciso, porque dois
// modelos na MESMA faixa de peso podem ter larguras bem diferentes (ex: John
// Deere 850J-II 2,49m vs Komatsu D65 3,29m, ambos ~20-21t).
// largura = COM lâmina/implemento montado (pior caso real); larguraSemLamina
// só existe pra quem a lâmina é desmontável (tratores de esteiras grandes).
function normalizaModelo(s) {
  return String(s||'').toUpperCase().replace(/[^A-Z0-9]/g,'')
}

// Extrai a categoria de uma string de grupoModelo — ex: "Motoniveladora 14 a
// 16 t" → "Motoniveladora". Usado pelo fallback de "modelo similar dentro da
// categoria" quando o CSV traz uma faixa de peso que ainda não catalogamos.
function categoriaDoGrupo(grupo) {
  // Bug corrigido em 2026-07: a classe de caracteres [A-Za-zÀ-ÿ ] não incluía
  // parênteses/vírgulas/barras — qualquer texto com "(", "/" etc. ANTES do
  // primeiro dígito fazia o regex falhar e devolver a string INTEIRA como
  // "categoria" (ex: "Caminhão Basculante Toco (2 eixos)" nunca reduzia a
  // "Caminhão Basculante"), quebrando o match com outras faixas da mesma
  // categoria. Agora aceita qualquer caractere não-dígito antes do primeiro
  // número, e para exatamente no primeiro dígito.
  const m = String(grupo || '').match(/^([^\d]+?)\s*\d/)
  return (m ? m[1] : String(grupo || '')).trim()
}

// Empilhadeiras trazem o peso de embarque DIRETO no texto do "Grupo de
// modelo" — ex: "Empilhadeira Diesel 3,5 t / 3,7 m Elev." → 3,5t. Em vez de
// catalogar cada uma das ~21 variantes manualmente (Diesel/Elétrica/GLP ×
// várias capacidades × várias alturas de elevação), extrai o peso direto da
// string — funciona automaticamente pra qualquer variante nova que apareça.
// Largura/comprimento são estimados por classe de peso (padrão de mercado
// pra empilhadeiras contrabalançadas — não é ficha exata da Mills por modelo).
function dimensaoEmpilhadeira(grupo) {
  if (!/^Empilhadeira/i.test(grupo)) return null
  const m = grupo.match(/(\d+(?:,\d+)?)\s*t/i)
  if (!m) return null
  const peso = parseFloat(m[1].replace(',', '.'))
  let largura, comprimento
  if      (peso <= 2)    { largura = 1.15; comprimento = 3.60 }
  else if (peso <= 3)    { largura = 1.20; comprimento = 4.00 }
  else if (peso <= 4)    { largura = 1.30; comprimento = 4.30 }
  else if (peso <= 9)    { largura = 2.10; comprimento = 5.80 }
  else                   { largura = 2.60; comprimento = 7.50 } // 16-18t (container/pesada)
  return { peso, largura, comprimento }
}

// Dado um grupoModelo não catalogado em PESO_GRUPO (ex: uma faixa nova que a
// Mills passou a usar e ainda não colocamos aqui), acha a faixa MAIS PRÓXIMA
// dentro da MESMA categoria — melhor do que assumir peso zero ou usar o
// fallback genérico de "qualquer equipamento não identificado".
function faixaSimilar(grupo) {
  const categoria = categoriaDoGrupo(grupo)
  if (!categoria) return null
  const candidatos = Object.keys(PESO_GRUPO).filter(k => categoriaDoGrupo(k) === categoria)
  if (!candidatos.length) return null
  const alvoNum = parseFloat(String(grupo).match(/(\d+(?:[.,]\d+)?)/)?.[1]?.replace(',','.') ?? 'NaN')
  let melhor = candidatos[0], melhorDist = Infinity
  for (const c of candidatos) {
    const cNum = parseFloat(String(c).match(/(\d+(?:[.,]\d+)?)/)?.[1]?.replace(',','.') ?? 'NaN')
    const dist = (isNaN(alvoNum) || isNaN(cNum)) ? 0 : Math.abs(alvoNum - cNum)
    if (dist < melhorDist) { melhor = c; melhorDist = dist }
  }
  return melhor
}

const DIMENSOES_MODELO = {
  // ── Motoniveladora ──
  'CATERPILLAR|140K':        { peso:18.4, largura:2.48, comprimento:10.01 },
  // Fonte: mills.com.br (ficha técnica oficial, consultada em 2026-07) —
  // Peso Operacional 15,7t · Comprimento 9,8m · Largura 2,49m. Specs
  // idênticas às da 120LVR no catálogo da Mills (mesma máquina-base).
  'CATERPILLAR|120':         { peso:15.7, largura:2.49, comprimento:9.80  },
  'CATERPILLAR|120LVR':      { peso:15.7, largura:2.49, comprimento:9.80  },
  // ── Pá Carregadeira / Carregadeira de Pneus ──
  'CATERPILLAR|924K':        { peso:11.5, largura:2.55, comprimento:7.61  }, // Cat 924K — cross-check Cat 930K (13,1t/2,55m/7,61m)
  'CATERPILLAR|924H':        { peso:11.2, largura:2.55, comprimento:7.50  }, // Cat 924H — estimado a partir da 924K
  'CATERPILLAR|924':         { peso:11.0, largura:2.55, comprimento:7.40  }, // Cat 924 genérico
  'VOLVO|L60F':              { peso:11.6, largura:2.50, comprimento:7.27  },
  'JOHNDEERE|524KII':        { peso:12.6, largura:2.54, comprimento:7.34  },
  'JOHNDEERE|544KII':        { peso:13.1, largura:2.54, comprimento:7.43  },
  'CATERPILLAR|930K':        { peso:13.1, largura:2.55, comprimento:7.61  },
  'CATERPILLAR|938KSC':      { peso:15.8, largura:3.06, comprimento:8.07  }, // ⚠️ largura=altura no cadastro Mills, confirmar
  'CATERPILLAR|950H':        { peso:18.5, largura:2.86, comprimento:8.02 },  // Fonte: LECTURA Specs (Cat 950H 2006-2011) — 18,5t/8,02m/2,86m
  'CATERPILLAR|966L':        { peso:23.22,largura:2.99, comprimento:8.75 },  // Fonte: LECTURA Specs (Cat 966L 2019+) — 23,22t/8,75m/2,99m
  // ── Escavadeira de Esteiras ──
  'CATERPILLAR|312DL':       { peso:13.7, largura:2.59, comprimento:7.62  },
  'CATERPILLAR|313D2GC':     { peso:13.4, largura:2.76, comprimento:7.61  },
  'CATERPILLAR|320GC':       { peso:20.5, largura:2.98, comprimento:9.53  },
  'CATERPILLAR|320NG':       { peso:22.0, largura:2.98, comprimento:9.53  },
  'CATERPILLAR|318D2L':      { peso:17.2, largura:2.76, comprimento:7.61  },
  'CATERPILLAR|336D':        { peso:36.2, largura:3.19, comprimento:11.17 },
  // ── Trator de Esteiras (largura COM lâmina; lâmina é desmontável) ──
  'CATERPILLAR|D4':          { peso:14.4, largura:2.90, comprimento:6.45  },
  'CATERPILLAR|D6TXL':       { peso:20.5, largura:2.64, comprimento:6.74, larguraSemLamina:2.40 },
  'CATERPILLAR|D7':          { peso:29.8, largura:3.70, comprimento:4.74, larguraSemLamina:3.30 },  // Fonte: LECTURA (D7 XL 2020+) — comp 4,74m; Cat oficial: largura 3,7m c/ lâmina
  'JOHNDEERE|850JII':        { peso:20.7, largura:3.25, comprimento:5.38, larguraSemLamina:2.49 }, // largura=lâmina (manual JD, linha D); sem lâmina=esteira (linha M)
  'KOMATSU|D65E':            { peso:19.75,largura:3.29, comprimento:5.43, larguraSemLamina:3.10 },
  'KOMATSU|D65A':            { peso:19.75,largura:3.29, comprimento:5.43, larguraSemLamina:3.10 },
  'KOMATSU|D61EX':           { peso:19.77,largura:3.86, comprimento:5.48, larguraSemLamina:3.10 },
  // ── Retroescavadeira ──
  'JCB|3CX':                 { peso:8.2,  largura:2.35, comprimento:7.19  },
  'CATERPILLAR|416F':        { peso:7.2,  largura:2.26, comprimento:7.03  },
  'JOHNDEERE|310P':          { peso:7.1,  largura:2.18, comprimento:7.09  },
  // ── Minicarregadeira ──
  'BOBCAT|S650':             { peso:3.8,  largura:1.83, comprimento:3.63  },
  'BOBCAT|S450':             { peso:2.2,  largura:1.45, comprimento:3.17  },
  'CATERPILLAR|226B':        { peso:2.6,  largura:1.53, comprimento:3.23  },
  // ── Rolo Compactador ──
  'CATERPILLAR|CS54':        { peso:10.6, largura:2.30, comprimento:5.85  },
  'CATERPILLAR|CS10GC':      { peso:12.0, largura:2.30, comprimento:5.70  },
  'CATERPILLAR|CS11GC':      { peso:12.9, largura:2.30, comprimento:5.70  },
  'CATERPILLAR|CB10':        { peso:9.7,  largura:1.87, comprimento:4.57  },
  'CATERPILLAR|CB13':        { peso:12.9, largura:2.33, comprimento:4.74  },
  'CATERPILLAR|CB7':         { peso:7.0,  largura:1.98, comprimento:4.55  },
  'CATERPILLAR|CW34':        { peso:9.7,  largura:2.16, comprimento:5.35  }, // peso varia até 27t c/ lastro — usar peso real do CSV
  'DYNAPAC|CA30D':           { peso:12.8, largura:2.26, comprimento:5.56  },
  'DYNAPAC|CA25D':           { peso:12.0, largura:2.13, comprimento:5.55 },  // Fonte: RitchieSpecs + heavy-spec (CA250D Brazil — família CA25x)
  'DYNAPAC|CA25PD':          { peso:11.0, largura:2.13, comprimento:5.55 },  // Fonte: RitchieSpecs (CA250PD — variante padfoot)
  'DYNAPAC|CA610D':          { peso:21.0, largura:2.40, comprimento:6.00  },
  'DYNAPAC|CC1200':          { peso:2.6,  largura:1.31, comprimento:2.40  },
  // ── Caminhões (sempre força prancha — ver FORCA_PRANCHA) ──
  'VOLVO|VM330':             { peso:13.6, largura:2.60, comprimento:8.00, forcaPrancha:true }, // Basculante
  'MERCEDESBENZ|AXOR4144':   { peso:15.5, largura:2.60, comprimento:7.56, forcaPrancha:true }, // Basculante
  'VOLVO|VM270':             { peso:13.5, largura:2.60, comprimento:9.95, forcaPrancha:true }, // Comboio (Pipa usa mesma faixa, ver peso real do CSV)
  'VOLVO|VM290':             { peso:13.5, largura:2.60, comprimento:9.95, forcaPrancha:true }, // Comboio
  'MERCEDESBENZ|ATEGO2730':  { peso:15.3, largura:2.60, comprimento:9.89, forcaPrancha:true }, // Pipa/Irrigadeira
  // ── Trator Agrícola ──
  'NEWHOLLAND|T7205':        { peso:10.5, largura:3.03, comprimento:5.02  }, // ⚠️ largura=altura no cadastro Mills, confirmar
}

/**
 * Busca a dimensão exata por Fabricante+Modelo do CSV do SIM. Tenta match
 * exato fabricante+modelo primeiro; se não achar, tenta só pelo modelo
 * (códigos de modelo já são bem específicos, ex: "938K-SC", "D6T-XL").
 * Retorna null se o par não estiver catalogado — quem chamar deve cair de
 * volta no GRUPO (faixa de peso) nesse caso.
 */
export function buscarDimensaoModelo(nInternos, simClients) {
  if (!simClients?.length) return null
  const lista = Array.isArray(nInternos) ? nInternos : [nInternos]

  for (const n of lista) {
    const nStr = String(n).trim()
    const nNum = nStr.replace(/\D/g, '').replace(/^0+/, '')

    for (const c of simClients) {
      if (!c.machineModelos) continue
      let entry = c.machineModelos[nStr]
      if (!entry) {
        const found = Object.entries(c.machineModelos).find(([k]) =>
          String(k).replace(/\D/g, '').replace(/^0+/, '') === nNum
        )
        if (found) entry = found[1]
      }
      if (entry && (entry.fabricante || entry.modelo)) {
        const fab = normalizaModelo(entry.fabricante)
        const mod = normalizaModelo(entry.modelo)
        const exato = DIMENSOES_MODELO[`${fab}|${mod}`]
        if (exato) return exato
        // Fallback: tenta achar só pelo modelo, ignorando fabricante
        const porModelo = Object.entries(DIMENSOES_MODELO).find(([k]) => k.endsWith(`|${mod}`))
        if (porModelo) return porModelo[1]
      }
    }
  }
  return null
}

export function buscarGrupoModelo(nInternos, simClients) {
  if (!simClients?.length) return null
  const lista = Array.isArray(nInternos) ? nInternos : [nInternos]

  for (const n of lista) {
    const nStr = String(n).trim()
    const nNum = nStr.replace(/\D/g, '').replace(/^0+/, '')

    for (const c of simClients) {
      // ── Caminho principal: machineGroups[nInterno] → grupoModelo ────────────
      // simClients agrupa por cliente; machineGroups mapeia cada N° interno
      // para seu grupoModelo extraído do CSV.
      if (c.machineGroups) {
        // Match exato
        if (c.machineGroups[nStr]) return c.machineGroups[nStr]
        // Match numérico (ex: MNA01106 → 1106)
        const entry = Object.entries(c.machineGroups).find(([k]) =>
          String(k).replace(/\D/g, '').replace(/^0+/, '') === nNum
        )
        if (entry) return entry[1]
      }

      // ── Fallback: N° interno está na lista mas sem grupoModelo ────────────
      // Verifica se o N° interno pertence a este cliente (array nInternos)
      const internos = Array.isArray(c.nInternos) ? c.nInternos : []
      const match = internos.find(k => {
        const kStr = String(k).trim()
        const kNum = kStr.replace(/\D/g, '').replace(/^0+/, '')
        return kStr === nStr || kNum === nNum
      })
      if (match) {
        // N° interno encontrado mas sem grupoModelo no CSV — retorna null
        // (vehicle selection vai cair no fallback da FreteEstimativa)
        return null
      }
    }
  }
  return null
}

// ── SUGESTÃO DE VEÍCULO por grupo de modelo ──────────────────
export function sugerirVeiculo(grupoModelo) {
  if (!grupoModelo) return { veiculoId: null, sugerido: false }
  const id = GRUPO_VEICULO[grupoModelo.trim()]
  return id ? { veiculoId: id, sugerido: true } : { veiculoId: null, sugerido: false }
}

// ── SELEÇÃO DE VEÍCULO por peso combinado (multi-carga) ──────
export function selecionarVeiculoPorPeso(grupos) {
  if (!grupos?.length) return null
  const pesoTotal = grupos.reduce((acc, g) => acc + (PESO_GRUPO[g] || 0), 0)
  let veiculoId = null
  if      (pesoTotal <= 3.5)  veiculoId = '3/4'
  else if (pesoTotal <= 13)   veiculoId = 'truck'
  else if (pesoTotal <= 17)   veiculoId = 'bitruck'
  else if (pesoTotal <= 32)   veiculoId = 'prancha3'
  else                        veiculoId = 'prancha4'
  return {
    veiculoId,
    pesoTotal: Math.round(pesoTotal * 10) / 10,
    combinacao: grupos.length > 1,
    veiculo: VEICULOS.find(v => v.id === veiculoId),
  }
}

/**
 * Resolve veículo necessário com base no peso somado de cada sentido.
 *
 * Regras BID:
 *   - Soma pesos das máquinas em cada sentido separadamente
 *   - Dimensiona pelo sentido mais pesado
 *   - Faixa ≤32t: Prancha 3 (suportado por Mills)
 *   - Faixa ≤40,5t: Prancha 4 (somente Hengel)
 *   - requiresEspecial → força bi-truck com cabo reboque (VM330)
 *
 * @param {string[]} nInternosIda   — N° internos reserva (vai ao cliente)
 * @param {string[]} nInternosVolta — N° internos danificadas (retornam)
 * @param {object[]} simClients     — CSV SIM para lookup grupoModelo
 * @param {boolean}  requiresEspecial
 */
// Ordem dos veículos do mais barato/leve ao mais caro/pesado — usada para
// escolher sempre a opção mais econômica que ainda comporta a carga.
const ORDEM_VEICULOS = ['3/4','truck','bitruck','prancha3','prancha4']

// Testa se um conjunto de máquinas (peso somado, largura máxima, comprimento
// somado) cabe em um veículo específico, nas três dimensões.
function cabeNoVeiculo(veiculoId, peso, largura, comprimento) {
  const v = VEICULOS.find(x => x.id === veiculoId)
  return peso <= v.carga && largura <= v.larg && comprimento <= v.comp
}

export function resolverVeiculoTransporte(
  nInternosIda   = [],
  nInternosVolta = [],
  simClients     = [],
  requiresEspecial = false,
) {
  // Categoria sempre rebocada (ex: Conjunto Canavieiro) — não é um problema
  // de peso/dimensão pra decidir QUAL veículo carrega; é um modo de
  // transporte inteiramente diferente (reboque direto, sem veículo "de cima").
  // Sinaliza como não-sugerido em vez de arriscar Prancha/Truck errado.
  const todosNInternos = [...nInternosIda, ...nInternosVolta]
  const grupoRebocado = todosNInternos
    .map(n => buscarGrupoModelo([n], simClients))
    .find(g => g && CATEGORIAS_REBOCADAS.has(categoriaDoGrupo(g)))
  if (grupoRebocado) {
    return {
      veiculoId: null,
      pesoIda: 0, pesoVolta: 0, pesoMax: 0,
      sentidoPesado: null,
      milsSuporta: null,
      temItemNaoIdentificado: false,
      especial: true,
      rebocado: true,
      label: `⚠️ ${grupoRebocado} — rebocado por cavalo mecânico, cote manualmente`,
      veiculo: null,
    }
  }

  // Equipamento especial (VM330): força bi-truck com cabo reboque
  if (requiresEspecial) {
    return {
      veiculoId: 'bitruck',
      pesoIda: 0, pesoVolta: 0, pesoMax: 0,
      sentidoPesado: null,
      milsSuporta: true,
      especial: true,
      label: 'Bi-truck · cabo reboque',
      veiculo: VEICULOS.find(v => v.id === 'bitruck'),
    }
  }

  // Por sentido: peso SOMA (máquinas viajam juntas e empilham peso), largura
  // usa a MAIOR entre elas (não soma — é a máquina mais larga que dita o
  // veículo), e comprimento SOMA (máquinas ficam uma atrás da outra no veículo).
  // Acumula peso/comprimento normalmente, mas guarda a largura de CADA máquina
  // individualmente (não só o máximo) — necessário para recalcular corretamente
  // "qual seria a maior largura se as máquinas com lâmina fossem desmontadas",
  // mesmo quando a carga combina equipamentos de tipos diferentes.
  const calcDimensoes = (lista) =>
    lista.reduce((acc, n) => {
      const exata = buscarDimensaoModelo([n], simClients)
      if (exata) {
        // Dimensão exata do fabricante+modelo — mais precisa que a faixa de peso
        acc.peso        += exata.peso || 0
        acc.comprimento += exata.comprimento || 0
        acc.larguras.push({ grupo: null, largura: exata.largura || 0, larguraSemLamina: exata.larguraSemLamina, forcaPrancha: !!exata.forcaPrancha, fonte:'modelo' })
        return acc
      }
      // Fallback: não achou Fabricante+Modelo catalogado — usa a faixa de peso (Grupo de Modelo)
      const grupo = buscarGrupoModelo([n], simClients)
      if (!grupo) {
        // Máquina sem grupo identificado — usa peso/largura/comprimento conservadores
        // pra nunca sugerir um veículo menor que o necessário por falta de dados.
        // Padrão: equivalente a uma Carregadeira de Pneus 10-11t (truck), que é o
        // menor veículo razoável pra qualquer equipamento pesado não identificado.
        console.warn(`[freteCalc] nInterno ${n} sem grupo de modelo — usando fallback conservador (truck)`)
        acc.peso        += 10.5
        acc.comprimento += 7.0
        acc.larguras.push({ grupo:'_fallback', largura:2.55, fonte:'fallback' })
        return acc
      }
      // O grupoModelo existe (veio do CSV), mas essa faixa exata pode ainda não
      // estar catalogada em PESO_GRUPO/LARGURA_GRUPO/COMPRIMENTO_GRUPO (ex: a
      // Mills passou a usar uma faixa nova). Antes de assumir peso 0 (bug
      // anterior — CAT 120 caía exatamente aqui), busca a faixa MAIS PRÓXIMA
      // dentro da MESMA categoria (ex: outra Motoniveladora) como substituta.
      let grupoResolvido = grupo
      if (PESO_GRUPO[grupo] === undefined) {
        // Empilhadeiras: o peso já vem escrito no próprio texto do grupo —
        // extrai direto em vez de exigir uma entrada manual em PESO_GRUPO.
        const emp = dimensaoEmpilhadeira(grupo)
        if (emp) {
          acc.peso        += emp.peso
          acc.comprimento += emp.comprimento
          acc.larguras.push({ grupo, largura: emp.largura, fonte:'empilhadeira' })
          return acc
        }
        const similar = faixaSimilar(grupo)
        if (similar) {
          console.warn(`[freteCalc] grupo "${grupo}" não catalogado — usando faixa similar da categoria: "${similar}"`)
          grupoResolvido = similar
        } else {
          console.warn(`[freteCalc] grupo "${grupo}" não catalogado e sem faixa similar na categoria — usando fallback conservador (truck)`)
          acc.peso        += 10.5
          acc.comprimento += 7.0
          acc.larguras.push({ grupo:'_fallback', largura:2.55, fonte:'fallback' })
          return acc
        }
      }
      const largura = LARGURA_GRUPO[grupoResolvido] || 0
      acc.peso        += PESO_GRUPO[grupoResolvido] || 0
      acc.comprimento += COMPRIMENTO_GRUPO[grupoResolvido] || 0
      acc.larguras.push({ grupo:grupoResolvido, largura, fonte:'grupo' })
      return acc
    }, { peso:0, comprimento:0, larguras:[] })

  const idaCalc   = calcDimensoes(nInternosIda)
  const voltaCalc = calcDimensoes(nInternosVolta)
  const todasLarguras = [...idaCalc.larguras, ...voltaCalc.larguras]
  // true quando pelo menos 1 máquina não foi reconhecida (nem modelo exato,
  // nem grupo/faixa de peso) — o peso usado pra ela foi "chutado" (10,5t
  // conservador). Nesses casos a sugestão de veículo não é confiável e
  // categorias especiais (ex: caminhão sempre força prancha) podem ter
  // passado batido, porque o sistema nem sabe que tipo de equipamento é.
  const temItemNaoIdentificado = todasLarguras.some(x => x.fonte === 'fallback')

  const pesoIda   = Math.round(idaCalc.peso   * 10) / 10
  const pesoVolta = Math.round(voltaCalc.peso * 10) / 10
  const pesoMax   = Math.max(pesoIda, pesoVolta)
  const larguraMax     = Math.max(0, ...todasLarguras.map(x => x.largura))
  const comprimentoMax = Math.max(idaCalc.comprimento, voltaCalc.comprimento)
  // "Tem lâmina desmontável" — vale tanto pro grupo (faixa de peso) quanto pro
  // modelo exato (quando o fabricante+modelo tem larguraSemLamina cadastrada).
  const itensComLamina = todasLarguras.filter(x =>
    x.fonte === 'modelo' ? x.larguraSemLamina !== undefined : REQUER_DESMONTAGEM_LAMINA.has(x.grupo)
  )
  const gruposComLamina = itensComLamina.length > 0 ? ['tem'] : [] // só precisa saber se existe ao menos 1
  const temBasculante = todasLarguras.some(x => x.fonte === 'modelo' ? x.forcaPrancha : FORCA_PRANCHA.has(x.grupo))

  // Caminhão/caminhonete sempre embarca em prancha. Mas quando há mais de 1
  // caminhão na mesma viagem, o comprimento total pode exceder a prancha3 (15m)
  // — nesse caso deve usar prancha4. Peso e comprimento são verificados; largura
  // não é critério pois caminhões têm 2,60m (dentro do limite de qualquer prancha).
  let veiculoId
  if (temBasculante) {
    const prancha3 = VEICULOS.find(v=>v.id==='prancha3')
    const prancha4 = VEICULOS.find(v=>v.id==='prancha4')
    const cabePrancha3 = pesoMax <= prancha3.carga && comprimentoMax <= prancha3.comp
    veiculoId = cabePrancha3 ? 'prancha3' : 'prancha4'
  } else {
    // Escolhe o veículo mais econômico que comporta peso + largura + comprimento juntos.
    // AET é sempre solicitada pela Mills, então largura acima de 2,60m nunca bloqueia —
    // só determina QUAL veículo é necessário (bitruck/prancha alargam até 3,20m com AET).
    veiculoId = ORDEM_VEICULOS.find(id => cabeNoVeiculo(id, pesoMax, larguraMax, comprimentoMax))
  }

  // Nenhum veículo padrão comporta peso+largura+comprimento simultaneamente.
  // Em vez de pular direto pra prancha4 (mais cara), escolhe o MAIS BARATO que
  // atenda peso+comprimento — já que largura excede igualmente em prancha3 e
  // prancha4 (ambas têm 3,20m), não há ganho nenhum em pagar mais caro só
  // por causa da largura. Sinaliza largura/comprimento excedidos sobre o
  // veículo realmente escolhido, não sobre a prancha4 fixa.
  let larguraExcedida = false, comprimentoExcedido = false
  if (!veiculoId) {
    veiculoId = ORDEM_VEICULOS.find(id => {
      const v = VEICULOS.find(x => x.id === id)
      return pesoMax <= v.carga && comprimentoMax <= v.comp
    }) || 'prancha4'
    const vEscolhido = VEICULOS.find(v => v.id === veiculoId)
    larguraExcedida     = larguraMax > vEscolhido.larg
    comprimentoExcedido = comprimentoMax > vEscolhido.comp
  }

  // Se desmontar a(s) lâmina(s) resolveria (cabe em veículo mais barato), sinaliza a
  // sugestão de economia — substitui, na largura máxima, apenas os grupos com lâmina
  // pelo valor sem lâmina, mantendo a largura normal das demais máquinas da carga.
  // Peso excede a capacidade da maior prancha disponível — carga precisa ser dividida
  const prancha4Cap = VEICULOS.find(v=>v.id==='prancha4')?.carga || 40.5
  const pesoExcedido = pesoMax > prancha4Cap

  let sugestaoDesmontagem = null
  if (gruposComLamina.length > 0) {
    const larguraMaxSemLamina = Math.max(0, ...todasLarguras.map(x => {
      if (x.fonte === 'modelo') return x.larguraSemLamina !== undefined ? x.larguraSemLamina : x.largura
      return REQUER_DESMONTAGEM_LAMINA.has(x.grupo) ? (LARGURA_SEM_LAMINA_GRUPO[x.grupo] || x.largura) : x.largura
    }))
    const veiculoSemLamina = ORDEM_VEICULOS.find(id => cabeNoVeiculo(id, pesoMax, larguraMaxSemLamina, comprimentoMax))
    // Sugestão quando: (a) cabe em veículo mais barato, OU
    // (b) mesmo veículo mas sem largura excedida (desmontar resolve o AET/largura)
    const idxSemLamina = ORDEM_VEICULOS.indexOf(veiculoSemLamina)
    const idxAtual     = ORDEM_VEICULOS.indexOf(veiculoId)
    const maisBarato   = veiculoSemLamina && idxSemLamina < idxAtual
    const resolveAET   = veiculoSemLamina && idxSemLamina === idxAtual && larguraExcedida && larguraMaxSemLamina <= (VEICULOS.find(v=>v.id===veiculoSemLamina)?.larg || 0)
    if (maisBarato || resolveAET) {
      sugestaoDesmontagem = {
        veiculoId: veiculoSemLamina,
        veiculo: VEICULOS.find(v=>v.id===veiculoSemLamina),
        resolveAET,   // true = mesmo veículo, mas sem necessidade de AET de largura especial
        maisBarato,   // true = veículo mais barato é possível
      }
    }
  }

  // Para exibição: o veículo teria sido suficiente só pelo peso? Ajuda a entender
  // se foi a largura/comprimento (não o peso) que "empurrou" para um veículo maior.
  const veiculoPorPesoSo = ORDEM_VEICULOS.find(id => pesoMax <= VEICULOS.find(x=>x.id===id).carga)
  const motivoLargura     = veiculoPorPesoSo !== veiculoId && larguraMax     > (VEICULOS.find(v=>v.id===veiculoPorPesoSo)?.larg || 0)
  const motivoComprimento = veiculoPorPesoSo !== veiculoId && comprimentoMax > (VEICULOS.find(v=>v.id===veiculoPorPesoSo)?.comp || 0)

  const sentidoPesado = pesoIda >= pesoVolta ? 'ida' : 'volta'
  const milsSuporta   = pesoMax <= 32   // prancha4 → somente Hengel

  return {
    // Quando pelo menos 1 item não foi reconhecido (nem modelo, nem grupo,
    // nem categoria similar), o peso usado foi um "chute" conservador — não
    // faz sentido sugerir NENHUM veículo com base nele. Devolve null pra
    // forçar o fluxo de "informar frete manualmente" na tela, em vez de
    // arriscar Prancha/Truck errado silenciosamente.
    veiculoId: temItemNaoIdentificado ? null : veiculoId,
    pesoIda,
    pesoVolta,
    pesoMax:  Math.round(pesoMax * 10) / 10,
    larguraMax: Math.round(larguraMax * 100) / 100,
    comprimentoMax: Math.round(comprimentoMax * 100) / 100,
    motivoLargura:     temBasculante ? false : motivoLargura,     // true = foi a largura que determinou o veículo
    motivoComprimento: temBasculante ? false : motivoComprimento, // true = foi o comprimento que determinou o veículo
    motivoBasculante: temBasculante,  // true = é caminhão basculante — sempre vai de prancha, independente do cálculo
    larguraExcedida,       // true = nem a maior prancha cobre a largura
    comprimentoExcedido,   // true = nem a maior prancha cobre o comprimento — avaliar viagens separadas
    pesoExcedido,          // true = peso combinado excede a prancha4 (40,5t) — necessário dividir em 2 viagens
    recomendaDuasViagens:  pesoExcedido, // alias semântico para exibição
    sugestaoDesmontagem,   // {veiculoId, veiculo, resolveAET, maisBarato}
    sentidoPesado,
    milsSuporta,
    temItemNaoIdentificado,
    especial: false,
    label: null,
    veiculo: VEICULOS.find(v => v.id === veiculoId),
  }
}

// ── DISTÂNCIA: Nominatim + OSRM ──────────────────────────────
async function buscarCoordenadas(cidade, uf) {
  try {
    const estadosBR = {
      AC:'Acre', AL:'Alagoas', AM:'Amazonas', AP:'Amapá', BA:'Bahia',
      CE:'Ceará', DF:'Distrito Federal', ES:'Espírito Santo', GO:'Goiás',
      MA:'Maranhão', MG:'Minas Gerais', MS:'Mato Grosso do Sul',
      MT:'Mato Grosso', PA:'Pará', PB:'Paraíba', PE:'Pernambuco',
      PI:'Piauí', PR:'Paraná', RJ:'Rio de Janeiro', RN:'Rio Grande do Norte',
      RO:'Rondônia', RR:'Roraima', RS:'Rio Grande do Sul',
      SC:'Santa Catarina', SE:'Sergipe', SP:'São Paulo', TO:'Tocantins',
    }
    const estado = estadosBR[uf] || uf
    const url = `https://nominatim.openstreetmap.org/search?` +
      `city=${encodeURIComponent(cidade)}&state=${encodeURIComponent(estado)}` +
      `&country=Brazil&format=json&limit=1`
    const res  = await fetch(url, { headers:{ 'Accept-Language':'pt-BR', 'User-Agent':'mills-logistica/1.0' } })
    const data = await res.json()
    if (!data?.length) return null
    return { lat: parseFloat(data[0].lat), lon: parseFloat(data[0].lon) }
  } catch { return null }
}

export async function calcularDistancia(cidadeOrigem, ufOrigem, cidadeDestino, ufDestino) {
  const [coordO, coordD] = await Promise.all([
    buscarCoordenadas(cidadeOrigem, ufOrigem),
    buscarCoordenadas(cidadeDestino, ufDestino),
  ])
  if (!coordO || !coordD) return { km: null, coordO: null, coordD: null }
  try {
    const url  = `https://router.project-osrm.org/route/v1/driving/${coordO.lon},${coordO.lat};${coordD.lon},${coordD.lat}?overview=false`
    const res  = await fetch(url)
    const data = await res.json()
    if (data?.routes?.[0]?.distance) {
      return { km: Math.round(data.routes[0].distance / 1000), coordO, coordD }
    }
  } catch { /* fallback */ }
  // Fallback Haversine × 1.3
  const R    = 6371
  const dLat = (coordD.lat - coordO.lat) * Math.PI / 180
  const dLon = (coordD.lon - coordO.lon) * Math.PI / 180
  const a    = Math.sin(dLat/2)**2 +
    Math.cos(coordO.lat*Math.PI/180)*Math.cos(coordD.lat*Math.PI/180)*Math.sin(dLon/2)**2
  const km   = Math.round(R * 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1-a)) * 1.3)
  return { km, coordO, coordD }
}

// ── CÁLCULO DE FRETE ─────────────────────────────────────────
function getValorIda(km, veiculoId) {
  const faixa = TABELA.find(f => km >= f.min && km <= f.max)
  if (!faixa) return 0
  return faixa.fixo ? faixa[veiculoId] : Math.round(faixa[veiculoId] * km * 100) / 100
}

function getValorEscolta(km) {
  const faixa = ESCOLTA.find(f => km <= f.max)
  if (!faixa) return 0
  return faixa.fixo ? faixa.valor : Math.round(faixa.valor * km * 100) / 100
}

/**
 * Calcula custo de frete.
 *
 * modo = 'estimativa' (padrão — Hengel, retorno 30%):
 *   Usado por solicitante e gestores. Preço de mercado.
 *
 * modo = 'mills':
 *   Usado por Frotas ao atribuir motorista Mills.
 *   bitruck  → 35% abaixo Hengel, retorno = ida
 *   prancha3 → 30% abaixo Hengel, retorno = ida
 *
 * modo = 'hengel':
 *   Usado por Frotas ao atribuir Hengel. Tarifa cheia, retorno 30%.
 *
 * Guindauto: R$6,00/km fixo, retorno = ida (se retorna ao pátio)
 */
export function calcularFrete({
  km, veiculoId, modo = 'estimativa', subtype = '',
  outroEstado = false, comEscolta = false, diarias = 0,
  isGuindauto = false, retornoAoPatio = true,
}) {
  if (!km || km <= 0) return null
  if (!veiculoId) return null

  const ajuste = outroEstado ? 1.12 : 1
  let valorIda, valorRetorno, valorEscolta = 0, valorDiaria = 0

  // ── Guindauto ────────────────────────────────────────────────
  if (isGuindauto) {
    valorIda     = Math.round(km * 6.00 * 100) / 100
    valorRetorno = retornoAoPatio ? valorIda : 0
    const total  = Math.round((valorIda + valorRetorno) * 100) / 100
    return {
      km, veiculoId: 'guindauto', veiculoLabel: 'Caminhão Guindauto',
      modo, subtype, isGuindauto: true,
      valorIda, valorRetorno,
      valorRetornoLabel: retornoAoPatio
        ? `${formatBRL(valorRetorno)} (retorno ao pátio)`
        : 'Sem retorno',
      valorEscolta: 0, valorDiaria: 0, ajuste: 1, total,
      reembolsavel: subtype === 'sinistro',
      pagoPorMills: ['sinistro','troca_tecnica','garantia'].includes(subtype),
    }
  }

  // ── Mills ────────────────────────────────────────────────────
  // bitruck: 35% abaixo Hengel | prancha3: 30% abaixo Hengel
  // Retorno = ida (volta carregada)
  if (modo === 'mills') {
    const desconto = veiculoId === 'prancha3' ? 0.70 : 0.65
    const baseIda  = getValorIda(km, veiculoId) * ajuste
    valorIda     = Math.round(baseIda * desconto * 100) / 100
    valorRetorno = valorIda
  } else {
    // ── Hengel / Estimativa ──────────────────────────────────
    // Tarifa cheia, retorno 30%
    const baseIda = getValorIda(km, veiculoId) * ajuste
    valorIda      = Math.round(baseIda * 100) / 100
    valorRetorno  = Math.round(baseIda * 0.30 * 100) / 100
  }

  if (comEscolta) valorEscolta = Math.round(getValorEscolta(km) * ajuste * 100) / 100
  if (diarias > 0 && DIARIAS[veiculoId]) {
    valorDiaria = Math.round(DIARIAS[veiculoId] * diarias * ajuste * 100) / 100
  }

  const total   = Math.round((valorIda + valorRetorno + valorEscolta + valorDiaria) * 100) / 100
  const veiculo = VEICULOS.find(v => v.id === veiculoId)

  return {
    km, veiculoId,
    veiculoLabel: veiculo?.label || veiculoId,
    eixos:        veiculo?.eixos || 0,
    modo, subtype, isGuindauto: false,
    valorIda, valorRetorno,
    valorRetornoLabel: formatBRL(valorRetorno),
    valorEscolta, valorDiaria, ajuste, total,
    reembolsavel: subtype === 'sinistro',
    pagoPorMills: ['sinistro','troca_tecnica','garantia'].includes(subtype),
  }
}

export function formatBRL(valor) {
  return (valor || 0).toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' })
}

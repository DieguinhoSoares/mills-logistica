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
// Bitrem 9 eixos adicionado em 2026-07 — novo veículo na Tabela Reajustada
// (25m de área útil, 2,60m de largura, 50t de carga útil). Sem diária
// negociada até o momento (não consta na planilha de diárias) — DIARIAS
// não tem entrada pra ele, então valorDiaria fica 0 se alguém pedir diária
// pra esse veículo (guard em `DIARIAS[veiculoId]`, ver linha ~1216).
// Faixas contíguas de propósito (min da faixa N = max da faixa N-1, sem
// gap de 1km entre elas) — bug real (2026-08): min começava em max+1 (ex:
// 0-50 e depois 51-100), então qualquer km NÃO-inteiro caindo exatamente
// nesse intervalo de 1km (50,5 · 100,5 · 250,5 · 500,5 · 1000,5 · 2000,5 ·
// 3000,5) não batia em NENHUMA faixa — getValorIda devolvia 0 em silêncio,
// virando um frete de R$0,00 "válido". Isso é alcançável de verdade: o
// campo de km real (Frotas, distância de fato rodada) e o de km manual
// aceitam decimal livre, não só o inteiro que calcularDistancia devolve.
// TABELA.find() pega o PRIMEIRO match, então um km bem em cima do limite
// (ex: exatamente 50) continua caindo na mesma faixa de antes — só fecha
// o buraco entre elas, não muda nenhum valor pra km inteiro já existente.
const TABELA = [
  { min:0,    max:50,       fixo:true,  '3/4':739.73,  truck:1143.22, bitruck:1291.17, prancha3:1315.19, prancha4:1587.88, bitrem9:2512.62 },
  { min:50,   max:100,      fixo:true,  '3/4':1143.22, truck:1681.21, bitruck:2017.45, prancha3:2072.70, prancha4:2479.71, bitrem9:3828.05 },
  { min:100,  max:250,      fixo:false, '3/4':9.75,    truck:13.04,   bitruck:15.38,   prancha3:17.24,   prancha4:21.32,   bitrem9:31.60   },
  { min:250,  max:500,      fixo:false, '3/4':8.91,    truck:11.42,   bitruck:14.06,   prancha3:15.95,   prancha4:19.32,   bitrem9:28.29   },
  { min:500,  max:1000,     fixo:false, '3/4':8.16,    truck:11.01,   bitruck:13.17,   prancha3:15.15,   prancha4:18.42,   bitrem9:27.08   },
  { min:1000, max:2000,     fixo:false, '3/4':7.97,    truck:10.71,   bitruck:12.89,   prancha3:14.59,   prancha4:17.72,   bitrem9:26.16   },
  { min:2000, max:3000,     fixo:false, '3/4':7.89,    truck:10.68,   bitruck:12.72,   prancha3:14.48,   prancha4:17.56,   bitrem9:25.98   },
  { min:3000, max:Infinity, fixo:false, '3/4':7.95,    truck:10.64,   bitruck:12.67,   prancha3:14.41,   prancha4:17.51,   bitrem9:25.89   },
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
  { id:'bitrem9',  label:'Carreta Bitrem 9 eixos',  carga:50,   comp:25, larg:2.60, eixos:9 },
  // Frete Rodando: a máquina roda pela estrada por conta própria (autopropelida),
  // sem nenhum veículo carregando — não tem peso/dimensão de carga porque não
  // é carga embarcada. Sempre escolhido manualmente pelo analista (nunca
  // sugerido automaticamente — não entra em ORDEM_VEICULOS) e sempre com
  // valor informado à mão (não existe tarifa Hengel pra isso, é combustível +
  // condução do próprio operador, não frete rodoviário tabelado).
  { id:'frete_rodando', label:'🛣️ Frete Rodando (sem embarque)', carga:null, comp:null, larg:null, eixos:null },
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
  // Motoniveladora 14 a 16t cabe em bitruck por PESO (15,0t ≤ 17t), mas o
  // comprimento real (10,01m, ver COMPRIMENTO_GRUPO abaixo) passa 1cm do
  // limite do bitruck (10m) — cabeNoVeiculo() rejeitaria isso corretamente
  // se checado por dimensão, mas essa tabela é só peso, então sugeria um
  // veículo que não comporta a máquina de verdade. Motoniveladora já é uma
  // das 3 máquinas citadas no comentário de "incidentes reais" em
  // FreteEstimativa.jsx — corrigido pro próximo porte que realmente cabe.
  'Motoniveladora 14 a 16 t':                  'prancha3', // 15,0t · 10,01m não cabe no bitruck (10m)
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
  'Caminhão Betoneira 8 m³':                   'prancha3',
  'Caminhão Guindauto 45t':                    'prancha3',
  'Caminhão Carroceria':                       'prancha3',
  // Trator Agrícola — 3 de 9 faixas confirmadas com ficha técnica real do
  // fabricante (John Deere), 2026-07. Cobre 121 de 158 ativos dessa família.
  'Trator Agrícola 220 a 230 CV':               'truck',    // JD 7M 230: 9,2t
  'Trator Agrícola 250 a 270 CV':               'bitruck',  // JD 8270R: 14,0t
  'Trator Agrícola 140 a 159 CV':               'bitruck',  // JD 6150J: 8,55t mas 2,65m de largura > limite do Truck (2,60m)
}

// ── PESO OPERACIONAL POR GRUPO DE MODELO (t) ─────────────────
export const PESO_GRUPO = {
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
  'Caminhão Basculante 6x4 / 16 m³':           15.5,  // pior caso real do grupo — Axor 4144 e Mercedes 3344K com caçamba basculante AIZ (tara 15,5t, desenho de projeto 2026-07); os Volvo VM do mesmo grupo são mais leves (13,6t)
  'Caminhão Basculante 6x4 / 20 m³':           15.5,  // Fonte: desenho de projeto do caminhão comprado pela Mills — Mercedes AXOR 4144 Basculante, tara 15,5t (2026-07)
  'Caminhão Basculante 8x4 / 22 m³':           18.0,  // estimado — AROCS 4851/FMX540 8x4 com caçamba basculante AIZ 22m³: âncora Axor 4144 AIZ (15,5t) + 2º eixo dianteiro (~1,4t) + caçamba maior (~1t)
  'Caminhão Comboio 4x2 / 6 m³':               11.0,  // estimado — chassi menor (4x2) que o Comboio 6x4
  'Caminhão Comboio 6x4 / 10 m³':              13.5,  // Fonte: mills.com.br (Volvo VM-270/VM-290, ambos 13,5t)
  'Caminhão Pipa 6X4 / 20 m³':                 11.0,  // Fonte: desenho de projeto do caminhão comprado pela Mills — Volvo VM 270 6x4 Pipa 20m³, tara 11t (2026-07). Corrige atribuição errada anterior (peso do Basculante Axor 4144, não deste)
  'Caminhão Plataforma 6x4 / 11mt':            13.6,  // estimado = mesmo chassi do Basculante (Volvo VM-330); sem peso/dimensão publicado
  'Caminhão Betoneira 8 m³':                   11.55, // Mercedes Atego 2730 curto + balão Aizi — tara do conjunto vazio 11,4-11,7t (2026-07), usando o meio da faixa
  'Caminhão Guindauto 45t':                    13.5,  // Volvo VM 290 6x4 + guindauto Aizi AIZC 45T — tara total estimada do conjunto (2026-07)
  'Caminhão Carroceria':                       8.0,   // ESTIMADO pior caso — grupo mistura Iveco Tector 24-280 6x2 (tara chassi-cabinado 6.590kg, ficha oficial Iveco MY24, + carroceria ≈8t) e Tector 9-190 4x2 (tara 3.515kg + carroceria ≈4,5t); usa o maior pra não subdimensionar
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
  'Caminhão Basculante 6x4 / 20 m³':           2.598, // Fonte: desenho de projeto do caminhão comprado pela Mills — Mercedes AXOR 4144 Basculante (2026-07)
  'Caminhão Basculante 8x4 / 22 m³':           2.60,  // caçamba basculante AIZ = mesma família do Axor 4144 (2,598m no desenho de projeto); arredondado pra via legal
  'Caminhão Comboio 4x2 / 6 m³':               2.60,  // estimado
  'Caminhão Comboio 6x4 / 10 m³':              2.60,  // Fonte: mills.com.br (Volvo VM-270/VM-290)
  'Caminhão Pipa 6X4 / 20 m³':                 2.60,  // estimado — o desenho real do Volvo VM 270 6x4 Pipa 20m³ (2026-07) só tem vista lateral, sem largura
  'Caminhão Plataforma 6x4 / 11mt':            2.60,  // estimado = mesmo chassi do Basculante (Volvo VM-330)
  'Caminhão Betoneira 8 m³':                   2.485, // Fonte: Mercedes Atego 2730 curto + balão Aizi (2026-07)
  'Caminhão Guindauto 45t':                    2.60,  // estimado — mesmo chassi Volvo VM da família (VM-270/290), largura de via legal; sem ficha exata do conjunto com guindauto Aizi AIZC 45T
  'Caminhão Carroceria':                       2.60,  // estimado — largura de via legal (carrocerias de madeira/aço padrão 2,55-2,60m)
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
  'Caminhão Basculante 6x4 / 16 m³':           8.00,  // pior caso do grupo — Volvo VM-330 (8,00m); Axor 4144 e 3344K com caçamba AIZ têm 7,56m (desenho de projeto 2026-07)
  'Caminhão Basculante 6x4 / 20 m³':           7.56,  // Fonte: desenho de projeto do caminhão comprado pela Mills — Mercedes AXOR 4144 Basculante (2026-07)
  'Caminhão Basculante 8x4 / 22 m³':           9.40,  // estimado — AROCS 4851/FMX540 8x4 com caçamba AIZ: âncora Axor 4144 (7,56m) + 2º eixo dianteiro/entre-eixos maior (~1,8m); corrige chute anterior de 11m que superdimensionava
  'Caminhão Comboio 4x2 / 6 m³':               8.50,  // estimado
  'Caminhão Comboio 6x4 / 10 m³':              9.95,  // Fonte: mills.com.br (Volvo VM-270/VM-290, ambos 9,95m)
  'Caminhão Pipa 6X4 / 20 m³':                 9.889, // Fonte: desenho de projeto do caminhão comprado pela Mills — Volvo VM 270 6x4 Pipa 20m³, tanque cilíndrico (2026-07)
  'Caminhão Plataforma 6x4 / 11mt':            8.00,  // estimado = mesmo chassi do Basculante (Volvo VM-330)
  'Caminhão Betoneira 8 m³':                   7.685, // Fonte: Mercedes Atego 2730 curto + balão Aizi (2026-07)
  'Caminhão Guindauto 45t':                    9.95,  // estimado — mesmo chassi Volvo VM-290 já cadastrado no Comboio 6x4/10m³; entre-eixos recomendado p/ guindauto Aizi AIZC 45T é 4.800-5.150mm, mas sem desenho do conjunto pra confirmar o comprimento total exato
  'Caminhão Carroceria':                       10.27, // ESTIMADO pior caso — Iveco Tector 24-280 6x2: comprimento total 8.784/9.414/10.269mm conforme entre-eixos (ficha oficial Iveco MY24); usa o maior. O Tector 9-190 4x2 (maioria dos ativos) tem ~7,2m
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
  'Caminhão Betoneira 8 m³',
  'Caminhão Guindauto 45t',
  'Caminhão Carroceria',
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
  // ── Mini Escavadeira — Fonte: lâmina técnica oficial New Holland (2026-07)
  'NEWHOLLAND|E35D':         { peso:3.4,  largura:1.58, comprimento:5.01  },
  // Caterpillar 303,5 (outro modelo real da frota nessa categoria) ainda sem
  // comprimento confiável — só achamos peso (3,5t) e largura (1,78m) via
  // LECTURA Specs; até achar a lâmina oficial Caterpillar, essa máquina usa
  // o fallback por faixa de peso (PESO_GRUPO "Mini Escavadeira 3 t").
  // Escavadeira Anfíbia 20t (Caterpillar 320 ANFIBIA, 6 ativos reais) e
  // Escavadeira de Pneus 23-26t (Caterpillar M324D2, 1 ativo real) também
  // seguem sem cadastro exato — dados de peso/comprimento parciais e sem
  // fonte oficial Caterpillar (ver conversa de 2026-07 para o que já foi
  // levantado: base Cat 320D2 pesa 21,7-22,3t; versão anfíbia com
  // flutuadores de revenda pesa ~35t PBT, mas largura não confirmada).
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

// Fallback usado pelas 3 funções de busca por N° interno abaixo: quando não
// há match exato, tenta achar pelos DÍGITOS do N° interno (ex: MNA01106 →
// 1106), pra absorver inconsistência de formatação real do CSV (zero à
// esquerda, prefixo digitado diferente). Só aceita o resultado quando é o
// ÚNICO valor distinto entre os candidatos — se dois N° internos com
// prefixos diferentes coincidem no mesmo número (ex: MNA01106 e PC1106, uma
// mini-carregadeira e uma escavadeira bem diferentes), não dá pra saber qual
// é o certo, e adivinhar erra o peso/dimensão por uma margem grande. Melhor
// não achar nada (cai pro próximo fallback) do que arriscar a máquina errada.
function matchNumericoUnico(entries, nNum, chaveValor = v => v) {
  const candidatos = entries.filter(([k]) => String(k).replace(/\D/g,'').replace(/^0+/,'') === nNum)
  if (candidatos.length === 0) return null
  const valoresUnicos = new Set(candidatos.map(([,v]) => chaveValor(v)))
  return valoresUnicos.size === 1 ? candidatos[0][1] : null
}

/**
 * Busca a dimensão exata por Fabricante+Modelo do CSV do SIM. Tenta match
 * exato fabricante+modelo primeiro; se não achar, tenta só pelo modelo
 * (códigos de modelo já são bem específicos, ex: "938K-SC", "D6T-XL").
 * Retorna null se o par não estiver catalogado — quem chamar deve cair de
 * volta no GRUPO (faixa de peso) nesse caso.
 */
// Resolve só o Fabricante+Modelo normalizado de uma máquina (sem exigir que
// tenha dimensão cadastrada) — usado pelo cálculo de consumo do Frete
// Rodando (emissoes.js), que precisa saber QUAL máquina está rodando
// sozinha pra buscar o consumo médio dela especificamente.
export function buscarFabricanteModelo(nInternos, simClients) {
  if (!simClients?.length) return null
  const lista = Array.isArray(nInternos) ? nInternos : [nInternos]

  for (const n of lista) {
    const nStr = String(n).trim()
    const nNum = nStr.replace(/\D/g, '').replace(/^0+/, '')

    for (const c of simClients) {
      if (!c.machineModelos) continue
      let entry = c.machineModelos[nStr]
      if (!entry) {
        entry = matchNumericoUnico(Object.entries(c.machineModelos), nNum, v => `${v.fabricante}|${v.modelo}`)
      }
      if (entry && (entry.fabricante || entry.modelo)) {
        return { fabricante: normalizaModelo(entry.fabricante), modelo: normalizaModelo(entry.modelo) }
      }
    }
  }
  return null
}

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
        entry = matchNumericoUnico(Object.entries(c.machineModelos), nNum, v => `${v.fabricante}|${v.modelo}`)
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
        const grupo = matchNumericoUnico(Object.entries(c.machineGroups), nNum)
        if (grupo) return grupo
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
  // Antes, um grupo sem peso cadastrado contava como 0 na soma — numa
  // combinação de várias máquinas, isso podia subestimar o peso total e
  // sugerir um veículo menor que o necessário, sem nenhum aviso. Agora usa
  // o mesmo peso conservador (10,5t) já usado pelo restante do sistema
  // (resolverVeiculoTransporte) pra máquina não reconhecida, e sinaliza a
  // incerteza em vez de escondê-la.
  let temGrupoDesconhecido = false
  const PESO_FALLBACK_CONSERVADOR = 10.5
  const pesoTotal = grupos.reduce((acc, g) => {
    const peso = PESO_GRUPO[g]
    if (peso === undefined) temGrupoDesconhecido = true
    return acc + (peso ?? PESO_FALLBACK_CONSERVADOR)
  }, 0)
  // Bitrem 9 eixos nunca aparece aqui — a regra dele é por-máquina individual
  // (ver cabeNoBitrem9 em resolverVeiculoTransporte), e essa função só soma peso
  // por categoria/faixa, sem detalhe de cada máquina pra validar o porte L60F/924K.
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
    temGrupoDesconhecido,
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
const ORDEM_VEICULOS = ['3/4','truck','bitruck','prancha3','prancha4','bitrem9']

// Testa se um conjunto de máquinas (peso somado, largura máxima, comprimento
// somado) cabe em um veículo específico, nas três dimensões.
function cabeNoVeiculo(veiculoId, peso, largura, comprimento) {
  const v = VEICULOS.find(x => x.id === veiculoId)
  return peso <= v.carga && largura <= v.larg && comprimento <= v.comp
}

// ── BITREM 9 EIXOS — regra especial por-máquina (2026-07, confirmado com a
// operação) ──────────────────────────────────────────────────────────────
// A carreta de 25m é BIPARTIDA — diferente de todo o resto do sistema (que só
// olha peso/largura/comprimento SOMADOS), o Bitrem tem um teto por máquina
// individual: nada maior que o porte da Volvo L60F / Cat 924K (as duas
// carregadeiras de pneus de maior porte nessa faixa) pode embarcar nele, nem
// sozinha — uma máquina acima desse porte vai sempre de prancha 4 eixos (ou
// precisa dividir viagem), mesmo que caiba nas 50t/25m nominais do veículo.
// Dentro do porte L60F/924K, o teto é de 4 unidades por sentido da viagem.
const BITREM9_LIMITE_UNIDADE = { peso:11.6, comprimento:7.61, largura:2.60 } // Volvo L60F (11,6t/7,27m) / Cat 924K (11,5t/7,61m)
const BITREM9_MAX_UNIDADES = 4
function cabeNoBitrem9(itensIda, itensVolta) {
  const excedePorte = (it) => it.peso > BITREM9_LIMITE_UNIDADE.peso
    || it.comprimento > BITREM9_LIMITE_UNIDADE.comprimento
    || it.largura > BITREM9_LIMITE_UNIDADE.largura
  if (itensIda.some(excedePorte) || itensVolta.some(excedePorte)) return false
  if (itensIda.length > BITREM9_MAX_UNIDADES || itensVolta.length > BITREM9_MAX_UNIDADES) return false
  return true
}

// Resolve peso/largura/comprimento de UMA máquina (mesma cascata de sempre:
// modelo exato → grupo exato → empilhadeira parseada → categoria similar →
// fallback conservador). Função de nível de módulo — reaproveitada tanto
// pelo cálculo ida/volta (resolverVeiculoTransporte) quanto pelo cálculo de
// rota com paradas (analisarRotaComParadas, mais abaixo).
function resolverDimensaoUnica(n, simClients) {
  const exata = buscarDimensaoModelo([n], simClients)
  if (exata) {
    return { peso:exata.peso||0, comprimento:exata.comprimento||0, largura:exata.largura||0,
      larguraSemLamina:exata.larguraSemLamina, forcaPrancha:!!exata.forcaPrancha, fonte:'modelo', grupo:null }
  }
  const grupo = buscarGrupoModelo([n], simClients)
  if (!grupo) {
    console.warn(`[freteCalc] nInterno ${n} sem grupo de modelo — usando fallback conservador (truck)`)
    return { peso:10.5, comprimento:7.0, largura:2.55, fonte:'fallback', grupo:'_fallback' }
  }
  let grupoResolvido = grupo
  if (PESO_GRUPO[grupo] === undefined) {
    const emp = dimensaoEmpilhadeira(grupo)
    if (emp) return { peso:emp.peso, comprimento:emp.comprimento, largura:emp.largura, fonte:'empilhadeira', grupo }
    const similar = faixaSimilar(grupo)
    if (similar) {
      console.warn(`[freteCalc] grupo "${grupo}" não catalogado — usando faixa similar da categoria: "${similar}"`)
      grupoResolvido = similar
    } else {
      console.warn(`[freteCalc] grupo "${grupo}" não catalogado e sem faixa similar na categoria — usando fallback conservador (truck)`)
      return { peso:10.5, comprimento:7.0, largura:2.55, fonte:'fallback', grupo:'_fallback' }
    }
  }
  return {
    peso: PESO_GRUPO[grupoResolvido] || 0,
    comprimento: COMPRIMENTO_GRUPO[grupoResolvido] || 0,
    largura: LARGURA_GRUPO[grupoResolvido] || 0,
    fonte:'grupo', grupo:grupoResolvido,
  }
}

// ── DIAGNÓSTICO DE N° INTERNO ────────────────────────────────────────────
// Ferramenta de autoatendimento pra Frotas/Master investigarem, sem precisar
// pedir pra mim toda vez, por que uma máquina específica caiu como "não
// reconhecida" (ou pegou dimensão errada). Caso real que motivou: usuário
// reportou que a PCP01168 (Caterpillar 938K SC, confirmadamente cadastrada
// no SIM) apareceu como "máquina não reconhecida" — precisa mostrar o
// caminho exato que o N° interno percorre na cascata de resolução
// (resolverDimensaoUnica) pra achar o ponto real da falha (dado ausente no
// CSV, chave Fabricante+Modelo não catalogada em DIMENSOES_MODELO, Grupo de
// Modelo não catalogado em PESO_GRUPO, etc.) em vez de ficar adivinhando.
export function diagnosticarNInterno(nInterno, simClients) {
  const nStr = String(nInterno || '').trim()
  const nNum = nStr.replace(/\D/g, '').replace(/^0+/, '')
  const diag = {
    nInterno: nStr,
    encontrado: false,
    semDadosDeModelo: false,
    cliente: null,
    tipoMatch: null, // 'exato' | 'numerico' | null
    fabricanteRaw: '',
    modeloRaw: '',
    grupoModeloRaw: '',
    chaveFabricanteModelo: '',
    dimensaoModeloExata: null,
    dimensaoPorModeloApenas: null,
    grupoModeloExisteEmPesoGrupo: false,
    resultado: null,
  }
  if (!nStr) return diag

  // Mesma ordem de prioridade das funções reais (buscarFabricanteModelo/
  // buscarDimensaoModelo/buscarGrupoModelo): por cliente, tenta match exato
  // primeiro, só cai pro numérico se não achar — evita reportar um caminho
  // diferente do que o cálculo de frete realmente percorre.
  for (const c of simClients || []) {
    let modeloEntry = c.machineModelos?.[nStr]
    let modeloMatch = modeloEntry ? 'exato' : null
    if (!modeloEntry && c.machineModelos) {
      modeloEntry = matchNumericoUnico(Object.entries(c.machineModelos), nNum, v => `${v.fabricante}|${v.modelo}`)
      if (modeloEntry) modeloMatch = 'numerico'
    }
    let grupoEntry = c.machineGroups?.[nStr]
    let grupoMatch = grupoEntry ? 'exato' : null
    if (!grupoEntry && c.machineGroups) {
      grupoEntry = matchNumericoUnico(Object.entries(c.machineGroups), nNum)
      if (grupoEntry) grupoMatch = 'numerico'
    }
    if (modeloEntry || grupoEntry) {
      diag.encontrado = true
      diag.cliente = c.name
      diag.tipoMatch = modeloMatch || grupoMatch
      if (modeloEntry) { diag.fabricanteRaw = modeloEntry.fabricante || ''; diag.modeloRaw = modeloEntry.modelo || '' }
      if (grupoEntry) diag.grupoModeloRaw = grupoEntry
      break
    }
    if (!diag.encontrado) {
      const internos = Array.isArray(c.nInternos) ? c.nInternos : []
      const match = internos.find(k => {
        const kStr = String(k).trim()
        const kNum = kStr.replace(/\D/g, '').replace(/^0+/, '')
        return kStr === nStr || kNum === nNum
      })
      if (match) {
        diag.encontrado = true
        diag.semDadosDeModelo = true
        diag.cliente = c.name
        diag.tipoMatch = String(match).trim() === nStr ? 'exato' : 'numerico'
        break
      }
    }
  }

  if (diag.fabricanteRaw || diag.modeloRaw) {
    const fab = normalizaModelo(diag.fabricanteRaw)
    const mod = normalizaModelo(diag.modeloRaw)
    diag.chaveFabricanteModelo = `${fab}|${mod}`
    diag.dimensaoModeloExata = DIMENSOES_MODELO[diag.chaveFabricanteModelo] || null
    if (!diag.dimensaoModeloExata && mod) {
      const porModelo = Object.entries(DIMENSOES_MODELO).find(([k]) => k.endsWith(`|${mod}`))
      if (porModelo) diag.dimensaoPorModeloApenas = { chave: porModelo[0], ...porModelo[1] }
    }
  }

  if (diag.grupoModeloRaw) {
    diag.grupoModeloExisteEmPesoGrupo = PESO_GRUPO[diag.grupoModeloRaw] !== undefined
  }

  diag.resultado = resolverDimensaoUnica(nStr, simClients)
  return diag
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
      const d = resolverDimensaoUnica(n, simClients)
      acc.peso        += d.peso
      acc.comprimento += d.comprimento
      const item = { grupo:d.grupo, peso:d.peso, largura:d.largura, comprimento:d.comprimento, larguraSemLamina:d.larguraSemLamina, forcaPrancha:d.forcaPrancha, fonte:d.fonte }
      acc.larguras.push(item)
      acc.itens.push(item)
      return acc
    }, { peso:0, comprimento:0, larguras:[], itens:[] })

  const idaCalc   = calcDimensoes(nInternosIda)
  const voltaCalc = calcDimensoes(nInternosVolta)
  const todasLarguras = [...idaCalc.larguras, ...voltaCalc.larguras]
  // Checagem por-máquina do Bitrem 9 eixos (ver cabeNoBitrem9 acima) — usada
  // no lugar de cabeNoVeiculo() sempre que o cascade de veículos avalia o id
  // 'bitrem9', porque a regra dele não é sobre totais somados.
  const cabeNoVeiculoOuBitrem = (id, peso, largura, comprimento) =>
    id === 'bitrem9' ? cabeNoBitrem9(idaCalc.itens, voltaCalc.itens) : cabeNoVeiculo(id, peso, largura, comprimento)
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
    // Bitrem 9 eixos usa checagem própria por-máquina (cabeNoVeiculoOuBitrem), não a
    // soma de peso/largura/comprimento — ver regra em cabeNoBitrem9.
    veiculoId = ORDEM_VEICULOS.find(id => cabeNoVeiculoOuBitrem(id, pesoMax, larguraMax, comprimentoMax))
  }

  // Nenhum veículo padrão comporta peso+largura+comprimento simultaneamente.
  // Em vez de pular direto pra prancha4 (mais cara), escolhe o MAIS BARATO que
  // atenda peso+comprimento — já que largura excede igualmente em prancha3 e
  // prancha4 (ambas têm 3,20m), não há ganho nenhum em pagar mais caro só
  // por causa da largura. Sinaliza largura/comprimento excedidos sobre o
  // veículo realmente escolhido, não sobre a prancha4 fixa.
  // Bitrem 9 eixos NUNCA é o fallback final — ele só serve pra combinar várias
  // máquinas até o porte L60F/924K (regra própria acima); uma carga que nem
  // largura+comprimento padrão resolve precisa mesmo da prancha4 (ou dividir).
  let larguraExcedida = false, comprimentoExcedido = false
  if (!veiculoId) {
    veiculoId = ORDEM_VEICULOS.filter(id => id !== 'bitrem9').find(id => {
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
  // Peso excede a capacidade da maior prancha "normal" (prancha4, 40,5t) — carga
  // precisa ser dividida em mais de uma viagem. Bitrem 9 eixos NÃO conta pra esse
  // teto: ele não é uma prancha "maior" de uso geral, só serve pro cenário
  // específico de combinar até 4 máquinas do porte L60F/924K (regra própria acima)
  // — se cabeNoBitrem9 já aprovou o veículo, a viagem cabe em 1 só, mesmo pesando
  // mais que 40,5t.
  const prancha4Cap = VEICULOS.find(v=>v.id==='prancha4')?.carga || 40.5
  const pesoExcedido = veiculoId === 'bitrem9' ? false : pesoMax > prancha4Cap

  let sugestaoDesmontagem = null
  if (gruposComLamina.length > 0) {
    const larguraMaxSemLamina = Math.max(0, ...todasLarguras.map(x => {
      if (x.fonte === 'modelo') return x.larguraSemLamina !== undefined ? x.larguraSemLamina : x.largura
      return REQUER_DESMONTAGEM_LAMINA.has(x.grupo) ? (LARGURA_SEM_LAMINA_GRUPO[x.grupo] || x.largura) : x.largura
    }))
    // Bitrem 9 eixos fica de fora — máquinas com lâmina desmontável (tratores de
    // esteira) estão bem acima do porte L60F/924K, então nunca se qualificam pra
    // ele mesmo sem a checagem por-item (ver cabeNoBitrem9); exclui aqui pra não
    // arriscar sugerir um veículo que a regra de porte nunca aprovaria de verdade.
    const veiculoSemLamina = ORDEM_VEICULOS.filter(id => id !== 'bitrem9')
      .find(id => cabeNoVeiculo(id, pesoMax, larguraMaxSemLamina, comprimentoMax))
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
const ESTADOS_BR = {
  AC:'Acre', AL:'Alagoas', AM:'Amazonas', AP:'Amapá', BA:'Bahia',
  CE:'Ceará', DF:'Distrito Federal', ES:'Espírito Santo', GO:'Goiás',
  MA:'Maranhão', MG:'Minas Gerais', MS:'Mato Grosso do Sul',
  MT:'Mato Grosso', PA:'Pará', PB:'Paraíba', PE:'Pernambuco',
  PI:'Piauí', PR:'Paraná', RJ:'Rio de Janeiro', RN:'Rio Grande do Norte',
  RO:'Rondônia', RR:'Roraima', RS:'Rio Grande do Sul',
  SC:'Santa Catarina', SE:'Sergipe', SP:'São Paulo', TO:'Tocantins',
}
function normTxtUF(s) { return String(s||'').toUpperCase().normalize('NFD').replace(/[\u0300-\u036f]/g,'').trim() }

// Descobre a UF de uma cidade brasileira pela base oficial do IBGE — usada
// quando a solicitação não tem a UF preenchida (card antigo com
// origin/destination vazio, sem ninguém precisar digitar nada na mão pra
// corrigir). Fonte AUTORITATIVA (cadastro oficial do governo, não
// crowd-sourced como o OpenStreetMap/Nominatim — que já causou o bug real
// de geocodificação sem UF devolvendo uma cidade errada de outro estado).
// Só resolve quando o nome é INEQUÍVOCO nacionalmente — mais de um
// município com o mesmo nome em estados diferentes (existem várias cidades
// "Bom Jesus" Brasil afora, por exemplo) fica sem resolver, pra não
// arriscar escolher o estado errado.
// Devolve { nome, uf } com o nome CANÔNICO do IBGE (não o texto bruto que
// veio do card) — importante porque cards antigos guardam a cidade como
// texto solto, às vezes com sujeira colada (ex: "Canápolis - MG"), e esse
// texto sujo, se fosse repassado direto pra Nominatim depois, prejudicaria
// a busca de coordenada mesmo já tendo descoberto a UF certa aqui.
// Exportada pra reaproveitar em RequestReviewModal.jsx/AssignDriverModal.jsx/
// RequestForm.jsx — aviso pro Frotas (ou pro solicitante, na origem) quando
// a UF CADASTRADA parece inconsistente com o nome da cidade, mesmo já vindo
// preenchida (esta função aqui em cima só é chamada internamente quando
// falta UF — o aviso nos formulários/modais cobre o caso complementar: UF
// presente, mas errada na origem — ex: Estado da Planta/Obra errado no CSV
// do SIM).
//
// Cache em memória da lista completa do IBGE (~5.570 municípios) — a lista
// não muda de um clique pro outro, e sem cache cada tela que faz essa
// checagem (RequestForm, RequestReviewModal, AssignDriverModal, mais a
// auditoria em lote abaixo) dispararia o mesmo download de novo. Município
// não some/aparece durante uma sessão, então reusar o resultado é seguro.
let _municipiosIBGECache = null
async function buscarMunicipiosIBGE() {
  if (_municipiosIBGECache) return _municipiosIBGECache
  const res  = await fetch('https://servicodados.ibge.gov.br/api/v1/localidades/municipios?orderBy=nome')
  const data = await res.json()
  _municipiosIBGECache = data
  return data
}

// Núcleo do match nome→UF, separado do fetch pra poder reaproveitar a
// mesma lista já baixada numa auditoria em lote (ver auditarUFsSimClients).
function resolverUFPorNome(cidade, municipios) {
  const alvo = normTxtUF(cidade)
  if (!alvo) return null
  let matches = municipios.filter(m => normTxtUF(m.nome) === alvo)
  // Se não bateu exato, tenta por prefixo — só aceita se sobrar
  // exatamente 1 candidato inequívoco, mesmo padrão de segurança do
  // match exato (ver comentário acima sobre nome com sujeira colada).
  if (matches.length === 0) {
    matches = municipios.filter(m => {
      const nomeNorm = normTxtUF(m.nome)
      return nomeNorm && (alvo.startsWith(nomeNorm) || nomeNorm.startsWith(alvo))
    })
  }
  if (matches.length !== 1) return null
  const uf = matches[0].microrregiao?.mesorregiao?.UF?.sigla
  return uf ? { nome: matches[0].nome, uf } : null
}

export async function descobrirCidadeIBGE(cidade) {
  try {
    const municipios = await buscarMunicipiosIBGE()
    return resolverUFPorNome(cidade, municipios)
  } catch { return null }
}

// Varredura em lote — confere TODA a base de Plantas/Obras já carregada
// (Base SIM) contra o IBGE de uma vez, em vez de esperar cada solicitação
// aparecer uma por uma. Baixa a lista do IBGE uma única vez (cache acima) e
// resolve todos os clientes com cidade+UF cadastradas sobre essa mesma
// lista — não dispara uma consulta por cliente. Usada pelo painel de
// diagnóstico (DiagnosticoModal) pra achar de uma vez toda Planta/Obra com
// Estado errado no CSV, a causa raiz recorrente desse tipo de bug.
export async function auditarUFsSimClients(simClients) {
  const municipios = await buscarMunicipiosIBGE().catch(() => null)
  if (!municipios) return { ok:false, divergencias:[] }
  const divergencias = []
  for (const c of (simClients || [])) {
    if (!c.city || !c.state) continue
    const achado = resolverUFPorNome(c.city, municipios)
    if (achado && achado.uf !== c.state) {
      divergencias.push({ cliente:c.name, cidade:c.city, ufCadastrada:c.state, ufReal:achado.uf })
    }
  }
  return { ok:true, divergencias }
}

async function buscarCoordenadas(cidade, uf) {
  // Causa raiz REAL do bug persistir mesmo depois das checagens de estado
  // (texto) e geografia abaixo: a solicitação real em produção estava com a
  // UF de destino VAZIA (mesmo problema de dado que a ferramenta de
  // migração do Master existe pra corrigir — request.destination não
  // preenchido). Sem UF esperada não tem como VALIDAR o resultado — nem
  // comparando texto, nem geografia: uma coordenada em outro estado
  // qualquer bate "consigo mesma" (é autoconsistente com o que a própria
  // Nominatim diz), então não existe checagem que distinga "cidade errada
  // mas coerente" de "cidade certa". Pedir pro aprovador digitar o km na
  // mão também não é aceitável — não é função dele, e não corrige o dado
  // pras próximas vezes. Em vez disso, tenta descobrir a UF sozinho pela
  // base oficial do IBGE (autoconsertável, sem intervenção manual); só cai
  // pro fluxo de "informe manualmente" se nem isso resolver (nome de cidade
  // ambíguo entre estados). Também troca o nome da cidade pelo canônico do
  // IBGE nesse caso — texto sujo de card antigo (ex: "Canápolis - MG") não
  // vai direto pra Nominatim, só a UF descoberta seria pouco.
  let cidadeResolvida = cidade
  let ufResolvida = uf
  if (!ufResolvida) {
    const achado = await descobrirCidadeIBGE(cidade)
    if (!achado) return null
    cidadeResolvida = achado.nome
    ufResolvida = achado.uf
  }
  try {
    const estado = ESTADOS_BR[ufResolvida] || ufResolvida
    const url = `https://nominatim.openstreetmap.org/search?` +
      `city=${encodeURIComponent(cidadeResolvida)}&state=${encodeURIComponent(estado)}` +
      `&country=Brazil&format=json&limit=1&addressdetails=1`
    const res  = await fetch(url, { headers:{ 'Accept-Language':'pt-BR', 'User-Agent':'mills-logistica/1.0' } })
    const data = await res.json()
    if (!data?.length) return null
    // Bug real (2026-08): a Nominatim devolveu, com status 200 "normal", um
    // ponto no interior da BAHIA pra uma busca de "Canápolis" + "Minas
    // Gerais". A checagem de texto abaixo (comparar data[0].address.state
    // com o estado pedido) NÃO pegou esse caso — o registro devolvido pela
    // Nominatim está com o campo "state" rotulado como "Minas Gerais" mesmo
    // com a coordenada fisicamente na Bahia (erro de qualidade do dado no
    // próprio OpenStreetMap, não dá pra detectar só lendo texto). Por isso
    // a validação principal é GEOGRÁFICA: confere se a coordenada devolvida
    // realmente cai dentro (ou perto) da caixa delimitadora real da UF
    // resolvida (pedida OU descoberta via IBGE acima), sem depender do que
    // a Nominatim diz que é.
    const estadoRetornado = data[0].address?.state
    if (estadoRetornado && normTxtUF(estadoRetornado) !== normTxtUF(estado)) {
      console.warn(`[freteCalc] geocodificação de "${cidade}" (${ufResolvida}) devolveu estado diferente do pedido: "${estadoRetornado}" — descartando resultado`)
      return null
    }
    const lat = parseFloat(data[0].lat)
    const lon = parseFloat(data[0].lon)
    if (coordenadaForaDaUF(lat, lon, ufResolvida)) {
      console.warn(`[freteCalc] geocodificação de "${cidade}" (${ufResolvida}) devolveu coordenada fora da UF (lat ${lat}, lon ${lon}) — descartando resultado`)
      return null
    }
    return { lat, lon }
  } catch { return null }
}

// Caixas delimitadoras aproximadas (latMin, latMax, lonMin, lonMax) de cada
// UF — validação GEOGRÁFICA real da coordenada devolvida pela geocodificação
// (ver bug documentado acima em buscarCoordenadas: o texto "state" que a
// Nominatim devolve pode dizer a UF certa mesmo com a coordenada errada).
// Valores aproximados com margem generosa — não é o contorno exato da
// fronteira, só o suficiente pra pegar erro grosseiro (centenas/milhares de
// km), sem risco de rejeitar cidade real perto de divisa de estado.
const LIMITES_UF = {
  AC:[-11.2,-7.0,-74.0,-66.5],   AL:[-10.5,-8.8,-38.3,-35.1],
  AM:[-9.8,2.3,-73.9,-56.0],     AP:[-1.2,4.5,-54.9,-49.8],
  BA:[-18.4,-8.5,-46.7,-37.3],   CE:[-7.9,-2.8,-41.4,-37.2],
  DF:[-16.1,-15.5,-48.3,-47.3],  ES:[-21.3,-17.9,-41.9,-39.6],
  GO:[-19.5,-12.4,-53.3,-45.9],  MA:[-10.3,-1.0,-48.8,-41.8],
  MG:[-22.9,-14.2,-51.0,-39.9],  MS:[-24.1,-17.2,-58.2,-50.9],
  MT:[-18.0,-7.3,-61.6,-50.2],   PA:[-9.8,2.6,-58.9,-46.1],
  PB:[-8.3,-6.0,-38.8,-34.8],    PE:[-9.5,-7.3,-41.4,-32.4],
  PI:[-10.9,-2.7,-45.9,-40.4],   PR:[-26.7,-22.5,-54.6,-48.0],
  RJ:[-23.4,-20.8,-44.9,-40.9],  RN:[-6.9,-4.8,-38.6,-34.9],
  RO:[-13.7,-7.9,-66.8,-59.8],   RR:[1.4,5.3,-64.9,-58.9],
  RS:[-33.8,-27.0,-57.7,-49.7],  SC:[-29.4,-25.9,-53.9,-48.3],
  SE:[-11.6,-9.5,-38.3,-36.4],   SP:[-25.4,-19.8,-53.2,-44.2],
  TO:[-13.5,-5.1,-50.8,-45.7],
}
const MARGEM_UF_GRAUS = 0.6 // ~65km de folga pra cidade real perto de divisa
// Exportada pra reaproveitar em outros lugares que também confiam em
// geocodificação externa sem ter como validar contra um estado JÁ informado
// (ex: MasterView.jsx migra origin/destination de cards antigos descobrindo
// o estado a partir do nome da cidade — mesmo risco de fundo, checagem
// aplicada ao contrário: valida a coordenada contra o PRÓPRIO estado que a
// API disse que é, em vez de contra um estado esperado de antemão).
export function coordenadaForaDaUF(lat, lon, uf) {
  const box = LIMITES_UF[uf]
  if (!box) return false // UF não catalogada (sigla inválida/atípica) — não bloqueia
  const [latMin, latMax, lonMin, lonMax] = box
  return lat < latMin - MARGEM_UF_GRAUS || lat > latMax + MARGEM_UF_GRAUS ||
         lon < lonMin - MARGEM_UF_GRAUS || lon > lonMax + MARGEM_UF_GRAUS
}

// Distância em linha reta (grande círculo), sem nenhum fator de correção —
// usada tanto pelo fallback Haversine×1.3 quanto pela checagem de
// plausibilidade abaixo.
function haversineStraightKm(a, b) {
  const R    = 6371
  const dLat = (b.lat - a.lat) * Math.PI / 180
  const dLon = (b.lon - a.lon) * Math.PI / 180
  const x    = Math.sin(dLat/2)**2 + Math.cos(a.lat*Math.PI/180)*Math.cos(b.lat*Math.PI/180)*Math.sin(dLon/2)**2
  return R * 2 * Math.atan2(Math.sqrt(x), Math.sqrt(1-x))
}

function haversineKm(a, b) {
  return Math.round(haversineStraightKm(a, b) * 1.3)
}

// Caso real (2026-08): rota Assis/SP → Canápolis/MG voltou 1589km da OSRM
// (roteador público), quando a distância em linha reta entre as duas
// cidades é ~454km — nenhuma rodovia no Brasil precisa de quase 3,5x a
// distância em linha reta pra ligar 2 cidades vizinhas de estados
// fronteiriços. O roteador público (router.project-osrm.org) ocasionalmente
// monta rota errada (map-matching ruim, desvio por trecho sem dado), e sem
// checagem nenhuma esse tipo de falha externa virava frete de milhares de
// reais calculado sobre km errado, sem nenhum aviso. Multiplicador generoso
// (2,5x) pra não rejeitar rotas com desvio real grande (litoral, serra,
// travessia de rio) — só barra o que é claramente implausível.
const LIMITE_MULTIPLICADOR_ROTA = 2.5
export function kmRotaEhPlausivel(kmRota, coordO, coordD) {
  const reta = haversineStraightKm(coordO, coordD)
  if (reta <= 0) return true
  return kmRota <= reta * LIMITE_MULTIPLICADOR_ROTA
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
      const kmRota = Math.round(data.routes[0].distance / 1000)
      if (kmRotaEhPlausivel(kmRota, coordO, coordD)) {
        return { km: kmRota, coordO, coordD }
      }
      console.warn(`[freteCalc] rota OSRM implausível: ${kmRota}km (reta ~${Math.round(haversineStraightKm(coordO, coordD))}km) — usando fallback Haversine×1.3`)
    }
  } catch { /* fallback */ }
  return { km: haversineKm(coordO, coordD), coordO, coordD }
}

// Distância de uma rota com N pontos (origem + paradas, na ordem em que o
// veículo passa por elas) — usa o suporte nativo do OSRM a múltiplos
// waypoints numa única chamada, devolvendo a distância de CADA TRECHO
// individualmente (data.routes[0].legs[i]), não só o total.
export async function calcularDistanciaMultiPonto(pontos) {
  const coords = await Promise.all(pontos.map(p => buscarCoordenadas(p.cidade, p.uf)))
  if (coords.some(c => !c)) return { pernas: null, total: null, coords }
  try {
    const path = coords.map(c => `${c.lon},${c.lat}`).join(';')
    const url  = `https://router.project-osrm.org/route/v1/driving/${path}?overview=false`
    const res  = await fetch(url)
    const data = await res.json()
    if (data?.routes?.[0]?.legs) {
      const pernas = data.routes[0].legs.map(l => Math.round(l.distance / 1000))
      // Mesma checagem de plausibilidade do calcularDistancia (ver
      // kmRotaEhPlausivel e o caso real documentado ali) — sem isso, uma
      // perna mal roteada pela OSRM entrava direto no valor de frete de
      // rota combinada (valorSeparado, dinheiro de verdade) sem aviso
      // nenhum, só porque essa função nunca teve a mesma checagem que
      // calcularDistancia já tinha pro caso de 1 trecho só.
      const todasPlausiveis = pernas.every((km, i) => kmRotaEhPlausivel(km, coords[i], coords[i+1]))
      if (todasPlausiveis) {
        return { pernas, total: pernas.reduce((a,b)=>a+b,0), coords }
      }
      console.warn('[freteCalc] rota OSRM multi-ponto com pelo menos uma perna implausível — usando fallback Haversine×1.3 em todas as pernas')
    }
  } catch { /* fallback */ }
  // Fallback Haversine × 1.3 perna a perna (mesmo fator do calcularDistancia)
  const pernas = []
  for (let i = 0; i < coords.length - 1; i++) pernas.push(haversineKm(coords[i], coords[i+1]))
  return { pernas, total: pernas.reduce((a,b)=>a+b,0), coords }
}

// ── MATRIZ DE DISTÂNCIAS + OTIMIZAÇÃO DE ORDEM (item 2 — Rotograma) ───────
// Usa o endpoint /table/ do OSRM, que devolve a distância entre TODOS os
// pares de pontos numa chamada só (diferente de /route/, que só calcula uma
// ordem específica) — é o que permite testar "qual ordem é mais curta" sem
// fazer uma chamada de rede por combinação possível.
export async function calcularMatrizDistancias(pontos) {
  const coords = await Promise.all(pontos.map(p => buscarCoordenadas(p.cidade, p.uf)))
  if (coords.some(c => !c)) return null
  try {
    const path = coords.map(c => `${c.lon},${c.lat}`).join(';')
    const url  = `https://router.project-osrm.org/table/v1/driving/${path}?annotations=distance`
    const res  = await fetch(url)
    const data = await res.json()
    if (data?.distances) {
      // data.distances vem em metros — converte pra km
      const matriz = data.distances.map(row => row.map(m => m == null ? Infinity : Math.round(m/1000)))
      // Mesma checagem de plausibilidade do calcularDistancia — essa matriz
      // alimenta a otimização de ORDEM das paradas (Rotograma); um par
      // implausível bagunça a ordem "otimizada" inteira em cima de uma
      // distância que a própria OSRM roteou errado (ver caso real
      // documentado em kmRotaEhPlausivel).
      const todasPlausiveis = matriz.every((row, i) => row.every((km, j) =>
        i === j || km === Infinity || kmRotaEhPlausivel(km, coords[i], coords[j])
      ))
      if (todasPlausiveis) return matriz
      console.warn('[freteCalc] matriz de distâncias OSRM com pelo menos um par implausível — usando fallback Haversine×1.3 na matriz inteira')
    }
  } catch { /* fallback */ }
  // Fallback: monta a matriz via Haversine par a par (mesmo fator ×1.3)
  return coords.map((a) => coords.map((b) => haversineKm(a, b)))
}

// Otimiza a ORDEM das paradas a partir de uma matriz de distâncias, usando a
// heurística do "vizinho mais próximo" (nearest neighbor) partindo sempre da
// origem (índice 0 da matriz). Não é o ótimo matemático absoluto (isso seria
// um problema NP-difícil pra N grande), mas na prática fica bem perto e
// funciona pra qualquer quantidade de paradas sem explodir o tempo de
// cálculo — diferente de testar todas as permutações possíveis.
export function otimizarOrdemParadas(matriz) {
  const n = matriz.length
  const visitado = new Array(n).fill(false)
  visitado[0] = true // índice 0 = origem, já "visitada" (ponto de partida)
  const ordem = [0]
  let atual = 0
  for (let passo = 1; passo < n; passo++) {
    let melhorProx = -1, melhorDist = Infinity
    for (let j = 0; j < n; j++) {
      if (visitado[j]) continue
      if (matriz[atual][j] < melhorDist) { melhorDist = matriz[atual][j]; melhorProx = j }
    }
    if (melhorProx === -1) break
    visitado[melhorProx] = true
    ordem.push(melhorProx)
    atual = melhorProx
  }
  return ordem // índices na ordem otimizada, incluindo o 0 (origem) na frente
}


// em ordem — o veículo sai de (origemCidade,origemUf) e passa por cada
// parada nessa sequência. NÃO adiciona automaticamente uma volta à base: se
// o motorista precisa voltar pra Mills ao final, isso é só mais uma parada
// na lista (ex: última parada = coleta, cidade = a própria base).
//
// Regra de cobrança (definida com a operação, 2026-07):
//   - Compara a rota REAL (soma de todos os trechos) com a rota DIRETA
//     (origem → última parada, ignorando as intermediárias).
//   - Desvio ≤ limiteDesvioPct (10% por padrão): as paradas intermediárias
//     "estão no caminho" — cobra 1 trecho único pela distância DIRETA.
//   - Desvio > limiteDesvioPct: é desvio de rota de verdade — cobra cada
//     trecho separadamente pela tabela Hengel, sem desconto (soma simples).
export async function analisarRotaComParadas({ origemCidade, origemUf, paradas, simClients, limiteDesvioPct = 0.10, outroEstado = false }) {
  if (!paradas?.length) return null

  // ── 1. Peso/dimensão de cada máquina mencionada em qualquer parada ──────
  const todosNInternos = [...new Set(paradas.flatMap(p => p.nInternos || []))]
  const dimensaoPorMaquina = new Map(todosNInternos.map(n => [n, resolverDimensaoUnica(n, simClients)]))
  const temItemNaoIdentificado = [...dimensaoPorMaquina.values()].some(d => d.fonte === 'fallback')

  // ── 2. Simula o que está "a bordo" em cada trecho ───────────────────────
  // Máquinas cuja PRIMEIRA menção é 'entrega' ou 'preparacao' já embarcam na
  // origem (vieram de Mills). Máquinas de 'coleta' só embarcam a partir da
  // parada onde são coletadas.
  const onboard = new Set()
  const jaVista = new Set()
  for (const p of paradas) {
    for (const n of (p.nInternos || [])) {
      if (!jaVista.has(n) && (p.tipo === 'entrega' || p.tipo === 'preparacao')) onboard.add(n)
      jaVista.add(n)
    }
  }
  const cargaAtual = () => {
    const itens = [...onboard].map(n => dimensaoPorMaquina.get(n))
    const peso = itens.reduce((a,d)=>a+d.peso, 0)
    const largura = Math.max(0, ...itens.map(d=>d.largura))
    const comprimento = itens.reduce((a,d)=>a+d.comprimento, 0) // somam — viajam uma atrás da outra
    const temBasculante = itens.some(d => d.fonte==='modelo' ? d.forcaPrancha : FORCA_PRANCHA.has(d.grupo))
    return { peso, largura, comprimento, temBasculante }
  }

  const trechos = [cargaAtual()] // trecho 0 = origem → parada[0], com a carga inicial
  for (const p of paradas) {
    if (p.tipo === 'entrega') for (const n of (p.nInternos||[])) onboard.delete(n)
    if (p.tipo === 'coleta')  for (const n of (p.nInternos||[])) onboard.add(n)
    // 'preparacao' não altera o que está a bordo
    trechos.push(cargaAtual())
  }
  trechos.pop() // o último "cargaAtual" é depois da última parada — não existe trecho seguinte

  // ── 3. Veículo necessário = PIOR CASO entre os trechos, nunca a soma ────
  const pesoMax        = Math.max(0, ...trechos.map(t=>t.peso))
  const larguraMax      = Math.max(0, ...trechos.map(t=>t.largura))
  const comprimentoMax  = Math.max(0, ...trechos.map(t=>t.comprimento))
  const temBasculante   = trechos.some(t=>t.temBasculante)
  let veiculoId
  if (temBasculante) {
    const prancha3 = VEICULOS.find(v=>v.id==='prancha3')
    veiculoId = (pesoMax <= prancha3.carga && comprimentoMax <= prancha3.comp) ? 'prancha3' : 'prancha4'
  } else {
    // Bitrem 9 eixos fica de fora aqui — a regra dele é por-máquina individual
    // (ver cabeNoBitrem9), e essa função só rastreia peso/largura/comprimento
    // agregados por trecho, sem o detalhe de cada item pra validar o porte.
    veiculoId = ORDEM_VEICULOS.filter(id => id !== 'bitrem9')
      .find(id => cabeNoVeiculo(id, pesoMax, larguraMax, comprimentoMax)) || 'prancha4'
  }

  // ── 4. Distâncias: rota real (todas as pernas) vs rota direta (origem→última) ──
  const pontos = [{ cidade:origemCidade, uf:origemUf }, ...paradas.map(p=>({cidade:p.cidade,uf:p.uf}))]
  const rotaReal   = await calcularDistanciaMultiPonto(pontos)
  const ultimaParada = paradas[paradas.length - 1]
  const rotaDireta = await calcularDistancia(origemCidade, origemUf, ultimaParada.cidade, ultimaParada.uf)

  if (rotaReal.total == null || rotaDireta.km == null) {
    return { veiculoId, pesoMax, larguraMax, comprimentoMax, temItemNaoIdentificado, trechos,
      kmReal:null, kmDireto:null, desvioPct:null, ehDesvio:null, pernas:null }
  }

  const desvioKm  = rotaReal.total - rotaDireta.km
  const desvioPct = rotaDireta.km > 0 ? desvioKm / rotaDireta.km : 0
  const ehDesvio  = desvioPct > limiteDesvioPct

  // Precificação: regra combinada com a operação (2026-07) — sem desvio real,
  // cobra 1 trecho pela distância DIRETA; com desvio, soma cada perna pela
  // tabela Hengel individualmente, sem nenhum desconto entre elas. Devolve os
  // 2 valores possíveis (não só o sugerido) pra UI permitir override manual
  // do analista sem precisar recalcular nada.
  // ajuste de +12% outro estado (mesma regra de calcularFrete/`ajuste`) —
  // faltava aqui: a UI mostrava o badge "+12% outro estado" em cima desse
  // valor sem o adicional nunca ter sido de fato aplicado, subcobrando toda
  // rota combinada que saísse de SP.
  const ajuste = outroEstado ? 1.12 : 1
  const valorCombinado = getValorIda(rotaDireta.km, veiculoId) * ajuste
  const valorSeparado  = rotaReal.pernas.reduce((soma, km) => soma + getValorIda(km, veiculoId), 0) * ajuste
  const valorSugerido  = ehDesvio ? valorSeparado : valorCombinado

  return {
    veiculoId,
    pesoMax: Math.round(pesoMax*10)/10,
    larguraMax: Math.round(larguraMax*100)/100,
    comprimentoMax: Math.round(comprimentoMax*100)/100,
    temItemNaoIdentificado,
    trechos,
    kmReal: rotaReal.total,
    kmDireto: rotaDireta.km,
    pernas: rotaReal.pernas,     // km de cada trecho individual, na mesma ordem de `trechos`
    desvioKm,
    desvioPct: Math.round(desvioPct*1000)/10, // em %, 1 casa decimal
    ehDesvio,   // true = cobrar trechos separados; false = cobrar 1 trecho direto
    ajuste,
    valorSugerido: Math.round(valorSugerido*100)/100,
    valorCombinado: Math.round(valorCombinado*100)/100,
    valorSeparado: Math.round(valorSeparado*100)/100,
  }
}

// ── CÁLCULO DE FRETE ─────────────────────────────────────────
export function getValorIda(km, veiculoId) {
  // Frete Rodando não tem coluna na tabela — sempre valor manual.
  if (veiculoId === 'frete_rodando') return 0
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
  // Frete Rodando não tem tarifa Hengel (não é veículo carregando algo, é a
  // própria máquina rodando) — o valor é sempre informado manualmente pelo
  // analista, nunca calculado. Retorna null em vez de arriscar um NaN.
  if (veiculoId === 'frete_rodando') return null

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

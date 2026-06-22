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
  'Caminhão Basculante Toco (2 eixos)':        'prancha3', // ~8,5t vazio — força prancha (ver FORCA_PRANCHA)
  'Caminhão Basculante Truçado (3 eixos)':     'prancha3', // ~11,5t vazio
  'Caminhão Basculante Bitruck (4+ eixos)':    'prancha3', // ~16,0t vazio
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
  'Caminhão Basculante Toco (2 eixos)':        8.5,   // peso vazio, estimado
  'Caminhão Basculante Truçado (3 eixos)':     14.6,  // Fonte: mills.com.br — média Volvo VM-330 Basculante (13,6t) + Mercedes AXOR-4144 Basculante (15,5t)
  'Caminhão Basculante Bitruck (4+ eixos)':    16.0,  // peso vazio, estimado
  // ⚠️ Categorias novas — confirmar se aparecem como "Grupo de Modelo" separado no CSV do SIM.
  // Se o SIM classificar esses caminhões dentro de "Basculante", remover as 3 linhas abaixo.
  'Caminhão Comboio':                          13.5,  // Fonte: mills.com.br (Volvo VM-270/VM-290, ambos 13,5t)
  'Caminhão Pipa/Irrigadeira':                 15.3,  // Fonte: mills.com.br (Volvo VM-270 Pipa 15,3t; Mercedes Atego 2730 15,3t — idêntico)
  'Caminhão Plataforma':                       13.6,  // estimado = mesmo chassi do Basculante (Volvo VM-330); sem peso/dimensão publicado
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
  'Caminhão Basculante Toco (2 eixos)':        2.55,  // estimado
  'Caminhão Basculante Truçado (3 eixos)':     2.60,  // Fonte: mills.com.br — Volvo VM-330 e Mercedes AXOR-4144 Basculante, ambos 2,60m
  'Caminhão Basculante Bitruck (4+ eixos)':    2.60,  // estimado
  'Caminhão Comboio':                          2.60,  // Fonte: mills.com.br (Volvo VM-270/VM-290)
  'Caminhão Pipa/Irrigadeira':                 2.60,  // Fonte: mills.com.br (Volvo VM-270 Pipa; Mercedes Atego 2730)
  'Caminhão Plataforma':                       2.60,  // estimado = mesmo chassi do Basculante (Volvo VM-330)
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
  'Caminhão Basculante Toco (2 eixos)':        7.50,  // estimado
  'Caminhão Basculante Truçado (3 eixos)':     7.78,  // Fonte: mills.com.br — média Volvo VM-330 (8,00m) + Mercedes AXOR-4144 (7,56m)
  'Caminhão Basculante Bitruck (4+ eixos)':    11.00, // estimado
  'Caminhão Comboio':                          9.95,  // Fonte: mills.com.br (Volvo VM-270/VM-290, ambos 9,95m)
  'Caminhão Pipa/Irrigadeira':                 9.89,  // Fonte: mills.com.br (Volvo VM-270 Pipa 9,89m; Mercedes Atego 2730 9,89m — idêntico)
  'Caminhão Plataforma':                       8.00,  // estimado = mesmo chassi do Basculante (Volvo VM-330)
}

// Grupos que SEMPRE embarcam em prancha, independente do que peso/largura/
// comprimento isoladamente sugerissem — caminhão basculante é um veículo
// completo (eixos, cabine) e não se embarca em outro caminhão de porte
// similar; sempre vai de prancha (3 ou 4 eixos, conforme peso/quantidade).
const FORCA_PRANCHA = new Set([
  'Caminhão Basculante Toco (2 eixos)',
  'Caminhão Basculante Truçado (3 eixos)',
  'Caminhão Basculante Bitruck (4+ eixos)',
  'Caminhão Comboio',
  'Caminhão Pipa/Irrigadeira',
  'Caminhão Plataforma',
])

// ── BUSCA GRUPO DE MODELO NO CSV SIM ─────────────────────────
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
      const grupo = buscarGrupoModelo([n], simClients)
      if (!grupo) return acc
      const largura = LARGURA_GRUPO[grupo] || 0
      acc.peso        += PESO_GRUPO[grupo] || 0
      acc.comprimento += COMPRIMENTO_GRUPO[grupo] || 0
      acc.larguras.push({ grupo, largura })
      return acc
    }, { peso:0, comprimento:0, larguras:[] })

  const idaCalc   = calcDimensoes(nInternosIda)
  const voltaCalc = calcDimensoes(nInternosVolta)
  const todasLarguras = [...idaCalc.larguras, ...voltaCalc.larguras]

  const pesoIda   = Math.round(idaCalc.peso   * 10) / 10
  const pesoVolta = Math.round(voltaCalc.peso * 10) / 10
  const pesoMax   = Math.max(pesoIda, pesoVolta)
  const larguraMax     = Math.max(0, ...todasLarguras.map(x => x.largura))
  const comprimentoMax = Math.max(idaCalc.comprimento, voltaCalc.comprimento)
  const gruposComLamina = [...new Set(todasLarguras.filter(x => REQUER_DESMONTAGEM_LAMINA.has(x.grupo)).map(x => x.grupo))]
  const temBasculante = todasLarguras.some(x => FORCA_PRANCHA.has(x.grupo))

  // Caminhão basculante sempre embarca em prancha — não se aplica o cálculo
  // normal de peso/largura/comprimento (é um veículo completo, não cabe a
  // lógica de "amarrar sobre outro caminhão" usada para equipamentos).
  let veiculoId
  if (temBasculante) {
    veiculoId = pesoMax <= 32 ? 'prancha3' : 'prancha4'
  } else {
    // Escolhe o veículo mais econômico que comporta peso + largura + comprimento juntos.
    // AET é sempre solicitada pela Mills, então largura acima de 2,60m nunca bloqueia —
    // só determina QUAL veículo é necessário (bitruck/prancha alargam até 3,20m com AET).
    veiculoId = ORDEM_VEICULOS.find(id => cabeNoVeiculo(id, pesoMax, larguraMax, comprimentoMax))
  }

  // Se desmontar a(s) lâmina(s) resolveria (cabe em veículo mais barato), sinaliza a
  // sugestão de economia — substitui, na largura máxima, apenas os grupos com lâmina
  // pelo valor sem lâmina, mantendo a largura normal das demais máquinas da carga.
  let sugestaoDesmontagem = null
  if (gruposComLamina.length > 0) {
    const larguraMaxSemLamina = Math.max(0, ...todasLarguras.map(x =>
      REQUER_DESMONTAGEM_LAMINA.has(x.grupo) ? (LARGURA_SEM_LAMINA_GRUPO[x.grupo] || x.largura) : x.largura
    ))
    const veiculoSemLamina = ORDEM_VEICULOS.find(id => cabeNoVeiculo(id, pesoMax, larguraMaxSemLamina, comprimentoMax))
    if (veiculoSemLamina && ORDEM_VEICULOS.indexOf(veiculoSemLamina) < ORDEM_VEICULOS.indexOf(veiculoId || 'prancha4')) {
      sugestaoDesmontagem = { veiculoId: veiculoSemLamina, veiculo: VEICULOS.find(v=>v.id===veiculoSemLamina) }
    }
  }

  // Nenhum veículo padrão comporta peso+largura+comprimento simultaneamente —
  // usa a maior prancha e sinaliza qual dimensão foi o problema.
  let larguraExcedida = false, comprimentoExcedido = false
  if (!veiculoId) {
    veiculoId = 'prancha4'
    const p4 = VEICULOS.find(v=>v.id==='prancha4')
    larguraExcedida     = larguraMax > p4.larg
    comprimentoExcedido = comprimentoMax > p4.comp
  }

  // Para exibição: o veículo teria sido suficiente só pelo peso? Ajuda a entender
  // se foi a largura/comprimento (não o peso) que "empurrou" para um veículo maior.
  const veiculoPorPesoSo = ORDEM_VEICULOS.find(id => pesoMax <= VEICULOS.find(x=>x.id===id).carga)
  const motivoLargura     = veiculoPorPesoSo !== veiculoId && larguraMax     > (VEICULOS.find(v=>v.id===veiculoPorPesoSo)?.larg || 0)
  const motivoComprimento = veiculoPorPesoSo !== veiculoId && comprimentoMax > (VEICULOS.find(v=>v.id===veiculoPorPesoSo)?.comp || 0)

  const sentidoPesado = pesoIda >= pesoVolta ? 'ida' : 'volta'
  const milsSuporta   = pesoMax <= 32   // prancha4 → somente Hengel

  return {
    veiculoId,
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
    sugestaoDesmontagem,   // {veiculoId, veiculo} se desmontar a lâmina permitir veículo mais barato
    sentidoPesado,
    milsSuporta,
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
  let valorIda = 0, valorRetorno = 0, valorEscolta = 0, valorDiaria = 0

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

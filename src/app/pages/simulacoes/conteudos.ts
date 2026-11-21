/**
 * Catálogo do Laboratório: assuntos (na ordem de ensino) e os módulos de cada um.
 * Módulo sem `rota` aparece como "em construção" (card esmaecido, sem botão de abrir).
 * Usado pela página Laboratório (pages/simulacoes) e pela tela inicial (pages/landing).
 */
import { BadgeVariant } from '../../ui/badge/badge.component';
import { CardIconVariant } from '../../ui/card-icon/card-icon.component';

export type IdAssunto = 'niveis' | 'cpu' | 'memoria' | 'barramentos' | 'assembly';

export interface Modulo {
  titulo: string;
  descricao: string;
  /** Rota do módulo; sem rota = em construção. */
  rota?: string;
  tipo: { texto: string; variante: BadgeVariant };
  /** Traços do ícone (atributo d de cada path, viewBox 24×24). */
  icone: string[];
  variante?: CardIconVariant;
}

export interface Assunto {
  id: IdAssunto;
  nome: string;
  descricao: string;
  icone: string[];
  variante?: CardIconVariant;
  modulos: Modulo[];
}

const SIMULADOR = { texto: 'simulador', variante: 'a' as BadgeVariant };

export const ASSUNTOS: Assunto[] = [
  {
    id: 'niveis',
    nome: 'Níveis da máquina',
    descricao: 'Sistema multinível: do programa em alto nível até a lógica digital.',
    icone: ['M4 6h16', 'M6 10h12', 'M8 14h8', 'M10 18h4'],
    variante: 'info',
    modulos: [
      {
        titulo: 'Sistema multinível',
        descricao: 'Uma linha em C descendo os níveis: alto nível, assembly, linguagem de máquina, microprogramação e lógica digital.',
        tipo: SIMULADOR,
        icone: ['M4 6h16', 'M6 10h12', 'M8 14h8', 'M10 18h4'],
        variante: 'info',
      },
    ],
  },
  {
    id: 'cpu',
    nome: 'CPU',
    descricao: 'Os componentes da CPU e o ciclo de busca, decodificação e execução.',
    icone: ['M7 7h10v10H7z', 'M10 3v4M14 3v4M10 17v4M14 17v4M3 10h4M3 14h4M17 10h4M17 14h4'],
    modulos: [
      {
        titulo: 'Componentes da CPU',
        descricao: 'UC, ULA, registradores, decodificador, clock e barramento interno, cada um com uma mini simulação.',
        tipo: SIMULADOR,
        icone: ['M7 7h10v10H7z', 'M10 3v4M14 3v4M10 17v4M14 17v4M3 10h4M3 14h4M17 10h4M17 14h4'],
      },
      {
        titulo: 'Ciclo de instrução',
        descricao: 'Busca, decodificação e execução de cada instrução, em micro-operações: PC, IR, MAR, MDR, ULA e memória.',
        rota: '/cpu/ciclo',
        tipo: SIMULADOR,
        icone: ['M20 12a8 8 0 1 1-2.3-5.7M20 4v4h-4', 'M9 12h6M12 9v6'],
        variante: 'info',
      },
    ],
  },
  {
    id: 'memoria',
    nome: 'Memória',
    descricao: 'O subsistema de memória: como os níveis conversam entre si e com a CPU.',
    icone: ['M4 7h16v10H4z', 'M8 7v10M12 7v10M16 7v10'],
    variante: 'ok',
    modulos: [
      {
        titulo: 'Hierarquia de memória',
        descricao: 'Registradores, cache, memória principal e secundária: tamanho, velocidade e como cada nível conversa com a CPU.',
        tipo: SIMULADOR,
        icone: ['M9 4h6M7 9h10M5 14h14M3 19h18'],
        variante: 'ok',
      },
      {
        titulo: 'Cache',
        descricao: 'A CPU pede um endereço: acerto ou falha, o bloco subindo da memória e o mapeamento da cache.',
        tipo: SIMULADOR,
        icone: ['M4 7h16v10H4z', 'M8 7v10M12 7v10M16 7v10'],
        variante: 'ok',
      },
    ],
  },
  {
    id: 'barramentos',
    nome: 'Barramentos',
    descricao: 'Como os dados trafegam entre CPU, memória e E/S nos barramentos.',
    icone: ['M3 7h18M3 12h18M3 17h18', 'M7 4v16M17 4v16'],
    variante: 'warn',
    modulos: [
      {
        titulo: 'Endereço, dados e controle',
        descricao: 'Leitura e escrita animadas entre CPU, memória e E/S, sinal por sinal, acompanhando o clock.',
        tipo: SIMULADOR,
        icone: ['M3 7h18M3 12h18M3 17h18', 'M7 4v16M17 4v16'],
        variante: 'warn',
      },
      {
        titulo: 'Tipos de barramento',
        descricao: 'Barramento único e múltiplos, síncrono e assíncrono, serial e paralelo.',
        tipo: SIMULADOR,
        icone: ['M4 8h16M4 16h16', 'M8 5l-4 3 4 3M16 13l4 3-4 3'],
        variante: 'warn',
      },
    ],
  },
  {
    id: 'assembly',
    nome: 'Assembly',
    descricao: 'Programe a CPU: simule, execute, traduza do C e pratique.',
    icone: ['M8 7l-5 5 5 5M16 7l5 5-5 5'],
    modulos: [
      {
        titulo: 'Simulador de Assembly',
        descricao: 'Assembly simplificado (PC e Arduino), passo a passo: registradores, ULA, flags, memória e portas (LED, botão, sensor).',
        rota: '/assembly/simulador',
        tipo: SIMULADOR,
        icone: ['M3 4h18v16H3z', 'M7 9l3 3-3 3M12 15h5'],
      },
      {
        titulo: 'Executor Assembly',
        descricao: 'Escreva, execute e veja o resultado direto, com o código equivalente em C++ (PC ou Arduino).',
        rota: '/assembly/executor',
        tipo: { texto: 'executor', variante: 's' },
        icone: ['M7 5l12 7-12 7z'],
        variante: 'ok',
      },
      {
        titulo: 'Tradutor C → Assembly',
        descricao: 'Escreva em C/C++ (PC ou Arduino) e veja o Assembly simplificado correspondente.',
        rota: '/assembly/tradutor',
        tipo: { texto: 'tradutor', variante: 's' },
        icone: ['M4 7h11M11 3l4 4-4 4M20 17H9M13 13l-4 4 4 4'],
        variante: 'warn',
      },
      {
        titulo: 'Exercícios',
        descricao: 'Escreva o assembly (ou o C), responda às perguntas e confira na hora.',
        rota: '/assembly/exercicios',
        tipo: { texto: 'exercícios', variante: 's' },
        icone: ['M9 11l3 3 8-8', 'M20 12v6a2 2 0 0 1-2 2H6a2 2 0 0 1-2-2V6a2 2 0 0 1 2-2h9'],
        variante: 'info',
      },
    ],
  },
];

/** O assunto já tem algum módulo pronto? */
export const temModuloPronto = (a: Assunto) => a.modulos.some(m => !!m.rota);

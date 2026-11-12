/**
 * Conjunto de instruções do assembly didático do ArqLive.
 *
 * Para mudar o padrão de assembly (nomes, apelidos, operandos), altere SÓ este arquivo:
 * o montador e o executor leem as definições daqui, e a tela de referência também.
 */

/** Tipos de operando aceitos. */
export type TipoOperando =
  | 'destino'   // registrador ou variável (recebe valor)
  | 'origem'    // registrador, variável ou número
  | 'saida'     // como origem, ou texto entre aspas
  | 'rotulo';   // nome de um rótulo do programa

export type Operacao =
  | 'MOV' | 'ADD' | 'SUB' | 'MUL' | 'DIV' | 'MOD' | 'INC' | 'DEC'
  | 'CMP' | 'JMP' | 'JE' | 'JNE' | 'JG' | 'JGE' | 'JL' | 'JLE'
  | 'LER' | 'ESCREVER' | 'NOP' | 'HLT';

export interface DefInstrucao {
  op: Operacao;
  /** Outros nomes aceitos para a mesma instrução. */
  apelidos: string[];
  operandos: TipoOperando[];
  /** Forma de uso mostrada na referência. */
  uso: string;
  /** Explicação curta (aparece na decodificação). */
  descricao: string;
  /** Grupo na referência. */
  grupo: 'Dados' | 'Aritmética' | 'Comparação e desvio' | 'Entrada e saída' | 'Controle';
}

export const INSTRUCOES: DefInstrucao[] = [
  { op: 'MOV', apelidos: ['MOVER'], operandos: ['destino', 'origem'], uso: 'MOV destino, origem', descricao: 'copia a origem para o destino', grupo: 'Dados' },

  { op: 'ADD', apelidos: ['SOMAR'], operandos: ['destino', 'origem'], uso: 'ADD destino, origem', descricao: 'destino ← destino + origem', grupo: 'Aritmética' },
  { op: 'SUB', apelidos: ['SUBTRAIR'], operandos: ['destino', 'origem'], uso: 'SUB destino, origem', descricao: 'destino ← destino − origem', grupo: 'Aritmética' },
  { op: 'MUL', apelidos: ['MULTIPLICAR'], operandos: ['destino', 'origem'], uso: 'MUL destino, origem', descricao: 'destino ← destino × origem', grupo: 'Aritmética' },
  { op: 'DIV', apelidos: ['DIVIDIR'], operandos: ['destino', 'origem'], uso: 'DIV destino, origem', descricao: 'destino ← destino ÷ origem (divisão inteira)', grupo: 'Aritmética' },
  { op: 'MOD', apelidos: ['RESTO'], operandos: ['destino', 'origem'], uso: 'MOD destino, origem', descricao: 'destino ← resto de destino ÷ origem', grupo: 'Aritmética' },
  { op: 'INC', apelidos: [], operandos: ['destino'], uso: 'INC destino', descricao: 'destino ← destino + 1', grupo: 'Aritmética' },
  { op: 'DEC', apelidos: [], operandos: ['destino'], uso: 'DEC destino', descricao: 'destino ← destino − 1', grupo: 'Aritmética' },

  { op: 'CMP', apelidos: ['COMPARAR'], operandos: ['origem', 'origem'], uso: 'CMP a, b', descricao: 'compara a com b e atualiza as flags Z e N', grupo: 'Comparação e desvio' },
  { op: 'JMP', apelidos: ['DESVIE'], operandos: ['rotulo'], uso: 'JMP rótulo', descricao: 'desvia sempre para o rótulo', grupo: 'Comparação e desvio' },
  { op: 'JE', apelidos: ['JZ'], operandos: ['rotulo'], uso: 'JE rótulo', descricao: 'desvia se a = b (Z = 1)', grupo: 'Comparação e desvio' },
  { op: 'JNE', apelidos: ['JNZ'], operandos: ['rotulo'], uso: 'JNE rótulo', descricao: 'desvia se a ≠ b (Z = 0)', grupo: 'Comparação e desvio' },
  { op: 'JG', apelidos: [], operandos: ['rotulo'], uso: 'JG rótulo', descricao: 'desvia se a > b (Z = 0 e N = 0)', grupo: 'Comparação e desvio' },
  { op: 'JGE', apelidos: [], operandos: ['rotulo'], uso: 'JGE rótulo', descricao: 'desvia se a ≥ b (N = 0)', grupo: 'Comparação e desvio' },
  { op: 'JL', apelidos: [], operandos: ['rotulo'], uso: 'JL rótulo', descricao: 'desvia se a < b (N = 1)', grupo: 'Comparação e desvio' },
  { op: 'JLE', apelidos: [], operandos: ['rotulo'], uso: 'JLE rótulo', descricao: 'desvia se a ≤ b (N = 1 ou Z = 1)', grupo: 'Comparação e desvio' },

  { op: 'LER', apelidos: ['IN', 'INPUT'], operandos: ['destino'], uso: 'LER destino', descricao: 'lê o próximo valor da entrada', grupo: 'Entrada e saída' },
  { op: 'ESCREVER', apelidos: ['OUT', 'PRINT', 'MOSTRAR'], operandos: ['saida'], uso: 'ESCREVER origem  ou  ESCREVER "texto"', descricao: 'mostra o valor (ou o texto) na saída', grupo: 'Entrada e saída' },

  { op: 'NOP', apelidos: [], operandos: [], uso: 'NOP', descricao: 'não faz nada', grupo: 'Controle' },
  { op: 'HLT', apelidos: ['HALT', 'PARAR'], operandos: [], uso: 'HLT', descricao: 'encerra o programa', grupo: 'Controle' },
];

/** Registradores de uso geral. */
export const REGISTRADORES = ['A', 'B', 'C', 'D'] as const;
export type Registrador = typeof REGISTRADORES[number];

/** Limite de instruções executadas (evita travar a tela num laço infinito). */
export const LIMITE_INSTRUCOES = 2000;

const POR_NOME = new Map<string, DefInstrucao>();
INSTRUCOES.forEach(d => [d.op, ...d.apelidos].forEach(n => POR_NOME.set(n.toUpperCase(), d)));

export function buscarInstrucao(nome: string): DefInstrucao | undefined {
  return POR_NOME.get(nome.toUpperCase());
}

export function ehRegistrador(nome: string): boolean {
  return (REGISTRADORES as readonly string[]).includes(nome.toUpperCase());
}

/** Palavras que não podem ser usadas como nome de variável ou rótulo. */
export function ehReservada(nome: string): boolean {
  return ehRegistrador(nome) || POR_NOME.has(nome.toUpperCase());
}

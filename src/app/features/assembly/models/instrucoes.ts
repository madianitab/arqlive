/**
 * Conjunto de instruções do "Assembly simplificado" do ArqLive
 * (padrão das aulas de Arquitetura II — Aula 14, "Do C++ ao Assembly").
 *
 * Regra: o destino vem sempre primeiro (inclusive em OUT porta, R1).
 * Arquitetura RISC, como o AVR do Arduino: LOAD/STORE acessam a memória;
 * as operações da ULA trabalham só com registradores e constantes.
 *
 * Para mudar o padrão (nomes, apelidos, operandos), altere SÓ este arquivo:
 * o montador, o executor e a referência da tela leem as definições daqui.
 */

/** Tipos de operando aceitos. */
export type TipoOperando =
  | 'reg'          // registrador R0…R7
  | 'regOuConst'   // registrador ou constante
  | 'memOuConst'   // variável da memória (X ou V[R1]) ou constante
  | 'mem'          // variável da memória (X ou V[R1])
  | 'portaEntrada' // BOTAO, A0…A5, número do pino ou registrador com o número
  | 'portaSaida'   // LED, TELA, número do pino ou registrador com o número
  | 'rotulo';      // rótulo do programa

export type Operacao =
  | 'LOAD' | 'STORE' | 'MOV'
  | 'ADD' | 'SUB' | 'MUL' | 'DIV'
  | 'CMP' | 'JMP' | 'JE' | 'JNE' | 'JG' | 'JGE' | 'JL' | 'JLE'
  | 'IN' | 'OUT' | 'DELAY'
  | 'CALL' | 'RET' | 'NOP' | 'HALT';

export type Grupo = 'Memória e registradores' | 'ULA' | 'Comparação e desvio' | 'Entrada e saída (portas)' | 'Controle';

export interface DefInstrucao {
  op: Operacao;
  /** Outros nomes aceitos para a mesma instrução. */
  apelidos: string[];
  operandos: TipoOperando[];
  /** Forma de uso mostrada na referência. */
  uso: string;
  /** Outras formas aceitas (tabela de instruções). */
  outros?: string[];
  /** Explicação curta (aparece na decodificação). */
  descricao: string;
  /** Equivalente em C++ (referência). */
  cpp?: string;
  /** A instrução usa a ULA? */
  ula: boolean;
  grupo: Grupo;
  /** Instrução que não está no slide da aula (acréscimo do simulador). */
  extra?: boolean;
}

export const INSTRUCOES: DefInstrucao[] = [
  { op: 'LOAD', outros: ['LOAD R1, 1', 'LOAD R2, LEDS[R1]'], apelidos: [], operandos: ['reg', 'memOuConst'], uso: 'LOAD R1, X', descricao: 'lê da memória (ou uma constante) para o registrador', cpp: 'R1 = X;  R1 = 1;', ula: false, grupo: 'Memória e registradores' },
  { op: 'STORE', apelidos: [], operandos: ['mem', 'reg'], uso: 'STORE X, R1', descricao: 'grava o registrador na memória', cpp: 'X = R1;', ula: false, grupo: 'Memória e registradores' },
  { op: 'MOV', apelidos: [], operandos: ['reg', 'reg'], uso: 'MOV R2, R1', descricao: 'copia entre registradores', cpp: 'R2 = R1;', ula: false, grupo: 'Memória e registradores' },

  { op: 'ADD', outros: ['ADD R1, 2'], apelidos: [], operandos: ['reg', 'regOuConst'], uso: 'ADD R1, R2', descricao: 'a ULA soma e guarda em R1; atualiza as flags', cpp: 'R1 = R1 + R2;', ula: true, grupo: 'ULA' },
  { op: 'SUB', outros: ['SUB R1, 1'], apelidos: [], operandos: ['reg', 'regOuConst'], uso: 'SUB R1, R2', descricao: 'a ULA subtrai e guarda em R1; atualiza as flags', cpp: 'R1 = R1 - R2;', ula: true, grupo: 'ULA' },
  { op: 'MUL', outros: ['MUL R1, 3'], apelidos: [], operandos: ['reg', 'regOuConst'], uso: 'MUL R1, R2', descricao: 'a ULA multiplica e guarda em R1; atualiza as flags', cpp: 'R1 = R1 * R2;', ula: true, grupo: 'ULA' },
  { op: 'DIV', outros: ['DIV R1, 2'], apelidos: [], operandos: ['reg', 'regOuConst'], uso: 'DIV R1, R2', descricao: 'a ULA divide (divisão inteira) e guarda em R1; atualiza as flags', cpp: 'R1 = R1 / R2;', ula: true, grupo: 'ULA', extra: true },

  { op: 'CMP', outros: ['CMP R1, 3'], apelidos: [], operandos: ['reg', 'regOuConst'], uso: 'CMP R1, R2', descricao: 'compara (R1 − R2, sem guardar) e atualiza as flags Z, N e C', cpp: 'if (R1 == R2)', ula: true, grupo: 'Comparação e desvio' },
  { op: 'JMP', apelidos: [], operandos: ['rotulo'], uso: 'JMP ROTULO', descricao: 'muda o PC sempre', cpp: 'goto (for, while)', ula: false, grupo: 'Comparação e desvio' },
  { op: 'JE', apelidos: ['JZ'], operandos: ['rotulo'], uso: 'JE ROTULO', descricao: 'muda o PC se for igual (Z = 1)', cpp: 'if (==)', ula: false, grupo: 'Comparação e desvio' },
  { op: 'JNE', apelidos: ['JNZ'], operandos: ['rotulo'], uso: 'JNE ROTULO', descricao: 'muda o PC se for diferente (Z = 0)', cpp: 'if (!=)', ula: false, grupo: 'Comparação e desvio' },
  { op: 'JG', apelidos: [], operandos: ['rotulo'], uso: 'JG ROTULO', descricao: 'muda o PC se for maior (Z = 0 e N = 0)', cpp: 'if (>)', ula: false, grupo: 'Comparação e desvio', extra: true },
  { op: 'JGE', apelidos: [], operandos: ['rotulo'], uso: 'JGE ROTULO', descricao: 'muda o PC se for maior ou igual (N = 0)', cpp: 'if (>=)', ula: false, grupo: 'Comparação e desvio', extra: true },
  { op: 'JL', apelidos: [], operandos: ['rotulo'], uso: 'JL ROTULO', descricao: 'muda o PC se for menor (N = 1)', cpp: 'if (<)', ula: false, grupo: 'Comparação e desvio', extra: true },
  { op: 'JLE', apelidos: [], operandos: ['rotulo'], uso: 'JLE ROTULO', descricao: 'muda o PC se for menor ou igual (N = 1 ou Z = 1)', cpp: 'if (<=)', ula: false, grupo: 'Comparação e desvio', extra: true },

  { op: 'IN', outros: ['IN R1, A0', 'IN R1, 7'], apelidos: [], operandos: ['reg', 'portaEntrada'], uso: 'IN R1, BOTAO', descricao: 'lê um pino ou sensor para o registrador', cpp: 'R1 = digitalRead(botao);  R1 = analogRead(A0);', ula: false, grupo: 'Entrada e saída (portas)' },
  { op: 'OUT', outros: ['OUT TELA, R1', 'OUT 8, R1', 'OUT R2, R3'], apelidos: [], operandos: ['portaSaida', 'reg'], uso: 'OUT LED, R1', descricao: 'envia o valor do registrador para a porta de saída', cpp: 'digitalWrite(led, R1);  printf("%d", R1);', ula: false, grupo: 'Entrada e saída (portas)' },
  { op: 'DELAY', outros: ['DELAY R1'], apelidos: [], operandos: ['regOuConst'], uso: 'DELAY 1000', descricao: 'pausa (em milissegundos)', cpp: 'delay(1000);', ula: false, grupo: 'Entrada e saída (portas)' },

  { op: 'CALL', outros: ['CALL ROTINA'], apelidos: [], operandos: ['rotulo'], uso: 'CALL imprime', descricao: 'chama uma sub-rotina (CALL imprime exibe o TEXTO da memória)', cpp: 'printf(...);', ula: false, grupo: 'Controle' },
  { op: 'RET', apelidos: [], operandos: [], uso: 'RET', descricao: 'volta da sub-rotina (o PC recebe o endereço guardado na pilha)', cpp: 'return;', ula: false, grupo: 'Controle', extra: true },
  { op: 'NOP', apelidos: [], operandos: [], uso: 'NOP', descricao: 'não faz nada', cpp: ';', ula: false, grupo: 'Controle', extra: true },
  { op: 'HALT', apelidos: ['HLT'], operandos: [], uso: 'HALT', descricao: 'encerra o programa', cpp: 'return 0;', ula: false, grupo: 'Controle' },
];

/** Registradores de uso geral. */
export const REGISTRADORES = ['R0', 'R1', 'R2', 'R3', 'R4', 'R5', 'R6', 'R7'] as const;
export type Registrador = typeof REGISTRADORES[number];

/** Portas de entrada com nome e faixa de valores. */
export const PORTAS_ENTRADA: { nome: string; min: number; max: number; descricao: string }[] = [
  { nome: 'BOTAO', min: 0, max: 1, descricao: 'botão: 0 = solto, 1 = apertado' },
  ...['A0', 'A1', 'A2', 'A3', 'A4', 'A5'].map(n => ({ nome: n, min: 0, max: 1023, descricao: 'pino analógico (ADC 10 bits): 0 a 1023' })),
];

/** Saídas com nome. Os pinos digitais também podem ser usados pelo número (0 a 13). */
export const PINO_LED = 13;
export const PINO_MAX = 13;

/** Sub-rotina do sistema: CALL imprime exibe a variável TEXTO (como o printf). */
export const ROTINA_IMPRIME = 'IMPRIME';
export const VARIAVEL_TEXTO = 'TEXTO';

/** Tamanho da pilha (palavras), usada pelo CALL/RET de sub-rotinas do programa. */
export const TAMANHO_PILHA = 8;

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

/** Parece um registrador (R seguido de número), mesmo fora de R0…R7. */
export function pareceRegistrador(nome: string): boolean {
  return /^R\d+$/i.test(nome);
}

/** Palavras que não podem ser usadas como nome de variável ou rótulo. */
export function ehReservada(nome: string): boolean {
  return pareceRegistrador(nome) || POR_NOME.has(nome.toUpperCase());
}

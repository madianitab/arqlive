/**
 * Tabela de rastreamento da execução (lógica pura, sem Angular): uma linha por instrução
 * executada, com o valor de cada coluna DEPOIS da instrução.
 *
 *   PC | IR (instrução) | R1 | X na memória | Usou a ULA? | Z | N | C | Próximo PC
 *
 * Registradores que ainda não receberam valor aparecem vazios ("Estado inicial: R1 vazio").
 */
import { Execucao, Passo, textoValor } from './assembly';
import { PINO_LED, REGISTRADORES, Registrador } from './instrucoes';

export type TipoColuna = 'texto' | 'simnao' | 'bit';

export interface ColunaRastreamento {
  id: string;
  titulo: string;
  tipo: TipoColuna;
  /** Explicação curta (aparece ao passar o mouse). */
  dica: string;
}

export interface LinhaRastreamento {
  /** Número da instrução executada (1, 2, 3…). */
  ciclo: number;
  /** Endereço da instrução (valor do PC na busca). */
  pc: number;
  ir: string;
  /** Linha do código-fonte. */
  linha: number | null;
  /** Valor de cada coluna depois da instrução (id da coluna → texto). */
  valores: Record<string, string>;
}

export interface Rastreamento {
  colunas: ColunaRastreamento[];
  linhas: LinhaRastreamento[];
  /** Estado antes da primeira instrução (ex.: "X = 5", "R1 vazio"). */
  inicial: string[];
}

export const VAZIO = '';

/** Instruções que gravam no registrador do primeiro operando. */
const GRAVAM_REG = new Set(['LOAD', 'MOV', 'ADD', 'SUB', 'MUL', 'DIV', 'IN']);

/** Pinos em HIGH, em texto (ex.: "LED, 8"); "nenhum" se todos estão em LOW. */
function pinosLigados(p: Passo): string {
  const lig = Object.entries(p.pinos).filter(([, v]) => v !== 0).map(([k]) => +k).sort((a, b) => a - b);
  return lig.length ? lig.map(n => (n === PINO_LED ? 'LED' : String(n))).join(', ') : 'nenhum';
}

export function gerarRastreamento(ex: Execucao): Rastreamento {
  const prog = ex.programa;
  if (prog.erros.length || !ex.passos.length) return { colunas: [], linhas: [], inicial: [] };

  // último passo de cada instrução executada (execução, erro ou HALT)
  const fins: Passo[] = [];
  ex.passos.forEach(p => {
    if (p.end === null || p.ciclo === 0) return;
    if (p.fase === 'execucao' || p.fase === 'erro' || p.fase === 'fim') {
      if (fins.length && fins[fins.length - 1].ciclo === p.ciclo) fins[fins.length - 1] = p;
      else fins.push(p);
    }
  });

  // registradores que o programa usa (na ordem R0…R7)
  const regsUsados = new Set<Registrador>();
  prog.instrucoes.forEach(i => i.operandos.forEach(o => {
    if (o.t === 'reg') regsUsados.add(o.r);
    if (o.t === 'mem' && o.indice?.t === 'reg') regsUsados.add(o.indice.r);
  }));
  const regs = REGISTRADORES.filter(r => regsUsados.has(r));
  const vars = prog.variaveis.filter(v => typeof v.valores[0] !== 'string');
  const usaPinos = ex.passos.some(p => Object.keys(p.pinos).length > 0);

  const colunas: ColunaRastreamento[] = [
    ...regs.map(r => ({ id: r, titulo: r, tipo: 'texto' as const, dica: `Valor de ${r} depois da instrução (vazio se ainda não recebeu valor)` })),
    ...vars.map(v => ({ id: `M:${v.nome}`, titulo: `${v.nome} na memória`, tipo: 'texto' as const,
      dica: v.valores.length > 1 ? `Valores do vetor ${v.nome}, separados por vírgula` : `Valor de ${v.nome} na memória depois da instrução` })),
    { id: 'ULA', titulo: 'Usou a ULA?', tipo: 'simnao', dica: 'A instrução fez uma conta ou comparação na ULA?' },
    { id: 'Z', titulo: 'Z', tipo: 'bit', dica: 'Flag Z (zero): 1 se o resultado foi 0' },
    { id: 'N', titulo: 'N', tipo: 'bit', dica: 'Flag N (negativo): 1 se o resultado foi negativo' },
    { id: 'C', titulo: 'C', tipo: 'bit', dica: 'Flag C (carry): 1 se R1 < R2 sem considerar sinal' },
    ...(usaPinos ? [{ id: 'PINOS', titulo: 'Pinos em HIGH', tipo: 'texto' as const, dica: 'Pinos de saída ligados (ex.: LED, 8), ou "nenhum"' }] : []),
    { id: 'PROX', titulo: 'Próximo PC', tipo: 'texto', dica: 'Endereço da próxima instrução (o PC depois da instrução)' },
  ];

  const escritos = new Set<Registrador>();
  const linhas: LinhaRastreamento[] = fins.map(p => {
    const instr = prog.instrucoes.find(i => i.end === p.end)!;
    const o0 = instr.operandos[0];
    if (GRAVAM_REG.has(instr.def.op) && o0?.t === 'reg') escritos.add(o0.r);
    const valores: Record<string, string> = {};
    regs.forEach(r => valores[r] = escritos.has(r) ? String(p.regs[r]) : VAZIO);
    vars.forEach(v => {
      valores[`M:${v.nome}`] = v.valores.map((_, k) => textoValor(p.dados[v.end + k - prog.inicioDados])).join(', ');
    });
    valores['ULA'] = p.ula !== null ? 'sim' : 'não';
    valores['Z'] = String(p.z);
    valores['N'] = String(p.n);
    valores['C'] = String(p.c);
    if (usaPinos) valores['PINOS'] = pinosLigados(p);
    valores['PROX'] = p.fase === 'erro' ? '—' : p.pc >= prog.instrucoes.length ? 'fim' : String(p.pc);
    return { ciclo: p.ciclo, pc: p.end!, ir: p.ir, linha: p.linha, valores };
  });

  const inicial = [
    ...vars.map(v => `${v.nome} = ${v.valores.map(x => textoValor(x)).join(', ')}`),
    ...(regs.length ? [`${regs.join(', ')} ${regs.length > 1 ? 'vazios' : 'vazio'}`] : []),
  ];
  return { colunas, linhas, inicial };
}

/** Normaliza uma resposta para comparar: sem espaços extras, minúsculas, "vazio" = em branco. */
function normalizar(s: string, tipo: TipoColuna, pinos: boolean): string {
  let t = (s ?? '').trim().toLowerCase().replace(/\s*,\s*/g, ',').replace(/\s+/g, ' ');
  if (t === 'vazio' || t === '—' || t === '-' || t === 'null') t = '';
  if (tipo === 'simnao') {
    if (['s', 'sim', 'yes', '1', 'x'].includes(t)) t = 'sim';
    else if (['n', 'não', 'nao', 'no', '0'].includes(t)) t = 'não';
  }
  if (pinos) t = t.split(',').map(x => (x === '13' || x === 'pino 13' ? 'led' : x)).join(',');
  if (t === 'fim' || t === 'halt' || t === 'acabou') t = 'fim';
  return t.replace(/\{|\}/g, '');
}

/** A resposta do aluno está certa para a célula da coluna? */
export function conferirCelula(esperado: string, resposta: string, coluna: ColunaRastreamento): boolean {
  const pinos = coluna.id === 'PINOS';
  return normalizar(esperado, coluna.tipo, pinos) === normalizar(resposta, coluna.tipo, pinos);
}

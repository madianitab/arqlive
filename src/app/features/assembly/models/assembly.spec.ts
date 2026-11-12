import { montar, simular, Passo } from './assembly';
import { EXEMPLOS_ASSEMBLY } from './exemplos';
import { LIMITE_INSTRUCOES } from './instrucoes';

const ultimo = (v: Passo[]) => v[v.length - 1];
const exemplo = (id: string) => {
  const ex = EXEMPLOS_ASSEMBLY.find(e => e.id === id)!;
  return simular(ex.codigo, ex.entradas);
};
/** Valor final de uma variável. */
const varFinal = (r: ReturnType<typeof simular>, nome: string) => {
  const v = r.programa.variaveis.find(x => x.nome === nome)!;
  return ultimo(r.passos).dados[v.end - r.programa.inicioDados];
};
const execucoes = (r: ReturnType<typeof simular>) => r.passos.filter(p => p.fase === 'execucao' || p.fase === 'fim' && p.end !== null);

describe('Assembly simplificado — montagem', () => {
  it('código a partir do endereço 0 e variáveis logo depois', () => {
    const p = montar('X: 5\nV: 1, 2\nLOAD R1, X\nHALT');
    expect(p.erros).toEqual([]);
    expect(p.instrucoes.map(i => i.end)).toEqual([0, 1]);
    expect(p.variaveis.map(v => [v.nome, v.end])).toEqual([['X', 2], ['V', 3]]);
    expect(p.tamanhoMemoria).toBe(5);
    expect(p.inicioPilha).toBeNull();
  });

  it('aceita "vazio", texto, vetor e "X: 10 e Y: 20"', () => {
    const p = montar('X: 10 e Y: 20\nZ: vazio\nTEXTO: "X = "\nLED: 8, 9, 10\nHALT');
    expect(p.erros).toEqual([]);
    expect(p.variaveis.map(v => v.valores)).toEqual([[10], [20], [null], ['X = '], [8, 9, 10]]);
  });

  it('declara com D, D: 0 ou D: vazio', () => {
    const p = montar('D\nE: 0\nF: vazio\nLOAD R1, 3\nSTORE D, R1\nHALT');
    expect(p.erros).toEqual([]);
    expect(p.variaveis.map(v => [v.nome, v.valores])).toEqual([['D', [null]], ['E', [0]], ['F', [null]]]);
  });

  it('distingue rótulo (FIM:) de variável (X: 5)', () => {
    const p = montar('X: 5\nLOOP: LOAD R1, X\nJMP LOOP\nFIM:');
    expect(p.erros).toEqual([]);
    expect(p.rotulos).toEqual([{ nome: 'LOOP', end: 0 }, { nome: 'FIM', end: 2 }]);
  });

  it('segue o modelo RISC: memória só com LOAD/STORE, ULA só com registradores e constantes', () => {
    const erros = (c: string) => montar('X: 5\n' + c).erros;
    expect(erros('ADD R1, X').length).toBe(1);
    expect(erros('LOAD R1, R2').length).toBe(1);
    expect(erros('STORE X, 5').length).toBe(1);
    expect(erros('STORE R1, X').length).toBe(1);
    expect(erros('MOV R1, 5').length).toBe(1);
    expect(erros('OUT LED, 1').length).toBe(1);
    expect(erros('LOAD R8, X').length).toBe(1);
  });

  it('aponta a linha dos erros', () => {
    const p = montar('LOAD 3, R1\nXYZ R1\nADD R1\nJMP NADA\nLOAD R1, Q\nIN R1, PORTA');
    expect(p.erros.map(e => e.linha)).toEqual([1, 2, 3, 4, 5, 6]);
  });

  it('CALL imprime exige TEXTO na memória', () => {
    expect(montar('CALL imprime').erros.length).toBe(1);
    expect(montar('TEXTO: "oi"\nCALL imprime').erros).toEqual([]);
  });

  it('lista as portas de entrada usadas', () => {
    expect(montar('IN R1, A0\nIN R2, BOTAO\nIN R3, 7').entradasUsadas).toEqual(['BOTAO', 'A0', '7']);
  });
});

describe('Assembly simplificado — execução', () => {
  it('busca: PC → MAR → memória → MDR → IR; depois PC++', () => {
    const r = simular('LOAD R1, 2\nHALT');
    expect(r.passos.map(p => p.fase)).toEqual(['carga', 'busca', 'decodificacao', 'execucao', 'busca', 'decodificacao', 'fim']);
    const busca = r.passos[1];
    expect([busca.mar, busca.mdr, busca.ir, busca.pc]).toEqual([0, 'LOAD R1, 2', 'LOAD R1, 2', 1]);
  });

  it('rastreamento do slide 16 (X = X + 2): R1, X e uso da ULA', () => {
    const r = exemplo('x-mais-2');
    const ex = execucoes(r);
    expect(ex.map(p => p.regs.R1)).toEqual([5, 7, 7, 7, 7, 7, 7]);
    const endX = r.programa.variaveis[0].end - r.programa.inicioDados;
    expect(ex.map(p => p.dados[endX])).toEqual([5, 5, 7, 7, 7, 7, 7]);
    expect(ex.map(p => p.ula !== null)).toEqual([false, true, false, false, false, false, false]);
    expect(ultimo(r.passos).saida).toBe('X = 7\n');
  });

  it('LOAD de variável passa por MAR e MDR; LOAD de constante não', () => {
    const r = simular('X: 5\nLOAD R1, X\nLOAD R2, 3');
    const [l1, l2] = execucoes(r);
    expect([l1.mar, l1.mdr, l1.regs.R1]).toEqual([2, 5, 5]);
    expect(l1.acessos).toEqual([{ end: 2, tipo: 'leitura' }]);
    expect(l2.acessos).toEqual([]);
  });

  it('flags Z, N e C do CMP como na tabela do slide 8', () => {
    const flags = (a: number, b: number) => {
      const p = execucoes(simular(`LOAD R1, ${a}\nLOAD R2, ${b}\nCMP R1, R2`))[2];
      return [p.z, p.n, p.c, p.regs.R1];
    };
    expect(flags(5, 5)).toEqual([1, 0, 0, 5]);
    expect(flags(7, 5)).toEqual([0, 0, 0, 7]);
    expect(flags(3, 5)).toEqual([0, 1, 1, 3]);
  });

  it('exemplos do slide: resultados na memória', () => {
    expect(varFinal(exemplo('y-igual-x'), 'Y')).toBe(10);
    const xy = exemplo('x-mais-y');
    expect([varFinal(xy, 'X'), varFinal(xy, 'Y')]).toEqual([30, 21]);
    const ab = exemplo('a-vezes-b');
    expect([varFinal(ab, 'A'), varFinal(ab, 'B')]).toEqual([24, 27]);
    expect(varFinal(exemplo('a-expressao'), 'A')).toBe(31);
    expect(varFinal(exemplo('d-diferenca'), 'D')).toBe(10);
    expect(varFinal(exemplo('botao'), 'ESTADO')).toBe(1);
    expect(varFinal(exemplo('sensor'), 'VALOR')).toBe(512);
  });

  it('pisca o LED: pino 13 e tempo do DELAY', () => {
    const r = exemplo('pisca-led');
    const ex = execucoes(r);
    expect(ex[1].pinos[13]).toBe(1);
    expect(ultimo(r.passos).pinos[13]).toBe(0);
    expect(ultimo(r.passos).tempo).toBe(2000);
  });

  it('if do botão: acende com BOTAO = 1 e pula com BOTAO = 0', () => {
    const ex = EXEMPLOS_ASSEMBLY.find(e => e.id === 'if-botao')!;
    expect(ultimo(simular(ex.codigo, { BOTAO: 1 }).passos).pinos[13]).toBe(1);
    expect(ultimo(simular(ex.codigo, { BOTAO: 0 }).passos).pinos[13]).toBeUndefined();
  });

  it('for com LEDs: tabela do slide 38', () => {
    const r = exemplo('for-leds');
    const cmps = r.passos.filter(p => p.fase === 'execucao' && p.ir === 'CMP R1, 3');
    expect(cmps.map(p => [p.regs.R1, p.z, p.regs.R2])).toEqual([[0, 0, 0], [1, 0, 8], [2, 0, 9], [3, 1, 10]]);
    const acesos = r.passos.filter(p => p.fase === 'execucao' && p.ir === 'OUT R2, R3' && p.regs.R3 === 1).map(p => p.regs.R2);
    expect(acesos).toEqual([8, 9, 10]);
    expect(ultimo(r.passos).tempo).toBe(600);
    expect(r.erro).toBeNull();
  });

  it('erros de execução: memória vazia, divisão por zero, índice, pino e laço infinito', () => {
    expect(simular('Y: vazio\nLOAD R1, Y').erro?.msg).toContain('vazio');
    expect(simular('LOAD R1, 1\nDIV R1, 0').erro?.msg).toContain('zero');
    expect(simular('V: 1, 2\nLOAD R2, 5\nLOAD R1, V[R2]').erro?.msg).toContain('Índice');
    expect(simular('LOAD R2, 20\nLOAD R1, 1\nOUT R2, R1').erro?.msg).toContain('Pino');
    expect(simular('L: JMP L').erro?.msg).toContain(String(LIMITE_INSTRUCOES));
  });

  it('CALL e RET de sub-rotina usam a pilha (SP)', () => {
    const r = simular('CALL DOBRA\nOUT TELA, R1\nHALT\nDOBRA: LOAD R1, 21\nADD R1, R1\nRET');
    expect(r.programa.inicioPilha).toBe(6);
    const call = execucoes(r)[0];
    expect(call.sp).toBe(13);
    expect(call.dados[13 - 6]).toBe(1);
    expect(ultimo(r.passos).saida).toBe('42\n');
    expect(ultimo(r.passos).sp).toBe(14);
  });

  it('constante de caractere (slide 27): ADD R1, \'0\'', () => {
    expect(ultimo(simular("LOAD R1, 7\nADD R1, '0'").passos).regs.R1).toBe(55);
  });

  it('todos os exemplos executam sem erro', () => {
    for (const ex of EXEMPLOS_ASSEMBLY) {
      const r = simular(ex.codigo, ex.entradas);
      expect(r.programa.erros).withContext(ex.id).toEqual([]);
      expect(r.erro).withContext(ex.id).toBeNull();
    }
  });
});

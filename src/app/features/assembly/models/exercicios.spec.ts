import { EXERCICIOS, codigoInicial, conferirExercicio, conferirPergunta } from './exercicios';

const ex = (id: string) => EXERCICIOS.find(e => e.id === id)!;
const respostasCertas = (id: string) => Object.fromEntries((ex(id).perguntas ?? []).map(p => [p.id, p.resposta]));

describe('Exercícios', () => {
  it('a resposta de referência passa em todos os exercícios', () => {
    EXERCICIOS.forEach(e => {
      const c = conferirExercicio(e, e.gabarito ?? '', respostasCertas(e.id));
      expect(c.erros).withContext(e.id).toEqual([]);
      expect(c.ok).withContext(e.id + ': ' + c.itens.filter(i => !i.ok).map(i => i.texto).join('; ')).toBeTrue();
    });
  });

  it('as respostas não usam DIV, JL, JLE, RET nem NOP', () => {
    const fora = /^\s*(?:[A-Za-z_]\w*:\s*)?(DIV|JL|JLE|RET|NOP)\b/im;
    EXERCICIOS.forEach(e => {
      const asm = e.tipo === 'asm-para-c' ? e.codigo : e.gabarito ?? '';
      expect(fora.test(asm)).withContext(e.id).toBeFalse();
    });
  });

  it('exercícios novos: troca, if-else, while e assembly → C com laço', () => {
    expect(conferirExercicio(ex('troca'), 'A: 3\nB: 7\nC\nLOAD R1, A\nLOAD R2, B\nSTORE A, R2\nSTORE B, R1\nSTORE C, R1', {}).ok).toBeTrue();
    expect(conferirExercicio(ex('asm-para-c-laco'), 'int X = 1;\nfor (int i = 0; i < 3; i++) X = X * 2;', {}).ok).toBeTrue();
    expect(conferirExercicio(ex('asm-para-c-laco'), 'int X = 1;\nX = X * 2;', {}).ok).toBeFalse();
    const c = conferirExercicio(ex('sensor'), 'IN R1, A0\nCMP R1, 500\nJGE ACENDE\nJMP FIM\nACENDE: LOAD R2, 1\nOUT LED, R2\nFIM:', respostasCertas('sensor'));
    expect(c.itens.find(i => i.texto.startsWith('Com A0 = 500'))?.ok).toBeFalse();
  });

  it('aceita outra solução com o mesmo resultado (outros registradores, sem MOV)', () => {
    expect(conferirExercicio(ex('y-igual-x'), 'X: 10\nY\nLOAD R3, X\nSTORE Y, R3', {}).ok).toBeTrue();
    const soma = 'soma: 0\nLOAD R1, 0\nLOAD R2, 1\nL: CMP R2, 4\nJG F\nADD R1, R2\nADD R2, 1\nJMP L\nF: STORE soma, R1';
    expect(conferirExercicio(ex('for-soma'), soma, respostasCertas('for-soma')).ok).toBeTrue();
  });

  it('aponta o valor errado e o esperado', () => {
    const c = conferirExercicio(ex('a-expressao'), 'A: 8\nLOAD R1, A\nADD R1, 2\nMUL R1, 3\nSTORE A, R1', {});
    expect(c.ok).toBeFalse();
    expect(c.itens[0].texto).toBe('A = 30 (esperado: 31)');
  });

  it('confere cada valor de entrada no Arduino e as instruções pedidas', () => {
    const c = conferirExercicio(ex('if-botao'), 'IN R1, BOTAO\nLOAD R2, 1\nOUT LED, R2', respostasCertas('if-botao'));
    expect(c.ok).toBeFalse();
    expect(c.itens.find(i => i.texto.startsWith('Com BOTAO = 0'))?.ok).toBeFalse();
    expect(c.itens.find(i => i.texto.startsWith('Com BOTAO = 1'))?.ok).toBeTrue();
    expect(c.itens.some(i => !i.ok && i.texto.includes('CMP, JNE'))).toBeTrue();
  });

  it('assembly → C: o C do aluno é traduzido e executado', () => {
    expect(conferirExercicio(ex('asm-para-c'), 'int a = 8, b = 3;\na = a * b;\nb = b + a;', {}).ok).toBeTrue();
    expect(conferirExercicio(ex('asm-para-c'), 'int A = 8, B = 3;\nA = A * B;\nB = B + 1;', {}).ok).toBeFalse();
    const erro = conferirExercicio(ex('asm-para-c'), 'int A = 8\nA = 2;', {});
    expect(erro.erros[0].linha).toBe(2);
  });

  it('erro de montagem e resposta vazia', () => {
    expect(conferirExercicio(ex('a-expressao'), 'A: 8\nLOAD R9, A', {}).erros[0].linha).toBe(2);
    expect(conferirExercicio(ex('a-expressao'), '', {}).ok).toBeFalse();
    expect(codigoInicial(ex('asm-para-c'))).toContain('main');
  });

  it('perguntas: instruções, números, sim/não e flags', () => {
    const p = (id: string, q: string) => ex(id).perguntas!.find(x => x.id === q)!;
    expect(conferirPergunta(p('if-b-igual-2', 'ula'), 'cmp e sub')).toBeTrue();
    expect(conferirPergunta(p('if-b-igual-2', 'ula'), 'SUB')).toBeFalse();
    expect(conferirPergunta(p('if-b-igual-2', 'ula'), 'SUB, CMP, ADD')).toBeFalse();
    expect(conferirPergunta(p('cmp-flags', 'conta'), '−5')).toBeTrue();
    expect(conferirPergunta(p('cmp-flags', 'flags'), 'Z=0, N=1, C=1')).toBeTrue();
    expect(conferirPergunta(p('cmp-flags', 'flags'), '1 1 0')).toBeFalse();
    expect(conferirPergunta(p('cmp-flags', 'salto'), 'Não')).toBeTrue();
    expect(conferirPergunta(p('for-soma', 'voltas'), '4 vezes')).toBeTrue();
  });
});

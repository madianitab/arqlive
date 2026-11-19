import { agruparPorFase, celulasMemoria, cicloDoCodigo, registradoresUsados } from './ciclo';
import { EXEMPLOS_CICLO } from './exemplos-ciclo';

const ex = (id: string) => EXEMPLOS_CICLO.find(e => e.id === id)!.codigo;
const valor = (c: ReturnType<typeof cicloDoCodigo>, nome: string) => {
  const v = c.programa.variaveis.find(x => x.nome === nome)!;
  return c.micros[c.micros.length - 1].estado.dados[v.end - c.programa.inicioDados];
};

describe('Ciclo de instrução (micro-operações)', () => {
  it('todos os programas fixos montam, terminam sem erro e acabam no fim', () => {
    for (const e of EXEMPLOS_CICLO) {
      const c = cicloDoCodigo(e.codigo);
      expect(c.programa.erros).withContext(e.id).toEqual([]);
      expect(c.erro).withContext(e.id).toBeNull();
      expect(c.micros[0].fase).toBe('carga');
      expect(c.micros[c.micros.length - 1].fase).withContext(e.id).toBe('fim');
    }
  });

  it('busca: quatro micro-operações, com o estado mudando aos poucos', () => {
    const c = cicloDoCodigo(ex('x-mais-2'));
    const busca = c.micros.filter(m => m.ciclo === 1 && m.fase === 'busca');
    expect(busca.map(m => m.texto)).toEqual(['MAR ← PC', 'MDR ← M[MAR]', 'IR ← MDR', 'PC ← PC + 1']);
    expect(busca.map(m => [m.estado.mar, m.estado.mdr, m.estado.ir, m.estado.pc])).toEqual([
      [0, null, '', 0],
      [0, 'LOAD R1, X', '', 0],
      [0, 'LOAD R1, X', 'LOAD R1, X', 0],
      [0, 'LOAD R1, X', 'LOAD R1, X', 1],
    ]);
    expect(busca[1].memoria).toEqual({ end: 0, tipo: 'leitura' });
    expect(busca[1].fluxos).toEqual([{ de: 'MAR', para: 'MEM' }, { de: 'MEM', para: 'MDR' }]);
  });

  it('LOAD, ADD e STORE: micro-operações da execução', () => {
    const c = cicloDoCodigo(ex('x-mais-2'));
    const exec = (ciclo: number) => c.micros.filter(m => m.ciclo === ciclo && m.fase === 'execucao').map(m => m.texto);
    expect(exec(1)).toEqual(['MAR ← endereço de X', 'MDR ← M[MAR]', 'R1 ← MDR']);
    expect(exec(2)).toEqual(['ULA: R1 + 2', 'R1 ← resultado da ULA', 'Flags ← resultado da ULA']);
    expect(exec(3)).toEqual(['MAR ← endereço de X', 'MDR ← R1', 'M[MAR] ← MDR']);
    const ula = c.micros.find(m => m.ciclo === 2 && m.texto === 'ULA: R1 + 2')!;
    expect(ula.detalhe).toBe('5 + 2 = 7');
    expect(ula.estado.regs.R1).toBe(5);   // o R1 só muda na micro-operação seguinte
    const grava = c.micros.find(m => m.ciclo === 3 && m.texto === 'M[MAR] ← MDR')!;
    expect(grava.memoria).toEqual({ end: 4, tipo: 'escrita' });
    expect(grava.mudou).toEqual(['M4']);
    expect(valor(c, 'X')).toBe(7);
  });

  it('decodificação: a UC lê o IR', () => {
    const c = cicloDoCodigo(ex('x-mais-2'));
    const d = c.micros.find(m => m.ciclo === 2 && m.fase === 'decodificacao')!;
    expect(d.texto).toBe('UC decodifica o IR');
    expect(d.fluxos).toEqual([{ de: 'IR', para: 'UC' }]);
    expect(d.detalhe).toContain('ADD');
  });

  it('laço: o desvio muda o PC e a busca volta ao LOOP', () => {
    const c = cicloDoCodigo(ex('soma-for'));
    expect(valor(c, 'soma')).toBe(6);
    const voltas = c.micros.filter(m => m.texto === 'PC ← LOOP');
    expect(voltas.length).toBe(3);
    expect(voltas[0].fluxos).toEqual([{ de: 'IR', para: 'PC' }]);
    const testes = c.micros.filter(m => m.texto === 'UC testa as flags');
    expect(testes.length).toBe(4);   // 3 vezes não desvia, a última desvia
    expect(testes[3].detalhe).toContain('desvia');
    // depois do JMP LOOP, a busca seguinte lê o endereço do LOOP (2)
    const i = c.micros.indexOf(voltas[0]);
    const prox = c.micros.slice(i).find(m => m.fase === 'busca' && m.texto === 'MDR ← M[MAR]')!;
    expect(prox.memoria?.end).toBe(2);
  });

  it('if-else e while: valores finais', () => {
    expect(valor(cicloDoCodigo(ex('maior')), 'M')).toBe(9);
    expect(valor(cicloDoCodigo(ex('dobro-while')), 'V')).toBe(16);
    expect(valor(cicloDoCodigo(ex('c-igual-a-mais-b')), 'C')).toBe(7);
  });

  it('agrupa por fase: uma busca, uma decodificação e uma execução por instrução', () => {
    const c = cicloDoCodigo(ex('x-mais-2'));
    const f = agruparPorFase(c.micros);
    expect(f.map(m => m.fase)).toEqual([
      'carga',
      'busca', 'decodificacao', 'execucao',
      'busca', 'decodificacao', 'execucao',
      'busca', 'decodificacao', 'execucao',
      'busca', 'decodificacao', 'execucao', 'fim',
    ]);
    expect(f[1].mudou).toEqual(['MAR', 'MDR', 'IR', 'PC']);
  });

  it('memória e registradores do diagrama', () => {
    const c = cicloDoCodigo(ex('soma-for'));
    expect(registradoresUsados(c.programa)).toEqual(['R1', 'R2']);
    const cel = celulasMemoria(c.programa);
    expect(cel.find(x => x.end === 2)!.nome).toBe('LOOP');
    expect(cel.filter(x => x.tipo === 'dado').map(x => x.nome)).toEqual(['soma', 'i']);
  });
});

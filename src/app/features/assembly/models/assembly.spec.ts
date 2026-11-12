import { lerEntrada, montar, simular } from './assembly';
import { EXEMPLOS_ASSEMBLY } from './exemplos';
import { LIMITE_INSTRUCOES } from './instrucoes';

const ultimo = <T>(v: T[]) => v[v.length - 1];

describe('Assembly didático — montagem', () => {
  it('posiciona instruções a partir do 0 e variáveis logo depois', () => {
    const p = montar('X = 5\nY = 1, 2\nMOV A, X\nHLT');
    expect(p.erros).toEqual([]);
    expect(p.instrucoes.map(i => i.end)).toEqual([0, 1]);
    expect(p.inicioDados).toBe(2);
    expect(p.variaveis.map(v => [v.nome, v.end])).toEqual([['X', 2], ['Y', 3]]);
    expect(p.tamanhoMemoria).toBe(5);
  });

  it('aceita minúsculas, apelidos, comentários e rótulo na mesma linha', () => {
    const p = montar('inicio: mov a, 3 ; comentário\n  out a // outro\n  parar');
    expect(p.erros).toEqual([]);
    expect(p.instrucoes.map(i => i.texto)).toEqual(['MOV A, 3', 'ESCREVER A', 'HLT']);
    expect(p.rotulos).toEqual([{ nome: 'inicio', end: 0 }]);
  });

  it('aponta a linha dos erros', () => {
    const p = montar('MOV 3, A\nXYZ A\nADD A\nJMP nada\nMOV A, Q');
    expect(p.erros.map(e => e.linha)).toEqual([1, 2, 3, 4, 5]);
  });

  it('não aceita palavra reservada como variável nem nome repetido', () => {
    expect(montar('MOV = 1\nHLT').erros.length).toBe(1);
    expect(montar('X = 1\nX = 2\nHLT').erros.length).toBe(1);
  });

  it('aceita "fim" como rótulo', () => {
    expect(montar('JMP fim\nfim: HLT').erros).toEqual([]);
  });

  it('texto entre aspas só no ESCREVER', () => {
    expect(montar('ESCREVER "oi, tudo bem"\nHLT').erros).toEqual([]);
    expect(montar('MOV A, "x"').erros.length).toBe(1);
  });
});

describe('Assembly didático — execução', () => {
  it('cada instrução passa por busca, decodificação e execução', () => {
    const r = simular('MOV A, 2\nHLT');
    expect(r.passos.map(p => p.fase)).toEqual(['carga', 'busca', 'decodificacao', 'execucao', 'busca', 'decodificacao', 'fim']);
    const busca = r.passos[1];
    expect(busca.mar).toBe(0);
    expect(busca.ir).toBe('MOV A, 2');
    expect(busca.pc).toBe(1);
    expect(busca.mudou).toEqual(jasmine.arrayContaining(['PC', 'IR', 'MAR', 'MDR']));
  });

  it('leitura e escrita de variável passam pelo MAR e MDR', () => {
    const r = simular('X = 5\nR = 0\nMOV A, X\nADD A, 1\nMOV R, A\nHLT');
    const exec = r.passos.filter(p => p.fase === 'execucao');
    expect(exec[0].mar).toBe(4);
    expect(exec[0].mdr).toBe(5);
    expect(exec[0].regs.A).toBe(5);
    expect(exec[2].mar).toBe(5);
    expect(exec[2].dados).toEqual([5, 6]);
    expect(exec[2].mudou).toContain('M5');
    expect(exec[2].acessos).toEqual([{ end: 5, tipo: 'escrita' }]);
  });

  it('CMP atualiza Z e N, e os desvios seguem as flags', () => {
    const r = simular('MOV A, 3\nCMP A, 5\nJL menor\nESCREVER "não"\nHLT\nmenor: ESCREVER "sim"\nHLT');
    expect(ultimo(r.passos).saida).toEqual(['sim']);
    const cmp = r.passos.find(p => p.fase === 'execucao' && p.ir.startsWith('CMP'))!;
    expect([cmp.z, cmp.n]).toEqual([0, 1]);
  });

  it('vetor com índice em registrador', () => {
    const r = simular('V = 10, 20, 30\nMOV B, 2\nMOV A, V[B]\nESCREVER A\nHLT');
    expect(ultimo(r.passos).saida).toEqual(['30']);
  });

  it('LER usa a entrada em ordem e avisa quando falta', () => {
    expect(ultimo(simular('LER A\nLER B\nADD A, B\nESCREVER A\nHLT', [4, 6]).passos).saida).toEqual(['10']);
    const r = simular('LER A\nHLT', []);
    expect(r.erro?.msg).toContain('entrada');
    expect(r.erro?.linha).toBe(1);
  });

  it('divisão inteira, resto e divisão por zero', () => {
    expect(ultimo(simular('MOV A, 7\nDIV A, 2\nESCREVER A\nMOV B, 7\nMOD B, 2\nESCREVER B\nHLT').passos).saida).toEqual(['3', '1']);
    expect(simular('MOV A, 1\nDIV A, 0\nHLT').erro?.msg).toContain('zero');
  });

  it('índice fora do vetor é erro de execução', () => {
    expect(simular('V = 1, 2\nMOV B, 5\nMOV A, V[B]\nHLT').erro?.msg).toContain('Índice');
  });

  it('para no laço infinito', () => {
    const r = simular('laco: JMP laco');
    expect(r.erro?.msg).toContain(String(LIMITE_INSTRUCOES));
  });

  it('termina sem HLT quando o PC passa da última instrução', () => {
    const r = simular('MOV A, 1');
    expect(ultimo(r.passos).fase).toBe('fim');
    expect(r.erro).toBeNull();
  });

  it('os exemplos montam e executam sem erro', () => {
    for (const ex of EXEMPLOS_ASSEMBLY) {
      const r = simular(ex.codigo, lerEntrada(ex.entrada ?? '').valores);
      expect(r.programa.erros).withContext(ex.id).toEqual([]);
      expect(r.erro).withContext(ex.id).toBeNull();
    }
  });

  it('resultados dos exemplos', () => {
    const saida = (id: string) => {
      const ex = EXEMPLOS_ASSEMBLY.find(e => e.id === id)!;
      return ultimo(simular(ex.codigo, lerEntrada(ex.entrada ?? '').valores).passos).saida;
    };
    expect(saida('soma')).toEqual(['12']);
    expect(saida('maior')).toEqual(['O maior é A:', '8']);
    expect(saida('contar')).toEqual(['1', '2', '3', '4', '5']);
    expect(saida('vetor')).toEqual(['18']);
    expect(saida('fatorial')).toEqual(['120']);
    expect(saida('par')).toEqual(['ímpar']);
  });
});

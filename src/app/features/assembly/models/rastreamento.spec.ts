import { simular } from './assembly';
import { EXEMPLOS_ASSEMBLY } from './exemplos';
import { conferirCelula, gerarRastreamento } from './rastreamento';

const ex = (id: string) => EXEMPLOS_ASSEMBLY.find(e => e.id === id)!;
const rast = (codigo: string, entradas: Record<string, number> = {}) => gerarRastreamento(simular(codigo, entradas));

describe('Tabela de rastreamento', () => {
  it('X = X + 2: tabela esperada', () => {
    const r = rast(ex('x-mais-2').codigo);
    expect(r.inicial).toEqual(['X = 5', 'R1 vazio']);
    expect(r.colunas.map(c => c.id)).toEqual(['R1', 'M:X', 'ULA', 'Z', 'N', 'C', 'PROX']);
    const tab = r.linhas.map(l => [l.pc, l.ir, l.valores['R1'], l.valores['M:X'], l.valores['ULA']]);
    expect(tab).toEqual([
      [0, 'LOAD R1, X', '5', '5', 'não'],
      [1, 'ADD R1, 2', '7', '5', 'sim'],
      [2, 'STORE X, R1', '7', '7', 'não'],
      [3, 'CALL imprime', '7', '7', 'não'],
      [4, 'LOAD R1, X', '7', '7', 'não'],
      [5, 'OUT TELA, R1', '7', '7', 'não'],
      [6, 'HALT', '7', '7', 'não'],
    ]);
    expect(r.linhas.map(l => l.valores['PROX'])).toEqual(['1', '2', '3', '4', '5', '6', 'fim']);
  });

  it('for com LEDs: flag Z, pino em R2 e próximo PC', () => {
    const r = rast(ex('for-leds').codigo);
    const cmps = r.linhas.filter(l => l.ir === 'CMP R1, 3');
    expect(cmps.map(l => [l.valores['R1'], l.valores['Z']])).toEqual([['0', '0'], ['1', '0'], ['2', '0'], ['3', '1']]);
    const acende = r.linhas.filter(l => l.ir === 'OUT R2, R3' && l.valores['R3'] === '1');
    expect(acende.map(l => [l.valores['R2'], l.valores['PINOS']])).toEqual([['8', '8'], ['9', '9'], ['10', '10']]);
    expect(r.linhas.filter(l => l.ir === 'JE FIM').map(l => l.valores['PROX'])).toEqual(['3', '3', '3', 'fim']);
  });

  it('registrador fica vazio até receber valor', () => {
    const r = rast('X: 5\nY: vazio\nLOAD R2, X\nSTORE Y, R2\nLOAD R1, 1');
    expect(r.linhas[0].valores['R1']).toBe('');
    expect(r.linhas[0].valores['M:Y']).toBe('vazio');
    expect(r.linhas[2].valores['R1']).toBe('1');
  });

  it('confere as respostas sem ligar para espaços, maiúsculas e "vazio"', () => {
    const col = (id: string, tipo: 'texto' | 'simnao' | 'bit' = 'texto') => ({ id, titulo: id, tipo, dica: '' });
    expect(conferirCelula('7', ' 7 ', col('R1'))).toBeTrue();
    expect(conferirCelula('', 'vazio', col('R1'))).toBeTrue();
    expect(conferirCelula('', '', col('R1'))).toBeTrue();
    expect(conferirCelula('7', '8', col('R1'))).toBeFalse();
    expect(conferirCelula('sim', 'S', col('ULA', 'simnao'))).toBeTrue();
    expect(conferirCelula('8, 9, 10', '8,9,10', col('M:V'))).toBeTrue();
    expect(conferirCelula('LED', '13', col('PINOS'))).toBeTrue();
    expect(conferirCelula('fim', 'FIM', col('PROX'))).toBeTrue();
  });

  it('programa com erro de montagem não gera tabela', () => {
    expect(rast('LOAD R9, 1').linhas).toEqual([]);
  });
});

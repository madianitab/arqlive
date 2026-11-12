import { montar } from './assembly';
import { gerarCpp } from './cpp';
import { EXEMPLOS_ASSEMBLY } from './exemplos';

const cpp = (id: string) => gerarCpp(montar(EXEMPLOS_ASSEMBLY.find(e => e.id === id)!.codigo));

describe('Equivalente em C++', () => {
  it('programa de PC: main, printf e variáveis da memória', () => {
    const c = cpp('x-mais-2');
    expect(c).toContain('int main() {');
    expect(c).toContain('int X = 5;');
    expect(c).toContain('R1 = R1 + 2;');
    expect(c).toContain('printf("%s", TEXTO);');
  });

  it('programa de Arduino: setup, digitalRead/digitalWrite e if com goto', () => {
    const c = cpp('if-botao');
    expect(c).toContain('void setup() {');
    expect(c).toContain('R1 = digitalRead(BOTAO);');
    expect(c).toContain('if (R1 != 1) goto FIM;');
    expect(c).toContain('digitalWrite(LED_BUILTIN, R2);');
  });

  it('vetor, laço e delay', () => {
    const c = cpp('for-leds');
    expect(c).toContain('int LED[] = {8, 9, 10};');
    expect(c).toContain('R2 = LED[R1];');
    expect(c).toContain('delay(200);');
    expect(c).toContain('goto LOOP;');
  });

  it('variável vazia vira declaração sem valor', () => {
    expect(gerarCpp(montar('D\nLOAD R1, 1\nSTORE D, R1'))).toContain('int D;');
  });
});

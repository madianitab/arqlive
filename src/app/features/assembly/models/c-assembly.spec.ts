import { simular, textoValor } from './assembly';
import { traduzirParaAssembly } from './c-assembly';
import { EXEMPLOS_C } from './exemplos-c';

/** Assembly sem comentários, linha a linha (sem espaços nas pontas). */
const asm = (c: string) => traduzirParaAssembly(c, { comentarios: false }).codigo.split('\n').map(l => l.trim()).filter(Boolean);

/** Traduz, executa no simulador e devolve a memória final (nome → valor) e a TELA. */
function rodar(c: string, entradas: Record<string, number> = {}) {
  const t = traduzirParaAssembly(c);
  expect(t.erros).withContext(c).toEqual([]);
  const ex = simular(t.codigo, entradas);
  expect(ex.programa.erros).withContext(t.codigo).toEqual([]);
  expect(ex.erro).withContext(t.codigo).toBeNull();
  const f = ex.passos[ex.passos.length - 1];
  const mem: Record<string, string> = {};
  ex.programa.variaveis.forEach(v => {
    mem[v.nome] = v.valores.map((_, k) => textoValor(f.dados[v.end + k - ex.programa.inicioDados])).join(',');
  });
  return { mem, saida: f.saida, pinos: f.pinos, codigo: t.codigo };
}

describe('Tradutor C → Assembly (respostas dos slides)', () => {
  it('X = X + 2 com printf (Aula 14, slide 14)', () => {
    expect(asm('main(){\n int X = 5;\n X = X + 2;\n printf("X = %d", X);\n}')).toEqual([
      'X: 5', 'TEXTO: "X = "',
      'LOAD R1, X', 'ADD R1, 2', 'STORE X, R1',
      'CALL imprime', 'LOAD R1, X', 'OUT TELA, R1', 'HALT',
    ]);
  });

  it('X = X + Y; Y++ reaproveita o Y que está em R2 (slide 20)', () => {
    expect(asm('int X = 10, Y = 20;\nX = X + Y;\nY++;')).toEqual([
      'X: 10', 'Y: 20', 'LOAD R1, X', 'LOAD R2, Y', 'ADD R1, R2', 'STORE X, R1', 'ADD R2, 1', 'STORE Y, R2',
    ]);
  });

  it('A = A * 3 + 2 + 5 (slide 22)', () => {
    expect(asm('int A = 8;\nA = A * 3 + 2 + 5;')).toEqual(['A: 8', 'LOAD R1, A', 'MUL R1, 3', 'ADD R1, 2', 'ADD R1, 5', 'STORE A, R1']);
  });

  it('D = T - L; D = D * 2 com um STORE só (slide 24)', () => {
    expect(asm('int T = 30, L = 25;\nint D = T - L;\nD = D * 2;')).toEqual([
      'T: 30', 'L: 25', 'D: vazio', 'LOAD R1, T', 'LOAD R2, L', 'SUB R1, R2', 'MUL R1, 2', 'STORE D, R1',
    ]);
  });

  it('A = A * B; B = B + A (slide 26)', () => {
    expect(asm('int A = 8, B = 3;\nA = A * B;\nB = B + A;')).toEqual([
      'A: 8', 'B: 3', 'LOAD R1, A', 'LOAD R2, B', 'MUL R1, R2', 'STORE A, R1', 'ADD R2, R1', 'STORE B, R2',
    ]);
  });

  it('if vira CMP + JNE (Aula 15, slide 4)', () => {
    expect(asm('int A = 4, B = 6;\nB = B - A;\nif (B == 2) { A = B; }')).toEqual([
      'A: 4', 'B: 6', 'LOAD R1, B', 'LOAD R2, A', 'SUB R1, R2', 'STORE B, R1', 'CMP R1, 2', 'JNE FIM', 'STORE A, R1', 'FIM:',
    ]);
  });

  it('for com soma: variáveis presas em registradores (Aula 15, slide 15)', () => {
    expect(asm('int soma = 0;\nfor (int i = 1; i <= 4; i++)\n  soma = soma + i;')).toEqual([
      'soma: 0', 'i: 1', 'LOAD R1, soma', 'LOAD R2, i',
      'LOOP:', 'CMP R2, 4', 'JG FIM', 'ADD R1, R2', 'ADD R2, 1', 'JMP LOOP', 'FIM:', 'STORE soma, R1',
    ]);
  });

  it('for com LEDs: vetor com índice no registrador (Aula 15, slide 16)', () => {
    expect(asm('int leds[] = {8, 9, 10};\nfor (int i = 0; i < 3; i++) {\n digitalWrite(leds[i], HIGH);\n delay(200);\n digitalWrite(leds[i], LOW);\n}')).toEqual([
      'leds: 8, 9, 10', 'i: 0', 'LOAD R1, i',
      'LOOP:', 'CMP R1, 3', 'JGE FIM', 'LOAD R2, leds[R1]', 'LOAD R3, 1', 'OUT R2, R3', 'DELAY 200', 'LOAD R3, 0', 'OUT R2, R3',
      'ADD R1, 1', 'JMP LOOP', 'FIM:',
    ]);
  });

  it('Arduino: digitalWrite, digitalRead e analogRead (Aula 15, slides 7 a 11)', () => {
    expect(asm('digitalWrite(led, HIGH);\ndelay(1000);\ndigitalWrite(led, LOW);')).toEqual(['LOAD R1, 1', 'OUT LED, R1', 'DELAY 1000', 'LOAD R1, 0', 'OUT LED, R1']);
    expect(asm('int estado;\nestado = digitalRead(botao);')).toEqual(['estado: vazio', 'IN R1, BOTAO', 'STORE estado, R1']);
    expect(asm('int valor;\nvalor = analogRead(A0);')).toEqual(['valor: vazio', 'IN R1, A0', 'STORE valor, R1']);
    expect(asm('if (digitalRead(botao) == HIGH) {\n digitalWrite(led, HIGH);\n}')).toEqual([
      'IN R1, BOTAO', 'CMP R1, 1', 'JNE FIM', 'LOAD R1, 1', 'OUT LED, R1', 'FIM:',
    ]);
  });

  it('setup/loop: número de pino não vai para a memória e pinMode não gera instrução', () => {
    const t = traduzirParaAssembly('int led = 13;\nvoid setup() { pinMode(led, OUTPUT); }\nvoid loop() { digitalWrite(led, HIGH); }');
    expect(t.arduino).toBeTrue();
    expect(asm('int led = 13;\nvoid setup() { pinMode(led, OUTPUT); }\nvoid loop() { digitalWrite(led, HIGH); }')).toEqual(['LOAD R1, 1', 'OUT LED, R1']);
    expect(t.avisos.length).toBe(1);
  });
});

describe('Tradutor C → Assembly (execução no simulador)', () => {
  it('todos os exemplos traduzem e executam sem erro', () => {
    EXEMPLOS_C.forEach(e => rodar(e.codigo, e.entradas));
  });

  it('valores finais dos exemplos dos slides', () => {
    const ex = (id: string) => EXEMPLOS_C.find(e => e.id === id)!;
    expect(rodar(ex('x-mais-2').codigo).saida).toBe('X = 7\n');
    expect(rodar(ex('d-diferenca').codigo).mem['D']).toBe('10');
    expect(rodar(ex('x-vezes-3').codigo).mem['X']).toBe('11');
    expect(rodar(ex('if-b-igual-2').codigo).mem).toEqual(jasmine.objectContaining({ A: '2', B: '2' }));
    expect(rodar(ex('for-soma').codigo).mem['soma']).toBe('10');
    expect(rodar(ex('if-botao').codigo, { BOTAO: 1 }).pinos[13]).toBe(1);
  });

  it('if-else, while, %, && e ||', () => {
    const r = rodar(`int main() {
  int n = 7, par, i = 0, fat = 1, r = 0;
  if (n % 2 == 0) par = 1; else par = 0;
  while (i < 5) { i++; fat = fat * i; }
  if (n > 5 && n != 6) r = r + 1;
  if (n < 2 || n > 6) r = r + 10;
  printf("%d", fat);
  return 0;
}`);
    expect(r.mem).toEqual(jasmine.objectContaining({ par: '0', i: '5', fat: '120', r: '11' }));
    expect(r.saida).toBe('120\n');
  });

  it('do-while, break, continue, vetor e laços aninhados', () => {
    expect(rodar('int x = 10, k = 0;\ndo { x = x - 3; k++; } while (x > 0);').mem).toEqual(jasmine.objectContaining({ x: '-2', k: '4' }));
    expect(rodar('int n = 0;\nwhile (1) { n = n + 3; if (n > 10) break; }').mem['n']).toBe('12');
    expect(rodar('int s = 0;\nfor (int i = 0; i < 6; i++) { if (i % 2 == 1) continue; s = s + i; }').mem['s']).toBe('6');
    expect(rodar('int V[4];\nfor (int i = 0; i < 4; i++) V[i] = i * 2;').mem['V']).toBe('0,2,4,6');
    expect(rodar('int c = 0;\nfor (int i = 0; i < 3; i++)\n  for (int j = 0; j < 2; j++) c++;').mem['c']).toBe('6');
  });

  it('#define, const, números negativos e cout', () => {
    expect(rodar('#define QTD 3\nconst int LIM = 2;\nint c = 0;\nfor (int i = 0; i < QTD; i++) if (i < LIM) c++;').mem['c']).toBe('2');
    expect(rodar('int a = 5, b;\nb = -a + 2;').mem['b']).toBe('-3');
    expect(rodar('int main(){ int a = 3; cout << "a = " << a * 2 << endl; }').saida).toBe('a = 6\n');
  });
});

describe('Tradutor C → Assembly (erros e avisos)', () => {
  const erro = (c: string) => traduzirParaAssembly(c).erros[0];

  it('aponta a linha do erro', () => {
    expect(erro('int X = 1;\nY = X + 1;')).toEqual(jasmine.objectContaining({ linha: 2 }));
    expect(erro('int X = 1\nX = 2;').msg).toContain(';');
    expect(erro('int dobro(int x) { return x * 2; }').msg).toContain('dobro');
    expect(erro('float x = 2;\nprintf("%f", x);').msg).toContain('%f');
  });

  it('renomeia variáveis que colidem com palavras reservadas ou com maiúsculas/minúsculas', () => {
    const t = traduzirParaAssembly('int add = 3, x = 1, X = 2;\nadd = add + x + X;');
    expect(t.avisos.length).toBe(2);
    expect(t.codigo).toContain('add_: 3');
    expect(t.codigo).toContain('X_: 2');
  });

  it('avisa quando há mais de um texto de printf (o simulador tem um TEXTO só)', () => {
    const t = traduzirParaAssembly('int a = 1;\nprintf("a = %d", a);\nprintf("b = %d", a);');
    expect(t.avisos.some(a => a.includes('b = '))).toBeTrue();
  });
});

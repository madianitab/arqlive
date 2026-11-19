# ArqLive

> Para alterar o projeto, leia também o [Guia de desenvolvimento](GUIA_DESENVOLVIMENTO.md): padrões, design system, convenções conceituais e fluxo de entrega.

Simulador didático de Arquitetura e Organização de Computadores. O aluno escreve um programa no Assembly simplificado das aulas (PC e Arduino) e acompanha a execução, passo a passo: ciclo de instrução (busca, decodificação e execução), registradores (PC, IR, MAR, MDR, SP, R0 a R7), ULA, flags Z/N/C, memória, portas de I/O (LED, botão, sensor) e tela.

| Assunto | Modo | Rota | Pasta |
|---|---|---|---|
| Assembly | Simulador de Assembly (passo a passo) | `#/assembly/simulador` | `src/app/features/assembly/simulador` |
| Assembly | Executor Assembly (executa e mostra o resultado e o C++ equivalente) | `#/assembly/executor` | `src/app/features/assembly/executor` |
| Assembly | Tradutor C → Assembly (escreve em C/C++ e vê o Assembly simplificado correspondente) | `#/assembly/tradutor` | `src/app/features/assembly/tradutor` |
| Assembly | Exercícios das Aulas 14 e 15 (escreve o assembly ou o C, responde às perguntas e confere) | `#/assembly/exercicios` | `src/app/features/assembly/exercicios` |

Em cada assunto, `models/` e `services/` ficam na raiz da pasta e são compartilhados entre os modos.

Aplicação Angular 18, sem backend: tudo roda no navegador.

## O assembly do simulador

É o **Assembly simplificado** das aulas de Arquitetura II (Aula 14, "Do C++ ao Assembly"), no modelo RISC do AVR do Arduino: só `LOAD` e `STORE` acessam a memória, e a ULA trabalha com registradores e constantes. **O destino vem sempre primeiro**, inclusive em `OUT porta, R1`.

```asm
; main(){ int X = 5; X = X + 2; printf("X = %d", X); }

; memória
X: 5
TEXTO: "X = "      ; texto do printf (usado pelo CALL imprime)

; x = x + 2
LOAD R1, X         ; lê da memória (R1 = X)
ADD R1, 2          ; soma 2 (R1 = R1 + 2)
STORE X, R1        ; grava na memória (X = R1)

; impressão
CALL imprime       ; exibe o texto "X = "
LOAD R1, X         ; lê X da memória de novo
OUT TELA, R1       ; exibe o conteúdo do R1
HALT               ; encerra o programa
```

| Instrução | O que faz | C++ |
|---|---|---|
| `LOAD R1, X` | lê da memória (ou uma constante) para R1 | `R1 = X;` `R1 = 1;` |
| `STORE X, R1` | grava R1 na memória, em X | `X = R1;` |
| `MOV R2, R1` | copia entre registradores | `R2 = R1;` |
| `ADD` / `SUB` / `MUL R1, R2` | calcula na ULA, guarda em R1 e atualiza as flags | `R1 = R1 + R2;` |
| `CMP R1, R2` | compara (R1 − R2, sem guardar) e atualiza as flags Z, N e C | `if (R1 == R2)` |
| `JMP` / `JE` / `JNE ROTULO` | muda o PC: sempre / se igual / se diferente | `if`, `for`, `while` |
| `JG` / `JGE ROTULO` | muda o PC: se maior / se maior ou igual (Aula 15) | `if (a > b)`, `if (a >= b)` |
| `IN R1, BOTAO` | lê um pino ou sensor (`BOTAO`, `A0`…`A5`, número do pino) | `R1 = digitalRead(p);` |
| `OUT LED, R1` | envia R1 para a porta (`LED` = pino 13, `TELA`, número do pino ou `OUT R2, R3`) | `digitalWrite(p, R1);` |
| `DELAY 1000` | pausa em ms | `delay(1000);` |
| `CALL imprime` | exibe na TELA a variável `TEXTO` | `printf(...)` |
| `HALT` | encerra o programa | |

**Acréscimos do simulador** (não estão nos slides): `DIV`, `JL`, `JLE`, `CALL rótulo` / `RET` com pilha (SP) e `NOP`.

- **Registradores:** `R0` a `R7`; **UC:** PC, IR, MAR, MDR e SP; **flags:** Z (zero), N (negativo) e C (carry, “empresta 1”).
- **Memória:** `X: 5`, `Y: vazio` (ou só `Y`), vetor `LED: 8, 9, 10` (acesso `LED[R1]`), texto `TEXTO: "X = "`; também `X: 10 e Y: 20`.
- **Constantes:** decimal, `'0'` (código ASCII), `HIGH` e `LOW`. **Rótulos:** `LOOP:`. **Comentários:** `;`.
- A lista completa está em `src/app/features/assembly/models/instrucoes.ts`.

## Tabela de rastreamento

No Simulador de Assembly, abaixo da execução, a **tabela de rastreamento** das atividades dos slides (Aula 14, slides 15 e 16; Aula 15, slides 18 e 19): uma linha por instrução executada, com PC, IR, os registradores usados, as variáveis na memória, "Usou a ULA?", as flags Z, N e C, os pinos em HIGH (se houver) e o próximo PC, sempre com os valores **depois** da instrução.

- **Acompanhar:** a tabela é preenchida junto com a execução, destacando a instrução atual.
- **Exercício:** PC e IR vêm prontos; o aluno preenche o resto, clica em **Conferir** (células certas em verde, erradas em vermelho, com o placar) e pode **mostrar a resposta**. Até 30 instruções.

## Exercícios

Os exercícios das Aulas 14 e 15 ("Do C++ ao Assembly") — os dos slides e outros no mesmo estilo (marcados como "prática"), só com as instruções das aulas: traduzir C → assembly, assembly → C (slide 25 da Aula 14), prever flags e responder às perguntas dos slides ("quais instruções usam a ULA?", "quanto vale soma no final?"). O aluno clica em **Conferir** (ou Ctrl + Enter) e vê o que está certo e o que está errado; **Ver resposta** mostra a resposta do slide.

A conferência **não compara o texto**: executa a resposta do aluno e a do slide e compara o resultado (valores finais das variáveis, TELA, sequência de LEDs e tempo de DELAY). Assim, uma solução com outros registradores também está certa. Nos exercícios de Arduino, confere cada valor de entrada (ex.: BOTAO = 0 e BOTAO = 1). Quando o enunciado pede instruções ("use SUB"), confere se foram usadas. No assembly → C, o C do aluno passa pelo tradutor e é executado.

Os exercícios ficam em `src/app/features/assembly/models/exercicios.ts`; para criar um novo, basta acrescentar um item na lista `EXERCICIOS`.

## Tradutor C → Assembly

O aluno escreve em C/C++ (PC ou Arduino) e vê, ao lado, o Assembly simplificado correspondente, no estilo das respostas dos slides (Aulas 14 e 15). A tradução é refeita a cada tecla, o assembly é executado no simulador para mostrar o resultado, e o botão **Abrir no executor** leva o código para o Executor.

```c
int soma = 0;                         soma: 0
for (int i = 1; i <= 4; i++)          i: 1
    soma = soma + i;                  LOAD R1, soma
                                      LOAD R2, i
                                      LOOP:
                                        CMP R2, 4
                                        JG FIM
                                        ADD R1, R2
                                        ADD R2, 1
                                        JMP LOOP
                                      FIM:
                                      STORE soma, R1
```

- **Aceita:** `int` (e vetores), `#define`, `const`, `+ - * / %`, `if`/`else`, `for`, `while`, `do-while`, `break`, `continue`, `&&`, `||`, `!`, `printf`/`cout`/`Serial.print`, `digitalWrite`, `digitalRead`, `analogRead`, `delay` e `pinMode`; código solto, `main()` ou `setup()`/`loop()`.
- **Não aceita:** funções próprias, `float`/`double` (viram inteiros), ponteiros e `switch`.
- A lógica fica em `src/app/features/assembly/models/c-assembly.ts`; os exemplos, em `models/exemplos-c.ts`.

## Executar localmente

Requer Node.js 18.19+ (recomendado 20).

```bash
npm install
npm start
# acesse http://localhost:4200
```

## Testes

```bash
npm test -- --watch=false
```

## Build

```bash
npm run build
# saída em dist/arqlive
```

## Publicação

O deploy no GitHub Pages é automático a cada push na branch `main`
(workflow em `.github/workflows/deploy.yml`).
Em *Settings → Pages*, a opção *Source* deve estar em **GitHub Actions**.
O site fica em `https://<usuário>.github.io/arqlive/`.

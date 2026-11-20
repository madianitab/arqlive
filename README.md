# ArqLive

> Para alterar o projeto, leia também o [Guia de desenvolvimento](GUIA_DESENVOLVIMENTO.md): padrões, design system, convenções conceituais e fluxo de entrega.

Simulador didático de Arquitetura e Organização de Computadores. O aluno escreve um programa no Assembly simplificado (PC e Arduino) e acompanha a execução, passo a passo: ciclo de instrução (busca, decodificação e execução), registradores (PC, IR, MAR, MDR, SP, R0 a R7), ULA, flags Z/N/C, memória, portas de I/O (LED, botão, sensor) e tela.

| Assunto | Modo | Rota | Pasta |
|---|---|---|---|
| Assembly | Simulador de Assembly (passo a passo) | `#/assembly/simulador` | `src/app/features/assembly/simulador` |
| Assembly | Ciclo de instrução (busca, decodificação e execução em micro-operações, com programas fixos) | `#/assembly/ciclo` | `src/app/features/assembly/ciclo` |
| Assembly | Executor Assembly (executa e mostra o resultado e o C++ equivalente) | `#/assembly/executor` | `src/app/features/assembly/executor` |
| Assembly | Tradutor C → Assembly (escreve em C/C++ e vê o Assembly simplificado correspondente) | `#/assembly/tradutor` | `src/app/features/assembly/tradutor` |
| Assembly | Exercícios (escreve o assembly ou o C, responde às perguntas e confere) | `#/assembly/exercicios` | `src/app/features/assembly/exercicios` |

Em cada assunto, `models/` e `services/` ficam na raiz da pasta e são compartilhados entre os modos.

Aplicação Angular 18, sem backend: tudo roda no navegador.

## O assembly do simulador

É o **Assembly simplificado** do ArqLive, no modelo RISC do AVR do Arduino: só `LOAD` e `STORE` acessam a memória, e a ULA trabalha com registradores e constantes. **O destino vem sempre primeiro**, inclusive em `OUT porta, R1`.

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
| `ADD` / `SUB` / `MUL` / `DIV R1, R2` | calcula na ULA, guarda em R1 e atualiza as flags (`DIV`: divisão inteira) | `R1 = R1 + R2;` |
| `CMP R1, R2` | compara (R1 − R2, sem guardar) e atualiza as flags Z, N e C | `if (R1 == R2)` |
| `JMP` / `JE` / `JNE ROTULO` | muda o PC: sempre / se igual / se diferente | `if`, `for`, `while` |
| `JG` / `JGE` / `JL` / `JLE ROTULO` | muda o PC: se maior / maior ou igual / menor / menor ou igual | `if (a > b)`, `if (a <= b)`… |
| `IN R1, BOTAO` | lê um pino ou sensor (`BOTAO`, `A0`…`A5`, número do pino) | `R1 = digitalRead(p);` |
| `OUT LED, R1` | envia R1 para a porta (`LED` = pino 13, `TELA`, número do pino ou `OUT R2, R3`) | `digitalWrite(p, R1);` |
| `DELAY 1000` | pausa em ms | `delay(1000);` |
| `CALL imprime` | exibe na TELA a variável `TEXTO` | `printf(...)` |
| `CALL rótulo` / `RET` | chama uma sub-rotina e volta (usa a pilha, SP) | função |
| `NOP` | não faz nada | `;` |
| `HALT` | encerra o programa | |

- **Registradores:** `R0` a `R7`; **UC:** PC, IR, MAR, MDR e SP; **flags:** Z (zero), N (negativo) e C (carry, “empresta 1”).
- **Memória:** `X: 5`, `Y: vazio` (ou só `Y`), vetor `LED: 8, 9, 10` (acesso `LED[R1]`), texto `TEXTO: "X = "`; também `X: 10 e Y: 20`.
- **Constantes:** decimal, `'0'` (código ASCII), `HIGH` e `LOW`. **Rótulos:** `LOOP:`. **Comentários:** `;`.
- A lista completa está em `src/app/features/assembly/models/instrucoes.ts`.

## Tabela de rastreamento

No Simulador de Assembly, abaixo da execução, a **tabela de rastreamento**: uma linha por instrução executada, com PC, IR, os registradores usados, as variáveis na memória, "Usou a ULA?", as flags Z, N e C, os pinos em HIGH (se houver) e o próximo PC, sempre com os valores **depois** da instrução.

- **Acompanhar:** a tabela é preenchida junto com a execução, destacando a instrução atual.
- **Exercício:** PC e IR vêm prontos; o aluno preenche o resto, clica em **Conferir** (células certas em verde, erradas em vermelho, com o placar) e pode **mostrar a resposta**. Até 30 instruções.

## Ciclo de instrução

Tela limpa, com foco no ciclo **busca → decodificação → execução**. O aluno escolhe um programa fixo (sem laço, com desvio ou com laço) e avança **uma micro-operação por vez** ou **uma fase por vez**. Dois painéis lado a lado (um embaixo do outro em telas estreitas; no celular, a memória fica embaixo da CPU):

- **Fluxograma do ciclo:** buscar a próxima instrução → incrementar o PC → decodificar → **tem operando?** (sim: cálculo do endereço do operando → buscar e armazenar operando → volta à pergunta) → executar a operação → escrever o resultado → volta para a busca. A caixa da etapa atual fica acesa e pulsa, o traço corre pela ligação percorrida e as caixas já feitas na instrução ficam marcadas, com a cor da fase (busca, decodificação, execução).
- **CPU e memória:** cartões com o nome e o valor — registradores usados, ULA, flags, MDR, MAR, PC, IR, decodificador e unidade de controle, ligados por um barramento — e a memória como tabela "Endereço | Conteúdo" (instruções e variáveis). As partes envolvidas na micro-operação acendem e a seta mostra o caminho do dado (ex.: MAR → memória → MDR).
- **Topo:** instrução atual, fase, micro-operação (`MAR ← PC`, `MDR ← M[MAR]`…) com a explicação e os valores, e os controles: reproduzir, passo a passo, "Próxima instrução" e teclado (← → passo, espaço reproduz, ↓ próxima instrução). O código fica na lateral, com a linha atual destacada.

As micro-operações (e a etapa do fluxograma de cada uma) são geradas em `src/app/features/assembly/models/ciclo.ts`, a partir da execução do simulador; os programas ficam em `models/exemplos-ciclo.ts`.

## Exercícios

Exercícios agrupados por assunto (memória e contas, desvios e flags, laços, Arduino, assembly → C): traduzir C → assembly, assembly → C, prever flags e responder a perguntas ("quais instruções usam a ULA?", "quanto vale soma no final?"). O aluno clica em **Conferir** (ou Ctrl + Enter) e vê o que está certo e o que está errado; **Ver resposta** mostra uma resposta certa.

A conferência **não compara o texto**: executa a resposta do aluno e a de referência e compara o resultado (valores finais das variáveis, TELA, sequência de LEDs e tempo de DELAY). Assim, uma solução com outros registradores também está certa. Nos exercícios de Arduino, confere cada valor de entrada (ex.: BOTAO = 0 e BOTAO = 1). Quando o enunciado pede instruções ("use SUB"), confere se foram usadas. No assembly → C, o C do aluno passa pelo tradutor e é executado.

Os exercícios ficam em `src/app/features/assembly/models/exercicios.ts`; para criar um novo, basta acrescentar um item na lista `EXERCICIOS`.

## Tradutor C → Assembly

O aluno escreve em C/C++ (PC ou Arduino) e vê, ao lado, o Assembly simplificado correspondente. A tradução é refeita a cada tecla, o assembly é executado no simulador para mostrar o resultado, e o botão **Abrir no executor** leva o código para o Executor.

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

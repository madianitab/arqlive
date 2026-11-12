# ArqLive

> Para alterar o projeto, leia também o [Guia de desenvolvimento](GUIA_DESENVOLVIMENTO.md): padrões, design system, convenções conceituais e fluxo de entrega.

Simulador didático de Arquitetura e Organização de Computadores. O aluno escreve um programa no Assembly simplificado das aulas (PC e Arduino) e acompanha a execução, passo a passo: ciclo de instrução (busca, decodificação e execução), registradores (PC, IR, MAR, MDR, SP, R0 a R7), ULA, flags Z/N/C, memória, portas de I/O (LED, botão, sensor) e tela.

| Assunto | Modo | Rota | Pasta |
|---|---|---|---|
| Assembly | Simulador de Assembly | `#/assembly/simulador` | `src/app/features/assembly/simulador` |

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
| `IN R1, BOTAO` | lê um pino ou sensor (`BOTAO`, `A0`…`A5`, número do pino) | `R1 = digitalRead(p);` |
| `OUT LED, R1` | envia R1 para a porta (`LED` = pino 13, `TELA`, número do pino ou `OUT R2, R3`) | `digitalWrite(p, R1);` |
| `DELAY 1000` | pausa em ms | `delay(1000);` |
| `CALL imprime` | exibe na TELA a variável `TEXTO` | `printf(...)` |
| `HALT` | encerra o programa | |

**Acréscimos do simulador** (não estão no slide): `DIV`, `JG`, `JGE`, `JL`, `JLE`, `CALL rótulo` / `RET` com pilha (SP) e `NOP`.

- **Registradores:** `R0` a `R7`; **UC:** PC, IR, MAR, MDR e SP; **flags:** Z (zero), N (negativo) e C (carry, “empresta 1”).
- **Memória:** `X: 5`, `Y: vazio`, vetor `LED: 8, 9, 10` (acesso `LED[R1]`), texto `TEXTO: "X = "`; também `X: 10 e Y: 20`.
- **Constantes:** decimal, `'0'` (código ASCII), `HIGH` e `LOW`. **Rótulos:** `LOOP:`. **Comentários:** `;`.
- A lista completa está em `src/app/features/assembly/models/instrucoes.ts`.

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

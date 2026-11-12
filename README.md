# ArqLive

> Para alterar o projeto, leia também o [Guia de desenvolvimento](GUIA_DESENVOLVIMENTO.md): padrões, design system, convenções conceituais e fluxo de entrega.

Simulador didático de Arquitetura e Organização de Computadores. O aluno escreve um programa em assembly e acompanha a execução, passo a passo: ciclo de instrução (busca, decodificação e execução), registradores (PC, IR, MAR, MDR, A, B, C, D), flags, memória e saída.

| Assunto | Modo | Rota | Pasta |
|---|---|---|---|
| Assembly | Simulador de Assembly | `#/assembly/simulador` | `src/app/features/assembly/simulador` |

Em cada assunto, `models/` e `services/` ficam na raiz da pasta e são compartilhados entre os modos.

Aplicação Angular 18, sem backend: tudo roda no navegador.

## O assembly do simulador

```asm
; Soma X + Y e guarda em R
.DADOS
    X = 5
    Y = 7
    R = 0

.CODIGO
    MOV A, X        ; A recebe X
    ADD A, Y        ; A = A + Y
    MOV R, A        ; guarda o resultado em R
    ESCREVER R
    HLT
```

| Grupo | Instruções |
|---|---|
| Dados | `MOV destino, origem` |
| Aritmética | `ADD`, `SUB`, `MUL`, `DIV` (inteira), `MOD` (resto), `INC`, `DEC` |
| Comparação e desvio | `CMP a, b`, `JMP`, `JE`/`JZ`, `JNE`/`JNZ`, `JG`, `JGE`, `JL`, `JLE` |
| Entrada e saída | `LER destino`, `ESCREVER origem` ou `ESCREVER "texto"` |
| Controle | `NOP`, `HLT` |

- **Registradores de uso geral:** `A`, `B`, `C`, `D`. **Flags:** `Z` (zero) e `N` (negativo).
- **Operandos:** registrador, variável, posição de vetor (`V[B]` ou `V[2]`) ou número (decimal, `0x…`, `0b…`).
- **Variáveis:** `X = 5`, vetor `V = 3, 8, 1`, sem valor inicial `T = ?`. As seções `.DADOS` e `.CODIGO` são opcionais.
- **Rótulos:** `laco:` (sozinho na linha ou antes de uma instrução). **Comentários:** `;` ou `//`.
- Maiúsculas e minúsculas tanto faz. A lista completa (com apelidos, como `IN`/`OUT`) está em `src/app/features/assembly/models/instrucoes.ts`.

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

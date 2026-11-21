# Guia de desenvolvimento do ArqLive

Este guia reúne os padrões do projeto. Quem for alterar o ArqLive (pessoa ou assistente de IA) deve lê-lo junto com o `README.md` e segui-lo.

**Pedido-modelo para um novo chat:**

> Repositório: https://github.com/madianitab/arqlive. Leia o `README.md` e o `GUIA_DESENVOLVIMENTO.md` e siga os padrões. Quero [descreva o pedido]. Entregue numa branch com pull request, autora madianitab &lt;madianitab@gmail.com&gt;.

---

## 1. Visão geral

- **Objetivo:** simulador didático de Arquitetura e Organização de Computadores, da professora Madianita (UNITINS). A nomenclatura é a definida por ela.
- **Projeto irmão do [OSLive](https://github.com/madianitab/oslive):** mesma tecnologia, mesmo design system e mesmo fluxo de entrega. Quando houver dúvida de padrão visual, siga o OSLive.
- **Tecnologia:** Angular 18, com componentes `standalone`, `signals` e o novo controle de fluxo (`@if`, `@for`). Sem backend.
- **Publicação:** GitHub Pages, por meio do workflow `.github/workflows/deploy.yml`, a cada push na `main`.
- **Rotas com `#`** (`useHash: true`), por exemplo `#/assembly/simulador`. Sem isso, recarregar uma página no GitHub Pages dá erro 404. Não remova.

## 2. Estrutura de pastas

```
src/app/
├── core/          tema claro/escuro
├── ui/            DESIGN SYSTEM (componentes os-*, tokens.css, styles/) — o mesmo do OSLive
├── pages/         landing, simulacoes (página "Laboratório" com os cards; a rota continua /simulacoes), brandkit (vitrine do design system)
└── features/      um assunto por pasta
    └── assembly/
        ├── models/       lógica pura (montador, executor, exemplos), sem Angular → fácil de testar
        ├── services/     estado da tela (signals)
        ├── simulador/components/   home-, lateral-, area-, editor- e rastreamento-assembly
        ├── ciclo/components/       home-, lateral- e area-ciclo (fluxograma do ciclo + CPU e memória, em SVG)
        ├── executor/components/    executor-assembly (reusa o editor-assembly)
        ├── tradutor/components/    tradutor-c (C → Assembly; reusa o editor-assembly e o CSS do executor)
        ├── exercicios/components/  exercicios-assembly (exercícios com conferência; reusa o editor-assembly e o CSS do executor)
        └── components/             tabela-instrucoes (janela com todas as instruções, usada nas duas telas)
```

**Separação obrigatória:**
- A lógica fica no `models/` e não depende do Angular (nada de Angular, RxJS ou arquivos de `services/`/`components/`).
- O serviço guarda o estado com `signals`.
- Os componentes só exibem e repassam ações.

## 3. Design system

O visual vem do design system do OSLive, copiado em `src/app/ui`. A página **`#/brandkit`** mostra os componentes. **Todo módulo novo deve usar esse design system.** Não use Bootstrap, cores fixas nem componentes visuais próprios quando já existir um equivalente.

- **Componentes:** `os-sim-shell` (casca da tela), `os-panel` (painel da lateral), `os-button`, `os-button-group`, `os-stat`, `os-badge`, `os-card`, `os-alert`, `os-terminal`, `os-sim-player` (passo a passo) e outros (exportados em `ui/index.ts`).
- **Estilos compartilhados:** `ui/styles/sim-config.css` (lateral) e `ui/styles/sim-viz.css` (área principal).
- **Tokens:** use sempre as variáveis CSS de `ui/tokens.css` (`--a`, `--text`, `--surface`, `--line`, `--ok`, `--err`, `--warn`, `--info`, `--f-mono`…), para funcionar nos temas claro e escuro. **Teste sempre nos dois temas.**
- **Ícones:** só Font Awesome 6 instalado pelo npm (`fa-solid fa-…`). Nada de CDN no `index.html`.
- **Tailwind:** prefixo `tw-`.

### Padrão de tela

```html
<os-sim-shell title="…" subtitle="…">
  <ng-container slot="actions"><os-button-group>…</os-button-group></ng-container>
  <app-lateral-xxx slot="config"></app-lateral-xxx>   <!-- painéis os-panel -->
  <app-area-xxx></app-area-xxx>                       <!-- div.viz com seções -->
</os-sim-shell>
```

- **Serviço por tela:** o componente "home" fornece o serviço com `providers: [MeuService]`; a lateral e a área o injetam. Cada visita começa do zero.
- **Topo da área:** cartões `os-stat` com os números principais. **Seções** separadas por `div.viz-label`.
- **Responsividade (projetor e zoom):** layouts das áreas mudam com **`@container sim-main (max-width: …)`**, não com `@media`. No simulador de assembly, o código e a execução ficam **lado a lado** até 640px de largura útil.
- **Textos:** português do Brasil e linguagem didática. Menos texto é melhor.

## 4. Convenções conceituais

### Nomenclatura
- Registradores da unidade de controle: **PC**, **IR**, **MAR** e **MDR** (não MBR).
- Ciclo de instrução: **busca → decodificação → execução**.
- Numeração a partir de 0 (endereços de memória e posições de vetor).

### Assembly simplificado
- **O padrão é o definido pela professora.** Pode-se acrescentar instruções, mas não mudar as existentes. Na interface e na documentação, nenhuma instrução é marcada como diferente das outras, e não há referência a aulas ou slides.
- **Conjunto de instruções em um arquivo só:** `features/assembly/models/instrucoes.ts` (nome, apelidos, operandos, uso, descrição, equivalente em C++, se usa a ULA). O montador, o executor e a referência da lateral leem dali. Todas as instruções são tratadas igualmente.
- **Modelo RISC (AVR do Arduino):** só `LOAD`/`STORE` acessam a memória; `ADD`, `SUB`, `MUL`, `DIV` e `CMP` trabalham com registrador e registrador/constante. **O destino vem sempre primeiro** (`OUT porta, R1`).
- **Registradores:** `R0` a `R7` (uso geral); PC, IR, MAR, MDR e SP; flags Z, N e C.
- **Memória:** cada instrução ocupa uma palavra, a partir do endereço 0; as variáveis vêm logo depois, na ordem da declaração (vetor = palavras seguidas; texto = uma palavra). A pilha (8 palavras) só existe se o programa usa `CALL rótulo`/`RET`; o SP começa no fim dela e desce.
- **Busca:** `MAR ← PC`, `MDR ← M[MAR]`, `IR ← MDR`, `PC ← PC + 1`. **Decodificação:** a UC lê o IR. **Execução:** a ULA calcula, o resultado vai para Rn e as flags são atualizadas.
- **LOAD de variável:** `MAR ← end`, `MDR ← M[end]`, `R1 ← MDR`. **LOAD de constante:** não acessa a memória. **STORE:** `MAR ← end`, `MDR ← R1`, `M[end] ← MDR`. **Vetor:** `LED[R1]` = endereço de LED + R1.
- **Flags:** Z = 1 se o resultado é 0; N = 1 se é negativo; C = 1 se R1 < R2 sem considerar sinal (no `SUB`/`CMP`; no `ADD`, vai-um em 16 bits; no `MUL`/`DIV`, 0). `CMP` não guarda o resultado.
- **Portas:** entrada `BOTAO` (0/1), `A0`…`A5` (ADC, 0 a 1023) ou número do pino; saída `LED` (pino 13), `TELA` ou número do pino (0 a 13); `OUT R2, R3` usa o pino cujo número está em R2. Os valores de entrada são definidos na lateral.
- **`CALL imprime`:** rotina do sistema (como o `printf`): exibe na TELA a variável `TEXTO`, sem quebra de linha. `OUT TELA, R1` exibe o valor e quebra a linha.
- **`vazio`:** variável sem valor (`D: vazio` ou só `D`); ler (`LOAD`) uma variável vazia é erro de execução.
- **Tabela de instruções:** botão **Instruções** na barra de ações do Simulador e do Executor (e "Ver todas as instruções" na lateral do Simulador) abre a janela `tabela-instrucoes`, gerada a partir de `instrucoes.ts` (uso, outras formas, descrição, C++, ULA), com busca. Instrução nova aparece lá automaticamente.
- **Tabela de rastreamento** (`rastreamento-assembly`, abaixo da execução no Simulador): gerada por `models/rastreamento.ts` a partir da execução — uma linha por instrução, com os valores **depois** dela. Colunas: PC (endereço da instrução), IR, registradores que o programa usa (vazios até receberem valor: "R1 vazio"), variáveis (exceto o TEXTO), "Usou a ULA?", Z, N, C, "Pinos em HIGH" (só se o programa usa portas de saída) e "Próximo PC" (`fim` quando o programa termina). Modo **Acompanhar** (preenche junto com a execução, até 200 linhas) e modo **Exercício** (até 30 linhas; o aluno preenche e confere). A conferência ignora espaços e maiúsculas e aceita em branco = `vazio`, `s`/`n` para sim/não e `13` = `LED`. O estado do exercício fica no `SimuladorAssemblyService` e é zerado a cada nova execução.
- **Executor Assembly** (`#/assembly/executor`): tela limpa, sem passo a passo — editor à esquerda; entrada (portas), saída (TELA, memória final, portas) e o **código equivalente em C++** à direita. O C++ é gerado por `models/cpp.ts` **sem registradores e sem `goto`** (nunca há tradução instrução por instrução): os registradores guardam expressões, o `STORE` vira atribuição (`D = X + 2;`, `Y++;`), IN/OUT/DELAY viram `digitalRead`/`analogRead`/`digitalWrite`/`delay`, CMP + desvio viram `if`, `if-else`, `for`, `while`, `break` e `continue`, e `CALL rótulo`/`RET` vira uma função (`void dobra() { … }`; as sub-rotinas ficam depois do `HALT`, e os registradores que elas usam viram variáveis globais). Um registrador que leva valor de uma volta do laço para a outra vira uma variável, nesta ordem: (1) a **própria variável da memória** que ele copia, quando o laço não usa essa variável e logo depois dele vem o `STORE` nela (`LOAD R1, soma … STORE soma, R1` → `soma = soma + i;`); (2) o **contador** (`i`, `j`, `k`…, pulando nomes de variáveis), quando é o registrador comparado e só muda com `ADD`/`SUB` de constante; (3) `valor`, `valor2`… **`for`:** contador que começa num valor conhecido (constante ou variável que nunca recebe `STORE`) e termina o corpo com `ADD R, 1`; se o contador vem de uma variável lida só ali (`i: 1` / `LOAD R2, i`), o `for` usa o nome dela e ela não é declarada; se o contador é usado depois do laço, é declarado antes (`int i; for (i = 0; …)`). **Sempre que há `for`, a tela mostra também a versão com `while`** (`ResultadoCpp.codigoWhile`: contador declarado antes, `i++` no fim do corpo). **Formatos de laço reconhecidos:** teste no início (com `LOAD`/`IN` antes do `CMP`, que entram na condição: `while (digitalRead(botao) == HIGH)`); teste no fim (vira `while`/`for` quando a primeira comparação é verdadeira, senão `while (true) { …; if (…) break; }`; **nunca `do-while`**); laço infinito (`while (true)`; no Arduino, o laço infinito do fim do programa vira o próprio `loop()`); `JMP` para o teste ou para o meio do laço (o trecho até o teste é copiado para antes do `while`); `break` (desvio para o fim, ou para um bloco entre o laço e o fim, que entra no `if` antes do `break`) e `continue`. O **zero implícito** (registrador usado sem `LOAD`) não aparece nas somas: `ADD R1, 12` → `12`, não `0 + 12`. Formato Arduino (`setup`/`loop`, `led`, `botao`) se o programa usa portas ou DELAY; senão, PC (`main`, `printf`). Se um desvio não corresponder a nenhum desses formatos (ex.: entra no meio de um laço vindo de fora), **não há C++**: a tela mostra o aviso (`ResultadoCpp.aviso`, ex.: "O desvio JL B (linha 8) entra no meio de um laço. Isso não corresponde a if, for ou while em C.").
- **Tradutor C → Assembly** (`#/assembly/tradutor`): mesma tela limpa do executor (reusa o CSS dele) — C/C++ à esquerda; assembly gerado (somente leitura), avisos e resultado da execução à direita. A tradução fica em `models/c-assembly.ts` (lógica pura) e segue estas regras:
  - **Memória:** valor inicial constante vai direto para a memória (`X: 5`); sem valor, ou declarada dentro de um laço, fica `vazio`; vetores sem valor ficam com zeros. Variável usada só como pino (`int led = 13;`) e `const`/`#define` não vão para a memória (entram direto na instrução).
  - **Contas:** da esquerda para a direita num registrador (R1, R2…), constantes direto na instrução (`ADD R1, 2`), resultado gravado com `STORE`. O tradutor lembra qual variável está em cada registrador e a reaproveita (`X = X + Y; Y++` → o `ADD R2, 1` usa o Y que já está em R2). Um `STORE X` seguido de outro `STORE X`, sem leitura de X no meio, é removido (`int D = T - L; D = D * 2` → um `STORE D` só).
  - **Laços:** as variáveis usadas no laço ficam presas em registradores — lidas antes do rótulo `LOOP`, gravadas depois do `FIM`. A variável declarada no `for` (`int i = 1`) vai para a memória com o valor inicial e não é gravada no fim.
  - **Saltos:** o salto testa a condição contrária à do C: `if (B == 2)` → `JNE FIM`; `i <= 4` → `JG FIM`; `i < 3` → `JGE FIM`. Rótulos: `LOOP`, `FIM`, `SENAO`, `PROXIMO` (continue) e `SEGUE` (`||`/`&&`), numerados quando se repetem (`FIM2`).
  - **printf:** o texto vira a variável `TEXTO` + `CALL imprime`, e cada `%d` vira `OUT TELA` (depois do `CALL`, o valor é lido da memória de novo). O simulador tem um `TEXTO` só: textos diferentes geram aviso.
  - **Arduino:** `led`/pino 13 → `LED`; `botao` → `BOTAO`; `A0`…`A5` no `analogRead`; `pinMode` e `Serial.begin` não geram instrução; o corpo do `loop()` executa uma vez (aviso). `main()` termina com `HALT`.
  - **Nomes:** o assembly não diferencia maiúsculas de minúsculas, então `x` e `X`, ou nomes reservados (`add`, `r1`), ganham um `_` no fim, com aviso.
  - O `editor-assembly` aceita `linguagem="c"` (destaque de C) e `somenteLeitura`. O botão **Abrir no executor** envia o assembly pelo `state` da navegação; o executor o carrega e executa.
- **Exercícios** (`#/assembly/exercicios`): lista `EXERCICIOS` em `models/exercicios.ts`, agrupados por assunto em `tema` (`TEMAS`: memória e contas, desvios e flags, laços, Arduino, assembly → C), sem referência a aulas ou slides; as respostas de referência não usam `DIV`, `JL`, `JLE`, `RET` nem `NOP` (teste garante); enunciado, código dado, resposta de referência em `gabarito`, instruções pedidas em `usar`, variáveis conferidas em `verificar`, valores de entrada em `casos` e `perguntas`). Tipos: `c-para-asm`, `asm-para-c` e `perguntas`. A conferência (`conferirExercicio`) **executa** a resposta do aluno e a de referência e compara: variáveis (sem diferenciar maiúsculas de minúsculas; por padrão todas as da resposta de referência, menos o TEXTO), TELA, sequência de escritas nos pinos e tempo de DELAY, para cada caso de entrada. No `asm-para-c`, o C do aluno passa pelo tradutor. Perguntas: `instrucoes` (conjunto de instruções, em qualquer ordem), `numero`, `simnao` e `bits` (ex.: flags "0, 1, 1"). O progresso ("feito") vale só para a visita.
- **Ciclo de instrução** (`#/assembly/ciclo`): tela limpa, só com programas fixos (`models/exemplos-ciclo.ts`, agrupados em sem laço, com desvio e com laço; sem portas). `models/ciclo.ts` (lógica pura) parte da execução do `assembly.ts` e quebra cada passo em **micro-operações** (`gerarMicros`): a busca vira `MAR ← PC`, `MDR ← M[MAR]`, `IR ← MDR`, `PC ← PC + 1`; a decodificação, `UC decodifica o IR`; a execução é lida das linhas de micro-operação do executor (`MAR ← endereço de X`, `MDR ← M[MAR]`, `R1 ← MDR`, `ULA: R1 + 2`, `R1 ← resultado da ULA`, `Flags ← resultado da ULA`, `UC testa as flags`, `PC ← LOOP`…). Cada micro-operação tem o **texto sem valores** (aparece na faixa do ciclo antes de acontecer, sem adiantar resultados), o **detalhe com valores**, os componentes ativos, os **fluxos** (`de` → `para`, desenhados como setas) e o estado da CPU logo depois dela (os valores mudam um a um, não no fim da fase). Cada micro-operação também tem a **etapa do fluxograma** (`etapa`: buscar, incrementar, decodificar, decisao, endereco, buscarOperando, executar, escrever). A execução começa com a pergunta **"Tem operando?"**: só o `LOAD` de variável responde sim (cálculo do endereço → buscar e armazenar operando → volta à pergunta, que agora responde não); STORE, ULA, desvios e constantes respondem não. A escrita em registrador/flags/PC/memória (`R1 ← resultado da ULA`, `PC ← LOOP`, `M[MAR] ← MDR`) é "escrever o resultado"; o resto é "executar a operação". `LIGACOES_FLUXO` e `caminhoFluxo` dão as ligações percorridas entre duas etapas. `agruparPorFase` junta as micro-operações de cada fase (modo "uma fase por passo"). **Tela:** fluxograma (viewBox 520) e CPU + memória (viewBox 680) lado a lado, na mesma escala (`grid` 520fr/680fr), um embaixo do outro abaixo de 860px de largura útil. **Tema escuro:** os diagramas usam variáveis locais (`--c-linha`, `--c-caixa`, `--c-borda`, `--c-nome`, `--c-texto`, `--c-mem`) que o tema escuro troca por tons mais claros, e os preenchimentos de fase passam a ser a cor da fase misturada ao fundo (`color-mix`), porque os tokens `--line` e `--*-soft` do tema escuro quase somem nos diagramas. Na CPU, os nomes seguem a nomenclatura do projeto com o nome em português entre parênteses: MDR (RDM), MAR (REM), PC (CI), IR (RI), ULA (UAL); o decodificador aparece separado da unidade de controle e a memória é a tabela "Endereço | Conteúdo". As animações (traço que corre, caixa que pulsa) recomeçam a cada passo porque os elementos animados são recriados (`track` com a posição); respeitam `prefers-reduced-motion`. Cores das fases: busca `--info`, decodificação `--warn`, execução `--a`. Se o texto das micro-operações do `assembly.ts` mudar, ajuste o `microsExecucao` do `ciclo.ts` (o `ciclo.spec.ts` confere os textos).
- **Nomenclatura das telas:** a página com os cards se chama **Laboratório** (menu, botão "Explorar o laboratório" da tela inicial e título "O que você quer fazer?"), porque reúne simulador, ciclo de instrução, executor, tradutor e exercícios.
- **Erros de execução:** memória vazia, divisão por zero, índice fora do vetor, pino inválido, pilha cheia/vazia e mais de 2000 instruções (laço infinito).
- **Sem HALT:** quando o PC passa da última instrução (ex.: o rótulo `FIM:` no fim), o programa termina sem erro.
- **Exemplos:** os programas ficam em `models/exemplos.ts` (simulador e executor) e `models/exemplos-c.ts` (tradutor).

## 5. Como adicionar um módulo novo

1. **Modelo:** crie `features/<assunto>/models/<nome>.ts` com a lógica pura e um `.spec.ts` com casos do material.
2. **Serviço:** crie `services/<nome>.service.ts` com `@Injectable()` (sem `providedIn`), guardando o estado em signals.
3. **Componentes:** crie `home-…`, `lateral-…` e `area-…` no padrão da seção 3.
4. **Rota:** registre a rota em `app-routing.module.ts`, no grupo do assunto.
5. **Card:** adicione o card em `pages/simulacoes/simulacoes.component.ts` (página Laboratório) e na cena 2 da tela inicial (`pages/landing`), com o badge `simulador` (`a`) ou `exercícios` (`s`).
6. **README:** acrescente uma linha na tabela de módulos do `README.md`.
7. **Convenções:** se o módulo trouxer uma convenção nova, registre-a na seção 4 deste guia.

## 6. Testes antes de entregar

```bash
npm ci
npx ng build --base-href /arqlive/         # build de produção sem erros
npx ng test --watch=false                  # testes unitários (Karma)
```

- **Testes unitários:** todos devem passar. O `exercicios.spec.ts` confere que a resposta de referência de cada exercício passa na conferência, que outras soluções corretas também passam e as perguntas. O `rastreamento.spec.ts` confere as tabelas de X = X + 2 e do for com LEDs e a conferência das respostas. O `cpp.spec.ts` confere o C++ do executor (sem registradores e sem goto, for e while, break, continue, função e aviso). O `c-assembly.spec.ts` confere as traduções esperadas (instrução por instrução) e executa o assembly gerado para conferir os valores finais. O `ciclo.spec.ts` confere as micro-operações da busca e da execução, as etapas do fluxograma, o estado passo a passo, os desvios do laço e os valores finais dos programas fixos. O `assembly.spec.ts` confere a montagem, o ciclo de instrução, as flags, os rastreamentos e o resultado de todos os exemplos.
- **Navegador:** confira a tela nos temas claro e escuro, sem erros no console, e com **zoom de 150 a 175%** (lateral aberta e recolhida), sem rolagem horizontal na página.

## 7. Entrega (fluxo da professora)

1. **Nunca commitar direto na `main`.** Crie uma branch a partir da `main` atual.
2. **Commits em português:** título curto e corpo explicando o que mudou e por quê. **Autoria:** `madianitab <madianitab@gmail.com>`.
3. **Abra um pull request** para a `main`; a professora revisa e faz o merge.
4. **Documentação na mesma branch:** atualize o `README.md` e este guia quando for o caso, e diga no PR o que mudou neles.
5. **Segurança:** nada de segredos no código nem dependências inseguras.
6. **Após o merge:** o GitHub Actions publica o site em cerca de 3 minutos. Recarregue com Ctrl + F5.

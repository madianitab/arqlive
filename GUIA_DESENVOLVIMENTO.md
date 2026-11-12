# Guia de desenvolvimento do ArqLive

Este guia reúne os padrões do projeto. Quem for alterar o ArqLive (pessoa ou assistente de IA) deve lê-lo junto com o `README.md` e segui-lo.

**Pedido-modelo para um novo chat:**

> Repositório: https://github.com/madianitab/arqlive. Leia o `README.md` e o `GUIA_DESENVOLVIMENTO.md` e siga os padrões. Quero [descreva o pedido]. Entregue numa branch com pull request, autora madianitab &lt;madianitab@gmail.com&gt;.

---

## 1. Visão geral

- **Objetivo:** simulador didático de Arquitetura e Organização de Computadores, usado nas aulas da professora Madianita (UNITINS). A nomenclatura segue o material das aulas.
- **Projeto irmão do [OSLive](https://github.com/madianitab/oslive):** mesma tecnologia, mesmo design system e mesmo fluxo de entrega. Quando houver dúvida de padrão visual, siga o OSLive.
- **Tecnologia:** Angular 18, com componentes `standalone`, `signals` e o novo controle de fluxo (`@if`, `@for`). Sem backend.
- **Publicação:** GitHub Pages, por meio do workflow `.github/workflows/deploy.yml`, a cada push na `main`.
- **Rotas com `#`** (`useHash: true`), por exemplo `#/assembly/simulador`. Sem isso, recarregar uma página no GitHub Pages dá erro 404. Não remova.

## 2. Estrutura de pastas

```
src/app/
├── core/          tema claro/escuro
├── ui/            DESIGN SYSTEM (componentes os-*, tokens.css, styles/) — o mesmo do OSLive
├── pages/         landing, simulacoes (página com os cards), brandkit (vitrine do design system)
└── features/      um assunto por pasta
    └── assembly/
        ├── models/       lógica pura (montador, executor, exemplos), sem Angular → fácil de testar
        ├── services/     estado da tela (signals)
        ├── simulador/components/   home-, lateral-, area- e editor-assembly
        └── executor/components/    executor-assembly (reusa o editor-assembly)
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
- **Responsividade (sala de aula com zoom):** layouts das áreas mudam com **`@container sim-main (max-width: …)`**, não com `@media`. No simulador de assembly, o código e a execução ficam **lado a lado** até 640px de largura útil.
- **Textos:** português do Brasil e linguagem didática. Menos texto é melhor.

## 4. Convenções conceituais

### Nomenclatura
- Registradores da unidade de controle: **PC**, **IR**, **MAR** e **MDR** (não MBR), como nos slides das aulas.
- Ciclo de instrução: **busca → decodificação → execução**.
- Numeração a partir de 0 (endereços de memória e posições de vetor).

### Assembly (padrão da Aula 14 de ArqII — "Do C++ ao Assembly")
- **O padrão é o dos slides da professora.** Pode-se acrescentar coisas, mas não mudar o que está no slide. Se algo no slide estiver errado, use o correto e avise a professora.
- **Conjunto de instruções em um arquivo só:** `features/assembly/models/instrucoes.ts` (nome, apelidos, operandos, uso, descrição, equivalente em C++, se usa a ULA e se é acréscimo — `extra: true`). O montador, o executor e a referência da lateral leem dali.
- **Modelo RISC (AVR do Arduino):** só `LOAD`/`STORE` acessam a memória; `ADD`, `SUB`, `MUL`, `DIV` e `CMP` trabalham com registrador e registrador/constante. **O destino vem sempre primeiro** (`OUT porta, R1`).
- **Registradores:** `R0` a `R7` (uso geral); PC, IR, MAR, MDR e SP; flags Z, N e C.
- **Memória:** cada instrução ocupa uma palavra, a partir do endereço 0; as variáveis vêm logo depois, na ordem da declaração (vetor = palavras seguidas; texto = uma palavra). A pilha (8 palavras) só existe se o programa usa `CALL rótulo`/`RET`; o SP começa no fim dela e desce.
- **Busca:** `MAR ← PC`, `MDR ← M[MAR]`, `IR ← MDR`, `PC ← PC + 1`. **Decodificação:** a UC lê o IR. **Execução:** a ULA calcula, o resultado vai para Rn e as flags são atualizadas.
- **LOAD de variável:** `MAR ← end`, `MDR ← M[end]`, `R1 ← MDR`. **LOAD de constante:** não acessa a memória. **STORE:** `MAR ← end`, `MDR ← R1`, `M[end] ← MDR`. **Vetor:** `LED[R1]` = endereço de LED + R1.
- **Flags (tabela do slide 8):** Z = 1 se o resultado é 0; N = 1 se é negativo; C = 1 se R1 < R2 sem considerar sinal (no `SUB`/`CMP`; no `ADD`, vai-um em 16 bits; no `MUL`/`DIV`, 0). `CMP` não guarda o resultado.
- **Portas:** entrada `BOTAO` (0/1), `A0`…`A5` (ADC, 0 a 1023) ou número do pino; saída `LED` (pino 13), `TELA` ou número do pino (0 a 13); `OUT R2, R3` usa o pino cujo número está em R2. Os valores de entrada são definidos na lateral.
- **`CALL imprime`:** rotina do sistema (como o `printf`): exibe na TELA a variável `TEXTO`, sem quebra de linha. `OUT TELA, R1` exibe o valor e quebra a linha.
- **`vazio`:** variável sem valor (`D: vazio` ou só `D`); ler (`LOAD`) uma variável vazia é erro de execução.
- **Executor de código** (`#/assembly/executor`): tela limpa, sem passo a passo — editor à esquerda; entrada (portas), saída (TELA, memória final, portas) e o **código equivalente em C++** à direita. O C++ é gerado por `models/cpp.ts`, instrução por instrução: formato Arduino (`setup`, `digitalRead`…) se o programa usa portas ou DELAY; senão, formato de PC (`main`, `printf`).
- **Erros de execução:** memória vazia, divisão por zero, índice fora do vetor, pino inválido, pilha cheia/vazia e mais de 2000 instruções (laço infinito).
- **Sem HALT:** quando o PC passa da última instrução (ex.: o rótulo `FIM:` no fim), o programa termina sem erro.
- **Exemplos:** os programas de `models/exemplos.ts` são os do slide; acréscimos (como `TEXTO` e `D: vazio`) ficam comentados no código.

## 5. Como adicionar um módulo novo

1. **Modelo:** crie `features/<assunto>/models/<nome>.ts` com a lógica pura e um `.spec.ts` com casos do material.
2. **Serviço:** crie `services/<nome>.service.ts` com `@Injectable()` (sem `providedIn`), guardando o estado em signals.
3. **Componentes:** crie `home-…`, `lateral-…` e `area-…` no padrão da seção 3.
4. **Rota:** registre a rota em `app-routing.module.ts`, no grupo do assunto.
5. **Card:** adicione o card em `pages/simulacoes/simulacoes.component.ts`, com o badge `simulador` (`a`) ou `exercícios` (`s`).
6. **README:** acrescente uma linha na tabela de módulos do `README.md`.
7. **Convenções:** se o módulo trouxer uma convenção nova, registre-a na seção 4 deste guia.

## 6. Testes antes de entregar

```bash
npm ci
npx ng build --base-href /arqlive/         # build de produção sem erros
npx ng test --watch=false                  # testes unitários (Karma)
```

- **Testes unitários:** todos devem passar. O `assembly.spec.ts` confere a montagem, o ciclo de instrução, as flags (tabela do slide 8), os rastreamentos dos slides 16 e 38 e o resultado de todos os exemplos.
- **Navegador:** confira a tela nos temas claro e escuro, sem erros no console, e com **zoom de 150 a 175%** (lateral aberta e recolhida), sem rolagem horizontal na página.

## 7. Entrega (fluxo da professora)

1. **Nunca commitar direto na `main`.** Crie uma branch a partir da `main` atual.
2. **Commits em português:** título curto e corpo explicando o que mudou e por quê. **Autoria:** `madianitab <madianitab@gmail.com>`.
3. **Abra um pull request** para a `main`; a professora revisa e faz o merge.
4. **Documentação na mesma branch:** atualize o `README.md` e este guia quando for o caso, e diga no PR o que mudou neles.
5. **Segurança:** nada de segredos no código nem dependências inseguras.
6. **Após o merge:** o GitHub Actions publica o site em cerca de 3 minutos. Recarregue com Ctrl + F5.

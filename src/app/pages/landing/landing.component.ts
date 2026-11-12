import {
  AfterViewInit,
  Component,
  ElementRef,
  NgZone,
  OnDestroy,
  OnInit,
  inject,
} from '@angular/core';
import { NgFor } from '@angular/common';
import { Router, RouterLink } from '@angular/router';
import { OsButtonComponent } from '../../ui/button/button.component';
import { OsCardComponent } from '../../ui/card/card.component';
import { OsCardIconComponent } from '../../ui/card-icon/card-icon.component';

type SceneKind = 'zoom' | 'slideX' | 'slideUp';

@Component({
  selector: 'app-landing',
  standalone: true,
  imports: [NgFor, RouterLink, OsButtonComponent, OsCardComponent, OsCardIconComponent],
  styleUrls: ['./landing.component.css'],
  template: `
<div class="landing" #root>

  <!-- fundo em profundidade (parallax ambiente) -->
  <div class="px" aria-hidden="true">
    <div class="px-layer px-glow"></div>
    <div class="px-layer px-grid"></div>
    <div class="px-layer px-mark">CPU</div>
    <div class="px-grain"></div>
  </div>

  <!-- barra de progresso das cenas -->
  <div class="px-progress" aria-hidden="true"><i class="px-progress-fill"></i></div>

  <!-- step-wizard -->
  <nav class="stepper" aria-label="Seções da página">
    <button *ngFor="let s of steps; let i = index" class="step" type="button"
            (click)="goToScene(i)" [attr.aria-label]="s.label">
      <span class="step-label">{{ s.label }}</span>
      <span class="step-dot"></span>
    </button>
  </nav>

  <!-- trilho de rolagem + palco fixo -->
  <div class="scenes" #scenes>
    <!-- âncoras de snap: soltar o scroll centraliza na cena mais próxima -->
    <div class="snaps" aria-hidden="true">
      <i class="snap" *ngFor="let s of steps; let i = index" [style.top.vh]="i * SEG * 100"></i>
    </div>
    <div class="stage">

      <!-- CENA 0 — HERO -->
      <section class="scene" data-i="0">
        <div class="scene-inner">
          <h1 class="hero-title">Arq<b>Live</b><span class="cursor"></span></h1>
          <p class="hero-tagline">o computador, <em>por dentro</em>.<br>escreva assembly e veja a CPU executar, passo a passo.</p>
          <div class="hero-cta">
            <os-button variant="p" size="lg" [glow]="true" (click)="go('/simulacoes')">Explorar Simulações</os-button>
            <os-button variant="s" size="lg" (click)="go('/brandkit')">Design System</os-button>
          </div>
          <div class="hero-term"><span class="p">aluno&#64;arqlive</span><span class="d">:~$</span> executar programa.asm</div>
        </div>
      </section>

      <!-- CENA 1 — O QUE VOCÊ APRENDE -->
      <section class="scene" data-i="1">
        <div class="scene-inner">
          <div class="section-idx">01 — O que você aprende</div>
          <h2 class="section-title">Como a CPU executa um programa</h2>
          <div class="tw-grid tw-grid-cols-1 md:tw-grid-cols-3 tw-gap-4 tw-mt-8 scene-deck">
            <os-card title="Assembly">
              <os-card-icon slot="icon"><svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8"><path d="M8 7l-5 5 5 5M16 7l5 5-5 5"/></svg></os-card-icon>
              Instruções simples: mover, somar, comparar e desviar.
            </os-card>
            <os-card title="Registradores">
              <os-card-icon slot="icon" variant="info"><svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8"><rect x="3" y="4" width="18" height="4" rx="1"/><rect x="3" y="10" width="18" height="4" rx="1"/><rect x="3" y="16" width="18" height="4" rx="1"/></svg></os-card-icon>
              PC, IR, MAR, MDR e os registradores de uso geral mudando a cada passo.
            </os-card>
            <os-card title="Ciclo de instrução">
              <os-card-icon slot="icon" variant="ok"><svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8"><path d="M20 12a8 8 0 1 1-2.3-5.7M20 4v4h-4"/></svg></os-card-icon>
              Busca, decodificação e execução, instrução por instrução.
            </os-card>
          </div>
        </div>
      </section>

      <!-- CENA 2 — SIMULADORES -->
      <section class="scene" data-i="2">
        <div class="scene-inner">
          <div class="section-idx">02 — Simulador</div>
          <h2 class="section-title">Aprenda fazendo</h2>
          <div class="tw-grid tw-grid-cols-1 md:tw-grid-cols-3 tw-gap-4 tw-mt-8 scene-deck">
            <a class="deck-link" href="#/assembly/simulador" (click)="go('/assembly/simulador'); $event.preventDefault()">
              <os-card title="Simulador de Assembly">
                <os-card-icon slot="icon"><svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8"><rect x="3" y="4" width="18" height="16" rx="2"/><path d="M7 9l3 3-3 3M12 15h5"/></svg></os-card-icon>
                Escreva o programa de um lado e veja a execução, passo a passo, do outro.
              </os-card>
            </a>
          </div>
          <div class="tw-mt-6"><a class="see-all" routerLink="/simulacoes">ver todas as simulações →</a></div>
        </div>
      </section>

      <!-- CENA 3 — CTA -->
      <section class="scene scene-cta" data-i="3">
        <div class="scene-inner">
          <span class="cta-rule"></span>
          <h2 class="cta-title">Pronto pra simular?</h2>
          <p class="cta-sub">Escreva um programa e veja a CPU trabalhar.</p>
          <os-button variant="p" size="lg" [glow]="true" (click)="go('/simulacoes')">Começar agora</os-button>
          <div class="cta-foot">ArqLive · Arquitetura de Computadores · {{ year }}</div>
        </div>
      </section>

    </div>
  </div>

  <div class="scroll-hint" aria-hidden="true">
    <span class="mouse"><span class="wheel"></span></span>
    <span class="scroll-hint-txt">role para navegar</span>
  </div>
</div>
  `,
})
export class LandingComponent implements OnInit, AfterViewInit, OnDestroy {
  private readonly router = inject(Router);
  private readonly host = inject(ElementRef<HTMLElement>);
  private readonly zone = inject(NgZone);

  /** quanto scroll (em telas) cada cena dura — >1 dá "dwell" maior por cena */
  readonly SEG = 1.5;
  /** fração de cada segmento em que a cena fica 100% parada (platô / dwell) */
  private readonly HOLD = 0.40;
  /** largura da janela de transição (curta = nítida, sem sobreposição de texto) */
  private readonly TW = 0.12;

  readonly year = 2026;
  readonly steps: { kind: SceneKind; label: string }[] = [
    { kind: 'zoom',    label: 'Início' },
    { kind: 'slideX',  label: 'Aprender' },
    { kind: 'slideUp', label: 'Simular' },
    { kind: 'zoom',    label: 'Começar' },
  ];

  private sceneEls: HTMLElement[] = [];
  private stepEls: HTMLElement[] = [];
  private landingEl?: HTMLElement;
  private scenesEl?: HTMLElement;
  private hintEl?: HTMLElement | null;
  private progressEl?: HTMLElement | null;
  private active = -1;
  private ticking = false;
  private readonly onScroll = () => this.requestTick();

  ngOnInit(): void {
    document.documentElement.classList.add('os-landing');
  }

  ngAfterViewInit(): void {
    const root = this.host.nativeElement as HTMLElement;
    this.landingEl = root.querySelector('.landing') as HTMLElement;
    this.scenesEl = root.querySelector('.scenes') as HTMLElement;
    this.sceneEls = Array.from(root.querySelectorAll<HTMLElement>('.scene'));
    this.stepEls = Array.from(root.querySelectorAll<HTMLElement>('.step'));
    this.hintEl = root.querySelector<HTMLElement>('.scroll-hint');
    this.progressEl = root.querySelector<HTMLElement>('.px-progress-fill');

    // altura do trilho = palco (100vh) + (N-1) segmentos de SEG telas
    const trackVh = 100 + (this.sceneEls.length - 1) * this.SEG * 100;
    this.scenesEl.style.height = `${trackVh}vh`;

    const reduce = matchMedia('(prefers-reduced-motion: reduce)').matches;
    if (reduce) {
      this.landingEl?.classList.add('reduced');
      document.documentElement.style.scrollSnapType = 'none';
      this.setActive(0);
      return;
    }

    this.zone.runOutsideAngular(() => {
      window.addEventListener('scroll', this.onScroll, { passive: true });
      window.addEventListener('resize', this.onScroll, { passive: true });
      this.update();
    });
  }

  ngOnDestroy(): void {
    document.documentElement.classList.remove('os-landing');
    document.documentElement.style.scrollSnapType = '';
    window.removeEventListener('scroll', this.onScroll);
    window.removeEventListener('resize', this.onScroll);
  }

  goToScene(i: number): void {
    const vh = window.innerHeight;
    window.scrollTo({ top: i * this.SEG * vh, behavior: 'smooth' });
  }

  private requestTick(): void {
    if (this.ticking) {
      return;
    }
    this.ticking = true;
    requestAnimationFrame(() => {
      this.update();
      this.ticking = false;
    });
  }

  private update(): void {
    const vh = window.innerHeight || 1;
    const vw = window.innerWidth || 1;
    const p = window.scrollY / (vh * this.SEG); // progresso em "cenas"
    this.landingEl?.style.setProperty('--scroll', String(window.scrollY));

    for (let i = 0; i < this.sceneEls.length; i++) {
      const el = this.sceneEls[i];
      const d = p - i;
      const ad = Math.abs(d);
      // platô (dwell) enquanto ad < HOLD; transição curta em [HOLD, HOLD+TW]
      // → uma cena chega a opacidade 0 antes da próxima surgir (sem sobrepor)
      const m = Math.min(1, Math.max(0, (ad - this.HOLD) / this.TW));
      const e = m * m * (3 - 2 * m); // smoothstep
      const incoming = d < 0; // cena à frente (entrando)

      let tx = 0;
      let ty = 0;
      let scale = 1;
      let blur = 0;
      switch (this.steps[i].kind) {
        case 'slideX':
          tx = (incoming ? 1 : -1) * e * vw * 0.55;
          blur = e * 3;
          break;
        case 'slideUp':
          ty = (incoming ? 1 : -1) * e * vh * 0.55;
          scale = 1 - e * 0.05;
          blur = e * 3;
          break;
        case 'zoom':
        default:
          ty = (incoming ? 1 : -1) * e * -14;
          scale = incoming ? 0.9 + (1 - e) * 0.1 : 1 - e * 0.16;
          blur = e * 9;
          break;
      }

      el.style.opacity = String(Math.max(0, 1 - e));
      el.style.transform = `translate3d(${tx.toFixed(1)}px, ${ty.toFixed(1)}px, 0) scale(${scale.toFixed(3)})`;
      el.style.filter = blur > 0.25 ? `blur(${Math.min(blur, 14).toFixed(1)}px)` : 'none';
      el.style.pointerEvents = e < 0.2 ? 'auto' : 'none';
      el.style.zIndex = String(40 - Math.round(ad * 12));
    }

    const cur = Math.max(0, Math.min(this.sceneEls.length - 1, Math.round(p)));
    this.setActive(cur);

    if (this.progressEl) {
      const frac = Math.max(0, Math.min(1, p / (this.sceneEls.length - 1)));
      this.progressEl.style.transform = `scaleX(${frac.toFixed(4)})`;
    }
    if (this.hintEl) {
      this.hintEl.style.opacity = p > 0.4 ? '0' : '1';
    }
  }

  private setActive(cur: number): void {
    if (cur === this.active) {
      return;
    }
    this.active = cur;
    this.stepEls.forEach((el, i) => {
      el.classList.toggle('active', i === cur);
      el.classList.toggle('done', i < cur);
    });
    // entrada coreografada: a cena ativa anima seus elementos internos
    this.sceneEls.forEach((el, i) => el.classList.toggle('is-live', i === cur));
  }

  go(path: string): void {
    this.router.navigateByUrl(path);
  }
}

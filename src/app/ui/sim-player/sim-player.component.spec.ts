import { TestBed } from '@angular/core/testing';
import { OsSimPlayerComponent } from './sim-player.component';

describe('OsSimPlayerComponent', () => {
  beforeEach(() => TestBed.configureTestingModule({ imports: [OsSimPlayerComponent] }));

  it('emite passo(+1) ao avançar', () => {
    const f = TestBed.createComponent(OsSimPlayerComponent);
    f.componentInstance.total = 5; f.componentInstance.atual = 1;
    let got = 0; f.componentInstance.passo.subscribe(d => (got = d));
    f.componentInstance.avancar();
    expect(got).toBe(1);
  });

  it('emite play quando pausado e pause quando tocando', () => {
    const f = TestBed.createComponent(OsSimPlayerComponent);
    const eventos: string[] = [];
    f.componentInstance.play.subscribe(() => eventos.push('play'));
    f.componentInstance.pause.subscribe(() => eventos.push('pause'));
    f.componentInstance.tocando = false; f.componentInstance.alternarPlay();
    f.componentInstance.tocando = true; f.componentInstance.alternarPlay();
    expect(eventos).toEqual(['play', 'pause']);
  });
});

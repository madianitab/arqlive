import { TestBed } from '@angular/core/testing';
import { OsSimLogComponent } from './sim-log.component';

describe('OsSimLogComponent', () => {
  beforeEach(() => TestBed.configureTestingModule({ imports: [OsSimLogComponent] }));

  it('marca a entrada ativa com a classe now', () => {
    const f = TestBed.createComponent(OsSimLogComponent);
    f.componentInstance.itens = [{ rotulo: 'p1' }, { rotulo: 'p2' }, { rotulo: 'p3' }];
    f.componentInstance.ativo = 1;
    f.detectChanges();
    const nows = f.nativeElement.querySelectorAll('.e.now');
    expect(nows.length).toBe(1);
    expect(nows[0].textContent).toContain('p2');
  });
});

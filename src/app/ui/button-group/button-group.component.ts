import { Component } from '@angular/core';

/**
 * Grupo segmentado de botões (toolbar). Os botões internos devem ter a
 * classe `.osbg-btn` (e opcionalmente `.danger`/`.primary`). Pensado para
 * ações icon-only com `aria-label`/`title`.
 *
 *   <os-button-group>
 *     <button class="osbg-btn" aria-label="Iniciar" (click)="...">
 *       <i class="fa-regular fa-circle-play"></i>
 *     </button>
 *     ...
 *   </os-button-group>
 */
@Component({
  selector: 'os-button-group',
  standalone: true,
  styleUrls: ['./button-group.component.css'],
  template: `<div class="osbg" role="group"><ng-content></ng-content></div>`,
})
export class OsButtonGroupComponent {}

import { Component, Input, forwardRef } from '@angular/core';
import { ControlValueAccessor, NG_VALUE_ACCESSOR, FormsModule } from '@angular/forms';
import { NgClass, NgIf } from '@angular/common';

export type InputStatus = 'default' | 'err' | 'ok';

@Component({
  selector: 'os-input',
  standalone: true,
  imports: [NgClass, NgIf, FormsModule],
  styleUrls: ['./input.component.css'],
  providers: [{
    provide: NG_VALUE_ACCESSOR,
    useExisting: forwardRef(() => OsInputComponent),
    multi: true,
  }],
  template: `
    <div class="field">
      <label *ngIf="label" class="field-lbl">
        {{ label }}
        <span *ngIf="required" class="req">*</span>
      </label>
      <input
        class="input"
        [ngClass]="{
          'input-err': status === 'err',
          'input-ok':  status === 'ok'
        }"
        [type]="type"
        [placeholder]="placeholder"
        [disabled]="disabled"
        [value]="value"
        (input)="onInput($event)"
        (blur)="onTouched()"
      />
      <span *ngIf="hint" class="field-hint" [ngClass]="status !== 'default' ? status : ''">
        {{ hint }}
      </span>
    </div>
  `,
})
export class OsInputComponent implements ControlValueAccessor {
  @Input() label = '';
  @Input() placeholder = '';
  @Input() hint = '';
  @Input() status: InputStatus = 'default';
  @Input() required = false;
  @Input() disabled = false;
  @Input() type = 'text';

  value = '';
  onChange: (v: string) => void = () => {};
  onTouched: () => void = () => {};

  onInput(e: Event): void {
    this.value = (e.target as HTMLInputElement).value;
    this.onChange(this.value);
  }

  writeValue(v: string): void { this.value = v ?? ''; }
  registerOnChange(fn: (v: string) => void): void { this.onChange = fn; }
  registerOnTouched(fn: () => void): void { this.onTouched = fn; }
  setDisabledState(d: boolean): void { this.disabled = d; }
}

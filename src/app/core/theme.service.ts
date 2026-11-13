import { Injectable, signal } from '@angular/core';

export type Theme = 'light' | 'dark';

@Injectable({
  providedIn: 'root',
})
export class ThemeService {
  private readonly storageKey = 'air2app-theme';

  readonly mode = signal<Theme>('light');

  constructor() {
    if (typeof window === 'undefined') return;

    try {
      const saved = localStorage.getItem(this.storageKey);

      if (saved === 'light' || saved === 'dark') {
        this.mode.set(saved);
      }
    } catch {
      this.mode.set('light');
    }
  }

  toggle(): void {
    const next: Theme = this.mode() === 'light' ? 'dark' : 'light';

    this.mode.set(next);

    if (typeof window === 'undefined') return;

    try {
      localStorage.setItem(this.storageKey, next);
    } catch {}
  }
}

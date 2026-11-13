import { Injectable, signal } from '@angular/core';

export type Theme = 'light' | 'dark';

@Injectable({
  providedIn: 'root',
})
export class ThemeService {
  readonly mode = signal<Theme>('light');

  constructor() {
    if (typeof window === 'undefined') return;

    try {
      const saved = localStorage.getItem('air2app-theme');

      if (saved === 'dark' || saved === 'light') {
        this.mode.set(saved);
        return;
      }

      this.mode.set(window.matchMedia('(prefers-color-scheme: dark)').matches ? 'dark' : 'light');
    } catch {
      this.mode.set('light');
    }
  }

  toggle(): void {
    const next: Theme = this.mode() === 'dark' ? 'light' : 'dark';

    this.mode.set(next);

    if (typeof window === 'undefined') return;

    try {
      localStorage.setItem('air2app-theme', next);
    } catch {
      return;
    }
  }
}

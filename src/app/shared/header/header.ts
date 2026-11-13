import {
  AfterViewInit,
  ChangeDetectionStrategy,
  Component,
  ElementRef,
  HostListener,
  OnDestroy,
  ViewChild,
  inject,
  signal,
} from '@angular/core';
import { ThemeService } from '../../core/theme.service';

type Section = 'studio' | 'process' | 'about';

interface NavigationItem {
  readonly id: Section;
  readonly number: string;
  readonly label: string;
}

@Component({
  selector: 'app-header',
  imports: [],
  templateUrl: './header.html',
  styleUrl: './header.scss',
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class Header implements AfterViewInit, OnDestroy {
  @ViewChild('menuButton')
  private menuButton?: ElementRef<HTMLButtonElement>;

  @ViewChild('mobilePanel')
  set mobilePanel(value: ElementRef<HTMLElement> | undefined) {
    this.mobilePanelElement = value?.nativeElement ?? null;

    if (value && this.menuOpen()) {
      value.nativeElement.querySelector<HTMLElement>('.a2a-mobile-link')?.focus();
    }
  }

  readonly theme = inject(ThemeService);

  readonly menuOpen = signal(false);
  readonly isScrolled = signal(false);
  readonly activeSection = signal<Section | null>(null);

  readonly navigation: readonly NavigationItem[] = [
    { id: 'studio', number: '01', label: 'The studio' },
    { id: 'process', number: '02', label: 'How it works' },
    { id: 'about', number: '03', label: 'About' },
  ];

  private readonly sections: readonly Section[] = ['studio', 'process', 'about'];

  private readonly mobileBreakpoint = 1080;

  private navigationTarget: Section | 'top' | null = null;
  private mobilePanelElement: HTMLElement | null = null;
  private previousBodyOverflow: string | null = null;

  ngAfterViewInit(): void {
    if (typeof window === 'undefined') {
      return;
    }

    this.isScrolled.set(window.scrollY > 12);

    const hash = window.location.hash.slice(1);

    if (this.isSection(hash)) {
      this.activeSection.set(hash);
      this.navigationTarget = hash;
    } else {
      this.updateActiveSection();
    }
  }

  ngOnDestroy(): void {
    this.unlockPageScroll();
  }

  toggleMenu(): void {
    if (this.menuOpen()) {
      this.closeMenu();
      return;
    }

    this.menuOpen.set(true);
    this.lockPageScroll();
  }

  closeMenu(restoreFocus = false): void {
    if (!this.menuOpen()) {
      return;
    }

    this.menuOpen.set(false);
    this.unlockPageScroll();

    if (restoreFocus) {
      this.menuButton?.nativeElement.focus();
    }
  }

  navigateTo(section: Section): void {
    this.navigationTarget = section;
    this.activeSection.set(section);
    this.closeMenu();
  }

  goTop(event: MouseEvent): void {
    if (event.button !== 0 || event.ctrlKey || event.metaKey || event.shiftKey || event.altKey) {
      return;
    }

    event.preventDefault();

    this.navigationTarget = 'top';
    this.activeSection.set(null);
    this.closeMenu();

    window.history.replaceState(window.history.state, '', '#top');

    const reducedMotion = window.matchMedia?.('(prefers-reduced-motion: reduce)').matches ?? false;

    window.scrollTo({
      top: 0,
      behavior: reducedMotion ? 'instant' : 'smooth',
    });
  }

  @HostListener('window:scroll')
  onScroll(): void {
    this.isScrolled.set(window.scrollY > 12);

    if (this.navigationTarget) {
      if (!this.hasReachedNavigationTarget()) {
        return;
      }

      this.navigationTarget = null;
    }

    this.updateActiveSection();
  }

  @HostListener('window:wheel')
  onWheel(): void {
    this.navigationTarget = null;
  }

  @HostListener('window:touchstart')
  onTouchStart(): void {
    this.navigationTarget = null;
  }

  @HostListener('document:keydown', ['$event'])
  onKeydown(event: KeyboardEvent): void {
    if (event.key === 'Escape') {
      if (this.menuOpen()) {
        this.closeMenu(true);
      }

      return;
    }

    if (this.menuOpen() && event.key === 'Tab') {
      this.handleMenuTab(event);
      return;
    }

    if (['ArrowDown', 'ArrowUp', 'PageDown', 'PageUp', 'Home', 'End', ' '].includes(event.key)) {
      this.navigationTarget = null;
    }
  }

  @HostListener('window:hashchange')
  onHashChange(): void {
    const hash = window.location.hash.slice(1);

    if (this.isSection(hash)) {
      this.navigationTarget = hash;
      this.activeSection.set(hash);
    } else {
      this.navigationTarget = hash === 'top' ? 'top' : null;
      this.activeSection.set(null);

      if (this.navigationTarget === null) {
        this.updateActiveSection();
      }
    }

    this.closeMenu();
  }

  @HostListener('window:resize')
  onResize(): void {
    if (window.innerWidth > this.mobileBreakpoint) {
      this.closeMenu();
    }

    if (this.navigationTarget === null) {
      this.updateActiveSection();
    }
  }

  private handleMenuTab(event: KeyboardEvent): void {
    if (!this.mobilePanelElement) {
      return;
    }

    const elements = Array.from(
      this.mobilePanelElement.querySelectorAll<HTMLElement>('a[href], button:not([disabled])'),
    );

    if (elements.length === 0) {
      return;
    }

    const first = elements[0];
    const last = elements[elements.length - 1];
    const active = document.activeElement;

    if (event.shiftKey && active === first) {
      event.preventDefault();
      last.focus();
    } else if (!event.shiftKey && active === last) {
      event.preventDefault();
      first.focus();
    } else if (!elements.some((element) => element === active)) {
      event.preventDefault();
      first.focus();
    }
  }

  private lockPageScroll(): void {
    if (typeof document === 'undefined' || this.previousBodyOverflow !== null) {
      return;
    }

    this.previousBodyOverflow = document.body.style.overflow;
    document.body.style.overflow = 'hidden';
  }

  private unlockPageScroll(): void {
    if (typeof document === 'undefined' || this.previousBodyOverflow === null) {
      return;
    }

    document.body.style.overflow = this.previousBodyOverflow;
    this.previousBodyOverflow = null;
  }

  private isSection(value: string): value is Section {
    return this.sections.includes(value as Section);
  }

  private hasReachedNavigationTarget(): boolean {
    if (this.navigationTarget === 'top') {
      return window.scrollY <= 8;
    }

    if (!this.navigationTarget) {
      return true;
    }

    const element = document.getElementById(this.navigationTarget);

    if (!element) {
      return true;
    }

    const rect = element.getBoundingClientRect();
    const activationLine = this.getActivationLine();

    if (rect.top <= activationLine && rect.bottom > 0) {
      return true;
    }

    return this.navigationTarget === 'about' && this.isNearPageBottom();
  }

  private updateActiveSection(): void {
    const activationLine = this.getActivationLine();

    let active: Section | null = null;

    for (const section of this.sections) {
      const element = document.getElementById(section);

      if (element && element.getBoundingClientRect().top <= activationLine) {
        active = section;
      }
    }

    const about = document.getElementById('about');

    if (
      about &&
      this.isNearPageBottom() &&
      about.getBoundingClientRect().top < window.innerHeight
    ) {
      active = 'about';
    }

    this.activeSection.set(active);
  }

  private getActivationLine(): number {
    return Math.max(110, Math.min(window.innerHeight * 0.26, 200));
  }

  private isNearPageBottom(): boolean {
    return document.documentElement.scrollHeight - window.scrollY - window.innerHeight <= 12;
  }
}

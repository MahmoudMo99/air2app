import { ChangeDetectionStrategy, Component, inject } from '@angular/core';
import { ThemeService } from './core/theme.service';
import { Home } from './pages/home/home';
import { Footer } from './shared/footer/footer';
import { Header } from './shared/header/header';

@Component({
  selector: 'app-root',
  imports: [Header, Home, Footer],
  templateUrl: './app.html',
  styleUrl: './app.scss',
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class App {
  readonly theme = inject(ThemeService);
}

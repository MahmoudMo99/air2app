import { ChangeDetectionStrategy, Component } from '@angular/core';
import { Studio } from '../../features/air-drawing/studio/studio';
import { HowItWorks } from './how-it-works/how-it-works';

@Component({
  selector: 'app-home',
  imports: [Studio, HowItWorks],
  templateUrl: './home.html',
  styleUrl: './home.scss',
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class Home {}

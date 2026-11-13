import { ChangeDetectionStrategy, Component, computed, input, signal } from '@angular/core';
import { InteractionTool } from '../../scene/scene.models';

type GuidePhase = 'empty' | 'ready' | 'release' | 'missed' | 'dragging';

@Component({
  selector: 'app-interaction-guide',
  imports: [],
  templateUrl: './interaction-guide.html',
  styleUrl: './interaction-guide.scss',
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class InteractionGuide {
  readonly objectCount = input.required<number>();
  readonly pinching = input.required<boolean>();
  readonly dragging = input.required<boolean>();
  readonly awaitingRelease = input.required<boolean>();
  readonly completedOnce = input.required<boolean>();
  readonly tool = input<InteractionTool>('move');

  private readonly disclosure = signal<'auto' | 'open' | 'closed'>('auto');

  readonly isOpen = computed(() => {
    const disclosure = this.disclosure();

    return disclosure === 'open' || (disclosure === 'auto' && !this.completedOnce());
  });

  readonly phase = computed<GuidePhase>(() => {
    if (this.awaitingRelease()) {
      return 'release';
    }

    if (this.objectCount() === 0) {
      return 'empty';
    }

    if (this.dragging()) {
      return 'dragging';
    }

    if (this.pinching()) {
      return 'missed';
    }

    return 'ready';
  });

  readonly heading = computed(() => {
    switch (this.phase()) {
      case 'empty':
        return 'Create a shape first';
      case 'release':
        return 'Release to continue';
      case 'missed':
        return 'Almost there';
      case 'dragging':
        return this.tool() === 'scale'
          ? 'Resizing your shape'
          : this.tool() === 'rotate'
            ? 'Rotating your shape'
            : "You've got it!";
      default:
        return 'Grab your creation';
    }
  });

  readonly description = computed(() => {
    switch (this.phase()) {
      case 'empty':
        return 'Switch to Draw and create a circle, square, or rectangle.';
      case 'release':
        return 'Open your fingers before starting a new interaction.';
      case 'missed':
        return 'Release, aim inside a shape, and pinch again.';
      case 'dragging':
        return this.tool() === 'scale'
          ? 'Move your hand up to enlarge or down to shrink. Release to finish.'
          : this.tool() === 'rotate'
            ? 'Move your hand sideways to rotate the shape. Release to finish.'
            : 'Move your hand to reposition the shape. Release to place it.';
      default:
        return 'Move the hand cursor inside a shape, then pinch to grab it.';
    }
  });

  readonly finalStep = computed(() => {
    return this.tool() === 'scale'
      ? 'Grow or shrink'
      : this.tool() === 'rotate'
        ? 'Rotate & release'
        : 'Move & release';
  });

  open(): void {
    this.disclosure.set('open');
  }

  close(): void {
    this.disclosure.set('closed');
  }
}

import { ComponentFixture, TestBed } from '@angular/core/testing';
import { beforeEach, describe, expect, it } from 'vitest';
import { InteractionGuide } from './interaction-guide';

describe('InteractionGuide', () => {
  let fixture: ComponentFixture<InteractionGuide>;

  beforeEach(async () => {
    await TestBed.configureTestingModule({
      imports: [InteractionGuide],
    }).compileComponents();

    fixture = TestBed.createComponent(InteractionGuide);

    fixture.componentRef.setInput('objectCount', 1);
    fixture.componentRef.setInput('pinching', false);
    fixture.componentRef.setInput('dragging', false);
    fixture.componentRef.setInput('awaitingRelease', false);
    fixture.componentRef.setInput('completedOnce', false);

    fixture.detectChanges();
  });

  it('shows the three interaction steps', () => {
    const steps = fixture.nativeElement.querySelectorAll('.guide-steps li');

    expect(steps).toHaveLength(3);
    expect(fixture.nativeElement.textContent).toContain('Grab your creation');
  });

  it('explains that an object must be created first', () => {
    fixture.componentRef.setInput('objectCount', 0);
    fixture.detectChanges();

    expect(fixture.nativeElement.textContent).toContain('Create a shape first');
  });

  it('explains how to recover from a missed selection', () => {
    fixture.componentRef.setInput('pinching', true);
    fixture.detectChanges();

    expect(fixture.nativeElement.textContent).toContain('Almost there');

    expect(fixture.nativeElement.textContent).toContain('Release, aim inside a shape');
  });

  it('shows feedback while dragging an object', () => {
    fixture.componentRef.setInput('pinching', true);
    fixture.componentRef.setInput('dragging', true);
    fixture.detectChanges();

    expect(fixture.nativeElement.textContent).toContain("You've got it!");

    expect(fixture.nativeElement.querySelector('.guide-feedback.is-success')).not.toBeNull();
  });

  it('collapses after successful movement and can reopen', () => {
    fixture.componentRef.setInput('completedOnce', true);
    fixture.detectChanges();

    expect(fixture.nativeElement.querySelector('.guide-card')).toBeNull();

    const reopen = fixture.nativeElement.querySelector('.guide-reopen') as HTMLButtonElement;

    expect(reopen).not.toBeNull();

    reopen.click();
    fixture.detectChanges();

    expect(fixture.nativeElement.querySelector('.guide-card')).not.toBeNull();
  });

  it('updates guidance based on the selected transform tool', () => {
    fixture.componentRef.setInput('tool', 'scale');
    fixture.componentRef.setInput('dragging', true);
    fixture.detectChanges();

    expect(fixture.nativeElement.textContent).toContain('Resizing your shape');

    expect(fixture.nativeElement.textContent).toContain('Move your hand up to enlarge');

    fixture.componentRef.setInput('tool', 'rotate');
    fixture.detectChanges();

    expect(fixture.nativeElement.textContent).toContain('Rotating your shape');
  });
});

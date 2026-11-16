/**
 * Air2App Canvas View upgrade (targeted, reversible patch).
 * Run from the Angular project root: node apply-air2app-canvas.mjs
 * Expects the layer-wrapper preparation step already applied.
 */
import fs from 'node:fs';
import path from 'node:path';

const root = process.cwd();
const base = 'src/app/features/air-drawing';
const paths = {
  ts: path.join(root, base, 'studio/studio.ts'),
  html: path.join(root, base, 'studio/studio.html'),
  scss: path.join(root, base, 'studio/studio.scss'),
  effects: path.join(root, base, 'effects/scene-effects.scss'),
  mapper: path.join(root, base, 'gesture-coordinate-mapper.ts'),
};

for (const [name, file] of Object.entries(paths)) {
  if (!fs.existsSync(file)) throw new Error(`Missing ${name}: ${file}`);
}

const rawOriginals = Object.fromEntries(
  Object.entries(paths).filter(([name]) => name !== 'mapper')
    .map(([name, file]) => [name, fs.readFileSync(file, 'utf8')]),
);
const originals = Object.fromEntries(
  Object.entries(rawOriginals).map(([name, content]) => [name, content.replace(/\r\n/g, '\n')]),
);
if (originals.html.includes('class="display-mode-switch"')) {
  throw new Error('Canvas View update appears already applied. No files were changed.');
}
if (!originals.html.includes('class="camera-media"')) {
  throw new Error('Please complete the camera-media wrapper preparation first. No files were changed.');
}

// Fail before writing anything when a required anchor is missing.
function once(source, oldText, newText, label) {
  const first = source.indexOf(oldText);
  if (first < 0 || source.indexOf(oldText, first + 1) >= 0) {
    throw new Error(`Expected exactly one match for: ${label}. No files were changed.`);
  }
  return source.slice(0, first) + newText + source.slice(first + oldText.length);
}
function insertIfAbsent(source, token, target, replacement, label) {
  return source.includes(token) ? source : once(source, target, replacement, label);
}

function updateTS(input) {
  let s = input;
  s = insertIfAbsent(s, "import type { GestureFrame } from '../drawing.models'", "import { DrawingEngineService } from '../drawing-engine.service';",
    "import { DrawingEngineService } from '../drawing-engine.service';\nimport type { GestureFrame } from '../drawing.models';", 'GestureFrame import');
  s = insertIfAbsent(s, "from '../gesture-coordinate-mapper'", "import { DrawingEngineService } from '../drawing-engine.service';",
    "import { DrawingEngineService } from '../drawing-engine.service';\nimport { mapGestureToCanvas } from '../gesture-coordinate-mapper';", 'Coordinate mapper import');

  s = insertIfAbsent(s, "type DisplayMode =", "type InteractionMode = 'draw' | 'interact';",
    "type InteractionMode = 'draw' | 'interact';\ntype DisplayMode = 'canvas' | 'overlay';", 'DisplayMode type');
  s = insertIfAbsent(s, "private cursorRef!", "  @ViewChild('overlay')\n  private overlayRef!: ElementRef<HTMLCanvasElement>;",
    "  @ViewChild('overlay')\n  private overlayRef!: ElementRef<HTMLCanvasElement>;\n\n  @ViewChild('cursorCanvas')\n  private cursorRef!: ElementRef<HTMLCanvasElement>;", 'cursor view child');
  s = insertIfAbsent(s, 'readonly displayMode =', "  readonly interactionMode = signal<InteractionMode>('draw');",
    "  readonly interactionMode = signal<InteractionMode>('draw');\n  readonly displayMode = signal<DisplayMode>('canvas');\n  readonly cameraPreviewVisible = signal(true);", 'display signals');
  if (!s.includes('setDisplayMode(mode: DisplayMode)')) {
    s = once(s, '  setMode(mode: InteractionMode): void {',
`  setDisplayMode(mode: DisplayMode): void {
    if (
      !this.isRunning() || this.displayMode() === mode ||
      this.isPinching() || this.isDragging() || this.waitingForRelease()
    ) {
      return;
    }

    this.displayMode.set(mode);
    this.wakePhysics();
  }

  toggleCameraPreview(): void {
    if (!this.isRunning()) return;
    this.cameraPreviewVisible.update((visible) => !visible);
  }

  setMode(mode: InteractionMode): void {`, 'display methods');
  }
  if (!s.includes("this.displayMode.set('canvas');")) {
    s = once(s, "      this.interactionMode.set('draw');\n      this.waitingForRelease.set(false);",
      "      this.interactionMode.set('draw');\n      this.displayMode.set('canvas');\n      this.cameraPreviewVisible.set(true);\n      this.waitingForRelease.set(false);", 'camera session default');
  }
  s = once(s, '    if (!this.isFullscreen()) {\n      return viewport;\n    }',
    "    if (!this.isFullscreen() || this.displayMode() === 'canvas') {\n      return viewport;\n    }", 'physics viewport in canvas view');
  s = once(s, '    this.resetPhysics();\n    this.interaction.reset();\n    this.interaction.setTool(\'move\');\n\n    this.drawing.setSelectionVisible(false);',
`    const cursorCanvas = this.cursorRef?.nativeElement;
    if (cursorCanvas) {
      cursorCanvas.getContext('2d')?.clearRect(0, 0, cursorCanvas.width, cursorCanvas.height);
    }

    this.resetPhysics();
    this.interaction.reset();
    this.interaction.setTool('move');

    this.drawing.setSelectionVisible(false);`, 'stop camera cursor clear');
  s = once(s, '          const gesture = this.gesture.update(hand, now);',
    '          const gesture = this.gesture.update(hand, now);\n          const canvasGesture = mapGestureToCanvas(gesture);\n          this.renderGestureCursor(canvasGesture);', 'map gesture in tracking loop');
  s = once(s, '              this.drawing.draw(gesture.cursor.x, gesture.cursor.y);',
    '              this.drawing.draw(canvasGesture.cursor.x, canvasGesture.cursor.y);', 'mapped draw');
  s = once(s, "            if ((gesture.action === 'start' || gesture.action === 'draw') && gesture.cursor) {",
    "            if ((gesture.action === 'start' || gesture.action === 'draw') && canvasGesture.cursor) {", 'mapped cursor condition');
  s = once(s, '            const changed = this.interaction.handle(gesture, video.videoWidth, video.videoHeight);',
`            const canvas = this.drawingRef.nativeElement;
            const changed = this.interaction.handle(canvasGesture, canvas.width, canvas.height);`, 'mapped scene interaction');
  if (!s.includes('private renderGestureCursor(')) {
    s = once(s, '  private detectHands = (): void => {',
`  private renderGestureCursor(gesture: GestureFrame): void {
    const canvas = this.cursorRef?.nativeElement;
    const reference = this.drawingRef?.nativeElement;
    if (!canvas || !reference || !reference.width || !reference.height) return;

    if (canvas.width !== reference.width || canvas.height !== reference.height) {
      canvas.width = reference.width;
      canvas.height = reference.height;
    }

    const ctx = canvas.getContext('2d');
    if (!ctx) return;

    ctx.clearRect(0, 0, canvas.width, canvas.height);
    if (this.displayMode() !== 'canvas' || this.waitingForRelease() || !gesture.cursor) return;

    const x = gesture.cursor.x * canvas.width;
    const y = gesture.cursor.y * canvas.height;
    const active = gesture.active;
    const color = active ? '#52f5d0' : '#b6a4ff';

    ctx.save();
    ctx.beginPath();
    ctx.arc(x, y, active ? 13 : 9, 0, Math.PI * 2);
    ctx.fillStyle = active ? 'rgba(82,245,208,0.20)' : 'rgba(182,164,255,0.20)';
    ctx.strokeStyle = color;
    ctx.lineWidth = 2;
    ctx.shadowColor = color;
    ctx.shadowBlur = active ? 20 : 10;
    ctx.fill();
    ctx.stroke();
    ctx.shadowBlur = 0;
    ctx.beginPath();
    ctx.arc(x, y, 3, 0, Math.PI * 2);
    ctx.fillStyle = color;
    ctx.fill();
    ctx.restore();
  }

  private detectHands = (): void => {`, 'gesture cursor renderer');
  }
  return s;
}

function updateHTML(input) {
  let s = input;
  s = once(s, 'class="camera-surface" [class.is-demo]="isDemo()"',
`class="camera-surface"
          [class.is-demo]="isDemo()"
          [class.is-canvas-view]="isRunning() && displayMode() === 'canvas'"
          [class.is-overlay-view]="isRunning() && displayMode() === 'overlay'"
          [class.is-preview-hidden]="!cameraPreviewVisible()"`, 'stage view classes');
  s = once(s, '<canvas #drawingCanvas class="drawing-layer" aria-label="Air drawing canvas"></canvas>',
`<canvas #drawingCanvas class="drawing-layer" aria-label="Air drawing canvas"></canvas>
          <canvas #cursorCanvas class="cursor-layer" aria-hidden="true"></canvas>`, 'cursor canvas');
  s = once(s, '[mirrored]="isRunning()"',
    '[mirrored]="false"\n              [class.is-canvas-view]="isRunning() && displayMode() === \'canvas\'"', 'effects alignment');
  s = once(s,
`            @if (isActive()) {
              <button
                type="button"
                class="physics-toggle"`,
`            @if (isFullscreen() && isRunning()) {
              <button type="button" class="fullscreen-display-toggle"
                [disabled]="isPinching() || isDragging() || waitingForRelease()"
                (click)="setDisplayMode(displayMode() === 'canvas' ? 'overlay' : 'canvas')">
                {{ displayMode() === 'canvas' ? 'Camera Overlay' : 'Canvas View' }}
              </button>
              @if (displayMode() === 'canvas') {
                <button type="button" class="fullscreen-display-toggle"
                  (click)="toggleCameraPreview()">
                  {{ cameraPreviewVisible() ? 'Hide preview' : 'Show preview' }}
                </button>
              }
            }

            @if (isActive()) {
              <button
                type="button"
                class="physics-toggle"`,
    'fullscreen view buttons');
  s = once(s,
`        <div class="panel-topline">
          <span>THE CONTROL DECK</span>
        </div>`,
`        <div class="panel-topline">
          <span>THE CONTROL DECK</span>
        </div>

        @if (isRunning()) {
          <div class="display-deck" aria-label="Camera display settings">
            <div class="display-deck-title">DISPLAY VIEW</div>
            <div class="display-mode-switch" role="group" aria-label="Drawing display mode">
              <button type="button" [class.is-active]="displayMode() === 'canvas'"
                [attr.aria-pressed]="displayMode() === 'canvas'"
                [disabled]="isPinching() || isDragging() || waitingForRelease()"
                (click)="setDisplayMode('canvas')">Canvas</button>
              <button type="button" [class.is-active]="displayMode() === 'overlay'"
                [attr.aria-pressed]="displayMode() === 'overlay'"
                [disabled]="isPinching() || isDragging() || waitingForRelease()"
                (click)="setDisplayMode('overlay')">Camera Overlay</button>
            </div>
            @if (displayMode() === 'canvas') {
              <button class="camera-preview-toggle" type="button"
                [attr.aria-pressed]="cameraPreviewVisible()"
                (click)="toggleCameraPreview()">
                {{ cameraPreviewVisible() ? 'Hide camera preview' : 'Show camera preview' }}
              </button>
              <p class="camera-preview-note">The camera stays active while its preview is hidden.</p>
            }
          </div>
        }`, 'display deck');
  return s;
}

function updateSCSS(input) {
  let s = input;
  const start = s.indexOf('.camera-surface {');
  const end = s.indexOf('\n.studio-mode-switch {', start);
  if (start < 0 || end < 0) throw new Error('Cannot locate stage SCSS block. No files were changed.');
  const block = `.camera-surface {
  position: relative;
  isolation: isolate;
  flex: 1 1 auto;
  min-height: 590px;
  overflow: hidden;
  background:
    radial-gradient(circle at 52% 38%, rgba(49, 87, 246, 0.1), transparent 48%),
    var(--stage-deep);
}

// Overlay view keeps the existing camera / drawing / landmarks stacking.
// In Canvas View the same live camera wrapper becomes a small preview.
.camera-media {
  position: absolute;
  inset: 0;
}

.camera-media > video,
.camera-media > .tracking-layer,
.camera-surface > .drawing-layer,
.camera-surface > .cursor-layer {
  position: absolute;
  inset: 0;
  display: block;
  width: 100%;
  height: 100%;
  object-fit: cover;
  pointer-events: none;
}

.camera-media > video,
.camera-media > .tracking-layer {
  transform: scaleX(-1);
}

// Drawing and effects now use unmirrored scene coordinates.
// Mirroring is applied once by gesture-coordinate-mapper.ts.
.camera-surface > .drawing-layer,
.camera-surface > .cursor-layer {
  transform: none;
}

.camera-media > video { z-index: 1; }
.camera-surface > .drawing-layer { z-index: 2; }
.camera-media > .tracking-layer { z-index: 3; }
.camera-surface > .cursor-layer { z-index: 5; }

.camera-surface.is-overlay-view > .cursor-layer { display: none; }

.camera-surface.is-canvas-view {
  background:
    radial-gradient(circle at 50% 40%, rgba(49,87,246,.10), transparent 55%),
    linear-gradient(rgba(151,179,196,.038) 1px, transparent 1px),
    linear-gradient(90deg, rgba(151,179,196,.038) 1px, transparent 1px),
    var(--stage-deep);
  background-size: auto, 36px 36px, 36px 36px, auto;

  > .drawing-layer,
  > .cursor-layer {
    object-fit: contain;
  }

  > .camera-media {
    z-index: 8;
    inset: auto auto 18px 18px;
    width: clamp(150px, 25%, 232px);
    height: auto;
    aspect-ratio: 16 / 9;
    overflow: hidden;
    border: 1px solid rgba(154, 173, 255, 0.55);
    border-radius: 12px;
    background: #0b141b;
    box-shadow: 0 12px 35px rgba(0, 0, 0, .4);
    transition: opacity .2s ease;

    &::after {
      content: 'CAMERA LIVE';
      position: absolute;
      z-index: 4;
      top: 8px;
      left: 8px;
      padding: 4px 6px;
      border-radius: 5px;
      background: rgba(11,20,27,.78);
      color: #c7fff0;
      font-family: var(--font-mono);
      font-size: 8px;
      letter-spacing: .07em;
      pointer-events: none;
    }
  }
}

.camera-surface.is-canvas-view.is-preview-hidden > .camera-media {
  opacity: 0;
  visibility: hidden;
  pointer-events: none;
}

.camera-surface.is-demo {
  > .camera-media,
  > .drawing-layer,
  > .cursor-layer {
    display: none;
  }
}
`;
  s = s.slice(0, start) + block + s.slice(end);
  s = once(s, '.physics-toggle {', '.physics-toggle,\n.fullscreen-display-toggle {', 'fullscreen view button styling');
  // Append deck styling above responsive rules. It lives in the current Control Deck.
  const marker = '\n.stage-shell:fullscreen,';
  const css = `
.display-deck {
  margin-top: 20px;
  padding: 14px;
  border: 1px solid var(--border);
  border-radius: 12px;
  background: var(--surface-alt);
}

.display-deck-title {
  margin-bottom: 9px;
  color: var(--muted);
  font-family: var(--font-mono);
  font-size: 9px;
  letter-spacing: .07em;
}

.display-mode-switch {
  display: grid;
  grid-template-columns: 1fr 1fr;
  gap: 5px;
  padding: 4px;
  border: 1px solid var(--border);
  border-radius: 10px;
  background: var(--surface);
}

.display-mode-switch button {
  min-width: 0;
  min-height: 36px;
  padding: 7px 9px;
  border: 0;
  border-radius: 7px;
  color: var(--muted);
  background: transparent;
  font-size: 11px;
  font-weight: 700;
  cursor: pointer;
  transition: background .2s ease, color .2s ease;

  &.is-active { color: white; background: #3157f6; }
  &:disabled { opacity: .45; cursor: not-allowed; }
  &:focus-visible { outline: 2px solid var(--accent); outline-offset: 2px; }
}

.camera-preview-toggle {
  margin-top: 10px;
  padding: 4px 0;
  border: 0;
  color: var(--accent);
  background: transparent;
  font-size: 11px;
  font-weight: 750;
  cursor: pointer;

  &:focus-visible { outline: 2px solid var(--accent); outline-offset: 3px; }
}

.camera-preview-note {
  margin: 3px 0 0;
  color: var(--muted);
  font-size: 10px;
  line-height: 1.5;
}
`;
  s = once(s, marker, css + marker, 'display deck styles');
  s = once(s, '\n@media (max-width: 1160px) {',
    `\n@media (max-width: 1160px) {\n  .display-deck { grid-column: 1 / -1; }\n`,
    'tablet display deck');
  s = once(s, '\n@media (max-width: 640px) {', `
@media (max-width: 640px) {
  .camera-surface.is-canvas-view > .camera-media {
    width: clamp(135px, 38%, 170px);
    inset: auto auto 12px 12px;
  }

  .display-deck { margin-top: 14px; }
`, 'mobile preview');
  s = once(s, '  .fullscreen-toggle,\n  .stage-quick-clear,',
    '  .display-mode-switch button,\n  .camera-media,\n  .fullscreen-toggle,\n  .stage-quick-clear,', 'reduced motion transitions');
  return s;
}

function updateEffects(input) {
  if (input.includes(':host(.is-canvas-view)')) {
    throw new Error('SceneEffects already has Canvas View styles. No files were changed.');
  }
  return input.trimEnd() + `\n\n// Keep effects aligned with the contain-fitted drawing in Canvas View.\n:host(.is-canvas-view) .effects-canvas {\n  object-fit: contain;\n}\n`;
}

let updates;
try {
  updates = {
    ts: updateTS(originals.ts),
    html: updateHTML(originals.html),
    scss: updateSCSS(originals.scss),
    effects: updateEffects(originals.effects),
  };
} catch (error) {
  console.error(error.message);
  process.exit(1);
}

// Backups are made only after all checks and transformations succeed.
for (const [name, output] of Object.entries(updates)) {
  fs.copyFileSync(paths[name], `${paths[name]}.before-canvas-view.bak`);
  const originalEol = rawOriginals[name].includes('\r\n') ? '\r\n' : '\n';
  fs.writeFileSync(paths[name], output.replace(/\n/g, originalEol), 'utf8');
  console.log(`Updated ${path.relative(root, paths[name])}`);
}
console.log('Done. Run: npm run build');

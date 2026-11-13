<div align="center">

# Air2App

### Make the air your canvas.

A gesture-powered creative studio that transforms hand movements into interactive digital creations.

Built with **Angular, TypeScript, MediaPipe, and HTML5 Canvas**.

[**Live Demo**](https://air2app.vercel.app/) · [**Source Code**](https://github.com/MahmoudMo99/air2app)

![Angular](https://img.shields.io/badge/Angular-22-DD0031?logo=angular&logoColor=white)
![TypeScript](https://img.shields.io/badge/TypeScript-6-3178C6?logo=typescript&logoColor=white)
![MediaPipe](https://img.shields.io/badge/MediaPipe-Hand_Tracking-00A67E)
![Vercel](https://img.shields.io/badge/Deployed_on-Vercel-000000?logo=vercel&logoColor=white)

</div>

---

## Overview

**Air2App** is an interactive web application that explores a different way to create and interact with digital content: using hand gestures instead of traditional input devices.

Powered by real-time hand tracking, Air2App allows users to draw in the air, recognize geometric shapes, and manipulate their creations through natural movements.

It also includes a camera-free interactive demo, making the experience accessible through mouse and touch controls.

**[Explore Air2App →](https://air2app.vercel.app/)**

## Key Features

- **Real-Time Hand Tracking** — Detect and track hand landmarks using MediaPipe.
- **Gesture-Based Drawing** — Pinch to draw directly on a digital canvas.
- **Shape Recognition** — Identify circles, squares, and rectangles from drawn strokes.
- **Object Interaction** — Move, scale, and rotate recognized shapes.
- **Interactive Physics** — Enable physics-driven motion for scene objects.
- **Camera-Free Demo** — Explore object interactions using mouse or touch.
- **Responsive Studio** — An adaptive interface with fullscreen support.
- **Light & Dark Themes** — Switch between two carefully designed visual experiences.

## How It Works

Air2App turns hand movement into interactive objects through four stages:

| Stage             | Description                                                                   |
| ----------------- | ----------------------------------------------------------------------------- |
| **01. Track**     | MediaPipe detects hand landmarks from the camera feed.                        |
| **02. Draw**      | Pinch gestures translate hand movement into digital strokes.                  |
| **03. Recognize** | Completed strokes are analyzed for supported geometric shapes.                |
| **04. Interact**  | Recognized objects can be moved, resized, rotated, and animated with physics. |

### Interaction Modes

**Camera Mode**

Use your webcam and hand gestures to create and interact with shapes.

**Demo Mode**

Explore a ready-made scene using your mouse or touch, without enabling the camera.

## Tech Stack

| Technology             | Purpose                                     |
| ---------------------- | ------------------------------------------- |
| Angular 22             | Component-based application architecture    |
| TypeScript 6           | Application logic and type safety           |
| MediaPipe Tasks Vision | Real-time hand landmark detection           |
| HTML5 Canvas API       | Drawing, rendering, and visual interactions |
| SCSS                   | Responsive styling and design system        |
| Angular Signals        | Reactive state management                   |
| Vercel                 | Hosting and deployment                      |

## Architecture

Air2App separates gesture tracking, drawing, scene management, rendering, and user interaction into dedicated modules.

The main parts include:

- **Hand Tracking Service** — Processes camera input and hand landmarks.
- **Drawing Engine** — Converts gestures into drawable strokes.
- **Shape Recognition Service** — Analyzes strokes to identify supported shapes.
- **Scene Store** — Manages objects and scene state.
- **Scene Renderer** — Renders shapes and selection feedback on Canvas.
- **Object Interaction Controller** — Handles movement, scaling, and rotation.
- **Scene Effects** — Coordinates visual effects and physics updates.

The application uses Angular's standalone components, signals, and `OnPush` change detection to organize its interactive UI.

## Getting Started

### Prerequisites

- Node.js 24.x
- npm
- A modern browser
- A webcam (optional for Demo Mode)

### Installation

Clone the repository:

```bash
git clone https://github.com/MahmoudMo99/air2app.git
cd air2app
```

Install dependencies:

```bash
npm install
```

Start the development server:

```bash
npm start
```

Open **http://localhost:4200/** in your browser.

### Production Build

```bash
npm run build
```

The browser build output is generated in:

```text
dist/air2app/browser
```

## Browser & Camera Notes

- Camera Mode requires webcam permission.
- Camera access requires HTTPS in production or localhost during development.
- Hand tracking performance may vary depending on the device, browser, and lighting conditions.
- Demo Mode works without camera access.
- For the best hand-tracking experience, use a modern browser and a well-lit environment.

## Author

**Mahmoud Mohamed**

Software Engineer · Angular Developer · External Instructor at ITI

[Portfolio](https://mahmoud-mohamed-portfolio.vercel.app/) · [LinkedIn](https://www.linkedin.com/in/mahmoud-mo-mahmoud/) · [GitHub](https://github.com/MahmoudMo99)

---

<div align="center">

**Air2App — Create beyond the click.**

Made with creativity, curiosity, and code.

</div>

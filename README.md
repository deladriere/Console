# Console (Visual) — v1.0

![Console screenshot](./image.png)

Console is a companion display for **Talko / Kraftor / Emy**.
It receives text over **Serial** (Web Serial) or **MIDI** information and displays it in real time, driven by the speech / text stream coming from those tools.

It can also use your **audio input** as a live source for visual effects and animations (Scope, Hydra, and other effects).

## Download / install

- Download **`Console.html`** (that’s all you need).
- `README.md` and `image.png` are only for documentation/screenshot.

## Run it

### Browser requirements

- **Serial** requires a browser that supports **Web Serial** (typically Chromium-based browsers like Chrome / Edge).


### Opening the HTML file

- You can open `Console.html` directly (double-click).
- Note: **Web Serial usually does not work from `file://`** URLs in modern browsers.

## Connect Serial

1. Open **Serial → Connect Port**
2. Choose the device/port.
3. When connected, the red dot becomes **green**.

Incoming text/numbers are displayed live (Numbers modes / Words mode).

## Audio input (microphone)

Some modes use the microphone as a live source:

- **Scope**: oscilloscope / frequency bars.
- **Hydra**: audio-reactive background patterns.

Your browser may ask for microphone permission when enabling these features.

## Keyboard shortcuts

- **Space**: hide/show the top menu bar
- **D**: toggle developer mode (shows extra menus)


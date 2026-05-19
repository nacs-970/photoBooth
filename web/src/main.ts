import './app.css';
import App from './App.svelte';
import { mount } from 'svelte';
import { preloadShutterSound } from '$lib/audio.ts';

// Preload shutter sound on app startup so it is buffered before first capture.
// See RESEARCH.md Pattern 6: Audio Autoplay Gating.
preloadShutterSound('/sounds/shutter.mp3');

mount(App, { target: document.getElementById('app')! });

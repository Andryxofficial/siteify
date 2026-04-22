/**
 * Andryx Hourglass — Engine.
 *
 * Orchestra:
 *   – State (state.js)
 *   – InputAdapter (input.js)
 *   – Renderer (render.js)
 *   – Scene caricate dinamicamente (scenes/*.js)
 *
 * Loop a 60fps via requestAnimationFrame. Le scene vengono importate
 * lazy alla prima visita (cache locale `loadedScenes`).
 *
 * Espone `cleanup()` per smontare tutto.
 */
import { makeInitialState, heal } from './state.js';
import { InputAdapter } from './input.js';
import { Renderer3D } from './renderer3d.js';
import { setMuted, ensureAudio, stopMusic, SFX } from './audio.js';
import { t } from './i18n.js';

/* Loader → Promise<scene-factory>. La factory ha forma createXxxScene(state). */
const SCENE_LOADERS = {
  sea:    () => import('./scenes/sea.js').then(m => m.createSeaScene),
  mercay: () => import('./scenes/mercay.js').then(m => m.createMercayScene),
  temple: () => import('./scenes/temple.js').then(m => m.createTempleScene),
  fire:   () => import('./scenes/fire.js').then(m => m.createFireScene),
};

const loadedFactories = new Map();

async function loadSceneFactory(id) {
  if (loadedFactories.has(id)) return loadedFactories.get(id);
  const loader = SCENE_LOADERS[id];
  if (!loader) throw new Error('Unknown scene: ' + id);
  const factory = await loader();
  loadedFactories.set(id, factory);
  return factory;
}

export function startEngine(canvas, callbacks, opts = {}) {
  const state = makeInitialState(opts.savedData);
  const renderer = new Renderer3D(canvas);
  const input = new InputAdapter(callbacks);

  let currentScene = null;
  let currentSceneId = null;
  let loading = true;
  let loadingText = t('ui.loading_scene', { scene: t('scene.' + state.sceneId) });

  let frame = 0;
  let rafId = null;
  let stopped = false;

  /* UI overlay state (inventory + pause) */
  let inventoryOpen = false;
  let inventoryAnim = 0;       /* 0..1 anim apertura */
  let paused = false;
  let gameOverShown = false;
  let winShown = false;

  /* Notify callbacks su cambio HP */
  let lastHp = state.hp;
  function notifyHp() {
    if (state.hp !== lastHp) {
      lastHp = state.hp;
      if (callbacks.onHpChange) {
        callbacks.onHpChange(state.hp, state.maxHp);
      }
    }
  }
  function notifyScore() {
    if (callbacks.onScore) callbacks.onScore(state.score);
  }

  /* Carica scena iniziale */
  async function loadAndStartScene(sceneId) {
    loading = true;
    loadingText = t('ui.loading_scene', { scene: t('scene.' + sceneId) });
    try {
      const factory = await loadSceneFactory(sceneId);
      /* Dispose vecchia scena */
      if (currentScene && currentScene.dispose) currentScene.dispose();
      stopMusic();
      currentScene = factory(state);
      currentSceneId = sceneId;
      state.sceneId = sceneId;
      state.nextSceneId = null;
      /* Inizializza la scena 3D (aggiunge mesh alla scena Three.js) */
      if (currentScene.setup3D) currentScene.setup3D(renderer);
      /* Auto-save su transizione */
      if (opts.onAutoSave) {
        try { opts.onAutoSave({ ...state }); } catch { /* ignored */ }
      }
      renderer.startFadeIn();
    } catch (err) {
      console.error('[hourglass] scene load failed:', err);
      loadingText = '⚠ Errore caricamento scena';
    } finally {
      loading = false;
    }
  }

  loadAndStartScene(state.sceneId);

  function step() {
    if (stopped) return;
    frame++;

    /* Audio: assicurati AC sia attivo (suspend dopo first-load) */
    if (frame === 1) ensureAudio();

    /* Update fade/shake/toast sempre */
    renderer.updateFade();
    renderer.updateShake();
    renderer.updateToast();

    input.poll();

    /* Game over: mostra overlay e attendi azione → exit */
    if (state.flags.gameover && !gameOverShown) {
      gameOverShown = true;
      stopMusic();
      if (callbacks.onGameOver) callbacks.onGameOver(state.score);
    }
    if (state.flags.win && !winShown) {
      winShown = true;
      stopMusic();
      SFX.victory();
      /* Submit score finale poi delega a onGameOver per chiudere */
      setTimeout(() => {
        if (callbacks.onGameOver) callbacks.onGameOver(state.score);
      }, 2500);
    }

    /* Pause toggle */
    if (input.isPauseToggled() && !loading && !state.flags.gameover) {
      paused = !paused;
    }
    /* Inventory toggle */
    if (input.isInventoryToggled() && !loading && !state.flags.gameover) {
      inventoryOpen = !inventoryOpen;
    }
    /* Anim inventory */
    if (inventoryOpen) inventoryAnim = Math.min(1, inventoryAnim + 0.18);
    else                inventoryAnim = Math.max(0, inventoryAnim - 0.18);

    /* Use potion */
    if (input.isPotionUsed() && state.items.potions > 0 && state.hp < state.maxHp) {
      state.items.potions--;
      heal(state, 4);
      renderer.showToast(t('toast.potion_used'));
      SFX.heart();
    } else if (input.isPotionUsed() && state.items.potions === 0) {
      renderer.showToast(t('toast.no_potion'));
    } else if (input.isPotionUsed()) {
      renderer.showToast(t('toast.full_hp'));
    }

    /* Update scena (solo se non in pausa, no inventory, non in loading, non gameover) */
    if (!loading && currentScene && !paused && !inventoryOpen && !state.flags.gameover && !state.flags.win) {
      try {
        currentScene.update(input, state, frame);
      } catch (err) {
        console.error('[hourglass] scene.update error:', err);
      }
      /* Tempo trascorso */
      state.elapsedMs += 1000 / 60;
      /* Toast da scena */
      if (currentScene.pullToast) {
        const ts = currentScene.pullToast();
        if (ts) renderer.showToast(ts);
      }
      /* Transizione scena */
      if (state.nextSceneId && state.nextSceneId !== currentSceneId) {
        const nextId = state.nextSceneId;
        renderer.startFadeOut(() => { loadAndStartScene(nextId); });
        state.nextSceneId = null;
      }
    }

    /* Render 3D */
    if (currentScene && currentScene.syncMeshes) {
      try { currentScene.syncMeshes(state); } catch (err) {
        console.error('[hourglass] scene.syncMeshes error:', err);
      }
    }
    /* Camera shake tramite offset temporaneo sulla posizione */
    const { ox, oy } = renderer.applyShakeOffset();
    if (ox || oy) {
      renderer.camera.position.x += ox * 0.05;
      renderer.camera.position.z += oy * 0.05;
    }
    renderer.render();
    if (ox || oy) {
      renderer.camera.position.x -= ox * 0.05;
      renderer.camera.position.z -= oy * 0.05;
    }

    /* HUD 2D overlay sopra il canvas WebGL */
    renderer.clearHud();
    renderer.drawHud(state);
    /* Dialog se la scena ne ha uno */
    if (currentScene && currentScene.getDialog) {
      const d = currentScene.getDialog();
      if (d) renderer.drawDialog(d);
    }
    /* Toast */
    renderer.drawToast();
    /* Inventory overlay */
    if (inventoryAnim > 0) renderer.drawInventory(state, inventoryAnim);
    /* Pause overlay */
    if (paused) renderer.drawPause();
    /* Loading overlay */
    if (loading) renderer.drawLoading(loadingText);
    /* Game over / win */
    if (state.flags.gameover) {
      renderer.drawGameOver(t('meta.gameOverTitle'), 'Punteggio: ' + state.score);
    } else if (state.flags.win) {
      renderer.drawWin();
    }
    /* Fade ultimo */
    renderer.drawFade();

    /* Notifications */
    notifyHp();
    notifyScore();

    rafId = requestAnimationFrame(step);
  }

  rafId = requestAnimationFrame(step);

  return {
    cleanup() {
      stopped = true;
      if (rafId) cancelAnimationFrame(rafId);
      if (currentScene && currentScene.dispose) currentScene.dispose();
      stopMusic();
      renderer.dispose();
    },
    getState() { return { ...state }; },
    setMuted(m) { setMuted(m); },
  };
}

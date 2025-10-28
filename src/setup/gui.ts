import * as dat from "lil-gui";
import { SolarSystem } from "./solar-system";
import { LAYERS } from "../constants";
import { eventBus } from "../voice/eventBus";

export const options = {
  showPaths: false,
  showMoons: true,
  focus: "Sun",
  clock: true,
  speed: 0.125,
  zangle: 0,
  yangle: 0,
  voiceEnabled: false,
  narrationEnabled: false,
};

export const createGUI = (
  ambientLight: THREE.AmbientLight,
  solarSystem: SolarSystem,
  clock: THREE.Clock,
  camera: THREE.Camera,
  handControls?: any
) => {
  const gui = new dat.GUI();

  gui.title("Simulation Controls");

  gui.add(ambientLight, "intensity", 0, 1, 0.01).name("Ambient Intensity");

  // Toggle moons
  gui
    .add(options, "showMoons")
    .name("Show Moons")
    .onChange((value: boolean) => {
      for (const name in solarSystem) {
        const object = solarSystem[name];
        if (object.type === "moon") {
          object.mesh.visible = value;
        }
      }
    });

  // Pause the simulation
  gui
    .add(options, "clock")
    .name("Run")
    .onChange((value: boolean) => {
      value ? clock.start() : clock.stop();
    });

  // Control the simulation speed
  gui.add(options, "speed", 0.1, 20, 0.1).name("Speed");

  gui
    .add(options, "voiceEnabled")
    .name("Enable Voice")
    .onChange((enabled: boolean) => {
      eventBus.emit("voiceToggle", { enabled });
    });

  gui
    .add(options, "narrationEnabled")
    .name("Enable Narration")
    .onChange((enabled: boolean) => {
      eventBus.emit("narrationToggle", { enabled });
    });

  if (handControls) {
    const handFolder = gui.addFolder("Hand Controls");

    const handState = { enabled: true };
    const sensitivity = { zoom: 10, rotation: 2, deadZone: 0.1 };

    handFolder
      .add(handState, "enabled")
      .name("Enable Hand Gestures")
      .onChange((value: boolean) => {
        handControls.setEnabled(value);
      });

    handFolder
      .add(sensitivity, "zoom", 1, 30)
      .name("Zoom Sensitivity")
      .onChange((value: number) => {
        handControls.setSensitivity(value, undefined);
      });

    handFolder
      .add(sensitivity, "rotation", 0.5, 10)
      .name("Rotation Sensitivity")
      .onChange((value: number) => {
        handControls.setSensitivity(undefined, value);
      });

    handFolder
      .add(sensitivity, "deadZone", 0, 0.5)
      .name("Dead Zone")
      .onChange((value: number) => {
        handControls.setDeadZone(value);
      });

    handFolder.close();
  }

  gui.hide();

  // Toggle ambient lights
  document.getElementById("btn-ambient")?.addEventListener("click", () => {
    ambientLight.intensity = ambientLight.intensity === 0.1 ? 0.5 : 0.1;
  });

  // Toggle labels
  document.getElementById("btn-labels")?.addEventListener("click", () => {
    camera.layers.toggle(LAYERS.POILabel);
  });

  // Toggle paths
  document.getElementById("btn-paths")?.addEventListener("click", () => {
    options.showPaths = !options.showPaths;

    for (const name in solarSystem) {
      const object = solarSystem[name];
      if (object.path) {
        object.path.visible = options.showPaths;
      }
    }
  });

  // Toggle GUI panel
  document.getElementById("btn-settings")?.addEventListener("click", () => {
    gui.show(gui._hidden);
  });
};

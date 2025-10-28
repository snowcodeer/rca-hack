import * as THREE from "three";
import { OrbitControls } from "three/examples/jsm/controls/OrbitControls";
import { CSS2DRenderer } from "three/examples/jsm/renderers/CSS2DRenderer";
import { EffectComposer } from "three/examples/jsm/postprocessing/EffectComposer";
import { RenderPass } from "three/examples/jsm/postprocessing/RenderPass";
import { UnrealBloomPass } from "three/examples/jsm/postprocessing/UnrealBloomPass";
import { createEnvironmentMap } from "./setup/environment-map";
import { createLights } from "./setup/lights";
import { createSolarSystem } from "./setup/solar-system";
import { createGUI, options } from "./setup/gui";
import { LAYERS } from "./constants";
import { eventBus } from "./voice/eventBus";
import { VoiceNavigationController } from "./voice/navigation";
import { WelcomeNarrator } from "./voice/welcomeNarrator";
import { HandTrackerV2 } from "./hand-tracking/hand-tracker";
import { GestureEngine } from "./hand-tracking/gesture-engine";
import { HandGestureControlsV2 } from "./hand-tracking/hand-gesture-controls-v2";

THREE.ColorManagement.enabled = false;

// Canvas
const canvas = document.querySelector("canvas.webgl") as HTMLElement;

// Scene
const scene = new THREE.Scene();

// Environment map
scene.background = createEnvironmentMap("./textures/environment");

// Lights
const [ambientLight, pointLight] = createLights();
scene.add(ambientLight, pointLight);

// Sizes
const sizes = {
  width: window.innerWidth,
  height: window.innerHeight,
};

window.addEventListener("resize", () => {
  // Update sizes
  sizes.width = window.innerWidth;
  sizes.height = window.innerHeight;

  // Update camera
  camera.aspect = sizes.width / sizes.height;
  camera.updateProjectionMatrix();

  // Update renderers
  renderer.setSize(sizes.width, sizes.height);
  renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2));
  bloomComposer.setSize(sizes.width, sizes.height);
  labelRenderer.setSize(sizes.width, sizes.height);
});

// Solar system
const [solarSystem, planetNames] = createSolarSystem(scene);

// Hemisphere detection system
interface HemisphereData {
  name: string;
  facts: Array<{
    label: string;
    value: string;
  }>;
}

// Fun facts system for all planets (different facts for each hemisphere view)
const planetFunFacts: Record<string, Record<string, string[]>> = {
  "sun": {
    "northern": [
      "The Sun contains 99.86% of the solar system's mass!",
      "Every second, the Sun converts 4 million tons of matter into energy.",
      "The Sun's core temperature is 15 million°C (27 million°F)."
    ],
    "southern": [
      "Light from the Sun takes 8 minutes and 20 seconds to reach Earth.",
      "The Sun is actually white, not yellow - it appears yellow due to Earth's atmosphere.",
      "The Sun has been shining for about 4.6 billion years."
    ]
  },
  "mercury": {
    "northern": [
      "Mercury has no atmosphere, so it can't trap heat from the Sun.",
      "A day on Mercury lasts 176 Earth days - longer than its year!",
      "Mercury is shrinking! The planet is getting smaller due to cooling."
    ],
    "southern": [
      "Despite being closest to the Sun, Mercury isn't the hottest planet.",
      "Mercury has the most extreme temperature variations in the solar system.",
      "Mercury has a large iron core that makes up about 75% of its radius."
    ]
  },
  "venus": {
    "northern": [
      "Venus rotates backwards compared to most planets!",
      "A day on Venus is longer than its year (243 vs 225 Earth days).",
      "Venus is the hottest planet at 462°C (864°F) - hotter than Mercury!"
    ],
    "southern": [
      "Venus has acid rain made of sulfuric acid.",
      "The pressure on Venus is 92 times greater than Earth's surface.",
      "Venus is often called Earth's twin due to similar size and composition."
    ]
  },
  "earth": {
    "northern": [
      "Earth is the only known planet with life in the universe.",
      "71% of Earth's surface is covered by water.",
      "Earth's magnetic field protects us from harmful solar radiation."
    ],
    "southern": [
      "The Earth is not perfectly round - it's slightly flattened at the poles.",
      "Earth is the densest planet in the solar system.",
      "Earth has the strongest magnetic field of all the terrestrial planets."
    ]
  },
  "moon": {
    "northern": [
      "The Moon is slowly moving away from Earth at 3.8 cm per year.",
      "The Moon has moonquakes caused by Earth's gravitational pull.",
      "You would weigh 1/6th of your Earth weight on the Moon."
    ],
    "southern": [
      "The Moon has no atmosphere, so there's no weather or wind.",
      "The same side of the Moon always faces Earth due to tidal locking.",
      "The Moon was likely formed from debris after a Mars-sized object hit Earth."
    ]
  },
  "mars": {
    "northern": [
      "Mars has the largest volcano in the solar system - Olympus Mons.",
      "Mars has two small moons: Phobos and Deimos.",
      "Mars has polar ice caps made of water and carbon dioxide."
    ],
    "southern": [
      "A day on Mars is almost the same length as Earth (24.6 hours).",
      "Mars has the largest dust storms in the solar system.",
      "Mars has evidence of ancient river valleys and lake beds."
    ]
  },
  "jupiter": {
    "northern": [
      "Jupiter is so massive it could fit all other planets inside it.",
      "Jupiter has over 95 known moons, including the four largest.",
      "Jupiter's Great Red Spot is a storm larger than Earth."
    ],
    "southern": [
      "Jupiter acts as a 'cosmic vacuum cleaner' protecting inner planets.",
      "Jupiter has a faint ring system discovered by Voyager 1.",
      "Jupiter's moon Europa may have a subsurface ocean."
    ]
  },
  "saturn": {
    "northern": [
      "Saturn is less dense than water - it would float in a giant bathtub!",
      "Saturn's rings are made of ice, rock, and dust particles.",
      "Saturn has a hexagonal storm at its north pole."
    ],
    "southern": [
      "Saturn has 146 known moons, including Titan which is larger than Mercury.",
      "Saturn's rings are only about 20 meters thick but span 280,000 km.",
      "Saturn's moon Titan has lakes and rivers of liquid methane."
    ]
  },
  "uranus": {
    "northern": [
      "Uranus rotates on its side - it's tilted 98 degrees!",
      "Uranus has faint rings that were discovered in 1977.",
      "Uranus is the coldest planet in the solar system."
    ],
    "southern": [
      "A year on Uranus equals 84 Earth years.",
      "Uranus has only been visited by one spacecraft: Voyager 2.",
      "Uranus has 27 known moons, all named after Shakespeare characters."
    ]
  },
  "neptune": {
    "northern": [
      "Neptune has the fastest winds in the solar system - up to 2,100 km/h!",
      "Neptune takes 165 Earth years to orbit the Sun once.",
      "Neptune appears blue due to methane in its atmosphere."
    ],
    "southern": [
      "Neptune has a Great Dark Spot similar to Jupiter's Great Red Spot.",
      "Neptune was the first planet discovered through mathematical prediction.",
      "Neptune's moon Triton orbits backwards and is slowly spiraling inward."
    ]
  }
};

function getHemisphereFromCameraPosition(camera: THREE.Camera, planetName: string): string {
  if (!solarSystem[planetName]) return "northern";
  
  const planet = solarSystem[planetName];
  const planetPosition = planet.mesh.position;
  const cameraPosition = camera.position;
  
  // Calculate vector from planet to camera
  const direction = new THREE.Vector3().subVectors(cameraPosition, planetPosition).normalize();
  
  // Use Y component to determine hemisphere (positive Y = northern, negative Y = southern)
  const hemisphere = direction.y > 0 ? "northern" : "southern";
  
  return hemisphere;
}

// Hemisphere-based fun facts system - two tooltips per planet
let currentPlanet = "";
let northernTooltipVisible = false;
let southernTooltipVisible = false;
let lastCameraPosition = new THREE.Vector3();
let hasUserMoved = false;

function updateFunFacts(planetName: string) {
  // Hide all existing tooltips when switching planets
  if (currentPlanet !== planetName) {
    hideAllFunFactTooltips();
    currentPlanet = planetName;
    northernTooltipVisible = false;
    southernTooltipVisible = false;
    hasUserMoved = false;
    lastCameraPosition.copy(fakeCamera.position);
    return;
  }
  
  // Check if user has moved the camera
  const cameraMoved = fakeCamera.position.distanceTo(lastCameraPosition) > 0.1;
  if (cameraMoved) {
    hasUserMoved = true;
    lastCameraPosition.copy(fakeCamera.position);
  }
  
  // Only show tooltips after user has moved the camera
  if (hasUserMoved) {
    showTooltipForCurrentHemisphere(planetName);
  }
}

function showTooltipForCurrentHemisphere(planetName: string) {
  const hemisphere = getHemisphereFromCameraPosition(fakeCamera, planetName);
  const hemisphereFacts = planetFunFacts[planetName.toLowerCase()];
  
  if (!hemisphereFacts) {
    hideAllFunFactTooltips();
    return;
  }
  
  // Show/hide tooltips based on hemisphere
  if (hemisphere === "northern" && !northernTooltipVisible) {
    // Show northern tooltip, hide southern
    hideFunFactTooltip("southern");
    showFunFactTooltip(planetName, hemisphereFacts.northern[0], "northern");
    northernTooltipVisible = true;
    southernTooltipVisible = false;
  } else if (hemisphere === "southern" && !southernTooltipVisible) {
    // Show southern tooltip, hide northern
    hideFunFactTooltip("northern");
    showFunFactTooltip(planetName, hemisphereFacts.southern[0], "southern");
    southernTooltipVisible = true;
    northernTooltipVisible = false;
  }
}

function showFunFactTooltip(planetName: string, fact: string, hemisphere: string) {
  const tooltipId = `fun-fact-tooltip-${hemisphere}`;
  let tooltip = document.getElementById(tooltipId);
  if (!tooltip) {
    tooltip = document.createElement('div');
    tooltip.id = tooltipId;
    tooltip.className = 'fun-fact-tooltip';
    document.body.appendChild(tooltip);
  }
  
  // Get planet position in 3D space
  const planet = solarSystem[planetName];
  if (!planet) return;
  
  const planetWorldPosition = new THREE.Vector3();
  planet.mesh.getWorldPosition(planetWorldPosition);
  
  // Project 3D position to 2D screen coordinates
  const screenPosition = new THREE.Vector3();
  planetWorldPosition.project(fakeCamera);
  
  // Convert to screen coordinates - this is the planet center
  const planetScreenX = (screenPosition.x * 0.5 + 0.5) * window.innerWidth;
  const planetScreenY = (screenPosition.y * -0.5 + 0.5) * window.innerHeight;
  
  // Random positions that avoid the main tooltip area (left side)
  const safePositions = [
    // Top right area
    { x: window.innerWidth - 350, y: 100 },
    { x: window.innerWidth - 300, y: 150 },
    { x: window.innerWidth - 250, y: 200 },
    
    // Middle right area
    { x: window.innerWidth - 350, y: window.innerHeight * 0.3 },
    { x: window.innerWidth - 300, y: window.innerHeight * 0.4 },
    { x: window.innerWidth - 250, y: window.innerHeight * 0.5 },
    
    // Bottom right area
    { x: window.innerWidth - 350, y: window.innerHeight - 200 },
    { x: window.innerWidth - 300, y: window.innerHeight - 150 },
    { x: window.innerWidth - 250, y: window.innerHeight - 100 },
    
    // Center area (avoiding left side)
    { x: window.innerWidth * 0.6, y: 100 },
    { x: window.innerWidth * 0.7, y: window.innerHeight * 0.3 },
    { x: window.innerWidth * 0.65, y: window.innerHeight * 0.6 },
    { x: window.innerWidth * 0.75, y: window.innerHeight - 150 }
  ];
  
  // Pick a random safe position
  const randomPosition = safePositions[Math.floor(Math.random() * safePositions.length)];
  const tooltipX = randomPosition.x;
  const tooltipY = randomPosition.y;
  
  // Calculate line angle and length from tooltip left edge to planet center
  const deltaX = planetScreenX - tooltipX;
  const deltaY = planetScreenY - tooltipY;
  const angle = Math.atan2(deltaY, deltaX) * (180 / Math.PI);
  const distance = Math.sqrt(deltaX * deltaX + deltaY * deltaY);

  tooltip.innerHTML = `
    <div class="fun-fact-content">
      <div class="fun-fact-planet">${planetName.toUpperCase()}</div>
      <div class="fun-fact-text">${fact}</div>
    </div>
    <div class="fun-fact-line" style="
      transform: rotate(${angle}deg);
      width: ${Math.min(distance, 300)}px;
      transform-origin: left center;
    "></div>
  `;
  
  // Apply calculated position
  tooltip.style.position = 'fixed';
  tooltip.style.left = `${tooltipX}px`;
  tooltip.style.top = `${tooltipY}px`;
  tooltip.style.right = 'auto';
  tooltip.style.transform = 'translateY(-50%)';
  
  tooltip.style.display = 'block';
  tooltip.style.opacity = '0';
  tooltip.style.scale = '0.8';
  
  // Animate in
  setTimeout(() => {
    tooltip.style.transition = 'all 0.4s ease';
    tooltip.style.opacity = '1';
    tooltip.style.scale = '1';
  }, 10);
}

function hideFunFactTooltip(hemisphere: string) {
  const tooltip = document.getElementById(`fun-fact-tooltip-${hemisphere}`);
  if (tooltip) {
    tooltip.style.transition = 'all 0.3s ease';
    tooltip.style.opacity = '0';
    tooltip.style.scale = '0.8';
    
    setTimeout(() => {
      tooltip.style.display = 'none';
    }, 300);
  }
}

function hideAllFunFactTooltips() {
  hideFunFactTooltip("northern");
  hideFunFactTooltip("southern");
  northernTooltipVisible = false;
  southernTooltipVisible = false;
}

// Planetary feature system
interface PlanetaryFeature {
  id: string;
  name: string;
  description: string;
  position: THREE.Vector3;
  icon: string;
  visible: boolean;
  mesh?: THREE.Mesh;
}

const planetaryFeatures: Record<string, PlanetaryFeature[]> = {
  "mercury": [
    {
      id: "mercury-craters",
      name: "Heavily Cratered Surface",
      description: "Mercury's surface is heavily cratered, resembling Earth's Moon, due to numerous impacts over billions of years. The largest crater, Caloris Basin, is 1,550 km wide.",
      position: new THREE.Vector3(0.8, 0.2, 0),
      icon: "🌑",
      visible: false
    }
  ],
  "venus": [
    {
      id: "venus-volcanoes",
      name: "Volcanic Activity",
      description: "Venus has over 1,600 major volcanoes, though most are likely inactive today. The planet's surface is dominated by volcanic plains and shield volcanoes.",
      position: new THREE.Vector3(0.6, 0.3, 0.4),
      icon: "🌋",
      visible: false
    }
  ],
  "earth": [
    {
      id: "earth-life",
      name: "Life-Supporting Planet",
      description: "Earth is the only known planet to support life, with diverse ecosystems ranging from forests to oceans. Our atmosphere protects us from meteoroids and radiation.",
      position: new THREE.Vector3(0.5, 0.4, 0.3),
      icon: "🌍",
      visible: false
    },
    {
      id: "earth-apollo-11",
      name: "Apollo 11 Landing Site",
      description: "On July 20, 1969, Apollo 11 landed on the Moon at Tranquility Base. Neil Armstrong became the first human to walk on the lunar surface, followed by Buzz Aldrin.",
      position: new THREE.Vector3(0.3, 0.2, 0.6),
      icon: "🚀",
      visible: false
    }
  ],
  "mars": [
    {
      id: "mars-olympus-mons",
      name: "Olympus Mons",
      description: "The largest volcano in the solar system, Olympus Mons is 21.9 km high and 600 km wide. It's nearly three times the height of Mount Everest.",
      position: new THREE.Vector3(0.7, 0.1, 0.2),
      icon: "🏔️",
      visible: false
    },
    {
      id: "mars-dust-storms",
      name: "Global Dust Storms",
      description: "Mars experiences the largest dust storms in the solar system, sometimes covering the entire planet and lasting for months.",
      position: new THREE.Vector3(-0.6, 0.2, 0.5),
      icon: "🌪️",
      visible: false
    }
  ],
  "jupiter": [
    {
      id: "jupiter-great-red-spot",
      name: "Great Red Spot",
      description: "Jupiter's Great Red Spot is a giant storm larger than Earth, raging for at least 300 years. It's actually shrinking and may disappear in the next few decades.",
      position: new THREE.Vector3(0.8, 0.1, 0),
      icon: "🌀",
      visible: false
    },
    {
      id: "jupiter-moons",
      name: "95+ Moons",
      description: "Jupiter has over 95 known moons, including the four largest: Io, Europa, Ganymede, and Callisto. Ganymede is larger than Mercury.",
      position: new THREE.Vector3(0.3, 0.6, 0.4),
      icon: "🌙",
      visible: false
    }
  ],
  "saturn": [
    {
      id: "saturn-rings",
      name: "Ring System",
      description: "Saturn's ring system is the most extensive and complex in the solar system, with some rings spanning up to 200 times the planet's diameter.",
      position: new THREE.Vector3(0.9, 0, 0),
      icon: "💍",
      visible: false
    },
    {
      id: "saturn-hexagon",
      name: "Polar Hexagon",
      description: "Saturn has a unique hexagonal storm at its north pole, with each side nearly 7,500 miles across. This geometric storm has persisted for decades.",
      position: new THREE.Vector3(0, 0.8, 0),
      icon: "⬡",
      visible: false
    }
  ],
  "uranus": [
    {
      id: "uranus-tilt",
      name: "Sideways Rotation",
      description: "Uranus rotates on its side with an axial tilt of about 98 degrees, making its rotation unique among the planets. This may be due to an ancient collision.",
      position: new THREE.Vector3(0.4, 0.7, 0.3),
      icon: "🔄",
      visible: false
    }
  ],
  "neptune": [
    {
      id: "neptune-winds",
      name: "Fastest Winds",
      description: "Neptune has the fastest winds in the solar system, reaching speeds over 1,100 miles per hour. These supersonic winds create massive storms.",
      position: new THREE.Vector3(0.6, 0.2, 0.5),
      icon: "💨",
      visible: false
    }
  ],
  "moon": [
    {
      id: "moon-apollo-11",
      name: "Apollo 11 Landing Site",
      description: "On July 20, 1969, Apollo 11 landed at Tranquility Base. Neil Armstrong became the first human to walk on the lunar surface, followed by Buzz Aldrin. The landing site is marked by the American flag and scientific equipment.",
      position: new THREE.Vector3(0.4, 0.3, 0.5),
      icon: "🚀",
      visible: false
    },
    {
      id: "moon-tycho-crater",
      name: "Tycho Crater",
      description: "Tycho is one of the most prominent craters on the Moon, with a diameter of 85 km. It's famous for its bright ray system that extends across much of the lunar surface.",
      position: new THREE.Vector3(-0.6, 0.2, 0.3),
      icon: "🌑",
      visible: false
    }
  ]
};

function createFeatureIcon(feature: PlanetaryFeature, planet: any): THREE.Mesh {
  const geometry = new THREE.PlaneGeometry(0.1, 0.1);
  const material = new THREE.MeshBasicMaterial({
    color: 0x88ccff,
    transparent: true,
    opacity: 0.8,
    side: THREE.DoubleSide
  });
  
  const iconMesh = new THREE.Mesh(geometry, material);
  iconMesh.position.copy(feature.position);
  iconMesh.userData = { featureId: feature.id, planetName: planet.name };
  
  // Add text sprite for icon
  const canvas = document.createElement('canvas');
  const context = canvas.getContext('2d');
  if (context) {
    canvas.width = 64;
    canvas.height = 64;
    context.font = '48px Arial';
    context.fillStyle = '#88ccff';
    context.textAlign = 'center';
    context.textBaseline = 'middle';
    context.fillText(feature.icon, 32, 32);
    
    const texture = new THREE.CanvasTexture(canvas);
    const iconMaterial = new THREE.MeshBasicMaterial({
      map: texture,
      transparent: true,
      opacity: 0.9
    });
    iconMesh.material = iconMaterial;
  }
  
  return iconMesh;
}

function initializePlanetaryFeatures() {
  Object.keys(planetaryFeatures).forEach(planetName => {
    const planet = solarSystem[planetName];
    if (planet) {
      planetaryFeatures[planetName].forEach(feature => {
        const iconMesh = createFeatureIcon(feature, planet);
        planet.mesh.add(iconMesh);
        feature.mesh = iconMesh;
        iconMesh.visible = false; // Initially hidden
      });
    }
  });
}

function checkFeatureVisibility() {
  Object.keys(planetaryFeatures).forEach(planetName => {
    const planet = solarSystem[planetName];
    if (planet && planetName === options.focus) {
      planetaryFeatures[planetName].forEach(feature => {
        if (feature.mesh) {
          // Calculate if feature is facing the camera
          const featureWorldPosition = new THREE.Vector3();
          feature.mesh.getWorldPosition(featureWorldPosition);
          
          const cameraDirection = new THREE.Vector3();
          fakeCamera.getWorldDirection(cameraDirection);
          
          const featureDirection = new THREE.Vector3()
            .subVectors(featureWorldPosition, fakeCamera.position)
            .normalize();
          
          const dotProduct = cameraDirection.dot(featureDirection);
          const shouldBeVisible = dotProduct > 0.3; // Feature is visible if facing camera
          
          if (shouldBeVisible && !feature.visible) {
            feature.visible = true;
            feature.mesh.visible = true;
            showFeatureTooltip(feature);
          } else if (!shouldBeVisible && feature.visible) {
            feature.visible = false;
            feature.mesh.visible = false;
            hideFeatureTooltip(feature);
          }
        }
      });
    }
  });
}

function showFeatureTooltip(feature: PlanetaryFeature) {
  // Create or update feature tooltip
  let tooltip = document.getElementById(`feature-${feature.id}`);
  if (!tooltip) {
    tooltip = document.createElement('div');
    tooltip.id = `feature-${feature.id}`;
    tooltip.className = 'feature-tooltip';
    tooltip.innerHTML = `
      <div class="feature-tooltip-content">
        <div class="feature-tooltip-icon">${feature.icon}</div>
        <div class="feature-tooltip-title">${feature.name}</div>
        <div class="feature-tooltip-description">${feature.description}</div>
      </div>
    `;
    document.body.appendChild(tooltip);
  }
  
  tooltip.style.display = 'block';
  tooltip.style.opacity = '0';
  tooltip.style.transform = 'translateX(20px)';
  
  // Animate in
  setTimeout(() => {
    tooltip.style.transition = 'all 0.3s ease';
    tooltip.style.opacity = '1';
    tooltip.style.transform = 'translateX(0)';
  }, 10);
}

function updateFeatureTooltipPosition(feature: PlanetaryFeature, tooltip: HTMLElement) {
  // Position tooltip on the right side of the screen
  tooltip.style.position = 'fixed';
  tooltip.style.right = '20px';
  tooltip.style.top = '50%';
  tooltip.style.transform = 'translateY(-50%)';
  tooltip.style.left = 'auto';
}

function hideFeatureTooltip(feature: PlanetaryFeature) {
  const tooltip = document.getElementById(`feature-${feature.id}`);
  if (tooltip) {
    tooltip.style.transition = 'all 0.3s ease';
    tooltip.style.opacity = '0';
    tooltip.style.transform = 'translateY(10px)';
    
    setTimeout(() => {
      tooltip.style.display = 'none';
    }, 300);
  }
}

const changeFocus = (oldFocus: string, newFocus: string) => {
  solarSystem[oldFocus].mesh.remove(camera);
  solarSystem[newFocus].mesh.add(camera);
  const minDistance = solarSystem[newFocus].getMinDistance();
  controls.minDistance = minDistance;
  fakeCamera.position.set(minDistance, minDistance / 3, 0);
  solarSystem[oldFocus].labels.hidePOI();
  solarSystem[newFocus].labels.showPOI();
  (document.querySelector(".caption p") as HTMLElement).innerHTML = newFocus;
  
  // Hide all tooltips first
  const allTooltips = [
    'space-tooltip', 'mercury-tooltip', 'venus-tooltip', 'earth-tooltip', 'moon-tooltip',
    'mars-tooltip', 'jupiter-tooltip', 'saturn-tooltip', 'uranus-tooltip', 'neptune-tooltip',
    'ganymede-tooltip', 'titan-tooltip', 'callisto-tooltip', 'io-tooltip', 'europa-tooltip', 'triton-tooltip'
  ];
  
  allTooltips.forEach(tooltipId => {
    const tooltip = document.getElementById(tooltipId);
    if (tooltip) {
      tooltip.classList.remove('show');
      tooltip.style.display = 'none';
    }
  });
  
  // Show appropriate tooltip for current focus after a brief delay
  setTimeout(() => {
    const tooltipId = `${newFocus.toLowerCase()}-tooltip`;
    const currentTooltip = document.getElementById(tooltipId);
    if (currentTooltip) {
      currentTooltip.style.display = 'block';
      setTimeout(() => {
        currentTooltip.classList.add('show');
      }, 50);
    }
    
    // Start fun facts for the new planet (including Sun) - will show when user moves
    updateFunFacts(newFocus);
  }, 100);
};

const setFocus = (focus: string) => {
  if (!solarSystem[focus]) {
    console.warn(`[voice] Unknown focus target: ${focus}`);
    return;
  }
  const previous = options.focus;
  changeFocus(previous, focus);
  options.focus = focus;
  eventBus.emit("focusChanged", {
    current: focus,
    previous,
  });
};

const focusPrevious = () => {
  const index = planetNames.indexOf(options.focus);
  const newIndex = index === 0 ? planetNames.length - 1 : index - 1;
  setFocus(planetNames[newIndex]);
};

const focusNext = () => {
  const index = (planetNames.indexOf(options.focus) + 1) % planetNames.length;
  setFocus(planetNames[index]);
};

document.getElementById("btn-previous")?.addEventListener("click", focusPrevious);

document.getElementById("btn-next")?.addEventListener("click", focusNext);

// Camera
const aspect = sizes.width / sizes.height;
const camera = new THREE.PerspectiveCamera(75, aspect, 0.1, 1000);
camera.position.set(0, 20, 0);
solarSystem["Sun"].mesh.add(camera);

// Initialize planetary features
initializePlanetaryFeatures();

// Controls
const fakeCamera = camera.clone();
const controls = new OrbitControls(fakeCamera, canvas);
controls.target = solarSystem["Sun"].mesh.position;
controls.enableDamping = true;
controls.enablePan = false;
controls.minDistance = solarSystem["Sun"].getMinDistance();
controls.maxDistance = 50;

// Hand tracking system v2 - Professional architecture
const handTracker = new HandTrackerV2();
const gestureEngine = new GestureEngine();
const handControls = new HandGestureControlsV2(controls);

// Hand tracking control buttons
document.getElementById("btn-hand-toggle")?.addEventListener("click", async () => {
  const currentState = handControls.getEnabled();

  if (!currentState) {
    if (!isCameraRequested) {
      showCameraModal();
    } else {
      handControls.setEnabled(true);
      updateHandStatus("Enabled", 0, "Show your hand to camera");
      showHandHelp();
      updateHandToggleButton(true);
    }
  } else {
    handControls.setEnabled(false);
    const statusDiv = document.getElementById("hand-status");
    const helpDiv = document.getElementById("hand-help");
    if (statusDiv) statusDiv.style.display = "none";
    if (helpDiv) helpDiv.style.display = "none";
    updateHandToggleButton(false);
  }
});

function updateHandToggleButton(enabled: boolean) {
  const button = document.getElementById("btn-hand-toggle");
  if (button) {
    button.style.backgroundColor = enabled ? "#4CAF50" : "";
    button.title = enabled ? "Disable Hand Controls" : "Enable Hand Controls";
  }
}

document.getElementById("btn-hand-debug")?.addEventListener("click", () => {
  handTracker.toggleDebugView();
  const button = document.getElementById("btn-hand-debug");
  if (button) {
    const isVisible = document.getElementById("hand-debug-canvas")?.style.display !== "none";
    button.style.backgroundColor = isVisible ? "#2196F3" : "";
    button.title = isVisible ? "Hide Hand Debug View" : "Show Hand Debug View";
    
    // Toggle hand UI elements visibility
    const handStatus = document.getElementById("hand-status");
    const handHelp = document.getElementById("hand-help");
    
    if (handStatus) {
      handStatus.style.display = isVisible ? "none" : "block";
    }
    if (handHelp) {
      handHelp.style.display = isVisible ? "none" : "block";
    }
  }
});

document.getElementById("btn-hand-calibrate")?.addEventListener("click", () => {
  if (!isCameraRequested) {
    alert("Please enable hand tracking first by clicking the hand button.");
    return;
  }

  const snapshot = gestureEngine.read();
  if (snapshot.hands === 0) {
    alert("Please show your hand to the camera and try again.");
    return;
  }

  const instruction = document.createElement("div");
  instruction.style.cssText = `
    position: fixed; top: 50%; left: 50%; transform: translate(-50%, -50%);
    background: rgba(0,0,0,0.9); color: white; padding: 30px; border-radius: 10px;
    text-align: center; z-index: 3000; max-width: 400px;
  `;
  instruction.innerHTML = `
    <h3>🖐️ Calibrating Neutral Position</h3>
    <p>Hold your hand in a comfortable, relaxed position.<br>
    Palm facing camera, fingers naturally positioned.</p>
    <p style="color: #4CAF50; font-size: 18px; margin: 20px 0;">
    Calibrating in <span id="calibrate-countdown">3</span>...
    </p>
  `;
  document.body.appendChild(instruction);

  let countdown = 3;
  const countdownEl = document.getElementById("calibrate-countdown");

  const timer = setInterval(() => {
    countdown--;
    if (countdownEl) countdownEl.textContent = countdown.toString();

    if (countdown <= 0) {
      clearInterval(timer);

      const currentSnapshot = gestureEngine.read();
      if (currentSnapshot.hands > 0) {
        const rawLandmarks = handTracker.getLatestLandmarks();
        const success = gestureEngine.calibrateNeutral(rawLandmarks);

        if (success) {
          instruction.innerHTML = `
            <h3 style="color: #4CAF50;">✅ Calibration Complete!</h3>
            <p>Your neutral hand position has been saved.<br>
            Hand gestures are now personalized for you.</p>
          `;
        } else {
          instruction.innerHTML = `
            <h3 style="color: #f44336;">❌ Calibration Failed</h3>
            <p>Unable to read hand landmarks. Please try again.</p>
          `;
        }

        setTimeout(() => {
          document.body.removeChild(instruction);
        }, 2000);

        console.log("Hand calibration completed");
      } else {
        instruction.innerHTML = `
          <h3 style="color: #f44336;">❌ Calibration Failed</h3>
          <p>No hand detected. Please try again.</p>
        `;

        setTimeout(() => {
          document.body.removeChild(instruction);
        }, 2000);
      }
    }
  }, 1000);
});

// Gesture mode button removed - now using finger gestures only

// Initialize MediaPipe (without camera access yet)
let isCameraRequested = false;

handTracker.initialize().then(() => {
  console.log('✋ MediaPipe v2 initialized successfully');
  updateHandStatus('Ready', 0, 'Click hand button to enable');
}).catch((error) => {
  console.warn('⚠️ MediaPipe initialization failed:', error.message);
  updateHandStatus('MediaPipe Failed', 0, 'Refresh to retry');
});

// Camera permission modal handlers
document.getElementById("btn-request-camera")?.addEventListener("click", async () => {
  hideModal();
  await requestCameraAccess();
});

document.getElementById("btn-skip-camera")?.addEventListener("click", () => {
  hideModal();
  updateHandStatus('Disabled', 0, 'Camera access skipped');
});

function showCameraModal() {
  const modal = document.getElementById('camera-permission-modal');
  if (modal) {
    modal.style.display = 'flex';
  }
}

function hideModal() {
  const modal = document.getElementById('camera-permission-modal');
  if (modal) {
    modal.style.display = 'none';
  }
}

async function requestCameraAccess() {
  try {
    updateHandStatus('Requesting...', 0, 'Allow camera access in browser');
    await handTracker.requestCamera();
    updateHandStatus('Active', 0, 'Ready to track hands');
    showHandHelp(3000);
    isCameraRequested = true;
    
    // Enable hand controls after successful camera access
    handControls.setEnabled(true);
    updateHandToggleButton(true);
  } catch (error: any) {
    console.error('Camera access failed:', error.message);
    updateHandStatus('Camera Failed', 0, error.message);
    
    // Show retry option
    setTimeout(() => {
      if (confirm('Camera access failed. Would you like to try again?\n\n' + error.message)) {
        requestCameraAccess();
      } else {
        handControls.setEnabled(false);
        updateHandStatus('Disabled', 0, 'Camera access denied');
        updateHandToggleButton(false);
      }
    }, 1000);
  }
}

// Process hand tracking results through the gesture engine
handTracker.onResults((results, timestamp) => {
  gestureEngine.ingest(results.landmarks, timestamp);
  
  // Update status display
  const snapshot = gestureEngine.read();
  updateHandStatus('Active', results.landmarks.length, getGestureDescription(snapshot));
});

// Status and help functions
function updateHandStatus(cameraStatus: string, handCount: number, gestureStatus: string) {
  const statusDiv = document.getElementById('hand-status');
  if (statusDiv && handControls.getEnabled()) {
    statusDiv.style.display = 'block';
    
    const cameraSpan = document.getElementById('camera-status');
    const handsSpan = document.getElementById('hands-count');
    const gestureSpan = document.getElementById('gesture-status');
    
    if (cameraSpan) cameraSpan.textContent = cameraStatus;
    if (handsSpan) handsSpan.textContent = handCount.toString();
    if (gestureSpan) gestureSpan.textContent = gestureStatus;
    
    // Color coding
    if (cameraSpan) {
      cameraSpan.style.color = cameraStatus === 'Active' ? '#4CAF50' : 
                               cameraStatus.includes('Failed') ? '#f44336' : '#ff9800';
    }
    if (handsSpan) {
      handsSpan.style.color = handCount > 0 ? '#4CAF50' : '#ccc';
    }
  } else if (statusDiv) {
    statusDiv.style.display = 'none';
  }
}

function getGestureDescription(snapshot: any): string {
  if (snapshot.hands === 0) return 'No hands detected';
  
  // Finger gesture system only
  const fingerGesture = gestureEngine.getLastFingerGesture();
  const gestureEmojis = {
    'open_palm': '🖐️ Open Palm → Zoom Out',
    'closed_fist': '✊ Closed Fist → Zoom In',
    'one_finger': '☝️ One Finger → Rotate Left',
    'two_fingers': '✌️ Two Fingers → Rotate Right',
    'unknown': '❓ Show gesture to camera'
  };
  
  const gestureText = gestureEmojis[fingerGesture.gesture] || '❓ Unknown';
  const confidence = fingerGesture.confidence ? ` (${(fingerGesture.confidence * 100).toFixed(0)}%)` : '';
  const fingerCount = fingerGesture.fingerCount >= 0 ? ` [${fingerGesture.fingerCount} fingers]` : '';
  
  return gestureText + confidence + fingerCount;
}

function showHandHelp(duration?: number) {
  const helpDiv = document.getElementById('hand-help');
  if (helpDiv) {
    helpDiv.style.display = 'block';
    if (duration) {
      setTimeout(() => {
        helpDiv.style.display = 'none';
      }, duration);
    }
  }
}

// Label renderer
const labelRenderer = new CSS2DRenderer();
labelRenderer.setSize(sizes.width, sizes.height);
document.body.appendChild(labelRenderer.domElement);

// Renderer
const renderer = new THREE.WebGLRenderer({
  canvas: canvas,
  antialias: true,
});

renderer.outputColorSpace = THREE.LinearSRGBColorSpace;
renderer.setSize(sizes.width, sizes.height);
renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2));
renderer.shadowMap.enabled = true;
renderer.shadowMap.type = THREE.PCFSoftShadowMap;

const renderScene = new RenderPass(scene, camera);
const bloomPass = new UnrealBloomPass(
  new THREE.Vector2(sizes.width, sizes.height),
  0.75,
  0,
  1
);

const bloomComposer = new EffectComposer(renderer);
bloomComposer.setSize(sizes.width, sizes.height);
bloomComposer.renderToScreen = true;
bloomComposer.addPass(renderScene);
bloomComposer.addPass(bloomPass);

// Animate
const clock = new THREE.Clock();
let elapsedTime = 0;

fakeCamera.layers.enable(LAYERS.POILabel);

// GUI
createGUI(ambientLight, solarSystem, clock, fakeCamera, handControls);

const voiceNavigation = new VoiceNavigationController(planetNames);
voiceNavigation.attachUI({
  button: document.getElementById("btn-voice") as HTMLButtonElement | null,
  status: document.getElementById("voice-status"),
  transcript: document.getElementById("voice-transcript"),
  container: document.getElementById("voice-feedback"),
});

new WelcomeNarrator(planetNames, options.narrationEnabled, options.focus);

eventBus.on("voiceCommand", (intent) => {
  switch (intent.type) {
    case "open":
      setFocus(intent.target);
      break;
    case "next":
      focusNext();
      break;
    case "previous":
      focusPrevious();
      break;
    case "repeat":
      eventBus.emit("focusChanged", {
        current: options.focus,
        previous: options.focus,
      });
      break;
    case "stop":
      // Future: pause narration or other behaviours.
      break;
    default:
      break;
  }
});

eventBus.emit("focusChanged", {
  current: options.focus,
  previous: null,
});

(function tick() {
  const deltaTime = clock.getDelta();
  elapsedTime += deltaTime * options.speed;

  // Update the solar system objects
  for (const object of Object.values(solarSystem)) {
    object.tick(elapsedTime);
  }

  // Apply hand gesture deltas to OrbitControls (v2 architecture)
  const gestureSnapshot = gestureEngine.read();
  handControls.apply(gestureSnapshot, deltaTime);

  // Update camera
  camera.copy(fakeCamera);

  // Update controls (OrbitControls handles all the camera math)
  controls.update();

  // Update labels
  const currentBody = solarSystem[options.focus];
  currentBody.labels.update(fakeCamera);

  // Update fun facts based on current hemisphere
  updateFunFacts(options.focus);

  // Check feature visibility
  checkFeatureVisibility();

  // Render
  bloomComposer.render();
  labelRenderer.render(scene, camera);

  // Call tick again on the next frame
  window.requestAnimationFrame(tick);
})();


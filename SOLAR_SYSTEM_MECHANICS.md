# Solar System Mechanics Documentation

## Overview

This Three.js-based solar system simulation creates an interactive 3D representation of our solar system with realistic planetary movements, orbital mechanics, and hierarchical relationships between celestial bodies. The system is designed for potential hand gesture control integration.

## Core Architecture

### Main Entry Point (`script.ts`)
- **Scene Setup**: Creates Three.js scene with environment mapping, lighting, and post-processing effects
- **Camera System**: Uses dual camera approach (real camera + fake camera for controls)
- **Animation Loop**: 60 FPS tick function that updates all planetary objects and renders the scene
- **Control Interface**: Navigation buttons and GUI controls for simulation parameters

### Planetary Object System (`planetary-object.ts`)

#### Key Classes and Interfaces

**`PlanetaryObject` Class**: Core class representing any celestial body
- Handles orbital mechanics, rotation, texture loading, and mesh creation
- Supports planets, moons, stars, and ring systems

**`Body` Interface**: Configuration data structure for celestial bodies containing:
- Physical properties (radius, distance, period, day length, tilt)
- Orbital relationships (what it orbits)
- Visual properties (textures, atmosphere)
- Interactive elements (labels, traversability)

## Movement and Physics

### Time System
```typescript
const timeFactor = 8 * Math.PI * 2; // 1 real second = 8 simulation hours
```

### Orbital Mechanics

#### Position Calculation (`planetary-object.ts:205-220`)
Each celestial body's position is calculated using circular orbital mechanics:

```typescript
tick = (elapsedTime: number) => {
  const rotation = this.getRotation(elapsedTime);
  const orbitRotation = this.getOrbitRotation(elapsedTime);
  const orbit = orbitRotation + this.rng;

  // Circular orbital position
  this.mesh.position.x = Math.sin(orbit) * this.distance;
  this.mesh.position.z = Math.cos(orbit) * this.distance;
  
  // Self-rotation
  this.mesh.rotation.y = rotation;
};
```

#### Movement Components:
1. **Orbital Motion**: Objects move in circular paths around their parent body
2. **Self-Rotation**: Objects rotate around their own axis based on day length
3. **Random Offset**: Each object has a random starting position in its orbit

### Scaling and Normalization

#### Distance Normalization (`planetary-object.ts:42-44`)
```typescript
const normaliseDistance = (distance: number): number => {
  return Math.pow(distance, 0.4);
};
```
Uses power scaling to compress vast astronomical distances into manageable 3D space.

#### Radius Normalization (`planetary-object.ts:38-40`)
```typescript
const normaliseRadius = (radius: number): number => {
  return Math.sqrt(radius) / 500;
};
```
Square root scaling maintains relative size relationships while keeping objects visible.

## Hierarchical Relationships

### Parent-Child System (`solar-system.ts:30-34`)
```typescript
if (object.orbits) {
  const parentMesh = solarSystem[object.orbits].mesh;
  parentMesh.add(object.mesh);
  object.path && parentMesh.add(object.path);
}
```

#### Relationship Types:
1. **Planets orbit the Sun**: Direct children of the Sun mesh
2. **Moons orbit Planets**: Children of their respective planet meshes
3. **Ring Systems**: Special objects that orbit planets but behave differently

#### Hierarchical Benefits:
- **Automatic Inheritance**: Child objects inherit parent transformations
- **Realistic Motion**: Moons automatically follow their planet's orbital path
- **Simplified Calculations**: Only need to calculate relative motion to immediate parent

### Data Structure (`planets.json`)
The celestial bodies are defined with hierarchical relationships:

```json
{
  "name": "Moon",
  "orbits": "Earth",
  "distance": 0.38,
  "period": 0
}
```

When `period: 0`, the system automatically calculates orbital period based on the parent's day length.

## Camera and Control Systems

### Focus System (`script.ts:68-77`)
```typescript
const changeFocus = (oldFocus: string, newFocus: string) => {
  solarSystem[oldFocus].mesh.remove(camera);
  solarSystem[newFocus].mesh.add(camera);
  const minDistance = solarSystem[newFocus].getMinDistance();
  controls.minDistance = minDistance;
  // ... label and UI updates
};
```

#### Camera Behavior:
- **Attachment**: Camera is attached to the focused celestial body's mesh
- **Orbit Controls**: Users can orbit around the focused object
- **Distance Constraints**: Minimum distance prevents clipping into the object
- **Smooth Transitions**: Focus changes update labels and constraints

### Orbital Controls
- **Target Following**: Controls automatically target the focused object
- **Distance Limits**: Min/max distances scaled to object size
- **Damping**: Smooth camera movement with momentum
- **Pan Disabled**: Prevents camera from drifting away from focus

## Visual and Interactive Elements

### Orbital Paths (`path.ts`)
- **Circular Geometry**: 1024-point circles representing orbital paths
- **Transparency**: Low opacity white lines
- **Toggleable**: Can be shown/hidden via UI controls
- **Scaled**: Path radius matches the object's orbital distance

### Labels and Points of Interest (`label.ts`)
```typescript
export interface PointOfInterest {
  name: string;
  y: number;    // Rotation around Y-axis
  z: number;    // Rotation around Z-axis
  type?: string; // Icon type (rover, landing, mountain)
}
```

#### Label Features:
- **3D Positioning**: Labels positioned on celestial body surfaces
- **Opacity Management**: Labels fade based on camera angle and distance
- **Layer System**: Labels can be toggled on/off
- **Icon Support**: Visual icons for different point types

### Texture and Material System
- **Multi-texture Support**: Diffuse, bump, specular, and atmosphere maps
- **Material Types**: Different materials for stars vs planets
- **Atmosphere Rendering**: Separate mesh for planetary atmospheres
- **Shadow System**: Realistic shadow casting and receiving

## Control Interface and GUI

### Simulation Controls (`gui.ts`)
```typescript
export const options = {
  showPaths: false,
  showMoons: true,
  focus: "Sun",
  clock: true,
  speed: 0.125
};
```

#### Available Controls:
1. **Speed Control**: Adjust simulation time rate (0.1x to 20x)
2. **Pause/Play**: Stop/start the simulation
3. **Moon Visibility**: Toggle moon visibility
4. **Path Display**: Show/hide orbital paths
5. **Label Toggle**: Show/hide points of interest
6. **Ambient Lighting**: Adjust scene lighting
7. **Focus Navigation**: Previous/next celestial body

## Potential for Hand Gesture Control

### Current Control Points
The system currently responds to these input methods that could be mapped to gestures:

1. **Focus Changes**: `changeFocus()` function - could map to hand pointing
2. **Speed Control**: `options.speed` - could map to hand gesture intensity
3. **Camera Orbit**: `OrbitControls` - could map to hand rotation/movement
4. **Zoom**: `controls.minDistance/maxDistance` - could map to pinch gestures
5. **UI Toggles**: Various boolean options - could map to hand signs

### Architecture Benefits for Gesture Control
- **Centralized State**: All controls funnel through the `options` object
- **Event System**: Clear separation between input handling and simulation logic
- **Smooth Interpolation**: Existing damping systems can handle gesture noise
- **Object Picking**: Focus system already handles object selection
- **Real-time Updates**: 60 FPS update loop can respond to gesture changes

### Suggested Integration Points
1. **Replace OrbitControls**: Substitute hand tracking for mouse/touch controls
2. **Gesture Mapping**: Map specific gestures to existing control functions
3. **State Management**: Use existing `options` object for gesture-driven parameters
4. **Visual Feedback**: Leverage existing label/UI system for gesture state indication

The modular architecture and centralized control system make this codebase well-suited for hand gesture integration while maintaining the existing simulation logic and visual quality.
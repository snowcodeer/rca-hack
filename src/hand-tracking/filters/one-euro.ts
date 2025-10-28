/**
 * One Euro Filter Implementation
 * Based on Casiez et al. (2012) "1€ Filter: a simple speed-based low-pass filter"
 * 
 * Eliminates jitter while preserving responsiveness for rapid movements.
 * Key insight: Use velocity to adapt cutoff frequency dynamically.
 */

export class OneEuroFilter {
  private x_prev: number = 0;
  private dx_prev: number = 0;
  private t_prev: number = 0;
  private initialized: boolean = false;

  constructor(
    private minCutoff: number = 1.0,    // Minimum cutoff frequency (Hz)
    private beta: number = 0.007,       // Speed coefficient (how much velocity affects cutoff)
    private dCutoff: number = 1.0       // Cutoff frequency for velocity signal
  ) {}

  /**
   * Filter a new value
   * @param x Raw input value
   * @param t Timestamp in seconds
   * @returns Filtered value
   */
  filter(x: number, t: number): number {
    if (!this.initialized) {
      this.x_prev = x;
      this.t_prev = t;
      this.initialized = true;
      return x;
    }

    const dt = t - this.t_prev;
    if (dt <= 0) {
      return this.x_prev; // No time has passed, return previous value
    }

    // Estimate velocity
    const dx = (x - this.x_prev) / dt;
    
    // Filter velocity with fixed cutoff
    const dx_filtered = this.lowPass(dx, this.dx_prev, this.alpha(dt, this.dCutoff));
    
    // Adaptive cutoff based on filtered velocity
    const cutoff = this.minCutoff + this.beta * Math.abs(dx_filtered);
    
    // Filter position with adaptive cutoff
    const x_filtered = this.lowPass(x, this.x_prev, this.alpha(dt, cutoff));

    // Update state
    this.x_prev = x_filtered;
    this.dx_prev = dx_filtered;
    this.t_prev = t;

    return x_filtered;
  }

  /**
   * Reset filter state
   */
  reset(): void {
    this.initialized = false;
    this.x_prev = 0;
    this.dx_prev = 0;
    this.t_prev = 0;
  }

  /**
   * Update filter parameters
   */
  setParams(minCutoff?: number, beta?: number, dCutoff?: number): void {
    if (minCutoff !== undefined) this.minCutoff = minCutoff;
    if (beta !== undefined) this.beta = beta;
    if (dCutoff !== undefined) this.dCutoff = dCutoff;
  }

  /**
   * Low-pass filter: x_filtered = α * x + (1-α) * x_prev
   */
  private lowPass(x: number, x_prev: number, alpha: number): number {
    return alpha * x + (1 - alpha) * x_prev;
  }

  /**
   * Calculate smoothing factor α from cutoff frequency and time delta
   */
  private alpha(dt: number, cutoff: number): number {
    const tau = 1.0 / (2 * Math.PI * cutoff);
    return 1.0 / (1.0 + tau / dt);
  }
}

/**
 * Multi-dimensional One Euro Filter for vector signals
 */
export class OneEuroFilterVector {
  private filters: OneEuroFilter[];

  constructor(
    dimensions: number,
    minCutoff: number = 1.0,
    beta: number = 0.007,
    dCutoff: number = 1.0
  ) {
    this.filters = Array(dimensions).fill(null).map(() => 
      new OneEuroFilter(minCutoff, beta, dCutoff)
    );
  }

  filter(values: number[], t: number): number[] {
    return values.map((value, i) => this.filters[i].filter(value, t));
  }

  reset(): void {
    this.filters.forEach(filter => filter.reset());
  }

  setParams(minCutoff?: number, beta?: number, dCutoff?: number): void {
    this.filters.forEach(filter => filter.setParams(minCutoff, beta, dCutoff));
  }
}

/**
 * Specialized filter for gesture signals with good defaults
 */
export class GestureFilter {
  private pinchFilter: OneEuroFilter;
  private orientationFilter: OneEuroFilterVector;

  constructor() {
    // Conservative settings for smooth gesture control
    this.pinchFilter = new OneEuroFilter(
      1.2,    // minCutoff: slightly higher for pinch stability
      0.01,   // beta: low for smooth zoom
      1.0     // dCutoff: standard
    );

    this.orientationFilter = new OneEuroFilterVector(
      3,      // dimensions: yaw, pitch, roll
      0.8,    // minCutoff: lower for responsive rotation
      0.007,  // beta: standard
      1.0     // dCutoff: standard
    );
  }

  filterPinch(pinch: number, t: number): number {
    return this.pinchFilter.filter(pinch, t);
  }

  filterOrientation(yaw: number, pitch: number, roll: number, t: number): [number, number, number] {
    const filtered = this.orientationFilter.filter([yaw, pitch, roll], t);
    return [filtered[0], filtered[1], filtered[2]];
  }

  reset(): void {
    this.pinchFilter.reset();
    this.orientationFilter.reset();
  }

  setPinchParams(minCutoff?: number, beta?: number): void {
    this.pinchFilter.setParams(minCutoff, beta);
  }

  setOrientationParams(minCutoff?: number, beta?: number): void {
    this.orientationFilter.setParams(minCutoff, beta);
  }
}
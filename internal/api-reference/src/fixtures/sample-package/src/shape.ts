/**
 * A polygon with a fixed number of sides.
 * @example
 * new Shape(3).sides; // 3
 */
export class Shape {
  public readonly sides: number;

  /**
   * Creates a shape.
   * @param sides The number of sides.
   */
  constructor(sides: number) {
    this.sides = sides;
  }

  /**
   * Checks whether the shape is a triangle.
   * @returns Whether it has three sides.
   */
  public isTriangle(): boolean {
    return this.sides === 3;
  }
}

export class UndocumentedShape {}

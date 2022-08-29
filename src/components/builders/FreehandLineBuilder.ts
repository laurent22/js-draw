import { Bezier } from 'bezier-js';
import AbstractRenderer, { RenderingStyle, RenderablePathSpec } from '../../rendering/AbstractRenderer';
import { Point2, Vec2 } from '../../geometry/Vec2';
import Rect2 from '../../geometry/Rect2';
import { PathCommand, PathCommandType } from '../../geometry/Path';
import LineSegment2 from '../../geometry/LineSegment2';
import Stroke from '../Stroke';
import Viewport from '../../Viewport';
import { StrokeDataPoint } from '../../types';
import { ComponentBuilder, ComponentBuilderFactory } from './types';

export const makeFreehandLineBuilder: ComponentBuilderFactory = (initialPoint: StrokeDataPoint, viewport: Viewport) => {
	// Don't smooth if input is more than ± 7 pixels from the true curve, do smooth if
	// less than ± 2 px from the curve.
	const canvasTransform = viewport.screenToCanvasTransform;
	const maxSmoothingDist = canvasTransform.transformVec3(Vec2.unitX).magnitude() * 7;
	const minSmoothingDist = canvasTransform.transformVec3(Vec2.unitX).magnitude() * 2;

	return new FreehandLineBuilder(
		initialPoint, minSmoothingDist, maxSmoothingDist
	);
};

// Handles stroke smoothing and creates Strokes from user/stylus input.
export default class FreehandLineBuilder implements ComponentBuilder {
	private segments: RenderablePathSpec[];
	private buffer: Point2[];
	private lastPoint: StrokeDataPoint;
	private lastExitingVec: Vec2;
	private currentCurve: Bezier|null = null;
	private curveStartWidth: number;
	private curveEndWidth: number;

	// Stroke smoothing and tangent approximation
	private momentum: Vec2;
	private bbox: Rect2;

	public constructor(
		private startPoint: StrokeDataPoint,

		// Maximum distance from the actual curve (irrespective of stroke width)
		// for which a point is considered 'part of the curve'.
		// Note that the maximum will be smaller if the stroke width is less than
		// [maxFitAllowed].
		private minFitAllowed: number,
		private maxFitAllowed: number
	) {
		this.lastPoint = this.startPoint;
		this.segments = [];
		this.buffer = [this.startPoint.pos];
		this.momentum = Vec2.zero;
		this.currentCurve = null;

		this.bbox = new Rect2(this.startPoint.pos.x, this.startPoint.pos.y, 0, 0);
	}

	public getBBox(): Rect2 {
		return this.bbox;
	}

	private getRenderingStyle(): RenderingStyle {
		return {
			fill: this.lastPoint.color ?? null,
		};
	}

	// Get the segments that make up this' path. Can be called after calling build()
	private getPreview(): RenderablePathSpec[] {
		if (this.currentCurve && this.lastPoint) {
			const currentPath = this.currentSegmentToPath();
			return this.segments.concat(currentPath);
		}

		return this.segments;
	}

	public preview(renderer: AbstractRenderer) {
		for (const part of this.getPreview()) {
			renderer.drawPath(part);
		}
	}

	public build(): Stroke {
		if (this.lastPoint) {
			this.finalizeCurrentCurve();
		}
		return new Stroke(
			this.segments,
		);
	}

	private roundPoint(point: Point2): Point2 {
		return Viewport.roundPoint(point, this.minFitAllowed);
	}

	private finalizeCurrentCurve() {
		// Case where no points have been added
		if (!this.currentCurve) {
			// Don't create a circle around the initial point if the stroke has more than one point.
			if (this.segments.length > 0) {
				return;
			}

			const width = Viewport.roundPoint(this.startPoint.width / 3, this.minFitAllowed);
			const center = this.roundPoint(this.startPoint.pos);

			// Draw a circle-ish shape around the start point
			this.segments.push({
				// Start on the right, cycle clockwise:
				//    |
				//  ----- ←
				//    |
				startPoint: this.startPoint.pos.plus(Vec2.of(width, 0)),
				commands: [
					{
						kind: PathCommandType.QuadraticBezierTo,
						controlPoint: center.plus(Vec2.of(width, width)),

						// Bottom of the circle
						//    |
						//  -----
						//    |
						//    ↑
						endPoint: center.plus(Vec2.of(0, width)),
					},
					{
						kind: PathCommandType.QuadraticBezierTo,
						controlPoint: center.plus(Vec2.of(-width, width)),
						endPoint: center.plus(Vec2.of(-width, 0)),
					},
					{
						kind: PathCommandType.QuadraticBezierTo,
						controlPoint: center.plus(Vec2.of(-width, -width)),
						endPoint: center.plus(Vec2.of(0, -width)),
					},
					{
						kind: PathCommandType.QuadraticBezierTo,
						controlPoint: center.plus(Vec2.of(width, -width)),
						endPoint: center.plus(Vec2.of(width, 0)),
					},
				],
				style: this.getRenderingStyle(),
			});
			return;
		}

		this.segments.push(this.currentSegmentToPath());
		const lastPoint = this.buffer[this.buffer.length - 1];
		this.lastExitingVec = Vec2.ofXY(
			this.currentCurve.points[2]
		).minus(Vec2.ofXY(this.currentCurve.points[1]));
		console.assert(this.lastExitingVec.magnitude() !== 0);

		// Use the last two points to start a new curve (the last point isn't used
		// in the current curve and we want connected curves to share end points)
		this.buffer = [
			this.buffer[this.buffer.length - 2], lastPoint,
		];
		this.currentCurve = null;
	}

	private currentSegmentToPath(): RenderablePathSpec {
		if (this.currentCurve == null) {
			throw new Error('Invalid State: currentCurve is null!');
		}

		let startVec = Vec2.ofXY(this.currentCurve.normal(0)).normalized();
		let endVec = Vec2.ofXY(this.currentCurve.normal(1)).normalized();

		startVec = startVec.times(this.curveStartWidth / 2);
		endVec = endVec.times(this.curveEndWidth / 2);

		if (isNaN(startVec.magnitude())) {
			// TODO: This can happen when events are too close together. Find out why and
			// 		 fix.
			console.error('startVec is NaN', startVec, endVec, this.currentCurve);
			startVec = endVec;
		}

		const startPt = Vec2.ofXY(this.currentCurve.get(0));
		const endPt = Vec2.ofXY(this.currentCurve.get(1));
		const controlPoint = Vec2.ofXY(this.currentCurve.points[1]);

		// Approximate the normal at the location of the control point
		let projectionT = this.currentCurve.project(controlPoint.xy).t;
		if (!projectionT) {
			if (startPt.minus(controlPoint).magnitudeSquared() < endPt.minus(controlPoint).magnitudeSquared()) {
				projectionT = 0.1;
			} else {
				projectionT = 0.9;
			}
		}

		const halfVecT = projectionT;
		let halfVec = Vec2.ofXY(this.currentCurve.normal(halfVecT))
			.normalized().times(
				this.curveStartWidth / 2 * halfVecT
				+ this.curveEndWidth / 2 * (1 - halfVecT)
			);

		// Computes a boundary curve. [direction] should be either +1 or -1 (determines the side
		// of the center curve to place the boundary).
		const computeBoundaryCurve = (direction: number, halfVec: Vec2) => {
			return new Bezier(
				startPt.plus(startVec.times(direction)),
				controlPoint.plus(halfVec.times(direction)),
				endPt.plus(endVec.times(direction)),
			);
		};

		const upperBoundary = computeBoundaryCurve(1, halfVec);
		const lowerBoundary = computeBoundaryCurve(-1, halfVec);

		// If the boundaries have two intersections, increasing the half vector's length could fix this.
		if (upperBoundary.intersects(lowerBoundary).length === 2) {
			halfVec = halfVec.times(2);
		}


		const pathCommands: PathCommand[] = [
			{
				kind: PathCommandType.QuadraticBezierTo,
				controlPoint: this.roundPoint(controlPoint.plus(halfVec)),
				endPoint: this.roundPoint(endPt.plus(endVec)),
			},

			{
				kind: PathCommandType.LineTo,
				point: this.roundPoint(endPt.minus(endVec)),
			},

			{
				kind: PathCommandType.QuadraticBezierTo,
				controlPoint: this.roundPoint(controlPoint.minus(halfVec)),
				endPoint: this.roundPoint(startPt.minus(startVec)),
			},
		];

		return {
			startPoint: this.roundPoint(startPt.plus(startVec)),
			commands: pathCommands,
			style: this.getRenderingStyle(),
		};
	}

	// Compute the direction of the velocity at the end of this.buffer
	private computeExitingVec(): Vec2 {
		return this.momentum.normalized().times(this.lastPoint.width / 2);
	}

	public addPoint(newPoint: StrokeDataPoint) {
		if (this.lastPoint) {
			// Ignore points that are identical
			const fuzzEq = 1e-10;
			const deltaTime = newPoint.time - this.lastPoint.time;
			if (newPoint.pos.eq(this.lastPoint.pos, fuzzEq) || deltaTime === 0) {
				console.warn('Discarding identical point');
				return;
			} else if (isNaN(newPoint.pos.magnitude())) {
				console.warn('Discarding NaN point.', newPoint);
				return;
			}
			
			const threshold = Math.min(this.lastPoint.width, newPoint.width) / 4;
			const shouldSnapToInitial = this.startPoint.pos.minus(newPoint.pos).magnitude() < threshold
				&& this.segments.length === 0;
			
			// Snap to the starting point if the stroke is contained within a small ball centered
			// at the starting point.
			// This allows us to create a circle/dot at the start of the stroke.
			if (shouldSnapToInitial) {
				return;
			}

			const velocity = newPoint.pos.minus(this.lastPoint.pos).times(1 / (deltaTime) * 1000);
			this.momentum = this.momentum.lerp(velocity, 0.9);
		}

		const lastPoint = this.lastPoint ?? newPoint;
		this.lastPoint = newPoint;

		this.buffer.push(newPoint.pos);
		const pointRadius = newPoint.width / 2;
		const prevEndWidth = this.curveEndWidth;
		this.curveEndWidth = pointRadius;

		// recompute bbox
		this.bbox = this.bbox.grownToPoint(newPoint.pos, pointRadius);

		if (this.currentCurve === null) {
			const p1 = lastPoint.pos;
			const p2 = lastPoint.pos.plus(this.lastExitingVec ?? Vec2.unitX);
			const p3 = newPoint.pos;

			// Quadratic Bézier curve
			this.currentCurve = new Bezier(
				p1.xy, p2.xy, p3.xy
			);
			this.curveStartWidth = lastPoint.width / 2;
			console.assert(!isNaN(p1.magnitude()) && !isNaN(p2.magnitude()) && !isNaN(p3.magnitude()), 'Expected !NaN');
		}

		let enteringVec = this.lastExitingVec;
		if (!enteringVec) {
			let sampleIdx = Math.ceil(this.buffer.length / 3);
			if (sampleIdx === 0) {
				sampleIdx = this.buffer.length - 1;
			}

			enteringVec = this.buffer[sampleIdx].minus(this.buffer[0]);
		}

		let exitingVec = this.computeExitingVec();

		// Find the intersection between the entering vector and the exiting vector
		const maxRelativeLength = 2;
		const segmentStart = this.buffer[0];
		const segmentEnd = newPoint.pos;
		const startEndDist = segmentEnd.minus(segmentStart).magnitude();
		const maxControlPointDist = maxRelativeLength * startEndDist;

		// Exit in cases where we would divide by zero
		if (maxControlPointDist === 0 || exitingVec.magnitude() === 0 || isNaN(exitingVec.magnitude())) {
			return;
		}

		console.assert(!isNaN(enteringVec.magnitude()));

		enteringVec = enteringVec.normalized();
		exitingVec = exitingVec.normalized();

		console.assert(!isNaN(enteringVec.magnitude()));

		const lineFromStart = new LineSegment2(
			segmentStart,
			segmentStart.plus(enteringVec.times(maxControlPointDist))
		);
		const lineFromEnd = new LineSegment2(
			segmentEnd.minus(exitingVec.times(maxControlPointDist)),
			segmentEnd
		);
		const intersection = lineFromEnd.intersection(lineFromStart);

		// Position the control point at this intersection
		let controlPoint: Point2;
		if (intersection) {
			controlPoint = intersection.point;
		} else {
			// Position the control point closer to the first -- the connecting
			// segment will be roughly a line.
			controlPoint = segmentStart.plus(enteringVec.times(startEndDist / 4));
		}

		if (isNaN(controlPoint.magnitude()) || isNaN(segmentStart.magnitude())) {
			console.error('controlPoint is NaN', intersection, 'Start:', segmentStart, 'End:', segmentEnd, 'in:', enteringVec, 'out:', exitingVec);
		}

		const prevCurve = this.currentCurve;
		this.currentCurve = new Bezier(segmentStart.xy, controlPoint.xy, segmentEnd.xy);

		if (isNaN(Vec2.ofXY(this.currentCurve.normal(0)).magnitude())) {
			console.error('NaN normal at 0. Curve:', this.currentCurve);
			this.currentCurve = prevCurve;
		}

		// Should we start making a new curve? Check whether all buffer points are within
		// ±strokeWidth of the curve.
		const curveMatchesPoints = (curve: Bezier): boolean => {
			for (const point of this.buffer) {
				const proj =
					Vec2.ofXY(curve.project(point.xy));
				const dist = proj.minus(point).magnitude();

				const minFit = Math.max(
					Math.min(this.curveStartWidth, this.curveEndWidth) / 2,
					this.minFitAllowed
				);
				if (dist > minFit || dist > this.maxFitAllowed) {
					return false;
				}
			}
			return true;
		};

		if (this.buffer.length > 3) {
			if (!curveMatchesPoints(this.currentCurve)) {
				// Use a curve that better fits the points
				this.currentCurve = prevCurve;
				this.curveEndWidth = prevEndWidth;

				// Reset the last point -- the current point was not added to the curve.
				this.lastPoint = lastPoint;

				this.finalizeCurrentCurve();
				return;
			}
		}
	}
}
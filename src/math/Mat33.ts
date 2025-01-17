import { Point2, Vec2 } from './Vec2';
import Vec3 from './Vec3';

export type Mat33Array = [
	number, number, number,
	number, number, number,
	number, number, number,
];

/**
 * Represents a three dimensional linear transformation or
 * a two-dimensional affine transformation. (An affine transformation scales/rotates/shears
 * **and** translates while a linear transformation just scales/rotates/shears).
 */
export default class Mat33 {
	private readonly rows: Vec3[];

	/**
	 * Creates a matrix from inputs in the form,
	 * ```
	 * ⎡ a1 a2 a3 ⎤
	 * ⎢ b1 b2 b3 ⎥
	 * ⎣ c1 c2 c3 ⎦
	 * ```
	 */
	public constructor(
		public readonly a1: number,
		public readonly a2: number,
		public readonly a3: number,

		public readonly b1: number,
		public readonly b2: number,
		public readonly b3: number,

		public readonly c1: number,
		public readonly c2: number,
		public readonly c3: number
	) {
		this.rows = [
			Vec3.of(a1, a2, a3),
			Vec3.of(b1, b2, b3),
			Vec3.of(c1, c2, c3),
		];
	}

	/**
	 * Creates a matrix from the given rows:
	 * ```
	 *  ⎡ r1.x r1.y r1.z ⎤
	 *  ⎢ r2.x r2.y r2.z ⎥
	 *  ⎣ r3.x r3.y r3.z ⎦
	 * ```
	 */
	public static ofRows(r1: Vec3, r2: Vec3, r3: Vec3): Mat33 {
		return new Mat33(
			r1.x, r1.y, r1.z,
			r2.x, r2.y, r2.z,
			r3.x, r3.y, r3.z
		);
	}

	public static identity = new Mat33(
		1, 0, 0,
		0, 1, 0,
		0, 0, 1
	);

	/**
	 * Either returns the inverse of this, or, if this matrix is singular/uninvertable,
	 * returns Mat33.identity.
	 * 
	 * This may cache the computed inverse and return the cached version instead of recomputing
	 * it.
	 */
	public inverse(): Mat33 {
		return this.computeInverse() ?? Mat33.identity;
	}

	public invertable(): boolean {
		return this.computeInverse() !== null;
	}

	private cachedInverse: Mat33|undefined|null = undefined;
	private computeInverse(): Mat33|null {
		if (this.cachedInverse !== undefined) {
			return this.cachedInverse;
		}

		const toIdentity = [
			this.rows[0],
			this.rows[1],
			this.rows[2],
		];

		const toResult = [
			Vec3.unitX,
			Vec3.unitY,
			Vec3.unitZ,
		];

		// Convert toIdentity to the identity matrix and
		// toResult to the inverse through elementary row operations
		for (let cursor = 0; cursor < 3; cursor++) {
			// Select the [cursor]th diagonal entry
			let pivot = toIdentity[cursor].at(cursor);

			// Don't divide by zero (treat very small numbers as zero).
			const minDivideBy = 1e-10;
			if (Math.abs(pivot) < minDivideBy) {
				let swapIndex = -1;
				// For all other rows,
				for (let i = 1; i <= 2; i++) {
					const otherRowIdx = (cursor + i) % 3;

					if (Math.abs(toIdentity[otherRowIdx].at(cursor)) >= minDivideBy) {
						swapIndex = otherRowIdx;
						break;
					}
				}

				// Can't swap with another row?
				if (swapIndex === -1) {
					this.cachedInverse = null;
					return null;
				}

				const tmpIdentityRow = toIdentity[cursor];
				const tmpResultRow = toResult[cursor];

				// Swap!
				toIdentity[cursor] = toIdentity[swapIndex];
				toResult[cursor] = toResult[swapIndex];
				toIdentity[swapIndex] = tmpIdentityRow;
				toResult[swapIndex] = tmpResultRow;

				pivot = toIdentity[cursor].at(cursor);
			}

			// Make toIdentity[k = cursor] = 1
			let scale = 1.0 / pivot;
			toIdentity[cursor] = toIdentity[cursor].times(scale);
			toResult[cursor] = toResult[cursor].times(scale);

			const cursorToIdentityRow = toIdentity[cursor];
			const cursorToResultRow = toResult[cursor];

			// Make toIdentity[k ≠ cursor] = 0
			for (let i = 1; i <= 2; i++) {
				const otherRowIdx = (cursor + i) % 3;
				scale = -toIdentity[otherRowIdx].at(cursor);
				toIdentity[otherRowIdx] = toIdentity[otherRowIdx].plus(
					cursorToIdentityRow.times(scale)
				);
				toResult[otherRowIdx] = toResult[otherRowIdx].plus(
					cursorToResultRow.times(scale)
				);
			}
		}

		const inverse = Mat33.ofRows(
			toResult[0],
			toResult[1],
			toResult[2]
		);
		this.cachedInverse = inverse;
		return inverse;
	}

	public transposed(): Mat33 {
		return new Mat33(
			this.a1, this.b1, this.c1,
			this.a2, this.b2, this.c2,
			this.a3, this.b3, this.c3
		);
	}

	public rightMul(other: Mat33): Mat33 {
		other = other.transposed();

		const at = (row: number, col: number): number => {
			return this.rows[row].dot(other.rows[col]);
		};

		return new Mat33(
			at(0, 0), at(0, 1), at(0, 2),
			at(1, 0), at(1, 1), at(1, 2),
			at(2, 0), at(2, 1), at(2, 2)
		);
	}

	/**
	 * Applies this as an affine transformation to the given vector.
	 * Returns a transformed version of `other`.
	 */
	public transformVec2(other: Vec2): Vec2 {
		// When transforming a Vec2, we want to use the z transformation
		// components of this for translation:
		//  ⎡ . . tX ⎤
		//  ⎢ . . tY ⎥
		//  ⎣ 0 0 1  ⎦
		// For this, we need other's z component to be 1 (so that tX and tY
		// are scaled by 1):
		let intermediate = Vec3.of(other.x, other.y, 1);
		intermediate = this.transformVec3(intermediate);

		// Drop the z=1 to allow magnitude to work as expected
		return Vec2.of(intermediate.x, intermediate.y);
	}

	/**
	 * Applies this as a linear transformation to the given vector (doesn't translate).
	 * This is the standard way of transforming vectors in ℝ³.
	 */
	public transformVec3(other: Vec3): Vec3 {
		return Vec3.of(
			this.rows[0].dot(other),
			this.rows[1].dot(other),
			this.rows[2].dot(other)
		);
	}

	/** Returns true iff this = other ± fuzz */
	public eq(other: Mat33, fuzz: number = 0): boolean {
		for (let i = 0; i < 3; i++) {
			if (!this.rows[i].eq(other.rows[i], fuzz)) {
				return false;
			}
		}

		return true;
	}

	public toString(): string {
		return `
⎡ ${this.a1},\t ${this.a2},\t ${this.a3}\t ⎤
⎢ ${this.b1},\t ${this.b2},\t ${this.b3}\t ⎥
⎣ ${this.c1},\t ${this.c2},\t ${this.c3}\t ⎦
		`.trimEnd().trimStart();
	}

	/**
	 * ```
	 * result[0] = top left element
	 * result[1] = element at row zero, column 1
	 * ...
	 * ```
	 */
	public toArray(): Mat33Array {
		return [
			this.a1, this.a2, this.a3,
			this.b1, this.b2, this.b3,
			this.c1, this.c2, this.c3,
		];
	}

	/**
	 * @example
	 * ```
	 * new Mat33(
	 *  1, 2, 3,
	 *  4, 5, 6,
	 *  7, 8, 9,
	 * ).mapEntries(component => component - 1);
	 * // → ⎡ 0, 1, 2 ⎤
	 * //   ⎢ 3, 4, 5 ⎥
	 * //   ⎣ 6, 7, 8 ⎦
	 * ```
	 */
	public mapEntries(mapping: (component: number)=>number): Mat33 {
		return new Mat33(
			mapping(this.a1), mapping(this.a2), mapping(this.a3),
			mapping(this.b1), mapping(this.b2), mapping(this.b3),
			mapping(this.c1), mapping(this.c2), mapping(this.c3),
		);
	}

	/** Constructs a 3x3 translation matrix (for translating `Vec2`s) */
	public static translation(amount: Vec2): Mat33 {
		// When transforming Vec2s by a 3x3 matrix, we give the input
		// Vec2s z = 1. As such,
		//   outVec2.x = inVec2.x * 1 + inVec2.y * 0 + 1 * amount.x
		//   ...
		return new Mat33(
			1, 0, amount.x,
			0, 1, amount.y,
			0, 0, 1
		);
	}

	public static zRotation(radians: number, center: Point2 = Vec2.zero): Mat33 {
		const cos = Math.cos(radians);
		const sin = Math.sin(radians);

		// Translate everything so that rotation is about the origin
		let result = Mat33.translation(center);

		result = result.rightMul(new Mat33(
			cos, -sin, 0,
			sin, cos, 0,
			0, 0, 1
		));
		return result.rightMul(Mat33.translation(center.times(-1)));
	}

	public static scaling2D(amount: number|Vec2, center: Point2 = Vec2.zero): Mat33 {
		let result = Mat33.translation(center);
		let xAmount, yAmount;

		if (typeof amount === 'number') {
			xAmount = amount;
			yAmount = amount;
		} else {
			xAmount = amount.x;
			yAmount = amount.y;
		}

		result = result.rightMul(new Mat33(
			xAmount, 0, 0,
			0, yAmount, 0,
			0, 0, 1
		));

		// Translate such that [center] goes to (0, 0)
		return result.rightMul(Mat33.translation(center.times(-1)));
	}

	/** @see {@link !fromCSSMatrix} */
	public toCSSMatrix(): string {
		return `matrix(${this.a1},${this.b1},${this.a2},${this.b2},${this.a3},${this.b3})`;
	}

	/**
	 * Converts a CSS-form `matrix(a, b, c, d, e, f)` to a Mat33.
	 * 
	 * Note that such a matrix has the form,
	 * ```
	 * ⎡ a c e ⎤
	 * ⎢ b d f ⎥
	 * ⎣ 0 0 1 ⎦
	 * ```
	 */
	public static fromCSSMatrix(cssString: string): Mat33 {
		if (cssString === '' || cssString === 'none') {
			return Mat33.identity;
		}

		const numberExp = '([-]?\\d*(?:\\.\\d*)?(?:[eE][-]?\\d+)?)';
		const numberSepExp = '[, \\t\\n]';
		const regExpSource = `^\\s*matrix\\s*\\(${
			[
				// According to MDN, matrix(a,b,c,d,e,f) has form:
				// 		⎡ a c e ⎤
				// 		⎢ b d f ⎥
				// 		⎣ 0 0 1 ⎦
				numberExp, numberExp, numberExp, // a, c, e
				numberExp, numberExp, numberExp, // b, d, f
			].join(`${numberSepExp}+`)
		}${numberSepExp}*\\)\\s*$`;
		const matrixExp = new RegExp(regExpSource, 'i');
		const match = matrixExp.exec(cssString);

		if (!match) {
			throw new Error(`Unsupported transformation: ${cssString}`);
		}

		const matrixData = match.slice(1).map(entry => parseFloat(entry));
		const a = matrixData[0];
		const b = matrixData[1];
		const c = matrixData[2];
		const d = matrixData[3];
		const e = matrixData[4];
		const f = matrixData[5];

		const transform = new Mat33(
			a, c, e,
			b, d, f,
			0, 0, 1
		);
		return transform;
	}
}

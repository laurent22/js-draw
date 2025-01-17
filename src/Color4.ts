
export default class Color4 {
	private constructor(
		/** Red component. Should be in the range [0, 1]. */
		public readonly r: number,

		/** Green component. `g` ∈ [0, 1] */
		public readonly g: number,

		/** Blue component. `b` ∈ [0, 1] */
		public readonly b: number,

		/** Alpha/transparent component. `a` ∈ [0, 1] */
		public readonly a: number
	) {
	}

	/**
	 * Create a color from red, green, blue components. The color is fully opaque (`a = 1.0`).
	 * 
	 * Each component should be in the range [0, 1].
	 */
	public static ofRGB(red: number, green: number, blue: number): Color4 {
		return Color4.ofRGBA(red, green, blue, 1.0);
	}

	public static ofRGBA(red: number, green: number, blue: number, alpha: number): Color4 {
		red = Math.max(0, Math.min(red, 1));
		green = Math.max(0, Math.min(green, 1));
		blue = Math.max(0, Math.min(blue, 1));
		alpha = Math.max(0, Math.min(alpha, 1));

		return new Color4(red, green, blue, alpha);
	}

	public static fromHex(hexString: string): Color4 {
		// Remove starting '#' (if present)
		hexString = (hexString.match(/^[#]?(.*)$/) ?? [])[1];
		hexString = hexString.toUpperCase();

		if (!hexString.match(/^[0-9A-F]+$/)) {
			throw new Error(`${hexString} is not in a valid format.`);
		}

		// RGBA or RGB
		if (hexString.length === 3 || hexString.length === 4) {
			// Each character is a component
			const components = hexString.split('');

			// Convert to RRGGBBAA or RRGGBB format
			hexString = components.map(component => `${component}0`).join('');
		}

		if (hexString.length === 6) {
			// Alpha component
			hexString += 'FF';
		}

		const components: number[] = [];
		for (let i = 2; i <= hexString.length; i += 2) {
			const chunk = hexString.substring(i - 2, i);
			components.push(parseInt(chunk, 16) / 255);
		}

		if (components.length !== 4) {
			throw new Error(`Unable to parse ${hexString}: Wrong number of components.`);
		}

		return Color4.ofRGBA(components[0], components[1], components[2], components[3]);
	}

	/** Like fromHex, but can handle additional colors if an `HTMLCanvasElement` is available. */
	public static fromString(text: string): Color4 {
		if (text.startsWith('#')) {
			return Color4.fromHex(text);
		} else {
			// Otherwise, try to use an HTML5Canvas to determine the color
			const canvas = document.createElement('canvas');
			canvas.width = 1;
			canvas.height = 1;

			const ctx = canvas.getContext('2d')!;
			ctx.fillStyle = text;
			ctx.fillRect(0, 0, 1, 1);

			const data = ctx.getImageData(0, 0, 1, 1);
			const red = data.data[0] / 255;
			const green = data.data[1] / 255;
			const blue = data.data[2] / 255;
			const alpha = data.data[3] / 255;

			return Color4.ofRGBA(red, green, blue, alpha);
		}
	}

	/** @returns true if `this` and `other` are approximately equal. */
	public eq(other: Color4|null|undefined): boolean {
		if (other == null) {
			return false;
		}

		return this.toHexString() === other.toHexString();
	}

	private hexString: string|null = null;

	/**
	 * @returns a hexadecimal color string representation of `this`, in the form `#rrggbbaa`.
	 * 
	 * @example
	 * ```
	 * Color4.red.toHexString(); // -> #ff0000ff
	 * ```
	 */
	public toHexString(): string {
		if (this.hexString) {
			return this.hexString;
		}

		const componentToHex = (component: number): string => {
			const res = Math.round(255 * component).toString(16);

			if (res.length === 1) {
				return `0${res}`;
			}
			return res;
		};

		const alpha = componentToHex(this.a);
		const red = componentToHex(this.r);
		const green = componentToHex(this.g);
		const blue = componentToHex(this.b);
		if (alpha === 'ff') {
			return `#${red}${green}${blue}`;
		}
		this.hexString = `#${red}${green}${blue}${alpha}`;
		return this.hexString;
	}

	public static transparent = Color4.ofRGBA(0, 0, 0, 0);
	public static red = Color4.ofRGB(1.0, 0.0, 0.0);
	public static green = Color4.ofRGB(0.0, 1.0, 0.0);
	public static blue = Color4.ofRGB(0.0, 0.0, 1.0);
	public static purple = Color4.ofRGB(0.5, 0.2, 0.5);
	public static yellow = Color4.ofRGB(1, 1, 0.1);
	public static clay = Color4.ofRGB(0.8, 0.4, 0.2);
	public static black = Color4.ofRGB(0, 0, 0);
	public static white = Color4.ofRGB(1, 1, 1);
}

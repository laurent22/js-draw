import LineSegment2 from '../math/LineSegment2';
import Mat33, { Mat33Array } from '../math/Mat33';
import Rect2 from '../math/Rect2';
import AbstractRenderer, { RenderableImage } from '../rendering/renderers/AbstractRenderer';
import AbstractComponent from './AbstractComponent';
import { ImageComponentLocalization } from './localization';

// Represents a raster image.
export default class ImageComponent extends AbstractComponent {
	protected contentBBox: Rect2;
	private image: RenderableImage;

	public constructor(image: RenderableImage) {
		super('image-component');
		this.image = {
			...image,
			label: image.label ?? image.image.getAttribute('alt') ?? image.image.getAttribute('aria-label') ?? undefined,
		};

		const isHTMLImageElem = (elem: HTMLCanvasElement|HTMLImageElement): elem is HTMLImageElement => {
			return elem.getAttribute('src') !== undefined;
		};
		if (isHTMLImageElem(image.image) && !image.image.complete) {
			image.image.onload = () => this.recomputeBBox();
		}

		this.recomputeBBox();
	}

	private getImageRect() {
		return new Rect2(0, 0, this.image.image.width, this.image.image.height);
	}

	private recomputeBBox() {
		this.contentBBox = this.getImageRect();
		this.contentBBox = this.contentBBox.transformedBoundingBox(this.image.transform);
	}

	// Load from an image. Waits for the image to load if incomplete.
	public static async fromImage(elem: HTMLImageElement, transform: Mat33) {
		if (!elem.complete) {
			await new Promise((resolve, reject) => {
				elem.onload = resolve;
				elem.onerror = reject;
				elem.onabort = reject;
			});
		}

		let width, height;
		if (
			typeof elem.width === 'number' && typeof elem.height === 'number'
			&& elem.width !== 0 && elem.height !== 0
		) {
			width = elem.width as number;
			height = elem.height as number;
		} else {
			width = elem.clientWidth;
			height = elem.clientHeight;
		}

		let image;
		let url = elem.src ?? '';
		if (!url.startsWith('data:image/')) {
			// Convert to a data URL:
			const canvas = document.createElement('canvas');
			canvas.width = width;
			canvas.height = height;

			const ctx = canvas.getContext('2d')!;
			ctx.drawImage(elem, 0, 0, canvas.width, canvas.height);
			url = canvas.toDataURL();
			image = canvas;
		} else {
			image = new Image();
			image.src = url;
			image.width = width;
			image.height = height;
		}

		return new ImageComponent({
			image,
			base64Url: url,
			transform: transform,
		});
	}

	public render(canvas: AbstractRenderer, _visibleRect?: Rect2): void {
		canvas.drawImage(this.image);
	}

	public intersects(lineSegment: LineSegment2): boolean {
		const rect = this.getImageRect();
		const edges = rect.getEdges().map(edge => edge.transformedBy(this.image.transform));
		for (const edge of edges) {
			if (edge.intersects(lineSegment)) {
				return true;
			}
		}
		return false;
	}

	protected serializeToJSON() {
		return {
			src: this.image.base64Url,
			label: this.image.label,

			// Store the width and height for bounding box computations while the image is loading.
			width: this.image.image.width,
			height: this.image.image.height,

			transform: this.image.transform.toArray(),
		};
	}

	protected applyTransformation(affineTransfm: Mat33) {
		this.image.transform = affineTransfm.rightMul(this.image.transform);
		this.recomputeBBox();
	}

	public description(localizationTable: ImageComponentLocalization): string {
		return this.image.label ? localizationTable.imageNode(this.image.label) : localizationTable.unlabeledImageNode;
	}

	protected createClone(): AbstractComponent {
		return new ImageComponent({
			...this.image,
		});
	}

	public static deserializeFromJSON(data: any): ImageComponent {
		if (!(typeof data.src === 'string')) {
			throw new Error(`${data} has invalid format! Expected src property.`);
		}

		const image = new Image();
		image.src = data.src;
		image.width = data.width;
		image.height = data.height;

		return new ImageComponent({
			image: image,
			base64Url: image.src,
			label: data.label,
			transform: new Mat33(...(data.transform as Mat33Array)),
		});
	}
}

AbstractComponent.registerComponent('image-component', ImageComponent.deserializeFromJSON);

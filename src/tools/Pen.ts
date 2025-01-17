import Color4 from '../Color4';
import Editor from '../Editor';
import EditorImage from '../EditorImage';
import Pointer, { PointerDevice } from '../Pointer';
import { makeFreehandLineBuilder } from '../components/builders/FreehandLineBuilder';
import { EditorEventType, KeyPressEvent, PointerEvt, StrokeDataPoint } from '../types';
import BaseTool from './BaseTool';
import { ComponentBuilder, ComponentBuilderFactory } from '../components/builders/types';

export interface PenStyle {
    color: Color4;
    thickness: number;
}

export default class Pen extends BaseTool {
	protected builder: ComponentBuilder|null = null;
	protected builderFactory: ComponentBuilderFactory = makeFreehandLineBuilder;
	private lastPoint: StrokeDataPoint|null = null;

	public constructor(
		private editor: Editor,
		description: string,
		private style: PenStyle,
	) {
		super(editor.notifier, description);
	}

	private getPressureMultiplier() {
		return 1 / this.editor.viewport.getScaleFactor() * this.style.thickness;
	}

	// Converts a `pointer` to a `StrokeDataPoint`.
	protected toStrokePoint(pointer: Pointer): StrokeDataPoint {
		const minPressure = 0.3;
		let pressure = Math.max(pointer.pressure ?? 1.0, minPressure);

		if (!isFinite(pressure)) {
			console.warn('Non-finite pressure!', pointer);
			pressure = minPressure;
		}
		console.assert(isFinite(pointer.canvasPos.length()), 'Non-finite canvas position!');
		console.assert(isFinite(pointer.screenPos.length()), 'Non-finite screen position!');
		console.assert(isFinite(pointer.timeStamp), 'Non-finite timeStamp on pointer!');

		return {
			pos: pointer.canvasPos,
			width: pressure * this.getPressureMultiplier(),
			color: this.style.color,
			time: pointer.timeStamp,
		};
	}

	// Displays the stroke that is currently being built with the display's `wetInkRenderer`.
	protected previewStroke() {
		this.editor.clearWetInk();
		this.builder?.preview(this.editor.display.getWetInkRenderer());
	}

	// Throws if no stroke builder exists.
	protected addPointToStroke(point: StrokeDataPoint) {
		if (!this.builder) {
			throw new Error('No stroke is currently being generated.');
		}
		this.builder.addPoint(point);
		this.lastPoint = point;
		this.previewStroke();
	}

	public onPointerDown({ current, allPointers }: PointerEvt): boolean {
		const isEraser = current.device === PointerDevice.Eraser;

		let anyDeviceIsStylus = false;
		for (const pointer of allPointers) {
			if (pointer.device === PointerDevice.Pen) {
				anyDeviceIsStylus = true;
				break;
			}
		}

		if ((allPointers.length === 1 && !isEraser) || anyDeviceIsStylus) {
			this.builder = this.builderFactory(this.toStrokePoint(current), this.editor.viewport);
			return true;
		}

		return false;
	}

	public onPointerMove({ current }: PointerEvt): void {
		this.addPointToStroke(this.toStrokePoint(current));
	}

	public onPointerUp({ current }: PointerEvt): void {
		if (!this.builder) {
			return;
		}

		// onPointerUp events can have zero pressure. Use the last pressure instead.
		const currentPoint = this.toStrokePoint(current);
		const strokePoint = {
			...currentPoint,
			width: this.lastPoint?.width ?? currentPoint.width,
		};

		this.addPointToStroke(strokePoint);
		if (this.builder && current.isPrimary) {
			const stroke = this.builder.build();
			this.previewStroke();

			if (stroke.getBBox().area > 0) {
				const canFlatten = true;
				const action = EditorImage.addElement(stroke, canFlatten);
				this.editor.dispatch(action);
			} else {
				console.warn('Pen: Not adding empty stroke', stroke, 'to the canvas.');
			}
		}
		this.builder = null;
		this.editor.clearWetInk();
	}

	public onGestureCancel() {
		this.editor.clearWetInk();
	}

	private noteUpdated() {
		this.editor.notifier.dispatch(EditorEventType.ToolUpdated, {
			kind: EditorEventType.ToolUpdated,
			tool: this,
		});
	}

	public setColor(color: Color4): void {
		if (color.toHexString() !== this.style.color.toHexString()) {
			this.style = {
				...this.style,
				color,
			};
			this.noteUpdated();
		}
	}

	public setThickness(thickness: number) {
		if (thickness !== this.style.thickness) {
			this.style = {
				...this.style,
				thickness,
			};
			this.noteUpdated();
		}
	}

	public setStrokeFactory(factory: ComponentBuilderFactory) {
		if (factory !== this.builderFactory) {
			this.builderFactory = factory;
			this.noteUpdated();
		}
	}

	public getThickness() { return this.style.thickness; }
	public getColor() { return this.style.color; }
	public getStrokeFactory() { return this.builderFactory; }

	public onKeyPress({ key }: KeyPressEvent): boolean {
		key = key.toLowerCase();

		let newThickness: number|undefined;
		if (key === '-' || key === '_') {
			newThickness = this.getThickness() * 2/3;
		} else if (key === '+' || key === '=') {
			newThickness = this.getThickness() * 3/2;
		}

		if (newThickness !== undefined) {
			newThickness = Math.min(Math.max(1, newThickness), 256);
			this.setThickness(newThickness);
			return true;
		}

		return false;
	}
}

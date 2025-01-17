import { PointerEvt } from '../types';
import BaseTool from './BaseTool';
import Editor from '../Editor';
import { Point2 } from '../math/Vec2';
import LineSegment2 from '../math/LineSegment2';
import Erase from '../commands/Erase';
import AbstractComponent from '../components/AbstractComponent';
import { PointerDevice } from '../Pointer';

export default class Eraser extends BaseTool {
	private lastPoint: Point2;
	private command: Erase|null = null;
	private toRemove: AbstractComponent[];

	public constructor(private editor: Editor, description: string) {
		super(editor.notifier, description);
	}

	public onPointerDown(event: PointerEvt): boolean {
		if (event.allPointers.length === 1 || event.current.device === PointerDevice.Eraser) {
			this.lastPoint = event.current.canvasPos;
			this.toRemove = [];
			return true;
		}

		return false;
	}

	public onPointerMove(event: PointerEvt): void {
		const currentPoint = event.current.canvasPos;
		if (currentPoint.minus(this.lastPoint).magnitude() === 0) {
			return;
		}

		const line = new LineSegment2(this.lastPoint, currentPoint);
		const region = line.bbox;

		// Remove any intersecting elements.
		this.toRemove.push(...this.editor.image
			.getElementsIntersectingRegion(region).filter(component => {
				return component.intersects(line);
			}));

		this.command?.unapply(this.editor);
		this.command = new Erase(this.toRemove);
		this.command.apply(this.editor);

		this.lastPoint = currentPoint;
	}

	public onPointerUp(_event: PointerEvt): void {
		if (this.command && this.toRemove.length > 0) {
			this.command?.unapply(this.editor);

			// Dispatch the command to make it undo-able
			this.editor.dispatch(this.command);
		}
		this.command = null;
	}

	public onGestureCancel(): void {
		this.command?.unapply(this.editor);
		this.command = null;
	}
}

/**
 * @internal
 * @packageDocumentation
 */

import SerializableCommand from '../../commands/SerializableCommand';
import Editor from '../../Editor';
import { Mat33, Rect2 } from '../../math/lib';
import { Point2, Vec2 } from '../../math/Vec2';
import Pointer from '../../Pointer';
import SelectionHandle, { HandleShape, handleSize } from './SelectionHandle';
import { cssPrefix } from './SelectionTool';
import AbstractComponent from '../../components/AbstractComponent';
import { Mat33Array } from '../../math/Mat33';
import { EditorLocalization } from '../../localization';
import Viewport from '../../Viewport';
import Erase from '../../commands/Erase';
import Duplicate from '../../commands/Duplicate';
import Command from '../../commands/Command';
import { DragTransformer, ResizeTransformer, RotateTransformer } from './TransformMode';
import { ResizeMode } from './types';

const updateChunkSize = 100;

// @internal
export default class Selection {
	private handles: SelectionHandle[];
	private originalRegion: Rect2;

	private transformers;

	private transform: Mat33 = Mat33.identity;
	private transformCommands: SerializableCommand[] = [];

	private selectedElems: AbstractComponent[] = [];

	private container: HTMLElement;
	private backgroundElem: HTMLElement;

	public constructor(startPoint: Point2, private editor: Editor) {
		this.originalRegion = new Rect2(startPoint.x, startPoint.y, 0, 0);
		this.transformers = {
			drag: new DragTransformer(editor, this),
			resize: new ResizeTransformer(editor, this),
			rotate: new RotateTransformer(editor, this),
		};

		this.container = document.createElement('div');
		this.backgroundElem = document.createElement('div');
		this.backgroundElem.classList.add(`${cssPrefix}selection-background`);
		this.container.appendChild(this.backgroundElem);

		const resizeHorizontalHandle = new SelectionHandle(
			HandleShape.Square,
			Vec2.of(1, 0.5),
			this,
			(startPoint) => this.transformers.resize.onDragStart(startPoint, ResizeMode.HorizontalOnly),
			(currentPoint) => this.transformers.resize.onDragUpdate(currentPoint),
			() => this.transformers.resize.onDragEnd(),
		);

		const resizeVerticalHandle = new SelectionHandle(
			HandleShape.Square,
			Vec2.of(0.5, 1),
			this,
			(startPoint) => this.transformers.resize.onDragStart(startPoint, ResizeMode.VerticalOnly),
			(currentPoint) => this.transformers.resize.onDragUpdate(currentPoint),
			() => this.transformers.resize.onDragEnd(),
		);

		const resizeBothHandle = new SelectionHandle(
			HandleShape.Square,
			Vec2.of(1, 1),
			this,
			(startPoint) => this.transformers.resize.onDragStart(startPoint, ResizeMode.Both),
			(currentPoint) => this.transformers.resize.onDragUpdate(currentPoint),
			() => this.transformers.resize.onDragEnd(),
		);

		const rotationHandle = new SelectionHandle(
			HandleShape.Circle,
			Vec2.of(0.5, 0),
			this,
			(startPoint) => this.transformers.rotate.onDragStart(startPoint),
			(currentPoint) => this.transformers.rotate.onDragUpdate(currentPoint),
			() => this.transformers.rotate.onDragEnd(),
		);

		this.handles = [
			resizeBothHandle,
			resizeHorizontalHandle,
			resizeVerticalHandle,
			rotationHandle,
		];

		for (const handle of this.handles) {
			handle.addTo(this.backgroundElem);
		}
	}

	public getTransform(): Mat33 {
		return this.transform;
	}

	public get preTransformRegion(): Rect2 {
		return this.originalRegion;
	}

	public get region(): Rect2 {
		// TODO: This currently assumes that the region rotates about its center.
		// This may not be true.
		const rotationMatrix = Mat33.zRotation(this.regionRotation, this.originalRegion.center);
		const scaleAndTranslateMat = this.transform.rightMul(rotationMatrix.inverse());
		return this.originalRegion.transformedBoundingBox(scaleAndTranslateMat);
	}

	public get regionRotation(): number {
		return this.transform.transformVec3(Vec2.unitX).angle();
	}

	public get preTransformedScreenRegion(): Rect2 {
		const toScreen = (vec: Point2) => this.editor.viewport.canvasToScreen(vec);
		return Rect2.fromCorners(
			toScreen(this.preTransformRegion.topLeft),
			toScreen(this.preTransformRegion.bottomRight)
		);
	}

	public get preTransformedScreenRegionRotation(): number {
		return this.editor.viewport.getRotationAngle();
	}

	public get screenRegion(): Rect2 {
		const toScreen = this.editor.viewport.canvasToScreenTransform;
		const scaleFactor = this.editor.viewport.getScaleFactor();

		const screenCenter = toScreen.transformVec2(this.region.center);

		return new Rect2(
			screenCenter.x, screenCenter.y, scaleFactor * this.region.width, scaleFactor * this.region.height
		).translatedBy(this.region.size.times(-scaleFactor/2));
	}

	public get screenRegionRotation(): number {
		return this.regionRotation + this.editor.viewport.getRotationAngle();
	}

	private computeTransformCommands(): SerializableCommand[] {
		return this.selectedElems.map(elem => {
			return elem.transformBy(this.transform);
		});
	}

	// Applies, previews, but doesn't finalize the given transformation.
	public setTransform(transform: Mat33, preview: boolean = true) {
		this.transform = transform;

		if (preview) {
			this.previewTransformCmds();
			this.scrollTo();
		}
	}

	// Applies the current transformation to the selection
	public finalizeTransform() {
		this.transformCommands.forEach(cmd => {
			cmd.unapply(this.editor);
		});

		const fullTransform = this.transform;
		const currentTransfmCommands = this.computeTransformCommands();

		// Reset for the next drag
		this.transformCommands = [];
		this.originalRegion = this.originalRegion.transformedBoundingBox(this.transform);
		this.transform = Mat33.identity;

		// Make the commands undo-able
		this.editor.dispatch(new Selection.ApplyTransformationCommand(
			this, currentTransfmCommands, fullTransform
		));
	}

	static {
		SerializableCommand.register('selection-tool-transform', (json: any, editor) => {
			// The selection box is lost when serializing/deserializing. No need to store box rotation
			const fullTransform: Mat33 = new Mat33(...(json.transform as Mat33Array));
			const commands = (json.commands as any[]).map(data => SerializableCommand.deserialize(data, editor));

			return new this.ApplyTransformationCommand(null, commands, fullTransform);
		});
	}

	private static ApplyTransformationCommand = class extends SerializableCommand {
		public constructor(
			private selection: Selection|null,
			private currentTransfmCommands: SerializableCommand[],
			private fullTransform: Mat33,
		) {
			super('selection-tool-transform');
		}

		public async apply(editor: Editor) {
			this.selection?.setTransform(this.fullTransform, false);
			this.selection?.updateUI();
			await editor.asyncApplyCommands(this.currentTransfmCommands, updateChunkSize);
			this.selection?.setTransform(Mat33.identity, false);
			this.selection?.recomputeRegion();
			this.selection?.updateUI();
		}

		public async unapply(editor: Editor) {
			this.selection?.setTransform(this.fullTransform.inverse(), false);
			this.selection?.updateUI();

			await editor.asyncUnapplyCommands(this.currentTransfmCommands, updateChunkSize);
			this.selection?.setTransform(Mat33.identity);
			this.selection?.recomputeRegion();
			this.selection?.updateUI();
		}

		protected serializeToJSON() {
			return {
				commands: this.currentTransfmCommands.map(command => command.serialize()),
				transform: this.fullTransform.toArray(),
			};
		}

		public description(_editor: Editor, localizationTable: EditorLocalization) {
			return localizationTable.transformedElements(this.currentTransfmCommands.length);
		}
	};

	// Preview the effects of the current transformation on the selection
	private previewTransformCmds() {
		// Don't render what we're moving if it's likely to be slow.
		if (this.selectedElems.length > updateChunkSize) {
			this.updateUI();
			return;
		}

		this.transformCommands.forEach(cmd => cmd.unapply(this.editor));
		this.transformCommands = this.computeTransformCommands();
		this.transformCommands.forEach(cmd => cmd.apply(this.editor));

		this.updateUI();
	}

	// Find the objects corresponding to this in the document,
	// select them.
	// Returns false iff nothing was selected.
	public resolveToObjects(): boolean {
		let singleItemSelectionMode = false;
		this.transform = Mat33.identity;

		// Grow the rectangle, if necessary
		if (this.region.w === 0 || this.region.h === 0) {
			const padding = this.editor.viewport.visibleRect.maxDimension / 200;
			this.originalRegion = Rect2.bboxOf(this.region.corners, padding);

			// Only select one item if the rectangle was very small.
			singleItemSelectionMode = true;
		}

		this.selectedElems = this.editor.image.getElementsIntersectingRegion(this.region).filter(elem => {
			if (this.region.containsRect(elem.getBBox())) {
				return true;
			}

			// Calculated bounding boxes can be slightly larger than their actual contents' bounding box.
			// As such, test with more lines than just this' edges.
			const testLines = [];
			for (const subregion of this.region.divideIntoGrid(2, 2)) {
				testLines.push(...subregion.getEdges());
			}

			return testLines.some(edge => elem.intersects(edge));
		});

		if (singleItemSelectionMode && this.selectedElems.length > 0) {
			this.selectedElems = [ this.selectedElems[this.selectedElems.length - 1] ];
		}

		// Find the bounding box of all selected elements.
		if (!this.recomputeRegion()) {
			return false;
		}
		this.updateUI();

		return true;
	}

	// Recompute this' region from the selected elements.
	// Returns false if the selection is empty.
	public recomputeRegion(): boolean {
		const newRegion = this.selectedElems.reduce((
			accumulator: Rect2|null, elem: AbstractComponent
		): Rect2 => {
			return (accumulator ?? elem.getBBox()).union(elem.getBBox());
		}, null);

		if (!newRegion) {
			this.cancelSelection();
			return false;
		}

		this.originalRegion = newRegion;

		const minSize = this.getMinCanvasSize();
		if (this.originalRegion.w < minSize || this.originalRegion.h < minSize) {
			// Add padding
			const padding = minSize / 2;
			this.originalRegion = Rect2.bboxOf(
				this.originalRegion.corners, padding
			);
		}

		return true;
	}

	public getMinCanvasSize(): number {
		const canvasHandleSize = handleSize / this.editor.viewport.getScaleFactor();
		return canvasHandleSize * 2;
	}

	public getSelectedItemCount() {
		return this.selectedElems.length;
	}

	// @internal
	public updateUI() {
		// marginLeft, marginTop: Display relative to the top left of the selection overlay.
		// left, top don't work for this.
		this.backgroundElem.style.marginLeft = `${this.screenRegion.topLeft.x}px`;
		this.backgroundElem.style.marginTop = `${this.screenRegion.topLeft.y}px`;

		this.backgroundElem.style.width = `${this.screenRegion.width}px`;
		this.backgroundElem.style.height = `${this.screenRegion.height}px`;

		const rotationDeg = this.screenRegionRotation * 180 / Math.PI;
		this.backgroundElem.style.transform = `rotate(${rotationDeg}deg)`;
		this.backgroundElem.style.transformOrigin = 'center';

		for (const handle of this.handles) {
			handle.updatePosition();
		}
	}

	private targetHandle: SelectionHandle|null = null;
	private backgroundDragging: boolean = false;
	public onDragStart(pointer: Pointer, target: EventTarget): boolean {
		for (const handle of this.handles) {
			if (handle.isTarget(target)) {
				handle.handleDragStart(pointer);
				this.targetHandle = handle;
				return true;
			}
		}

		if (this.backgroundElem === target) {
			this.backgroundDragging = true;
			this.transformers.drag.onDragStart(pointer.canvasPos);
			return true;
		}

		return false;
	}

	public onDragUpdate(pointer: Pointer) {
		if (this.backgroundDragging) {
			this.transformers.drag.onDragUpdate(pointer.canvasPos);
		}

		if (this.targetHandle) {
			this.targetHandle.handleDragUpdate(pointer);
		}

		this.updateUI();
	}

	public onDragEnd() {
		if (this.backgroundDragging) {
			this.transformers.drag.onDragEnd();
		}
		else if (this.targetHandle) {
			this.targetHandle.handleDragEnd();
		}

		this.backgroundDragging = false;
		this.targetHandle = null;
		this.updateUI();
	}

	public onDragCancel() {
		this.backgroundDragging = false;
		this.targetHandle = null;
		this.setTransform(Mat33.identity);
	}

	// Scroll the viewport to this. Does not zoom
	public scrollTo() {
		if (this.selectedElems.length === 0) {
			return;
		}

		const screenRect = new Rect2(0, 0, this.editor.display.width, this.editor.display.height);
		if (!screenRect.containsPoint(this.screenRegion.center)) {
			const closestPoint = screenRect.getClosestPointOnBoundaryTo(this.screenRegion.center);
			const screenDelta = this.screenRegion.center.minus(closestPoint);
			const delta = this.editor.viewport.screenToCanvasTransform.transformVec3(screenDelta);
			this.editor.dispatchNoAnnounce(
				Viewport.transformBy(Mat33.translation(delta.times(-1))), false
			);
		}
	}

	public deleteSelectedObjects(): Command {
		return new Erase(this.selectedElems);
	}

	public duplicateSelectedObjects(): Command {
		return new Duplicate(this.selectedElems);
	}

	public addTo(elem: HTMLElement) {
		if (this.container.parentElement) {
			this.container.remove();
		}

		elem.appendChild(this.container);
	}

	public setToPoint(point: Point2) {
		this.originalRegion = this.originalRegion.grownToPoint(point);
		this.updateUI();
	}

	public cancelSelection() {
		if (this.container.parentElement) {
			this.container.remove();
		}
		this.originalRegion = Rect2.empty;
	}

	public setSelectedObjects(objects: AbstractComponent[], bbox: Rect2) {
		this.originalRegion = bbox;
		this.selectedElems = objects;
		this.updateUI();
	}

	public getSelectedObjects(): AbstractComponent[] {
		return this.selectedElems;
	}
}


import Editor from './Editor';
import AbstractRenderer from './rendering/renderers/AbstractRenderer';
import Viewport from './Viewport';
import AbstractComponent from './components/AbstractComponent';
import Rect2 from './math/Rect2';
import { EditorLocalization } from './localization';
import RenderingCache from './rendering/caching/RenderingCache';
import SerializableCommand from './commands/SerializableCommand';

// @internal
export const sortLeavesByZIndex = (leaves: Array<ImageNode>) => {
	leaves.sort((a, b) => a.getContent()!.getZIndex() - b.getContent()!.getZIndex());
};

// Handles lookup/storage of elements in the image
export default class EditorImage {
	private root: ImageNode;
	private componentsById: Record<string, AbstractComponent>;

	// @internal
	public constructor() {
		this.root = new ImageNode();
		this.componentsById = {};
	}

	// Returns the parent of the given element, if it exists.
	public findParent(elem: AbstractComponent): ImageNode|null {
		const candidates = this.root.getLeavesIntersectingRegion(elem.getBBox());
		for (const candidate of candidates) {
			if (candidate.getContent() === elem) {
				return candidate;
			}
		}
		return null;
	}

	/** @internal */
	public renderWithCache(screenRenderer: AbstractRenderer, cache: RenderingCache, viewport: Viewport) {
		cache.render(screenRenderer, this.root, viewport);
	}

	/** @internal */
	public render(renderer: AbstractRenderer, viewport: Viewport) {
		this.root.render(renderer, viewport.visibleRect);
	}

	/** Renders all nodes, even ones not within the viewport. @internal */
	public renderAll(renderer: AbstractRenderer) {
		const leaves = this.root.getLeaves();
		sortLeavesByZIndex(leaves);

		for (const leaf of leaves) {
			leaf.getContent()!.render(renderer, leaf.getBBox());
		}
	}

	public getElementsIntersectingRegion(region: Rect2): AbstractComponent[] {
		const leaves = this.root.getLeavesIntersectingRegion(region);
		sortLeavesByZIndex(leaves);

		return leaves.map(leaf => leaf.getContent()!);
	}

	/** @internal */
	public onDestroyElement(elem: AbstractComponent) {
		delete this.componentsById[elem.getId()];
	}

	public lookupElement(id: string): AbstractComponent|null {
		return this.componentsById[id] ?? null;
	}

	private addElementDirectly(elem: AbstractComponent): ImageNode {
		this.componentsById[elem.getId()] = elem;
		return this.root.addLeaf(elem);
	}

	public static addElement(elem: AbstractComponent, applyByFlattening: boolean = false): SerializableCommand {
		return new EditorImage.AddElementCommand(elem, applyByFlattening);
	}

	// A Command that can access private [EditorImage] functionality
	private static AddElementCommand = class extends SerializableCommand {
		private serializedElem: any;

		// If [applyByFlattening], then the rendered content of this element
		// is present on the display's wet ink canvas. As such, no re-render is necessary
		// the first time this command is applied (the surfaces are joined instead).
		public constructor(
			private element: AbstractComponent,
			private applyByFlattening: boolean = false
		) {
			super('add-element');

			// Store the element's serialization --- .serializeToJSON may be called on this
			// even when this is not at the top of the undo/redo stack.
			this.serializedElem = element.serialize();

			if (isNaN(element.getBBox().area)) {
				throw new Error('Elements in the image cannot have NaN bounding boxes');
			}
		}

		public apply(editor: Editor) {
			editor.image.addElementDirectly(this.element);

			if (!this.applyByFlattening) {
				editor.queueRerender();
			} else {
				this.applyByFlattening = false;
				editor.display.flatten();
			}
		}

		public unapply(editor: Editor) {
			const container = editor.image.findParent(this.element);
			container?.remove();
			editor.queueRerender();
		}

		public description(_editor: Editor, localization: EditorLocalization) {
			return localization.addElementAction(this.element.description(localization));
		}

		protected serializeToJSON() {
			return {
				elemData: this.serializedElem,
			};
		}

		static {
			SerializableCommand.register('add-element', (json: any, editor: Editor) => {
				const id = json.elemData.id;
				const foundElem = editor.image.lookupElement(id);
				const elem = foundElem ?? AbstractComponent.deserialize(json.elemData);
				return new EditorImage.AddElementCommand(elem);
			});
		}
	};
}

type TooSmallToRenderCheck = (rect: Rect2)=> boolean;

/** Part of the Editor's image. @internal */
export class ImageNode {
	private content: AbstractComponent|null;
	private bbox: Rect2;
	private children: ImageNode[];
	private targetChildCount: number = 30;

	private id: number;
	private static idCounter: number = 0;

	public constructor(
		private parent: ImageNode|null = null
	) {
		this.children = [];
		this.bbox = Rect2.empty;
		this.content = null;

		this.id = ImageNode.idCounter++;
	}

	public getId() {
		return this.id;
	}

	public onContentChange() {
		this.id = ImageNode.idCounter++;
	}

	public getContent(): AbstractComponent|null {
		return this.content;
	}

	public getParent(): ImageNode|null {
		return this.parent;
	}

	private getChildrenIntersectingRegion(region: Rect2): ImageNode[] {
		return this.children.filter(child => {
			return child.getBBox().intersects(region);
		});
	}

	public getChildrenOrSelfIntersectingRegion(region: Rect2): ImageNode[] {
		if (this.content) {
			return [this];
		}
		return this.getChildrenIntersectingRegion(region);
	}

	// Returns a list of `ImageNode`s with content (and thus no children).
	public getLeavesIntersectingRegion(region: Rect2, isTooSmall?: TooSmallToRenderCheck): ImageNode[] {
		const result: ImageNode[] = [];
		let current: ImageNode|undefined;
		const workList: ImageNode[] = [];

		workList.push(this);
		const toNext = () => {
			current = undefined;

			const next = workList.pop();
			if (next && !isTooSmall?.(next.bbox)) {
				current = next;

				if (current.content !== null && current.getBBox().intersection(region)) {
					result.push(current);
				}

				workList.push(
					...current.getChildrenIntersectingRegion(region)
				);
			}
		};

		while (workList.length > 0) {
			toNext();
		}

		return result;
	}

	// Returns a list of leaves with this as an ancestor.
	// Like getLeavesInRegion, but does not check whether ancestors are in a given rectangle
	public getLeaves(): ImageNode[] {
		if (this.content) {
			return [this];
		}

		const result: ImageNode[] = [];
		for (const child of this.children) {
			result.push(...child.getLeaves());
		}

		return result;
	}

	public addLeaf(leaf: AbstractComponent): ImageNode {
		this.onContentChange();

		if (this.content === null && this.children.length === 0) {
			this.content = leaf;
			this.recomputeBBox(true);

			return this;
		}

		if (this.content !== null) {
			console.assert(this.children.length === 0);

			const contentNode = new ImageNode(this);
			contentNode.content = this.content;
			this.content = null;
			this.children.push(contentNode);
			contentNode.recomputeBBox(false);
		}

		// If this node is contained within the leaf, make this and the leaf
		// share a parent.
		const leafBBox = leaf.getBBox();
		if (leafBBox.containsRect(this.getBBox())) {
			const nodeForNewLeaf = new ImageNode(this);

			if (this.children.length < this.targetChildCount) {
				this.children.push(nodeForNewLeaf);
			} else {
				const nodeForChildren = new ImageNode(this);

				nodeForChildren.children = this.children;
				this.children = [nodeForNewLeaf, nodeForChildren];
				nodeForChildren.recomputeBBox(true);
				nodeForChildren.updateParents();
			}
			return nodeForNewLeaf.addLeaf(leaf);
		}

		const containingNodes = this.children.filter(
			child => child.getBBox().containsRect(leafBBox)
		);

		// Does the leaf already fit within one of the children?
		if (containingNodes.length > 0 && this.children.length >= this.targetChildCount) {
			// Sort the containers in ascending order by area
			containingNodes.sort((a, b) => a.getBBox().area - b.getBBox().area);

			// Choose the smallest child that contains the new element.
			const result = containingNodes[0].addLeaf(leaf);
			result.rebalance();
			return result;
		}


		const newNode = new ImageNode(this);
		this.children.push(newNode);
		newNode.content = leaf;
		newNode.recomputeBBox(true);

		return newNode;
	}

	public getBBox(): Rect2 {
		return this.bbox;
	}

	// Recomputes this' bounding box. If [bubbleUp], also recompute
	// this' ancestors bounding boxes. This also re-computes this' bounding box
	// in the z-direction (z-indicies).
	public recomputeBBox(bubbleUp: boolean) {
		const oldBBox = this.bbox;
		if (this.content !== null) {
			this.bbox = this.content.getBBox();
		} else {
			this.bbox = Rect2.empty;
			let isFirst = true;

			for (const child of this.children) {
				if (isFirst) {
					this.bbox = child.getBBox();
					isFirst = false;
				} else {
					this.bbox = this.bbox.union(child.getBBox());
				}
			}
		}

		if (bubbleUp && !oldBBox.eq(this.bbox)) {
			this.parent?.recomputeBBox(true);
		}
	}

	private updateParents(recursive: boolean = false) {
		for (const child of this.children) {
			child.parent = this;

			if (recursive) {
				child.updateParents(recursive);
			}
		}
	}

	private rebalance() {
		// If the current node is its parent's only child,
		if (this.parent && this.parent.children.length === 1) {
			console.assert(this.parent.content === null);
			console.assert(this.parent.children[0] === this);

			// Remove this' parent, if this' parent isn't the root.
			const oldParent = this.parent;
			if (oldParent.parent !== null) {
				oldParent.children = [];
				this.parent = oldParent.parent;
				this.parent.children.push(this);
				oldParent.parent = null;
				this.parent.recomputeBBox(false);
			} else if (this.content === null) {
				// Remove this and transfer this' children to the parent.
				this.parent.children = this.children;
				this.parent.updateParents();
				this.parent = null;
			}
		}
	}

	// Remove this node and all of its children
	public remove() {
		if (!this.parent) {
			this.content = null;
			this.children = [];

			return;
		}

		const oldChildCount = this.parent.children.length;
		this.parent.children = this.parent.children.filter(node => {
			return node !== this;
		});

		console.assert(
			this.parent.children.length === oldChildCount - 1,
			`${oldChildCount - 1} ≠ ${this.parent.children.length} after removing all nodes equal to ${this}. Nodes should only be removed once.`
		);

		this.parent.children.forEach(child => {
			child.rebalance();
		});

		this.parent.recomputeBBox(true);

		// Invalidate/disconnect this.
		this.content = null;
		this.parent = null;
		this.children = [];
	}

	public render(renderer: AbstractRenderer, visibleRect: Rect2) {
		const leaves = this.getLeavesIntersectingRegion(visibleRect, rect => renderer.isTooSmallToRender(rect));
		sortLeavesByZIndex(leaves);

		for (const leaf of leaves) {
			// Leaves by definition have content
			leaf.getContent()!.render(renderer, visibleRect);
		}
	}
}

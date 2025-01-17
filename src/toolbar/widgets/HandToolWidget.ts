import Editor from '../../Editor';
import Mat33 from '../../math/Mat33';
import PanZoom, { PanZoomMode } from '../../tools/PanZoom';
import { EditorEventType } from '../../types';
import Viewport from '../../Viewport';
import { toolbarCSSPrefix } from '../HTMLToolbar';
import { makeAllDevicePanningIcon, makeHandToolIcon, makeTouchPanningIcon, makeZoomIcon } from '../icons';
import { ToolbarLocalization } from '../localization';
import BaseToolWidget from './BaseToolWidget';
import BaseWidget from './BaseWidget';

const makeZoomControl = (localizationTable: ToolbarLocalization, editor: Editor) => {
	const zoomLevelRow = document.createElement('div');

	const increaseButton = document.createElement('button');
	const decreaseButton = document.createElement('button');
	const resetViewButton = document.createElement('button');
	const zoomLevelDisplay = document.createElement('span');
	increaseButton.innerText = '+';
	decreaseButton.innerText = '-';
	resetViewButton.innerText = localizationTable.resetView;
	zoomLevelRow.replaceChildren(zoomLevelDisplay, increaseButton, decreaseButton, resetViewButton);

	zoomLevelRow.classList.add(`${toolbarCSSPrefix}zoomLevelEditor`);
	zoomLevelDisplay.classList.add('zoomDisplay');

	let lastZoom: number|undefined;
	const updateZoomDisplay = () => {
		let zoomLevel = editor.viewport.getScaleFactor() * 100;

		if (zoomLevel > 0.1) {
			zoomLevel = Math.round(zoomLevel * 10) / 10;
		} else {
			zoomLevel = Math.round(zoomLevel * 1000) / 1000;
		}

		if (zoomLevel !== lastZoom) {
			zoomLevelDisplay.innerText = localizationTable.zoomLevel(zoomLevel);
			lastZoom = zoomLevel;
		}
	};
	updateZoomDisplay();

	editor.notifier.on(EditorEventType.ViewportChanged, (event) => {
		if (event.kind === EditorEventType.ViewportChanged) {
			updateZoomDisplay();

			// Can't reset if already reset.
			resetViewButton.disabled = event.newTransform.eq(Mat33.identity);
		}
	});

	const zoomBy = (factor: number) => {
		const screenCenter = editor.viewport.visibleRect.center;
		const transformUpdate = Mat33.scaling2D(factor, screenCenter);
		editor.dispatch(Viewport.transformBy(transformUpdate), false);
	};

	increaseButton.onclick = () => {
		zoomBy(5.0/4);
	};

	decreaseButton.onclick = () => {
		zoomBy(4.0/5);
	};

	resetViewButton.onclick = () => {
		editor.dispatch(Viewport.transformBy(
			editor.viewport.canvasToScreenTransform.inverse()
		), true);
	};

	return zoomLevelRow;
};

class ZoomWidget extends BaseWidget {
	public constructor(editor: Editor, localizationTable: ToolbarLocalization) {
		super(editor, localizationTable);

		// Make it possible to open the dropdown, even if this widget isn't selected.
		this.container.classList.add('dropdownShowable');
	}

	protected getTitle(): string {
		return this.localizationTable.zoom;
	}
	
	protected createIcon(): Element {
		return makeZoomIcon();
	}

	protected handleClick(): void {
		this.setDropdownVisible(!this.isDropdownVisible());
	}

	protected fillDropdown(dropdown: HTMLElement): boolean {
		dropdown.appendChild(makeZoomControl(this.localizationTable, this.editor));
		return true;
	}
}

class HandModeWidget extends BaseWidget {
	public constructor(
		editor: Editor, localizationTable: ToolbarLocalization,

		protected tool: PanZoom, protected flag: PanZoomMode, protected makeIcon: ()=> Element,
		private title: string,
	) {
		super(editor, localizationTable);

		editor.notifier.on(EditorEventType.ToolUpdated, toolEvt => {
			if (toolEvt.kind === EditorEventType.ToolUpdated && toolEvt.tool === tool) {
				const allEnabled = !!(tool.getMode() & PanZoomMode.SinglePointerGestures);
				this.setSelected(!!(tool.getMode() & flag) || allEnabled);

				// Unless this widget toggles all single pointer gestures, toggling while
				// single pointer gestures are enabled should have no effect
				this.setDisabled(allEnabled && flag !== PanZoomMode.SinglePointerGestures);
			}
		});
		this.setSelected(false);
	}

	private setModeFlag(enabled: boolean) {
		const mode = this.tool.getMode();
		if (enabled) {
			this.tool.setMode(mode | this.flag);
		} else {
			this.tool.setMode(mode & ~this.flag);
		}
	}

	protected handleClick() {
		this.setModeFlag(!this.isSelected());
	}

	protected getTitle(): string {
		return this.title;
	}

	protected createIcon(): Element {
		return this.makeIcon();
	}

	protected fillDropdown(_dropdown: HTMLElement): boolean {
		return false;
	}
}

export default class HandToolWidget extends BaseToolWidget {
	private touchPanningWidget: HandModeWidget;
	public constructor(
		editor: Editor, protected tool: PanZoom, localizationTable: ToolbarLocalization
	) {
		super(editor, tool, localizationTable);
		this.container.classList.add('dropdownShowable');

		this.touchPanningWidget = new HandModeWidget(
			editor, localizationTable,

			tool, PanZoomMode.OneFingerTouchGestures,
			makeTouchPanningIcon,

			localizationTable.touchPanning
		);

		this.addSubWidget(this.touchPanningWidget);
		this.addSubWidget(
			new HandModeWidget(
				editor, localizationTable,

				tool, PanZoomMode.SinglePointerGestures,
				makeAllDevicePanningIcon,

				localizationTable.anyDevicePanning
			)
		);
		this.addSubWidget(
			new ZoomWidget(editor, localizationTable)
		);
	}

	protected getTitle(): string {
		return this.localizationTable.handTool;
	}

	protected createIcon(): Element {
		return makeHandToolIcon();
	}

	public setSelected(_selected: boolean): void {
	}

	protected handleClick() {
		this.setDropdownVisible(!this.isDropdownVisible());
	}
}
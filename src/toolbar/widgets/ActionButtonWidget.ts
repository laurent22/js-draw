import Editor from '../../Editor';
import { ToolbarLocalization } from '../localization';
import BaseWidget from './BaseWidget';

export default class ActionButtonWidget extends BaseWidget {
	public constructor(
		editor: Editor, localizationTable: ToolbarLocalization,
        protected makeIcon: ()=> Element,
		protected title: string,

        protected clickAction: ()=>void,
	) {
		super(editor, localizationTable);
	}

	protected handleClick() {
		this.clickAction();
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

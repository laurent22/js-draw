
import { Rect2 } from '../lib';
import { Vec2 } from '../math/Vec2';
import createEditor from '../testing/createEditor';
import { InputEvtType } from '../types';

describe('Pen', () => {
	it('should draw horizontal lines', () => {
		const editor = createEditor();
		editor.sendPenEvent(InputEvtType.PointerDownEvt, Vec2.of(0, 0));
		for (let i = 0; i < 10; i++) {
			editor.sendPenEvent(InputEvtType.PointerMoveEvt, Vec2.of(i, 0));
			jest.advanceTimersByTime(200);
		}
		editor.sendPenEvent(InputEvtType.PointerUpEvt, Vec2.of(200, 0));

		const elems = editor.image.getElementsIntersectingRegion(new Rect2(0, 10, 10, -10));
		expect(elems).toHaveLength(1);

		// Account for stroke width
		const tolerableError = 8;
		expect(elems[0].getBBox().topLeft).objEq(Vec2.of(0, 0), tolerableError);
		expect(elems[0].getBBox().bottomRight).objEq(Vec2.of(200, 0), tolerableError);
	});

	it('should draw vertical line', () => {
		const editor = createEditor();
		editor.sendPenEvent(InputEvtType.PointerDownEvt, Vec2.of(0, 0));
		for (let i = 0; i < 10; i++) {
			editor.sendPenEvent(InputEvtType.PointerMoveEvt, Vec2.of(0, i * 20));
			jest.advanceTimersByTime(200);
		}
		editor.sendPenEvent(InputEvtType.PointerUpEvt, Vec2.of(0, 150));

		const elems = editor.image.getElementsIntersectingRegion(Rect2.unitSquare);
		expect(elems).toHaveLength(1);

		expect(elems[0].getBBox().topLeft).objEq(Vec2.of(0, 0), 8); // ± 8
		expect(elems[0].getBBox().bottomRight).objEq(Vec2.of(0, 175), 25); // ± 25
	});

	it('should draw vertical line with slight bend', () => {
		const editor = createEditor();

		editor.sendPenEvent(InputEvtType.PointerDownEvt, Vec2.of(417, 24)); 
		jest.advanceTimersByTime(245);
		editor.sendPenEvent(InputEvtType.PointerMoveEvt, Vec2.of(423, 197));
		jest.advanceTimersByTime(20);
		editor.sendPenEvent(InputEvtType.PointerMoveEvt, Vec2.of(423, 199));
		jest.advanceTimersByTime(12);
		editor.sendPenEvent(InputEvtType.PointerMoveEvt, Vec2.of(423, 201));
		jest.advanceTimersByTime(40);
		editor.sendPenEvent(InputEvtType.PointerMoveEvt, Vec2.of(423, 203));
		jest.advanceTimersByTime(14);
		editor.sendPenEvent(InputEvtType.PointerMoveEvt, Vec2.of(423, 206));
		jest.advanceTimersByTime(35);
		editor.sendPenEvent(InputEvtType.PointerMoveEvt, Vec2.of(423, 208));
		jest.advanceTimersByTime(16);
		editor.sendPenEvent(InputEvtType.PointerMoveEvt, Vec2.of(423, 211));
		jest.advanceTimersByTime(51);
		editor.sendPenEvent(InputEvtType.PointerMoveEvt, Vec2.of(423, 215));
		jest.advanceTimersByTime(32);
		editor.sendPenEvent(InputEvtType.PointerMoveEvt, Vec2.of(423, 218));
		jest.advanceTimersByTime(30);
		editor.sendPenEvent(InputEvtType.PointerMoveEvt, Vec2.of(423, 220));
		jest.advanceTimersByTime(24);
		editor.sendPenEvent(InputEvtType.PointerMoveEvt, Vec2.of(423, 222));
		jest.advanceTimersByTime(14);
		editor.sendPenEvent(InputEvtType.PointerMoveEvt, Vec2.of(423, 224));
		jest.advanceTimersByTime(32);
		editor.sendPenEvent(InputEvtType.PointerMoveEvt, Vec2.of(423, 227));
		jest.advanceTimersByTime(17);
		editor.sendPenEvent(InputEvtType.PointerMoveEvt, Vec2.of(423, 229));
		jest.advanceTimersByTime(53);
		editor.sendPenEvent(InputEvtType.PointerMoveEvt, Vec2.of(423, 234));
		jest.advanceTimersByTime(34);
		editor.sendPenEvent(InputEvtType.PointerMoveEvt, Vec2.of(423, 236));
		jest.advanceTimersByTime(17);
		editor.sendPenEvent(InputEvtType.PointerMoveEvt, Vec2.of(423, 238));
		jest.advanceTimersByTime(39);
		editor.sendPenEvent(InputEvtType.PointerMoveEvt, Vec2.of(423, 240));
		jest.advanceTimersByTime(10);
		editor.sendPenEvent(InputEvtType.PointerMoveEvt, Vec2.of(423, 243));
		jest.advanceTimersByTime(34);
		editor.sendPenEvent(InputEvtType.PointerMoveEvt, Vec2.of(423, 250));
		jest.advanceTimersByTime(57);
		editor.sendPenEvent(InputEvtType.PointerMoveEvt, Vec2.of(423, 252));
		jest.advanceTimersByTime(8);
		editor.sendPenEvent(InputEvtType.PointerMoveEvt, Vec2.of(422, 256));
		jest.advanceTimersByTime(28);
		editor.sendPenEvent(InputEvtType.PointerMoveEvt, Vec2.of(422, 258));
		jest.advanceTimersByTime(21);
		editor.sendPenEvent(InputEvtType.PointerMoveEvt, Vec2.of(421, 262));
		jest.advanceTimersByTime(34);
		editor.sendPenEvent(InputEvtType.PointerMoveEvt, Vec2.of(420, 264));
		jest.advanceTimersByTime(5);
		editor.sendPenEvent(InputEvtType.PointerMoveEvt, Vec2.of(420, 266));
		jest.advanceTimersByTime(22);
		editor.sendPenEvent(InputEvtType.PointerMoveEvt, Vec2.of(420, 268));
		jest.advanceTimersByTime(22);
		editor.sendPenEvent(InputEvtType.PointerMoveEvt, Vec2.of(420, 271));
		jest.advanceTimersByTime(18);
		editor.sendPenEvent(InputEvtType.PointerMoveEvt, Vec2.of(420, 274));
		jest.advanceTimersByTime(33);
		editor.sendPenEvent(InputEvtType.PointerMoveEvt, Vec2.of(420, 277));
		jest.advanceTimersByTime(16);
		editor.sendPenEvent(InputEvtType.PointerMoveEvt, Vec2.of(419, 279));
		jest.advanceTimersByTime(36);
		editor.sendPenEvent(InputEvtType.PointerMoveEvt, Vec2.of(419, 282));
		jest.advanceTimersByTime(15);
		editor.sendPenEvent(InputEvtType.PointerMoveEvt, Vec2.of(419, 284));
		jest.advanceTimersByTime(48);
		editor.sendPenEvent(InputEvtType.PointerMoveEvt, Vec2.of(419, 289));
		jest.advanceTimersByTime(16);
		editor.sendPenEvent(InputEvtType.PointerMoveEvt, Vec2.of(419, 291));
		jest.advanceTimersByTime(31);
		editor.sendPenEvent(InputEvtType.PointerMoveEvt, Vec2.of(419, 295));
		jest.advanceTimersByTime(23);
		editor.sendPenEvent(InputEvtType.PointerMoveEvt, Vec2.of(419, 301));
		jest.advanceTimersByTime(31);
		editor.sendPenEvent(InputEvtType.PointerMoveEvt, Vec2.of(419, 306));
		jest.advanceTimersByTime(18);
		editor.sendPenEvent(InputEvtType.PointerMoveEvt, Vec2.of(419, 308));
		jest.advanceTimersByTime(20);
		editor.sendPenEvent(InputEvtType.PointerMoveEvt, Vec2.of(419, 310));
		jest.advanceTimersByTime(13);
		editor.sendPenEvent(InputEvtType.PointerMoveEvt, Vec2.of(419, 313));
		jest.advanceTimersByTime(17);
		editor.sendPenEvent(InputEvtType.PointerMoveEvt, Vec2.of(419, 317));
		jest.advanceTimersByTime(33);
		editor.sendPenEvent(InputEvtType.PointerMoveEvt, Vec2.of(419, 321));
		jest.advanceTimersByTime(15);
		editor.sendPenEvent(InputEvtType.PointerMoveEvt, Vec2.of(419, 324));
		jest.advanceTimersByTime(23);
		editor.sendPenEvent(InputEvtType.PointerMoveEvt, Vec2.of(419, 326));
		jest.advanceTimersByTime(14);
		editor.sendPenEvent(InputEvtType.PointerMoveEvt, Vec2.of(419, 329));
		jest.advanceTimersByTime(36);
		editor.sendPenEvent(InputEvtType.PointerMoveEvt, Vec2.of(420, 333));
		jest.advanceTimersByTime(8);
		editor.sendPenEvent(InputEvtType.PointerMoveEvt, Vec2.of(420, 340));
		editor.sendPenEvent(InputEvtType.PointerUpEvt, Vec2.of(420, 340));

		const elems = editor.image.getElementsIntersectingRegion(new Rect2(0, 0, 1000, 1000));
		expect(elems).toHaveLength(1);

		expect(elems[0].getBBox().topLeft).objEq(Vec2.of(420, 24), 8); // ± 8
		expect(elems[0].getBBox().bottomRight).objEq(Vec2.of(420, 340), 25); // ± 25
	});
});
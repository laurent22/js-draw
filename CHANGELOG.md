# 0.5.0
 * Increase contrast between selection box/background
 * Keyboard shortcuts
   * `Ctrl+1` through `Ctrl+9`: Switch pen drawing mode.
     * For this to work, the `ToolbarShortcutHandler` must be loaded (and the toolbar must also be loaded).
 * Bug fixes
   * Fix text shifting away from strokes on paste.

# 0.4.1
 * Bug fixes
   * Fix in-progress strokes occasionally flickering and disappearing.
     * This was caused by a division-by-zero error.
   * Increase contrast between disabled and enabled buttons.
   * Copy selected text objects as text.

# 0.4.0
 * Moved the selection tool rotate handle to the top, added resize horizontally and resize vertically handles.
 * Selection-tool-related bug fixes
   * Reduced increase in file size after rotating/resizing selected objects.
   * Fix "resize to selection" button disabled when working with selections created by pasting.
 * Other bug fixes
   * Fix occasional stroke distortion when saving.

# 0.3.2
 * Embedded PNG/JPEG image loading
 * Copy and paste
 * Open images when dropped into editor
 * Keyboard shortcuts:
   * `Delete`/`Backspace` deletes selected content.
   * `Ctrl+C`, `Ctrl+V` for copy/paste.

# 0.3.1
 * Keyboard shortcuts:
   * Press `Ctrl+1` to select the first pen, `Ctrl+2` to select the second, etc.
   * When a pen is active, press `+` to increase a pen's size, `-` to decrease it.
 * Performance:
   * Cache `Path::toString` results for faster saving to SVG.

# 0.3.0
 * Pen-related bug fixes
 * API: Allow creating custom tools and tool widgets.

# 0.2.3
 * Fix lines with thickness set to small numbers self-intersecting many times.

# 0.2.2
 * Fix custon toolbar action buttons having wrong height.

# 0.2.1
 * German localization.

# 0.2.0
 * Export `Mat33`, `Vec3`, `Vec2`, and `Color4`.
 * [Documentation](https://personalizedrefrigerator.github.io/js-draw/typedoc/index.html)
 * Bug fixes:
   * After using up all blocks in the rendering cache, a single block was repeatedly re-allocated, leading to slow performance.

# 0.1.12
 * Add icons to the selection menu.
 * Screen-reader-related bug fixes.
 * Fix bug where parent cache nodes were not fully re-rendered after erasing a stroke and replacing it with more, larger strokes.
 * Generate strokes with single paths, instead of one path for each segment.
   * This should make new strokes take less space when saving to SVG because we don't need to store the edges for each part of the stroke.

# 0.1.11
 * Fix 'Enter' key not toggling toolbar buttons.
 * Add zoom limits.
 * Add a reset zoom button.

# 0.1.10
 * Keyboard shortcuts for the selection tool.
 * Scroll the selection into view while moving it with the keyboard/mouse.
 * Fix toolbar buttons not activating when focused and enter/space is pressed.
 * Partial Spanish localization.

# 0.1.9
 * Fix regression -- color picker hides just after clicking it.
 * Allow toggling the pipette tool.

# 0.1.8
 * Don't render if the screen has a size of 0x0.
   * This was breaking the cache data structure's invariant -- cache blocks weren't dividing when they had zero size.
 * Fix rectangles drawn with the pen's rectangle mode not having edges parallel to the viewport.

# 0.1.7
 * Show the six most recent color selections in the color palette.
 * Switch from checkboxes to togglebuttons in the dropdown for the hand tool.
 * Adds a "duplicate selection" button.
 * Add a pipette (select color from screen) tool.
 * Make `Erase`, `Duplicate`, `AddElement`, `TransformElement` commands serializable.

# 0.1.6
 * Fix loading text in SVG images in Chrome.

# 0.1.5
 * Add a text-only renderer (only renders text objects at present) that can be activated with a screen reader.
 * Make new text objects parallel to screen's horizontal axis.
 * Fix pinch zoom off center when embedded in larger page.

# 0.1.4
 * Option to enable pan gestures only if the editor has focus
 * Text tool bug fixes and improvements.
 * Defocus/blur editor when `Esc` key is pressed.

# 0.1.3
 * Very minimalistic text tool.
 * Ability to load and save text.
 * Fix a rounding bug where small strokes could be stretched/moved to the wrong locations.

# 0.1.2
 * Replace 'touch drawing' with a hand tool.
 * Bug fixes related to importing SVGs from other applications.

# 0.1.1
 * Avoid using the cache if working with smaller numbers of strokes.
 * Attempt to prevent stroke width being zero at some locations in thin strokes.

# 0.1.0
 * Zoom to import/export region just after importing.
 * Rendered strokes are cached if possible for better performance.

# 0.0.10
 * Prefer higher quality rendering except during touchscreen gestures and large groups of commands.
 * Add a "delete selection" button.

# 0.0.8
 * Map `ctrl+z` to undo, `ctrl+shift+Z` to redo.

# 0.0.7
 * Preserve SVG global attributes when loading/saving images.
    * This fixes a bug where lost information (e.g. a missing namespace) broke SVGs on export.

# 0.0.6
 * Fixes a bug that caused saved images to grow in size after loading them, then re-saving.
 * Stops the pressure decrease on pen-up events from preventing line/arrow objects from having variable width.

# 0.0.5
 * Configuration options:
   - Ability to disable touch panning
   - The `new Editor(container, ...)` constructor now takes a configuration object as its second argument.
 * A pre-bundled version of `js-draw` is now distributed.

# 0.0.4
 * Preset shapes
   * Arrow
   * Filled rectangle
   * Outlined rectangle
   * Line

# 0.0.2
 * Adjust default editor colors based on system theme.

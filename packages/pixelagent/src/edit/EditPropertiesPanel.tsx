import { useState } from 'react';
import type { ElementState, TargetScope, TextEditKind } from '@pixelagent/shared';
import { ColorField } from './ColorField';
import { EditSection } from './EditSection';
import { FontFamilySelect } from './FontFamilySelect';
import { PropertyField } from './PropertyField';
import { SpacingField } from './SpacingField';
import { TextStylesPopover } from './TextStylesPopover';
import { readTypographyPresets, type TypographyPreset } from './typographyPresets';
import { MultiSegmentedControl, SegmentedControl } from './SegmentedControl';
import {
  IconAlignCenter,
  IconAlignJustify,
  IconAlignLeft,
  IconAlignRight,
  IconStrikethrough,
} from './TypographyIcons';
import {
  hasTextDecoration,
  isBoldWeight,
  isItalicStyle,
  normalizeTextAlign,
  toggleBoldWeight,
  toggleItalicStyle,
  toggleTextDecoration,
  type TextAlignValue,
} from './styleUtils';

const BORDER_STYLE_OPTIONS = [
  'none',
  'solid',
  'dashed',
  'dotted',
  'double',
  'groove',
  'ridge',
  'inset',
  'outset',
] as const;

const DISPLAY_OPTIONS = [
  'block',
  'inline',
  'inline-block',
  'flex',
  'inline-flex',
  'grid',
  'inline-grid',
  'none',
  'contents',
] as const;

const FLEX_GRID_DISPLAYS = new Set(['flex', 'inline-flex', 'grid', 'inline-grid']);

export interface EditPropertiesPanelProps {
  values: Record<string, string>;
  onPropertyChange: (property: string, value: string) => void;
  onApplyPreset: (changes: Record<string, string>) => void;
  textKind: TextEditKind;
  textValue: string;
  onTextChange: (value: string) => void;
  targetScope: TargetScope;
  onTargetScopeChange: (scope: TargetScope) => void;
  elementState: ElementState;
  onElementStateChange: (state: ElementState) => void;
  instanceCount: number;
  scopeHint?: string | null;
  stateHint?: string | null;
}

export function EditPropertiesPanel({
  values,
  onPropertyChange,
  onApplyPreset,
  textKind,
  textValue,
  onTextChange,
  targetScope,
  onTargetScopeChange,
  elementState,
  onElementStateChange,
  instanceCount,
  scopeHint,
  stateHint,
}: EditPropertiesPanelProps) {
  // Type scale tokens are static per page — read the document's CSS custom
  // properties once when the panel mounts.
  const [typographyPresets] = useState<TypographyPreset[]>(() => readTypographyPresets());

  const applyTypographyPreset = (preset: TypographyPreset) => {
    const changes: Record<string, string> = { 'font-size': preset.fontSize };
    if (preset.lineHeight) changes['line-height'] = preset.lineHeight;
    if (preset.fontWeight) changes['font-weight'] = preset.fontWeight;
    onApplyPreset(changes);
  };

  const fontWeight = values['font-weight'] ?? '';
  const fontStyle = values['font-style'] ?? 'normal';
  const textDecoration = values['text-decoration'] ?? 'none';
  const textAlign = normalizeTextAlign(values['text-align'] ?? 'left');

  const displayValue = values.display?.trim() ?? '';
  const showDisplay = Boolean(displayValue);
  const showGap = FLEX_GRID_DISPLAYS.has(displayValue);
  const displayOptions: string[] = [...DISPLAY_OPTIONS];
  if (
    displayValue &&
    !DISPLAY_OPTIONS.includes(displayValue as (typeof DISPLAY_OPTIONS)[number])
  ) {
    displayOptions.push(displayValue);
  }
  const rawGap = values.gap?.trim() ?? '';
  const gapValue = rawGap === 'normal' || rawGap === '' ? '0px' : rawGap;
  const borderStyle = values['border-style'] ?? 'none';
  const borderStyleOptions: string[] = [...BORDER_STYLE_OPTIONS];
  if (
    borderStyle &&
    !BORDER_STYLE_OPTIONS.includes(borderStyle as (typeof BORDER_STYLE_OPTIONS)[number])
  ) {
    borderStyleOptions.push(borderStyle);
  }

  return (
    <div className="pa-edit-sections">
      <EditSection title="Targeting" defaultOpen>
        <div className="pa-edit-field-grid pa-edit-field-grid--2">
          <label className="pa-edit-mini-field">
            <span className="pa-edit-field-label">Scope</span>
            <select
              className="pa-select"
              value={targetScope}
              onChange={(e) => onTargetScopeChange(e.target.value as TargetScope)}
            >
              <option value="this-instance">This instance</option>
              <option value="all-instances" disabled={instanceCount <= 1}>
                All ({instanceCount})
              </option>
            </select>
          </label>
          <label className="pa-edit-mini-field">
            <span className="pa-edit-field-label">State</span>
            <select
              className="pa-select"
              value={elementState}
              onChange={(e) => onElementStateChange(e.target.value as ElementState)}
            >
              <option value="normal">Normal</option>
              <option value="hover">Hover</option>
              <option value="focus">Focus</option>
              <option value="active">Active</option>
              <option value="disabled">Disabled</option>
            </select>
          </label>
        </div>
        {scopeHint ? <p className="pa-edit-inline-hint">{scopeHint}</p> : null}
        {stateHint ? <p className="pa-edit-inline-hint">{stateHint}</p> : null}
      </EditSection>

      {textKind !== 'none' && (
        <EditSection title="Content" defaultOpen>
          <label className="pa-edit-stack-field">
            <span className="pa-edit-field-label">Text</span>
            <textarea
              className="pa-textarea pa-edit-text-input"
              value={textValue}
              onChange={(e) => onTextChange(e.target.value)}
              rows={textKind === 'value' ? 2 : 3}
              placeholder="Edit visible text…"
            />
          </label>
        </EditSection>
      )}

      <EditSection
        title="Typography"
        defaultOpen
        headerAction={
          <TextStylesPopover
            presets={typographyPresets}
            fontSize={values['font-size'] ?? ''}
            lineHeight={values['line-height'] ?? ''}
            onApply={applyTypographyPreset}
          />
        }
      >
        <FontFamilySelect
          value={values['font-family'] ?? ''}
          onChange={(v) => onPropertyChange('font-family', v)}
        />

        <div className="pa-edit-field-block">
          <span className="pa-edit-field-label">Style</span>
          <MultiSegmentedControl
            ariaLabel="Text style"
            options={[
              {
                id: 'bold',
                title: 'Bold',
                pressed: isBoldWeight(fontWeight),
                content: <span className="pa-segmented-type pa-segmented-type--bold">B</span>,
              },
              {
                id: 'italic',
                title: 'Italic',
                pressed: isItalicStyle(fontStyle),
                content: <span className="pa-segmented-type pa-segmented-type--italic">I</span>,
              },
              {
                id: 'underline',
                title: 'Underline',
                pressed: hasTextDecoration(textDecoration, 'underline'),
                content: (
                  <span className="pa-segmented-type pa-segmented-type--underline">U</span>
                ),
              },
              {
                id: 'strikethrough',
                title: 'Strikethrough',
                pressed: hasTextDecoration(textDecoration, 'line-through'),
                content: <IconStrikethrough className="pa-segmented-icon" />,
              },
            ]}
            onToggle={(id) => {
              if (id === 'bold') onPropertyChange('font-weight', toggleBoldWeight(fontWeight));
              else if (id === 'italic') onPropertyChange('font-style', toggleItalicStyle(fontStyle));
              else if (id === 'underline') {
                onPropertyChange(
                  'text-decoration',
                  toggleTextDecoration(textDecoration, 'underline')
                );
              } else if (id === 'strikethrough') {
                onPropertyChange(
                  'text-decoration',
                  toggleTextDecoration(textDecoration, 'line-through')
                );
              }
            }}
          />
        </div>

        <div className="pa-edit-field-block">
          <span className="pa-edit-field-label">Align</span>
          <SegmentedControl<TextAlignValue>
            ariaLabel="Text align"
            value={textAlign}
            onChange={(v) => onPropertyChange('text-align', v)}
            options={[
              {
                value: 'left',
                title: 'Align left',
                content: <IconAlignLeft className="pa-segmented-icon" />,
              },
              {
                value: 'center',
                title: 'Align center',
                content: <IconAlignCenter className="pa-segmented-icon" />,
              },
              {
                value: 'right',
                title: 'Align right',
                content: <IconAlignRight className="pa-segmented-icon" />,
              },
              {
                value: 'justify',
                title: 'Justify',
                content: <IconAlignJustify className="pa-segmented-icon" />,
              },
            ]}
          />
        </div>

        <div className="pa-edit-field-grid pa-edit-field-grid--2 pa-edit-size-row">
          <PropertyField
            compact
            property="font-size"
            label="Font size (px)"
            value={values['font-size'] ?? ''}
            onChange={(v) => onPropertyChange('font-size', v)}
          />
          <PropertyField
            compact
            property="line-height"
            label="Line height (px)"
            value={values['line-height'] ?? ''}
            onChange={(v) => onPropertyChange('line-height', v)}
          />
        </div>
        <ColorField
          label="Color"
          value={values.color ?? ''}
          onChange={(v) => onPropertyChange('color', v)}
        />
      </EditSection>

      <EditSection title="Layout" defaultOpen>
        <div className="pa-edit-split-fields">
          <PropertyField
            compact
            property="width"
            label="Width"
            value={values.width ?? ''}
            onChange={(v) => onPropertyChange('width', v)}
          />
          <PropertyField
            compact
            property="height"
            label="Height"
            value={values.height ?? ''}
            onChange={(v) => onPropertyChange('height', v)}
          />
        </div>
        <SpacingField
          property="padding"
          label="Padding"
          value={values.padding ?? ''}
          onChange={(v) => onPropertyChange('padding', v)}
        />
        <SpacingField
          property="margin"
          label="Margin"
          value={values.margin ?? ''}
          onChange={(v) => onPropertyChange('margin', v)}
        />
        {showDisplay && (
          <label className="pa-prop-row pa-prop-row--compact">
            <span className="pa-edit-field-label">Display</span>
            <select
              className="pa-select"
              value={displayValue}
              onChange={(e) => onPropertyChange('display', e.target.value)}
            >
              {displayOptions.map((opt) => (
                <option key={opt} value={opt}>
                  {opt}
                </option>
              ))}
            </select>
          </label>
        )}
        {showGap && (
          <PropertyField
            compact
            property="gap"
            label="Gap"
            value={gapValue}
            onChange={(v) => onPropertyChange('gap', v)}
          />
        )}
      </EditSection>

      <EditSection title="Fill">
        <ColorField
          label="Background"
          value={values['background-color'] ?? ''}
          onChange={(v) => onPropertyChange('background-color', v)}
        />
        <PropertyField
          compact
          property="opacity"
          label="Opacity"
          value={values.opacity ?? ''}
          onChange={(v) => onPropertyChange('opacity', v)}
        />
      </EditSection>

      <EditSection title="Border" defaultOpen>
        <ColorField
          label="Border color"
          value={values['border-color'] ?? ''}
          onChange={(v) => onPropertyChange('border-color', v)}
        />
        <label className="pa-edit-stack-field">
          <span className="pa-edit-field-label">Style</span>
          <select
            className="pa-select"
            value={borderStyle}
            onChange={(e) => onPropertyChange('border-style', e.target.value)}
          >
            {borderStyleOptions.map((style) => (
              <option key={style} value={style}>
                {style}
              </option>
            ))}
          </select>
        </label>
        <PropertyField
          compact
          property="border-width"
          label="Width (px)"
          value={values['border-width'] ?? ''}
          onChange={(v) => onPropertyChange('border-width', v)}
        />
        <PropertyField
          compact
          property="border-radius"
          label="Radius (px)"
          value={values['border-radius'] ?? ''}
          onChange={(v) => onPropertyChange('border-radius', v)}
        />
      </EditSection>
    </div>
  );
}

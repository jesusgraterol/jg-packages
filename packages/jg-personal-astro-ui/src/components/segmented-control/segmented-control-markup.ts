import { escapeHtml } from '../../html/index.ts';

// one choice of the control
export type ISegmentedControlOption = {
  label: string;
  // marks the option's radio as data-segment="<value>"; lowercase letters, digits, and hyphens
  value: string;
};

// what renderSegmentedControl needs
export type ISegmentedControlOptions = {
  class?: string | undefined;
  // the option checked at first. Defaults to the first option
  defaultValue?: string | undefined;
  // what the choice is about, such as "How the agent runs the change"
  legend: string;
  // shows the legend to screen readers only
  legendHidden?: boolean | undefined;
  // the radios' name, unique on the page
  name: string;
  options: readonly ISegmentedControlOption[];
};

// the values that are safe inside the group-has-[[data-segment=<value>]:checked] selectors sites
// toggle their content with
const SEGMENT_VALUE = /^[a-z0-9-]+$/u;

// each option: a pill that fills with the primary colour when its radio is checked, and shows the
// focus ring the hidden radio can't
const OPTION_CLASSES =
  'cursor-pointer rounded-full px-4 py-1.5 text-sm font-semibold text-muted transition-colors hover:text-foreground has-checked:bg-primary has-checked:text-primary-foreground has-focus-visible:outline-2 has-focus-visible:outline-offset-2 has-focus-visible:outline-focus motion-reduce:transition-none';

/**
 * Checks the options: at least one, each value safe in a selector and used once, and the default
 * among them.
 * @param options The options.
 * @param defaultValue The option checked at first, if given.
 * @returns The value checked at first.
 */
const validateOptions = (
  options: readonly ISegmentedControlOption[],
  defaultValue: string | undefined,
): string => {
  const values = options.map(({ value }) => value);
  const [firstValue] = values;
  if (firstValue === undefined) {
    throw new Error('The segmented control needs at least one option.');
  }
  const invalid = values.find((value) => !SEGMENT_VALUE.test(value));
  if (invalid !== undefined) {
    throw new Error(
      `The segmented control's value "${invalid}" must be lowercase letters, digits, and hyphens.`,
    );
  }
  if (new Set(values).size !== values.length) {
    throw new Error(`The segmented control's values must differ: ${values.join(', ')}.`);
  }
  const checked = defaultValue ?? firstValue;
  if (!values.includes(checked)) {
    throw new Error(
      `The segmented control's default value "${checked}" is not one of its options.`,
    );
  }
  return checked;
};

/**
 * Renders a segmented control as HTML: a fieldset with its legend and one native radio per option,
 * in a pill-shaped track, so it works without JavaScript and the arrow keys move between the
 * options. Each radio carries data-segment="<value>". It doesn't own the content it toggles: wrap
 * the section in a Tailwind CSS group, such as group/pipeline, and show or hide that content with
 * group-has-[[data-segment=<value>]:checked]/pipeline: variants.
 * @param options The legend, the radios' name, the options, and the one checked at first.
 * @returns The HTML.
 * @throws When there are no options, a value has anything besides lowercase letters, digits, and
 * hyphens, two options share a value, or the default value isn't an option.
 */
export const renderSegmentedControl = ({
  class: className,
  defaultValue,
  legend,
  legendHidden = false,
  name,
  options,
}: ISegmentedControlOptions): string => {
  const checked = validateOptions(options, defaultValue);
  return [
    `<fieldset class="${escapeHtml(['min-w-0', className].filter(Boolean).join(' '))}">`,
    `<legend class="${legendHidden ? 'sr-only' : 'mb-2 text-sm font-semibold'}">${escapeHtml(legend)}</legend>`,
    '<div class="inline-flex w-fit items-center gap-1 rounded-full border border-border bg-surface p-1 shadow-surface">',
    ...options.map(
      ({ label, value }) =>
        `<label class="${OPTION_CLASSES}"><input class="sr-only" type="radio" name="${escapeHtml(name)}" value="${value}"${value === checked ? ' checked' : ''} data-segment="${value}">${escapeHtml(label)}</label>`,
    ),
    '</div>',
    '</fieldset>',
  ].join('');
};

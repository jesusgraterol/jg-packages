import { cleanup, render, screen } from '@testing-library/react';
import { page } from 'vitest/browser';
import { act, createRef, useState } from 'react';
import { createRoot, type Root } from 'react-dom/client';
import { afterEach, beforeEach, describe, expect, test, vi } from 'vitest';

import {
  Checkbox,
  Field,
  FieldDescription,
  FieldError,
  FieldGroup,
  FieldLegend,
  FieldSet,
  Input,
  Label,
  RadioGroup,
  RadioGroupItem,
  Switch,
  Textarea,
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
  type ISelectContentProps,
} from './index.js';

const reactActEnvironment = globalThis as typeof globalThis & {
  IS_REACT_ACT_ENVIRONMENT?: boolean;
};

type ISelectExampleProps = {
  isControlled?: boolean;
  isDisabled?: boolean;
  contentProps?: ISelectContentProps;
  onOpenChange?: (open: boolean) => void;
  onValueChange?: (value: string) => void;
};

const SelectExample = ({
  isControlled = false,
  isDisabled = false,
  contentProps,
  onOpenChange,
  onValueChange,
}: ISelectExampleProps) => {
  const [isOpen, setIsOpen] = useState(!isDisabled);
  const [value, setValue] = useState('english');
  return (
    <Select
      {...(isControlled
        ? { open: isOpen, value }
        : { defaultOpen: !isDisabled, defaultValue: 'english' })}
      disabled={isDisabled}
      onOpenChange={(open) => {
        setIsOpen(open);
        onOpenChange?.(open);
      }}
      onValueChange={(nextValue) => {
        setValue(nextValue);
        onValueChange?.(nextValue);
      }}
    >
      <SelectTrigger aria-label="Language">
        <SelectValue />
      </SelectTrigger>
      <SelectContent {...contentProps}>
        <SelectItem value="english">English</SelectItem>
        <SelectItem value="spanish">Spanish</SelectItem>
      </SelectContent>
    </Select>
  );
};

describe('Select keyboard and dismissal integration', () => {
  let container: HTMLDivElement;
  let root: Root;
  let outside: HTMLButtonElement;

  beforeEach(() => {
    reactActEnvironment.IS_REACT_ACT_ENVIRONMENT = true;
    container = document.createElement('div');
    outside = document.createElement('button');
    outside.textContent = 'Outside';
    document.body.append(container, outside);
    root = createRoot(container);
  });

  afterEach(async () => {
    await act(async () => {
      root.unmount();
      await Promise.resolve();
    });
    container.remove();
    outside.remove();
    vi.restoreAllMocks();
  });

  const renderSelect = async (props: ISelectExampleProps = {}): Promise<void> => {
    await act(async () => {
      root.render(<SelectExample {...props} />);
      await Promise.resolve();
    });
  };
  const trigger = (): HTMLButtonElement => container.querySelector('[role="combobox"]')!;
  const option = (label: string): HTMLElement => {
    const popupId = trigger().getAttribute('aria-controls');
    expect(popupId).not.toBeNull();
    const popup = document.getElementById(popupId!);
    expect(popup).not.toBeNull();
    const element = Array.from(popup!.querySelectorAll<HTMLElement>('[role="option"]')).find(
      (candidate) => candidate.textContent === label,
    );
    expect(element, label).toBeDefined();
    return element!;
  };
  const press = async (element: HTMLElement, key: string): Promise<KeyboardEvent> => {
    const event = new KeyboardEvent('keydown', { key, bubbles: true, cancelable: true });
    await act(async () => {
      element.focus();
      element.dispatchEvent(event);

      await Promise.resolve();
    });
    return event;
  };

  test.each([false, true])('Enter selects and closes with controlled=%s', async (isControlled) => {
    const onOpenChange = vi.fn();
    const onValueChange = vi.fn();
    await renderSelect({ isControlled, onOpenChange, onValueChange });
    const event = await press(option('Spanish'), 'Enter');
    expect(event.defaultPrevented).toBe(true);
    expect(onValueChange).toHaveBeenCalledExactlyOnceWith('spanish');
    expect(onOpenChange).toHaveBeenCalledExactlyOnceWith(false);
    expect(trigger().getAttribute('aria-expanded')).toBe('false');
    expect(trigger().textContent).toContain('spanish');
    await vi.waitFor(() => expect(document.activeElement).toBe(trigger()));
  });

  test('Escape closes and returns focus without changing the selection', async () => {
    const onValueChange = vi.fn();
    await renderSelect({ onValueChange });
    await press(option('Spanish'), 'Escape');
    expect(trigger().getAttribute('aria-expanded')).toBe('false');
    expect(trigger().textContent).toContain('english');
    expect(onValueChange).not.toHaveBeenCalled();
    await vi.waitFor(() => expect(document.activeElement).toBe(trigger()));
  });

  test('an intentional Escape veto retains the popup and does not report closure', async () => {
    const onOpenChange = vi.fn();
    const onEscapeKeyDown = vi.fn((event: Event) => event.preventDefault());
    await renderSelect({ onOpenChange, contentProps: { onEscapeKeyDown } });
    await press(option('English'), 'Escape');
    expect(onEscapeKeyDown).toHaveBeenCalledOnce();
    expect(onOpenChange).not.toHaveBeenCalled();
    expect(trigger().getAttribute('aria-expanded')).toBe('true');
  });

  test.each(['pointer', 'interaction'] as const)(
    'an intentional %s outside veto retains the popup',
    async (kind) => {
      const veto = vi.fn((event: Event) => event.preventDefault());
      const onOpenChange = vi.fn();
      await renderSelect({
        onOpenChange,
        contentProps:
          kind === 'pointer' ? { onPointerDownOutside: veto } : { onInteractOutside: veto },
      });
      await act(async () => {
        outside.dispatchEvent(
          new PointerEvent('pointerdown', {
            bubbles: true,
            cancelable: true,
            pointerType: 'mouse',
          }),
        );

        await Promise.resolve();
      });
      expect(veto).toHaveBeenCalledOnce();
      expect(onOpenChange).not.toHaveBeenCalled();
      expect(trigger().getAttribute('aria-expanded')).toBe('true');
    },
  );

  test.each(['focus', 'interaction'] as const)(
    'an intentional %s veto cancels a cancelable focus-out dismissal',
    async (kind) => {
      const veto = vi.fn((event: Event) => event.preventDefault());
      const onOpenChange = vi.fn();
      await renderSelect({
        onOpenChange,
        contentProps: kind === 'focus' ? { onFocusOutside: veto } : { onInteractOutside: veto },
      });
      const event = new FocusEvent('focusout', {
        bubbles: true,
        cancelable: true,
        relatedTarget: outside,
      });
      await act(async () => {
        trigger().dispatchEvent(event);
        await Promise.resolve();
      });
      await vi.waitFor(() => expect(veto).toHaveBeenCalledOnce());
      expect(event.defaultPrevented).toBe(true);
      expect(onOpenChange).not.toHaveBeenCalled();
      expect(trigger().getAttribute('aria-expanded')).toBe('true');
    },
  );

  test('honors explicit final focus ahead of the close-auto-focus alias', async () => {
    const finalFocus = createRef<HTMLElement>();
    finalFocus.current = outside;
    const onCloseAutoFocus = vi.fn((event: Event) => event.preventDefault());
    await renderSelect({ contentProps: { finalFocus, onCloseAutoFocus } });
    await press(option('English'), 'Escape');
    await vi.waitFor(() => expect(document.activeElement).toBe(outside));
    expect(onCloseAutoFocus).not.toHaveBeenCalled();
  });

  test('honors an intentional close-auto-focus veto', async () => {
    const onCloseAutoFocus = vi.fn((event: Event) => event.preventDefault());
    await renderSelect({ contentProps: { onCloseAutoFocus } });
    await press(option('English'), 'Escape');
    expect(trigger().getAttribute('aria-expanded')).toBe('false');
    await vi.waitFor(() => expect(onCloseAutoFocus).toHaveBeenCalledOnce());
    expect(document.activeElement).not.toBe(trigger());
  });

  test('a disabled trigger cannot open or select', async () => {
    const onOpenChange = vi.fn();
    const onValueChange = vi.fn();
    await renderSelect({ isDisabled: true, onOpenChange, onValueChange });
    await press(trigger(), 'Enter');
    await act(async () => {
      trigger().click();
      await Promise.resolve();
    });
    expect(trigger().disabled).toBe(true);
    expect(trigger().getAttribute('aria-expanded')).toBe('false');
    expect(onOpenChange).not.toHaveBeenCalled();
    expect(onValueChange).not.toHaveBeenCalled();
  });
});

afterEach(cleanup);

const ValidatedForm = ({ onSubmit }: { onSubmit: (name: string) => void }) => {
  const [name, setName] = useState('');
  return (
    <form
      aria-label="Workspace settings"
      onSubmit={(event) => {
        event.preventDefault();
        onSubmit(name);
      }}
    >
      <FieldSet>
        <FieldLegend>Workspace</FieldLegend>
        <FieldGroup>
          <Field>
            <Label htmlFor="workspace-name">Workspace name</Label>
            <Input
              id="workspace-name"
              name="workspace"
              value={name}
              onChange={(event) => setName(event.target.value)}
              required
              aria-invalid={!name}
              aria-describedby="workspace-description workspace-error"
            />
            <FieldDescription id="workspace-description">
              Choose a recognizable name.
            </FieldDescription>
            {!name && <FieldError id="workspace-error">A name is required.</FieldError>}
          </Field>
          <Field>
            <Label htmlFor="workspace-notes">Notes</Label>
            <Textarea
              id="workspace-notes"
              name="notes"
              defaultValue="Project notes"
            />
          </Field>
        </FieldGroup>
      </FieldSet>
      <button type="submit">Save workspace</button>
    </form>
  );
};

test('native form validation, associated labels and field errors survive composition', async () => {
  const onSubmit = vi.fn();
  render(<ValidatedForm onSubmit={onSubmit} />);
  await page.getByRole('button', { name: 'Save workspace' }).click();
  expect(onSubmit).not.toHaveBeenCalled();
  expect(screen.getByRole('textbox', { name: 'Workspace name' }).getAttribute('aria-invalid')).toBe(
    'true',
  );
  expect(screen.getByText('A name is required.')).toBeDefined();
  await page.getByRole('textbox', { name: 'Workspace name' }).fill('Personal projects');
  expect(screen.queryByText('A name is required.')).toBeNull();
  await page.getByRole('button', { name: 'Save workspace' }).click();
  expect(onSubmit).toHaveBeenCalledExactlyOnceWith('Personal projects');
  expect(screen.getByRole<HTMLTextAreaElement>('textbox', { name: 'Notes' }).value).toBe(
    'Project notes',
  );
});

test('choice labels activate controls and callback aliases retain checked and selected values', async () => {
  const checked = vi.fn();
  const selected = vi.fn();
  const switched = vi.fn();
  const { rerender } = render(
    <>
      <Label htmlFor="choice-updates">Receive updates</Label>
      <Checkbox
        id="choice-updates"
        defaultChecked="indeterminate"
        onCheckedChange={checked}
      />
      <RadioGroup
        defaultValue="daily"
        aria-label="Frequency"
        onValueChange={selected}
      >
        <Label htmlFor="daily">Daily</Label>
        <RadioGroupItem
          id="daily"
          value="daily"
        />
        <Label htmlFor="weekly">Weekly</Label>
        <RadioGroupItem
          id="weekly"
          value="weekly"
        />
      </RadioGroup>
      <Label htmlFor="choice-sync">Enable sync</Label>
      <Switch
        id="choice-sync"
        onCheckedChange={switched}
      />
    </>,
  );
  expect(
    screen.getByRole('checkbox', { name: 'Receive updates' }).getAttribute('aria-checked'),
  ).toBe('mixed');
  await page.getByRole('checkbox', { name: 'Receive updates' }).click();
  expect(checked).toHaveBeenCalledExactlyOnceWith(true);
  expect(
    screen.getByRole('checkbox', { name: 'Receive updates' }).getAttribute('aria-checked'),
  ).toBe('true');
  await page.getByRole('radio', { name: 'Weekly' }).click();
  expect(selected).toHaveBeenCalledExactlyOnceWith('weekly');
  await page.getByRole('switch', { name: 'Enable sync' }).click();
  expect(switched).toHaveBeenCalledExactlyOnceWith(true);
  rerender(
    <>
      <Checkbox
        aria-label="Disabled choice"
        disabled
        checked
      />
      <Switch
        aria-label="Disabled switch"
        disabled
        defaultChecked
        size="sm"
      />
    </>,
  );
  expect(
    screen.getByRole<HTMLButtonElement>('checkbox', { name: 'Disabled choice' }).disabled,
  ).toBe(true);
  expect(screen.getByRole<HTMLButtonElement>('switch', { name: 'Disabled switch' }).disabled).toBe(
    true,
  );
});

test('native and custom slots retain refs, labels and disabled semantics', async () => {
  const triggerRef = createRef<HTMLButtonElement>();
  const choiceRef = createRef<HTMLAnchorElement>();
  const { rerender } = render(
    <>
      <Select defaultValue="english">
        <SelectTrigger
          asChild
          aria-label="Language"
        >
          <button
            type="button"
            ref={triggerRef}
          >
            Language
          </button>
        </SelectTrigger>
        <SelectContent
          avoidCollisions={false}
          hideWhenDetached
          position="item-aligned"
        >
          <SelectItem
            asChild
            value="english"
          >
            <div>English</div>
          </SelectItem>
        </SelectContent>
      </Select>
      <Checkbox
        asChild
        aria-label="Slotted checkbox"
        ref={choiceRef}
        defaultChecked
      >
        <a href="#choice">Choice</a>
      </Checkbox>
      <Switch
        asChild
        aria-label="Slotted switch"
      >
        <button type="button">Sync</button>
      </Switch>
      <RadioGroup
        defaultValue="daily"
        aria-label="Slotted frequency"
      >
        <RadioGroupItem
          asChild
          value="daily"
          aria-label="Slotted radio"
        >
          <button type="button">Daily</button>
        </RadioGroupItem>
      </RadioGroup>
    </>,
  );
  expect(triggerRef.current).toBe(screen.getByRole('combobox', { name: 'Language' }));
  expect(choiceRef.current).toBe(screen.getByRole('checkbox', { name: 'Slotted checkbox' }));
  await page.getByRole('combobox', { name: 'Language' }).click();
  expect(screen.getByRole('option', { name: 'English' })).toBeDefined();
  rerender(
    <Select disabled>
      <SelectTrigger
        asChild
        aria-label="Disabled language"
      >
        <a href="#language">Disabled language</a>
      </SelectTrigger>
    </Select>,
  );
  expect(
    screen.getByRole('combobox', { name: 'Disabled language' }).getAttribute('aria-disabled'),
  ).toBe('true');
});

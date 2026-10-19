import { createElement, type ReactElement } from 'react';
import { describe, expect, test, vi } from 'vitest';

import type { ICreatePageRouteObjectOptions, IPageRouteComponentProps } from './types.js';
import {
  createLazyPageComponent,
  createPageRouteElement,
  createPageRouteHandle,
  createPageRouteMetadata,
  createPageRouteObject,
} from './utilities.js';

const SettingsPage = ({ title }: IPageRouteComponentProps): ReactElement =>
  createElement('h1', null, title);

const METADATA = { title: 'Settings', description: 'Your account and notifications.' };

describe('createPageRouteMetadata', () => {
  test("keeps only a definition's title and description", () => {
    expect(
      createPageRouteMetadata({
        ...METADATA,
        path: '/settings',
        navigationLabel: 'Settings',
      } as typeof METADATA),
    ).toStrictEqual(METADATA);
    expect(createPageRouteHandle(METADATA)).toStrictEqual({ pageMetadata: METADATA });
  });

  test('renders a page with exactly its title and description as props', () => {
    const element = createPageRouteElement(SettingsPage, {
      ...METADATA,
      path: '/x',
    } as typeof METADATA);

    expect(element.type).toBe(SettingsPage);
    expect(element.props).toStrictEqual(METADATA);
  });
});

describe('createPageRouteObject', () => {
  test('makes an eager route of the path, the handle, and the element', () => {
    const route = createPageRouteObject({
      ...METADATA,
      path: '/settings',
      Component: SettingsPage,
    });

    expect(Object.keys(route)).toStrictEqual(['path', 'handle', 'element']);
    expect(route).toMatchObject({ path: '/settings', handle: { pageMetadata: METADATA } });
    expect((route.element as ReactElement).props).toStrictEqual(METADATA);
  });

  test('makes a lazy route that resolves to the element, with its HydrateFallback', async () => {
    const HydrateFallback = (): null => null;
    const lazy = vi.fn(() => Promise.resolve({ Component: SettingsPage }));
    const route = createPageRouteObject(
      { ...METADATA, path: '/settings', lazy, section: 'account' },
      { HydrateFallback },
    );

    expect(Object.keys(route)).toStrictEqual(['path', 'handle', 'HydrateFallback', 'lazy']);
    expect(route.HydrateFallback).toBe(HydrateFallback);
    expect(lazy).not.toHaveBeenCalled();
    const resolved = await (route.lazy as () => Promise<{ element: ReactElement }>)();
    expect(resolved.element.type).toBe(SettingsPage);
    expect(resolved.element.props).toStrictEqual(METADATA);
  });

  test('leaves HydrateFallback out of a lazy route without one', () => {
    const route = createPageRouteObject({
      ...METADATA,
      path: '/settings',
      lazy: () => Promise.resolve({ Component: SettingsPage }),
    });

    expect(Object.keys(route)).toStrictEqual(['path', 'handle', 'lazy']);
  });

  test('wraps the element of eager and lazy routes, with the metadata', async () => {
    const wrapElement = vi.fn<NonNullable<ICreatePageRouteObjectOptions['wrapElement']>>(
      (element) => createElement('main', null, element),
    );
    const eager = createPageRouteObject(
      { ...METADATA, path: '/eager', Component: SettingsPage },
      { wrapElement },
    );
    const lazy = createPageRouteObject(
      { ...METADATA, path: '/lazy', lazy: () => Promise.resolve({ Component: SettingsPage }) },
      { wrapElement },
    );
    const resolved = await (lazy.lazy as () => Promise<{ element: ReactElement }>)();

    expect((eager.element as ReactElement).type).toBe('main');
    expect(resolved.element.type).toBe('main');
    expect(wrapElement).toHaveBeenCalledTimes(2);
    expect(wrapElement.mock.calls.map(([, metadata]) => metadata)).toStrictEqual([
      METADATA,
      METADATA,
    ]);
  });
});

describe('createLazyPageComponent', () => {
  test('loads the module only when called, and gives its default export as the component', async () => {
    const loadModule = vi.fn(() => Promise.resolve({ default: SettingsPage }));
    const lazy = createLazyPageComponent(loadModule);

    expect(loadModule).not.toHaveBeenCalled();
    await expect(lazy()).resolves.toStrictEqual({ Component: SettingsPage });
    expect(loadModule).toHaveBeenCalledTimes(1);
  });
});

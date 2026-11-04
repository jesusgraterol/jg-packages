import type { ComponentType } from 'react';

// imports a route's module on demand, such as `() => import('./settings.page.js')`
export type IRouteModuleLoader<TModule extends object> = () => Promise<TModule>;

// what a lazy route resolves to: the component its module exports
export type ILazyRoute<TProps extends object> = () => Promise<{ Component: ComponentType<TProps> }>;

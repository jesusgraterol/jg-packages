// what the recipes use but don't define; release check 8 typechecks them with it, and it never
// ships

// the part of NestJS the recipes use, which a Nest app has installed
declare module '@nestjs/common' {
  export function Module(metadata: {
    providers?: unknown[];
    exports?: unknown[];
  }): <T extends abstract new (...args: never[]) => unknown>(
    target: T,
    context: ClassDecoratorContext,
  ) => void;

  export interface OnApplicationShutdown {
    onApplicationShutdown(signal?: string): unknown;
  }
}

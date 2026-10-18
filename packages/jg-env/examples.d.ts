// what the recipes use but don't define; release check 8 typechecks them with it, and it never
// ships

// Vite's import.meta.env, which Vite's own types define in an app
interface ImportMeta {
  readonly env: Readonly<Record<string, string | boolean | undefined>>;
}

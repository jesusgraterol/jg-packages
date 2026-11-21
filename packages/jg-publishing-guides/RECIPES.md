# jg-publishing-guides recipes

Turn reviewed text, media, and channel steps into an offline Spanish publishing guide and a plain-text fallback.

## Render a bilingual workflow's Spanish guide

```ts
import { renderPublishingGuide } from 'jg-publishing-guides';

const { html, readme } = renderPublishingGuide(
  {
    title: 'Publicación revisada',
    summary: 'Material preparado para publicación manual.',
    files: [
      { path: 'caption.txt', label: 'Texto', details: 'Texto aprobado.', kind: 'file' },
      {
        path: 'post.png',
        label: 'Imagen',
        details: 'Diagrama de dos colaboradores revisando una publicación.',
        kind: 'image',
        width: 1080,
        height: 1350,
      },
    ],
    walkthrough: [{ channel: 'instagram', caption: 'caption.txt', media: ['post.png'] }],
  },
  new Map([['caption.txt', 'Texto que se copiará en la publicación.']]),
  { locale: 'es' },
);

void [html, readme]; // Write start-here.html and readme.txt beside the selected files.
```

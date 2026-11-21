import { hashValue } from 'jg-crypto';
import { escapeHtml } from 'jg-utilities';

import { initializeDeliveryControls } from './controls.js';
import { GUIDE_STYLES } from './styles.js';
import { invalidGuide } from './validations.js';
import type {
  IPublishingChannel,
  IPublishingGuide,
  IPublishingGuideStep,
  IPublishingGuideLocale,
} from './types.js';

const controlsSource = `(${initializeDeliveryControls.toString()})();`;
const controlsHash = Buffer.from(hashValue(controlsSource), 'hex').toString('base64');

const CHANNEL_NAMES: Record<IPublishingChannel, string> = {
  x: 'X',
  linkedin: 'LinkedIn',
  instagram: 'Instagram',
  tiktok: 'TikTok',
  facebook: 'Facebook',
  threads: 'Threads',
  bluesky: 'Bluesky',
  youtube: 'YouTube',
  github: 'GitHub',
  post: 'Post',
};
const SPANISH = new Map([
  ['Delivery guide', 'Guía de publicación'],
  ['Choose a network to prepare your post.', 'Elige una red para preparar tu publicación.'],
  ['Publishing networks', 'Guías de publicación'],
  ['Publication guides', 'Guías de publicación'],
  [
    'Follow the steps to prepare the selected files.',
    'Sigue los pasos para preparar los archivos seleccionados.',
  ],
  ['Guide steps', 'Pasos de la guía'],
  ['1 Start', '1 Inicio'],
  ['2 Caption', '2 Texto'],
  ['3 Files', '3 Medios'],
  ['4 Review', '4 Revisión'],
  ['Copy', 'Copiar'],
  ['Copying...', 'Copiando...'],
  ['Copied.', 'Copiado.'],
  ['Or select the text to copy.', 'También puedes seleccionar el texto.'],
  [
    "Text selected. Use your device's Copy command.",
    'Texto seleccionado. Usa Copiar en tu dispositivo.',
  ],
  ['Copy the title and description', 'Copiar el título y la descripción'],
  ['Open title as a text file', 'Abrir el título como archivo'],
  [
    'Confirm the account, title and description.',
    'Confirma la cuenta, el título y la descripción.',
  ],
  ['Copy the caption', 'Copiar el texto'],
  ['Copy the text below.', 'Copia el texto siguiente.'],
  ['Add the images', 'Añadir las imágenes'],
  ['Attach the document', 'Adjuntar el documento'],
  ['Document post', 'Publicación con documento'],
  ['Document title', 'Título del documento'],
  ['When asked for a document title, use:', 'Cuando se solicite un título para el documento, usa:'],
  ['Preview and publish', 'Revisar y publicar'],
  ['Confirm the account and caption.', 'Confirma la cuenta y el texto.'],
  [
    'Check the image order, crops and image descriptions.',
    'Comprueba el orden, los recortes y las descripciones de las imágenes.',
  ],
  [
    'Preview the document and check its title and page order.',
    'Revisa el documento, su título y el orden de sus páginas.',
  ],
  [
    'When the preview looks right, publish the post yourself.',
    'Cuando la vista previa esté lista, publica manualmente.',
  ],
  [
    'After publishing, keep the live post link so we can record it.',
    'Después de publicar, guarda el enlace para registrar la publicación.',
  ],
  [
    'Check the audience and any selected sound.',
    'Comprueba la audiencia y cualquier sonido seleccionado.',
  ],
  ['Open caption as a text file', 'Abrir el texto como archivo'],
  ['Open full-size image', 'Abrir imagen completa'],
  ['Open', 'Abrir'],
  [
    "Add this in the image's alt text or accessibility field.",
    'Añade esta descripción en el campo de texto alternativo o accesibilidad.',
  ],
  ['All included files', 'Todos los archivos incluidos'],
  ['Selected files', 'Archivos seleccionados'],
  ['Delivery files', 'Archivos de la entrega'],
  [
    'Choose a file to open, copy, or share. Publication remains manual.',
    'Elige un archivo para abrir, copiar o compartir. La publicación es manual.',
  ],
  [
    'This guide works offline. Keep the folder together when moving it.',
    'Esta guía funciona sin conexión. Conserva la carpeta completa al moverla.',
  ],
  ['Read the plain-text guide', 'Leer la guía de texto'],
  ['Open the video using its file link.', 'Abre el video con su enlace.'],
  ['No installation or server is needed.', 'No necesitas instalar nada ni iniciar un servidor.'],
]);

const ui = (text: string, locale: IPublishingGuideLocale): string =>
  locale === 'es' ? (SPANISH.get(text) ?? text) : text;
const guideId = (guide: IPublishingGuideStep): string => guide.id ?? guide.channel;
const guideName = (guide: IPublishingGuideStep): string =>
  guide.label ?? CHANNEL_NAMES[guide.channel];

const startInstructions = (channel: IPublishingChannel, locale: IPublishingGuideLocale): string => {
  const name = CHANNEL_NAMES[channel];
  if (channel === 'post')
    return locale === 'es'
      ? 'Elige el canal y comprueba la cuenta antes de preparar la publicación con los archivos revisados.'
      : 'Choose the destination and check the account before preparing the post with the reviewed files.';
  if (channel === 'tiktok')
    return locale === 'es'
      ? 'Copia las fotos seleccionadas a tu teléfono. Abre TikTok y comprueba que estás usando la cuenta correcta.'
      : 'Copy the selected photos from this folder to your phone. Open the TikTok app and check that you are using the account you want to publish from.';
  return locale === 'es'
    ? `Abre ${name}, comprueba la cuenta y prepara una publicación nueva.`
    : `Open ${name}, check that you are using the account you want to publish from, and start a new post.`;
};

/** Gets literal caption copy from the selected files. */
const captionText = (copy: ReadonlyMap<string, string>, name: string): string => {
  const text = copy.get(name);
  if (text === undefined) invalidGuide('Walkthrough caption text is unavailable.');
  return text;
};

/** Gets an explicitly selected post title. */
const titleText = (copy: ReadonlyMap<string, string>, name: string | undefined): string => {
  if (name === undefined) invalidGuide('TikTok guides must select a separate title text file.');
  const text = copy.get(name);
  if (text === undefined) invalidGuide('Walkthrough title text is unavailable.');
  return text;
};

const copyField = (
  id: string,
  label: string,
  value: string,
  rows: number,
  locale: IPublishingGuideLocale,
): string =>
  `<div class="copy-block"><div class="copy-heading"><div class="copy-label"><label for="${id}">${escapeHtml(label)}</label><p class="copy-status" id="${id}-status" role="status">${ui('Or select the text to copy.', locale)}</p></div><button type="button" data-copy-target="${id}" data-copy-status="${id}-status" data-copy-pending="${ui('Copying...', locale)}" data-copy-success="${ui('Copied.', locale)}" data-copy-fallback="${escapeHtml(ui("Text selected. Use your device's Copy command.", locale))}" aria-label="${ui('Copy', locale)} ${escapeHtml(label)}" hidden>${ui('Copy', locale)}</button></div><textarea id="${id}" aria-describedby="${id}-status" readonly rows="${rows}" spellcheck="false">\n${escapeHtml(value)}</textarea></div>`;

/** Lists selected upload files in their reviewed order. */
const selectedMedia = (manifest: IPublishingGuide, guide: IPublishingGuideStep) =>
  guide.media.map((name) => {
    const file = manifest.files.find((item) => item.path === name);
    if (!file) invalidGuide('Walkthrough media is unavailable.');
    return file;
  });

/** Finds the selected Instagram original. */
const repostOriginal = (manifest: IPublishingGuide, guide: IPublishingGuideStep) => {
  const original = manifest.walkthrough?.find(
    (entry) =>
      entry.id === guide.repostOf && entry.channel === 'instagram' && entry.repostOf === undefined,
  );
  if (!original)
    invalidGuide(
      'Repost guides must reference an earlier Instagram original and select no upload media.',
    );
  return original;
};

/** Renders one step using the anchors shared by upload and repost guides. */
const renderStep = (
  id: string,
  locale: IPublishingGuideLocale,
  number: number,
  suffix: string,
  title: string,
  body: string,
): string =>
  `<li><p class="visually-hidden">${locale === 'es' ? `Paso ${number} de 4` : `Step ${number} of 4`}</p><h3 id="${id}-${suffix}" tabindex="-1"><span class="step-number" aria-hidden="true">${number}</span>${escapeHtml(title)}</h3>${body}</li>`;

/** Describes the manual repost action for both formats. */
const repostInstructions = (
  manifest: IPublishingGuide,
  guide: IPublishingGuideStep,
  locale: IPublishingGuideLocale,
) => {
  const original = repostOriginal(manifest, guide),
    name = guideName(guide),
    owner = guideName(original);
  return {
    original,
    name,
    start: locale === 'es' ? `Compartir desde ${name}` : `Repost as ${name}`,
    wait:
      locale === 'es'
        ? `Publica primero el original desde ${owner}. Confirma que ya está publicado antes de continuar.`
        : `Publish the original from ${owner} first. Confirm that it is live before continuing.`,
    note: locale === 'es' ? `Comentario de ${name}` : `${name} repost note`,
    share:
      locale === 'es'
        ? `Abre Instagram, comprueba la cuenta ${name} y busca el original publicado por ${owner}. Usa Repost si está disponible y conserva la atribución y los medios originales. Si no está disponible, revisa la siguiente acción antes de continuar.`
        : `Open Instagram, check the ${name} account, and find the published original from ${owner}. Use its native Repost control if available, retaining the original attribution and media. If unavailable, review the next action before continuing.`,
    review:
      locale === 'es'
        ? 'Comprueba la cuenta, el original y cualquier comentario seleccionado. Comparte manualmente y conserva el enlace disponible para registrar la publicación.'
        : 'Check the account, the original, and any selected note. Share manually and keep any available live link for the publication record.',
  };
};

/** Renders a selected repost without a second upload bundle. */
const renderRepost = (
  manifest: IPublishingGuide,
  guide: IPublishingGuideStep,
  copy: ReadonlyMap<string, string>,
  index: number,
  locale: IPublishingGuideLocale,
): string => {
  const instructions = repostInstructions(manifest, guide, locale),
    id = guideId(guide),
    next = manifest.walkthrough?.[index + 1];
  const note =
    guide.caption === undefined
      ? `<p>${locale === 'es' ? 'No hay comentario seleccionado. Puedes compartir sin añadir uno.' : 'No note is selected. You can repost without adding one.'}</p>`
      : `${copyField(`${id}-caption`, instructions.note, captionText(copy, guide.caption), 5, locale)}<a class="file-link" href="${escapeHtml(guide.caption)}">${locale === 'es' ? 'Abrir el comentario como archivo' : 'Open note as a text file'}</a>`;
  return `<details class="channel" name="publishing" id="${id}" ${index === 0 ? 'open' : ''}><summary><h2 class="network-heading">${escapeHtml(instructions.name)}<span class="format">Repost</span></h2></summary><div class="channel-content"><ol class="steps">
${renderStep(id, locale, 1, 'start', instructions.start, `<p>${escapeHtml(instructions.wait)}</p><a class="file-link" href="#${guideId(instructions.original)}-start" data-channel="${guideId(instructions.original)}">${locale === 'es' ? 'Revisar el original de' : 'Review original from'} ${escapeHtml(guideName(instructions.original))}</a>`)}
${renderStep(id, locale, 2, 'copy', locale === 'es' ? 'Comentario opcional' : 'Optional note', note)}
${renderStep(id, locale, 3, 'media', locale === 'es' ? 'Buscar el original' : 'Find the original', `<p>${escapeHtml(instructions.share)}</p>`)}
${renderStep(id, locale, 4, 'review', locale === 'es' ? 'Revisar y compartir' : 'Review and repost', `<p>${escapeHtml(instructions.review)}</p>${next ? `<a class="file-link next-link" href="#${guideId(next)}-start" data-channel="${guideId(next)}">${locale === 'es' ? 'Continuar en' : 'Continue to'} ${escapeHtml(guideName(next))}</a>` : ''}`)}
</ol></div></details>`;
};

/** Writes the plain-text fallback for a selected repost. */
const renderRepostReadme = (
  manifest: IPublishingGuide,
  guide: IPublishingGuideStep,
  copy: ReadonlyMap<string, string>,
  locale: IPublishingGuideLocale,
): string => {
  const instructions = repostInstructions(manifest, guide, locale);
  const note =
    guide.caption === undefined
      ? locale === 'es'
        ? 'Sin comentario seleccionado.'
        : 'No note selected.'
      : captionText(copy, guide.caption);
  return `${instructions.name}: Repost\n\n1. ${instructions.wait}\n\n2. ${instructions.note}\n${note}\n\n3. ${instructions.share}\n\n4. ${instructions.review}\n`;
};

/** Renders one channel in its reviewed guide order. */
const renderWalkthrough = (
  manifest: IPublishingGuide,
  guide: IPublishingGuideStep,
  copy: ReadonlyMap<string, string>,
  index: number,
  locale: IPublishingGuideLocale,
): string => {
  if (guide.repostOf !== undefined) return renderRepost(manifest, guide, copy, index, locale);
  const name = guideName(guide),
    id = guideId(guide),
    next = manifest.walkthrough?.[index + 1];
  const media = selectedMedia(manifest, guide),
    caption = captionText(copy, guide.caption),
    document = guide.documentTitle !== undefined;
  const format = document
    ? ui('Document post', locale)
    : `${media.length} ${locale === 'es' ? (media.length === 1 ? 'imagen' : 'imágenes') : media.length === 1 ? 'image' : 'images'}`;
  const start = locale === 'es' ? `Preparar tu publicación en ${name}` : `Start your ${name} post`;
  const tiktok = guide.channel === 'tiktok';
  const titledPost = tiktok && guide.postTitle !== undefined;
  const title = titledPost ? titleText(copy, guide.postTitle) : undefined;
  const titleLabel = locale === 'es' ? `Título para ${name}` : `${name} title`;
  const captionLabel = titledPost
    ? locale === 'es'
      ? `Descripción para ${name}`
      : `${name} description`
    : locale === 'es'
      ? `Texto para ${name}`
      : `${name} caption`;
  const titleField =
    title === undefined
      ? ''
      : `${copyField(`${id}-title`, titleLabel, title, 2, locale)}<a class="file-link" href="${escapeHtml(guide.postTitle ?? '')}">${ui('Open title as a text file', locale)}</a>`;
  const paste =
    guide.channel === 'tiktok'
      ? titledPost
        ? locale === 'es'
          ? 'Pega el título y la descripción en sus campos separados después de elegir las fotos en el paso 3.'
          : 'Paste the title and description into their separate fields after choosing your photos in step 3.'
        : locale === 'es'
          ? 'Pégalo en la descripción después de elegir las fotos en el paso 3.'
          : 'Keep it ready to paste into the description after choosing your photos in step 3.'
      : locale === 'es'
        ? 'Pégalo en la publicación y conserva los saltos de párrafo.'
        : `Paste it into your ${name} post, keeping the paragraph breaks.`;
  const legacyTikTok =
    locale === 'es'
      ? 'Elige Añadir publicación, Foto y Subir. Selecciona las fotos en el orden numerado. Pulsa Siguiente para revisarlas y otra vez para llegar a la publicación. Pega el texto en la descripción. En Más opciones, Añadir texto alternativo, añade las descripciones.'
      : `Choose Add post, Photo, then Upload. Select ${media.length === 1 ? 'this photo' : `these ${media.length} photos in the numbered order below`}. Tap Next to review them, then Next again to reach the post screen. Paste the caption from step 2 into the description. Use More options, Add alternative text to add the descriptions below.`;
  const uploadInstructions = tiktok
    ? !titledPost
      ? legacyTikTok
      : locale === 'es'
        ? 'Elige Añadir publicación, Foto y Subir. Selecciona las fotos en el orden numerado. Pulsa Siguiente para revisarlas y otra vez para llegar a la publicación. Pega el título y la descripción del paso 2 en sus campos separados. En Más opciones, Añadir texto alternativo, añade las descripciones.'
        : `Choose Add post, Photo, then Upload. Select ${media.length === 1 ? 'this photo' : `these ${media.length} photos in the numbered order below`}. Tap Next to review them, then Next again to reach the post screen. Paste the title and description from step 2 into their separate fields. Use More options, Add alternative text to add the descriptions below.`
    : locale === 'es'
      ? 'Abre esta carpeta en el selector de archivos. Selecciona las imágenes en el orden numerado y comprueba el orden en la vista previa.'
      : `In the file picker, open this delivery folder. Select ${media.length === 1 ? 'this image' : `these ${media.length} images in the numbered order below`}. Check the upload order in the composer before continuing.`;
  const upload = document
    ? `<p>${locale === 'es' ? 'Adjunta el PDF seleccionado desde esta carpeta:' : `Choose a document attachment in the ${escapeHtml(name)} composer. In the file picker, open this delivery folder and select the PDF shown below:`}</p><a class="file-link" href="${escapeHtml(media[0]?.path ?? '')}">${ui('Open', locale)} ${escapeHtml(media[0]?.path ?? '')}</a><p>${ui('When asked for a document title, use:', locale)}</p>${copyField(`${id}-title`, ui('Document title', locale), guide.documentTitle ?? '', 2, locale)}`
    : `<p>${escapeHtml(uploadInstructions)}</p><ol class="uploads">${media
        .map((file, position) => {
          if (file.kind !== 'image') invalidGuide('Walkthrough media is unavailable.');
          const number = position + 1,
            filename = file.path.split('/').at(-1) ?? file.path;
          const description =
            locale === 'es' ? `Descripción de la imagen ${number}` : `Image ${number} description`;
          const ordinal =
            locale === 'es'
              ? `Imagen ${number} de ${media.length}`
              : `Image ${number} of ${media.length}`;
          return `<li><figure><figcaption class="visually-hidden">${number}. ${escapeHtml(filename)}</figcaption><a class="media-file" href="${escapeHtml(file.path)}" aria-label="${ui('Open full-size image', locale)} ${number}"><img src="${escapeHtml(file.path)}" width="${file.width}" height="${file.height}" alt="${escapeHtml(file.details)}" loading="lazy"><span class="file-info"><span class="file-meta">${ordinal}</span><strong>${escapeHtml(filename)}</strong><span class="file-action">${ui('Open full-size image', locale)}</span></span></a><details class="image-description"><summary>${description}</summary><p>${ui("Add this in the image's alt text or accessibility field.", locale)}</p>${copyField(`${id}-alt-${number}`, description, file.details, 4, locale)}</details></figure></li>`;
        })
        .join('\n')}</ol>`;
  return `<details class="channel" name="publishing" id="${id}" ${index === 0 ? 'open' : ''}><summary><h2 class="network-heading">${escapeHtml(name)}<span class="format">${format}</span></h2></summary><div class="channel-content"><ol class="steps">
${renderStep(id, locale, 1, 'start', start, `<p>${escapeHtml(startInstructions(guide.channel, locale))}</p>`)}
${renderStep(id, locale, 2, 'copy', ui(titledPost ? 'Copy the title and description' : 'Copy the caption', locale), `<p>${ui('Copy the text below.', locale)} ${escapeHtml(paste)}</p>${titleField}${copyField(`${id}-caption`, captionLabel, caption, Math.max(5, Math.min(12, caption.split('\n').length)), locale)}<a class="file-link" href="${escapeHtml(guide.caption)}">${ui('Open caption as a text file', locale)}</a>`)}
${renderStep(id, locale, 3, 'media', ui(document ? 'Attach the document' : 'Add the images', locale), upload)}
${renderStep(id, locale, 4, 'review', ui('Preview and publish', locale), `<ul class="checks"><li>${ui(titledPost ? 'Confirm the account, title and description.' : 'Confirm the account and caption.', locale)}</li><li>${ui(document ? 'Preview the document and check its title and page order.' : 'Check the image order, crops and image descriptions.', locale)}</li>${guide.channel === 'tiktok' ? `<li>${ui('Check the audience and any selected sound.', locale)}</li>` : ''}<li>${ui('When the preview looks right, publish the post yourself.', locale)}</li></ul><p>${ui('After publishing, keep the live post link so we can record it.', locale)}</p>${next ? `<a class="file-link next-link" href="#${guideId(next)}-start" data-channel="${guideId(next)}">${locale === 'es' ? 'Continuar en' : 'Continue to'} ${escapeHtml(guideName(next))}</a>` : ''}`)}
</ol></div></details>`;
};

/** Renders the responsive offline page from the validated guide. */
export const renderGuideHtml = (
  manifest: IPublishingGuide,
  copy: ReadonlyMap<string, string>,
  locale: IPublishingGuideLocale,
): string => {
  const guided = manifest.walkthrough !== undefined;
  const generic = manifest.walkthrough?.every((guide) => guide.channel === 'post') ?? false;
  const scripted = guided || copy.size > 0;
  const names = [
    ['start', ui('1 Start', locale)],
    ['copy', ui('2 Caption', locale)],
    ['media', ui('3 Files', locale)],
    ['review', ui('4 Review', locale)],
  ] as const;
  const first = manifest.walkthrough?.[0];
  return `<!doctype html>
<html lang="${locale}"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width, initial-scale=1, viewport-fit=cover"><meta name="referrer" content="no-referrer"><meta http-equiv="Content-Security-Policy" content="default-src 'none'; img-src 'self' file: data:; media-src 'self' file: data:; style-src 'unsafe-inline'; script-src ${scripted ? `'sha256-${controlsHash}'` : "'none'"}; base-uri 'none'; form-action 'none'"><title>${escapeHtml(manifest.title)}</title>
<style>${GUIDE_STYLES}</style></head><body><main><header class="page-header"><p>${ui('Delivery guide', locale)}</p><h1>${escapeHtml(manifest.title)}</h1>${guided ? `<p class="guide-intro">${ui(generic ? 'Follow the steps to prepare the selected files.' : 'Choose a network to prepare your post.', locale)}</p>` : `<p>${escapeHtml(manifest.summary)}</p><p>${ui('Choose a file to open, copy, or share. Publication remains manual.', locale)}</p>`}</header>
${guided ? `<div class="toolbar"><nav class="network-nav" data-network-nav aria-label="${ui(generic ? 'Publication guides' : 'Publishing networks', locale)}">${manifest.walkthrough?.map((guide) => `<a href="#${guideId(guide)}-start" data-channel="${guideId(guide)}">${escapeHtml(guideName(guide))}</a>`).join('')}</nav><nav class="step-nav" data-step-nav aria-label="${ui('Guide steps', locale)}" hidden>${names.map(([suffix, label]) => `<a href="#${first ? guideId(first) : ''}-${suffix}" data-step="${suffix}">${label}</a>`).join('')}</nav></div><section aria-label="${ui(generic ? 'Publication guides' : 'Publishing networks', locale)}">${manifest.walkthrough?.map((guide, index) => renderWalkthrough(manifest, guide, copy, index, locale)).join('\n')}</section><details class="appendix"><summary>${ui('All included files', locale)}</summary><ul class="inventory">${manifest.files.map((file) => `<li><strong>${escapeHtml(file.label)}</strong><br><a class="file-link" href="${escapeHtml(file.path)}">${escapeHtml(file.path)}</a></li>`).join('\n')}</ul></details>` : `<nav class="selected-files" aria-label="${ui('Selected files', locale)}">${manifest.files.map((file, index) => `<a href="#file-${index + 1}">${escapeHtml(file.label)}</a>`).join('\n')}</nav><section class="files" aria-label="${ui('Delivery files', locale)}">${manifest.files.map((file, index) => `<article id="file-${index + 1}"><h2>${escapeHtml(file.label)}</h2><p>${escapeHtml(file.details)}</p>${file.kind === 'image' ? `<img src="${escapeHtml(file.path)}" width="${file.width}" height="${file.height}" alt="${escapeHtml(file.details)}" loading="lazy">` : file.kind === 'video' ? `<video controls playsinline preload="none" width="${file.width}" height="${file.height}" style="aspect-ratio: ${file.width} / ${file.height}" aria-label="${escapeHtml(file.label)}"><source src="${escapeHtml(file.path)}">${ui('Open the video using its file link.', locale)}</video>` : ''}${copy.has(file.path) ? copyField(`file-copy-${index + 1}`, file.label, copy.get(file.path) ?? '', 5, locale) : ''}<a class="file-link" href="${escapeHtml(file.path)}">${ui('Open', locale)} ${escapeHtml(file.path)}</a></article>`).join('\n')}</section>`}
<footer><p>${ui('This guide works offline. Keep the folder together when moving it.', locale)} <a href="readme.txt">${ui('Read the plain-text guide', locale)}</a></p></footer></main>${scripted ? `<script data-delivery-controls>${controlsSource}</script>` : ''}</body></html>\n`;
};

/** Renders the matching plain-text guide. */
export const renderGuideReadme = (
  manifest: IPublishingGuide,
  copy: ReadonlyMap<string, string>,
  locale: IPublishingGuideLocale,
): string => {
  const open =
    locale === 'es'
      ? 'Abre start-here.html para seguir la guía.'
      : 'Open start-here.html for the guided page.';
  const manual = locale === 'es' ? 'La publicación es manual.' : 'Publication is manual.';
  return `${manifest.title}\n${manifest.summary}\n\n${open} ${ui('No installation or server is needed.', locale)}\n${ui('This guide works offline. Keep the folder together when moving it.', locale)} ${manual}\n\n${
    manifest.walkthrough
      ?.map((guide) =>
        guide.repostOf !== undefined
          ? renderRepostReadme(manifest, guide, copy, locale)
          : `${guideName(guide)}\n\n1. ${startInstructions(guide.channel, locale)}\n\n2. ${ui(guide.postTitle !== undefined ? 'Copy the title and description' : 'Copy the caption', locale)}\n${guide.postTitle !== undefined ? `${locale === 'es' ? 'Título' : 'Title'}:\n${titleText(copy, guide.postTitle)}\n${locale === 'es' ? 'Descripción' : 'Description'}:\n` : ''}${captionText(copy, guide.caption)}\n\n3. ${ui(guide.documentTitle ? 'Attach the document' : 'Add the images', locale)}\n${guide.documentTitle ? `${ui('Document title', locale)}: ${guide.documentTitle}\n` : ''}${selectedMedia(
              manifest,
              guide,
            )
              .map((file, index) => `${index + 1}. ${file.path}\n${file.details}`)
              .join(
                '\n\n',
              )}\n\n4. ${ui('Preview and publish', locale)}\n${ui('Confirm the account and caption.', locale)} ${ui('After publishing, keep the live post link so we can record it.', locale)}\n`,
      )
      .join('\n') ?? ''
  }\n${ui('All included files', locale)}\n\n${manifest.files.map((file) => `${file.label}\n${file.details}\n${file.path}\n${copy.get(file.path) ?? ''}`).join('\n')}`;
};

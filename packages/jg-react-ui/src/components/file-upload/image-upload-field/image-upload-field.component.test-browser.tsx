import { act, type ReactElement } from 'react';
import { createRoot, type Root } from 'react-dom/client';
import { afterEach, beforeEach, describe, expect, test, vi } from 'vitest';

import { ImageUploadField } from './image-upload-field.component.js';

const TEST_IMAGE_URL = 'data:image/gif;base64,R0lGODlhAQABAAD/ACwAAAAAAQABAAACADs=';

const fileUploadDialogProps = vi.hoisted(() => vi.fn());

vi.mock('../file-upload-dialog/index.js', () => ({
  FileUploadDialog: (props: { trigger: ReactElement }) => {
    fileUploadDialogProps(props);
    return props.trigger;
  },
}));

const reactActEnvironment = globalThis as typeof globalThis & {
  IS_REACT_ACT_ENVIRONMENT?: boolean;
};

describe('ImageUploadField', () => {
  let container: HTMLDivElement;
  let root: Root;

  beforeEach(() => {
    reactActEnvironment.IS_REACT_ACT_ENVIRONMENT = true;
    container = document.createElement('div');
    document.body.appendChild(container);
    root = createRoot(container);
  });

  afterEach(() => {
    act(() => root.unmount());
    container.remove();
    vi.restoreAllMocks();
    vi.clearAllMocks();
  });

  test('renders the controlled image and forwards a single-image dialog contract', () => {
    const onSubmit = vi.fn();
    const uploadFile = vi.fn(() => Promise.resolve('uploaded'));

    act(() => {
      root.render(
        <ImageUploadField
          acceptedFileTypes={['image/png']}
          currentImage={{
            fileName: 'avatar.png',
            imageUrl: `${TEST_IMAGE_URL}#avatar`,
          }}
          label="Avatar"
          maxFileBytes={1024}
          onSubmit={onSubmit}
          uploadFile={uploadFile}
        />,
      );
    });

    expect(container.textContent).toContain('Avatar');
    expect(container.textContent).toContain('avatar.png');
    expect(container.querySelector('[role="group"]')?.getAttribute('aria-labelledby')).toBe(
      container.querySelector('label')?.id,
    );
    expect(container.querySelector('img')?.src).toBe(`${TEST_IMAGE_URL}#avatar`);
    expect(container.querySelector('button')?.textContent).toContain('Replace');
    expect(fileUploadDialogProps.mock.lastCall?.[0]).toMatchObject({
      fileUploadProps: {
        acceptedFileTypes: ['image/png'],
        maxConcurrentUploads: 1,
        maxFiles: 1,
        replaceSingleFile: true,
        uploadFile,
      },
      onSubmit,
      title: 'Upload image',
    });
  });

  test('supports error, loading, disabled, and controlled removal states', () => {
    const onCurrentImageRemove = vi.fn();

    act(() => {
      root.render(
        <ImageUploadField
          acceptedFileTypes={['image/*']}
          currentImage={{ fileName: 'cover.webp', imageUrl: `${TEST_IMAGE_URL}#cover` }}
          error="Upload cleanup failed."
          isLoading
          maxFileBytes={1024}
          onCurrentImageRemove={onCurrentImageRemove}
          onSubmit={vi.fn()}
          uploadFile={vi.fn(() => Promise.resolve('uploaded'))}
        />,
      );
    });

    expect(container.querySelector('[aria-busy="true"]')).not.toBeNull();
    expect(container.querySelector('[role="alert"]')?.textContent).toBe('Upload cleanup failed.');
    expect(Array.from(container.querySelectorAll('button')).every(({ disabled }) => disabled)).toBe(
      true,
    );

    act(() => {
      root.render(
        <ImageUploadField
          acceptedFileTypes={['image/*']}
          currentImage={{ fileName: 'cover.webp', imageUrl: `${TEST_IMAGE_URL}#cover` }}
          maxFileBytes={1024}
          onCurrentImageRemove={onCurrentImageRemove}
          onSubmit={vi.fn()}
          uploadFile={vi.fn(() => Promise.resolve('uploaded'))}
        />,
      );
    });

    act(() => Array.from(container.querySelectorAll('button'))[1]?.click());
    expect(onCurrentImageRemove).toHaveBeenCalledTimes(1);
  });
  test(
    'keeps a same-size fallback for a failed preview and retries a changed source',
    { tags: ['full'] },
    () => {
      const renderImage = (imageUrl: string) =>
        root.render(
          <ImageUploadField
            acceptedFileTypes={['image/png']}
            currentImage={{ fileName: 'preview.png', imageUrl }}
            maxFileBytes={1024}
            onSubmit={() => undefined}
            uploadFile={() => Promise.resolve('uploaded')}
          />,
        );
      act(() => renderImage(TEST_IMAGE_URL));
      const image = container.querySelector('img');
      if (image === null) throw new Error('The initial preview was not rendered.');
      act(() => {
        image.dispatchEvent(new Event('error'));
      });
      expect(container.querySelector('img')).toBeNull();
      expect(container.textContent).toContain('preview.png');
      expect(container.querySelector('button')?.disabled).toBe(false);
      act(() => renderImage(TEST_IMAGE_URL + '#replacement'));
      expect(container.querySelector('img')?.src).toBe(TEST_IMAGE_URL + '#replacement');
    },
  );

  test('preserves empty-image guidance and each caller-owned queue callback', () => {
    const onFileRejected = vi.fn();
    const onItemsChange = vi.fn();
    const onUploadCanceled = vi.fn();
    const onUploadFailure = vi.fn();
    const onUploadSuccess = vi.fn();
    const validateFile = vi.fn();
    const onDiscard = vi.fn();
    act(() =>
      root.render(
        <ImageUploadField
          acceptedFileTypes={['image/png']}
          currentImage={null}
          description="Choose a project image"
          label="Project image"
          maxFileBytes={1024}
          onSubmit={() => undefined}
          uploadFile={() => Promise.resolve('uploaded')}
          onFileRejected={onFileRejected}
          onItemsChange={onItemsChange}
          onUploadCanceled={onUploadCanceled}
          onUploadFailure={onUploadFailure}
          onUploadSuccess={onUploadSuccess}
          validateFile={validateFile}
          onDiscard={onDiscard}
        />,
      ),
    );
    expect(container.textContent).toContain('No image selected');
    expect(container.textContent).toContain('Choose an image to continue');
    expect(container.querySelector('[role="group"]')?.getAttribute('aria-describedby')).toBe(
      container.querySelector('[data-slot="field-description"]')?.id,
    );
    expect(fileUploadDialogProps.mock.lastCall?.[0]).toMatchObject({
      onDiscard,
      fileUploadProps: {
        onFileRejected,
        onItemsChange,
        onUploadCanceled,
        onUploadFailure,
        onUploadSuccess,
        validateFile,
      },
    });
    expect(container.querySelectorAll('button')).toHaveLength(1);
  });
});

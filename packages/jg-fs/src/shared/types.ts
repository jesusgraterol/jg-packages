import type { ISortDirection } from 'jg-utilities';

// the details of a path, read with lstat, so a symbolic link is described rather than followed
export type IPathElement = {
  // the path, as given
  path: string;

  // the last segment of the path
  baseName: string;

  // the extension, such as '.json', or an empty string when there is none
  extName: string;

  // whether it's a regular file
  isFile: boolean;

  // whether it's a directory
  isDirectory: boolean;

  // whether it's a symbolic link, in which case isFile and isDirectory are false
  isSymbolicLink: boolean;

  // the size in bytes
  size: number;

  // when it was created, in milliseconds since the epoch
  creation: number;
};

// the keys a directory's elements can be sorted by
export type IDirectoryElementsKeySort = 'baseName' | 'size' | 'creation';

// how getDirectoryElements filters and sorts a directory's elements
export type IDirectoryElementsOptions = {
  // the key the elements are sorted by. Defaults to 'baseName'
  sortByKey: IDirectoryElementsKeySort;

  // the sort direction. Defaults to 'asc'
  sortOrder: ISortDirection;

  // the extensions of the files to include, such as ['.json'], matched case-insensitively. Defaults to all
  includeExts: string[];
};

// a directory's elements, grouped by kind
export type IDirectoryPathElements = {
  directories: IPathElement[];
  files: IPathElement[];
  symbolicLinks: IPathElement[];
};

// the readFile options that make it return a string
export type IReadStringFileOptions =
  | {
      encoding: BufferEncoding;
      flag?: string | undefined;
    }
  | BufferEncoding;

// the readFile options that make it return a Buffer
export type IReadBufferFileOptions = {
  encoding?: null | undefined;
  flag?: string | undefined;
} | null;

// the options readFile accepts
export type IReadFileOptions = IReadBufferFileOptions | IReadStringFileOptions;

// validates parsed data and returns it typed, which a Zod schema does
export type ISchema<T> = {
  parse(value: unknown): T;
};

// what readJsonFile accepts
export type IReadJsonFileOptions<T> = {
  // validates the parsed content, such as a Zod schema. Its errors propagate unchanged
  schema?: ISchema<T>;

  // the largest file accepted, in bytes, for a file whose size isn't yours to decide, such as one
  // a user uploaded. With it, the file is read as readBoundedFile reads it
  maxBytes?: number;
};

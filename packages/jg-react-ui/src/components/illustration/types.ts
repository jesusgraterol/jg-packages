/** The drawings an Illustration shows: an empty list, conversation or checklist, an error, or
 * being offline.
 * @see Illustration
 */
export type IIllustrationName = 'list' | 'conversation' | 'checklist' | 'error' | 'offline';

/** Options for Illustration: the drawing, and the classes that place it.
 * @see Illustration
 */
export type IIllustrationProps = {
  name: IIllustrationName;
  className?: string;
};

// supported interface languages
export type IPublishingGuideLocale = 'en' | 'es';

// manual destinations already supported by offline publishing packets
export type IPublishingChannel =
  | 'x'
  | 'linkedin'
  | 'instagram'
  | 'tiktok'
  | 'facebook'
  | 'threads'
  | 'bluesky'
  | 'youtube'
  | 'github'
  | 'post';

// one portable file selected by the caller, with preview dimensions for images and video
export type IPublishingGuideFile = { path: string; label: string; details: string } & (
  { kind: 'file' } | { kind: 'image' | 'video'; width: number; height: number }
);

// one channel's caption and upload order, or a repost of an earlier Instagram step
export type IPublishingGuideStep = (
  | {
      channel: IPublishingChannel;
      id?: string;
      caption: string;
      media: string[];
      documentTitle?: string;
      postTitle?: string;
      repostOf?: undefined;
    }
  | {
      channel: 'instagram';
      id: string;
      caption?: string;
      media: [];
      documentTitle?: undefined;
      postTitle?: undefined;
      repostOf: string;
    }
) & { label?: string };

// the caller-approved presentation records for one publishing packet
export type IPublishingGuide = {
  title: string;
  summary: string;
  files: IPublishingGuideFile[];
  walkthrough?: IPublishingGuideStep[];
};

// the interface locale is independent of the authored copy
export type IPublishingGuideOptions = { locale?: IPublishingGuideLocale };

// offline formats for start-here.html and readme.txt, respectively
export type IPublishingGuideResult = { html: string; readme: string };

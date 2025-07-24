import { Block } from "payload";

import {
  FixedToolbarFeature,
  HeadingFeature,
  HorizontalRuleFeature,
  InlineToolbarFeature,
  lexicalEditor,
} from "@payloadcms/richtext-lexical";

export const Content: Block = {
  slug: "content",
  labels: {
    singular: "Content",
    plural: "Content",
  },
  fields: [
    {
      name: "content",
      label: "Content",
      type: "richText",
      editor: lexicalEditor({
        features: ({ rootFeatures }) => {
          return [
            ...rootFeatures,
            HeadingFeature({
              enabledHeadingSizes: ["h1", "h2", "h3", "h4"],
            }),
            //BlocksFeature({ blocks: [Banner, Code, MediaBlock] }),
            FixedToolbarFeature(),
            InlineToolbarFeature(),
            HorizontalRuleFeature(),
          ];
        },
      }),
      required: true,
    },
  ],
};

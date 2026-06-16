import { Block } from "payload";

import {
  FixedToolbarFeature,
  HeadingFeature,
  HorizontalRuleFeature,
  InlineToolbarFeature,
  lexicalEditor,
  BlocksFeature,
} from "@payloadcms/richtext-lexical";

import { FormBlock } from "../form/config";

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
            BlocksFeature({ blocks: [FormBlock] }),
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

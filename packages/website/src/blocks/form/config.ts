import type { Block } from "payload";

import {
  FixedToolbarFeature,
  HeadingFeature,
  HorizontalRuleFeature,
  InlineToolbarFeature,
  lexicalEditor,
} from "@payloadcms/richtext-lexical";

export const FormBlock: Block = {
  slug: "form-block",
  fields: [
    {
      name: "form",
      type: "relationship",
      relationTo: "forms",
      required: true,
    },
    {
      name: "enableIntro",
      type: "checkbox",
      label: "Enable Intro Content",
    },
    {
      name: "introContent",
      type: "richText",
      admin: {
        condition: (_, { enableIntro }) => Boolean(enableIntro),
      },
      editor: lexicalEditor({
        features: ({ rootFeatures }) => {
          return [
            ...rootFeatures,
            HeadingFeature({
              enabledHeadingSizes: ["h1", "h2", "h3", "h4", "h5", "h6"],
            }),
            FixedToolbarFeature(),
            InlineToolbarFeature(),
            HorizontalRuleFeature(),
          ];
        },
      }),
      label: "Intro Content",
    },
  ],
  graphQL: {
    singularName: "FormBlock",
  },
  labels: {
    plural: "Form Blocks",
    singular: "Form Block",
  },
};

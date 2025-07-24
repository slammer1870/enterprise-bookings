import React from "react";

import { RichText } from "@payloadcms/richtext-lexical/react";

import { SerializedEditorState } from "@payloadcms/richtext-lexical/lexical";

type ContentProps = {
  content: SerializedEditorState;
};

export const ContentBlock: React.FC<ContentProps> = ({ content }) => {
  return (
    <div className="flex min-h-screen">
      <RichText data={content} className="prose max-w-lg mx-auto py-24 px-4" />
    </div>
  );
};

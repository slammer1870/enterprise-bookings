"use client";

import type {
  DefaultNodeTypes,
  SerializedBlockNode,
} from "@payloadcms/richtext-lexical";

import type { SerializedEditorState } from "@payloadcms/richtext-lexical/lexical";

import {
  type JSXConvertersFunction,
  RichText,
} from "@payloadcms/richtext-lexical/react";

import React from "react";

import { FormBlock, FormBlockType } from "../form";

// Extend the default node types with your custom blocks for full type safety
type NodeTypes = DefaultNodeTypes | SerializedBlockNode<FormBlockType>;

const jsxConverters: JSXConvertersFunction<NodeTypes> = ({
  defaultConverters,
}) => ({
  ...defaultConverters,
  blocks: {
    "form-block": ({ node }: { node: SerializedBlockNode<FormBlockType> }) => (
      <FormBlock {...node.fields} />
    ),
  },
});

type ContentProps = {
  content: SerializedEditorState;
};

export const ContentBlock: React.FC<ContentProps> = ({ content }) => {
  return (
    <RichText
      converters={jsxConverters}
      data={content}
      className="prose prose-lg w-full"
    />
  );
};

import { MediaBlock } from '@/blocks/MediaBlock/Component'
import { MapBlock } from '@/blocks/Map/Component'
import {
  DefaultNodeTypes,
  SerializedBlockNode,
  SerializedLinkNode,
  type DefaultTypedEditorState,
} from '@payloadcms/richtext-lexical'
import {
  JSXConvertersFunction,
  LinkJSXConverter,
  RichText as ConvertRichText,
} from '@payloadcms/richtext-lexical/react'

import { CodeBlock, CodeBlockProps } from '@/blocks/Code/Component'
import { LocationBlock } from '@repo/website/src/blocks/location'

import type {
  BannerBlock as BannerBlockProps,
  CallToActionBlock as CTABlockProps,
  LocationBlock as LocationBlockProps,
  MapBlock as MapBlockProps,
  MediaBlock as MediaBlockProps,
} from '@/payload-types'
import { BannerBlock } from '@/blocks/Banner/Component'
import { CallToActionBlock } from '@/blocks/CallToAction/Component'
import { cn } from '@/utilities/ui'

export type ClientSafeNodeTypes =
  | DefaultNodeTypes
  | SerializedBlockNode<
      | CTABlockProps
      | MediaBlockProps
      | BannerBlockProps
      | CodeBlockProps
      | LocationBlockProps
      | MapBlockProps
    >

const internalDocToHref = ({ linkNode }: { linkNode: SerializedLinkNode }) => {
  const { value, relationTo } = linkNode.fields.doc!
  if (typeof value !== 'object') {
    throw new Error('Expected value to be an object')
  }
  const slug = value.slug
  return relationTo === 'posts' ? `/posts/${slug}` : `/${slug}`
}

const headingClassByTag: Record<string, string> = {
  h1: 'text-4xl font-bold mt-8 mb-4 text-foreground',
  h2: 'text-3xl font-bold mt-8 mb-4 text-foreground',
  h3: 'text-2xl font-semibold mt-6 mb-3 text-foreground',
  h4: 'text-xl font-semibold mt-4 mb-2 text-foreground',
  h5: 'text-lg font-semibold mt-4 mb-2 text-foreground',
  h6: 'text-base font-semibold mt-4 mb-2 text-foreground',
}

export const clientSafeJsxConverters: JSXConvertersFunction<ClientSafeNodeTypes> = ({
  defaultConverters,
}) => ({
  ...defaultConverters,
  ...LinkJSXConverter({ internalDocToHref }),
  heading: ({ node, nodesToJSX }) => {
    const children = nodesToJSX({ nodes: node.children })
    const Tag = node.tag
    return <Tag className={headingClassByTag[Tag] ?? headingClassByTag.h2}>{children}</Tag>
  },
  blocks: {
    banner: ({ node }) => <BannerBlock className="col-start-2 mb-4" {...node.fields} />,
    mediaBlock: ({ node }) => (
      <MediaBlock
        className="col-start-1 col-span-3"
        imgClassName="m-0"
        {...node.fields}
        captionClassName="mx-auto max-w-[48rem]"
        enableGutter={false}
      />
    ),
    code: ({ node }) => <CodeBlock className="col-start-2" {...node.fields} />,
    cta: ({ node }) => <CallToActionBlock {...node.fields} />,
    map: ({ node }) => (
      <MapBlock className="col-start-1 col-span-3 my-8 not-prose w-full" {...node.fields} />
    ),
    // Legacy Lexical Location embeds → map-only
    location: ({ node }) => {
      const { address, mapEmbedUrl, title } = node.fields
      if (!address) return null
      return (
        <div className="col-start-1 col-span-3">
          <LocationBlock
            title={title ?? undefined}
            address={address}
            mapEmbedUrl={mapEmbedUrl ?? undefined}
            mapOnly
          />
        </div>
      )
    },
  },
})

type Props = {
  data: DefaultTypedEditorState
  enableGutter?: boolean
  enableProse?: boolean
  disableTextAlign?: boolean | string[]
} & React.HTMLAttributes<HTMLDivElement>

/** Client-safe rich text (forms, captions). Does not render Event checkout embeds. */
export default function ClientRichText(props: Props) {
  const { className, enableProse = true, enableGutter = true, ...rest } = props
  return (
    <ConvertRichText
      converters={clientSafeJsxConverters}
      className={cn(
        'payload-richtext',
        {
          container: enableGutter,
          'max-w-none': !enableGutter,
          'mx-auto prose dark:prose-invert': enableProse,
        },
        className,
      )}
      {...rest}
    />
  )
}

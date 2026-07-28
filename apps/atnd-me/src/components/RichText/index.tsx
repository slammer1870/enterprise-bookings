import {
  type DefaultTypedEditorState,
  type SerializedBlockNode,
} from '@payloadcms/richtext-lexical'
import {
  JSXConvertersFunction,
  RichText as ConvertRichText,
} from '@payloadcms/richtext-lexical/react'

import { EventCheckoutBlock } from '@/blocks/EventCheckout/Component'
import { GiftVoucherCheckoutBlock } from '@/blocks/GiftVoucherCheckout/Component'
import {
  clientSafeJsxConverters,
  type ClientSafeNodeTypes,
} from '@/components/RichText/Client'

import type {
  EventCheckoutBlock as EventCheckoutBlockProps,
  GiftVoucherCheckoutBlock as GiftVoucherCheckoutBlockProps,
} from '@/payload-types'
import { cn } from '@/utilities/ui'

type NodeTypes =
  | ClientSafeNodeTypes
  | SerializedBlockNode<EventCheckoutBlockProps | GiftVoucherCheckoutBlockProps>

const jsxConverters: JSXConvertersFunction<NodeTypes> = (args) => {
  const base = clientSafeJsxConverters(args as Parameters<typeof clientSafeJsxConverters>[0])
  return {
    ...base,
    blocks: {
      ...base.blocks,
      eventCheckout: ({ node }) => (
        <EventCheckoutBlock className="col-start-1 col-span-3 my-8 not-prose" {...node.fields} />
      ),
      giftVoucherCheckout: ({ node }) => (
        <GiftVoucherCheckoutBlock
          className="col-start-1 col-span-3 my-8 not-prose py-0"
          {...node.fields}
        />
      ),
    },
  }
}

type Props = {
  data: DefaultTypedEditorState
  enableGutter?: boolean
  enableProse?: boolean
  disableTextAlign?: boolean | string[]
} & React.HTMLAttributes<HTMLDivElement>

/** Server rich text — includes Event checkout and Gift voucher embeds. Use ClientRichText from client components. */
export default function RichText(props: Props) {
  const { className, enableProse = true, enableGutter = true, ...rest } = props
  return (
    <ConvertRichText
      converters={jsxConverters}
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

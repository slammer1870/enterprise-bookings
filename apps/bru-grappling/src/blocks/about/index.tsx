import { SerializedEditorState } from '@payloadcms/richtext-lexical/lexical'
import { RichText } from '@payloadcms/richtext-lexical/react'
import Image from "next/legacy/image"

export const AboutBlock: React.FC<{
  sections: {
    title: string
    content: SerializedEditorState
    image: {
      url: string
      width: number
      height: number
    }
    imagePosition: 'left' | 'right'
  }[]
}> = ({ sections }) => {
  return (
    <>
      {sections.map((section, index) => (
        <section
          key={index}
          className="relative flex flex-col items-center justify-center py-20 lg:min-h-screen lg:flex-row"
        >
          <div
            className={`container mx-auto mb-12 px-4 ${section.imagePosition === 'right' ? '' : 'lg:ml-auto'}`}
          >
            <div
              className={`${section.imagePosition === 'right' ? 'lg:mr-auto' : 'lg:ml-auto'} lg:w-2/5`}
            >
              <div>
                <h3 className="mb-8 text-2xl font-medium uppercase text-gray-800 lg:text-3xl">
                  {section.title}
                </h3>
                <RichText data={section.content} className="prose prose-a:text-blue-500" />
              </div>
            </div>
          </div>
          <div
            className={`lg:top-0 ${section.imagePosition === 'right' ? 'ml-auto lg:right-0' : 'mr-auto lg:left-0'} w-2/3 lg:absolute lg:w-2/5 2xl:w-auto`}
          >
            <div>
              <Image
                src={section.image.url}
                width={section.image.width}
                height={section.image.height}
                objectFit="cover"
                alt={section.title}
              />
            </div>
          </div>
        </section>
      ))}
    </>
  )
}

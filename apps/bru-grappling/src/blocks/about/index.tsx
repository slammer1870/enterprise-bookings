import { SerializedEditorState } from '@payloadcms/richtext-lexical/lexical'
import { RichText } from '@payloadcms/richtext-lexical/react'
import Image from 'next/image'

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
          <div className={`container mx-auto mb-12 px-4 ${section.imagePosition === 'left' ? 'lg:flex' : ''}`}>
            <div className={`${section.imagePosition === 'left' ? 'lg:ml-auto lg:w-2/3 xl:w-auto' : ''}`}>
              <h3 className="mb-8 text-2xl font-medium uppercase text-gray-800 lg:text-3xl">
                {section.title}
              </h3>
              <RichText data={section.content} className="prose prose-a:text-blue-500 [&_p]:mb-4 [&_p]:lg:text-xl" />
            </div>
          </div>
          <div
            className={`lg:top-50 w-2/3 lg:absolute lg:w-1/3 2xl:w-auto ${
              section.imagePosition === 'right' 
                ? 'ml-auto lg:right-0' 
                : 'mr-auto lg:left-0'
            }`}
          >
            <div>
              <Image
                src={section.image.url}
                width={section.image.width}
                height={section.image.height}
                alt={section.title}
                style={{
                  objectFit: 'cover',
                }}
              />
            </div>
          </div>
        </section>
      ))}
    </>
  )
}

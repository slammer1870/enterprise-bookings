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
          className="relative flex flex-col items-center justify-center py-20 lg:min-h-screen lg:flex-row overflow-hidden"
        >
          <div
            className={`container mx-auto mb-12 px-4 lg:mb-0 lg:relative lg:z-10 ${
              section.imagePosition === 'left' 
                ? 'lg:flex lg:order-2 lg:pl-[calc(33.333%+2rem)] lg:pr-4' 
                : 'lg:order-1 lg:pr-[calc(33.333%+2rem)] lg:pl-4'
            }`}
          >
            <div
              className={`${section.imagePosition === 'left' ? 'lg:ml-auto lg:w-2/3 xl:w-auto' : ''}`}
            >
              <h3 className="mb-8 text-2xl font-medium uppercase text-gray-800 lg:text-3xl">
                {section.title}
              </h3>
              <RichText
                data={section.content}
                className="prose prose-a:text-blue-500 [&_p]:mb-4 [&_p]:lg:text-xl [&_ul]:list-disc [&_ul]:pl-6 [&_ul_li]:my-2 [&_ol]:list-decimal [&_ol]:pl-6 [&_ol_li]:my-2"
              />
            </div>
          </div>
          <div
            className={`w-2/3 lg:absolute lg:w-1/3 2xl:w-auto lg:h-full lg:z-0 lg:top-0 ${
              section.imagePosition === 'right' 
                ? 'mr-0 ml-auto lg:right-0' 
                : 'ml-0 mr-auto lg:left-0'
            }`}
          >
            <div className="relative overflow-hidden w-full h-full">
              <Image
                src={section.image.url}
                width={section.image.width}
                height={section.image.height}
                alt={section.title}
                className="h-auto w-full object-cover lg:h-full"
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

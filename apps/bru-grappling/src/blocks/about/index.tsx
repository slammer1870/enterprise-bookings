import Image from 'next/image'

export const AboutBlock: React.FC<{
  sections: {
    title: string
    content: Array<{
      text: string
      link?: {
        url: string
        text: string
      }
    }>
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
            <h3 className="mb-8 text-2xl font-medium uppercase text-gray-800 lg:text-3xl">
              {section.title}
            </h3>
            {section.content.map((content, contentIndex) => (
              <p key={contentIndex} className="mb-4 lg:text-xl">
                {content.text}
                {content.link && (
                  <a
                    href={content.link.url}
                    target="_blank"
                    rel="noreferrer"
                    className="text-sky-500 underline"
                  >
                    {content.link.text}
                  </a>
                )}
              </p>
            ))}
          </div>
          <div
            className={`lg:top-50 ${section.imagePosition === 'right' ? 'ml-auto lg:right-0' : 'mr-auto lg:left-0'} w-2/3 lg:absolute lg:w-1/3 2xl:w-auto`}
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

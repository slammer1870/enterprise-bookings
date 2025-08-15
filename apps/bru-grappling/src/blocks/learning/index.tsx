import Image from "next/legacy/image"

export const LearningBlock: React.FC<{
  title: string
  content: string[]
  image: {
    url: string
    alt: string
  }
}> = ({ title, content, image }) => {
  return (
    <section className="py-20">
      <div className="container mx-auto items-center justify-between px-4 lg:flex">
        <div className="mb-12 pr-4 lg:mb-0">
          <h3 className="mb-8 text-2xl font-medium uppercase text-gray-800 lg:text-3xl">{title}</h3>
          {content.map((text, index) => (
            <p key={index} className="mb-4 lg:text-xl">
              {text}
            </p>
          ))}
        </div>
        <div className="relative aspect-video h-full lg:h-72 2xl:h-96">
          <Image src={image.url} layout="fill" objectFit="cover" alt={image.alt} />
        </div>
      </div>
    </section>
  )
}

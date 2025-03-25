import React from 'react'

type Video = {
  youtubeId: string
}

type TestimonialsProps = {
  title: string
  description: string
  videos: Video[]
}

export const TestimonialsBlock: React.FC<TestimonialsProps> = ({
  title = 'Testimonials',
  description = "Here's what some of our members have to say.",
  videos = [],
}) => {
  return (
    <section>
      <div className="container mx-auto px-4 py-12 text-gray-900">
        <div className="mb-4 flex w-full flex-col">
          <h5 className="mb-4 text-3xl font-medium uppercase">{title}</h5>
          <p className="text-base leading-relaxed">{description}</p>
        </div>
        <div className="grid grid-cols-1 grid-rows-2 gap-4 md:grid-cols-2 md:grid-rows-1">
          {videos.map((video, index) => (
            <div
              key={index}
              className="mx-auto aspect-video h-full w-full max-w-screen-md opacity-100"
            >
              <iframe
                src={`https://www.youtube.com/embed/${video.youtubeId}`}
                frameBorder="0"
                allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture"
                allowFullScreen
                className="h-full w-full rounded-lg"
              ></iframe>
            </div>
          ))}
        </div>
      </div>
    </section>
  )
}

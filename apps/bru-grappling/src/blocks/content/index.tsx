interface ContentBlockProps {
  title: string
}

export const ContentBlock = (props: ContentBlockProps) => {
  const { title } = props

  return (
    <div>
      HeroBlock
      <h1>{title}</h1>
    </div>
  )
}

interface HeroBlockProps {
  title: string
}

export const HeroBlock = (props: HeroBlockProps) => {
  const { title } = props

  return (
    <div>
      HeroBlock
      <h1>{title}</h1>
    </div>
  )
}

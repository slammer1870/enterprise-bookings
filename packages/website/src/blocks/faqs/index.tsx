import {
  Accordion,
  AccordionItem,
  AccordionTrigger,
  AccordionContent,
} from '@repo/ui/components/ui/accordion'

interface FaqsBlockProps {
  title?: string
  faqs: {
    question: string
    answer: string
  }[]
}

export const FaqsBlock = (props: FaqsBlockProps) => {
  const { title = 'FAQs', faqs } = props

  const contentElement = (
    <>
      <h2 className="text-3xl font-bold mb-6 text-center">{title}</h2>
      <Accordion type="single" collapsible className="w-full">
        {faqs.map((faq) => (
          <AccordionItem key={faq.question} value={faq.question}>
            <AccordionTrigger>{faq.question}</AccordionTrigger>
            <AccordionContent>{faq.answer}</AccordionContent>
          </AccordionItem>
        ))}
      </Accordion>
    </>
  )

  return (
    <section className="container py-12">
      <div className="max-w-3xl mx-auto">
        {contentElement}
      </div>
    </section>
  )
}

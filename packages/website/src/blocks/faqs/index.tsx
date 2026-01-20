import {
  Accordion,
  AccordionItem,
  AccordionTrigger,
  AccordionContent,
} from '@repo/ui/components/ui/accordion'

interface FaqsBlockProps {
  faqs: {
    question: string
    answer: string
  }[]
  disableInnerContainer?: boolean
}

export const FaqsBlock = (props: FaqsBlockProps) => {
  const { faqs, disableInnerContainer } = props

  const contentElement = (
    <>
      <h2 className="text-3xl font-bold mb-6 text-center">Frequently Asked Questions</h2>
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

  if (disableInnerContainer) {
    return (
      <section className="w-full py-12">
        <div className="max-w-6xl mx-auto px-4">{contentElement}</div>
      </section>
    )
  }

  return (
    <section className="container py-12">
      <div className="max-w-3xl mx-auto px-4">
        {contentElement}
      </div>
    </section>
  )
}

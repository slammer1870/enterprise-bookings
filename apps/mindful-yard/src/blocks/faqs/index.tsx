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
}

export const FaqsBlock = (props: FaqsBlockProps) => {
  const { faqs } = props
  return (
    <div className="max-w-screen-sm mx-auto p-6">
      <h2 className="text-2xl font-medium text-center mb-4">Frequently Asked Questions</h2>
      <Accordion type="single" collapsible className="w-full">
        {faqs.map((faq) => (
          <AccordionItem key={faq.question} value={faq.question}>
            <AccordionTrigger>{faq.question}</AccordionTrigger>
            <AccordionContent>{faq.answer}</AccordionContent>
          </AccordionItem>
        ))}
      </Accordion>
    </div>
  )
}

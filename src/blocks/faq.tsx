import { Plus } from 'lucide-react';

import { m } from '@/paraglide/messages.js';

export function FAQ() {
  const items = [
    {
      question: m['svgai.marketing.faq_input_question'](),
      answer: m['svgai.marketing.faq_input_answer'](),
    },
    {
      question: m['svgai.marketing.faq_paths_question'](),
      answer: m['svgai.marketing.faq_paths_answer'](),
    },
    {
      question: m['svgai.marketing.faq_formats_question'](),
      answer: m['svgai.marketing.faq_formats_answer'](),
    },
    {
      question: m['svgai.marketing.faq_privacy_question'](),
      answer: m['svgai.marketing.faq_privacy_answer'](),
    },
    {
      question: m['svgai.marketing.faq_tools_question'](),
      answer: m['svgai.marketing.faq_tools_answer'](),
    },
  ];
  return (
    <section id="faq" className="svgai-container svgai-faq">
      <div className="svgai-section-intro">
        <h2>{m['svgai.marketing.faq_title']()}</h2>
        <p>{m['svgai.marketing.faq_description']()}</p>
      </div>
      <div className="svgai-faq-items">
        {items.map((item) => (
          <details key={item.question} className="svgai-faq-item">
            <summary>
              <span>{item.question}</span>
              <Plus size={18} strokeWidth={1.4} aria-hidden="true" />
            </summary>
            <p>{item.answer}</p>
          </details>
        ))}
      </div>
    </section>
  );
}

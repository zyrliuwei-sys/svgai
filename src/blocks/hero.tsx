import type { SvgGeneratorCopy, SvgMode } from '@/types/svg-generator';
import { Sparkles } from 'lucide-react';

import { m } from '@/paraglide/messages.js';
import { getSvgSamples } from '@/blocks/svg-sample-content';
import { SvgGenerator } from '@/components/svg-generator';

export function Hero({
  mode = 'text',
  page = 'home',
}: {
  mode?: SvgMode;
  page?: 'home' | 'text' | 'image';
}) {
  const samples = getSvgSamples();
  const copy: SvgGeneratorCopy = {
    trial_used: m['svgai.trial.used'](),
    trial_failed: m['svgai.trial.failed'](),
    trial_free_note: m['svgai.trial.free_note'](),
    trial_used_note: m['svgai.trial.used_note'](),
    trial_preview_label: m['svgai.trial.preview_label'](),
    trial_badge: m['svgai.trial.badge'](),
    trial_paywall_title: m['svgai.trial.paywall_title'](),
    trial_paywall_description: m['svgai.trial.paywall_description'](),
    trial_paywall_cta: m['svgai.trial.paywall_cta'](),
    trial_paywall_close: m['svgai.trial.paywall_close'](),
    trial_unlock: m['svgai.trial.unlock'](),
    trial_unlocking: m['svgai.trial.unlocking'](),
    trial_generated: m['svgai.trial.generated'](),
    trial_generate: m['svgai.trial.generate'](),
    trial_continue: m['svgai.trial.continue'](),
    trial_image_paid_note: m['svgai.trial.image_paid_note'](),
    trial_feature_download: m['svgai.trial.feature_download'](),
    trial_feature_once: m['svgai.trial.feature_once'](),
    sign_in_required: m['svgai.generator.sign_in_required'](),
    credits_reserved: m['svgai.generator.credits_reserved'](),
    credit_note: m['svgai.generator.credit_note'](),
    credits_available: m['svgai.generator.credits_available'](),
    availability_loading: m['svgai.generator.availability_loading'](),
    balance_loading: m['svgai.generator.balance_loading'](),
    balance_error: m['svgai.generator.balance_error'](),
    credits_used: m['svgai.generator.credits_used'](),
    get_credits: m['svgai.generator.get_credits'](),
    resume_generation: m['svgai.generator.resume_generation'](),
    still_processing: m['svgai.generator.still_processing'](),
    top_up_required: m['svgai.generator.top_up_required'](),
    failed_refunded: m['svgai.generator.failed_refunded'](),
    text_tab: m['svgai.generator.text_tab'](),
    image_tab: m['svgai.generator.image_tab'](),
    input_modes: m['svgai.generator.input_modes'](),
    prompt_label: m['svgai.generator.prompt_label'](),
    prompt_placeholder: m['svgai.generator.prompt_placeholder'](),
    try_prompt: m['svgai.generator.try_prompt'](),
    style_label: m['svgai.generator.style_label'](),
    style_illustration: m['svgai.generator.style_illustration'](),
    style_icon: m['svgai.generator.style_icon'](),
    style_logo: m['svgai.generator.style_logo'](),
    'style_line-art': m['svgai.generator.style_line_art'](),
    aspect_label: m['svgai.generator.aspect_label'](),
    aspect_square: m['svgai.generator.aspect_square'](),
    aspect_landscape: m['svgai.generator.aspect_landscape'](),
    aspect_portrait: m['svgai.generator.aspect_portrait'](),
    generate: m['svgai.generator.generate'](),
    vectorize: m['svgai.generator.vectorize'](),
    generating: m['svgai.generator.generating'](),
    text_note: m['svgai.generator.text_note'](),
    image_note: m['svgai.generator.image_note'](),
    output_modes: m['svgai.generator.output_modes'](),
    view_preview: m['svgai.generator.view_preview'](),
    view_outline: m['svgai.generator.view_outline'](),
    view_code: m['svgai.generator.view_code'](),
    sample_label: m['svgai.generator.sample_label'](),
    result_label: m['svgai.generator.result_label'](),
    svg_code: m['svgai.generator.svg_code'](),
    preview_alt: m['svgai.generator.preview_alt'](),
    zoom_out: m['svgai.generator.zoom_out'](),
    zoom_in: m['svgai.generator.zoom_in'](),
    reset_zoom: m['svgai.generator.reset_zoom'](),
    palette_label: m['svgai.generator.palette_label'](),
    edit_color: m['svgai.generator.edit_color'](),
    paths: m['svgai.generator.paths'](),
    copy_svg: m['svgai.generator.copy_svg'](),
    copy_code: m['svgai.generator.copy_code'](),
    copied: m['svgai.generator.copied'](),
    download: m['svgai.generator.download'](),
    image_label: m['svgai.generator.image_label'](),
    remove_image: m['svgai.generator.remove_image'](),
    uploaded_image: m['svgai.generator.uploaded_image'](),
    change_image: m['svgai.generator.change_image'](),
    drop_title: m['svgai.generator.drop_title'](),
    drop_subtitle: m['svgai.generator.image_paste'](),
    browse_files: m['svgai.generator.browse_files'](),
    colors_label: m['svgai.generator.colors_label'](),
    colors_unit: m['svgai.generator.colors_unit'](),
    remove_background: m['svgai.generator.remove_background'](),
    upload_required: m['svgai.generator.upload_required'](),
    invalid_file: m['svgai.generator.invalid_file'](),
    file_too_large: m['svgai.generator.file_too_large'](),
    prompt_required: m['svgai.generator.prompt_required'](),
    generation_error: m['svgai.generator.generation_error'](),
    copy_error: m['svgai.generator.copy_error'](),
    model_unavailable: m['svgai.generator.model_unavailable'](),
    success: m['svgai.generator.success'](),
    expand_preview: m['svgai.generator.expand_preview'](),
    expanded_title: m['svgai.generator.expanded_title'](),
    close_preview: m['svgai.generator.close_preview'](),
    expanded_description: m['svgai.generator.expanded_description'](),
  };
  return (
    <section id="generator" className="svg-hero svgai-container">
      <div className="svg-hero-intro">
        <div className="svg-hero-kicker">
          <Sparkles size={12} strokeWidth={1.6} />
          {m['svgai.hero.eyebrow']()}
        </div>
        <h1 className="svgai-display">
          {page === 'home'
            ? m['svgai.hero.title_start']()
            : page === 'text'
              ? m['svgai.inner.text.heading']()
              : m['svgai.inner.image.heading']()}{' '}
          <em>
            {page === 'home'
              ? m['svgai.hero.title_end']()
              : page === 'text'
                ? m['svgai.inner.text.emphasis']()
                : m['svgai.inner.image.emphasis']()}
          </em>
        </h1>
        <p>
          {page === 'home'
            ? m['svgai.hero.subtitle']()
            : page === 'text'
              ? m['svgai.inner.text.subtitle']()
              : m['svgai.inner.image.subtitle']()}
        </p>
      </div>
      <SvgGenerator
        comparisonCopy={{
          color: m['svgai.gallery.color'](),
          outline: m['svgai.gallery.outline'](),
          hint: m['svgai.compare.hint'](),
          label: (title) => m['svgai.compare.label']({ title }),
          valueText: (percent) =>
            m['svgai.compare.value']({
              color: percent,
              outline: 100 - percent,
            }),
        }}
        key={mode}
        copy={copy}
        samples={samples}
        initialMode={mode}
        formatTrialCredits={(credits) =>
          m['svgai.trial.paywall_credits']({ credits })
        }
      />
    </section>
  );
}

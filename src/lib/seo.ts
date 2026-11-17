import { envConfigs } from '@/config';
import { SITE_IMAGE, SITE_URL } from '@/config/site';

export function productPageHead({
  path,
  title,
  description,
  breadcrumb,
  application = false,
  image = SITE_IMAGE,
  article,
}: {
  path: string;
  title: string;
  description: string;
  breadcrumb?: string;
  application?: boolean;
  image?: string;
  article?: { publishedAt: string; author?: string };
}) {
  const appName = envConfigs.app_name;
  const url = new URL(path, SITE_URL).href;
  const data: Record<string, unknown>[] = [
    {
      '@type': 'WebSite',
      '@id': `${SITE_URL}/#website`,
      url: SITE_URL,
      name: appName,
      inLanguage: 'en',
    },
    {
      '@type': 'WebPage',
      '@id': `${url}#page`,
      url,
      name: title,
      description,
      inLanguage: 'en',
      isPartOf: { '@id': `${SITE_URL}/#website` },
    },
  ];
  if (application)
    data.push({
      '@type': 'WebApplication',
      name: appName,
      url,
      applicationCategory: 'DesignApplication',
      operatingSystem: 'Web browser',
      description,
      browserRequirements: 'Requires JavaScript and a modern web browser.',
    });
  if (breadcrumb)
    data.push({
      '@type': 'BreadcrumbList',
      itemListElement: [
        { '@type': 'ListItem', position: 1, name: appName, item: SITE_URL },
        { '@type': 'ListItem', position: 2, name: breadcrumb, item: url },
      ],
    });
  if (article)
    data.push({
      '@type': 'BlogPosting',
      headline: title,
      description,
      datePublished: article.publishedAt,
      image,
      mainEntityOfPage: { '@id': `${url}#page` },
      ...(article.author
        ? { author: { '@type': 'Person', name: article.author } }
        : {}),
    });
  return {
    meta: [
      { title },
      { name: 'description', content: description },
      { property: 'og:title', content: title },
      { property: 'og:description', content: description },
      { property: 'og:type', content: article ? 'article' : 'website' },
      { property: 'og:site_name', content: appName },
      { property: 'og:url', content: url },
      { property: 'og:image', content: image },
      { property: 'og:image:alt', content: title },
      ...(image === SITE_IMAGE
        ? [
            { property: 'og:image:width', content: '1200' },
            { property: 'og:image:height', content: '630' },
          ]
        : []),
      { name: 'twitter:card', content: 'summary_large_image' },
      { name: 'twitter:title', content: title },
      { name: 'twitter:description', content: description },
      { name: 'twitter:image', content: image },
    ],
    links: [
      { rel: 'canonical', href: url },
      { rel: 'alternate', hrefLang: 'en', href: url },
      { rel: 'alternate', hrefLang: 'x-default', href: url },
    ],
    scripts: [
      {
        type: 'application/ld+json',
        children: JSON.stringify({
          '@context': 'https://schema.org',
          '@graph': data,
        }).replace(/</g, '\\u003c'),
      },
    ],
  };
}

import { MetadataRoute } from 'next';

const locales = ['en', 'ko', 'ja', 'zh', 'es', 'fr', 'de', 'pt'];
const baseUrl = 'https://space.raondr.com';

export default function sitemap(): MetadataRoute.Sitemap {
  const routes = locales.flatMap((locale) => [
    {
      url: `${baseUrl}/${locale}`,
      lastModified: new Date(),
      changeFrequency: 'daily' as const,
      priority: 1.0,
    },
    {
      url: `${baseUrl}/${locale}/privacy`,
      lastModified: new Date(),
      changeFrequency: 'monthly' as const,
      priority: 0.5,
    },
  ]);

  return [
    {
      url: baseUrl,
      lastModified: new Date(),
      changeFrequency: 'daily',
      priority: 1.0,
    },
    ...routes,
  ];
}

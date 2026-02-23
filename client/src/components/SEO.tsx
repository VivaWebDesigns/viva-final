import { Helmet } from "react-helmet-async";

interface SEOProps {
  title: string;
  description: string;
  path?: string;
}

export default function SEO({ title, description, path = "/" }: SEOProps) {
  const fullTitle = `${title} | Viva Web Designs`;
  const url = `https://vivawebdesigns.com${path}`;

  return (
    <Helmet>
      <title>{fullTitle}</title>
      <meta name="description" content={description} />
      <meta property="og:title" content={fullTitle} />
      <meta property="og:description" content={description} />
      <meta property="og:url" content={url} />
      <meta property="og:type" content="website" />
      <link rel="canonical" href={url} />
    </Helmet>
  );
}

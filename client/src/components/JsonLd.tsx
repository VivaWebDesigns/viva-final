import { Helmet } from "react-helmet-async";

export const vivaOrganizationSchema = {
  "@context": "https://schema.org",
  "@type": "Organization",
  "@id": "https://vivawebdesigns.com",
  name: "Viva Web Designs",
  description:
    "Digital marketing agency for contractors. Professional websites, local SEO, and Google positioning.",
  url: "https://vivawebdesigns.com",
  telephone: "+1-980-475-4924",
  email: "matt@vivawebdesigns.com",
  image: "https://vivawebdesigns.com/logo.png",
  address: {
    "@type": "PostalAddress",
    addressLocality: "Charlotte",
    addressRegion: "NC",
    addressCountry: "US",
  },
  areaServed: {
    "@type": "Country",
    name: "United States",
  },
  sameAs: [
    "https://www.facebook.com/vivawebdesigns",
    "https://www.instagram.com/vivawebdesigns",
    "https://www.tiktok.com/@vivawebdesigns",
  ],
};

export default function JsonLd() {
  return (
    <Helmet>
      <script type="application/ld+json">{JSON.stringify(vivaOrganizationSchema)}</script>
    </Helmet>
  );
}

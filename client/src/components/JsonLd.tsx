import { Helmet } from "react-helmet-async";

export const vivaLocalBusinessSchema = {
  "@context": "https://schema.org",
  "@type": "LocalBusiness",
  "@id": "https://vivawebdesigns.com",
  name: "Viva Web Designs",
  description:
    "Digital marketing agency for contractors. Professional websites, local SEO, and Google positioning.",
  url: "https://vivawebdesigns.com",
  telephone: "+1-980-475-4924",
  email: "matt@vivawebdesigns.com",
  image: "https://vivawebdesigns.com/logo.png",
  priceRange: "$497 - $1,997",
  address: {
    "@type": "PostalAddress",
    streetAddress: "1628 Redcoat Dr",
    addressLocality: "Charlotte",
    addressRegion: "NC",
    postalCode: "28211",
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
  openingHoursSpecification: [
    {
      "@type": "OpeningHoursSpecification",
      dayOfWeek: [
        "Monday",
        "Tuesday",
        "Wednesday",
        "Thursday",
        "Friday",
      ],
      opens: "08:00",
      closes: "18:00",
    },
    {
      "@type": "OpeningHoursSpecification",
      dayOfWeek: "Saturday",
      opens: "10:00",
      closes: "16:00",
    },
  ],
};

export default function JsonLd() {
  return (
    <Helmet>
      <script type="application/ld+json">{JSON.stringify(vivaLocalBusinessSchema)}</script>
    </Helmet>
  );
}

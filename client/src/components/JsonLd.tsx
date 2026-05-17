import { Helmet } from "react-helmet-async";

export default function JsonLd() {
  const schema = {
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
      streetAddress: "[Address]",
      addressLocality: "[City]",
      addressRegion: "[State]",
      postalCode: "[ZIP Code]",
      addressCountry: "US",
    },
    areaServed: {
      "@type": "Place",
      name: "[City / Service Area]",
    },
    sameAs: [
      "https://www.facebook.com/vivawebdesigns",
      "https://www.instagram.com/vivawebdesigns",
      "https://www.tiktok.com/@vivawebdesigns",
    ],
    openingHoursSpecification: {
      "@type": "OpeningHoursSpecification",
      dayOfWeek: [
        "Monday",
        "Tuesday",
        "Wednesday",
        "Thursday",
        "Friday",
      ],
      opens: "09:00",
      closes: "18:00",
    },
  };

  return (
    <Helmet>
      <script type="application/ld+json">{JSON.stringify(schema)}</script>
    </Helmet>
  );
}

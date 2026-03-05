import { Helmet } from "react-helmet-async";

export default function JsonLd() {
  const schema = {
    "@context": "https://schema.org",
    "@type": "LocalBusiness",
    "@id": "https://vivawebdesigns.com",
    name: "Viva Web Designs",
    description:
      "Agencia de marketing digital especializada en contratistas. Sitios web profesionales, SEO local y posicionamiento en Google.",
    url: "https://vivawebdesigns.com",
    telephone: "+1-980-949-0548",
    email: "info@vivawebdesigns.com",
    image: "https://vivawebdesigns.com/logo.png",
    priceRange: "$497 - $1,997",
    address: {
      "@type": "PostalAddress",
      streetAddress: "[Dirección]",
      addressLocality: "[Ciudad]",
      addressRegion: "[Estado]",
      postalCode: "[Código Postal]",
      addressCountry: "US",
    },
    areaServed: {
      "@type": "Place",
      name: "[Ciudad / Área de servicio]",
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

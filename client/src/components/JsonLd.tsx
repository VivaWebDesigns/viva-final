import { Helmet } from "react-helmet-async";
import { vivaOrganizationSchema } from "./vivaOrganizationSchema";

export default function JsonLd() {
  return (
    <Helmet>
      <script type="application/ld+json">{JSON.stringify(vivaOrganizationSchema)}</script>
    </Helmet>
  );
}

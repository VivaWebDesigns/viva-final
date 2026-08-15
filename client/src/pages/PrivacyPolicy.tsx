import SEO from "@/components/SEO";
import { PrivacyPolicyContent } from "@/components/PrivacyPolicyModal";

export default function PrivacyPolicy() {
  return (
    <div className="bg-white min-h-screen pt-28 sm:pt-32 pb-20">
      <SEO
        title="Privacy Policy"
        description="Learn how Viva Web Designs LLC collects, uses, protects, and handles personal and mobile information."
        path="/privacy-policy"
      />
      <article className="max-w-3xl mx-auto px-4 sm:px-6 lg:px-8">
        <PrivacyPolicyContent standalone />
      </article>
    </div>
  );
}

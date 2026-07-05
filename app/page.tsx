import AppClient from "./AppClient";
import { SITE_URL } from "@/lib/site-url";

const homeJsonLd = {
  "@context": "https://schema.org",
  "@graph": [
    {
      "@type": "Organization",
      name: "Maskan",
      url: SITE_URL,
      logo: `${SITE_URL}/maskan-logo.png`,
    },
    {
      "@type": "WebSite",
      name: "Maskan",
      url: SITE_URL,
      inLanguage: ["ru", "uz", "en"],
    },
  ],
};

export default function Home() {
  return (
    <>
      <script type="application/ld+json" dangerouslySetInnerHTML={{ __html: JSON.stringify(homeJsonLd).replace(/</g, "\\u003c") }} />
      <AppClient />
    </>
  );
}

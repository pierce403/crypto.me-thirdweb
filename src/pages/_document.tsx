import { Head, Html, Main, NextScript } from 'next/document';

// OpenNext can preserve esbuild's __name calls inside next-themes' serialized
// bootstrap without emitting the helper, so define it before any page scripts.
const cloudflareInlineNameHelper =
  'window.__name=window.__name||function(target,name){return Object.defineProperty(target,"name",{value:name,configurable:true})};';

export default function Document() {
  return (
    <Html lang="en" suppressHydrationWarning>
      <Head>
        <script
          id="cloudflare-inline-name-helper"
          data-cfasync="false"
          dangerouslySetInnerHTML={{ __html: cloudflareInlineNameHelper }}
        />
      </Head>
      <body>
        <Main />
        <NextScript />
      </body>
    </Html>
  );
}

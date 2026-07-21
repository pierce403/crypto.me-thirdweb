import React from 'react'
import { ChakraProvider, defaultSystem } from '@chakra-ui/react'
import type { AppProps } from 'next/app'
import { ColorModeProvider } from '../components/ColorMode'

function MyApp({ Component, pageProps }: AppProps) {
  return (
    <ChakraProvider value={defaultSystem}>
      <ColorModeProvider>
        <Component {...pageProps} />
      </ColorModeProvider>
    </ChakraProvider>
  )
}

export default MyApp

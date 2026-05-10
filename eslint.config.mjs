import { createRequire } from 'module'

const require = createRequire(import.meta.url)
const nextCoreWebVitals = require('eslint-config-next/core-web-vitals')

/** ESLint 9 flat config (next lint was removed in Next 16). */
const eslintConfig = [
  ...nextCoreWebVitals,
  {
    rules: {
      // React Hooks Compiler-oriented rules; project predates refactors they require.
      'react-hooks/static-components': 'off',
      'react-hooks/immutability': 'off',
      'react-hooks/set-state-in-effect': 'off',
      'react-hooks/purity': 'off',
    },
  },
]

export default eslintConfig

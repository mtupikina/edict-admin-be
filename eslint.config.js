const { plugin, flatConfigs, parser } = require('@typescript-eslint/eslint-plugin/use-at-your-own-risk/raw-plugin');
const eslintConfigPrettier = require('eslint-config-prettier');
const eslintPluginPrettier = require('eslint-plugin-prettier');

module.exports = [
  { ignores: ['dist/**', 'node_modules/**', 'eslint.config.js', '.eslintrc.js'] },
  ...flatConfigs['flat/recommended'],
  eslintConfigPrettier,
  {
    files: ['**/*.ts'],
    languageOptions: {
      parser,
      parserOptions: {
        project: './tsconfig.json',
        tsconfigRootDir: __dirname,
        sourceType: 'module',
      },
      globals: {
        node: 'readonly',
        jest: 'readonly',
      },
    },
    plugins: {
      prettier: eslintPluginPrettier,
    },
    rules: {
      ...eslintPluginPrettier.configs.recommended.rules,
      '@typescript-eslint/interface-name-prefix': 'off',
      '@typescript-eslint/explicit-function-return-type': 'off',
      '@typescript-eslint/explicit-module-boundary-types': 'off',
      '@typescript-eslint/no-explicit-any': 'warn',
      '@typescript-eslint/no-unused-vars': [
        'error',
        {
          args: 'all',
          argsIgnorePattern: '^_',
          varsIgnorePattern: '^_',
        },
      ],
    },
  },
];

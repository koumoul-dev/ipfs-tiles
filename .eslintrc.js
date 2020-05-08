module.exports = {
  root: true,
  parserOptions: {
    parser: 'babel-eslint',
    sourceType: 'module'
  },
  extends: [
    // https://github.com/feross/standard/blob/master/RULES.md#javascript-standard-style
    'standard',
    // https://github.com/vuejs/eslint-plugin-vue,
     'plugin:vue/recommended'
  ],
  plugins: ['vue', 'vuetify'],
  // add your custom rules here
  rules: {
    // This rule is required because atom vue-format package remove the space
    'space-before-function-paren': 0,
    'no-new': 'off',
    'vue/max-attributes-per-line': 'off',
    'no-template-curly-in-string': 'off',
    'vue/no-v-html': 'off'
  }
}

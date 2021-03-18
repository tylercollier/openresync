// I initially got this content from: https://github.com/forsartis/vue-cli-plugin-tailwind/issues/32#issuecomment-763985410
// It was helpful in knowing which specific npm modules to install including postcss.

module.exports = {
  purge: { content: ['./public/**/*.html', './src/**/*.vue'] },
  variants: {
    extend: {
      backgroundColor: ['active'],
      outline: ['focus-visible'],
    },
  },
}

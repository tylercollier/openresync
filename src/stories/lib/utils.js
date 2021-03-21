function makeStory(Template, args) {
  const story = Template.bind({})
  story.args = args
  story.loaders = [
    async () => {
      console.log('im here')
      return {
        x: await new Promise(resolve => setTimeout(() => resolve('hello'), 2000)),
      }
    },
  ]
  return story
}

module.exports = {
  makeStory,
}

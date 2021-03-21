function makeStory(Template, args, context) {
  const story = Template.bind({})
  story.args = args
  if (context) {
    story.loaders = context.loaders
  }
  return story
}

module.exports = {
  makeStory,
}

function makeStory(Template, args) {
  const story = Template.bind({})
  story.args = args
  return story
}

module.exports = {
  makeStory,
}

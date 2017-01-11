bespoke.from('article', [
  bespoke.plugins.keys(),
  bespoke.plugins.touch(),
  bespoke.plugins.markdownIt({}, [window.markdownitDeflist]),
  bespoke.plugins.classes(),
  bespoke.plugins.progress()
]);

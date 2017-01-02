bespoke.from('article', [
  bespoke.plugins.keys(),
  bespoke.plugins.touch(),
  bespoke.plugins.markdownIt(),
  bespoke.plugins.classes(),
  bespoke.plugins.progress()
]);

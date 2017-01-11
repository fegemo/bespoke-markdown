var bespoke = require('bespoke')
  keys = require('bespoke-keys'),
  touch = require('bespoke-touch'),
  markdownIt = require('../dist/bespoke-markdownit.min.js'),
  defList = require('markdown-it-deflist'),
  classes = require('bespoke-classes'),
  progress = require('bespoke-progress');

bespoke.from('article', [
  keys(),
  touch(),
  markdownIt({}, [defList]),
  classes(),
  progress()
]);

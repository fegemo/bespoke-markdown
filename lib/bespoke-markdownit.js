var isEmpty = require('lodash.isempty');
var isFunction = require('lodash.isfunction');
var hljs = require('highlight.js');
var md = require('markdown-it')({
  html:         true,        // Enable HTML tags in source
  xhtmlOut:     false,        // Use '/' to close single tags (<br />).
                              // This is only for full CommonMark compatibility.
  breaks:       false,        // Convert '\n' in paragraphs into <br>
  langPrefix:   'language-',  // CSS language prefix for fenced blocks. Can be
                              // useful for external highlighters.
  linkify:      true,        // Autoconvert URL-like text to links

  // Enable some language-neutral replacement + quotes beautification
  typographer:  true,

  // Double + single quotes replacement pairs, when typographer enabled,
  // and smartquotes on. Could be either a String or an Array.
  //
  // For example, you can use '«»„“' for Russian, '„“‚‘' for German,
  // and ['«\xA0', '\xA0»', '‹\xA0', '\xA0›'] for French (including nbsp).
  quotes: '“”‘’',

  // Highlighter function. Should return escaped HTML,
  // or '' if the source string is not changed and should be escaped externaly.
  // If result starts with <pre... internal wrapper is skipped.
  highlight: function (str, lang) {
    if (lang && hljs.getLanguage(lang)) {
      try {
        return '<pre class="hljs"><code>' +
               hljs.highlight(lang, str, true).value +
               '</code></pre>';
      } catch (__) {}
    }

    return '<pre class="hljs"><code>' + md.utils.escapeHtml(str) + '</code></pre>';
  }
});
var slideMetadata = {};

/**
 * Fetches the content of a file through AJAX.
 * @param {string} path the path of the file to fetch
 * @param {Function} callbackSuccess
 * @param {Function} callbackError
 */
var fetchFile = function(path, callbackSuccess, callbackError) {
  var xhr = new XMLHttpRequest();
  xhr.onreadystatechange = function() {
    if (xhr.readyState === 4) {
      if (xhr.status >= 200 && xhr.status < 300) {
        callbackSuccess(xhr.responseText);
      } else {
        callbackError();
      }
    }
  };
  xhr.open('GET', path, false);
  xhr.send();
};

var checkForMetadata = function(deck, slide, content) {
  var tempSlide = document.createElement('section');
  tempSlide.innerHTML = content;

  if (tempSlide.firstChild.nodeType === Node.COMMENT_NODE) {
    var slideIndex = deck.slides.indexOf(slide);
    try {
      var metadata = JSON.parse(tempSlide.firstChild.nodeValue.trim());
      slideMetadata['' + slideIndex] = metadata;
      return true;
    } catch (e) { }
    return false;
  }
};

var removeMetadata = function(slide) {
  slide.removeChild(slide.firstChild);
};

var callMetadata = function(deck, callbacks) {
  Object.keys(slideMetadata).forEach(function(slideIndex) {
    var metadata = slideMetadata[slideIndex];
    Object.keys(metadata).forEach(function(metadataFunctionName) {
      if (metadataFunctionName in callbacks) {
        var metadataParams = Array.isArray(metadata[metadataFunctionName]) ?
          metadata[metadataFunctionName].slice() :
          [metadata[metadataFunctionName]];
        metadataParams.unshift(deck.slides[parseInt(slideIndex)]);
        callbacks[metadataFunctionName].apply(deck, metadataParams);
      }
    });
  });
};

var markdownSlide = function(deck, slide, content) {
  var hadMetadata = checkForMetadata(deck, slide, content);
  slide.innerHTML = md.render(content);
  if (hadMetadata) {
    removeMetadata(slide);
  }
};

var createSlide = function(deck, slide) {
  var newSlide = document.createElement('section'),
      index;

  newSlide.className = 'bespoke-slide';
  if (typeof slide !== 'undefined' && slide instanceof HTMLElement) {
    deck.parent.insertBefore(newSlide, slide);
    index = deck.slides.indexOf(slide);
    deck.slides.splice(index, 0, newSlide);
  } else {
    deck.parent.appendChild(newSlide);
    deck.slides.push(newSlide);
  }

  return newSlide;
};

var removeSlide = function(deck, slide) {
  var slideIndex = deck.slides.indexOf(slide);
  deck.slides.splice(slideIndex, 1);
  deck.parent.removeChild(slide);
};

var slidify = function(deck, slide) {
  var markdownAttribute = slide.getAttribute('data-markdown');

  switch (true) {
    // data-markdown="path-to-file.md" (so we load the .md file)
    case markdownAttribute && markdownAttribute.trim() !== '':
      fetchFile(markdownAttribute.trim(), function(fileContents) {
        var slidesContent = fileContents.split(/\r?\n---+\r?\n/);
        slidesContent.forEach(function(slideContent) {
          var slideContainer = createSlide(deck, slide);
          markdownSlide(deck, slideContainer, slideContent);
        });

        // removes original slide
        removeSlide(deck, slide);

      }, function() {
        slide.innerHTML = 'Error loading the .md file for this slide.';
      });
      break;

    // data-markdown="" or data-markdown (so we markdown the content)
    case markdownAttribute !== null:
      markdownSlide(deck, slide, slide.innerHTML);
      break;

    // plain html slide. Don't do anything
    default:
      break;
  }
};

var processDeckForMarkdownAttributes = function(deck) {
  var markdownAttribute = deck.parent.getAttribute('data-markdown'),
      slide;

  if (markdownAttribute && markdownAttribute.trim()) {
    // <article data-markdown="...">
    // load the whole deck from md file
    // we create an initial slide with the same markdown attribute
    slide = createSlide(deck);
    slide.setAttribute('data-markdown', markdownAttribute);
  }

  // traverse slides to see which are html and which are md (data-markdown)
  deck.slides.forEach(function(slide) {
    slidify(deck, slide);
  });
};

/**
 * Checks whether we should consider for markdown rendering:
 * - elements with the attribute data-markdown, if at least one element has
 * that. It can be one or some slides or the parent object (full presentation).
 * - the content of all slides, if no element has data-markdown.
 */
var getPluginMode = function(deck) {
  var hasDataMarkdownAttribute,
      elements = [];

  elements.push(deck.parent);
  deck.slides.forEach(function(slide) {
    elements.push(slide);
  });
  hasDataMarkdownAttribute = elements.some(function(current) {
    return current.getAttribute('data-markdown') !== null;
  });

  return hasDataMarkdownAttribute ? 'transform-marked-elements-only' :
    'transform-content-of-all-slides';
};

module.exports = function(metadataCallbacks, pluginsArray) {
  metadataCallbacks = metadataCallbacks || {};
  slideMetadata = {};

  // installs the markdown-it plugins provided by the user
  pluginsArray = !!pluginsArray ?
    (
      Array.isArray(pluginsArray) ?
        pluginsArray :
        [pluginsArray]
    ) :
    [];
  pluginsArray.forEach(function(plugin) {
    if (isFunction(plugin)) {
      md.use(plugin);
    } else if (Array.isArray(plugin) && plugin.length > 0) {
      md.use.apply(md, plugin);
    }
  });

  return function(deck) {
    var mode = getPluginMode(deck);

    switch (mode) {
      case 'transform-marked-elements-only':
        processDeckForMarkdownAttributes(deck);
        break;
      case 'transform-content-of-all-slides':
        deck.slides.forEach(function(slideEl) {
          markdownSlide(deck, slideEl, slideEl.innerHTML);
        });
        break;
    }

    if (!isEmpty(metadataCallbacks) && !isEmpty(slideMetadata)) {
      callMetadata(deck, metadataCallbacks);
    }
  };
};

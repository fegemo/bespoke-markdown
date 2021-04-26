const isEmpty = require('lodash.isempty');
const isFunction = require('lodash.isfunction');
const markdownIt = require('markdown-it');
const hljs = require('highlight.js');

hljs.registerLanguage('php', require('highlight.js/lib/languages/php'));
hljs.registerLanguage('css', require('highlight.js/lib/languages/css'));
hljs.registerLanguage('cpp', require('highlight.js/lib/languages/cpp'));
hljs.registerLanguage('sql', require('highlight.js/lib/languages/sql'));
hljs.registerLanguage('xml', require('highlight.js/lib/languages/xml'));
hljs.registerLanguage('bash', require('highlight.js/lib/languages/bash'));
hljs.registerLanguage('java', require('highlight.js/lib/languages/java'));
hljs.registerLanguage('json', require('highlight.js/lib/languages/json'));
hljs.registerLanguage('dust', require('highlight.js/lib/languages/dust'));
hljs.registerLanguage('glsl', require('highlight.js/lib/languages/glsl'));
hljs.registerLanguage('http', require('highlight.js/lib/languages/http'));
hljs.registerLanguage('less', require('highlight.js/lib/languages/less'));
hljs.registerLanguage('scss', require('highlight.js/lib/languages/scss'));
hljs.registerLanguage('apache', require('highlight.js/lib/languages/apache'));
hljs.registerLanguage('python', require('highlight.js/lib/languages/python'));
hljs.registerLanguage('gherkin', require('highlight.js/lib/languages/gherkin'));
hljs.registerLanguage('markdown', require('highlight.js/lib/languages/markdown'));
hljs.registerLanguage('makefile', require('highlight.js/lib/languages/makefile'));
hljs.registerLanguage('handlebars', require('highlight.js/lib/languages/handlebars'));
hljs.registerLanguage('javascript', require('highlight.js/lib/languages/javascript'));
hljs.registerLanguage('typescript', require('highlight.js/lib/languages/typescript'));


const md = markdownIt({
  // enable HTML tags in source
  html: true,
  // do not use '/' to close single tags (<br />)
  xhtmlOut: false,

  // do not convert '\n' in paragraphs into <br>
  breaks: false,

  // CSS language prefix for fenced blocks
  langPrefix: 'language-',
  // autoconvert URL-like text to links
  linkify: true,

  // enable some language-neutral replacement + quotes beautification
  typographer: true,

  // double + single quotes replacement pairs, when typographer enabled,
  // and smartquotes on. Could be either a String or an Array.
  //
  // For example, you can use '«»„“' for Russian, '„“‚‘' for German,
  // and ['«\xA0', '\xA0»', '‹\xA0', '\xA0›'] for French (including nbsp).
  quotes: '“”‘’',

  // Highlighter function. Should return escaped HTML,
  // or '' if the source string is not changed and should be escaped externaly.
  // If result starts with <pre... internal wrapper is skipped.
  highlight: (str, language) => {
    if (language && hljs.getLanguage(language)) {
      try {
        const highlightedCode = hljs.highlight(str, {language, ignoreIllegals: true}).value;

        return `<pre class="hljs"><code>${highlightedCode}</code></pre>`;
      } catch (_) {
        console.info(
          'Could not highlight a piece of code with Highlight.js. Code: ' + str
        );
      }
    }

    return `<pre class="hljs"><code>${md.utils.escapeHtml(str)}</code></pre>`;
  }
});

let slideMetadata = {};

/**
 * Fetches the content of a file through AJAX.
 * @param {string} path the path of the file to fetch
 * @param {Function} callbackSuccess
 * @param {Function} callbackError
 */
const fetchFile = (path, callbackSuccess, callbackError) => {
  const xhr = new XMLHttpRequest();
  xhr.onreadystatechange = () => {
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

const checkForMetadata = (deck, slide, content) => {
  const tempSlide = document.createElement('section');
  tempSlide.innerHTML = content;

  if (
    tempSlide &&
    tempSlide.firstChild &&
    tempSlide.firstChild.nodeType === Node.COMMENT_NODE
  ) {
    const slideIndex = deck.slides.indexOf(slide);
    try {
      const metadata = JSON.parse(tempSlide.firstChild.nodeValue.trim());
      slideMetadata[`${slideIndex}`] = metadata;
      return true;
    } catch (e) {}
    return false;
  }
};

const removeMetadata = slide => slide.removeChild(slide.firstChild);

const callMetadata = (deck, callbacks) => {
  Object.keys(slideMetadata).forEach(slideIndex => {
    const metadata = slideMetadata[slideIndex];

    Object.keys(metadata).forEach(metadataFunctionName => {
      if (metadataFunctionName in callbacks) {
        callbacks[metadataFunctionName].call(
          deck,
          deck.slides[parseInt(slideIndex)],
          metadata[metadataFunctionName]
        );
      }
    });
  });
};

const markdownSlide = (deck, slide, content) => {
  const hadMetadata = checkForMetadata(deck, slide, content);
  slide.innerHTML = md.render(content);
  if (hadMetadata) {
    removeMetadata(slide);
  }
};

const createSlide = (deck, slide) => {
  const newSlide = document.createElement('section');
  let index;

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

const removeSlide = (deck, slide) => {
  const slideIndex = deck.slides.indexOf(slide);
  deck.slides.splice(slideIndex, 1);
  deck.parent.removeChild(slide);
};

const slidify = (deck, slide) => {
  const markdownAttribute = slide.getAttribute('data-markdown');

  switch (true) {
    // data-markdown="path-to-file.md" (so we load the .md file)
    case markdownAttribute && markdownAttribute.trim() !== '':
      fetchFile(
        markdownAttribute.trim(),
        fileContents => {
          var slidesContent = fileContents.split(/\r?\n---+\r?\n/);
          slidesContent.forEach(function(slideContent) {
            var slideContainer = createSlide(deck, slide);
            markdownSlide(deck, slideContainer, slideContent);
          });

          // removes original slide
          removeSlide(deck, slide);
        },
        () => {
          slide.innerHTML = 'Error loading the .md file for this slide.';
        }
      );
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

const processDeckForMarkdownAttributes = deck => {
  const markdownAttribute = deck.parent.getAttribute('data-markdown');
  let slide;

  if (markdownAttribute && markdownAttribute.trim()) {
    // <article data-markdown="...">
    // load the whole deck from md file
    // we create an initial slide with the same markdown attribute
    slide = createSlide(deck);
    slide.setAttribute('data-markdown', markdownAttribute);
  }

  // traverse slides to see which are html and which are md (data-markdown)
  deck.slides.forEach(slide => slidify(deck, slide));
};

/**
 * Checks whether we should consider for markdown rendering:
 * - elements with the attribute data-markdown, if at least one element has
 * that. It can be one or some slides or the parent object (full presentation).
 * - the content of all slides, if no element has data-markdown.
 */
const getPluginMode = deck => {
  const elements = [];
  let hasDataMarkdownAttribute;

  elements.push(deck.parent);
  deck.slides.forEach(slide => elements.push(slide));
  hasDataMarkdownAttribute = elements.some(
    current => current.getAttribute('data-markdown') !== null
  );

  return hasDataMarkdownAttribute
    ? 'transform-marked-elements-only'
    : 'transform-content-of-all-slides';
};

module.exports = (metadataCallbacks, pluginsArray) => {
  metadataCallbacks = metadataCallbacks || {};
  slideMetadata = {};

  // installs the markdown-it plugins provided by the user
  pluginsArray = !!pluginsArray
    ? Array.isArray(pluginsArray)
      ? pluginsArray
      : [pluginsArray]
    : [];
  pluginsArray.forEach(function(plugin) {
    if (isFunction(plugin)) {
      md.use(plugin);
    } else if (Array.isArray(plugin) && plugin.length > 0) {
      md.use.apply(md, plugin);
    }
  });

  return deck => {
    const mode = getPluginMode(deck);

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

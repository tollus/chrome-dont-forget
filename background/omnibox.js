
function omnibox_inputChanged(text, suggest) {
  console.log('inputChanged: ' + text);

  var addSuggest = function(content, description, url) {
    return {
      content: content,
      description: (url ? '<url>' + url + '</url> ' : '') + description
    };
  };
  var results = [];


}

function omnibox_inputEntered(text, disposition) {
  console.log('inputEntered: ' + text + ' - ' + disposition);

  if(text == '') return;

}

function setDefaultSuggestion() {
  chrome.omnibox.setDefaultSuggestion({
    description: '<dim>(examples:</dim> eat lunch at 12:30 pm<dim>|</dim>take a break in 10 minutes<dim>)</dim>'
  });
}

setDefaultSuggestion();

chrome.omnibox.onInputStarted.addListener(function() {
  setDefaultSuggestion();
});

chrome.omnibox.onInputCancelled.addListener(function() {
  setDefaultSuggestion();
});

chrome.omnibox.onInputChanged.addListener(omnibox_inputChanged);
chrome.omnibox.onInputEntered.addListener(omnibox_inputEntered);

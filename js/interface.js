// Selectors
var $accordionContainer = $('#accordion');

// TODO: For now we will pick just the first hook
var rule = {
  hooks: {},
  pages: [],
  filterType: null,
  requirement: null,
  errorMessage: null,
  onErrorAction: null
};

updateSelectText($('[data-name="requirement"]'));
updateSelectText($('[data-name="filterType"]'));
updateSelectText($('[data-name="hookType"]'));

var i = 1; // Just a counter to have a simple unique id for each hook when rendering the template.
var onErrorActionProviders = {};
var hooks;
var pages;
var accordionCollapsed;

Fliplet().then(function () {
  Promise.all([
    Fliplet.App.Hooks.get(),
    Fliplet.Pages.get()
  ])
    .then(function(values) {
      hooks = values[0];
      pages = values[1];
      Object.keys(hooks).forEach(function(hookName) {
        var hook = hooks[hookName];
        hook.settings = hook.settings || {};
        hook.settings.name = hookName;
        if (hook.settings.pages) {
          hook.settings.pages = pages.map(function(page) {
            page.selected = hook.settings.pages.indexOf(page.id) > -1;
            return page;
          });
        } else {
          hook.settings.pages = pages;
        }
        addHookItem(hook.settings);
      });
      Fliplet.Widget.autosize();
    });

});

function addHookItem(settings) {
  settings = settings || {};
  settings.pages = settings.pages || pages;
  i = i + 1;
  var extraContext = {
    id: i,
    beforeDataSourceQuery: settings.hookType === 'beforeDataSourceQuery',
    beforePageView: settings.hookType === 'beforePageView',
    whitelist: settings.filterType === 'whitelist',
    blacklist: settings.filterType === 'blacklist',
    saml2: settings.requirement === 'saml2',
    dataSource: settings.requirement === 'dataSource',
    custom: settings.requirement === 'custom'
  };
  var context = $.extend({}, settings, extraContext);
  var $hook = $(Fliplet.Widget.Templates['templates.hook'](context));
  $accordionContainer.append($hook);
  
  settings.onErrorAction = settings.onErrorAction || {};
  settings.onErrorAction.action = 'screen';
  settings.onErrorAction.options = { hideAction: true };
  onErrorActionProviders[i] = Fliplet.Widget.open('com.fliplet.link', {
    selector: '#accordion [data-id=' + i + '] .onErrorAction',
    data: settings.onErrorAction
  });

  updateSelectText($hook.find('[data-name="requirement"]'));
  updateSelectText($hook.find('[data-name="filterType"]'));
  updateSelectText($hook.find('[data-name="hookType"]'));
  $('.selectpicker').selectpicker('render');
}

function updateSelectText($el) {
  var selectedText = $el.find('option:selected').text();
  $el.parents('.select-proxy-display').find('.select-value-proxy').html(selectedText);
}

$('#filterType, #requirement, #hookType').on('change', function () {
  updateSelectText($(this));
});

$('[data-name="filterType"]').on('change', function () {

});

$('[data-name="requirement"]').on('change', function () {
  if ($(this).val() === 'custom') {
    $('[data-name="customCondition"]').show();
  }
});

// Listeners
$accordionContainer
  .on('click', '.icon-delete', function() {
    var $item = $(this).closest("[data-id], .panel");
    $item.remove();
  })
  .on('keyup change paste', '[data-name="hookName"]', function() {
    $(this).parents('.panel').find('.panel-title-text').html(this.value);
  })
  .on('show.bs.collapse', '.panel-collapse', function() {
    $(this).siblings('.panel-heading').find('.fa-chevron-right').removeClass('fa-chevron-right').addClass('fa-chevron-down');
    Fliplet.Widget.autosize
  })
  .on('hide.bs.collapse', '.panel-collapse', function() {
    $(this).siblings('.panel-heading').find('.fa-chevron-down').removeClass('fa-chevron-down').addClass('fa-chevron-right');
    Fliplet.Widget.autosize
  })
  .on('shown.bs.collapse hidden.bs.collapse', '.panel-collapse', function() {
    $('.tab-content').trigger('scroll');
    Fliplet.Widget.autosize
  })
  .on('change', '[data-name="hookType"]', function () {
    if ($(this).val() === 'beforePageView') {
      $(this).closest('.panel').find('.filter-type').show();
      $(this).closest('.panel').find('.pages').show();
    }
    if ($(this).val() === 'beforeDataSourceQuery') {
      $(this).closest('.panel').find('.filter-type').hide();
      $(this).closest('.panel').find('.pages').hide();
    }
  })
  .on('change', '[data-name="requirement"]', function () {
    if ($(this).val() === 'custom') {
      $(this).closest('.panel').find('.custom-condition').show();
    } else {
      $(this).closest('.panel').find('.custom-condition').hide();
    }
  });
  
$('.expand-items').on('click', function() {
  var $panelCollapse = $('.panel-collapse.in');
  // Update accordionCollapsed if all panels are collapsed/expanded
  if (!$panelCollapse.length) {
    accordionCollapsed = true;
  } else if ($panelCollapse.length == $('.panel-collapse').length) {
    accordionCollapsed = false;
  }

  if (accordionCollapsed) {
    expandAccordion();
  } else {
    collapseAccordion();
  }
});

function expandAccordion() {
  accordionCollapsed = false;
  $('.panel-collapse').collapse('show');
}

function collapseAccordion() {
  accordionCollapsed = true;
  $('.panel-collapse').collapse('hide');
}

  $('.new-hook').on('click', function() {
    addHookItem();
  });

Fliplet.Widget.onSaveRequest(function() {
  var newHooks = {};
  
  // Create a hook for each panel
  $('[data-id]').each(function() {
    var id = $(this).data('id');

    // Get selected pages
    var pages =[];
    $.each($(this).find(".selectpicker option:selected"), function() {
      pages.push(Number($(this).val()));
    });

    var hookName = $(this).find('[data-name=hookName]').val() || 'My Hook ' + (new Date()).getTime().toString().substring(9);
    $(this).find('[data-name=hookName]').val(hookName);
    newHooks[hookName] = {};
    newHooks[hookName].settings = {
      name: hookName,
      hookType: $(this).find('[data-name=hookType]').val(),
      filterType: $(this).find('[data-name=filterType]').val(),
      requirement: $(this).find('[data-name=requirement]').val(),
      errorMessage: $(this).find('[data-name=errorMessage]').val(),
      customCondition: $(this).find('[data-name=customCondition]').val(),
      pages: pages
    };
    newHooks[hookName].run = [$(this).find('#filterType').val()];
    
    onErrorActionProviders[id].then(function (result) {
      newHooks[hookName].settings.onErrorAction = result && result.data;
      newHooks[hookName].script = compile(newHooks[hookName].settings);
    });
  });

  Promise.all(Object.keys(onErrorActionProviders).map(function(id) {
    return onErrorActionProviders[id].forwardSaveRequest();
  }))
  .then(function () {
    return Fliplet.API.request({
      url: 'v1/apps/' + Fliplet.Env.get('appId'),
      method: 'PUT',
      data: {
        hooks: newHooks
      }
    });
  });
});

/**
 * Given settings this creates a script that will run on the set hook.
 * @param {Object} hook 
 */
function compile(hook) {
  if (hook.hookType === 'beforePageView') {
    var comparison = hook.filterType === 'whitelist' ? '>' : '===';
    return [
      'if ([' + hook.pages + '].indexOf(page.id) ' + comparison + ' -1 && ',
      '(!session || !session.server.passports.' + hook.requirement + ')',
      hook.customCondition ? ' && ' + hook.customCondition : '',
      ')',
      '{',
        'error = "' + hook.errorMessage + '";',
        'action = ' + (hook.onErrorAction.action ? '"' + hook.onErrorAction.action + '"' : 'null') + ';',
        'payload = ' + (hook.onErrorAction.page ? '{ pageId: ' + hook.onErrorAction.page + ' }' : 'null') + ';',
      '}'
    ].join('');
  }

  if (hook.hookType === 'beforeDataSourceQuery') {
    var condition;
    if (hook.requirement === 'custom') {
      condition = hook.customCondition;
    } else {
      condition = '!session || !session.server.passports.' + hook.requirement;
      // Also add custom condition if set even with a passport requirement
      if (hook.customCondition) {
        condition = condition + ' && ' + hook.customCondition
      } 
    }
    
    return [
      'if (' + condition + ')',
      '{',
        'error = "' + hook.errorMessage || 'Secured query' + '";',
      '}'
    ].join('');
  } 
}
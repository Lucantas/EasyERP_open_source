define([
        'text!templates/Filter/FilterTemplate.html',
        'text!templates/Filter/filterFavourites.html',
        'views/Filter/FilterValuesView',
        'views/Filter/savedFiltersView',
        'collections/Filter/filterCollection',
        'custom',
        'common',
        'constants',
        'models/UsersModel',
        'dataService'
    ],
    function (ContentFilterTemplate, savedFilterTemplate, valuesView, savedFiltersView, filterValuesCollection, Custom, Common, CONSTANTS, usersModel, dataService) {
        var FilterView;
        FilterView = Backbone.View.extend({
            el: '#searchContainer',
            contentType: "Filter",
            savedFilters: {},
            template: _.template(ContentFilterTemplate),

            events: {
                "mouseover .search-content": 'showSearchContent',
                "click .filter-dialog-tabs .btn": 'showFilterContent',
                'click #applyFilter': 'applyFilter',
                'click .condition li': 'conditionClick',
                'click .groupName': 'showHideValues',
                "click .filterValues li": "selectValue",
                "click .filters": "useFilter",
                "click #saveFilterButton": "saveFilter",
                "click .removeSavedFilter": "removeFilterFromDB"
            },

            initialize: function (options) {
                this.parentContentType = options.contentType;
                this.constantsObject = CONSTANTS.FILTERS[this.parentContentType];
                this.filterObject = App.filtersValues[this.parentContentType];
                this.filter = {};
                this.currentCollection = {};
                if (App.savedFilters[this.parentContentType]) {
                    this.savedFilters = App.savedFilters[this.parentContentType];
                }
                this.browserFilterObject = {};
            },

            useFilter: function (e) {
                var target = $(e.target);

                this.$el.find('.filters').removeClass('current');
                $(e.target).addClass('current');

                var targetId = target.attr('id');
                var savedFilters = App.savedFilters[this.parentContentType];

                this.filter = Custom.getFilterById(savedFilters, targetId);

                this.trigger('filter', this.filter);
            },

            saveFilter: function () {
                var currentUser = new usersModel(App.currentUser);
                var subMenu = $('#submenu-holder').find('li.selected').text();
                var key;
                var id;
                var filterObj = {};
                var mid = 39;
                var filterName = this.$el.find('#forFilterName').val();
                var bool = true;
                var self = this;
                var filters;
                var favouritesContent = this.$el.find('#favoritesContent');

                key = subMenu.trim();

                if (!filterName) {
                    alert('Please, enter filter name!');
                    bool = false;
                }

                if (bool && filterName) {
                    filterObj['filter'] = {};
                    filterObj['filter'][filterName] = {};
                    filterObj['filter'][filterName] = this.filter;
                    filterObj['key'] = key;

                    currentUser.changed = filterObj;

                    currentUser.save(
                        filterObj,
                        {
                            headers: {
                                mid: mid
                            },
                            wait: true,
                            patch: true,
                            validate: false,
                            success: function (model) {
                                console.log('Filter was saved to db');
                            },
                            error: function (model, xhr) {
                                console.error(xhr);
                            },
                            editMode: false
                        });
                    self.$el.find('#forFilterName').val('');

                    dataService.getData('/currentUser', null, function (response) {
                        if (response && !response.error) {
                            App.currentUser = response.user;
                            App.savedFilters = response.savedFilters;
                            if (App.savedFilters[self.parentContentType]) {
                                self.savedFilters = App.savedFilters[self.parentContentType];
                                favouritesContent.empty();
                                favouritesContent.append(_.template(savedFilterTemplate));
                                for (var j = self.savedFilters.length - 1; j >= 0; j--) {
                                    if (self.savedFilters[j]) {
                                        var keys = Object.keys(self.savedFilters[j]['filter']);
                                        for (var i = keys.length - 1; i >= 0; i--) {
                                            favouritesContent.append('<li class="filters"  id ="' + self.savedFilters[j]['_id'] + '">' + keys[i] + '</li><button class="removeSavedFilter" id="' + self.savedFilters[j]['_id'] + '">' + 'x' + '</button><br/>');
                                        }
                                    }
                                }
                            }
                        } else {
                            console.log('can\'t fetch currentUser');
                        }
                    });
                }
            },

            removeFilterFromDB: function (e) {
                var currentUser = new usersModel(App.currentUser);
                var filterObj = {};
                var mid = 39;
                var filterID = $(e.target).attr('id'); //chosen current filter id

                filterObj['deleteId'] = filterID;

                currentUser.changed = filterObj;

                currentUser.save(
                    filterObj,
                    {
                        headers: {
                            mid: mid
                        },
                        wait: true,
                        patch: true,
                        validate: false,
                        success: function (model) {
                            console.log('Filter was removed from db');
                        },
                        error: function (model, xhr) {
                            console.error(xhr);
                        },
                        editMode: false
                    }
                );

                $.find('#' + filterID)[0].remove();
                $.find('#' + filterID)[0].remove();

                var filters = App.savedFilters[this.parentContentType];
                for (var i = filters.length - 1; i >= 0; i--) {
                    if (filters[i]['_id'] === filterID) {
                        filters.splice(i, 1);
                    }

                }
            },

            selectValue: function (e) {
                var currentElement = $(e.target);
                var currentValue = currentElement.attr('data-value');
                var filterGroupElement = currentElement.closest('.filterGroup');
                var groupType = filterGroupElement.attr('data-value');
                var groupNameElement = filterGroupElement.find('.groupName')
                var constantsName = $.trim(groupNameElement.text());
                var filterObjectName = this.constantsObject[constantsName].view;
                var currentCollection = this.currentCollection[filterObjectName];
                var collectionElement;
                var intVal;
                var index;

                currentElement.toggleClass('checkedValue');

                intVal = parseInt(currentValue);

                currentValue = (isNaN(intVal) || currentValue.length === 24) ? currentValue : intVal;

                collectionElement = currentCollection.findWhere({_id: currentValue});

                if (currentElement.hasClass('checkedValue')) {

                    if (!this.filter[filterObjectName]) {
                        this.filter[filterObjectName] = {
                            key: groupType,
                            value: []
                        };
                    }

                    this.filter[filterObjectName]['value'].push(currentValue);
                    collectionElement.set({status: true});

                    groupNameElement.addClass('checkedGroup');
                } else {
                    index = this.filter[filterObjectName]['value'].indexOf(currentValue);

                    if (index >= 0) {
                        this.filter[filterObjectName]['value'].splice(index, 1);
                        collectionElement.set({status: false});

                        if (this.filter[filterObjectName]['value'].length === 0) {
                            delete this.filter[filterObjectName];
                            groupNameElement.removeClass('checkedGroup');
                        }
                    }
                    ;
                }

                this.trigger('filter', this.filter);
            },

            showHideValues: function (e) {
                var filterGroupContainer = $(e.target).closest('.filterGroup');

                filterGroupContainer.find('.ulContent').toggleClass('hidden');
                filterGroupContainer.toggleClass('activeGroup');
            },

            renderFilterContent: function () {
                var filtersGroupContainer;
                var self = this;
                var keys = Object.keys(this.constantsObject);
                var containerString;
                var filterBackend;

                filtersGroupContainer = $(this.el).find('#filtersContent');

                this.parseFilter();

                filtersGroupContainer.html('');

                if (keys.length) {
                    keys.forEach(function (key) {

                        filterBackend = self.constantsObject[key].backend;

                        containerString = '<div id="' + key + 'FullContainer" data-value="' + filterBackend + '" class="filterGroup">';

                        filtersGroupContainer.append(containerString);

                        self.renderGroup(key);
                    });
                };
            },

            renderGroup: function(key) {
                var itemView;
                var idString = '#' + key + 'FullContainer';
                var container = $(this.el).find(idString);
                var filterKey;
                var status;

                filterKey = this.constantsObject[key].view;

                this.currentCollection[filterKey] = new filterValuesCollection(this.filterObject[filterKey]);

                if (this.browserFilterObject[filterKey]) {
                    this.setStatus(filterKey);
                    status = true;
                } else {
                    status = false;
                }

                itemView = new valuesView({
                    element: idString,
                    status: status,
                    groupName: key,
                    currentCollection: this.currentCollection[filterKey]
                });

                container.html('');
                container.html(itemView.render());
            },

            render: function () {
                var savedContentView;

                this.$el.html(this.template({filterCollection: this.constantsObject}));

                this.renderFilterContent();

                savedContentView = new savedFiltersView({
                    contentType: this.parentContentType,
                    filter: this.filter
                });

                $(this.el).find('#favoritesContent').append(savedContentView);

                return this;
            },

            parseFilter: function () {
                var browserString = window.location.hash;
                var browserFilter = browserString.split('/filter=')[1];

                this.browserFilterObject = (browserFilter) ? JSON.parse(decodeURIComponent(browserFilter)) : {};
            },

            setStatus: function (filterKey) {
                var valuesArray;
                var collectionElement;

                valuesArray = this.browserFilterObject[filterKey]['value'];

                for (var i = valuesArray.length - 1; i >= 0; i--) {
                    collectionElement = this.currentCollection[filterKey].findWhere({_id: valuesArray[i]});
                    collectionElement.set({status: true});
                }
            },

            applyFilter: function () {
                /*this.$el.find('.filterValues').empty();
                 this.$el.find('.filter-icons').removeClass('active');
                 var values = this.$el.find('.chooseTerm');
                 var filterContainer = this.$el.find('.oe_searchview_input');
                 values.each(function (index, element) {
                 if ($(element).val()) {
                 filterContainer.append('<div class="filter-icons active" data-id=' + $(element).val() + '> <span class="fa fa-filter funnelIcon"></span>' +
                 '<span class="filterValues"> <span class="Clear" data-id="' + $(element).val() +
                 '">' + $(element).val() + '</span> </span> <span class="removeValues" data-id="' + $(element).val() + '">' + 'x </span> </div>');
                 }
                 });*/

                this.trigger('filter', this.filter);
            },

            conditionClick: function (e) {
                if (e.target.localName === 'li') {
                    $(e.target.children[0]).trigger('click');
                }
            },

            removeFilter: function (e) {
                var filter = this.$el.find('.filterOptions');
                var opt = this.$el.find('.chooseOption');
                var term = this.$el.find('.chooseTerm');
                var date = this.$el.find('.chooseDate');

                if (filter.length > 1 && e && e.target) {
                    if (e && e.target) {
                        $(e.target).closest('.filterOptions').remove();
                    }
                } else {
                    filter.removeClass('chosen');
                    opt.children().remove();
                    term.val($(".chooseTerm option:first").val());
                    date.remove();
                    opt.removeClass('activated').show();
                    this.$el.find(".filterOptions, .filterActions").hide();
                    /* if (e && e.target) {
                     this.trigger('defaultFilter');
                     e.stopPropagation();
                     }*/

                }
            },

            addCondition: function () {
                var lastOpt;
                this.$el.find(".filterOptions:first").clone().insertBefore('.filterActions');

                lastOpt = this.$el.find(".filterOptions:last");
                this.$el.find(".filterOptions:last").hide();
                lastOpt.children('.chooseOption').children().remove();
                lastOpt.children('.chooseOption').show().removeClass('activated');
                lastOpt.children('.chooseDate').remove();
                lastOpt.removeClass('chosen');
                lastOpt.remove();
            },

            chooseOptions: function (e) {
                var el = $(e.target.nextElementSibling);
                var value = e.target.value;
                var optDate = this.$el.find('.chooseDate');
                var liText;
                var values = new filterValuesCollection(App.filtersValues[this.parentContentType][value]);

                $(e.target).closest('.filterOptions').addClass('chosen');
                this.$el.find('.chooseTerm:last').addClass(value);
                $('.chooseOption:last').removeClass().addClass('chooseOption ' + value);

                if (/date/.test(value.toLowerCase())) {
                    el.html('').hide();
                    $('<div class=\'chooseDate\'><input id="start" type="date"/><input id="end" type="date"/><div>').insertBefore(el);
                } else {
                    if (optDate.length) {
                        optDate.remove();
                        el = $(e.target).next();
                    }

                    el.show();
                    el.children().remove();

                    values.forEach(function (opt) {
                        el.addClass('activated')

                        if (opt && opt.name && opt._id) {
                            el.append('<li><input type="checkbox" id="filter' + opt._id + '" value=' + opt._id + '><label for="filter' + opt._id + '">' + opt.name + '</label></li>');
                        }
                    });
                }
            },

            triggerClick: function (e) {
                if (e.target.localName === 'li') {
                    $(e.target.children[0]).trigger('click');
                }
            },

            showSearchContent: function () {
                var el = this.$el.find('.search-content');
                var searchOpt = this.$el.find('.search-options');
                var selector = 'fa-caret-up';

                searchOpt.removeClass('hidden');

                if (el.hasClass(selector)) {
                    el.removeClass(selector)
                } else {
                    el.addClass(selector)
                }
            },

            showFilterContent: function (e) {
                var currentValue = $(e.target).attr('data-value');

                this.$el.find(currentValue)
                    .removeClass('hidden')
                    .siblings()
                    .addClass('hidden');

            },

            writeValue: function (e) {
                var inputText = e.target.nextElementSibling.textContent;
                var filterValues = this.$el.find('.filterValues');
                var filterIcons = this.$el.find('.filter-icons');
                var input = this.$el.find('.drop-down-filter input');
                var defaultFilter = this.$el.find('#defaultFilter');
                var checked;

                filterIcons.addClass('active');

                $.each(input, function (index, value) {
                    if (value.checked) {
                        return checked = true
                    }
                });
                if (!checked) {
                    //this.trigger('defaultFilter');
                    filterValues.empty();
                    //filterIcons.removeClass('active');
                }
                if (e.target.checked) {
                    filterValues.append('<span class=' + '"' + inputText + '">' + inputText + '</span>');

                } else {
                    filterValues.find('.' + inputText).remove();
                }

                if (e.target.id !== 'defaultFilter') {

                    defaultFilter.removeAttr('checked');
                    filterValues.find('.Default').remove();
                    this.trigger('filter');
                } else {
                    $.each(input, function (index, value) {
                        if (value.id !== 'defaultFilter') value.checked = false
                    });
                    $.each($('.filterValues span'), function (index, item) {
                        if (item.className !== 'Clear') item.remove();
                    });
                    this.removeFilter();
                    this.trigger('defaultFilter');
                }

                /* if ($('.drop-down-filter input:checkbox:checked').length === 0) {
                 this.trigger('defaultFilter');
                 //this.$el.find('.removeFilter').trigger('click')
                 }*/

            },

            removeValues: function (e) {
                var element = $(e.target).closest('.filter-icons');
                var dataId = element.attr('data-id');
                var filterOpt = this.$el.find(".filterOptions");
                var clearElement = this.$el.find('.drop-down-filter .filterOptions');
                var closestEl = clearElement.find('.' + dataId);
                var cl = $(closestEl).closest('.filterOptions');

                if (filterOpt.length === 1) {
                    $(closestEl).prev().click();
                } else {
                    cl.remove();
                }

                element.remove();

                this.trigger('filter');
            }
        });

        return FilterView;
    });

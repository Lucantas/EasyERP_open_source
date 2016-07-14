define([
    'Backbone',
    'jQuery',
    'Underscore',
    'views/dialogViewBase',
    'text!templates/Orders/EditTemplate.html',
    'views/Assignees/AssigneesView',
    'views/Products/InvoiceOrder/ProductItems',
    'common',
    'custom',
    'dataService',
    'populate',
    'constants',
    'helpers'
], function (Backbone, $, _, ParentView, EditTemplate, AssigneesView, ProductItemView, common, Custom, dataService, populate, CONSTANTS, helpers) {

    var EditView = ParentView.extend({
        contentType: 'Orders',
        imageSrc   : '',
        template   : _.template(EditTemplate),

        initialize: function (options) {
            if (options) {
                this.visible = options.visible;
            }

            _.bindAll(this, 'render', 'saveItem');
            _.bindAll(this, 'render', 'deleteItem');

            this.currentModel = (options.model) ? options.model : options.collection.getElement();
            this.currentModel.urlRoot = '/orders';
            this.responseObj = {};
            this.forSales = false;

            this.editablePrice = this.currentModel.get('workflow').status === 'New' || false;

            this.render(options);
        },

        events: {
            'click .receiveInvoice': 'receiveInvoice',
            'click .cancelOrder'   : 'cancelOrder',
            'click .setDraft'      : 'setDraft'
        },

        chooseOption: function (e) {
            //$(e.target).parents('dd').find('.current-selected').text($(e.target).text()).attr('data-id', $(e.target).attr('id'));

            var currencyElement = $(e.target).parents('dd').find('.current-selected');
            var oldCurrency = currencyElement.attr('data-id');
            var newCurrency = $(e.target).attr('id');
            var oldCurrencyClass = helpers.currencyClass(oldCurrency);
            var newCurrencyClass = helpers.currencyClass(newCurrency);

            var array = this.$el.find('.' + oldCurrencyClass);

            array.removeClass(oldCurrencyClass).addClass(newCurrencyClass);

            currencyElement.text($(e.target).text()).attr('data-id', newCurrency);

            this.hideNewSelect();
        },

        cancelOrder: function (e) {
            var self = this;

            e.preventDefault();

            populate.fetchWorkflow({
                wId   : 'Purchase Order',
                status: 'Cancelled',
                order : 1
            }, function (workflow) {
                var redirectUrl = self.forSales ? 'easyErp/salesOrders' : 'easyErp/Orders';

                if (workflow && workflow.error) {
                    return App.render({
                        type   : 'error',
                        message: workflow.error.statusText
                    });
                }

                self.currentModel.save({
                    workflow: workflow._id
                }, {
                    headers: {
                        mid: 57
                    },
                    patch  : true,
                    success: function () {
                        Backbone.history.navigate(redirectUrl, {trigger: true});
                    }
                });
            });
        },

        receiveInvoice: function (e) {
            var self = this;
            var url = '/invoices/receive';
            var data = {
                forSales: this.forSales,
                orderId : this.currentModel.id,
                currency: this.currentModel.currency
            };

            e.preventDefault();

            this.saveItem(function (err) {
                if (!err) {
                    dataService.postData(url, data, function (err) {
                        var redirectUrl = self.forSales ? 'easyErp/salesInvoices' : 'easyErp/Invoices';

                        if (err) {
                            App.render({
                                type   : 'error',
                                message: 'Can\'t receive invoice'
                            });
                        } else {
                            Backbone.history.navigate(redirectUrl, {trigger: true});
                        }
                    });
                }
            });
        },

        setDraft: function (e) {
            var self = this;

            e.preventDefault();

            populate.fetchWorkflow({
                wId: 'Quotation'
            }, function (workflow) {
                var redirectUrl = self.forSales ? 'easyErp/salesOrders' : 'easyErp/Orders';

                if (workflow && workflow.error) {
                    return App.render({
                        type   : 'error',
                        message: workflow.error.statusText
                    });
                }

                self.currentModel.save({
                    workflow: workflow._id
                }, {
                    headers: {
                        mid: 57
                    },
                    patch  : true,
                    success: function () {
                        Backbone.history.navigate(redirectUrl, {trigger: true});
                    }
                });
            });
        },

        saveItem: function (invoiceCb) {
            var self = this;
            var mid = 55;
            var thisEl = this.$el;
            var selectedProducts = thisEl.find('.productItem');
            var products = [];
            var data;
            var selectedLength = selectedProducts.length;
            var targetEl;
            var productId;
            var quantity;
            var price;
            var description;
            var subTotal;
            var jobs;
            var scheduledDate;
            var taxes;
            var supplier = thisEl.find('#supplierDd').data('id');

            var destination = $.trim(thisEl.find('#destination').data('id'));
            var incoterm = $.trim(thisEl.find('#incoterm').data('id'));
            var invoiceControl = $.trim(thisEl.find('#invoicingControl').data('id'));
            var paymentTerm = $.trim(thisEl.find('#paymentTerm').data('id'));
            var fiscalPosition = $.trim(thisEl.find('#fiscalPosition').data('id'));
            var supplierReference = thisEl.find('#supplierReference').val();
            var orderDate = thisEl.find('#orderDate').val() || thisEl.find('#orderDate').text();
            var expectedDate = thisEl.find('#expectedDate').val() || thisEl.find('#minScheduleDate').text();

            var total = helpers.spaceReplacer($.trim(thisEl.find('#totalAmount').text()));
            var totalTaxes = helpers.spaceReplacer($.trim(thisEl.find('#taxes').text()));
            var unTaxed = helpers.spaceReplacer($.trim(thisEl.find('#totalUntaxes').text()));

            var usersId = [];
            var groupsId = [];
            var whoCanRW;
            var currency;
            var i;

            unTaxed = parseFloat(unTaxed) * 100;
            total = parseFloat(total) * 100;
            totalTaxes = parseFloat(totalTaxes) * 100;

            if (thisEl.find('#currencyDd').attr('data-id')) {
                currency = {
                    _id : thisEl.find('#currencyDd').attr('data-id'),
                    name: thisEl.find('#currencyDd').text()
                };
            } else {
                currency = {
                    _id : null,
                    name: ''
                };
            }

            $('.groupsAndUser tr').each(function () {
                if ($(this).data('type') === 'targetUsers') {
                    usersId.push($(this).data('id'));
                }
                if ($(this).data('type') === 'targetGroups') {
                    groupsId.push($(this).data('id'));
                }

            });

            whoCanRW = this.$el.find('[name="whoCanRW"]:checked').val();

            if (selectedLength) {
                for (i = selectedLength - 1; i >= 0; i--) {
                    targetEl = $(selectedProducts[i]);
                    productId = targetEl.data('id');
                    if (productId) {  // added more info for save
                        quantity = $.trim(targetEl.find('[data-name="quantity"]').text()) || targetEl.find('[data-name="quantity"] input').val();
                        price = helpers.spaceReplacer(targetEl.find('[data-name="price"]').text()) || helpers.spaceReplacer(targetEl.find('[data-name="price"] input').val());
                        price = parseFloat(price) * 100;
                        scheduledDate = $.trim(targetEl.find('[data-name="scheduledDate"]').text());
                        taxes = helpers.spaceReplacer($.trim(targetEl.find('[data-name="taxes"]').text()));
                        taxes = parseFloat(taxes) * 100;
                        description = targetEl.find('[data-name="productDescr"] textarea').val() || targetEl.find('[data-name="productDescr"]').text();
                        jobs = targetEl.find('[data-name="jobs"]').attr('data-content');
                        subTotal = helpers.spaceReplacer($.trim(targetEl.find('.subtotal').text()));
                        subTotal = parseFloat(subTotal) * 100;

                        products.push({
                            product      : productId,
                            unitPrice    : price,
                            quantity     : quantity,
                            scheduledDate: scheduledDate,
                            taxes        : taxes,
                            description  : description,
                            subTotal     : subTotal,
                            jobs         : jobs || null
                        });
                    }
                }
            }

            data = {
                currency         : currency,
                supplier         : supplier,
                supplierReference: supplierReference,
                products         : products,
                orderDate        : helpers.setTimeToDate(orderDate),
                expectedDate     : expectedDate,
                destination      : destination || null,
                incoterm         : incoterm || null,
                invoiceControl   : invoiceControl || null,
                paymentTerm      : paymentTerm || null,
                fiscalPosition   : fiscalPosition || null,
                paymentInfo      : {
                    total  : total,
                    unTaxed: unTaxed
                },

                groups: {
                    owner: this.$el.find('#allUsersSelect').attr('data-id') || null,
                    users: usersId,
                    group: groupsId
                },

                whoCanRW: whoCanRW
            };

            if (supplier) {
                this.model.save(data, {
                    headers: {
                        mid: mid
                    },
                    patch  : true,
                    success: function () {
                        Backbone.history.fragment = '';
                        Backbone.history.navigate(window.location.hash, {trigger: true});
                        self.hideDialog();

                        if (invoiceCb && typeof invoiceCb === 'function') {
                            return invoiceCb(null);
                        }
                    },

                    error: function (model, xhr) {
                        self.errorNotification(xhr);

                        if (invoiceCb && typeof invoiceCb === 'function') {
                            return invoiceCb(xhr.text);
                        }
                    }
                });

            } else {
                App.render({
                    type   : 'error',
                    message: CONSTANTS.RESPONSES.CREATE_QUOTATION
                });
            }
        },

        deleteItem: function (event) {
            var mid = 55;
            var self = this;
            var answer = confirm('Really DELETE items ?!');

            event.preventDefault();

            if (answer) {
                this.currentModel.destroy({
                    headers: {
                        mid: mid
                    },
                    success: function () {
                        $('.edit-product-dialog').remove();
                        Backbone.history.navigate('easyErp/' + self.contentType, {trigger: true});
                    },

                    error: function (model, err) {
                        if (err.status === 403) {
                            App.render({
                                type   : 'error',
                                message: 'You do not have permission to perform this action'
                            });
                        }
                    }
                });
            }

        },

        render: function () {
            var self = this;
            var formString = this.template({
                model  : this.currentModel.toJSON(),
                visible: this.visible
            });
            var model;
            var productItemContainer;

            this.$el = $(formString).dialog({
                closeOnEscape: false,
                autoOpen     : true,
                resizable    : true,
                dialogClass  : 'edit-dialog',
                title        : 'Edit Order',
                width        : '900px',
                buttons      : [
                    {
                        text : 'Save',
                        click: function () {
                            self.saveItem();
                        }
                    },

                    {
                        text : 'Cancel',
                        click: function () {
                            self.hideDialog();
                        }
                    },
                    {
                        text : 'Delete',
                        click: self.deleteItem
                    }
                ]

            });

            this.renderAssignees(this.currentModel);

            populate.get('#currencyDd', CONSTANTS.URLS.CURRENCY_FORDD, {}, 'name', this, true);

            populate.get('#destination', '/destination', {}, 'name', this, false, true);
            populate.get('#incoterm', '/incoterm', {}, 'name', this, false, true);
            populate.get('#invoicingControl', '/invoicingControl', {}, 'name', this, false, true);
            populate.get('#paymentTerm', '/paymentTerm', {}, 'name', this, false, true);
            populate.get('#deliveryDd', '/deliverTo', {}, 'name', this, false, true);
            populate.get2name('#supplierDd', CONSTANTS.URLS.SUPPLIER, {}, this, false, true);

            this.delegateEvents(this.events);
            model = this.currentModel.toJSON();

            this.$el.find('#expectedDate').datepicker({
                dateFormat : 'd M, yy',
                changeMonth: true,
                changeYear : true,
                maxDate    : '+0D'
            });

            productItemContainer = this.$el.find('#productItemsHolder');

            productItemContainer.append(
                new ProductItemView({
                    editable       : false,
                    editablePrice  : self.editablePrice,
                    balanceVissible: false
                }).render({model: model}).el
            );

            if (model.groups) {
                if (model.groups.users.length > 0 || model.groups.group.length) {
                    $('.groupsAndUser').show();
                    model.groups.group.forEach(function (item) {
                        $('.groupsAndUser').append("<tr data-type='targetGroups' data-id='" + item._id + "'><td>" + item.name + "</td><td class='text-right'></td></tr>");
                        $('#targetGroups').append("<li id='" + item._id + "'>" + item.name + '</li>');
                    });
                    model.groups.users.forEach(function (item) {
                        $('.groupsAndUser').append("<tr data-type='targetUsers' data-id='" + item._id + "'><td>" + item.login + "</td><td class='text-right'></td></tr>");
                        $('#targetUsers').append("<li id='" + item._id + "'>" + item.login + '</li>');
                    });

                }
            }
            return this;
        }

    });

    return EditView;
});

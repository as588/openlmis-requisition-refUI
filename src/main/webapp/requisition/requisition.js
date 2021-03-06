/*
 * This program is part of the OpenLMIS logistics management information system platform software.
 * Copyright © 2017 VillageReach
 *
 * This program is free software: you can redistribute it and/or modify it under the terms
 * of the GNU Affero General Public License as published by the Free Software Foundation, either
 * version 3 of the License, or (at your option) any later version.
 *  
 * This program is distributed in the hope that it will be useful, but WITHOUT ANY WARRANTY;
 * without even the implied warranty of MERCHANTABILITY or FITNESS FOR A PARTICULAR PURPOSE. 
 * See the GNU Affero General Public License for more details. You should have received a copy of
 * the GNU Affero General Public License along with this program. If not, see
 * http://www.gnu.org/licenses.  For additional information contact info@OpenLMIS.org. 
 */

(function() {

    'use strict';

    /**
     * @ngdoc service
     * @name requisition.Requisition
     *
     * @description
     * Responsible for supplying requisition with additional methods.
     */
    angular
        .module('requisition')
        .factory('Requisition', requisitionFactory);

    requisitionFactory.$inject = [
        '$q', '$resource', 'openlmisUrlFactory', 'requisitionUrlFactory', 'RequisitionTemplate',
        'LineItem', 'REQUISITION_STATUS', 'COLUMN_SOURCES', 'localStorageFactory', 'offlineService',
        'dateUtils', '$filter'
    ];

    function requisitionFactory($q, $resource, openlmisUrlFactory, requisitionUrlFactory,
                                RequisitionTemplate, LineItem, REQUISITION_STATUS, COLUMN_SOURCES,
                                localStorageFactory, offlineService, dateUtils, $filter) {

        var offlineRequisitions = localStorageFactory('requisitions'),
            offlineStockAdjustmentReasons = localStorageFactory('stockAdjustmentReasons'),
            resource = $resource(requisitionUrlFactory('/api/requisitions/:id'), {}, {
            'authorize': {
                url: requisitionUrlFactory('/api/requisitions/:id/authorize'),
                method: 'POST'
            },
            'save': {
                method: 'PUT',
                transformRequest: transformRequisition
            },
            'submit': {
                url: requisitionUrlFactory('/api/requisitions/:id/submit'),
                method: 'POST'
            },
            'approve': {
                url: requisitionUrlFactory('/api/requisitions/:id/approve'),
                method: 'POST'
            },
            'reject': {
                url: requisitionUrlFactory('/api/requisitions/:id/reject'),
                method: 'PUT'
            },
            'skip': {
                url: requisitionUrlFactory('/api/requisitions/:id/skip'),
                method: 'PUT'
            }
        });

        Requisition.prototype.$authorize = authorize;
        Requisition.prototype.$save = save;
        Requisition.prototype.$submit = submit;
        Requisition.prototype.$remove = remove;
        Requisition.prototype.$approve = approve;
        Requisition.prototype.$reject = reject;
        Requisition.prototype.$skip = skip;
        Requisition.prototype.$isInitiated = isInitiated;
        Requisition.prototype.$isSubmitted = isSubmitted;
        Requisition.prototype.$isApproved = isApproved;
        Requisition.prototype.$isAuthorized = isAuthorized;
        Requisition.prototype.$isInApproval = isInApproval;
        Requisition.prototype.$isReleased = isReleased;


        return Requisition;

        /**
         * @ngdoc function
         * @name requisition
         * @methodOf requisition.Requisition
         * @param {Resource} requisition resource with requisition
         * @param {Resource} approvedProducts resource with approved products
         * @return {Object} requisition with methods
         *
         * @description
         * Adds all needed methods and information from template to given requisition.
         *
         */
        function Requisition(source, reasons, statusMessages) {
            var programId = source.program.id,
                requisition = this;

            angular.copy(source, this);

            this.$stockAdjustmentReasons = reasons;
            this.template = new RequisitionTemplate(this.template, source);
            this.$statusMessages = $filter('orderBy')(statusMessages, '-createdDate');

            this.requisitionLineItems = [];
            source.requisitionLineItems.forEach(function(lineItem) {
                requisition.requisitionLineItems.push(new LineItem(lineItem, requisition));
            });
        }

        /**
         * @ngdoc function
         * @name authorize
         * @methodOf requisition.Requisition
         * @return {Promise} requisition promise
         *
         * @description
         * Authorizes requisition.
         *
         */
        function authorize() {
            var requisition = this;
            return handlePromise(resource.authorize({
                id: this.id
            }, {}).$promise, function(authorized) {
                saveToStorage(authorized, requisition.$availableOffline);
            });
        }

        /**
         * @ngdoc function
         * @name remove
         * @methodOf requisition.Requisition
         * @return {Promise} promise that resolves after requisition is deleted
         *
         * @description
         * Removes requisition.
         *
         */
        function remove() {
            var id = this.id;
            return handlePromise(resource.remove({
                id: this.id
            }).$promise, function() {
                offlineRequisitions.removeBy('id', id);
            });
        }

        /**
         * @ngdoc function
         * @name save
         * @methodOf requisition.Requisition
         * @return {Promise} requisition promise
         *
         * @description
         * Saves requisition.
         *
         */
        function save() {
            var availableOffline = this.$availableOffline;
            return handlePromise(resource.save({
                id: this.id
            }, this).$promise, function(saved) {
                saveToStorage(saved, availableOffline);
            });
        }

        /**
         * @ngdoc function
         * @name submit
         * @methodOf requisition.Requisition
         * @return {Promise} requisition promise
         *
         * @description
         * Submits requisition.
         *
         */
        function submit() {
            var availableOffline = this.$availableOffline;
            return handlePromise(resource.submit({
                id: this.id
            }, {}).$promise, function(submitted) {
                saveToStorage(submitted, availableOffline);
            });
        }

        /**
         * @ngdoc function
         * @name approve
         * @methodOf requisition.Requisition
         * @return {Promise} promise that resolves when requisition is approved
         *
         * @description
         * Approves requisition.
         *
         */
        function approve() {
            var availableOffline = this.$availableOffline;
            return handlePromise(resource.approve({
                id: this.id
            }, {}).$promise, function(approved) {
                saveToStorage(approved, availableOffline);
            });
        }

        /**
         * @ngdoc function
         * @name reject
         * @methodOf requisition.Requisition
         * @return {Promise} promise that resolves when requisition is rejected
         *
         * @description
         * Rejects requisition.
         *
         */
        function reject() {
            var availableOffline = this.$availableOffline;
            return handlePromise(resource.reject({
                id: this.id
            }, {}).$promise, function(rejected) {
                saveToStorage(rejected, availableOffline);
            });
        }

        /**
         * @ngdoc function
         * @name skip
         * @methodOf requisition.Requisition
         * @return {Promise} promise that resolves when requisition is skipped
         *
         * @description
         * Skips requisition.
         *
         */
        function skip() {
            return handlePromise(resource.skip({
                id: this.id
            }, {}).$promise, function(requisition) {
                offlineRequisitions.removeBy('id', requisition.id);
            });
        }

        /**
         * @ngdoc function
         * @name isInitiated
         * @methodOf requisition.Requisition
         *
         * @description
         * Responsible for checking if requisition is initiated.
         * Returns true only if requisition status equals initiated.
         *
         * @return {boolean} is requisition initiated
         */
        function isInitiated() {
            return this.status === REQUISITION_STATUS.INITIATED;
        }

        /**
         * @ngdoc function
         * @name isSubmitted
         * @methodOf requisition.Requisition
         *
         * @description
         * Responsible for checking if requisition is submitted.
         * Returns true only if requisition status equals submitted.
         *
         * @return {boolean} is requisition submitted
         */
        function isSubmitted() {
            return this.status === REQUISITION_STATUS.SUBMITTED;
        }

        /**
         * @ngdoc function
         * @name isAuthorized
         * @methodOf requisition.Requisition
         *
         * @description
         * Responsible for checking if requisition is authorized.
         * Returns true only if requisition status equals authorized.
         *
         * @return {boolean} is requisition authorized
         */
        function isAuthorized() {
            return this.status === REQUISITION_STATUS.AUTHORIZED;
        }

        /**
         * @ngdoc function
         * @name isApproved
         * @methodOf requisition.Requisition
         *
         * @description
         * Responsible for checking if requisition is approved.
         * Returns true only if requisition status equals approved.
         *
         * @return {boolean} is requisition approved
         */
        function isApproved() {
            return this.status === REQUISITION_STATUS.APPROVED;
        }

        /**
         * @ngdoc function
         * @name isInApproval
         * @methodOf requisition.Requisition
         *
         * @description
         * Responsible for checking if requisition is in approval.
         * Returns true only if requisition status equals in approval.
         *
         * @return {boolean} is requisition in approval
         */
        function isInApproval() {
            return this.status === REQUISITION_STATUS.IN_APPROVAL;
        }

        /**
         * @ngdoc function
         * @name isReleased
         * @methodOf requisition.Requisition
         *
         * @description
         * Responsible for checking if requisition is released.
         * Returns true only if requisition status equals released.
         *
         * @return {boolean} is requisition released
         */
        function isReleased() {
            return this.status === REQUISITION_STATUS.RELEASED;
        }

        function handlePromise(promise, success, failure) {
            var deferred = $q.defer();

            promise.then(function(response) {
                if (success) success(response);
                deferred.resolve(response);
            }, function(response) {
                if (failure) failure(response);
                deferred.reject(response);
            });

            return deferred.promise;
        }

        function saveToStorage(requisition, shouldSave) {
            if (shouldSave) {
                requisition.$modified = false;
                offlineRequisitions.put(requisition);
            }
        }

        function transformRequisition(requisition) {
            var columns = requisition.template.columnsMap;
            angular.forEach(requisition.requisitionLineItems, function(lineItem) {
                transformLineItem(lineItem, columns);
            });

            requisition.processingPeriod.startDate = dateUtils.toStringDate(requisition.processingPeriod.startDate);
            requisition.processingPeriod.endDate = dateUtils.toStringDate(requisition.processingPeriod.endDate);

            return angular.toJson(requisition);
        }


        function transformLineItem(lineItem, columns) {
            angular.forEach(columns, function(column) {
                if (!column.$display || column.source === COLUMN_SOURCES.CALCULATED) {
                    lineItem[column.name] = null;
                }
            });
        }
    }

})();

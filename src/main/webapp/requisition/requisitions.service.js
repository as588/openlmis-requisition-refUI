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
     * @name requisition.requisitionService
     *
     * @description
     * Responsible for retriving all information from server.
     */
    angular
        .module('requisition')
        .service('requisitionService', service);

    service.$inject = [
        '$q', '$resource', 'messageService', 'openlmisUrlFactory', 'requisitionUrlFactory',
        'Requisition', 'confirmService', 'notificationService', 'dateUtils',
        'localStorageFactory', 'offlineService'
    ];

    function service($q, $resource, messageService, openlmisUrlFactory, requisitionUrlFactory,
                                Requisition, confirmService, notificationService, dateUtils,
                                localStorageFactory, offlineService) {

        var offlineRequisitions = localStorageFactory('requisitions'),
            onlineOnlyRequisitions = localStorageFactory('onlineOnly'),
            offlineStockAdjustmentReasons = localStorageFactory('stockAdjustmentReasons'),
            offlineStatusMessages = localStorageFactory('statusMessages');

        var resource = $resource(requisitionUrlFactory('/api/requisitions/:id'), {}, {
            'get': {
                method: 'GET',
                transformResponse: transformGetResponse
            },
            'initiate': {
                url: requisitionUrlFactory('/api/requisitions/initiate'),
                method: 'POST'
            },
            'search': {
                url: requisitionUrlFactory('/api/requisitions/search'),
                method: 'GET'
            },
            'forApproval': {
                url: requisitionUrlFactory('/api/requisitions/requisitionsForApproval'),
                method: 'GET',
                isArray: true,
                transformResponse: transformRequisitionListResponse
            },
            'forConvert': {
                url: requisitionUrlFactory('/api/requisitions/requisitionsForConvert'),
                method: 'GET',
                transformResponse: transformResponseForConvert
            },
            'convertToOrder': {
                url: requisitionUrlFactory('/api/requisitions/convertToOrder'),
                method: 'POST',
                transformRequest: transformRequest
            },
            'getStockAdjustmentReasonsByProgram': {
                url: openlmisUrlFactory('/api/stockAdjustmentReasons/search'),
                method: 'GET',
                isArray: true
            },
            'getStatusMessages': {
                url: requisitionUrlFactory('/api/requisitions/:id/statusMessages'),
                method: 'GET',
                isArray: true
            }
        });

        var service = {
            get: get,
            initiate: initiate,
            search: search,
            forApproval: forApproval,
            forConvert: forConvert,
            convertToOrder: convertToOrder
        };

        return service;

        /**
         * @ngdoc function
         * @name get
         * @methodOf requisition.requisitionService
         * @param {String} id Requisition UUID
         * @return {Promise} requisition promise
         *
         * @description
         * Retrieves requisition by id.
         *
         */
        function get(id) {
            var deferred = $q.defer();

            if (offlineService.isOffline()) {
                var requisition = offlineRequisitions.getBy('id', id),
                    reasons = offlineStockAdjustmentReasons.search({
                        program: {
                            id: requisition.program.id
                        }
                    }),
                    statusMessages = offlineStatusMessages.search({
                        requisitionId: requisition.id
                    });

                resolve(requisition, reasons, statusMessages);
            } else {
                var requisition = offlineRequisitions.search({
                    id: id,
                    $modified: true
                });
                if (!requisition || !requisition.length) {
                    var i = 0;
                    getRequisition(id).then(function(requisition) {
                        requisition.$availableOffline = !onlineOnlyRequisitions.contains(id);
                        $q.all([
                            getStockAdjustmentReasons(requisition),
                            getStatusMessages(requisition)
                        ]).then(function(responses) {
                            if (requisition.$availableOffline) {
                                storeResponses(requisition, responses[0], responses[1]);
                            }
                            resolve(requisition, responses[0], responses[1]);
                        }, function() {
                            if (requisition.$availableOffline) {
                                offlineRequisitions.put(requisition);
                            }
                            resolve(requisition);
                        });
                    }, error);
                } else {
                    var reasons = offlineStockAdjustmentReasons.search({
                            program: {
                                id: requisition[0].program.id
                            }
                        }),
                        statusMessages = offlineStatusMessages.search({
                            requisitionId: requisition[0].id
                        });

                    resolve(requisition[0], reasons, statusMessages);
                }
            }

            return deferred.promise;

            function resolve(requisition, reasons, statusMessages) {
                deferred.resolve(new Requisition(requisition, reasons, statusMessages));
            }

            function error() {
                deferred.reject();
            }
        }

        /**
         * @ngdoc function
         * @name initiate
         * @methodOf requisition.requisitionService
         * @param {String} facility Facility UUID
         * @param {String} program Program UUID
         * @param {String} suggestedPeriod Period UUID
         * @param {boolean} emergency Indicates if requisition is emergency or not
         * @return {Promise} requisition promise
         *
         * @description
         * Initates new requisition for program in facility with given period.
         *
         */
        function initiate(facility, program, suggestedPeriod, emergency) {
            return resource.initiate({
                facility: facility,
                program: program,
                suggestedPeriod: suggestedPeriod,
                emergency: emergency
            }, {}).$promise;
        }

        /**
         * @ngdoc function
         * @name search
         * @methodOf requisition.requisitionService
         * @param {boolean} offline Indicates if searching in offline requisitions
         * @param {Object} searchParams Contains parameters for searching requisitions, i.e.
         * {
         *      program: 'programID',
         *      facility: 'facilityID',
         *      initiatedDateFrom: 'startDate',
         *      initiatedDateTo: 'endDate',
         *      requisitionStatus: ['status1', 'status2'],
         *      emergency: false
         * }
         *
         * @return {Array} Array of requisitions for given criteria (optional)
         *
         * @description
         * Search requisitons by criteria from parameters.
         *
         */
        function search(offline, searchParams) {
            var deferred = $q.defer();

            if(offline) {
                var requisitions = offlineRequisitions.search(searchParams, 'requisitionSearch');
                angular.forEach(requisitions, function(requisition) {
                    transformRequisition(requisition);
                    requisition.$searchedOffline = true;
                });
                deferred.resolve(requisitions);
            } else {
                return resource.search(searchParams).$promise;
            }

            return deferred.promise;
        }

        /**
         * @ngdoc function
         * @name forApproval
         * @methodOf requisition.requisitionService
         * @return {Array} Array of requisitions for approval
         *
         * @description
         * Retrieves all requisitions with authorized status for approve.
         *
         */
        function forApproval() {
            return resource.forApproval().$promise;
        }

        /**
         * @ngdoc function
         * @name forConvert
         * @methodOf requisition.requisitionService
         * @param {Object} params Request params, contains i.e.: filertBy, filterValue, sortBy, descending
         * @return {Array} Array of requisitions for convert
         *
         * @description
         * Search requisitons for convert to order by given criteria.
         *
         */
        function forConvert(params) {
            return resource.forConvert(params).$promise;
        }

        /**
         * @ngdoc function
         * @name convertToOrder
         * @methodOf requisition.requisitionService
         * @param {Array} requisitions Array of requisitions to convert
         *
         * @description
         * Converts given requisitions into orders.
         *
         */
        function convertToOrder(requisitions) {
            var deferred = $q.defer();

            confirmService.confirm('msg.question.confirmation.convertToOrder').then(function() {
                resource.convertToOrder(requisitions).$promise.then(function() {
                    deferred.resolve();
                    notificationService.success('msg.rnr.converted.to.order');
                }, function() {
                    deferred.reject();
                    notificationService.error('msg.error.occurred');
                });
            }, function() {
                deferred.reject();
            });

            return deferred.promise;
        }

        function getRequisition(id) {
            return resource.get({
                id: id
            }).$promise;
        }

        function getOfflineRequisition(id) {
            return offlineRequisitions.getBy('id', id);
        }

        function getStockAdjustmentReasons(requisition) {
            return resource.getStockAdjustmentReasonsByProgram({
                program: requisition.program.id
            }).$promise;
        }

        function getStatusMessages(requisition) {
            return resource.getStatusMessages({
                id: requisition.id
            }).$promise;
        }

        function storeResponses(requisition, reasons, statusMessages) {
            requisition.$modified = false;
            offlineRequisitions.put(requisition);

            reasons.forEach(function(reason) {
                offlineStockAdjustmentReasons.put(reason);
            });

            statusMessages.forEach(function(statusMessage) {
                offlineStatusMessages.put(statusMessage);
            });
        }

        function transformRequest(requisitionsWithDepots) {
            var body = [];
            angular.forEach(requisitionsWithDepots, function(requisitionWithDepots) {
                body.push({
                    requisitionId: requisitionWithDepots.requisition.id,
                    supplyingDepotId: requisitionWithDepots.requisition.supplyingFacility
                });
            });
            return angular.toJson(body);
        }

        function transformGetResponse(data, headers, status) {
            return transformResponse(data, status, function(response) {
                if (response.processingPeriod.startDate) {
                    response.processingPeriod.startDate = dateUtils.toDate(response.processingPeriod.startDate);
                }
                if (response.processingPeriod.endDate) {
                    response.processingPeriod.endDate = dateUtils.toDate(response.processingPeriod.endDate);
                }
                return response;
            });
        }

        function transformRequisitionListResponse(data, headers, status) {
            return transformResponse(data, status, function(requisitions) {
                angular.forEach(requisitions, transformRequisition);
                return requisitions;
            });
        }

        function transformResponseForConvert(data, headers, status) {
            return transformResponse(data, status, function(response) {
                angular.forEach(response.content, function(item) {
                    transformRequisition(item.requisition);
                });
                return response;
            });
        }

        function transformResponse(data, status, transformer) {
            if (status === 200) {
                return transformer(angular.fromJson(data));
            }
            return data;
        }

        function transformRequisition(requisition) {
            requisition.createdDate = dateUtils.toDate(requisition.createdDate);
            requisition.processingPeriod.startDate = dateUtils.toDate(requisition.processingPeriod.startDate);
            requisition.processingPeriod.endDate = dateUtils.toDate(requisition.processingPeriod.endDate);
            requisition.processingPeriod.processingSchedule.modifiedDate = dateUtils.toDate(requisition.processingPeriod.processingSchedule.modifiedDate);
        }
    }
})();

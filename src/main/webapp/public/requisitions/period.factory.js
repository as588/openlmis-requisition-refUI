(function() {
  
    'use strict';

    angular.module('openlmis.requisitions').factory('PeriodFactory', periodFactory);

    periodFactory.$inject = ['$resource', 'RequisitionURL', 'RequisitionFactory', 'messageService'];

    function periodFactory($resource, RequisitionURL, RequisitionFactory, messageService) {

        var resource = $resource(RequisitionURL('/api/requisitions/periods-for-initiate'), {}, {
            get: {
                method: 'GET',
                isArray: true
            }
        });

        var service = {
            get: get
        };
        return service;

        function get(programId, facilityId, emergency) {
            var periods = resource.get({programId: programId, facilityId: facilityId, emergency: emergency});

            periods.$promise.then(function(data) {
                if(!Array.isArray(data)){
                    return [];
                }
        
                formatDates(data);
                addRequisitionToPeriods(data, programId, facilityId);

                return data;
            });
            return periods;
        }

        function addRequisitionToPeriods(periods, programId, facilityId) {
            periods.forEach(function(period){
                addRequisitionToPeriod(period, programId, facilityId);
            });

            periods[0].activeForRnr = true;      // set oldest period to active
            if (!periods[0].rnrId) {
                periods[0].rnrStatus = messageService.get("msg.rnr.not.started");
            }
        }

        function addRequisitionToPeriod(period, programId, facilityId) {
            var requisitions = RequisitionFactory.search(period.id, programId, facilityId);

            requisitions.then(function(data) {
                data.forEach(function (requisition) {
                    if (requisition.processingPeriodId == period.id) {
                        period.rnrId = requisition.id;
                        period.rnrStatus = requisition.status;
                    }
                });
            });
        }

        function formatDates(periods) {
            periods.forEach(function(period){
                period.startDate = new Date(period.startDate.join('-'));
                period.endDate = new Date(period.endDate.join('-'));
            });
        }
    }

})();